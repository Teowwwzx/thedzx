import { SITE_URL } from '../site.config.mjs';

/**
 * Single source of truth for site identity and the world map.
 *
 * ZONE_LIST is the one list. ZONES (lookup) and ZONE_ORDER (nav/display order)
 * are both DERIVED from it — adding a zone in one place cannot leave the other
 * behind. That drift used to be silent: a zone in ZONES but not ZONE_ORDER
 * passed schema validation, then shipped posts linking to a page that was
 * never generated.
 */

export const SITE = {
  title: 'thedzx',
  tagline: 'The world is built by IT.',
  description:
    'Notes on IT, investment, mindset and the way the world actually runs — from someone who builds the systems underneath it.',
  // CHANGE ME before your first deploy.
  author: 'Zhen Xiang',
  url: SITE_URL,
  /** BCP-47. Drives <html lang>, og:locale, RSS <language> and date formatting. */
  locale: 'en-GB',
} as const;

/** og:locale wants underscores, not hyphens. */
export const OG_LOCALE = SITE.locale.replace('-', '_');

export interface Zone {
  id: string;
  /** Display name, used in nav and headings. */
  label: string;
  /** One line. Shown on the zone index page and in the world HUD later. */
  blurb: string;
  /** Height above ground, for the world. Shown as a wayfinding detail. */
  elevation: string;
  /** Objects in this zone a post may attach itself to, via `prop`. */
  props: readonly string[];
  /** Which roadmap stage builds this zone in 3D. Stage 0 is text-only. */
  stage: number;
  /** Overrides the generic empty state. Used where posts aren't the point. */
  emptyState?: string;
}

/**
 * THE list. Order is spatial, not alphabetical: inside → outside → up → down.
 * Six entries. `LOCATIONS.md` is the guardrail that says there is never a seventh.
 */
export const ZONE_LIST = [
  {
    id: 'room',
    label: 'The Room',
    blurb: 'IT knowledge, build logs, and code. The desk is where the work happens.',
    elevation: '0 m',
    props: ['monitor', 'bookshelf', 'desk', 'window'],
    stage: 1,
  },
  {
    id: 'city',
    label: 'Outside',
    blurb: 'The street, where every building is signed with the technology that runs it.',
    elevation: '0 m',
    props: ['building', 'street', 'sign'],
    stage: 4,
  },
  {
    id: 'gym',
    label: 'The Gym',
    blurb: 'Discipline, habits, and the mindset that carries everything else.',
    elevation: '0 m',
    props: ['rack', 'treadmill', 'bench', 'mat'],
    stage: 4,
  },
  {
    id: 'tower',
    label: 'Merdeka 118',
    blurb:
      'Level 116 you look outward — the macro view. Level 118 you look down — the micro view. The altitude is the argument.',
    elevation: '519 – 566 m',
    props: ['window-116', 'window-118', 'elevator'],
    stage: 5,
  },
  {
    id: 'tv',
    label: 'The TV',
    blurb: 'Markets, watchlists, and whatever the tape is doing today. Delayed, always.',
    elevation: '0 m',
    props: ['screen', 'remote'],
    stage: 3,
    emptyState:
      'The TV shows live market data rather than posts, so this page stays empty by design. It is here so the zone has a real URL.',
  },
  {
    id: 'server',
    label: 'The Server Room',
    blurb: 'The thesis, the homelab, the infrastructure. Through the hatch behind the desk.',
    elevation: '−1 m',
    props: ['rack', 'patch-panel'],
    stage: 6,
  },
] as const satisfies readonly Zone[];

export type ZoneId = (typeof ZONE_LIST)[number]['id'];

/** Display/nav order. Derived — never hand-maintained. */
export const ZONE_ORDER = ZONE_LIST.map((z) => z.id) as readonly ZoneId[];

/** Non-empty tuple, so `z.enum()` keeps the literal union instead of widening to string. */
export const ZONE_IDS = ZONE_ORDER as unknown as readonly [ZoneId, ...ZoneId[]];

/**
 * Lookup. Derived — never hand-maintained.
 * Typed as Zone (not the literal union) so optional fields like `emptyState`
 * are reachable on every zone rather than only on the ones that set them.
 */
const zoneMap = {} as Record<ZoneId, Zone>;
for (const zone of ZONE_LIST) zoneMap[zone.id] = zone;

export const ZONES: Record<ZoneId, Zone> = zoneMap;
