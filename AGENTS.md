# AGENTS.md

Rules for any AI agent (or human) working in this repo. Read before editing.

## Deployment target

Self-hosted: `do-ghost-dev` droplet, nginx 1.24, static files under
`/var/www/thedzx.site/`, behind Cloudflare's proxy with an origin cert.
NOT Cloudflare Workers/Pages — there is no wrangler in this repo, and
`_headers` / `_redirects` files do nothing here.

## What this project is

A personal blog that doubles as an explorable 3D world. **It is a blog with a
3D navigation skin, not a 3D world containing text.** Every decision follows
from that. See `LOCATIONS.md` for scope and the roadmap stages.

Currently at **stage 1**: the blog, plus a greybox room at `/world/`.
The room is built from primitives — no models, no textures, nothing fetched.

## Pinned versions — do not upgrade in passing

| Package | Pin | Why it's pinned |
|---|---|---|
| `astro` | 7.2.10 | Astro 7 uses Sätteri (Rust) for markdown, not remark. Plugin advice written for Astro 4/5 will not apply. |
| `@astrojs/mdx` | 8.0.0 | Requires astro ^7.2.6 |
| `@astrojs/sitemap` | 3.7.4 | |
| `@astrojs/rss` | 4.0.19 | Uses `zod/v4` |
| `astro-og-canvas` | 0.13.1 | |
| `@astrojs/check` | 0.9.10 | Peers `typescript ^5 \|\| ^6` — TypeScript 7 does NOT satisfy it |
| `typescript` | 5.9.3 | Held below 7 by the line above |
| `react` / `react-dom` | **must stay `>=19 <19.3`**  | React Three Fiber 9.7's peer ceiling. React 19.3 will break the tree. |
| `three` | 0.185.1  | |
| `@react-three/fiber` | 9.7.0  | |
| `@react-three/drei` | 10.7.8  | |

**Never run a blanket `npm update`.** If a version needs to move, move it
deliberately and re-run `npm run build && npm run budget`.

## Hard rules

1. **No body text inside a `<canvas>`, ever.** Canvas pixels are invisible to
   Googlebot, screen readers, Ctrl+F and copy-paste. Diegetic screens get
   headlines only. Articles open in a DOM panel via `history.pushState`.
2. **Every interactive 3D object needs a matching real `<a href>`** in a DOM
   overlay. Raycast clicks generate zero crawlable links.
3. **The canvas must never be the LCP element.** Ship a real poster `<img>`
   with explicit dimensions; boot WebGL after `load` or on an explicit click.
4. **WebGL2 only.** `WebGPURenderer` stays an opt-in swap, not the baseline.
5. **Zero modelling from scratch.** Allowed Blender operations: import, move,
   rotate, scale, join, apply transform, bake, export. If a prop isn't in a
   CC0 kit, generate it or cut it. This rule exists because the Blender rabbit
   hole is the most commonly reported killer of projects like this.
6. **No new zone** until the current one has five published posts. `ZONES` in
   `src/consts.ts` is closed — six entries, never a seventh.
7. **Never ship an API key to the browser.** Market data goes through a small
   server-side proxy on the droplet (its own nginx location + a container),
   never a fetch from the page with a key in it.
8. **Every third-party asset gets a `assets/manifest.json` entry the day it is
   downloaded.** `/credits/` is generated from it.

## Architecture invariants

- `src/consts.ts` → `ZONE_LIST` is the single source of truth. `ZONES` and
  `ZONE_ORDER` are both DERIVED from it — never hand-maintain a second list.
  (They used to be separate: a zone present in one and not the other passed
  schema validation, then shipped posts whose breadcrumbs and links pointed at
  a page that was never generated. `astro check` did not catch it.)
- `site.config.mjs` → the origin, imported by `astro.config.mjs`, `src/consts.ts`
  and the generated `robots.txt`. Never hardcode the domain anywhere else.
- `/world.json` is the **only** contract between the blog and the 3D world.
  Slug, title, zone, prop, teaser. If it grows past ~20 KB, split it per zone.
- `/blog/<slug>/` is canonical and always static. Zone pages at `/<zone>/`.
- `description` frontmatter is capped at 160 characters by the Zod schema
  because it is simultaneously the meta description, the RSS summary and the
  in-world teaser. The build fails if you exceed it — that is intended.
- Drafts render in `astro dev` and are excluded from production builds. See
  `src/lib/posts.ts`.

## Division of labour with an AI agent

**Fine to delegate:** the SSG and markdown pipeline, sitemap/RSS/OG plumbing,
R3F scene-graph wiring, drei setup, gltf-transform build scripts, the budget
gate, dispose/instancing refactors, the market-data proxy.

**Do not delegate:** room layout and composition, colour and lighting mood,
camera positions and easing, what feels fun — and all of the writing.

## The world (src/world/)

- `/world/` is a normal server-rendered page. The 3D bundle is behind a
  **dynamic `import()` fired by a click**, so the page itself ships ~1.2 KB of
  JS and the canvas can never be the LCP element.
- React is a **library** here, not an Astro renderer. `@astrojs/react` is
  deliberately NOT installed — it injects a Fast Refresh preamble that a
  plain dynamic import cannot satisfy, which breaks dev. JSX compiles from
  `tsconfig.json`'s `jsx: react-jsx`.
- `vite.resolve.dedupe` for `react`, `react-dom` and `three` is load-bearing.
  Without it, dev pre-bundling hands R3F a second React and every hook throws.
- Hotspot labels are drei `<Html>`, i.e. real DOM. Not `transform` mode, which
  is documented to render blurry. The canvas draws no text at all.
- The section under the canvas mirrors every hotspot as a real `<a href>`.
  It is not decoration — it is the only thing a crawler or screen reader sees.
- The device gate is a **runtime frame probe** (`FrameProbe.tsx`), not feature
  detection. `navigator.deviceMemory` and `connection.saveData` are undefined
  on iOS and in Firefox, so a `deviceMemory < 4` test fails OPEN there.

## Commands

```
npm run dev       # drafts visible
npm run build     # drafts excluded
npm run check     # astro check — must stay at 0 errors
npm run budget    # asset budget gate; FAILS if an article route ships JS
npm run deploy    # build, budget gate, rsync a release, flip the symlink
./deploy/install-nginx.sh   # install the server block (rare, separate on purpose)
```

## Known sharp edges

- `shikiConfig.themes` emits both palettes but Astro does **not** emit the CSS
  that switches them. `src/styles/global.css` supplies it. Do not add
  `background: … !important` to `.prose pre` — that beats Shiki's inline
  background while `color` does not beat its inline colour, which renders light
  tokens on a dark plate at 1.1:1.
- Response headers set in a prerendered endpoint (`world.json.ts`) are silently
  discarded by `output: 'static'`. They work in `astro dev`. Caching lives in
  `deploy/nginx-thedzx.site.conf`.
- nginx on the droplet is **1.24**, so http2 goes on the `listen` line;
  `http2 on;` is a 1.25.1+ directive and fails `nginx -t` there.
- The apex block previously sent `X-Robots-Tag: noindex, nofollow`. It is gone
  on purpose. Do not reinstate it — subdomains keep their own noindex.
