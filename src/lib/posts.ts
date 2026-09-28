import { getCollection, type CollectionEntry } from 'astro:content';
import { TOPICS, TOPIC_LIST, type Topic, type TopicId } from '../consts';

export type Post = CollectionEntry<'blog'>;
export type Idea = CollectionEntry<'ideas'>;

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

export function postUrl(post: Post): string {
  return `/blog/${post.id}/`;
}

/** Real writing only — what belongs in the sitemap and the feed. */
export async function realPosts(): Promise<Post[]> {
  return (await allPosts()).filter((p) => !p.data.placeholder);
}

export function topicOf(post: Post | Idea): Topic {
  return TOPICS[post.data.topic as TopicId];
}

export function topicUrl(topic: Topic | TopicId): string {
  return `/topic/${typeof topic === 'string' ? topic : topic.id}/`;
}

/** Posts per topic, newest first, with every topic present even if empty. */
export async function postsByTopic(): Promise<Record<TopicId, Post[]>> {
  const out = {} as Record<TopicId, Post[]>;
  for (const t of TOPIC_LIST) out[t.id] = [];
  for (const p of await allPosts()) out[p.data.topic as TopicId].push(p);
  return out;
}

/**
 * Ideas that may be shown. Placeholders exist in `astro dev` only: a fake
 * post is scaffolding, but a fake OFFER with a price on it is something a
 * stranger could try to buy.
 */
export async function allIdeas(): Promise<Idea[]> {
  const ideas = await getCollection('ideas', ({ data }) =>
    import.meta.env.PROD ? data.placeholder !== true : true,
  );
  return ideas.sort((a, b) => b.data.added.valueOf() - a.data.added.valueOf());
}
