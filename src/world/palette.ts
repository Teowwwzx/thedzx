/**
 * The room's colours, in one place.
 *
 * These are the CSS tokens from src/styles/global.css, resolved to hex so
 * three.js can use them. The world reads as part of the site because it is
 * literally the same palette — not a separate art direction.
 *
 * Flat-shaded, no textures, no PBR maps. That is the whole art strategy: it
 * is a deliberate style, it stays under budget, and it does not require an
 * artist. See AGENTS.md, rule 5.
 */
export const PALETTE = {
  // Structure
  floor: '#4a5568',
  wall: '#5b6678',
  wallBack: '#515c6d',
  ceiling: '#3c4553',
  skirting: '#333c4a',

  // Furniture
  desk: '#8a6f52',
  deskLeg: '#565049',
  shelf: '#7b6248',
  chair: '#414c5e',
  rug: '#5f5069',
  tvBody: '#242c38',
  crate: '#6d7a8b',

  // Accents — the site's burnt amber
  accent: '#c06a2c',
  accentWarm: '#de8b4c',
  screen: '#9fd0e8',
  screenGlow: '#7fb4d4',

  // Outside the window: KL at dusk
  skyTop: '#1a2233',
  skyHorizon: '#c4703a',
  cityFar: '#2b3446',
  cityNear: '#1f2735',
  tower: '#3a4557',

  // Book spines — cycled per post
  spines: ['#8c4517', '#2f6f66', '#54607a', '#8a6a2e', '#6b3f52', '#3d5a7a'],
} as const;
