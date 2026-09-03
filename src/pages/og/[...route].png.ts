import { OGImageRoute } from 'astro-og-canvas';
import { SITE } from '../../consts';
import { allPosts } from '../../lib/posts';
import { SWATCHES, rgb, swatchFor } from '../../lib/palette';

/**
 * Build-time Open Graph cards. Generated once at build and served as static
 * PNGs — nothing runs at request time, so nginx serves them straight off disk.
 *
 * NOTE: the default font is fetched from fontsource during the build, so the
 * build machine needs network access. Results are cached in
 * node_modules/.astro-og-canvas between builds.
 */

interface Card {
  slug: string;
  title: string;
  description: string;
  eyebrow: string;
  /** The post's own swatch, as channels. Same hue as its row on the index. */
  accent: [number, number, number];
}

const posts = await allPosts();

const cards: Record<string, Card> = {
  home: {
    slug: 'home',
    title: SITE.title,
    description: SITE.description,
    eyebrow: SITE.tagline,
    // The card is dark, so the site card takes the dark-ground variant of
    // the house hue for the same reason the strip does.
    accent: rgb(SWATCHES[5].boldDark),
  },
};

for (const post of posts) {
  cards[`blog-${post.id}`] = {
    slug: `blog/${post.id}`,
    title: post.data.title,
    description: post.data.description,
    // `zone` is optional now and surfaced nowhere on the site, so the card
    // carries the date instead. Reading .label off an absent zone is what
    // broke the build when the taxonomy came out.
    eyebrow: `${SITE.title} · ${post.data.pubDate.toISOString().slice(0, 10)}`,
    accent: rgb(swatchFor(post.id).boldDark),
  };
}

// NOTE: getSlug returns the path WITHOUT `.png` — the extension comes from
// this file's name, so the generated route is a file route.
export const { getStaticPaths, GET } = await OGImageRoute({
  pages: cards,
  getSlug: (_path, page) => page.slug,
  getImageOptions: (_path, page) => ({
    title: page.title,
    description: page.description,
    // The card is always dark — it is shown on someone else's timeline, not
    // on this site, so it does not follow the visitor's theme. The rule down
    // the side is the post's own swatch, in the dark-ground variant.
    bgGradient: [
      [16, 20, 27],
      [24, 29, 38],
    ],
    border: { color: page.accent, width: 14, side: 'inline-start' },
    padding: 68,
    font: {
      title: { size: 62, weight: 'ExtraBold', color: [223, 229, 238], lineHeight: 1.15 },
      description: { size: 28, weight: 'Normal', color: [131, 142, 161], lineHeight: 1.4 },
    },
  }),
});
