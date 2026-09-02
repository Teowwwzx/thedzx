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
  /** JS on an article route. The target is literally zero. */
  articleJs: 250 * KB,
  /**
   * The 3D bundle, gzipped — nginx serves gzip, not brotli, so gzip is the
   * number a visitor actually pays. This governs the largest single thing the
   * site ships and previously had no budget at all.
   */
  worldBundleGzip: 320 * KB,
  /** JS on /world/ BEFORE the click. The whole click-to-load design in one number. */
  worldEntryJs: 8 * KB,
};

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

// ---- the world bundle ----------------------------------------------------
// The entry IS the homepage now: arriving loads the world. If this ever
// stops matching, the two checks below silently stop running — which is how
// the article-JS gate once passed while checking nothing.
const worldEntry = files.find((f) => f === join(DIST, 'index.html'));
if (!worldEntry) failures.push('dist/index.html not found — the world-entry budget checked nothing.');
let worldGzip = 0;
let entryJs = 0;

if (worldEntry) {
  const html = await readFile(worldEntry, 'utf8');
  const srcs = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]);
  for (const src of srcs) {
    if (/^https?:/.test(src)) continue;
    try {
      entryJs += (await stat(join(DIST, src.replace(/^\//, '')))).size;
    } catch {
      /* not a local file */
    }
  }
  if (entryJs > BUDGETS.worldEntryJs) {
    failures.push(
      `/ ships ${fmt(entryJs)} of JS up front, budget ${fmt(BUDGETS.worldEntryJs)}. ` +
        'The 3D bundle must stay behind the dynamic import.',
    );
  }

  // The lazily-imported chunk is not referenced from the HTML, so find the
  // biggest JS file in _astro/ — that is the world.
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
    worldGzip = gzipSync(await readFile(biggest)).length;
    if (worldGzip > BUDGETS.worldBundleGzip) {
      failures.push(
        `world bundle ${relative(DIST, biggest)} is ${fmt(worldGzip)} gzipped, ` +
          `budget ${fmt(BUDGETS.worldBundleGzip)}.`,
      );
    }
  }
}

if (total3d > BUDGETS.firstPaint3d) {
  failures.push(
    `3D assets total ${fmt(total3d)}, budget ${fmt(BUDGETS.firstPaint3d)}. Lazy-load per zone.`,
  );
}

// Article routes must ship (almost) no JS. ld+json is data, not script.
const articles = files.filter((f) => f.includes(`${join(DIST, 'blog')}`) && f.endsWith('.html'));

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
  const scripts = [...html.matchAll(/<script\b([^>]*)>/g)].filter(
    (m) => !/application\/ld\+json/.test(m[1]),
  );
  if (scripts.length) {
    // This is a FAILURE, not a note. "Article routes ship zero executable
    // JavaScript" is the architectural claim the whole project rests on; a
    // gate that only prints a warning does not enforce anything.
    failures.push(
      `${relative(DIST, a)} ships ${scripts.length} executable <script> tag(s). Article routes must ship none.`,
    );
  }

  // Byte budget for anything an article route does legitimately pull in.
  const srcs = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]);
  let jsBytes = 0;
  for (const src of srcs) {
    if (/^https?:/.test(src)) continue;
    try {
      jsBytes += (await stat(join(DIST, src.replace(/^\//, '')))).size;
    } catch {
      /* external or hashed away — the tag count check above already caught it */
    }
  }
  if (jsBytes > BUDGETS.articleJs) {
    failures.push(
      `${relative(DIST, a)} pulls ${fmt(jsBytes)} of JS, budget ${fmt(BUDGETS.articleJs)}.`,
    );
  }
}

console.log(`\n  Budget check — ${files.length} files in ${DIST}/`);
console.log(`  3D assets:        ${fmt(total3d)} / ${fmt(BUDGETS.firstPaint3d)}`);
console.log(`  Article routes:   ${articles.length} checked, 0 allowed to ship JS`);
if (worldEntry) {
  console.log(`  Entry JS:         ${fmt(entryJs)} / ${fmt(BUDGETS.worldEntryJs)}`);
  console.log(`  World bundle:     ${fmt(worldGzip)} gzip / ${fmt(BUDGETS.worldBundleGzip)}`);
}

for (const n of notes) console.log(`  note  ${n}`);

if (failures.length) {
  console.error('\n  BUDGET EXCEEDED\n');
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error('');
  process.exit(1);
}

console.log('\n  ✓ within budget\n');
