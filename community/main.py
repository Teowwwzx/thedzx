"""
thedzx community API — comments, reactions, and pieces readers ask for.

Small on purpose: FastAPI, one SQLite file, no accounts. The blog at
thedzx.site is complete without this; the browser hides every community
element if this service does not answer.

What it deliberately does NOT store: IP addresses, emails, cookies. Rate
limiting uses the client address in memory only, and forgets it.

Trust boundaries
  - nginx only accepts Cloudflare (the $from_cloudflare guard), so
    CF-Connecting-IP is the real client and is safe to rate-limit on.
  - Reader text is stored as typed and rendered with textContent by the site.
    Nothing here ever emits reader text as HTML.
  - Moderation needs ADMIN_TOKEN, which lives only in this box's .env.
"""
import json
import os
import re
import secrets
import sqlite3
import time
from collections import defaultdict, deque
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

DB_PATH = os.environ.get("DB_PATH", "/data/community.db")
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "")
ORIGINS = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "https://thedzx.site").split(",") if o.strip()]
TOPICS = {t.strip() for t in os.environ.get("TOPICS", "it,thinking,markets,world,macro").split(",") if t.strip()}
# The site's published list of posts. Read from disk (the web root is mounted
# read-only), so validating a slug never needs the network.
POSTS_JSON = os.environ.get("POSTS_JSON", "/var/www/thedzx.site/current/posts.json")

SLUG = re.compile(r"^[a-z0-9][a-z0-9-]{0,79}$")
KINDS = {"helpful", "same", "new"}

app = FastAPI(title="thedzx-community", docs_url=None, redoc_url=None, openapi_url=None)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["content-type"],
    max_age=600,
)


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def db() -> sqlite3.Connection:
    con = sqlite3.connect(DB_PATH, timeout=5)
    con.row_factory = sqlite3.Row
    return con


def init_db() -> None:
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    with closing(db()) as con, con:
        con.execute("PRAGMA journal_mode=WAL")
        con.executescript(
            """
            CREATE TABLE IF NOT EXISTS requests(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                topic TEXT NOT NULL,
                question TEXT NOT NULL,
                name TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'pending',   -- pending | open | answered | rejected
                votes INTEGER NOT NULL DEFAULT 1,
                post TEXT,
                created_at TEXT NOT NULL,
                reviewed_at TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
            CREATE TABLE IF NOT EXISTS comments(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                slug TEXT NOT NULL,
                name TEXT NOT NULL,
                text TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'live',      -- live | hidden
                created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_comments_slug ON comments(slug, status);
            CREATE TABLE IF NOT EXISTS reactions(
                slug TEXT NOT NULL,
                kind TEXT NOT NULL,
                count INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (slug, kind)
            );
            """
        )


init_db()

# --- the site's posts, cached by file modification time -------------------
_posts: dict = {"mtime": None, "slugs": None}


def known_slugs() -> set[str] | None:
    """Slugs the site has published, or None if the list is unreadable."""
    try:
        mtime = os.stat(POSTS_JSON).st_mtime
    except OSError:
        return None
    if _posts["mtime"] != mtime:
        try:
            with open(POSTS_JSON, encoding="utf-8") as f:
                _posts["slugs"] = {p["slug"] for p in json.load(f).get("posts", [])}
            _posts["mtime"] = mtime
        except (OSError, ValueError, KeyError, TypeError):
            return None
    return _posts["slugs"]


def check_slug(slug: str) -> str:
    if not SLUG.match(slug):
        raise HTTPException(404, "unknown post")
    slugs = known_slugs()
    # Unreadable list: fall back to the shape check alone rather than take
    # every discussion offline over a missing file. Writes stay rate-limited.
    if slugs is not None and slug not in slugs:
        raise HTTPException(404, "unknown post")
    return slug


# --- rate limiting, in memory only ------------------------------------------
_hits: dict[str, deque] = defaultdict(deque)


def client(request: Request) -> str:
    return request.headers.get("cf-connecting-ip") or (request.client.host if request.client else "?")


