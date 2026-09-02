import { useCallback, useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Room } from './Room';
import { FrameProbe } from './FrameProbe';
import { useDeviceGate } from './useDeviceGate';
import type { WorldData, WorldPost } from './types';

const PROPS: Record<string, { label: string; empty: string }> = {
  monitor: {
    label: 'The desk',
    empty: 'Nothing on the desk yet. This is where the IT writing goes.',
  },
  bookshelf: {
    label: 'The bookshelf',
    empty: 'No essays on the shelf yet. One spine appears here per published essay.',
  },
  screen: {
    label: 'The TV',
    empty: 'The TV shows live market data rather than posts. It gets wired up in stage 3.',
  },
  door: {
    label: 'The door',
    empty:
      'Locked for now. Outside is the street, the gym and Merdeka 118 — they get built once this room has five published posts behind it.',
  },
};

function Panel({
  prop,
  posts,
  onClose,
}: {
  prop: string;
  posts: WorldPost[];
  onClose: () => void;
}) {
  const meta = PROPS[prop];
  const items = posts.filter((p) => p.prop === prop);

  // Escape closes, and focus moves into the panel when it opens.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="world-panel" role="dialog" aria-modal="false" aria-label={meta.label}>
      <div className="world-panel-head">
        <h2>{meta.label}</h2>
        <button type="button" onClick={onClose} aria-label="Close panel">
          ✕
        </button>
      </div>

      {items.length === 0 ? (
        <p className="world-panel-empty">{meta.empty}</p>
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

export function World({ data }: { data: WorldData }) {
  const gate = useDeviceGate();
  const [activeProp, setActiveProp] = useState<string | null>(null);

  const reducedMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  const roomPosts = useMemo(
    () => data.posts.filter((p) => p.zone === 'room'),
    [data.posts],
  );

  // The room is built entirely from primitives — there is nothing to fetch,
  // so there is no load progress to report. drei's useProgress would sit at
  // 0% forever here. The overlay simply covers the canvas until the renderer
  // exists and the first frame is up. When real .glb assets arrive, this is
  // where Suspense + useProgress goes back in.
  const [ready, setReady] = useState(false);
  const [stalled, setStalled] = useState(false);

  // R3F only creates the renderer once its container has been measured with a
  // non-zero size. If that never happens — a zero-height container, a tab
  // backgrounded through the whole init — the overlay would sit there forever
  // with no way out. Give the visitor an exit instead of a spinner.
  useEffect(() => {
    if (ready) return;
    const t = window.setTimeout(() => setStalled(true), 12_000);
    return () => window.clearTimeout(t);
  }, [ready]);

  const open = useCallback((prop: string) => {
    setActiveProp((cur) => (cur === prop ? null : prop));
  }, []);

  if (gate.verdict === 'blocked') {
    return (
      <div className="world-blocked">
        <p>{gate.reason}</p>
        <p>
          Everything in the room is on <a href="/room/">the reading list</a> —
          the world is a second way in, never the only one.
        </p>
      </div>
    );
  }

  return (
    <div className="world-stage">
      <Canvas
        // WebGL2 only. WebGPU stays an opt-in swap — see AGENTS.md rule 4.
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        dpr={[1, 1.75]}
        camera={{ position: [0.1, 1.72, 5.15], fov: 48, near: 0.1, far: 80 }}
        onCreated={() => {
          // Lift the overlay as soon as the renderer exists.
          //
          // Do NOT wait on requestAnimationFrame here: rAF is paused in a
          // backgrounded tab, so anyone who opens this page in a background
          // tab would sit on "Building the room…" until they focused it.
          setReady(true);
        }}
      >
        <color attach="background" args={['#10141b']} />
        <FrameProbe onSlow={gate.reportSlow} />
        <Room
          posts={roomPosts}
          activeProp={activeProp}
          reducedMotion={reducedMotion}
          onOpen={open}
        />
      </Canvas>

      {!ready && (
        <div className="world-loading">
          {stalled ? (
            <p>
              The room is taking longer than it should. Everything in it is on{' '}
              <a href="/room/">the reading list</a>.
            </p>
          ) : (
            <span>Building the room…</span>
          )}
        </div>
      )}

      {activeProp && (
        <Panel prop={activeProp} posts={roomPosts} onClose={() => setActiveProp(null)} />
      )}
    </div>
  );
}
