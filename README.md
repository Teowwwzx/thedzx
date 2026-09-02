# thedzx

A personal blog that will become an explorable 3D world — a room with a desk,
a street outside, a gym, and the top floors of Merdeka 118. **Stage 0 is the
blog only.** No three.js yet, on purpose.

The full build plan, including the engine choice, asset sources, licensing
traps and roadmap, lives in the design doc this repo was scaffolded from.
The short version is in `AGENTS.md`.

## Run it

```bash
npm install
npm run dev      # drafts are visible here, and only here
```

```bash
npm run build && npm run budget
```

## Before your first deploy

1. **Set your domain.** One line: `SITE_URL` in `site.config.mjs`. Canonicals,
   OG image URLs, JSON-LD, the sitemap and the generated `robots.txt` all derive
   from it. There is no second copy.
2. **Set your name.** `SITE.author` in `src/consts.ts` — it is currently
   `Zhen Xiang`, inferred from this machine and **not confirmed by you**. It
   goes in the footer and in every post's JSON-LD author field.
3. **Write the posts. Nothing publishes until you do.** All three files in
   `src/content/blog/` are `draft: true`, so a deploy right now ships a site
   with zero posts. That is deliberate:
   - `the-blog-comes-first.md` is a complete, technically accurate essay — but
     it was written by an AI in the first person, making claims about what *you*
     wanted and what *you* have committed to. Read it, rewrite it in your voice,
     delete the HTML comment at the top, then set `draft: false`.
   - The other two are skeletons. Replace the body **and** the frontmatter
     title/description, then flip the flag.
4. **Install the nginx block, once.** The apex currently returns a deliberate
   404 with `X-Robots-Tag: noindex, nofollow`. That header must go, or none of
   the static-HTML-first architecture matters.
   ```bash
   scp deploy/nginx-thedzx.site.conf do-ghost-dev:/etc/nginx/sites-available/thedzx.site
   ssh do-ghost-dev 'nginx -t && systemctl reload nginx'
   ```
   Back up the existing file first — it also carries the `/cv` redirect and the
   Cloudflare-only guard, both of which the new block preserves.
5. **Deploy.**
   ```bash
   npm run deploy
   ```
   Builds, runs the budget gate, rsyncs to a timestamped release directory on
   the droplet, then flips `current` symlink atomically. Keeps the last 5
   releases, so a rollback is one `ln -sfn` away. Never upload `dist/` by hand:
   it is gitignored, so a fresh clone has nothing to upload and a stale tree
   ships yesterday's HTML.
5. **Verify Google can read it.** Register the domain in Search Console, then
   use **URL Inspection → View Tested Page** on a post and confirm with your own
   eyes that the article text is in the HTML. This is the single check that
   proves the whole architecture is working.

## What's here

```
site.config.mjs          The origin. One line, imported everywhere.
src/
  consts.ts              ZONE_LIST — the world map. ZONES and ZONE_ORDER are
                         both DERIVED from it, so they cannot drift apart.
  content.config.ts      Frontmatter schema. Enforces the 160-char teaser cap.
  lib/posts.ts           Every page reads posts through here. Drafts filtered.
  pages/
    index.astro          The map + all posts
    [zone]/index.astro   /room/, /gym/, /tower/, /tv/, /city/, /server/
    blog/[...slug].astro /blog/<slug>/ — canonical, static, zero JS
    world.json.ts        THE contract between blog and 3D world
    rss.xml.ts           Feed
    robots.txt.ts        Generated, so the Sitemap: line can never go stale
    og/[...route].png.ts Build-time OG cards (1200×630). The .png in the
                         filename is load-bearing — it keeps these as file
                         routes, exempt from trailingSlash: 'always'.
    credits.astro        Generated from assets/manifest.json
assets/
  manifest.json          Every third-party asset, logged on download day
  CREDITS.md             The rule, and the known licence traps
deploy/
  nginx-thedzx.site.conf The apex server block. Cache headers, try_files for
                         Astro's directory URLs, /cv redirect kept.
  deploy.sh              Atomic release: rsync to releases/<ts>, flip symlink.
scripts/
  check-budgets.mjs      Asset budget gate — FAILS the build if an article
                         route ships executable JS. Wired now, matters at stage 2.
LOCATIONS.md             Scope guardrail. The thing that says no.
AGENTS.md                Rules, pins, invariants.
```

## The rules that matter

- Every post is real HTML at a real URL **first**. The 3D world is a second way
  in, never the only way.
- No new location until the current one has five published posts behind it.
- No engine commits in a week where no post shipped.

## Hosting

Self-hosted on the `do-ghost-dev` droplet (Ubuntu 24.04, nginx 1.24), behind
Cloudflare's proxy. TLS at the origin uses the existing Cloudflare Origin
certificate at `/etc/nginx/ssl/thedzx-origin.pem`; nginx rejects anything that
did not come through Cloudflare. Because Cloudflare caches in front, purge it
after a deploy if HTML looks stale.

## Stage 1 (in progress)

One room, fixed camera, three hotspots, a visibly locked door. Flat-shaded
low-poly from CC0 kits. Download the Kenney Furniture Kit, City Kit (Roads),
Development Essentials and two Poly Haven HDRIs *before* writing any three.js.
