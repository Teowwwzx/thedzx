/**
 * The floating objects in the hero.
 *
 * Decoration first: the page is complete without it, it loads after first
 * paint, and every failure path is "nothing happens" rather than "something
 * breaks". Since the objects became clickable it is also a SHORTCUT — never
 * a route. Everything it links to is a real <a href> in the list directly
 * below, which is what search engines, screen readers and keyboards use.
 * That is why the canvas stays aria-hidden: it duplicates the list, and
 * announcing the same seven posts twice helps nobody.
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
  Object3D,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
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
  type Extent,
  type Palette,
} from './objects';

/**
 * One post, as the stage needs it.
 *
 * Emitted as JSON by src/pages/index.astro and handed in by the bootstrap,
 * rather than read from the DOM in here: the module then has no hidden
 * dependency on an element id, and the page owns its own data.
 */
export interface Link {
  title: string;
  href: string;
  /** Swatch NAME, e.g. "butter". Resolved against SWATCHES below. */
  swatch: string;
}

type Builder = (p: Palette) => Group;

export interface Slot {
  build: Builder;
  /** Palette index. Used only when no post is bound to this slot. */
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

export const FOV = 38;
export const CAM_Z = 9;

/** Matches the breakpoint in global.css, where the stage becomes a band. */
export const NARROW = 700;

/** How much an object grows and rises when the pointer is on it. */
export const HOVER_SCALE = 1.14;
export const HOVER_LIFT = 0.05;

/* --- scroll ---------------------------------------------------------------
 * Scrolling drives the band as well as passing it. Three separate things,
 * because one of them alone reads as a glitch rather than as a response:
 *
 *   DRIFT     objects shear apart vertically by depth — near ones rise, far
 *             ones sink — so the band gains a third dimension exactly when
 *             you are moving past it.
 *   TURN      the whole set rotates with scroll position, like a turntable.
 *   MOMENTUM  scroll VELOCITY adds a decaying spin, so a flick sets them
 *             tumbling and a slow drag barely moves them. This is the part
 *             that feels like the page answering you rather than animating.
 *
 * Progress is measured from the top of the document, NOT from the band's
 * position in the viewport: at rest the objects then sit exactly where the
 * slot table puts them, and every effect grows from zero as you scroll.
 */
export const SCROLL_SPAN = 0.9;
export const SCROLL_MAX = 1.4;
export const SCROLL_DRIFT = 0.08;
export const SCROLL_TURN = 0.9;
/** Deepest slot, for normalising depth into a -1..1 shear factor. */
export const DEPTH_SCALE = 1.4;

/**
 * Slots are in LEFT-TO-RIGHT order, and posts are bound to them in list
 * order. So the leftmost object is the newest post and the band reads the
 * same direction as the list under it. Reordering this array silently
 * reorders the links.
 */
export const WIDE: Slot[] = [
  { build: floppy,   hue: 1, ndc: [-0.82,  0.36], depth: -1.0, size: 0.70, spin: [0.16, 0.05], bob: [0.06, 7.3], tilt: [0.22, -0.5, 0.15] },
  { build: dumbbell, hue: 3, ndc: [-0.54, -0.42], depth:  0.4, size: 0.80, spin: [0.11, 0.08], bob: [0.07, 9.1], tilt: [0.35, 0.4, -0.25] },
  { build: laptop,   hue: 5, ndc: [-0.13,  0.16], depth:  1.0, size: 1.05, spin: [0.09, 0.03], bob: [0.05, 8.2], tilt: [0.5, 0.6, 0.05] },
  { build: mug,      hue: 6, ndc: [ 0.24, -0.42], depth:  1.3, size: 0.56, spin: [0.19, 0.02], bob: [0.07, 6.4], tilt: [0.15, 0, 0.1] },
  { build: keyboard, hue: 2, ndc: [ 0.44,  0.44], depth: -0.4, size: 0.82, spin: [0.13, 0.04], bob: [0.05, 10.4], tilt: [0.6, -0.3, -0.1] },
  { build: rack,     hue: 4, ndc: [ 0.70, -0.26], depth:  0.2, size: 0.92, spin: [0.10, 0.02], bob: [0.05, 8.8], tilt: [0.12, -0.5, 0.05] },
  { build: tower,    hue: 0, ndc: [ 0.86,  0.16], depth: -1.4, size: 1.02, spin: [0.12, 0.01], bob: [0.04, 11.2], tilt: [0.06, 0.2, 0.1] },
];

/**
 * Four, not seven. A phone band is 210px tall and the same objects at the
 * same spacing would overlap into mush — and every one of them is a draw
 * call on the device least able to afford it. Left-to-right, same as above.
 */
export const NARROW_SLOTS: Slot[] = [
  { build: phone,  hue: 1, ndc: [-0.86, -0.38], depth: -0.3, size: 0.62, spin: [0.21, 0.06], bob: [0.08, 5.8], tilt: [0.18, 0.3, -0.22] },
  { build: laptop, hue: 5, ndc: [-0.38,  0.22], depth:  0.5, size: 1.00, spin: [0.09, 0.03], bob: [0.05, 8.2], tilt: [0.5, 0.6, 0.05] },
  { build: rack,   hue: 4, ndc: [ 0.36, -0.20], depth:  0.1, size: 0.90, spin: [0.10, 0.02], bob: [0.06, 8.8], tilt: [0.12, -0.5, 0.05] },
  { build: mug,    hue: 6, ndc: [ 0.76,  0.40], depth:  0.9, size: 0.52, spin: [0.19, 0.02], bob: [0.08, 6.4], tilt: [0.15, 0, 0.1] },
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

/** Half-height of the frustum at a given world z. */
export const halfHeightAt = (z: number) =>
  Math.tan(MathUtils.degToRad(FOV) / 2) * (CAM_Z - z);

/**
 * Where an object sits, and how big.
 *
 * Module scope, exported, and called by BOTH layout() and
 * scripts/check-framing.mjs — the gate has to exercise this arithmetic, not
 * a copy of it. A gate that reimplements the thing it checks passes happily
 * while the shipped code is wrong, which is the failure mode this whole file
 * keeps running into.
 *
 * The clamp is what keeps an object inside the band. Its budget has to cover
 * every way the object moves after this runs: the bob, the hover lift, the
 * hover growth and the scroll drift — see draw().
 *
 * The vertical bound is the object's REAL half-extent, not half its longest
 * side. A sphere bound reserves nearly twice the room a laptop needs, and on
 * a 210px band that slack is the difference between objects that can move
 * and objects pinned to the middle.
 */
export function placeSlot(slot: Slot, extent: Extent, aspect: number) {
  const half = halfHeightAt(slot.depth);
  const scale = slot.size * half;
  // The wobble is about X, which rotates Z into view, so the worst case is
  // the larger of the two.
  const reach = 0.5 * Math.max(extent.y, extent.z) * scale * HOVER_SCALE;
  const headroom = 1 - slot.bob[0] - HOVER_LIFT - SCROLL_DRIFT * SCROLL_MAX;
  const limit = Math.max(0, half * headroom - reach);
  return {
    half,
    scale,
    reach,
    limit,
    x: slot.ndc[0] * half * aspect,
    baseY: MathUtils.clamp(slot.ndc[1] * half, -limit, limit),
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
  /** The post this object opens, or null if there are fewer posts than slots. */
  link: Link | null;
  /** Frustum half-height at this object's depth. */
  half: number;
  /** Resting y, already clamped so the object cannot leave the band. */
  baseY: number;
  /** World scale at rest, before any hover growth. */
  restScale: number;
  /** Normalised dimensions, from normalise(). Used to bound it tightly. */
  extent: Extent;
  /** 0 → 1, eased. Drives the lift and the growth. */
  hover: number;
}

/**
 * Returns a teardown function, or NULL if there is no stage to tear down —
 * the caller uses that to collapse the reserved band rather than leave an
 * empty strip at the top of the page.
 */
export function mount(host: HTMLElement, links: Link[] = []): (() => void) | null {
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
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);

  // The label that names whatever the pointer is on. Its own element rather
  // than something drawn into the canvas: it is text, so it should be text —
  // it gets the page's font, its own colour tokens and no extra draw call.
  const label = document.createElement('div');
  label.className = 'hero-label';
  label.setAttribute('aria-hidden', 'true');
  host.appendChild(label);

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

  const swatchIndex = (name: string) => SWATCHES.findIndex((s) => s.name === name);

  function build(slots: Slot[], dark: boolean) {
    for (const p of placed) {
      scene.remove(p.object);
      p.object.traverse((node) => {
        const mesh = node as { geometry?: { dispose(): void } };
        mesh.geometry?.dispose();
      });
    }
    placed = slots.map((slot, i) => {
      const link = links[i] ?? null;
      // An object bound to a post wears THAT POST'S colour, so the thing you
      // pick up is the same hue as the row it opens. Only an unbound object
      // falls back to the slot's own hue.
      const named = link ? swatchIndex(link.swatch) : -1;
      const object = slot.build(paletteFor(named >= 0 ? named : slot.hue, dark));
      object.rotation.set(slot.tilt[0], slot.tilt[1], slot.tilt[2]);
      scene.add(object);
      const extent = (object.userData.extent as Extent | undefined) ?? { x: 1, y: 1, z: 1 };
      return { slot, object, link, half: 1, baseY: 0, restScale: 1, extent, hover: 0 };
    });
    slotsInUse = slots;
    builtDark = dark;
    // Clear what updateHover() owns, not just the reference. Crossing the
    // 700px breakpoint with the pointer at rest on an object used to leave
    // its title hanging over empty colour with cursor:pointer under it,
    // promising a link that no longer existed.
    hovered = null;
    canvas.style.cursor = '';
    delete label.dataset.shown;
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
      // `npm run framing` checks this same call over 18 viewport sizes.
      const at = placeSlot(p.slot, p.extent, camera.aspect);
      p.object.scale.setScalar(at.scale);
      p.half = at.half;
      p.restScale = at.scale;
      p.baseY = at.baseY;
      p.object.position.set(at.x, at.baseY, p.slot.depth);
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
      if (!running) draw(lastT);
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

  /* --- pointer ----------------------------------------------------- */
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  /** Parallax target and its eased value. */
  const parallax = { x: 0, y: 0, tx: 0, ty: 0 };
  /** Pointer in NDC, for the raycaster. Off-canvas values simply miss. */
  const ndc = new Vector2(-2, -2);
  const raycaster = new Raycaster();
  const projected = new Vector3();
  let hovered: Placed | null = null;
  let pointerInside = false;
  /** Where the press landed, so onClick can tell a tap from a drag. */
  let pressed = false;
  let pressX = 0;
  let pressY = 0;

  /*
   * Scroll is sampled in a listener, not read inside the frame.
   *
   * A scroll handler runs while layout is still clean, so window.scrollY is
   * free there. Reading it inside draw() — after placeLabel() has written
   * style.left and style.top — would force a synchronous layout on every
   * single frame, which is the one performance mistake a decorative canvas
   * really cannot afford.
   */
  let scrollY = window.scrollY;
  let lastScrollY = scrollY;
  let viewportH = window.innerHeight;
  /** Decaying angular impulse from scroll velocity. */
  let momentum = 0;

  const onScroll = () => {
    scrollY = window.scrollY;
    // Sampled here for the same reason as scrollY: layout is clean inside a
    // scroll handler, and the band's own height is 34vh, so this changes.
    viewportH = window.innerHeight;
  };

  function toNdc(e: { clientX: number; clientY: number }) {
    const r = host.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    parallax.tx = ((e.clientX - r.left) / r.width) * 2 - 1;
    parallax.ty = ((e.clientY - r.top) / r.height) * 2 - 1;
    ndc.set(parallax.tx, -parallax.ty);
  }

  /** The Placed whose group contains this mesh, or null. */
  function ownerOf(node: Object3D | null): Placed | null {
    for (let n = node; n; n = n.parent) {
      const hit = placed.find((p) => p.object === n);
      if (hit) return hit;
    }
    return null;
  }

  /**
   * Raycast and update `hovered`.
   *
   * Called from inside the frame, AFTER positions are written, because the
   * objects bob: a hit test against last frame's matrices misses by a few
   * pixels at the top and bottom of the float. Returns true if the hovered
   * object changed, which is what tells the still-frame path to redraw.
   */
  function updateHover(): boolean {
    let next: Placed | null = null;

    // Deliberately NOT gated on `pointerInside`.
    //
    // Touch fires pointerout/pointerleave BEFORE the compatibility click, so
    // a gate on that flag makes every tap miss: the label flashes on
    // pointerdown and the click then resolves to nothing. That shipped, and
    // it made the shortcut dead on every phone and tablet while working
    // perfectly under a mouse — which is exactly why hand-testing missed it.
    //
    // The flag is not load-bearing here anyway: onPointerLeave parks `ndc`
    // at (-2, -2), which the bounds check below rejects, and the window
    // listener that follows the pointer across the page never writes `ndc`
    // at all. So hover still cannot light up from the post list below.
    if (links.length > 0 && Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1) {
      scene.updateMatrixWorld(true);
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(
        placed.filter((p) => p.link).map((p) => p.object),
        true,
      );
      next = hits.length ? ownerOf(hits[0].object) : null;
    }

    if (next === hovered) return false;
    hovered = next;
    canvas.style.cursor = hovered ? 'pointer' : '';
    if (hovered?.link) {
      label.textContent = hovered.link.title;
      label.style.setProperty('--sw', `var(--sw-${hovered.link.swatch})`);
      label.dataset.shown = 'true';
    } else {
      delete label.dataset.shown;
      // Cleared, not just hidden. A faded-out element holding the title of
      // whatever you last pointed at is stale state waiting to be read by
      // something — and it is how a measurement of this very function
      // reported seven objects stacked on top of each other.
      label.textContent = '';
    }
    return true;
  }

  /** Park the label above the hovered object, clamped inside the band. */
  function placeLabel() {
    if (!hovered) return;
    const w = host.clientWidth;
    const h = host.clientHeight;
    projected.copy(hovered.object.position).project(camera);
    const x = (projected.x * 0.5 + 0.5) * w;
    const y = (0.5 - projected.y * 0.5) * h;
    // The label is centred on the object and pulled above it. Clamping to
    // the band's own width is what stops the leftmost and rightmost objects
    // pushing their titles off the edge.
    const padX = 10 + label.offsetWidth / 2;
    // `top` is the label's BOTTOM edge — it is translated up by its own
    // height — so the low clamp has to be its height, not zero, or a label
    // on a high object hangs out over the headline.
    const minY = label.offsetHeight + 4;
    label.style.left = `${MathUtils.clamp(x, padX, Math.max(padX, w - padX))}px`;
    label.style.top = `${MathUtils.clamp(y - hovered.restScale * 26, minY, Math.max(minY, h - 4))}px`;
  }

  function onPointerMove(e: PointerEvent) {
    pointerInside = true;
    toNdc(e);
    // With frames running, the hit test happens inside draw(). Without them
    // — reduced motion, or the band paused off-screen — this is the only
    // chance to notice, so do it here and repaint if it changed.
    if (!running) {
      if (updateHover()) draw(lastT);
      else placeLabel();
    }
  }

  /**
   * The browser takes the pointer to scroll the page and sends
   * pointercancel — never pointerup, and never a click. Clearing `pressed`
   * here keeps a scroll that happened to start on an object from being
   * mistaken for a press that is still in progress.
   */
  function onPointerCancel() {
    pressed = false;
    pointerInside = false;
    ndc.set(-2, -2);
    if (!running && updateHover()) draw(lastT);
  }

  function onPointerLeave() {
    pointerInside = false;
    ndc.set(-2, -2);
    parallax.tx = 0;
    parallax.ty = 0;
    if (!running && updateHover()) draw(lastT);
  }

  /**
   * Touch has no hover, so the tap itself has to do the hit test. Running it
   * on pointerdown also flashes the label, which is the only feedback a
   * phone gets that the thing was a link at all.
   */
  function onPointerDown(e: PointerEvent) {
    pointerInside = true;
    pressed = true;
    pressX = e.clientX;
    pressY = e.clientY;
    toNdc(e);
    if (updateHover() && !running) draw(lastT);
  }

  function onClick(e: MouseEvent) {
    // A drag is not a click. The reflex on any 3D scene is to grab and
    // orbit, and a press that starts on empty band and merely RELEASES on
    // an object would otherwise throw you into a post you never chose.
    // 6px is the browser's own drag slop.
    const dragged = !pressed || Math.hypot(e.clientX - pressX, e.clientY - pressY) > 6;
    pressed = false;
    if (dragged) return;

    // Alt-click is "download" and anything but the primary button is not a
    // navigation. The canvas has no anchor default to honour, so decline.
    if (e.button !== 0 || e.altKey) return;

    toNdc(e);
    // A fresh test rather than trusting `hovered`: on touch there was never
    // a move event, and on desktop the objects have drifted since the last
    // frame. Missing means the click was on empty band — do nothing at all,
    // which is what stops a stray tap navigating.
    updateHover();
    const href = hovered?.link?.href;

    if (!href) {
      // A touch tap leaves `ndc` sitting on the point it hit, and no further
      // pointer event is coming to clear it — so the label would hang there
      // over a missed tap. Put the band back to "no pointer".
      ndc.set(-2, -2);
      if (updateHover() && !running) draw(lastT);
      return;
    }

    // Mirror what the identical <a href> in the list below would do, rather
    // than stealing the tab from someone queueing up three posts.
    if (e.metaKey || e.ctrlKey || e.shiftKey) window.open(href, '_blank', 'noopener');
    else window.location.href = href;
  }

  function draw(t: number) {
    lastT = t;
    const seconds = t / 1000;
    const still = motionQuery.matches;

    /*
     * How far down the page we are, 0 at the top. Reduced motion pins it to
     * zero rather than freezing it wherever the visitor happened to be:
     * frozen mid-effect is a broken-looking layout, not a still one.
     */
    const progress = still
      ? 0
      : MathUtils.clamp(scrollY / (Math.max(1, viewportH) * SCROLL_SPAN), 0, SCROLL_MAX);

    /*
     * Momentum is integrated ONLY inside the running loop.
     *
     * A still redraw — a hover change while the band is paused — has no
     * elapsed time, so decaying by dt = 0 would leave a spin frozen at full
     * strength forever, and integrating velocity outside a frame would let
     * it build up while nothing is being drawn. Neither is a spin; both are
     * stuck state.
     *
     * Frames, not milliseconds, but MEASURED: the spin then decays at the
     * same rate on a 120Hz display as on a 60Hz one instead of dying twice
     * as fast.
     */
    if (still) {
      momentum = 0;
    } else if (running) {
      const dt = MathUtils.clamp((t - prevT) / 16.67, 0, 6);
      // Velocity, not position. A flick throws them; a slow drag does not.
      momentum += (scrollY - lastScrollY) * 0.0016;
      momentum *= Math.pow(0.93, dt);
      if (Math.abs(momentum) < 0.0002) momentum = 0;
      lastScrollY = scrollY;
    }
    prevT = t;

    for (const p of placed) {
      const target = p === hovered ? 1 : 0;
      // Reduced motion gets the state, not the transition.
      p.hover = still ? target : p.hover + (target - p.hover) * 0.18;

      const bobOffset = still
        ? 0
        : Math.sin((seconds / p.slot.bob[1]) * Math.PI * 2 + p.slot.hue) * p.slot.bob[0] * p.half;

      // Near objects rise, far ones sink: the band shears open by depth as
      // it goes past. Bounded by SCROLL_DRIFT * SCROLL_MAX, which layout()
      // has already taken out of the clamp's budget.
      const shear = (p.slot.depth / DEPTH_SCALE) * progress * SCROLL_DRIFT * p.half;

      p.object.position.y = p.baseY + bobOffset + shear + p.hover * HOVER_LIFT * p.half;
      p.object.scale.setScalar(p.restScale * (1 + (HOVER_SCALE - 1) * p.hover));

      if (!still) {
        // A lighter object takes more of the flick, which is what makes the
        // set read as seven separate things rather than one rotating rig.
        const heft = 0.5 + p.slot.spin[0] * 3;
        p.object.rotation.y =
          p.slot.tilt[1] + seconds * p.slot.spin[0] + progress * SCROLL_TURN + momentum * heft;
        p.object.rotation.x =
          p.slot.tilt[0] + Math.sin(seconds * p.slot.spin[1] * 3) * 0.14 + momentum * 0.4;
      }
    }

    if (!still) {
      parallax.x += (parallax.tx - parallax.x) * 0.06;
      parallax.y += (parallax.ty - parallax.y) * 0.06;
      camera.position.x = parallax.x * 0.75;
      camera.position.y = -parallax.y * 0.45;
      camera.lookAt(0, 0, 0);
    }

    if (running) updateHover();
    placeLabel();

    renderer.render(scene, camera);
  }

  let raf = 0;
  let lastT = 0;
  let prevT = 0;
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
    // First frame after a resume has no previous timestamp to measure from.
    if (prevT === 0) prevT = t;
    draw(t);
  }

  function start() {
    if (running || !sized || !visible || document.hidden || motionQuery.matches) return;
    running = true;
    // The loop was paused while the band was off-screen, so the page may have
    // moved thousands of pixels since the last sample. Without this the first
    // frame back reads that as one enormous flick and the objects snap.
    lastScrollY = scrollY;
    momentum = 0;
    prevT = 0;
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
      draw(lastT);
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
      if (!running) draw(lastT);
    } else if (!running) {
      draw(lastT);
    }
  }

  const ro = new ResizeObserver(settle);
  ro.observe(host);

  settle();

  // The band only accepts a pointer when there is something to open. With
  // no posts it stays inert, so it can never eat a click on empty colour.
  if (links.length > 0) {
    host.dataset.interactive = 'true';
    canvas.addEventListener('pointermove', onPointerMove, { passive: true });
    canvas.addEventListener('pointerdown', onPointerDown, { passive: true });
    canvas.addEventListener('pointerleave', onPointerLeave, { passive: true });
    canvas.addEventListener('pointercancel', onPointerCancel, { passive: true });
    canvas.addEventListener('click', onClick);
  }

  // Always listened for, links or not: the scroll response is decoration and
  // does not depend on there being anything to open.
  window.addEventListener('scroll', onScroll, { passive: true });
  // Parallax follows the pointer across the whole page, not just the band —
  // it is the reason the objects feel like they are in the room with you.
  window.addEventListener('pointermove', toNdcParallaxOnly, { passive: true });

  /**
   * The window-level listener updates the PARALLAX target only.
   *
   * It deliberately does not touch `ndc`: a raycast driven from anywhere on
   * the page would light objects up while the pointer is over the post list
   * three hundred pixels below.
   */
  function toNdcParallaxOnly(e: PointerEvent) {
    if (pointerInside) return;
    const r = host.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    parallax.tx = MathUtils.clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1.6, 1.6);
    parallax.ty = MathUtils.clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1.6, 1.6);
  }

  return () => {
    stop();
    io.disconnect();
    ro.disconnect();
    themeWatcher.disconnect();
    themeQuery.removeEventListener('change', applyTheme);
    motionQuery.removeEventListener('change', onMotionChange);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pointermove', toNdcParallaxOnly);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointerleave', onPointerLeave);
    canvas.removeEventListener('pointercancel', onPointerCancel);
    canvas.removeEventListener('click', onClick);
    window.removeEventListener('scroll', onScroll);
    label.remove();
    renderer.dispose();
    canvas.remove();
  };
}
