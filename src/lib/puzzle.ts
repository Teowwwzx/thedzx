/**
 * The puzzle on the homepage.
 *
 * One board, one region per topic, one piece per post. Filled pieces are
 * posts; empty pieces are what has not been written yet. Nothing here touches
 * the DOM or the content layer: it is a pure function of (topics, posts), so
 * `npm run puzzle` can check it in Node and the page renders what it returns.
 *
 * STABILITY IS THE DESIGN GOAL
 * A reader who comes back should find the same picture with a few more pieces
 * in it — not a reshuffled board. So:
 *   - the region map does NOT depend on how many posts each topic has; every
 *     topic gets an equal share of the board, grown from fixed seeds;
 *   - within a region, pieces fill in a fixed order from its seed outward, and
 *     posts take them oldest first, so a new post lands at the edge of the
 *     filled area and every existing post keeps its piece;
 *   - the board changes shape only when a topic runs out of room, and then it
 *     grows by a whole row.
 *
 * THE GEOMETRY is the standard jigsaw construction: each shared edge is one
 * set of cubic Béziers, generated ONCE and traversed forwards by one piece and
 * backwards by its neighbour, so neighbours fit exactly by construction rather
 * than by two curves that happen to agree.
 */

export interface PuzzleTopic {
  id: string;
}

export interface PuzzlePost {
  id: string;
  topic: string;
  /** Oldest posts take a region's first pieces. */
  date: Date;
}

export interface Piece {
  row: number;
  col: number;
  topic: string;
  /** Position in the region's fill order, 0 = the seed. */
  order: number;
  /** The post in this piece, or null if it is still empty. */
  post: string | null;
  /** SVG path, in board units (one cell = CELL). */
  d: string;
  /** Cell centre, for the glyph and the label. */
  cx: number;
  cy: number;
}

export interface Board {
  cols: number;
  rows: number;
  width: number;
  height: number;
  pieces: Piece[];
  /** Pieces per topic, in fill order. */
  regions: Record<string, Piece[]>;
}

/** Board units per cell. Arbitrary; the SVG scales. */
export const CELL = 100;

/** Six columns: 57px pieces on a 375px phone, which is still a finger. */
export const COLS = 6;
export const MIN_ROWS = 6;

/**
 * Every region keeps at least this many empty pieces. "Some are filled, some
 * are not" is the point of the picture — a region that fills completely would
 * read as finished, and a topic is never finished.
 */
export const MIN_EMPTY = 1;

const TAB = 0.1; // knob size as a fraction of the cell
const JITTER = 0.04; // how uneven the knobs are allowed to be

/* ---------------------------------------------------------------------- */

/** mulberry32: tiny, fast, and the same numbers on every machine. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Pt = [number, number];
/** A straight edge is [start, end]; a tabbed one is start + 3 cubics. */
type Edge = Pt[];

const round = (n: number) => Math.round(n * 10) / 10;

/**
 * One edge from `from` to `to`. `across` is the unit vector the knob bulges
 * along when `flip` is +1. Points are the classic nine-point jigsaw knob.
 */
function tabbedEdge(from: Pt, to: Pt, across: Pt, flip: number, rand: () => number): Edge {
  const j = () => (rand() * 2 - 1) * JITTER;
  const [a, b, c, d, e] = [j(), j(), j(), j(), j()];
  const t = TAB;
  const along: Pt = [(to[0] - from[0]) / CELL, (to[1] - from[1]) / CELL];
  const at = (u: number, v: number): Pt => [
    round(from[0] + along[0] * u * CELL + across[0] * v * CELL * flip),
    round(from[1] + along[1] * u * CELL + across[1] * v * CELL * flip),
  ];
  return [
    at(0, 0),
    at(0.2, a), at(0.5 + b + d, -t + c), at(0.5 - t + b, t + c),
    at(0.5 - 2 * t + b - d, 3 * t + c), at(0.5 + 2 * t + b - d, 3 * t + c), at(0.5 + t + b, t + c),
    at(0.5 + b + d, -t + c), at(0.8, e), at(1, 0),
  ];
}

/** Path commands for an edge, excluding its start point. */
function forward(edge: Edge): string {
  if (edge.length === 2) return `L${edge[1][0]} ${edge[1][1]}`;
  const out: string[] = [];
  for (let i = 1; i < edge.length; i += 3) {
    out.push(`C${edge[i][0]} ${edge[i][1]} ${edge[i + 1][0]} ${edge[i + 1][1]} ${edge[i + 2][0]} ${edge[i + 2][1]}`);
  }
  return out.join('');
}

/** The same curve, walked from its end back to its start. */
function backward(edge: Edge): string {
  return forward([...edge].reverse());
}

/* ---------------------------------------------------------------------- */

/**
 * Split the board into one contiguous region per topic.
 *
 * Round-robin growth from fixed seeds: each topic in turn claims the free
 * neighbour of its region that is closest to its own seed. That keeps regions
 * compact and roughly equal without anything depending on post counts.
 * Returns null if some region cannot reach `need[topic]` cells — the caller
 * then adds a row.
 */
