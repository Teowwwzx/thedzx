import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'blog'>;

/**
 * Every page reads posts through here. Drafts are visible in `astro dev`
 * and never in a production build — so a half-written post can be previewed
 * locally without risking a publish.
 */
export async function allPosts(): Promise<Post[]> {
  const posts = await getCollection('blog', ({ data }) =>
    import.meta.env.PROD ? data.draft !== true : true,
  );
  return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

export async function postsInZone(zone: string): Promise<Post[]> {
  return (await allPosts()).filter((p) => p.data.zone === zone);
}

export function postUrl(post: Post): string {
  return `/blog/${post.id}/`;
}

/** Real writing only — what belongs in the sitemap and the feed. */
export async function realPosts(): Promise<Post[]> {
  return (await allPosts()).filter((p) => !p.data.placeholder);
}
