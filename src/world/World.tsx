import { Component, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { PerspectiveCamera, Vector3, type Group } from 'three';
import type { ZoneId } from '../consts';
import { LOCATIONS, HAS_WORLD, START } from './locations';
import type { LocationSpec } from './locations/spec';
import { Character } from './Character';
import { useCharacter } from './useCharacter';
import { FrameProbe } from './FrameProbe';
import { useDeviceGate } from './useDeviceGate';
import { MarketPanel } from './MarketPanel';
import { PALETTE } from './palette';
import { sfx, unlock, isEnabled, setEnabled } from './audio';
import type { WorldData, WorldPost } from './types';

const PROP_COPY: Record<string, { label: string; empty: string }> = {
  monitor: { label: 'The desk', empty: 'Nothing on the desk yet. This is where the IT writing goes.' },
  bookshelf: { label: 'The bookshelf', empty: 'No essays on the shelf yet. One spine appears per published essay.' },
  screen: { label: 'The TV', empty: '' },
  building: { label: 'The street', empty: 'Every building here is signed with the technology that runs it. The writing about that goes on this street.' },
  rack: { label: 'The rack', empty: 'Nothing racked yet. Discipline and habits go here.' },
  treadmill: { label: 'The treadmill', empty: 'Nothing here yet. Consistency writing goes on the treadmill.' },
  'window-116': { label: 'Level 116 — the macro view', empty: 'You are looking out at the horizon. Rates, currency, market structure — the things you cannot control but have to read correctly. Nothing published here yet.' },
  'window-118': { label: 'Level 118 — the micro view', empty: 'You are looking straight down at individual streets. Single positions, your own money, the decisions that are actually yours. Nothing published here yet.' },
};

/* ------------------------------------------------------------------ */

export class WorldErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[world] render failed', error, info.componentStack);
  }
  render() {
    if (this.state.failed) {
      return (
        <div className="world-blocked">
          <p>The world stopped working.</p>
          <p>
            Everything in it is on <a href="/room/">the reading list</a> — the world is a second
            way in, never the only one.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/* ------------------------------------------------------------------ */

/**
 * Third-person follow camera.
 *
 * `fov` in three.js is VERTICAL, so on a portrait phone the horizontal field
 * collapses and things at the edges of a room leave the frame entirely. The
 * distance is therefore derived from the aspect ratio rather than fixed: a
 * narrower canvas stands the camera further back.
 */
function FollowCam({
  target,
  reducedMotion,
  frameWidth,
}: {
  target: Vector3;
  reducedMotion: boolean;
  frameWidth: number;
}) {
  const { camera, size } = useThree();
  const desired = useMemo(() => new Vector3(), []);
  const look = useMemo(() => new Vector3(), []);
  const placed = useRef(false);

  useFrame((_, delta) => {
    if (!(camera instanceof PerspectiveCamera)) return;
    const aspect = size.width / Math.max(size.height, 1);
    const halfV = (camera.fov * Math.PI) / 360;
    const halfH = Math.atan(Math.tan(halfV) * aspect);
    // Keep the location's own width in frame whatever the shape of the canvas.
    const dist = Math.min(26, Math.max(4.4, frameWidth / 2 / Math.tan(halfH)));

    // No clamp, and no occlusion test: every location is open on +z, so the
    // camera never has a wall to stand behind. Clamping z instead (an earlier
    // attempt) pinned the camera a metre from the player and looked almost
    // straight down.
    desired.set(target.x, 1.7 + dist * 0.42, target.z + dist * 0.86);
    look.set(target.x, 1.05, target.z - dist * 0.12);

    if (!placed.current || reducedMotion) {
      camera.position.copy(desired);
      placed.current = true;
    } else {
      camera.position.lerp(desired, Math.min(1, delta * 4.5));
    }
    camera.lookAt(look);
  });

  return null;
}

/** Clicking the floor walks there. */
function FloorTarget({ spec, onWalk }: { spec: LocationSpec; onWalk: (x: number, z: number) => void }) {
  const [minX, maxX, minZ, maxZ] = spec.bounds;
  return (
    <mesh
      position={[(minX + maxX) / 2, -0.01, (minZ + maxZ) / 2]}
      rotation={[-Math.PI / 2, 0, 0]}
      onPointerDown={(e) => {
        e.stopPropagation();
        onWalk(e.point.x, e.point.z);
      }}
    >
      <planeGeometry args={[maxX - minX + 1, maxZ - minZ + 1]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  );
}

function Marker({
  position,
  label,
  count,
  active,
  near,
  reducedMotion,
  onOpen,
  dataProp,
  isDoor,
}: {
  position: readonly [number, number, number];
  label: string;
  count: number | null;
  active: boolean;
  near: boolean;
  reducedMotion: boolean;
  onOpen: () => void;
  dataProp: string;
  /** Doors travel; they do not expand anything, so they get no aria-expanded. */
  isDoor?: boolean;
}) {
  const ring = useRef<Group>(null);
  useFrame((state) => {
    if (!ring.current) return;
    if (reducedMotion) {
      ring.current.scale.setScalar(1);
      return;
    }
    ring.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 2 + position[0]) * 0.08);
  });

  return (
    <group position={position as [number, number, number]}>
      <group ref={ring}>
        <mesh onClick={(e) => { e.stopPropagation(); onOpen(); }}>
          <ringGeometry args={[0.075, 0.115, 24]} />
          <meshBasicMaterial color={near || active ? PALETTE.accentWarm : PALETTE.accent} transparent opacity={near || active ? 1 : 0.8} side={2} />
        </mesh>
      </group>
      <Html center distanceFactor={7} zIndexRange={[20, 0]}>
        {/* The label is not signage. It appears when you are close enough to
            act on it and is otherwise gone, so the world explains itself by
            being walked through rather than by being annotated. It stays a
            real <button> at all times — a screen reader and a keyboard get
            it whether or not it is painted. */}
        <button
          type="button"
          className={`hotspot-label${active ? ' is-active' : ''}${near ? ' is-near' : ' is-far'}`}
          data-prop={dataProp}
          aria-expanded={isDoor ? undefined : active}
          onClick={onOpen}
        >
          {label}
          {count ? <span className="hotspot-count">{count}</span> : null}
        </button>
      </Html>
    </group>
  );
}

/* ------------------------------------------------------------------ */

function Scene({
  spec,
  posts,
  activeProp,
  reducedMotion,
  arriveAt,
  onOpen,
  onTravel,
}: {
  spec: LocationSpec;
  posts: WorldPost[];
  activeProp: string | null;
  reducedMotion: boolean;
  /** Where the door you came through says you land. */
  arriveAt: readonly [number, number] | null;
  onOpen: (prop: string) => void;
  onTravel: (to: ZoneId) => void;
}) {
  const rig = useRef<Group>(null);
  const entry = arriveAt ?? spec.spawn;
  const { position, moving, walkTo } = useCharacter(rig, spec.bounds, spec.blockers, entry);
  const [nearest, setNearest] = useState<string | null>(null);
  const { gl, scene, camera } = useThree();

  // Compile everything before the first frame is shown. Without this the
  // first look at a new material stalls the main thread — the room-entry
  // stutter is a well-documented and entirely avoidable problem.
  useEffect(() => {
    let alive = true;
    void gl.compileAsync?.(scene, camera)?.catch(() => {});
    return () => {
      alive = false;
      void alive;
    };
  }, [gl, scene, camera, spec.id]);

  // Proximity: highlight whatever you are standing next to.
  useFrame(() => {
    let best: string | null = null;
    let bestD = 2.0;
    for (const h of spec.hotspots) {
      const d = Math.hypot(position.x - h.position[0], position.z - h.position[2]);
      if (d < bestD) { bestD = d; best = h.prop; }
    }
    for (const d of spec.doors) {
      const dist = Math.hypot(position.x - d.position[0], position.z - d.position[2]);
      if (dist < bestD) { bestD = dist; best = `door:${d.to}`; }
    }
    if (best !== nearest) {
      if (best) sfx.proximity();
      setNearest(best);
    }
  });

  // Footsteps, timed off the same sine that swings the legs.
  const stepPhase = useRef(0);
  useFrame((_, delta) => {
    if (!moving) return;
    stepPhase.current += delta;
    if (stepPhase.current > 0.34) {
      stepPhase.current = 0;
      sfx.step();
    }
  });

  // E acts on whatever is in reach. `nearest` is already the closest thing,
  // so this is the same target the ring is highlighting — no second notion
  // of "selected" to drift out of step with what the player can see.
  const nearestRef = useRef(nearest);
  nearestRef.current = nearest;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'e' && e.key !== 'E') return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      const target = nearestRef.current;
      if (!target) {
        sfx.denied();
        return;
      }
      e.preventDefault();
      if (target.startsWith('door:')) onTravel(target.slice(5) as ZoneId);
      else onOpen(target);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onOpen, onTravel]);

  const countFor = (prop: string) => posts.filter((p) => p.prop === prop).length;

  return (
    <>
      <color attach="background" args={[spec.ambience]} />
      <fog attach="fog" args={[spec.ambience, 14, 46]} />

      {/* Key/fill split rather than one flat light: a cool sky fill and a
          warm key from the front-right. Flat-shaded boxes read as cardboard
          under even light and as objects under a directional one. */}
      <ambientLight intensity={0.62} />
      <hemisphereLight args={['#9fb6d8', '#2a2018', 1.05]} />
      <directionalLight
        position={[4.5, 8, 5]}
        intensity={1.55}
        color="#ffd9b0"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0015}
        shadow-normalBias={0.02}
      >
        {/* A tight ortho frustum keeps 1024px of shadow map on the room
            instead of spreading it over the whole scene as mush. */}
        <orthographicCamera attach="shadow-camera" args={[-12, 12, 12, -12, 0.5, 40]} />
      </directionalLight>
      {/* Cool rim from behind, so silhouettes separate from the back wall. */}
      <directionalLight position={[-5, 4, -6]} intensity={0.5} color="#7fa6d8" />

      <spec.Scenery />
      <FloorTarget spec={spec} onWalk={walkTo} />

      <group ref={rig}>
        <Character moving={moving} reducedMotion={reducedMotion} />
      </group>
      <FollowCam
        target={position}
        reducedMotion={reducedMotion}
        frameWidth={spec.frameWidth}
      />

      {spec.hotspots.map((h) => (
        <Marker
          key={h.prop}
          position={h.position}
          dataProp={h.prop}
          label={h.label}
          count={h.prop === 'screen' ? null : countFor(h.prop)}
          active={activeProp === h.prop}
          near={nearest === h.prop}
          reducedMotion={reducedMotion}
          onOpen={() => onOpen(h.prop)}
        />
      ))}

      {spec.doors.map((d) => (
        <Marker
          key={d.to}
          position={[d.position[0], d.position[1] + 1.35, d.position[2]]}
          dataProp={`door:${d.to}`}
          label={d.label}
          count={null}
          active={false}
          near={nearest === `door:${d.to}`}
          reducedMotion={reducedMotion}
          isDoor
          onOpen={() => onTravel(d.to)}
        />
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ */

function Panel({ prop, posts, onClose }: { prop: string; posts: WorldPost[]; onClose: () => void }) {
  const meta = PROP_COPY[prop] ?? { label: prop, empty: 'Nothing here yet.' };
  const items = posts.filter((p) => p.prop === prop);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => { heading.current?.focus(); }, [prop]);

  return (
    <div className="world-panel" role="dialog" aria-modal="false" aria-label={meta.label}>
      <div className="world-panel-head">
        <h2 ref={heading} tabIndex={-1}>{meta.label}</h2>
        <button type="button" onClick={onClose} aria-label="Close panel">✕</button>
      </div>

      {prop === 'screen' && <MarketPanel />}

      {items.length === 0 ? (
        prop === 'screen' ? null : <p className="world-panel-empty">{meta.empty}</p>
      ) : (
        <ul className="world-panel-list">
          {items.map((post) => (
            <li key={post.slug}>
              {/* A real link to a real static page. The panel is a shortcut
                  into the blog, never a replacement for it. */}
              <a href={post.url}>
                <span className="world-panel-date">{post.pubDate}</span>
                <span className="world-panel-title">{post.title}</span>
                <span className="world-panel-teaser">{post.teaser}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function World({ data }: { data: WorldData }) {
  const gate = useDeviceGate();
  const reducedMotion = useReducedMotion();
  const [here, setHere] = useState<ZoneId>('room');
  const [arriveAt, setArriveAt] = useState<readonly [number, number] | null>(null);
  const [activeProp, setActiveProp] = useState<string | null>(null);
  const [fading, setFading] = useState(false);
  const [ready, setReady] = useState(false);
  const [stalled, setStalled] = useState(false);
  const opener = useRef<string | null>(null);

  // LOCATIONS is deliberately partial — the TV is not a place. `here` only
  // ever comes from HAS_WORLD, so this fallback should be unreachable; it
  // exists so a future zone added without a location degrades to the room
  // instead of crashing the world.
  const spec = LOCATIONS[here] ?? LOCATIONS[START]!;
  const posts = useMemo(() => data.posts.filter((p) => p.zone === here), [data.posts, here]);

  useEffect(() => {
    if (ready) return;
    const t = window.setTimeout(() => setStalled(true), 12_000);
    return () => window.clearTimeout(t);
  }, [ready]);

  const open = useCallback((prop: string) => {
    setActiveProp((cur) => {
      if (cur === prop) {
        sfx.close();
        return null;
      }
      sfx.open();
      opener.current = prop;
      return prop;
    });
  }, []);

  const close = useCallback(() => {
    sfx.close();
    setActiveProp(null);
    const id = opener.current;
    if (!id) return;
    requestAnimationFrame(() => {
      document.querySelector<HTMLButtonElement>(`.hotspot-label[data-prop="${id}"]`)?.focus();
    });
  }, []);

  const travel = useCallback(
    (to: ZoneId) => {
      if (!HAS_WORLD.includes(to)) return;
      // Land where the door you used says to land, not at the destination's
      // generic spawn — otherwise walking out of the room drops you 5.5m
      // away in the middle of the road.
      sfx.travel();
      const door = LOCATIONS[here]?.doors.find((d) => d.to === to);
      const landing = door?.arriveAt ?? null;
      setActiveProp(null);
      const arrive = () => {
        setArriveAt(landing);
        setHere(to);
      };
      if (reducedMotion) { arrive(); return; }
      setFading(true);
      window.setTimeout(() => {
        arrive();
        window.setTimeout(() => setFading(false), 40);
      }, 260);
    },
    [reducedMotion, here],
  );

  // An AudioContext made before a user gesture starts suspended and stays
  // silent. The world auto-loads with no click, so the first pointer or key
  // event is what brings sound up.
  const [sound, setSound] = useState(false);
  useEffect(() => {
    const go = () => {
      unlock();
      // Sync AFTER unlocking. isEnabled() is false until the gesture runs, so
      // reading it on mount left the icon showing muted while sound played.
      setSound(isEnabled());
    };
    window.addEventListener('pointerdown', go, { once: true });
    window.addEventListener('keydown', go, { once: true });
    return () => {
      window.removeEventListener('pointerdown', go);
      window.removeEventListener('keydown', go);
    };
  }, []);

  // Stop the render loop when the canvas is off screen.
  const stageRef = useRef<HTMLDivElement>(null);
  const [onScreen, setOnScreen] = useState(true);
  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { rootMargin: '120px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  if (gate.verdict === 'blocked') {
    return (
      <div className="world-blocked">
        <p>{gate.reason}</p>
        <p>
          Everything in the world is on <a href="/">the map</a> — it is a second way in, never the
          only one.
        </p>
        {gate.canRetry && (
          <p>
            <button type="button" className="world-retry" onClick={gate.retry}>Try the world anyway</button>
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="world-stage" ref={stageRef}>
      <Canvas
        frameloop={onScreen ? 'always' : 'never'}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        shadows="soft"
        dpr={[1, 1.75]}
        camera={{ position: [0, 4, 7], fov: 48, near: 0.1, far: 90 }}
        onCreated={() => setReady(true)}
        aria-hidden="true"
      >
        <FrameProbe onSlow={gate.reportSlow} />
        <Scene
          key={here}
          spec={spec}
          posts={posts}
          activeProp={activeProp}
          reducedMotion={reducedMotion}
          arriveAt={arriveAt}
          onOpen={open}
          onTravel={travel}
        />
      </Canvas>

      <button
        type="button"
        className="world-sound"
        aria-label={sound ? 'Mute sound' : 'Unmute sound'}
        aria-pressed={sound}
        onClick={() => {
          unlock();
          const next = !sound;
          setEnabled(next);
          setSound(next);
          if (next) sfx.open();
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M4 9v6h4l5 4V5L8 9H4z" />
          {sound ? (
            <>
              <path d="M16.5 8.5a5 5 0 0 1 0 7" />
              <path d="M19 6a8.5 8.5 0 0 1 0 12" />
            </>
          ) : (
            <path d="M17 9.5l5 5m0-5l-5 5" />
          )}
        </svg>
      </button>

      {fading && <div className="world-fade" />}

      {/* Travelling used to be silent and drop focus to <body>: a screen
          reader user lost their place and was told nothing about where they
          now were. This announces it. */}
      <p className="world-live" role="status" aria-live="polite">
        {ready ? (data.zones.find((z) => z.id === here)?.label ?? here) : ''}
      </p>

      {!ready && stalled && (
        <div className="world-loading">
          <p>
            This is taking longer than it should. The writing is all on{' '}
            <a href="/room/">ordinary pages</a>.
          </p>
        </div>
      )}

      {activeProp && <Panel prop={activeProp} posts={posts} onClose={close} />}
    </div>
  );
}