def limit(request: Request, bucket: str, count: int, window: int) -> None:
    key = f"{bucket}:{client(request)}"
    q = _hits[key]
    t = time.monotonic()
    while q and t - q[0] > window:
        q.popleft()
    if len(q) >= count:
        raise HTTPException(429, "Slow down a little — try again in a few minutes.")
    q.append(t)
    # Forget idle clients so the table cannot grow without bound.
    if len(_hits) > 50_000:
        for k in [k for k, v in _hits.items() if not v or t - v[-1] > 3600]:
            del _hits[k]


_voted: dict[str, float] = {}


def once(request: Request, key: str, window: int = 86_400) -> bool:
    """True the first time this client does `key` in `window` seconds."""
    k = f"{key}:{client(request)}"
    t = time.monotonic()
    if k in _voted and t - _voted[k] < window:
        return False
    _voted[k] = t
    if len(_voted) > 200_000:
        _voted.clear()
    return True


# --- cleaning ----------------------------------------------------------------
CONTROL = re.compile(r"[\x00-\x08\x0b-\x1f\x7f​-‏‪-‮⁦-⁩]")


def one_line(s: str) -> str:
    return re.sub(r"\s+", " ", CONTROL.sub("", s)).strip()


def paragraphs(s: str) -> str:
    s = CONTROL.sub("", s.replace("\r\n", "\n")).strip()
    s = re.sub(r"[ \t]+", " ", s)
    return re.sub(r"\n{3,}", "\n\n", s)


# --- public: pieces readers asked for ----------------------------------------
class NewRequest(BaseModel):
    topic: str
    question: str = Field(min_length=8, max_length=140)
    name: str = Field(default="", max_length=30)
    website: str = ""  # honeypot


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/requests")
def list_requests():
    with closing(db()) as con:
        rows = con.execute(
            "SELECT id, topic, question, name, votes, created_at FROM requests "
            "WHERE status = 'open' ORDER BY votes DESC, id ASC LIMIT 100"
        ).fetchall()
    return [dict(r) for r in rows]


@app.post("/api/requests", status_code=202)
def create_request(body: NewRequest, request: Request):
    if body.website:
        return {"status": "pending"}  # a bot; say nothing useful
    if body.topic not in TOPICS:
        raise HTTPException(400, "unknown topic")
    limit(request, "ask", 3, 600)
    question, name = one_line(body.question), one_line(body.name)
    if len(question) < 8:
        raise HTTPException(400, "A full question, please.")
    with closing(db()) as con, con:
        con.execute(
            "INSERT INTO requests(topic, question, name, created_at) VALUES (?,?,?,?)",
            (body.topic, question, name, now()),
        )
    # Pending until reviewed: it will not appear on the board until then.
    return {"status": "pending"}


@app.post("/api/requests/{rid}/vote")
def vote(rid: int, request: Request):
    limit(request, "vote", 60, 300)
    with closing(db()) as con, con:
        row = con.execute("SELECT votes FROM requests WHERE id = ? AND status = 'open'", (rid,)).fetchone()
        if not row:
            raise HTTPException(404, "not found")
        if once(request, f"vote:{rid}"):
            con.execute("UPDATE requests SET votes = votes + 1 WHERE id = ?", (rid,))
            return {"votes": row["votes"] + 1}
        return {"votes": row["votes"]}


# --- public: a post's discussion and reactions --------------------------------
class NewComment(BaseModel):
    name: str = Field(min_length=1, max_length=30)
    text: str = Field(min_length=1, max_length=1000)
    website: str = ""  # honeypot


@app.get("/api/posts/{slug}/comments")
def list_comments(slug: str):
    check_slug(slug)
    with closing(db()) as con:
        rows = con.execute(
            "SELECT id, name, text, created_at FROM comments WHERE slug = ? AND status = 'live' "
            "ORDER BY id ASC LIMIT 500",
            (slug,),
        ).fetchall()
    return [dict(r) for r in rows]


@app.post("/api/posts/{slug}/comments", status_code=201)
def create_comment(slug: str, body: NewComment, request: Request):
    check_slug(slug)
    if body.website:
        return {"id": -1, "name": "", "text": "", "created_at": now()}
    limit(request, "comment", 6, 300)
    name, text = one_line(body.name), paragraphs(body.text)
    if not name or not text:
        raise HTTPException(400, "A name and a few words, please.")
    created = now()
    with closing(db()) as con, con:
        cur = con.execute(
            "INSERT INTO comments(slug, name, text, created_at) VALUES (?,?,?,?)",
            (slug, name, text, created),
        )
    return {"id": cur.lastrowid, "name": name, "text": text, "created_at": created}


