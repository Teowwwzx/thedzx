# Locations

> **THE 3D WORLD IS ON HOLD.**
> Nothing on the site loads it. All of it is still here — `src/world/`,
> `src/world/locations/`, `src/world/audio.ts` — and `npm run world` still
> checks its structure so it does not rot. The site is an ordinary blog until
> there is something to put in the world.
>
> To bring it back: restore the world entry in `src/pages/index.astro` (see
> git history for `885f9a7`, "The entry is the game"), and re-add the world
> budgets in `scripts/check-budgets.mjs`.
>
> **`src/scenery/` is not the world.** It is the band of floating objects in
> the homepage hero — decoration, no navigation, nothing to enter, no zones,
> no doors. It shares three.js and nothing else. Do not let the two grow
> into each other: the moment the scenery gets a hotspot, it is the world
> again and the rule below applies to it.

The six zones below double as the blog's topics. There is never a seventh.

| Zone | Built in 3D | Posts needed | Real posts | Placeholders |
|---|---|---|---|---|
| The Room | Yes | 5 | 0 | 6 |
| Outside | Yes | 5 | 0 | 2 |
| The Gym | Yes | 5 | 0 | 2 |
| Merdeka 118 | Yes | 5 | 0 | 2 |
| The Server Room | Yes | 5 | 0 | 1 |
| The TV | n/a — live data, not a place | — | — | — |

## The rule, and the override

This file exists to say no. The rule was: **no new location until the current
one has five published posts behind it**, because the engine becoming the
hobby is the documented way projects like this die.

**On 2 September 2026 the owner overrode it and asked for all stages at once.**
That was his call and it is recorded here rather than quietly forgotten. The
consequence is the row above: five locations built, **zero real posts** behind
any of them. The thirteen placeholder files in `src/content/blog/` exist only
so the world does not read as empty — they carry `placeholder: true`, stay out
of the sitemap and the feed, and are `noindex`.

The rule still stands for anything that comes next. The world is finished; the
writing has not started.

## Deleting the placeholders

```bash
rm src/content/blog/ph-*.md
```
Nothing else references them.
