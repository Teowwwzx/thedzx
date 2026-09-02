import type { APIRoute } from 'astro';

/**
 * Generated, not static. A hardcoded public/robots.txt goes stale the moment
 * the domain changes in site.config.mjs, and a Sitemap: line pointing at a
 * different host is one Google rejects outright.
 */
export const GET: APIRoute = ({ site }) =>
  new Response(
    ['User-agent: *', 'Allow: /', '', `Sitemap: ${new URL('sitemap-index.xml', site)}`, ''].join('\n'),
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
