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
  /*
   * Plain and small. Earlier drafts claimed a thesis about how the world is
   * built and what the author has figured out — a promise a blog with no
   * posts cannot keep, and not the register he wanted. Change these two
   * strings and the whole site's voice changes; nothing else hardcodes them.
   */
  tagline: 'Notes to my future self',
  description:
    'I work in IT. This is where I write things down as I learn them — what broke, what I fixed, and what I still do not understand.',
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
  /**
   * Objects in this zone a post may attach itself to, via `prop`.
   *
   * Every entry MUST have a matching hotspot in that zone's location, or a
   * post attached to it is unreachable in the world with nothing to say so.
   * `npm run world` fails the build if they drift apart.
   */
  props: readonly string[];
  /** Which roadmap stage built this zone in 3D. */
  stage: number;
  /**
   * Is this a place you can stand? The TV is live data, not a location.
   * This is the ONLY place that fact is recorded — src/world/locations
   * derives its registry from it rather than keeping a second list.
   */
  walkable?: boolean;
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
    walkable: true,
    label: 'The Room',
    blurb: 'IT knowledge, build logs, and code. The desk is where the work happens.',
    elevation: '0 m',
    props: ['monitor', 'bookshelf'],
    stage: 1,
  },
  {
    id: 'city',
    walkable: true,
    label: 'Outside',
    blurb: 'The street, where every building is signed with the technology that runs it.',
    elevation: '0 m',
    props: ['building'],
    stage: 4,
  },
  {
    id: 'gym',
    walkable: true,
    label: 'The Gym',
    blurb: 'Discipline, habits, and the mindset that carries everything else.',
    elevation: '0 m',
    props: ['rack', 'treadmill'],
    stage: 4,
  },
  {
    id: 'tower',
    walkable: true,
    label: 'Merdeka 118',
    blurb:
      'Level 116 you look outward — the macro view. Level 118 you look down — the micro view. The altitude is the argument.',
    elevation: '519 – 566 m',
    props: ['window-116', 'window-118'],
    stage: 5,
  },
  {
    id: 'tv',
    // Not a place you can stand: it is live market data on a screen.
    walkable: false,
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
    walkable: true,
    label: 'The Server Room',
    blurb: 'The thesis, the homelab, the infrastructure. Through the hatch behind the desk.',
    elevation: '−1 m',
    props: ['rack'],
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
