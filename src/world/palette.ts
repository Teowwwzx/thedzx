/**
 * The room's colours, in one place.
 *
 * A sibling of the CSS tokens in src/styles/global.css, not a copy of them:
 * these are lit by three.js, so the structural values are lifted well above
 * the page's surface colours or the flat shading reads as near-black. The
 * accents are the same family as --accent / --accent-warm so the room belongs
 * to the site, but do not expect the hex values to match token-for-token.
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

  // The player
  charShirt: '#3f6f8c',
  charLegs: '#3b4250',
  charSkin: '#c99a72',
  charHair: '#2b2724',

  // Street (stage 4)
  road: '#31384a',
  kerb: '#4d566a',
  building: '#4a5468',
  buildingAlt: '#3f4959',
  buildingTrim: '#5d6a80',
  grass: '#3d5a4a',

  // Gym (stage 4)
  gymFloor: '#3f4654',
  gymMat: '#6b4a52',
  rubber: '#23262d',
  steel: '#8e97a5',

  // Tower (stage 5)
  towerFloor: '#2f3644',
  towerWall: '#3c4557',
  glass: '#5b7f9e',

  // Server room (stage 6)
  rackMetal: '#2b313c',
  rackFace: '#22272f',
  led: '#57b3a2',
  ledWarn: '#d3a344',

  // Book spines — cycled per post
  spines: ['#8c4517', '#2f6f66', '#54607a', '#8a6a2e', '#6b3f52', '#3d5a7a'],
} as const;
