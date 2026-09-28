#!/usr/bin/env node
/**
 * Asset budget gate. Run after `astro build`; exits non-zero on a breach.
 *
 * WHAT A PAGE MAY LOAD
 * The site is static HTML first. JavaScript exists only to add the community
 * layer and the board's preview on top of pages that are complete without it,
 * so each kind of route gets a small, explicit allowance — counted as the
 * entry script PLUS everything it statically imports, because Astro emits a
 * 50-byte entry that pulls in the real chunk, and counting only the <script
 * src> would wave through anything.
 *
 * The 3D world and the floating desk objects are PARKED. three.js is ~500 KB;
 * any single chunk anywhere near that means something re-imported them.
 */
import { readdir, stat, readFile } from 'node:fs/promises';
import { join, extname, relative, dirname } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = 'dist';
const KB = 1024;
const MB = 1024 * KB;

/** Route kinds, first match wins. Bytes are raw (what the browser parses). */
const ROUTES = [
  { kind: 'home', match: /^index\.html$/, externalJs: 16 * KB },
  { kind: 'article', match: /^blog\/[^/]+\/index\.html$/, externalJs: 16 * KB },
  { kind: 'other', match: /.*/, externalJs: 0 },
];

const BUDGETS = {
  /** No single JS file may be this big. three.js is ~500 KB; React ~140 KB. */
  maxChunk: 40 * KB,
  /** Inline script on an article: the theme bootstrap, not a framework. */
  articleInlineJs: 3 * KB,
  /** 3D assets. There should be none; the gate stays wired in case. */
  firstPaint3d: 3 * MB,
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

/* ---- 3D assets --------------------------------------------------------- */
let total3d = 0;
for (const f of files) if (THREE_D.has(extname(f).toLowerCase())) total3d += (await stat(f)).size;
if (total3d > BUDGETS.firstPaint3d) failures.push(`3D assets total ${fmt(total3d)}, budget ${fmt(BUDGETS.firstPaint3d)}.`);

/* ---- no framework-sized chunk anywhere --------------------------------- */
const jsFiles = files.filter((f) => f.endsWith('.js'));
let biggest = { size: 0, file: '' };
for (const f of jsFiles) {
  const size = (await stat(f)).size;
  if (size > biggest.size) biggest = { size, file: f };
  if (size > BUDGETS.maxChunk) {
    failures.push(
      `${relative(DIST, f)} is ${fmt(size)} (${fmt(gzipSync(await readFile(f)).length)} gzipped), over the ${fmt(BUDGETS.maxChunk)} ` +
        'chunk cap. three.js or React has probably been re-imported — the 3D code is parked.',
    );
  }
}

/* ---- per-route JavaScript, following static imports -------------------- */
const sizeCache = new Map();
async function closure(file, seen = new Set()) {
  if (seen.has(file)) return 0;
  seen.add(file);
  let size;
  let src;
  try {
    src = await readFile(file, 'utf8');
    size = Buffer.byteLength(src);
  } catch {
    return 0;
  }
  // Static imports only: `import ... from "./x.js"` and bare `import "./x.js"`.
  // A dynamic import() is on-demand and is deliberately not counted.
  for (const m of src.matchAll(/(?:^|[;\s])import(?:[^'"()]*?from)?\s*["']([^"']+\.js)["']/g)) {
    const target = m[1].startsWith('/') ? join(DIST, m[1]) : join(dirname(file), m[1]);
    size += await closure(target, seen);
  }
  return size;
}

const htmlFiles = files.filter((f) => f.endsWith('.html'));
const perKind = {};
let articleInline = 0;

for (const f of htmlFiles) {
  const rel = relative(DIST, f);
  const route = ROUTES.find((r) => r.match.test(rel));
  const html = await readFile(f, 'utf8');

  const srcs = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]);
  const remote = srcs.filter((s) => /^(https?:)?\/\//.test(s));
  if (remote.length) failures.push(`${rel} loads a third-party script: ${remote.join(', ')}. None allowed.`);

  let bytes = 0;
  const seen = new Set();
  for (const s of srcs.filter((s) => !/^(https?:)?\/\//.test(s))) {
    bytes += await closure(join(DIST, s.replace(/^\//, '')), seen);
  }
  perKind[route.kind] = Math.max(perKind[route.kind] ?? 0, bytes);
  if (bytes > route.externalJs) {
    failures.push(
      `${rel} (${route.kind}) loads ${fmt(bytes)} of JavaScript, budget ${fmt(route.externalJs)}.` +
        (route.externalJs === 0 ? ' This kind of page ships no JavaScript file at all.' : ''),
    );
  }

  if (route.kind === 'article') {
    // Inline script, excluding JSON (data, not code).
    let inline = 0;
    for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
      if (/type="application\/(ld\+)?json"/.test(m[1]) || /\bsrc=/.test(m[1])) continue;
      inline += Buffer.byteLength(m[2], 'utf8');
    }
    articleInline = Math.max(articleInline, inline);
    if (inline > BUDGETS.articleInlineJs) {
      failures.push(`${rel} has ${fmt(inline)} of inline JS, budget ${fmt(BUDGETS.articleInlineJs)}.`);
    }
  }
}

const articles = htmlFiles.filter((f) => /^blog\/[^/]+\/index\.html$/.test(relative(DIST, f)));
if (articles.length === 0) notes.push('no article routes in dist/ — the article checks had nothing to check');

console.log(`\n  Budget check — ${files.length} files in ${DIST}/`);
console.log(`  3D assets:        ${fmt(total3d)} / ${fmt(BUDGETS.firstPaint3d)}`);
console.log(`  biggest JS chunk: ${fmt(biggest.size)} / ${fmt(BUDGETS.maxChunk)}${biggest.file ? ` (${relative(DIST, biggest.file)})` : ''}`);
for (const r of ROUTES) {
  if (perKind[r.kind] === undefined) continue;
  console.log(`  ${(r.kind + ' JS:').padEnd(18)}${fmt(perKind[r.kind])} / ${fmt(r.externalJs)}`);
}
console.log(`  article inline:   ${fmt(articleInline)} / ${fmt(BUDGETS.articleInlineJs)} across ${articles.length} articles`);
for (const n of notes) console.log(`  note  ${n}`);

if (failures.length) {
  console.error('\n  BUDGET EXCEEDED\n');
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error('');
  process.exit(1);
}
console.log('\n  ✓ within budget\n');
