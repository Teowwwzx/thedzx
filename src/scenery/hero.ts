/**
 * The floating objects in the hero.
 *
 * Decoration, and it behaves like decoration: the page is complete without
 * it, it is loaded after first paint, it never takes a pointer event, and
 * every failure path is "nothing happens" rather than "something breaks".
 *
 * WHY THE OBJECTS ARE NOT BEHIND THE HEADLINE
 * The obvious build puts the canvas behind the whole hero. It cannot work
 * here: the headline is 132px of near-black in light mode and near-white in
 * dark, and a saturated object passing under it lands somewhere around
 * 1.2:1 either way. There is no object palette that survives both. So the
 * stage is a band of its own beneath the type — the colour field behind the
 * headline is CSS (.hero::before), which stays pale enough to read on.
 *
 * WHY POSITIONS ARE IN NDC
 * `fov` is VERTICAL. Laying objects out in world units puts them off-canvas
 * the moment the viewport gets narrow — this project has already shipped
 * that bug once, on portrait phones. Every slot below is normalised device
 * coordinates, converted through the real camera frustum at the object's own
 * depth, so a slot at x = 0.9 is at 90% of the way out at every aspect ratio.
 */
import {
  DirectionalLight,
  Group,
  HemisphereLight,
  MathUtils,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';
import { SWATCHES } from '../lib/palette';
import {
  dumbbell,
  floppy,
  keyboard,
  laptop,
  mug,
  phone,
  rack,
  setNeutralTheme,
  tower,
  type Palette,
} from './objects';

type Builder = (p: Palette) => Group;

interface Slot {
  build: Builder;
  /** Palette index. Spread so all seven hues appear at least once. */
  hue: number;
  /** Normalised device coordinates, -1..1. */
  ndc: [number, number];
  /** World z. Negative is further away; drives parallax and apparent size. */
  depth: number;
  /** Fraction of the frustum half-height at z = 0. */
  size: number;
  /** Radians per second about y, and the frequency of the wobble about x. */
  spin: [number, number];
  /** Bob amplitude as a fraction of half-height, and its period in seconds. */
  bob: [number, number];
  /** Resting tilt, so nothing sits perfectly square to the camera. */
  tilt: [number, number, number];
}

const FOV = 38;
const CAM_Z = 9;

/** Matches the breakpoint in global.css, where the stage becomes a band. */
const NARROW = 700;

const WIDE: Slot[] = [
  { build: floppy,   hue: 1, ndc: [-0.82,  0.36], depth: -1.0, size: 0.70, spin: [0.16, 0.05], bob: [0.06, 7.3], tilt: [0.22, -0.5, 0.15] },
  { build: dumbbell, hue: 3, ndc: [-0.54, -0.42], depth:  0.4, size: 0.80, spin: [0.11, 0.08], bob: [0.07, 9.1], tilt: [0.35, 0.4, -0.25] },
  { build: laptop,   hue: 5, ndc: [-0.13,  0.16], depth:  1.0, size: 1.05, spin: [0.09, 0.03], bob: [0.05, 8.2], tilt: [0.5, 0.6, 0.05] },
  { build: mug,      hue: 6, ndc: [ 0.24, -0.50], depth:  1.3, size: 0.56, spin: [0.19, 0.02], bob: [0.07, 6.4], tilt: [0.15, 0, 0.1] },
  { build: keyboard, hue: 2, ndc: [ 0.44,  0.44], depth: -0.4, size: 0.82, spin: [0.13, 0.04], bob: [0.05, 10.4], tilt: [0.6, -0.3, -0.1] },
  { build: rack,     hue: 4, ndc: [ 0.70, -0.26], depth:  0.2, size: 0.92, spin: [0.10, 0.02], bob: [0.05, 8.8], tilt: [0.12, -0.5, 0.05] },
  { build: tower,    hue: 0, ndc: [ 0.86,  0.22], depth: -1.4, size: 1.10, spin: [0.12, 0.01], bob: [0.04, 11.2], tilt: [0.06, 0.2, 0.1] },
];

/**
 * Four, not seven. A phone band is 210px tall and the same objects at the
 * same spacing would overlap into mush — and every one of them is a draw
 * call on the device least able to afford it.
 */
const NARROW_SLOTS: Slot[] = [
  { build: laptop, hue: 5, ndc: [-0.38,  0.22], depth:  0.5, size: 1.00, spin: [0.09, 0.03], bob: [0.05, 8.2], tilt: [0.5, 0.6, 0.05] },
  { build: rack,   hue: 4, ndc: [ 0.36, -0.20], depth:  0.1, size: 0.90, spin: [0.10, 0.02], bob: [0.06, 8.8], tilt: [0.12, -0.5, 0.05] },
  { build: mug,    hue: 6, ndc: [ 0.76,  0.40], depth:  0.9, size: 0.52, spin: [0.19, 0.02], bob: [0.08, 6.4], tilt: [0.15, 0, 0.1] },
  { build: phone,  hue: 1, ndc: [-0.86, -0.46], depth: -0.3, size: 0.62, spin: [0.21, 0.06], bob: [0.08, 5.8], tilt: [0.18, 0.3, -0.22] },
];

/**
 * Two hues per object: its own, and the one three along.
 *
 * The body takes a BOLD value, never the wash — a pale body has almost no
 * silhouette against #f7f7f5, and the object would be visible only by its
 * own shading. WHICH bold depends on the theme, for the same reason the
 * strip's does: `bold` is tuned to hold against paper and goes muddy on
 * ink, `boldDark` the other way round. The pale wash is the screen or the
 * label, and pops against either.
 */
function paletteFor(index: number, dark: boolean): Palette {
  const a = SWATCHES[index % SWATCHES.length];
  const b = SWATCHES[(index + 3) % SWATCHES.length];
  return {
    body: dark ? a.boldDark : a.bold,
    trim: dark ? b.boldDark : b.bold,
    wash: a.wash,
  };
}

function prefersDark(): boolean {
  const t = document.documentElement.dataset.theme;
  if (t === 'dark') return true;
  if (t === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

interface Placed {
  slot: Slot;
  object: Group;
  /** Frustum half-height at this object's depth. */
  half: number;
  /** Resting y, already clamped so the object cannot leave the band. */
  baseY: number;
}

/**
 * Returns a teardown function, or NULL if there is no stage to tear down —
 * the caller uses that to collapse the reserved band rather than leave an
 * empty strip at the top of the page.
 */
export function mount(host: HTMLElement): (() => void) | null {
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch {
    // No WebGL, or a context refused. The CSS colour field is the page.
    return null;
  }

  renderer.setClearAlpha(0);
  // 1.75 rather than the device's own: past that the extra pixels are not
  // visible on decoration this soft, and they are the whole GPU cost.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.appendChild(renderer.domElement);

  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 100);
  camera.position.set(0, 0, CAM_Z);

  const hemi = new HemisphereLight(0xffffff, 0x9aa0aa, 1.0);
  scene.add(hemi);
  const key = new DirectionalLight(0xffffff, 1.55);
  key.position.set(3, 5, 6);
  scene.add(key);
  const fill = new DirectionalLight(0xffe6c4, 0.5);
  fill.position.set(-4, -2, 3);
  scene.add(fill);

  let placed: Placed[] = [];
  let slotsInUse: Slot[] | null = null;
  /** Which theme the current objects were built for. */
  let builtDark: boolean | null = null;

  /** Half-height of the frustum at a given world z. */
  const halfHeightAt = (z: number) =>
    Math.tan(MathUtils.degToRad(FOV) / 2) * (CAM_Z - z);

  function build(slots: Slot[], dark: boolean) {
    for (const p of placed) {
      scene.remove(p.object);
      p.object.traverse((node) => {
        const mesh = node as { geometry?: { dispose(): void } };
        mesh.geometry?.dispose();
      });
    }
    placed = slots.map((slot) => {
      const object = slot.build(paletteFor(slot.hue, dark));
      object.rotation.set(slot.tilt[0], slot.tilt[1], slot.tilt[2]);
      scene.add(object);
      return { slot, object, half: 1, baseY: 0 };
    });
    slotsInUse = slots;
    builtDark = dark;
  }

  function layout() {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (w === 0 || h === 0) return false;

    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    const wanted = w < NARROW ? NARROW_SLOTS : WIDE;
    const dark = prefersDark();
    // Rebuilding on a theme flip rather than repainting each material: the
    // whole set is seven groups of primitives, which is cheaper to make
    // again than to walk and recolour by hand.
    if (wanted !== slotsInUse || dark !== builtDark) build(wanted, dark);

    for (const p of placed) {
      // Scale against the half-height AT THIS OBJECT'S DEPTH, not at z = 0.
      // Then `size` means the same fraction of the visible band for every
      // object, and depth buys parallax without quietly changing framing.
      const half = halfHeightAt(p.slot.depth);
      const scale = p.slot.size * half;
      p.object.scale.setScalar(scale);
      p.half = half;

      // normalise() fits each object into a unit cube, so half its longest
      // side is the worst-case radius. Keeping that inside the band — bob
      // included — is what stops an object being sliced by the canvas edge
      // at an aspect ratio nobody tested.
      const limit = Math.max(0, half * (1 - p.slot.bob[0]) - scale / 2);
      p.baseY = MathUtils.clamp(p.slot.ndc[1] * half, -limit, limit);

      p.object.position.set(p.slot.ndc[0] * half * camera.aspect, p.baseY, p.slot.depth);
    }
    return true;
  }

  /* --- theme ------------------------------------------------------- */
  function applyTheme() {
    const dark = prefersDark();
    setNeutralTheme(dark);
    hemi.groundColor.setHex(dark ? 0x39404d : 0x9aa0aa);
    hemi.intensity = dark ? 0.85 : 1.0;
    key.intensity = dark ? 1.35 : 1.55;
    // Before the first layout there is nothing built to recolour; settle()
    // calls this once the objects exist and lays them out itself.
    if (sized) {
      layout();
      if (!running) draw(0);
    }
  }

  const themeQuery = window.matchMedia('(prefers-color-scheme: dark)');
  themeQuery.addEventListener('change', applyTheme);
  // The toggle writes data-theme on <html>; nothing dispatches an event for
  // that, so the attribute itself is the signal.
  const themeWatcher = new MutationObserver(applyTheme);
  themeWatcher.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });

  /* --- motion ------------------------------------------------------ */
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };

  function onPointer(e: PointerEvent) {
    const r = host.getBoundingClientRect();
    pointer.tx = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.ty = ((e.clientY - r.top) / r.height) * 2 - 1;
  }

  function draw(t: number) {
    const seconds = t / 1000;
    for (const { slot, object, half, baseY } of placed) {
      object.position.y =
        baseY + Math.sin((seconds / slot.bob[1]) * Math.PI * 2 + slot.hue) * slot.bob[0] * half;
      object.rotation.y = slot.tilt[1] + seconds * slot.spin[0];
      object.rotation.x = slot.tilt[0] + Math.sin(seconds * slot.spin[1] * 3) * 0.14;
    }

    pointer.x += (pointer.tx - pointer.x) * 0.06;
    pointer.y += (pointer.ty - pointer.y) * 0.06;
    camera.position.x = pointer.x * 0.75;
    camera.position.y = -pointer.y * 0.45;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }

  let raf = 0;
  let running = false;
  let visible = false;
  /**
   * Has the host ever had a size?
   *
   * A tab that loads in the background can measure 0×0 — the browser has
   * no reason to lay out a document nobody is looking at, and the idle
   * callback that starts all this fires anyway. Treating that as "no stage"
   * is how the scenery disappeared for anyone who opened the site in a new
   * tab. So zero is not a failure, it is "not yet": the ResizeObserver
   * below finishes the job the moment the element gets a box.
   */
  let sized = false;

  function frame(t: number) {
    raf = requestAnimationFrame(frame);
    draw(t);
  }

  function start() {
    if (running || !sized || !visible || document.hidden || motionQuery.matches) return;
    running = true;
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(raf);
  }

  const io = new IntersectionObserver(
    (entries) => {
      visible = entries[0].isIntersecting;
      if (visible) start();
      else stop();
    },
    { rootMargin: '120px' },
  );
  io.observe(host);

  const onVisibility = () => (document.hidden ? stop() : start());
  document.addEventListener('visibilitychange', onVisibility);

  // A visitor who turns motion off mid-session gets the still frame, not a
  // frozen one — the objects are already in a resting pose.
  const onMotionChange = () => {
    if (motionQuery.matches) {
      stop();
      draw(0);
    } else {
      start();
    }
  };
  motionQuery.addEventListener('change', onMotionChange);

  /** Lay out, and on the first real size, light the stage up. */
  function settle() {
    if (!layout()) return;
    if (!sized) {
      // applyTheme() before `sized` flips, so it does not lay out a second
      // time on top of the call above.
      applyTheme();
      sized = true;
      // Only now, with a frame on the canvas, does the stage fade in — see
      // .hero-stage[data-ready] in global.css. Until then the colour field
      // is the hero, and a device that never gets here simply keeps it.
      host.dataset.ready = 'true';
      start();
      // start() declines for three good reasons — reduced motion, a hidden
      // tab, a band still below the fold — and every one of them still needs
      // ONE frame. Without this the band fades in empty and stays empty for
      // anyone who asked for no motion.
      if (!running) draw(0);
    } else if (!running) {
      draw(0);
    }
  }

  const ro = new ResizeObserver(settle);
  ro.observe(host);

  settle();

  if (!motionQuery.matches) {
    window.addEventListener('pointermove', onPointer, { passive: true });
  }

  return () => {
    stop();
    io.disconnect();
    ro.disconnect();
    themeWatcher.disconnect();
    themeQuery.removeEventListener('change', applyTheme);
    motionQuery.removeEventListener('change', onMotionChange);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pointermove', onPointer);
    renderer.dispose();
    renderer.domElement.remove();
  };
}
