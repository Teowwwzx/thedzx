---
title: "The blog comes first, the room comes second"
description: "A 3D world can't be indexed, read aloud, or copy-pasted. So this site is a blog with a room built on top — never a room with text inside."
pubDate: 2026-09-02
zone: room
prop: monitor
tags: ["three.js", "architecture", "seo", "build-log"]
draft: true
---

<!--
  DRAFT — NOT YOURS YET.
  This was written by an AI while scaffolding the site. The architecture and the
  technical claims are accurate and checked, but the first person is not: "I
  wanted", "the rule I'm holding myself to", "I'm not going to learn to model"
  are assertions about YOU that you never made.
  Read it, make it yours, delete this comment, then set draft: false.
-->

I wanted this site to feel like walking into a room rather than scrolling a page.
A desk with what I know about IT. A door to the street. A gym. The top floor of
Merdeka 118, looking down at a city that runs on software most people never see.

Then I looked at what that actually costs, and found the one constraint that
decides everything else.

## A canvas is a black box

Everything drawn in WebGL lives inside a single `<canvas>` element. That element
has no text, no headings, and no links. Which means:

- **Google can't read it.** Googlebot follows links in `href` attributes. A
  raycast click is not an `href`.
- **A screen reader can't read it.** Canvas pixels aren't a document tree.
- **Nobody can copy a sentence out of it**, or hit Ctrl+F, or send a friend a
  link to the paragraph that mattered.

So the tempting version of this project — one immersive world, everything inside
it — produces a site that nobody can find and nobody can quote. That's not a
blog. That's a demo.

## The inversion

The fix is to build it backwards from how it looks:

> Every post is a real HTML page at a real URL first. The 3D world is a second
> way in — never the only way.

Concretely, that means `/blog/<slug>/` exists, is static, and renders fully with
JavaScript disabled. The room is a navigation layer on top. Both read from the
same markdown file. Neither can drift, because there's only one source.

The world talks to the blog through exactly one file:

```json
GET /world.json
{
  "version": 1,
  "zones": [{ "id": "room", "label": "The Room", "stage": 1 }],
  "posts": [
    {
      "slug": "the-blog-comes-first",
      "url": "/blog/the-blog-comes-first/",
      "title": "The blog comes first, the room comes second",
      "teaser": "A 3D world can't be indexed, read aloud, or copy-pasted...",
      "zone": "room",
      "prop": "monitor"
    }
  ]
}
```

Slug, zone, prop, teaser. A few kilobytes. No post body ever loads until someone
opens one. If that file starts growing, the world is asking the blog for too
much.

## What the zones are for

Each place in the world is a category, and the mapping isn't decorative:

| Place | What lives there |
|---|---|
| The desk | IT, build logs, code |
| The bookshelf | Longer essays |
| Outside | The city, where every building is signed with the tech that runs it |
| The gym | Discipline and mindset |
| Merdeka 118, L116 | Looking outward — the macro view |
| Merdeka 118, L118 | Looking down — the micro view |

The tower is the part I'm most sure about. Two observation decks, two storeys
apart. From one you look out at the horizon; from the other you look straight
down at individual streets. That's the difference between macro and micro, and
it doesn't need a menu to explain it — being higher and seeing further is
already what the word means.

## The order of work

Nothing 3D exists yet. That's deliberate. The failure mode for projects like
this is well documented: the engine becomes the hobby, the writing never
happens, and eighteen months later there's a beautiful empty room.

So the rule I'm holding myself to is boring and specific:

**No new location until the current one has five published posts behind it.**

There's a `LOCATIONS.md` in the repo with a table and a status column. It exists
to say no.

## What's next

Stage 1 is one room, fixed camera, three hotspots — desk, bookshelf, TV — and a
visibly locked door with a sign on it, so the world reads as expandable rather
than unfinished. Flat-shaded low-poly, no textures, assembled from CC0 kits.
I am not going to learn to model. I'm going to learn just enough Blender to move
things, bake light into vertex colours, and export a `.glb` under 1.5 MB.

If you're reading this, the blog half works. That was the hard part to get right
and the easy part to build.
