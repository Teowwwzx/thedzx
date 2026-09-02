import type { APIRoute } from 'astro';
import { SITE, ZONES, ZONE_ORDER } from '../consts';
import { allPosts } from '../lib/posts';

/**
 * THE CONTRACT between the blog and the 3D world.
 *
 * This is the only file the world will ever fetch. It carries enough to
 * label a prop and open a panel — slug, title, zone, prop, teaser — and
 * nothing else. No post body is ever loaded until a reader opens one.
 *
 * Keep it small. If this file grows past ~20 KB, the world is asking the
 * blog for too much and something belongs on a per-zone endpoint instead.
 */
export const GET: APIRoute = async () => {
  const posts = await allPosts();

  const body = {
    version: 1,
    site: { title: SITE.title, url: SITE.url },
    generatedAt: new Date().toISOString(),
    zones: ZONE_ORDER.map((id) => ({
      id,
      label: ZONES[id].label,
      blurb: ZONES[id].blurb,
      elevation: ZONES[id].elevation,
      props: ZONES[id].props,
      stage: ZONES[id].stage,
    })),
    posts: posts.map((post) => ({
      slug: post.id,
      url: `/blog/${post.id}/`,
      title: post.data.title,
      teaser: post.data.description,
      zone: post.data.zone,
      prop: post.data.prop,
      pubDate: post.data.pubDate.toISOString().slice(0, 10),
    })),
  };

  // NOTE: with output:'static' this endpoint is prerendered to a file and only
  // the BODY is kept — response headers set here are silently discarded in
  // production (they work in `astro dev`, which is how you get fooled).
  // Caching and content-type for /world.json live in public/_headers instead.
  return new Response(JSON.stringify(body, null, 2));
};
