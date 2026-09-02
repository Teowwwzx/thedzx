/**
 * The shape /world.json publishes.
 *
 * src/pages/world.json.ts annotates its response with WorldData, so a change
 * on either side is a type error rather than a silent runtime mismatch.
 */
export interface WorldPost {
  slug: string;
  url: string;
  title: string;
  teaser: string;
  zone: string;
  prop: string;
  pubDate: string;
}

export interface WorldZone {
  id: string;
  label: string;
  blurb: string;
  elevation: string;
  props: readonly string[];
  stage: number;
}

export interface WorldData {
  version: number;
  site: { title: string; url: string };
  generatedAt: string;
  zones: WorldZone[];
  posts: WorldPost[];
}

/** A thing in the room you can click. */
export interface Hotspot {
  /** Matches a post's `prop` field. */
  id: string;
  label: string;
  /** Shown in the panel when the prop has no posts behind it yet. */
  empty: string;
  position: [number, number, number];
  /** Where the marker floats, relative to the object. */
  markerY: number;
}
