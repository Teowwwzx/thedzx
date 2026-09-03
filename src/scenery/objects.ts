/**
 * The things that float in the hero.
 *
 * All of it is primitives — boxes, cylinders, a torus. Nothing is loaded
 * from disk, which is the whole reason this can ship: the budget gate caps
 * 3D assets, and the number here is zero. It also means every object is
 * recoloured from the palette rather than baked into a texture.
 *
 * Each builder returns a Group in ARBITRARY units. `normalise()` then scales
 * and recentres it into a unit cube, so the layout in hero.ts can say "0.9"
 * and mean nine tenths of the band's half-height for every object alike.
 *
 * THE ONE RULE FOR COLOUR HERE: a body panel is always a bold palette hue,
 * never a dark neutral. These objects sit on the same field as large type,
 * and `neutral()` — the only dark material — is used for bezels, keycaps and
 * shadow gaps, never for a face big enough to swallow a letterform.
 */
import {
  Box3,
  BoxGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Object3D,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';

/**
 * The one material that changes with the theme.
 *
 * A dark bezel reads as detail on paper and as a hole on ink, so the neutral
 * is not one colour but two. It is a single shared instance rather than one
 * per mesh: they are all the same colour, so a per-mesh copy would only give
 * `setNeutralTheme` a growing list to walk every time the stage rebuilds.
 */
const NEUTRAL_LIGHT = 0x2a2d33;
const NEUTRAL_DARK = 0x9aa3b2;

const NEUTRAL = new MeshLambertMaterial({ color: NEUTRAL_LIGHT });

export const neutral = () => NEUTRAL;

export function setNeutralTheme(dark: boolean) {
  NEUTRAL.color.setHex(dark ? NEUTRAL_DARK : NEUTRAL_LIGHT);
}

const lambert = (color: string | number) => new MeshLambertMaterial({ color });
/** Screens and LEDs: unlit, so they read as emitting rather than as painted. */
const glow = (color: string | number) => new MeshBasicMaterial({ color });

function box(w: number, h: number, d: number, mat: MeshLambertMaterial | MeshBasicMaterial) {
  return new Mesh(new BoxGeometry(w, h, d), mat);
}

/** Scale and recentre into a unit cube, so every object is comparable. */
export function normalise(group: Group): Group {
  const bounds = new Box3().setFromObject(group);
  const size = bounds.getSize(new Vector3());
  const centre = bounds.getCenter(new Vector3());
  const longest = Math.max(size.x, size.y, size.z) || 1;

  // Recentre the CHILDREN, not the group: the group's own transform is the
  // layout's to own, and writing position here would be overwritten by it.
  const holder = new Group();
  group.position.sub(centre);
  holder.add(group);
  holder.scale.setScalar(1 / longest);

  const outer = new Group();
  outer.add(holder);
  return outer;
}

export interface Palette {
  /** Bold hue for the body panel. */
  body: string;
  /** Second bold hue for trim and details. */
  trim: string;
  /** Pale hue, for screens and labels. */
  wash: string;
}

/* ------------------------------------------------------------------ */

/** An open laptop. The lid hinges off the back edge, so it opens correctly. */
export function laptop(p: Palette): Group {
  const g = new Group();

  const base = box(1.5, 0.09, 1.02, lambert(p.body));
  g.add(base);

  // Keyboard well and trackpad, sunk a hair into the deck so the edges catch
  // the light instead of z-fighting with the base's top face.
  const well = box(1.3, 0.03, 0.5, neutral());
  well.position.set(0, 0.05, -0.16);
  g.add(well);

  const pad = box(0.44, 0.03, 0.28, lambert(p.wash));
  pad.position.set(0, 0.05, 0.28);
  g.add(pad);

  const hinge = new Group();
  hinge.position.set(0, 0.04, -0.51);
  // The lid mesh below is built ALREADY UPRIGHT — it stands at y = +0.47 —
  // so this angle is how far it leans BACK from vertical, not how far it
  // opens from the deck. -1.8 rad here (the open angle) swings it under the
  // base and out of sight, which is exactly what it did.
  hinge.rotation.x = -0.32;
  g.add(hinge);

  const lid = box(1.5, 0.94, 0.05, lambert(p.body));
  lid.position.set(0, 0.47, 0);
  hinge.add(lid);

  const screen = box(1.34, 0.8, 0.02, glow(p.wash));
  screen.position.set(0, 0.47, 0.035);
  hinge.add(screen);

  // Two bars of "content" so the screen is not a blank rectangle.
  const barA = box(0.86, 0.09, 0.01, glow(p.trim));
  barA.position.set(-0.2, 0.66, 0.05);
  hinge.add(barA);
  const barB = box(0.52, 0.09, 0.01, glow(p.body));
  barB.position.set(-0.37, 0.5, 0.05);
  hinge.add(barB);

  return normalise(g);
}

/** A short server rack. Slot bars in the palette; blinking is done in hero.ts. */
export function rack(p: Palette): Group {
  const g = new Group();

  g.add(box(0.92, 1.52, 0.72, lambert(p.body)));

  const hues = [p.trim, p.wash, p.trim, p.wash, p.trim];
  for (let i = 0; i < 5; i++) {
    const unit = box(0.8, 0.2, 0.03, lambert(hues[i]));
    unit.position.set(0, 0.56 - i * 0.27, 0.37);
    g.add(unit);

    const led = new Mesh(new SphereGeometry(0.028, 10, 8), glow('#7cff9d'));
    led.position.set(0.31, 0.56 - i * 0.27, 0.4);
    g.add(led);

    const vent = box(0.44, 0.06, 0.02, neutral());
    vent.position.set(-0.1, 0.56 - i * 0.27, 0.395);
    g.add(vent);
  }

  return normalise(g);
}

/** A keyboard. The keycaps are one InstancedMesh — 48 keys, one draw call. */
export function keyboard(p: Palette): Group {
  const g = new Group();
  g.add(box(1.7, 0.1, 0.64, lambert(p.body)));

  const cols = 12;
  const rows = 4;
  const keys = new InstancedMesh(new BoxGeometry(0.1, 0.045, 0.1), neutral(), cols * rows);
  const dummy = new Object3D();
  let i = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      dummy.position.set(-0.72 + c * 0.131, 0.07, -0.21 + r * 0.14);
      dummy.updateMatrix();
      keys.setMatrixAt(i++, dummy.matrix);
    }
  }
  keys.instanceMatrix.needsUpdate = true;
  g.add(keys);

  // Spacebar, so the shape reads as a keyboard and not as a waffle.
  const space = box(0.62, 0.045, 0.1, lambert(p.trim));
  space.position.set(0, 0.07, 0.35);
  g.add(space);

  return normalise(g);
}

