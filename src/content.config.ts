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
    // ZONE_IDS is a non-empty tuple of the literal ids, so data.zone types as
    // ZoneId — not string. That keeps ZONES[zone] checked at every call site.
    zone: z.enum(ZONE_IDS),
    prop: z.string().min(1),

    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
