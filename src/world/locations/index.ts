import type { ZoneId } from '../../consts';
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
 */
export const LOCATIONS: Record<ZoneId, LocationSpec> = { room, city, gym, tower, server, tv: room };

export const HAS_WORLD: readonly ZoneId[] = ['room', 'city', 'gym', 'tower', 'server'];
