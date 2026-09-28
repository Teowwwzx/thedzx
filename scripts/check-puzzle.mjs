#!/usr/bin/env node
/**
 * The puzzle gate.
 *
 * The board IS the homepage's table of contents, so a mistake in it hides
 * posts. This runs the real generator (src/lib/puzzle.ts, bundled on the fly)
 * over the real posts, then over synthetic ones, and checks what the eye
 * cannot:
 *
 *   - every published post is on exactly one piece, in its own topic's region
 *   - the pieces tile the board exactly: no cell twice, no cell missing
 *   - every region is ONE connected shape
 *   - every region keeps at least one empty piece ("some filled, some not")
 *   - the same input always draws the same board
 *   - adding a post never moves an existing one, unless the board had to grow
 *   - no NaN in any path (a bad number draws nothing, silently)
 */
import { build } from 'esbuild';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const failures = [];
const fail = (m) => failures.push(m);

// ---- the real posts, read from frontmatter (production: no drafts) -------
const dir = 'src/content/blog';
const posts = [];
for (const f of (await readdir(dir)).filter((f) => /\.(md|mdx)$/.test(f))) {
  const src = await readFile(join(dir, f), 'utf8');
  const fm = src.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
  const get = (k) => fm.match(new RegExp(`^${k}:\\s*["']?([^"'\\n]+)["']?\\s*$`, 'm'))?.[1]?.trim();
  if (get('draft') === 'true') continue;
  posts.push({ id: f.replace(/\.(md|mdx)$/, ''), topic: get('topic'), date: new Date(get('pubDate')) });
}

const tmp = await mkdtemp(join(tmpdir(), 'thedzx-puzzle-'));
try {
  for (const [name, entry] of [['puzzle', 'src/lib/puzzle.ts']]) {
    await build({ entryPoints: [entry], outfile: join(tmp, `${name}.mjs`), bundle: true, format: 'esm', platform: 'node', logLevel: 'error' });
  }
  const { buildBoard, MIN_EMPTY } = await import(pathToFileURL(join(tmp, 'puzzle.mjs')).href);

  // Topic ids, straight from consts.ts, so this gate cannot drift from them.
  const consts = await readFile('src/consts.ts', 'utf8');
  const list = consts.slice(consts.indexOf('export const TOPIC_LIST'), consts.indexOf('] as const satisfies readonly Topic[]'));
  const topics = [...list.matchAll(/id:\s*'([a-z]+)'/g)].map((m) => ({ id: m[1] }));
  if (topics.length === 0) fail('could not read TOPIC_LIST from src/consts.ts');

  function check(label, input) {
    let board;
    try {
      board = buildBoard(topics, input);
    } catch (e) {
      fail(`${label}: generator threw — ${e.message}`);
      return null;
    }
    const n = board.cols * board.rows;
    if (board.pieces.length !== n) fail(`${label}: ${board.pieces.length} pieces for a ${board.cols}x${board.rows} board`);
    const cells = new Set(board.pieces.map((p) => `${p.row},${p.col}`));
    if (cells.size !== n) fail(`${label}: pieces overlap or leave a hole (${cells.size} distinct cells of ${n})`);

    // every post exactly once, in its own region
    const placed = new Map();
    for (const p of board.pieces) {
      if (!p.post) continue;
      if (placed.has(p.post)) fail(`${label}: post ${p.post} is on two pieces`);
      placed.set(p.post, p);
    }
    for (const post of input) {
      const p = placed.get(post.id);
      if (!p) fail(`${label}: post ${post.id} has no piece — it is missing from the homepage`);
      else if (p.topic !== post.topic) fail(`${label}: post ${post.id} (${post.topic}) sits in the ${p.topic} region`);
    }

    for (const t of topics) {
      const region = board.regions[t.id] ?? [];
      const empty = region.filter((p) => !p.post).length;
      if (empty < MIN_EMPTY) fail(`${label}: ${t.id} has ${empty} empty pieces, needs ${MIN_EMPTY}`);
      // contiguity: flood from the first piece
      const key = (p) => `${p.row},${p.col}`;
      const inRegion = new Set(region.map(key));
      const seen = new Set();
      const stack = region.length ? [region[0]] : [];
      while (stack.length) {
        const p = stack.pop();
        if (seen.has(key(p))) continue;
        seen.add(key(p));
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const k = `${p.row + dr},${p.col + dc}`;
          if (inRegion.has(k) && !seen.has(k)) stack.push({ row: p.row + dr, col: p.col + dc });
        }
      }
      if (seen.size !== region.length) fail(`${label}: the ${t.id} region is split in ${region.length - seen.size + 1}+ parts`);
    }

    for (const p of board.pieces) if (/NaN|undefined|Infinity/.test(p.d)) { fail(`${label}: piece ${p.row},${p.col} has a broken path`); break; }
    return board;
  }

  // 1. the real posts
  const real = check('real posts', posts);
  // 2. determinism
  const again = buildBoard(topics, posts);
  if (real && JSON.stringify(real.pieces) !== JSON.stringify(again.pieces)) fail('the same posts drew two different boards');

  // 3. stability: one more post in each topic moves nobody, unless it grew
  let stable = 0, grew = 0;
  if (real) {
    for (const t of topics) {
      const extra = [...posts, { id: `zz-new-${t.id}`, topic: t.id, date: new Date('2099-01-01') }];
      const next = check(`real + 1 in ${t.id}`, extra);
      if (!next) continue;
      if (next.rows !== real.rows) { grew++; continue; }
      const where = (b) => new Map(b.pieces.filter((p) => p.post).map((p) => [p.post, `${p.row},${p.col}`]));
      const before = where(real), after = where(next);
      for (const [id, cell] of before) if (after.get(id) !== cell) { fail(`adding a post to ${t.id} moved ${id}`); break; }
      stable++;
    }
  }

  // 4. edge cases
  check('no posts at all', []);
  check('one topic, 60 posts', Array.from({ length: 60 }, (_, i) => ({ id: `x${i}`, topic: topics[0].id, date: new Date(2026, 0, 1 + i) })));
  check('every topic, 25 posts', topics.flatMap((t, k) => Array.from({ length: 25 }, (_, i) => ({ id: `${t.id}${i}`, topic: t.id, date: new Date(2026, 0, 1 + i + k) }))));

  const filled = real ? real.pieces.filter((p) => p.post).length : 0;
  console.log(`\n  Puzzle check — ${posts.length} published posts, ${topics.length} topics`);
  if (real) console.log(`  board:            ${real.cols}x${real.rows}, ${filled} of ${real.pieces.length} pieces filled`);
  console.log(`  stability:        ${stable} topics took a new post without moving anything${grew ? `, ${grew} grew the board` : ''}`);
  if (failures.length) {
    console.error('\n  PUZZLE BROKEN\n');
    for (const f of failures) console.error(`  ✗ ${f}`);
    console.error('');
    process.exit(1);
  }
  console.log('\n  ✓ every post has its piece, every region is whole\n');
} finally {
  await rm(tmp, { recursive: true, force: true });
}
