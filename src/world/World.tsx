import { Component, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
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

/**
 * Without this, a render-time throw anywhere in the world unmounts the whole
 * tree and leaves an empty box on the page. The room is optional; the reading
 * list is not, so failure has to land somewhere useful.
 */
export class WorldErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
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
          <p>The room stopped working.</p>
          <p>
            Everything in it is on <a href="/room/">the reading list</a> — the
            world is a second way in, never the only one.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

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
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Escape closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Actually move focus in. Announcing role="dialog" while leaving focus on
  // the hotspot button behind it tells a screen reader a dialog opened and
  // then strands the user outside it.
  useEffect(() => {
    headingRef.current?.focus();
  }, [prop]);

  return (
    <div className="world-panel" role="dialog" aria-modal="false" aria-label={meta.label}>
      <div className="world-panel-head">
        <h2 ref={headingRef} tabIndex={-1}>
          {meta.label}
        </h2>
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

  // Reactive: a useMemo with an empty dep array reads the preference once and
  // never notices the user changing it mid-session.
  const reducedMotion = useReducedMotion();

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

  // Remember which hotspot opened the panel so focus can go back to it.
  // Closing otherwise destroys the focused element and drops focus to <body>,
  // sending a keyboard user back to the top of the document.
  const opener = useRef<string | null>(null);

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
      const btn = document.querySelector<HTMLButtonElement>(
        `.hotspot-label[data-prop="${id}"]`,
      );
      btn?.focus();
    });
  }, []);

  // A static greybox does not need to re-render 60 times a second forever.
  // Stop the loop when the canvas scrolls out of view.
  const stageRef = useRef<HTMLDivElement>(null);
  const [onScreen, setOnScreen] = useState(true);
  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), {
      rootMargin: '120px',
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  if (gate.verdict === 'blocked') {
    return (
      <div className="world-blocked">
        <p>{gate.reason}</p>
        <p>
          Everything in the room is on <a href="/room/">the reading list</a> —
          the world is a second way in, never the only one.
        </p>
        {gate.canRetry && (
          <p>
            <button type="button" className="world-retry" onClick={gate.retry}>
              Try the room anyway
            </button>
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="world-stage" ref={stageRef}>
      <Canvas
        frameloop={onScreen ? 'always' : 'never'}
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
        <Panel prop={activeProp} posts={roomPosts} onClose={close} />
      )}
    </div>
  );
}
