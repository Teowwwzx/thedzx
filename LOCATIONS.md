# Locations

The six zones below are the whole world. There is never a seventh.

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