function partition(
  topics: string[],
  cols: number,
  rows: number,
  need: Record<string, number>,
): { owner: (string | null)[]; order: Record<string, number[]> } | null {
  const n = cols * rows;
  const owner: (string | null)[] = new Array(n).fill(null);
  const order: Record<string, number[]> = {};

  // Seeds spread over the board: corners first, then the middle.
  const spots: [number, number][] = [
    [0, 0], [0, cols - 1], [rows - 1, 0], [rows - 1, cols - 1],
    [Math.floor(rows / 2), Math.floor(cols / 2)],
    [0, Math.floor(cols / 2)], [rows - 1, Math.floor(cols / 2)],
  ];
  const seeds: Record<string, [number, number]> = {};
  topics.forEach((t, i) => {
    const [r, c] = spots[i % spots.length];
    seeds[t] = [r, c];
    owner[r * cols + c] = t;
    order[t] = [r * cols + c];
  });

  const dist = (t: string, i: number) => {
    const [sr, sc] = seeds[t];
    const r = Math.floor(i / cols), c = i % cols;
    return Math.abs(r - sr) + Math.abs(c - sc);
  };
  const neighbours = (i: number) => {
    const r = Math.floor(i / cols), c = i % cols;
    const out: number[] = [];
    if (r > 0) out.push(i - cols);
    if (c < cols - 1) out.push(i + 1);
    if (r < rows - 1) out.push(i + cols);
    if (c > 0) out.push(i - 1);
    return out;
  };

  let claimed = topics.length;
  let stalled = 0;
  while (claimed < n && stalled < topics.length) {
    stalled = 0;
    for (const t of topics) {
      let best = -1;
      let bestScore = Infinity;
      for (const cell of order[t]) {
        for (const nb of neighbours(cell)) {
          if (owner[nb] !== null) continue;
          // Distance to the seed keeps regions round; the index is a
          // deterministic tiebreak, so the same input always makes the same map.
          const score = dist(t, nb) * 1000 + nb;
          if (score < bestScore) {
            bestScore = score;
            best = nb;
          }
        }
      }
      if (best === -1) {
        stalled++;
        continue;
      }
      owner[best] = t;
      order[t].push(best);
      claimed++;
    }
  }

  // Anything still unclaimed was walled in. Give it to a neighbouring region,
  // which keeps every region contiguous.
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < n; i++) {
      if (owner[i] !== null) continue;
      const nb = neighbours(i).find((x) => owner[x] !== null);
      if (nb === undefined) continue;
      const t = owner[nb]!;
      owner[i] = t;
      order[t].push(i);
      changed = true;
    }
  }

  for (const t of topics) if (order[t].length < need[t]) return null;
  return { owner, order };
}

/* ---------------------------------------------------------------------- */

export function buildBoard(topics: PuzzleTopic[], posts: PuzzlePost[], seed = 0x7d2c): Board {
  const ids = topics.map((t) => t.id);

  // Oldest first within each topic: the first post takes the seed piece.
  const byTopic: Record<string, PuzzlePost[]> = {};
  for (const id of ids) byTopic[id] = [];
  for (const p of posts) {
    if (!byTopic[p.topic]) throw new Error(`post "${p.id}" has unknown topic "${p.topic}"`);
    byTopic[p.topic].push(p);
  }
  for (const id of ids) byTopic[id].sort((a, b) => a.date.valueOf() - b.date.valueOf() || a.id.localeCompare(b.id));

  const need: Record<string, number> = {};
  for (const id of ids) need[id] = byTopic[id].length + MIN_EMPTY;

  const cols = COLS;
  let rows = MIN_ROWS;
  let map = partition(ids, cols, rows, need);
  // Grow a row at a time until every topic has room. Bounded, because each
  // row adds `cols` cells and the regions share them out.
  while (!map && rows < 60) {
    rows++;
    map = partition(ids, cols, rows, need);
  }
  if (!map) throw new Error('puzzle: could not fit the posts on any board up to 60 rows');

  // Edges, generated once each.
  const rand = rng(seed);
  const flip = () => (rand() < 0.5 ? 1 : -1);
  const S = CELL;
  // h[r][c]: the horizontal edge on top of row r at column c. Rows 0 and
  // `rows` are the border, so they are straight.
  const h: Edge[][] = [];
  for (let r = 0; r <= rows; r++) {
    h[r] = [];
    for (let c = 0; c < cols; c++) {
      const from: Pt = [c * S, r * S];
      const to: Pt = [(c + 1) * S, r * S];
      h[r][c] = r === 0 || r === rows ? [from, to] : tabbedEdge(from, to, [0, 1], flip(), rand);
    }
  }
  // v[r][c]: the vertical edge on the left of column c at row r.
  const v: Edge[][] = [];
  for (let r = 0; r < rows; r++) {
    v[r] = [];
    for (let c = 0; c <= cols; c++) {
      const from: Pt = [c * S, r * S];
      const to: Pt = [c * S, (r + 1) * S];
      v[r][c] = c === 0 || c === cols ? [from, to] : tabbedEdge(from, to, [1, 0], flip(), rand);
    }
  }

  const pieces: Piece[] = [];
  const regions: Record<string, Piece[]> = {};
  for (const id of ids) regions[id] = [];

  for (const id of ids) {
    map.order[id].forEach((cell, order) => {
      const row = Math.floor(cell / cols);
      const col = cell % cols;
      const d =
        `M${col * S} ${row * S}` +
        forward(h[row][col]) + // top, left to right
        forward(v[row][col + 1]) + // right, top to bottom
        backward(h[row + 1][col]) + // bottom, right to left
        backward(v[row][col]) + // left, bottom to top
        'Z';
      const piece: Piece = {
        row,
        col,
        topic: id,
        order,
        post: byTopic[id][order]?.id ?? null,
        d,
        cx: col * S + S / 2,
        cy: row * S + S / 2,
      };
      pieces.push(piece);
      regions[id].push(piece);
    });
  }

  // Reading order for the DOM (and so for keyboard focus): row by row.
  pieces.sort((a, b) => a.row - b.row || a.col - b.col);

  return { cols, rows, width: cols * S, height: rows * S, pieces, regions };
}
