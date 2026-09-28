import { defineCollection } from 'astro:content';
// Astro 7 deprecates re-exporting `z` from astro:content. `astro/zod` is the
// supported path and stays version-locked to whatever zod Astro ships.
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';
import { TOPIC_IDS, ZONE_IDS } from './consts';

/**
 * The `description` cap is deliberate and load-bearing, not cosmetic:
 * it is the meta description, the RSS summary, AND the teaser that a
 * screen inside the 3D world will render. 160 characters is the budget
 * that survives all three. The build fails if you blow it.
 */
const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: z.object({
    title: z.string().min(4).max(80),
    description: z.string().min(40).max(160),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),

    /**
     * What the post is about, and which region of the puzzle it fills.
     * Required: a post with no topic has no piece, and a piece-less post is
     * a post the homepage cannot show.
     */
    topic: z.enum(TOPIC_IDS),

    // The binding to the world. See src/consts.ts.
    /**
     * Only the parked 3D world uses these. The site itself has no topic
     * taxonomy — the zone names were the world's places, and they read as
     * nonsense on a blog. Optional so a post never has to pick one.
     */
    zone: z.enum(ZONE_IDS).optional(),
    prop: z.string().min(1).optional(),

    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),

    /**
     * Scaffolding, not writing. Placeholder posts populate the world so it
     * does not read as empty, but they carry noindex and stay out of the
     * sitemap and the feed — nothing fake gets indexed under a real byline.
     */
    placeholder: z.boolean().default(false),
  }),
});

/**
 * Ideas — projects I would build, with a starting price.
 *
 * Placeholders render in `astro dev` only, NEVER in a production build. A
 * placeholder post is harmless scaffolding; a placeholder OFFER with a price
 * on it is something a stranger could try to buy. The Ideas page and its nav
 * link simply do not exist in production until there is a real one.
 */
const ideas = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/ideas' }),
  schema: z.object({
    title: z.string().min(4).max(60),
    /** One line. Shown on the card and as the page's list. */
    summary: z.string().min(20).max(140),
    topic: z.enum(TOPIC_IDS),
    /** Starting price. Whole units of `currency`. */
    price: z.number().int().positive(),
    currency: z.enum(['USD', 'MYR']).default('USD'),
    status: z.enum(['open', 'building', 'built']).default('open'),
    /** Newest first on the page. */
    added: z.coerce.date(),
    placeholder: z.boolean().default(false),
  }),
});

export const collections = { blog, ideas };
