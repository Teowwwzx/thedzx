/**
 * The site origin, in ONE place.
 *
 * astro.config.mjs, src/consts.ts and the generated robots.txt all import this.
 * Changing it here changes canonicals, OG URLs, JSON-LD, the sitemap and
 * robots.txt together — there is no second copy to forget.
 */
export const SITE_URL = 'https://thedzx.com';
