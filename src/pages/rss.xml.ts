import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { SITE, ZONES, type ZoneId } from '../consts';
import { realPosts } from '../lib/posts';

export const GET: APIRoute = async (context) => {
  const posts = await realPosts();
  return rss({
    title: SITE.title,
    description: SITE.description,
    site: context.site ?? SITE.url,
    trailingSlash: true,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: `/blog/${post.id}/`,
      categories: [ZONES[post.data.zone as ZoneId].label, ...post.data.tags],
    })),
    customData: `<language>${SITE.locale.toLowerCase()}</language>`,
  });
};
