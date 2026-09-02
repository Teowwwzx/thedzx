import { Component, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { PerspectiveCamera, Vector3, type Group } from 'three';
import type { ZoneId } from '../consts';
import { LOCATIONS, HAS_WORLD } from './locations';
import type { LocationSpec } from './locations/spec';
import { Character } from './Character';
import { useCharacter } from './useCharacter';
import { FrameProbe } from './FrameProbe';
import { useDeviceGate } from './useDeviceGate';
import { MarketPanel } from './MarketPanel';
import { PALETTE } from './palette';
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
}: {
  position: readonly [number, number, number];
  label: string;
  count: number | null;
  active: boolean;
  near: boolean;
  reducedMotion: boolean;
  onOpen: () => void;
  dataProp: string;
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
        <button
          type="button"
          className={`hotspot-label${active ? ' is-active' : ''}${near ? ' is-near' : ''}`}
          data-prop={dataProp}
          aria-expanded={active}
          onClick={onOpen}
        >
          {label}
          {count !== null && <span className="hotspot-count">{count}</span>}
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
  onOpen,
  onTravel,
}: {
  spec: LocationSpec;
  posts: WorldPost[];
  activeProp: string | null;
  reducedMotion: boolean;
  onOpen: (prop: string) => void;
  onTravel: (to: ZoneId) => void;
}) {
  const rig = useRef<Group>(null);
  const { position, moving, walkTo } = useCharacter(rig, spec.bounds, spec.blockers, spec.spawn);
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
    if (best !== nearest) setNearest(best);
  });

  const countFor = (prop: string) => posts.filter((p) => p.prop === prop).length;

  return (
    <>
      <color attach="background" args={[spec.ambience]} />
      <fog attach="fog" args={[spec.ambience, 14, 46]} />

      <ambientLight intensity={1.1} />
      <hemisphereLight args={['#b9c9e2', '#3a2f26', 1.4]} />
      <directionalLight position={[3.5, 6, 4]} intensity={1.4} />

      <spec.Scenery />
      <FloorTarget spec={spec} onWalk={walkTo} />

      <group ref={rig}>
        <Character moving={moving} reducedMotion={reducedMotion} />
      </group>
      <FollowCam target={position} reducedMotion={reducedMotion} frameWidth={spec.frameWidth} />

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
  const [activeProp, setActiveProp] = useState<string | null>(null);
  const [fading, setFading] = useState(false);
  const [ready, setReady] = useState(false);
  const [stalled, setStalled] = useState(false);
  const opener = useRef<string | null>(null);

  const spec = LOCATIONS[here];
  const posts = useMemo(() => data.posts.filter((p) => p.zone === here), [data.posts, here]);

  useEffect(() => {
    if (ready) return;
    const t = window.setTimeout(() => setStalled(true), 12_000);
    return () => window.clearTimeout(t);
  }, [ready]);

  const open = useCallback((prop: string) => {
    setActiveProp((cur) => {
      if (cur === prop) return null;
      opener.current = prop;
      return prop;
    });
  }, []);

  const close = useCallback(() => {
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
      setActiveProp(null);
      if (reducedMotion) { setHere(to); return; }
      setFading(true);
      window.setTimeout(() => {
        setHere(to);
        window.setTimeout(() => setFading(false), 40);
      }, 260);
    },
    [reducedMotion],
  );

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
        dpr={[1, 1.75]}
        camera={{ position: [0, 4, 7], fov: 48, near: 0.1, far: 90 }}
        onCreated={() => setReady(true)}
      >
        <FrameProbe onSlow={gate.reportSlow} />
        <Scene
          key={here}
          spec={spec}
          posts={posts}
          activeProp={activeProp}
          reducedMotion={reducedMotion}
          onOpen={open}
          onTravel={travel}
        />
      </Canvas>

      <div className="world-hud">
        <span className="world-hud-where">{data.zones.find((z) => z.id === here)?.label ?? here}</span>
      </div>
      <span className="world-hud-hint">Tap the floor to walk · WASD on a keyboard</span>

      {fading && <div className="world-fade" />}

      {!ready && (
        <div className="world-loading">
          {stalled ? (
            <p>Taking longer than it should. Everything is on <a href="/">the map</a>.</p>
          ) : (
            <span>Building the world…</span>
          )}
        </div>
      )}

      {activeProp && <Panel prop={activeProp} posts={posts} onClose={close} />}
    </div>
  );
}
