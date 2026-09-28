/**
 * Site-wide settings, in ONE place.
 *
 * astro.config.mjs, src/consts.ts and the generated robots.txt all import
 * this. Nothing here is a secret: form IDs and public URLs are visible in the
 * page source anyway. Secrets never go in this file, or anywhere the browser
 * can see them.
 */

/** The origin. Canonicals, OG URLs, JSON-LD, the sitemap and robots.txt. */
export const SITE_URL = 'https://thedzx.site';

/**
 * Kit (kit.com) newsletter form — how people join.
 * Kit → Grow → Landing Pages & Forms → your form → Publish → HTML: the number
 * in `app.kit.com/forms/<THIS>/subscriptions`. Empty = the join box offers
 * RSS instead, so the site never shows a form that goes nowhere.
 */
export const KIT_FORM_ID = '';

/**
 * Tally form for project quotes. The form's share link, e.g.
 * https://tally.so/r/abc123. Add a hidden field named `project` in Tally and
 * the Ideas page pre-fills it. Empty = no quote button is shown.
 */
export const QUOTE_FORM_URL = '';

/**
 * The community API — comments, reactions and piece requests.
 * Its own subdomain, so a problem there can never take the blog down.
 * Empty = every community feature stays hidden and the site is a plain blog.
 */
export const COMMUNITY_API = 'https://community.thedzx.site';