class NewReaction(BaseModel):
    kind: str
    delta: Literal[1, -1] = 1


@app.get("/api/posts/{slug}/reactions")
def list_reactions(slug: str):
    check_slug(slug)
    with closing(db()) as con:
        rows = con.execute("SELECT kind, count FROM reactions WHERE slug = ?", (slug,)).fetchall()
    return {r["kind"]: r["count"] for r in rows}


@app.post("/api/posts/{slug}/reactions")
def react(slug: str, body: NewReaction, request: Request):
    check_slug(slug)
    if body.kind not in KINDS:
        raise HTTPException(400, "unknown reaction")
    limit(request, "react", 60, 300)
    with closing(db()) as con, con:
        con.execute("INSERT OR IGNORE INTO reactions(slug, kind, count) VALUES (?,?,0)", (slug, body.kind))
        # Never below zero, whatever the client sends.
        con.execute(
            "UPDATE reactions SET count = MAX(0, count + ?) WHERE slug = ? AND kind = ?",
            (body.delta, slug, body.kind),
        )
        row = con.execute("SELECT count FROM reactions WHERE slug = ? AND kind = ?", (slug, body.kind)).fetchone()
    return {"kind": body.kind, "count": row["count"]}


# --- admin ---------------------------------------------------------------------
def admin(token: str) -> None:
    if not ADMIN_TOKEN or not secrets.compare_digest(token.encode(), ADMIN_TOKEN.encode()):
        raise HTTPException(403, "forbidden")


@app.get("/api/admin/queue")
def queue(x_admin_token: str = Header(default="")):
    admin(x_admin_token)
    with closing(db()) as con:
        pending = con.execute(
            "SELECT id, topic, question, name, created_at FROM requests WHERE status = 'pending' ORDER BY id"
        ).fetchall()
        open_ = con.execute(
            "SELECT id, topic, question, name, votes, created_at FROM requests WHERE status = 'open' ORDER BY votes DESC"
        ).fetchall()
        comments = con.execute(
            "SELECT id, slug, name, text, status, created_at FROM comments ORDER BY id DESC LIMIT 50"
        ).fetchall()
    return {
        "pending": [dict(r) for r in pending],
        "open": [dict(r) for r in open_],
        "comments": [dict(r) for r in comments],
    }


class RequestAction(BaseModel):
    action: Literal["approve", "reject", "answer"]
    post: str | None = None


@app.post("/api/admin/requests/{rid}")
def review_request(rid: int, body: RequestAction, x_admin_token: str = Header(default="")):
    admin(x_admin_token)
    status = {"approve": "open", "reject": "rejected", "answer": "answered"}[body.action]
    post = check_slug(body.post) if body.action == "answer" and body.post else None
    with closing(db()) as con, con:
        cur = con.execute(
            "UPDATE requests SET status = ?, post = COALESCE(?, post), reviewed_at = ? WHERE id = ?",
            (status, post, now(), rid),
        )
        if cur.rowcount == 0:
            raise HTTPException(404, "not found")
    return {"id": rid, "status": status}


class CommentAction(BaseModel):
    action: Literal["hide", "show"]


@app.post("/api/admin/comments/{cid}")
def moderate_comment(cid: int, body: CommentAction, x_admin_token: str = Header(default="")):
    admin(x_admin_token)
    with closing(db()) as con, con:
        cur = con.execute(
            "UPDATE comments SET status = ? WHERE id = ?",
            ("hidden" if body.action == "hide" else "live", cid),
        )
        if cur.rowcount == 0:
            raise HTTPException(404, "not found")
    return {"id": cid, "action": body.action}


@app.get("/admin")
def admin_page():
    # The page is public HTML with no data in it; everything it shows needs
    # the token, which the reader of the page has to type in.
    return FileResponse(Path(__file__).with_name("admin.html"), media_type="text/html")
