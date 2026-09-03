/**
 * The palette.
 *
 * ONE source of truth for colour, read by three unrelated consumers:
 *
 *   - src/styles/global.css   as --sw-N / --bold-N custom properties
 *   - src/scenery/*           as three.js material colours
 *   - src/components/*        to pick a post's accent
 *
 * global.css cannot import a TypeScript module, so its tokens are written out
 * by hand — and `npm run palette` fails the build if the two ever drift, the
 * same guard ZONE_LIST gets in consts.ts. It also checks every wash/ink pair
 * for contrast, because this project has already shipped 1.1:1 text once.
 *
 * TWO GROUPS, AND THE DIFFERENCE MATTERS:
 *
 *   WASH  Pale. Used as a background with SWATCH_INK on top. Deliberately
 *         identical in light and dark themes — a bright block punched into
 *         the page reads the same either way, and a fixed pair cannot drift
 *         into an unreadable combination the way a themed pair can.
 *
 *   BOLD  Saturated. Used for ink on paper, for the spectrum strips, and for
 *         the floating objects in the hero. NEVER used behind text.
 */

export interface Swatch {
  /** Token suffix: --sw-<name>. */
  name: string;
  /** Pale background. */
  wash: string;
  /** Saturated partner, used for the dot, the strip and the object in the hero. */
  bold: string;
  /**
   * The same hue lifted for a dark ground.
   *
   * `bold` is chosen to hold 3:1 against paper, which puts several of these
   * below 3:1 against #121211 — the strip and the dots would fade out in
   * dark mode. Decorative or not, an element you cannot see is a bug.
   */
  boldDark: string;
}

/** The one dark ink that sits on every wash, in both themes. */
export const SWATCH_INK = '#17130c';

/**
 * Seven. Enough that the index reads as a spread rather than a pattern, few
 * enough that every one of them is a colour worth having on the page.
 */
export const SWATCHES: readonly Swatch[] = [
  { name: 'butter', wash: '#f7e96a', bold: '#a87a00', boldDark: '#f5c93c' },
  { name: 'blush', wash: '#ffd6f2', bold: '#e02f8f', boldDark: '#ff74bd' },
  { name: 'cyan', wash: '#9beef2', bold: '#0a8790', boldDark: '#3fd6de' },
  { name: 'mint', wash: '#c2f2d8', bold: '#188a50', boldDark: '#4fd48d' },
  { name: 'amber', wash: '#ffc75a', bold: '#c2650a', boldDark: '#ff9a3c' },
  { name: 'lilac', wash: '#ded6ff', bold: '#5b46d6', boldDark: '#a894ff' },
  { name: 'peach', wash: '#ffcfae', bold: '#c8471c', boldDark: '#ff8557' },
] as const;

/**
 * Pick a post's colour from its slug.
 *
 * Deterministic on purpose: a post keeps the same colour across the index,
 * its own page and its OG card, and a rebuild never reshuffles the page.
 * FNV-1a — small, no dependencies, and well spread over short strings.
 */
export function swatchFor(key: string): Swatch {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return SWATCHES[(h >>> 0) % SWATCHES.length];
}

/** Hex to an [r, g, b] triple. astro-og-canvas takes colours as channels. */
export function rgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