/** A mug. */
export function mug(p: Palette): Group {
  const g = new Group();

  // Taller than it is wide, or it reads as a plant pot.
  const body = new Mesh(new CylinderGeometry(0.3, 0.25, 0.66, 28), lambert(p.body));
  g.add(body);

  // Recessed below the rim and mid-brown rather than near-black: flush and
  // dark, it read as soil and the whole thing looked like a plant pot.
  const coffee = new Mesh(new CylinderGeometry(0.255, 0.255, 0.02, 24), lambert('#6b4526'));
  coffee.position.y = 0.25;
  g.add(coffee);

  const handle = new Mesh(new TorusGeometry(0.16, 0.045, 10, 22), lambert(p.body));
  handle.position.set(0.32, 0.02, 0);
  handle.rotation.y = Math.PI / 2;
  g.add(handle);

  const stripe = new Mesh(new CylinderGeometry(0.292, 0.292, 0.09, 28), lambert(p.trim));
  stripe.position.y = 0.18;
  g.add(stripe);

  return normalise(g);
}

/** A 3.5" floppy. Older than the author; still the clearest icon for "saved". */
export function floppy(p: Palette): Group {
  const g = new Group();

  g.add(box(0.94, 0.94, 0.09, lambert(p.body)));

  const label = box(0.66, 0.42, 0.02, lambert(p.wash));
  label.position.set(0, -0.2, 0.055);
  g.add(label);

  const shutter = box(0.36, 0.26, 0.03, neutral());
  shutter.position.set(0.06, 0.32, 0.055);
  g.add(shutter);

  const notch = box(0.09, 0.26, 0.03, lambert(p.trim));
  notch.position.set(-0.18, 0.32, 0.055);
  g.add(notch);

  return normalise(g);
}

/** A phone. */
export function phone(p: Palette): Group {
  const g = new Group();
  g.add(box(0.54, 1.02, 0.08, lambert(p.body)));

  const screen = box(0.46, 0.88, 0.02, glow(p.wash));
  screen.position.z = 0.052;
  g.add(screen);

  const notch = box(0.16, 0.045, 0.02, neutral());
  notch.position.set(0, 0.4, 0.07);
  g.add(notch);

  const row = box(0.3, 0.07, 0.01, glow(p.trim));
  row.position.set(-0.05, 0.12, 0.07);
  g.add(row);

  return normalise(g);
}

/** A dumbbell. The gym is part of the story; this is all that survived of it. */
export function dumbbell(p: Palette): Group {
  const g = new Group();

  const bar = new Mesh(new CylinderGeometry(0.062, 0.062, 1.15, 16), neutral());
  bar.rotation.z = Math.PI / 2;
  g.add(bar);

  for (const x of [-0.45, 0.45]) {
    const plate = new Mesh(new CylinderGeometry(0.3, 0.3, 0.18, 26), lambert(p.body));
    plate.rotation.z = Math.PI / 2;
    plate.position.x = x;
    g.add(plate);

    const collar = new Mesh(new CylinderGeometry(0.15, 0.15, 0.22, 18), lambert(p.trim));
    collar.rotation.z = Math.PI / 2;
    collar.position.x = x * 0.62;
    g.add(collar);
  }

  return normalise(g);
}

/** Merdeka 118, roughly: a tapered shaft with a spire. */
export function tower(p: Palette): Group {
  const g = new Group();

  const shaft = new Mesh(new CylinderGeometry(0.1, 0.32, 1.7, 6), lambert(p.body));
  g.add(shaft);

  const spire = new Mesh(new CylinderGeometry(0.004, 0.055, 0.62, 6), lambert(p.trim));
  spire.position.y = 1.16;
  g.add(spire);

  // Two banded floors, which is what reads as "very tall building" at this
  // size far better than any number of window rows would.
  for (const [y, r] of [
    [0.55, 0.17],
    [0.05, 0.245],
  ] as const) {
    const band = new Mesh(new CylinderGeometry(r + 0.03, r + 0.03, 0.07, 6), lambert(p.wash));
    band.position.y = y;
    g.add(band);
  }

  return normalise(g);
}
