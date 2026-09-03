#!/usr/bin/env node
/**
 * The palette gate.
 *
 * Two jobs, both of which this project has already needed the hard way:
 *
 * 1. DRIFT. src/lib/palette.ts and src/styles/global.css hold the same
 *    colours, because CSS cannot import a TypeScript module. A hand-kept
 *    duplicate is exactly what shipped a zone in ZONES but not in
 *    ZONE_ORDER — links to a page that was never generated. So the copy is
 *    allowed, and the drift is not.
 *
 * 2. CONTRAST. Code blocks once shipped at 1.12:1 because Shiki's inline
 *    colour beat a stylesheet rule. Every pair below is checked against the
 *    ground it is actually painted on.
 */
import { readFile } from 'node:fs/promises';

const TS = 'src/lib/palette.ts';
const CSS = 'src/styles/global.css';

/** Thresholds. Text is WCAG AAA; the rest is the 3:1 non-text minimum. */
const TEXT_ON_WASH = 7;
const LINK_ON_PAGE = 4.5;
const DECOR_ON_PAGE = 3;

const ts = await readFile(TS, 'utf8');
const css = await readFile(CSS, 'utf8');

/* ---- read the palette ------------------------------------------------- */

const swatches = [
  ...ts.matchAll(
    /\{\s*name:\s*'([a-z]+)',\s*wash:\s*'(#[0-9a-f]{6})',\s*bold:\s*'(#[0-9a-f]{6})',\s*boldDark:\s*'(#[0-9a-f]{6})'\s*\}/gi,
  ),
].map(([, name, wash, bold, boldDark]) => ({ name, wash, bold, boldDark }));

const inkMatch = ts.match(/SWATCH_INK\s*=\s*'(#[0-9a-f]{6})'/i);

const failures = [];

if (swatches.length === 0) failures.push(`${TS}: no swatches parsed — has SWATCHES changed shape?`);

// A gate that silently skips what it cannot parse is worse than no gate: a
// swatch written with its fields transposed, or with a #fff shorthand, was
// dropped by the regex above and the check then printed a tick for the six
// it did understand. Count the declarations independently and compare.
const declared = (ts.match(/\{\s*name:\s*'/g) ?? []).length;
if (swatches.length !== declared) {
  failures.push(
    `${TS}: parsed ${swatches.length} of ${declared} swatches — an entry is not in the ` +
      'canonical { name, wash, bold, boldDark } shape and was skipped, not checked.',
  );
}
if (!inkMatch) failures.push(`${TS}: SWATCH_INK not found.`);

/* ---- read the stylesheet ---------------------------------------------- */

/** The declarations inside one `<selector> {` ... `}` block. */
function block(selector) {
  const at = css.indexOf(selector);
  if (at === -1) return null;
  const open = css.indexOf('{', at);
  const close = css.indexOf('\n}', open);
  return close === -1 ? null : css.slice(open, close);
}

const LIGHT = block(':root {');
const DARK_MEDIA = block(':root:not([data-theme]) {');
const DARK_ATTR = block(':root[data-theme="dark"] {');

for (const [label, text] of [
  [':root', LIGHT],
  [':root:not([data-theme])', DARK_MEDIA],
  [':root[data-theme="dark"]', DARK_ATTR],
]) {
  if (!text) failures.push(`${CSS}: could not find the ${label} block.`);
}

const token = (text, name) => {
  const m = text?.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i'));
  return m ? m[1].toLowerCase() : null;
};

/* ---- 1. drift ---------------------------------------------------------- */

if (LIGHT && DARK_MEDIA && DARK_ATTR && inkMatch) {
  const cssInk = token(LIGHT, 'sw-ink');
  if (cssInk !== inkMatch[1].toLowerCase()) {
    failures.push(`--sw-ink is ${cssInk} in CSS but SWATCH_INK is ${inkMatch[1]} in ${TS}.`);
  }

  for (const s of swatches) {
    const pairs = [
      [`sw-${s.name}`, s.wash, LIGHT, ':root'],
      [`bold-${s.name}`, s.bold, LIGHT, ':root'],
      [`bold-${s.name}`, s.boldDark, DARK_MEDIA, ':root:not([data-theme])'],
      [`bold-${s.name}`, s.boldDark, DARK_ATTR, ':root[data-theme="dark"]'],
    ];
    for (const [name, expected, text, where] of pairs) {
      const actual = token(text, name);
      if (actual !== expected.toLowerCase()) {
        failures.push(`--${name} in ${where} is ${actual ?? 'missing'}, ${TS} says ${expected}.`);
      }
    }
  }

  // A wash declared inside a theme block would make the fixed wash/ink pair
  // conditional again, which is the thing the pair exists to prevent.
  for (const [where, text] of [
    [':root:not([data-theme])', DARK_MEDIA],
    [':root[data-theme="dark"]', DARK_ATTR],
  ]) {
    for (const s of swatches) {
      if (token(text, `sw-${s.name}`)) {
        failures.push(
          `--sw-${s.name} is redeclared in ${where}. Washes are theme-independent by design: ` +
            'the wash/ink contrast is only guaranteed because the pair never changes.',
        );
      }
    }
  }
}

/* ---- 2. contrast ------------------------------------------------------- */

const channel = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

function luminance(hex) {
  const n = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => channel(c / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const rows = [];

function check(label, fg, bg, min) {
  const r = ratio(fg, bg);
  rows.push({ label, r, min, ok: r >= min });
  if (r < min) {
    failures.push(`${label}: ${fg} on ${bg} is ${r.toFixed(2)}:1, needs ${min}:1.`);
  }
}

if (LIGHT && DARK_ATTR && inkMatch) {
  const ink = inkMatch[1];
  const lightBg = token(LIGHT, 'bg');
  const darkBg = token(DARK_ATTR, 'bg');

  for (const s of swatches) {
    check(`ink on ${s.name} wash`, ink, s.wash, TEXT_ON_WASH);
    check(`${s.name} bold on paper`, s.bold, lightBg, DECOR_ON_PAGE);
    check(`${s.name} bold on ink`, s.boldDark, darkBg, DECOR_ON_PAGE);
  }

  // The link colour, in both themes. It is the one hue used as body text.
  check('link on paper', token(LIGHT, 'accent-ink'), lightBg, LINK_ON_PAGE);
  check('link on ink', token(DARK_ATTR, 'accent-ink'), darkBg, LINK_ON_PAGE);
  check('muted on paper', token(LIGHT, 'muted'), lightBg, LINK_ON_PAGE);
  check('muted on ink', token(DARK_ATTR, 'muted'), darkBg, LINK_ON_PAGE);
}

/* ---- report ------------------------------------------------------------ */

console.log(`\n  Palette check — ${swatches.length} swatches`);
const worst = rows.filter((r) => r.ok).sort((a, b) => a.r - b.r)[0];
if (worst) console.log(`  tightest pass:    ${worst.label} at ${worst.r.toFixed(2)}:1`);
console.log(`  contrast pairs:   ${rows.length} checked`);

if (failures.length) {
  console.error('\n  PALETTE BROKEN\n');
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error('');
  process.exit(1);
}

console.log('\n  ✓ palette in sync, every pair legible\n');
