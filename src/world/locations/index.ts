import { ZONE_LIST, type ZoneId } from '../../consts';
import type { LocationSpec } from './spec';
import { room } from './room';
import { city } from './city';
import { gym } from './gym';
import { tower } from './tower';
import { server } from './server';

/**
 * Every place you can stand.
 *
 * Imported eagerly rather than per-location dynamic imports: these modules are
 * pure geometry code with no assets — a few kB of JSX each — so splitting them
 * would add Suspense boundaries and a loading flash to save less than the
 * round trip costs. When real .glb models land, THAT is the point to split,
 * because then a location genuinely carries megabytes.
 *
 * This map is PARTIAL on purpose. An earlier version wrote `tv: room` to
 * satisfy Record<ZoneId, LocationSpec>, which turned "the TV is not a place"
 * from a type error into a silent wrong-room.
 */
export const LOCATIONS: Partial<Record<ZoneId, LocationSpec>> = { room, city, gym, tower, server };

/** Derived from consts, so the walkable list cannot drift from the zone data. */
export const HAS_WORLD: readonly ZoneId[] = ZONE_LIST.filter((z) => z.walkable).map(
  (z) => z.id,
) as ZoneId[];

export const START: ZoneId = 'room';
