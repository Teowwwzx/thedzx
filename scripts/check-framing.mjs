#!/usr/bin/env node
/**
 * The framing gate.
 *
 * Asks one question of the hero scenery: CAN AN OBJECT EVER LEAVE THE BAND?
 *
 * This project has answered "yes" twice by accident. The camera's `fov` is
 * VERTICAL, so laying anything out in world units puts it off-canvas the
 * moment the viewport turns portrait — that shipped once, on phones. Then
 * hover growth was added without being taken out of the clamp's budget, so
 * the object you reached for was the one that got sliced.
 *
 * Neither was visible in whichever browser happened to be open, and neither
 * would have been caught by a screenshot. So it is arithmetic instead,
 * checked at the worst moment for every object: bob, hover lift, hover
 * growth and maximum scroll drift all at once and all in the same direction.
 *
 * IT CALLS THE REAL CODE. hero.ts and objects.ts are bundled on the fly, the
 * slot tables and the constants are imported, the geometry comes from the
 * actual builders, and the placement comes from `placeSlot` — the same
 * function layout() calls. An earlier draft re-implemented that arithmetic
 * and I proved it worthless: reintroducing the original hover bug left the
 * gate passing, because the gate was only checking its own copy.
 *
 * WHAT IT DOES NOT COVER
 * Horizontal overhang is reported, never failed. Objects at the far slots
 * are meant to run off the edges — that is the band bleeding, not a bug —
 * so the number is printed to be looked at, not enforced.
 */
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Keep at least this much of the frustum half-height in hand, everywhere. */
const MIN_SLACK = 0.02;

/**
 * How far the clamp may move an object before the slot table is fiction.
 * The clamp is a safety net; if it is routinely relocating things, the
 * numbers in WIDE/NARROW_SLOTS no longer describe the layout that ships.
 */
const MAX_CLAMP = 0.05;

/** Small phones, tall phones, tablets, laptops, 4K, ultrawide, and the two
 *  sizes either side of the NARROW breakpoint. */
const VIEWPORTS = [
  [320, 480], [360, 640], [375, 812], [390, 844], [414, 896], [428, 926],
  [600, 900], [699, 500], [700, 500], [768, 1024], [820, 1180],
  [1024, 640], [1280, 800], [1440, 900], [1920, 1080], [2560, 1440],
  [3440, 1440], [3840, 2160],
];

/**
 * The band's height, from global.css:
 *   clamp(232px, 34vh, 400px), overridden to 210px at max-width: 700px.
 * The one number here that CANNOT be imported — there is no CSS to read from
 * Node — so it is the one place this gate can drift. Change the stylesheet,
 * change this.
 */
function bandHeight(vw, vh) {
  if (vw <= 700) return 210;
  return Math.min(Math.max(232, vh * 0.34), 400);
}

const dir = await mkdtemp(join(tmpdir(), 'thedzx-framing-'));
try {
  await build({
    entryPoints: ['src/scenery/hero.ts'],
    outfile: join(dir, 'hero.mjs'),
    bundle: true,
    format: 'esm',
    platform: 'node',
    logLevel: 'error',
  });

  const {
    NARROW, HOVER_LIFT, HOVER_SCALE, SCROLL_MAX, SCROLL_DRIFT, DEPTH_SCALE,
    WIDE, NARROW_SLOTS, placeSlot,
  } = await import(pathToFileURL(join(dir, 'hero.mjs')).href);

  const swatch = { body: '#888888', trim: '#444444', wash: '#dddddd' };

  const failures = [];
  const overhang = [];
  let worst = { slack: Infinity };
  let checks = 0;

  for (const [vw, vh] of VIEWPORTS) {
    const h = bandHeight(vw, vh);
    const aspect = vw / h;
    const slots = vw < NARROW ? NARROW_SLOTS : WIDE;

    for (const slot of slots) {
      // The real builder, so the real bounding box.
      const extent = slot.build(swatch).userData.extent;
      const at = placeSlot(slot, extent, aspect);
      checks++;

      /*
       * The object's true worst-case half-extent, computed HERE.
       *
       * Not `at.reach`. That is placeSlot's own safety figure, and importing
       * it makes the assertion inherit whatever the implementation got
       * wrong: drop HOVER_SCALE from placeSlot and the clamp lets objects
       * sit further out AND the gate stops accounting for the growth, so it
       * passes. I tried exactly that and it did. `at.scale` is fine — that
       * is the object's size, not a safety budget — and the constants are
       * the ones draw() actually animates with, so changing one moves both.
       */
      const reach = 0.5 * Math.max(extent.y, extent.z) * at.scale * HOVER_SCALE;

      // Everything draw() adds on top of baseY, worst case, same direction.
      const shear =
        Math.abs(slot.depth / DEPTH_SCALE) * SCROLL_MAX * SCROLL_DRIFT * at.half;
      const excursion =
        Math.abs(at.baseY) + slot.bob[0] * at.half + HOVER_LIFT * at.half + shear + reach;
      const slack = (at.half - excursion) / at.half;

      const id = `${slot.build.name} @ ${vw}x${vh}`;
      if (slack < MIN_SLACK) {
        failures.push(
          `${id}: ${(slack * 100).toFixed(1)}% vertical slack, needs ${(MIN_SLACK * 100).toFixed(0)}%. ` +
            'Lower its ndc[1], shrink its size, or make the band taller.',
        );
      }
      if (slack < worst.slack) worst = { slack, id };

      const moved = Math.abs(at.baseY - slot.ndc[1] * at.half) / at.half;
      if (moved > MAX_CLAMP) {
        failures.push(
          `${id}: the clamp moved it ${(moved * 100).toFixed(0)}% of half-height. ` +
            'The slot table no longer describes where this object actually sits — ' +
            'author the real position instead of relying on the safety net.',
        );
      }

      // Informational: how far past the canvas edge it reaches sideways.
      const halfW = at.half * aspect;
      const outX = (Math.abs(at.x) + 0.5 * extent.x * at.scale * HOVER_SCALE - halfW) / halfW;
      if (outX > 0) overhang.push(`${id}: ${(outX * 100).toFixed(0)}% past the side edge`);
    }
  }

  console.log(`\n  Framing check — ${VIEWPORTS.length} viewports, ${checks} placements`);
  console.log(
    `  budget:           bob + ${(HOVER_LIFT * 100).toFixed(0)}% lift + ` +
      `${(HOVER_SCALE * 100 - 100).toFixed(0)}% growth + ` +
      `${(SCROLL_DRIFT * SCROLL_MAX * 100).toFixed(0)}% scroll drift, simultaneously`,
  );
  console.log(`  tightest:         ${worst.id} at ${(worst.slack * 100).toFixed(1)}% slack`);
  console.log(`  side overhang:    ${overhang.length} placement(s) bleed off the edges (allowed)`);

  if (failures.length) {
    console.error('\n  FRAMING BROKEN\n');
    for (const f of failures) console.error(`  ✗ ${f}`);
    console.error('');
    process.exit(1);
  }
  console.log('\n  ✓ every object stays inside the band, at every size, at the worst moment\n');
} finally {
  await rm(dir, { recursive: true, force: true });
}
