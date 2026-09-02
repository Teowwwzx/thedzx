// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// The origin lives in site.config.mjs and is imported here, in src/consts.ts
// and by the generated robots.txt — one place, no second copy to forget.
// @astrojs/sitemap refuses to run without `site`.
import { SITE_URL } from './site.config.mjs';

export default defineConfig({
  site: SITE_URL,

  // Stage 0 is fully static. Keep it that way: static output is what makes
  // Cloudflare Workers static-asset hosting free and unmetered, and what
  // guarantees every post is real HTML before any JS runs.
  output: 'static',

  // /blog/<slug>/ is the canonical shape in the plan. Directory format +
  // always-trailing-slash keeps that consistent everywhere.
  trailingSlash: 'always',
  build: { format: 'directory' },

  integrations: [
    mdx(),
    // OG cards are images, not pages — keep them out of the sitemap.
    sitemap({ filter: (page) => !page.includes('/og/') }),
  ],

  markdown: {
    // NOTE: Astro 7 defaults to Sätteri (its Rust markdown pipeline), not
    // unified/remark. If you ever add a remark or rehype plugin you will need
    // `markdown.processor: unified()` — see astro.build/docs. shikiConfig
    // works with the default processor.
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
      wrap: true,
    },
  },
});
