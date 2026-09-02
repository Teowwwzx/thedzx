import type { ReactNode } from 'react';
import type { ZoneId } from '../../consts';

/** A rectangle on the floor the character cannot walk through. [x, z, halfW, halfD] */
export type Blocker = readonly [number, number, number, number];

/** A marker the player can open. `prop` matches a post's frontmatter `prop`. */
export interface HotspotSpec {
  prop: string;
  label: string;
  position: readonly [number, number, number];
}

/** A place you can walk to that takes you somewhere else. */
export interface DoorSpec {
  to: ZoneId;
  label: string;
  /** Where the door stands. */
  position: readonly [number, number, number];
  /** Where the character lands on arrival in the destination. */
  arriveAt: readonly [number, number];
}

export interface LocationSpec {
  id: ZoneId;
  /** Walkable floor, as a rectangle: [minX, maxX, minZ, maxZ]. */
  bounds: readonly [number, number, number, number];
  /** Where the character starts if arriving without a door. */
  spawn: readonly [number, number];
  blockers: readonly Blocker[];
  hotspots: readonly HotspotSpec[];
  doors: readonly DoorSpec[];
  /** Colour behind everything, and the fog colour. */
  ambience: string;
  /**
   * How many metres of width the camera should keep in frame. A room wants
   * about 5; a 29-metre street wants far more or the camera sits in the
   * character's pocket and the place reads as a corridor.
   */
  frameWidth: number;
  /**
   * NOTE: every location must be OPEN on +z — no wall between the player and
   * the camera. The camera stands at target.z + 0.86 * distance with no
   * occlusion test, so a near wall hides the player behind its outside face
   * over roughly a third of the floor, arrival point included.
   */
  /** The geometry. */
  Scenery: () => ReactNode;
}
