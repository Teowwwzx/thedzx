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
  /** Cloudflare Workers refuses any single static asset above this. */
  workersSingleFile: 25 * MB,
  /** Everything that must load before the world is interactive. */
  firstPaint3d: 3 * MB,
  /** JS on an article route. Stage 0 target is literally zero. */
  articleJs: 250 * KB,
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

  if (size > BUDGETS.workersSingleFile) {
    failures.push(
      `${rel} is ${fmt(size)} — over Cloudflare Workers' 25 MiB single-file limit. Move it to R2.`,
    );
  }

  const rule = BUDGETS.perFile.find((r) => r.match.test(rel));
  if (rule && size > rule.max) {
    failures.push(`${rule.label}: ${rel} is ${fmt(size)}, budget ${fmt(rule.max)}.`);
  }

  if (THREE_D.has(extname(f).toLowerCase())) total3d += size;
}

if (total3d > BUDGETS.firstPaint3d) {
  failures.push(
    `3D assets total ${fmt(total3d)}, budget ${fmt(BUDGETS.firstPaint3d)}. Lazy-load per zone.`,
  );
}

// Article routes must ship (almost) no JS. ld+json is data, not script.
const articles = files.filter((f) => f.includes(`${join(DIST, 'blog')}`) && f.endsWith('.html'));
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

for (const n of notes) console.log(`  note  ${n}`);

if (failures.length) {
  console.error('\n  BUDGET EXCEEDED\n');
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error('');
  process.exit(1);
}

console.log('\n  ✓ within budget\n');
