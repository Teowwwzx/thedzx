/**
 * The community layer: pieces readers asked for, comments, and reactions.
 *
 * Everything here is optional to the page. It talks to COMMUNITY_API (its own
 * subdomain, its own container) and if that is slow, down or unset, every
 * community element simply stays hidden — the blog underneath is complete.
 *
 * Reader-typed text is rendered with textContent only (see dom.ts).
 */
import { COMMUNITY_API } from '../../site.config.mjs';
import { el, ago, store } from './dom';
import { registerAsked, refreshPanel, type AskedInfo } from './board';

interface Request extends AskedInfo {
  topic: string;
}
interface Comment {
  id: number;
  name: string;
  text: string;
  created_at: string;
}
type Reactions = Record<string, number>;

const TIMEOUT = 6000;

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!COMMUNITY_API) throw new Error('community off');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(`${COMMUNITY_API}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: init.body ? { 'content-type': 'application/json' } : undefined,
    });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const j = (await res.json()) as { detail?: unknown };
        if (typeof j.detail === 'string') msg = j.detail;
      } catch {
        /* keep the status */
      }
      throw new Error(msg);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

function reveal() {
  for (const node of document.querySelectorAll<HTMLElement>('.community-only')) node.hidden = false;
}

/** One vote per thing per browser. Not security — the server rate-limits. */
const voted = (key: string) => store.get(`thedzx:v:${key}`) === '1';
const markVoted = (key: string, on: boolean) => store.set(`thedzx:v:${key}`, on ? '1' : '0');

/* ======================================================================
 * Homepage: asked-for pieces on the board, the list, and the ask form.
 * ==================================================================== */
export async function initCommunityHome() {
  let requests: Request[];
  try {
    requests = await api<Request[]>('/api/requests');
  } catch {
    return; // stays a plain blog
  }
  reveal();

  const board = document.querySelector('[data-board]');
  const list = document.querySelector<HTMLElement>('[data-asked-list]');
  const pieceFor = new Map<number, Element>();

  // Most-wanted first, so they take the pieces nearest the filled area.
  requests.sort((a, b) => b.votes - a.votes || a.id - b.id);

  for (const r of requests) {
    if (!board) break;
    const free = [...board.querySelectorAll(`.piece.is-empty[data-topic="${CSS.escape(r.topic)}"]`)]
      .filter((p) => !p.hasAttribute('data-request'))
      .sort((a, b) => Number(a.getAttribute('data-order')) - Number(b.getAttribute('data-order')));
    const piece = free[0];
    if (!piece) continue; // region full of questions; it still shows in the list
    piece.setAttribute('data-request', String(r.id));
    piece.classList.add('is-asked');
    // The "+" that invites a question becomes a "?" that shows one is waiting.
    const mark = piece.querySelector('.plus');
    if (mark) mark.textContent = '?';
    piece.setAttribute('aria-label', `Asked by ${r.name || 'a reader'}: ${r.question}`);
    registerAsked(piece, r);
    pieceFor.set(r.id, piece);
  }

  const renderList = () => {
    if (!list) return;
    list.replaceChildren(
      ...requests.map((r) =>
        el(
          'li',
          { class: 'asked-item', style: `--sw: var(--sw-${topicSwatch(r.topic)}); --bold: var(--bold-${topicSwatch(r.topic)})` },
          el('p', { class: 'asked-q' }, r.question),
          el(
            'p',
            { class: 'asked-meta' },
            `${r.name || 'A reader'} · `,
            el('span', { class: 'tabular' }, String(r.votes)),
            r.votes === 1 ? ' wants this' : ' want this',
          ),
          el(
            'button',
            {
              type: 'button',
              class: 'asked-vote',
              'data-vote': String(r.id),
              'aria-pressed': voted(`r${r.id}`) ? 'true' : 'false',
            },
            voted(`r${r.id}`) ? 'Asked ✓' : 'Me too',
          ),
        ),
      ),
    );
    if (requests.length === 0) {
      list.replaceChildren(el('li', { class: 'asked-empty' }, 'No open questions yet. Be the first to ask.'));
    }
  };
  renderList();

  // "Me too", from the list or from the board's panel.
  document.addEventListener('click', async (e) => {
    const btn = e.target instanceof Element ? e.target.closest<HTMLButtonElement>('[data-vote]') : null;
    if (!btn) return;
    const id = Number(btn.dataset.vote);
    const r = requests.find((x) => x.id === id);
    if (!r || voted(`r${id}`)) return;
    btn.disabled = true;
    try {
      const res = await api<{ votes: number }>(`/api/requests/${id}/vote`, { method: 'POST', body: '{}' });
      r.votes = res.votes;
      markVoted(`r${id}`, true);
      renderList();
      const piece = pieceFor.get(id);
      if (piece) refreshPanel(piece);
    } catch {
      btn.disabled = false;
    }
  });

  // The ask form.
  const form = document.querySelector<HTMLFormElement>('[data-ask-form]');
  const status = document.querySelector<HTMLElement>('[data-ask-status]');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const question = String(fd.get('question') ?? '').trim();
    if (question.length < 8) {
      if (status) status.textContent = 'A little more detail, please — at least a full question.';
      return;
    }
    const button = form.querySelector('button[type="submit"]') as HTMLButtonElement | null;
    if (button) button.disabled = true;
    if (status) status.textContent = 'Sending…';
    try {
      await api('/api/requests', {
        method: 'POST',
        body: JSON.stringify({
          topic: fd.get('topic'),
          question,
          name: String(fd.get('name') ?? '').trim(),
          website: String(fd.get('website') ?? ''),
        }),
      });
      form.reset();
      if (status) status.textContent = 'Thank you. It will show on the board once it has been read.';
    } catch (err) {
      if (status) status.textContent = err instanceof Error && err.message !== 'community off'
        ? `Could not send: ${err.message}`
        : 'Could not send right now. Please try again later.';
    } finally {
      if (button) button.disabled = false;
    }
  });
}

/** Topic → swatch, read from the page's own puzzle data or legend. */
function topicSwatch(topic: string): string {
  const chip = document.querySelector<HTMLElement>(`[data-topic-chip="${CSS.escape(topic)}"]`);
  const m = chip?.getAttribute('style')?.match(/--sw-([a-z]+)/);
  return m ? m[1] : 'lilac';
}

/* ======================================================================
 * A post: reactions and the discussion.
 * ==================================================================== */
const KINDS: [string, string][] = [
  ['helpful', 'Helpful'],
  ['same', 'Same here'],
  ['new', 'New to me'],
];

export async function initCommunityPost() {
  const root = document.querySelector<HTMLElement>('[data-community-post]');
  const slug = root?.dataset.communityPost;
  if (!root || !slug) return;

  let reactions: Reactions;
  let comments: Comment[];
  try {
    [reactions, comments] = await Promise.all([
      api<Reactions>(`/api/posts/${encodeURIComponent(slug)}/reactions`),
      api<Comment[]>(`/api/posts/${encodeURIComponent(slug)}/comments`),
    ]);
  } catch {
    return;
  }
  reveal();

  /* --- reactions --- */
  const bar = root.querySelector<HTMLElement>('[data-reactions]');
  const renderReactions = () => {
    bar?.replaceChildren(
      ...KINDS.map(([kind, label]) => {
        const on = voted(`${slug}:${kind}`);
        return el(
          'button',
          { type: 'button', class: 'react', 'data-kind': kind, 'aria-pressed': on ? 'true' : 'false' },
          label,
          el('span', { class: 'react-count tabular' }, String(reactions[kind] ?? 0)),
        );
      }),
    );
  };
  renderReactions();
  bar?.addEventListener('click', async (e) => {
    const btn = e.target instanceof Element ? e.target.closest<HTMLButtonElement>('[data-kind]') : null;
    if (!btn) return;
    const kind = btn.dataset.kind!;
    const on = !voted(`${slug}:${kind}`);
    btn.disabled = true;
    try {
      const res = await api<{ count: number }>(`/api/posts/${encodeURIComponent(slug)}/reactions`, {
        method: 'POST',
        body: JSON.stringify({ kind, delta: on ? 1 : -1 }),
      });
      reactions[kind] = res.count;
      markVoted(`${slug}:${kind}`, on);
      renderReactions();
    } catch {
      btn.disabled = false;
    }
  });

  /* --- discussion --- */
  const list = root.querySelector<HTMLElement>('[data-comments]');
  const count = root.querySelector<HTMLElement>('[data-comment-count]');
  const renderComments = () => {
    if (count) count.textContent = comments.length ? String(comments.length) : '';
    list?.replaceChildren(
      ...(comments.length
        ? comments.map((c) =>
            el(
              'li',
              { class: 'comment' },
              el('p', { class: 'comment-meta' }, el('strong', {}, c.name), ` · ${ago(c.created_at)}`),
              el('p', { class: 'comment-text' }, c.text),
            ),
          )
        : [el('li', { class: 'comment-empty' }, 'No thoughts yet. Start the conversation.')]),
    );
  };
  renderComments();

  const form = root.querySelector<HTMLFormElement>('[data-comment-form]');
  const status = root.querySelector<HTMLElement>('[data-comment-status]');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const text = String(fd.get('text') ?? '').trim();
    const name = String(fd.get('name') ?? '').trim();
    if (!text || !name) {
      if (status) status.textContent = 'A name and a few words, please.';
      return;
    }
    const button = form.querySelector('button[type="submit"]') as HTMLButtonElement | null;
    if (button) button.disabled = true;
    if (status) status.textContent = 'Posting…';
    try {
      const c = await api<Comment>(`/api/posts/${encodeURIComponent(slug)}/comments`, {
        method: 'POST',
        body: JSON.stringify({ name, text, website: String(fd.get('website') ?? '') }),
      });
      if (c.id > 0) comments.push(c);
      renderComments();
      (form.elements.namedItem('text') as HTMLTextAreaElement).value = '';
      store.set('thedzx:name', name);
      if (status) status.textContent = '';
    } catch (err) {
      if (status) status.textContent = err instanceof Error ? `Could not post: ${err.message}` : 'Could not post.';
    } finally {
      if (button) button.disabled = false;
    }
  });
  // Remember the name between posts — it is the only thing we ask for.
  const nameInput = form?.elements.namedItem('name');
  if (nameInput instanceof HTMLInputElement && !nameInput.value) nameInput.value = store.get('thedzx:name') ?? '';
}
