import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { SITE } from '../consts';
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
      // NOT `ZONES[post.data.zone].label`. `zone` became optional when the
      // taxonomy came out, and the `as ZoneId` cast hid it from astro check:
      // the first post published without a zone would have thrown
      // "Cannot read properties of undefined" and taken the whole build
      // down. The OG route had the same line and was fixed; this one was
      // missed because every post today is a draft or a placeholder, so the
      // feed has zero items and the map body never runs.
      categories: post.data.tags,
    })),
    customData: `<language>${SITE.locale.toLowerCase()}</language>`,
  });
};
