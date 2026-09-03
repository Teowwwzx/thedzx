import { defineCollection } from 'astro:content';
// Astro 7 deprecates re-exporting `z` from astro:content. `astro/zod` is the
// supported path and stays version-locked to whatever zod Astro ships.
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';
import { ZONE_IDS } from './consts';

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

export const collections = { blog };
