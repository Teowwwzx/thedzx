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

  // Fully static, and it stays that way. Static output is what guarantees
  // every post is real HTML before any JS runs, and what lets nginx serve the
  // whole site off disk with no runtime.
  output: 'static',

  // /blog/<slug>/ is the canonical shape in the plan. Directory format +
  // always-trailing-slash keeps that consistent everywhere.
  trailingSlash: 'always',
  build: { format: 'directory' },

  integrations: [
    mdx(),
    // OG cards are images, not pages — keep them out of the sitemap.
    sitemap({
      // Placeholder scaffolding and OG images are not pages anyone should find.
      filter: (page) => !page.includes('/og/') && !page.includes('/blog/ph-'),
    }),
  ],

  vite: {
    resolve: {
      // The world bundle is loaded by a dynamic import() from a plain script
      // rather than by an Astro island, so nothing else forces a single copy
      // of these. Without dedupe, Vite's dev pre-bundling hands R3F a second
      // React instance and every hook call throws "Invalid hook call".
      // three needs it too — two copies produce silent instanceof failures.
      dedupe: ['react', 'react-dom', 'three'],
    },
    optimizeDeps: {
      // Pre-bundle these up front so dev does not re-optimize mid-import and
      // serve a 504 "Outdated Optimize Dep" for a chunk already in flight.
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        'three',
        '@react-three/fiber',
        '@react-three/drei',
      ],
    },
  },

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
