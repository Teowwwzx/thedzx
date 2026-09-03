#!/usr/bin/env node
/**
 * Asset budget gate. Run after `astro build`; exits non-zero on a breach.
 *
 * These numbers are not aspirational — a solo dev has taken a comparable
 * scene from 98.5 MB to 1.28 MB with Draco. The point of running this from
 * stage 0, while there are no 3D assets at all, is that the gate is already
 * wired when the first .glb lands and it is still cheap to fix.
 */
import { readdir, stat, readFile } from 'node:fs/promises';
import { join, extname, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = 'dist';
const KB = 1024;
const MB = 1024 * KB;

const BUDGETS = {
  /** Per-file caps by name fragment. First match wins. */
  perFile: [
    { match: /room.*\.glb$/i, max: 1.5 * MB, label: 'Room GLB' },
    { match: /gym.*\.glb$/i, max: 1.0 * MB, label: 'Gym GLB' },
    { match: /(street|city).*\.glb$/i, max: 2.0 * MB, label: 'Street GLB' },
    { match: /(skyline|tower).*\.glb$/i, max: 2.5 * MB, label: 'Skyline GLB' },
    { match: /character.*\.glb$/i, max: 800 * KB, label: 'Character GLB' },
  ],
  /** Everything that must load before the world is interactive. */
  firstPaint3d: 3 * MB,
  /**
   * JS on an article route.
   *
   * The rule used to be "literally zero", written when the site had none at
   * all. The theme toggle needs a little: an inline script in <head> that
   * applies the stored choice before first paint, and the click handler.
   *
   * So the guarantee is now precise rather than absolute — what it always
   * meant to catch is a hydration island or a framework runtime, not 600
   * bytes of inline theme code:
   *   - ZERO external scripts (no <script src>) on an article route
   *   - inline script under a small byte budget
   */
  articleInlineJs: 3 * KB,
  /**
   * The hero scenery, gzipped — nginx serves gzip, not brotli, so gzip is
   * the number a visitor actually pays. This is three.js, and it is the
   * largest single thing the site ships.
   */
  heroBundleGzip: 200 * KB,
  /**
   * JS the HOMEPAGE references up front. Everything real is behind a
   * dynamic import that fires on idle; this budget is what stops someone
   * "simplifying" that into a static import and putting 130 KB in front of
   * the first paint.
   */
  heroEntryJs: 4 * KB,
};

/** The only route allowed to reference an external script. */
const SCRIPTED_ROUTE = 'index.html';

const THREE_D = new Set(['.glb', '.gltf', '.ktx2', '.basis', '.bin', '.hdr', '.exr']);

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

const fmt = (n) => (n >= MB ? `${(n / MB).toFixed(2)} MB` : `${(n / KB).toFixed(1)} KB`);

const files = await walk(DIST);
const failures = [];
const notes = [];

let total3d = 0;
for (const f of files) {
  const size = (await stat(f)).size;
  const rel = relative(DIST, f);

  const rule = BUDGETS.perFile.find((r) => r.match.test(rel));
  if (rule && size > rule.max) {
    failures.push(`${rule.label}: ${rel} is ${fmt(size)}, budget ${fmt(rule.max)}.`);
  }

  if (THREE_D.has(extname(f).toLowerCase())) total3d += size;
}

// ---- scripts, per route -------------------------------------------------
// The 3D WORLD is on hold: src/world/ still exists but nothing imports it,
// so none of it should reach dist. The hero scenery is separate and is
// allowed — on the homepage only, and only behind a dynamic import.
const htmlFiles = files.filter((f) => f.endsWith('.html'));
const entryHtml = files.find((f) => f === join(DIST, 'index.html'));
if (!entryHtml) failures.push('dist/index.html not found.');

const externalsIn = (html) =>
  [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((src) => !/^https?:/.test(src));

let entryJs = 0;
let heroGzip = 0;

for (const f of htmlFiles) {
  const html = await readFile(f, 'utf8');
  const externals = externalsIn(html);
  const rel = relative(DIST, f);

  if (rel !== SCRIPTED_ROUTE && externals.length) {
    failures.push(
      `${rel} loads ${externals.length} external script(s): ${externals.join(', ')}. ` +
        `Only ${SCRIPTED_ROUTE} may — the scenery is one page's decoration, not the site's.`,
    );
  }

  if (rel === SCRIPTED_ROUTE) {
    for (const src of externals) {
      try {
        entryJs += (await stat(join(DIST, src.replace(/^\//, '')))).size;
      } catch {
        /* not a local file */
      }
    }
  }
}

if (entryJs > BUDGETS.heroEntryJs) {
  failures.push(
    `/ ships ${fmt(entryJs)} of JS up front, budget ${fmt(BUDGETS.heroEntryJs)}. ` +
      'three.js must stay behind the dynamic import.',
  );
}

// The lazily-imported chunk is not referenced from any HTML, so find the
// biggest JS file in _astro/ — that is three.
const jsFiles = files.filter((f) => f.endsWith('.js'));
let biggest = null;
let biggestSize = 0;
for (const f of jsFiles) {
  const size = (await stat(f)).size;
  if (size > biggestSize) {
    biggestSize = size;
    biggest = f;
  }
}
if (biggest) {
  heroGzip = gzipSync(await readFile(biggest)).length;
  if (heroGzip > BUDGETS.heroBundleGzip) {
    failures.push(
      `hero bundle ${relative(DIST, biggest)} is ${fmt(heroGzip)} gzipped, ` +
        `budget ${fmt(BUDGETS.heroBundleGzip)}.`,
    );
  }
}

if (total3d > BUDGETS.firstPaint3d) {
  failures.push(
    `3D assets total ${fmt(total3d)}, budget ${fmt(BUDGETS.firstPaint3d)}. Lazy-load per zone.`,
  );
}

// Article routes must ship (almost) no JS. ld+json is data, not script.
const articles = files.filter((f) => f.includes(`${join(DIST, 'blog')}`) && f.endsWith('.html'));
let articleInline = 0;

// A gate that checks zero files and prints a tick is worse than no gate: it
// reads as "verified" when nothing was verified. Every post being a draft is
// a legitimate state, but it must not look like a passing check.
if (articles.length === 0) {
  notes.push(
    'no article routes in dist/ (all posts are drafts) — the zero-JS gate had nothing to check',
  );
}
for (const a of articles) {
  const html = await readFile(a, 'utf8');
  // An external script on an article route means a framework arrived.
  const external = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]);
  if (external.length) {
    failures.push(
      `${relative(DIST, a)} loads ${external.length} external script(s): ${external.join(', ')}. ` +
        'Article routes must ship no external JavaScript.',
    );
  }

  // Inline script, excluding JSON (which is data, not code) — both ld+json
  // for structured data and the plain application/json the homepage uses to
  // hand the hero its list of posts.
  let inlineBytes = 0;
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/type="application\/(ld\+)?json"/.test(m[1])) continue;
    if (/\bsrc=/.test(m[1])) continue;
    inlineBytes += Buffer.byteLength(m[2], 'utf8');
  }
  articleInline = Math.max(articleInline, inlineBytes);
  if (inlineBytes > BUDGETS.articleInlineJs) {
    failures.push(
      `${relative(DIST, a)} has ${fmt(inlineBytes)} of inline JS, budget ${fmt(BUDGETS.articleInlineJs)}.`,
    );
  }
}

console.log(`\n  Budget check — ${files.length} files in ${DIST}/`);
console.log(`  3D assets:        ${fmt(total3d)} / ${fmt(BUDGETS.firstPaint3d)}`);
console.log(
  `  Article routes:   ${articles.length} checked, 0 external JS, ` +
    `${fmt(articleInline)} inline / ${fmt(BUDGETS.articleInlineJs)}`,
);

console.log(`  Homepage up-front: ${fmt(entryJs)} / ${fmt(BUDGETS.heroEntryJs)}`);
console.log(
  `  Hero scenery:     ${heroGzip ? fmt(heroGzip) : 'none'} gzipped / ${fmt(BUDGETS.heroBundleGzip)}` +
    `${biggest ? ` (${relative(DIST, biggest)})` : ''}`,
);

for (const n of notes) console.log(`  note  ${n}`);

if (failures.length) {
  console.error('\n  BUDGET EXCEEDED\n');
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error('');
  process.exit(1);
}

console.log('\n  ✓ within budget\n');
