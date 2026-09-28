import type { APIRoute } from 'astro';
import { allPosts } from '../lib/posts';

/**
 * Every published post's slug and topic — the community API's allow-list.
 *
 * The API reads this file straight off the web root (mounted read-only into
 * its container), so a comment can only ever be attached to a post that
 * exists. Slugs and topics only: nothing here is not already public.
 */
export const GET: APIRoute = async () => {
  const posts = await allPosts();
  return new Response(
    JSON.stringify({
      version: 1,
      posts: posts.map((p) => ({ slug: p.id, topic: p.data.topic })),
    }),
  );
};
