import { useMemo } from 'react';
import { PALETTE } from './palette';

/**
 * Kuala Lumpur at dusk, seen through the window.
 *
 * Sized and placed to be visible ONLY through the 1.2m x 1.1m opening. An
 * earlier version used a 46m-wide backdrop, which leaked orange sky through
 * every seam in the back wall. Everything here stays inside a narrow cone
 * behind the window, so a gap in the wall shows nothing.
 *
 * Merdeka 118 is in there, tallest and furthest back. It is the only building
 * with its own silhouette, because in stage 5 it becomes somewhere you can
 * actually go — this is the establishing shot for that.
 *
 * Local origin is the middle of the window opening, at floor level.
 */

/** Deterministic — no Math.random, so every visitor sees the same city. */
const HEIGHTS = [1.5, 2.6, 1.1, 3.1, 1.9, 1.35, 2.25, 1.65, 2.85, 1.2];

export function Skyline() {
  const buildings = useMemo(
    () =>
      HEIGHTS.map((h, i) => {
        const near = i % 2 === 0;
        return {
          x: -4.4 + i * 0.95 + (near ? 0.22 : -0.15),
          z: near ? -5.5 : -8,
          w: near ? 0.62 : 0.8,
          h: h * (near ? 1 : 1.4),
          d: 0.7,
          near,
        };
      }),
    [],
  );

  return (
    <group>
      {/* Dusk sky. Only as wide as the window can possibly reveal. */}
      <mesh position={[0, 2.6, -11]}>
        <planeGeometry args={[13, 9]} />
        <meshBasicMaterial color={PALETTE.skyTop} />
      </mesh>
      <mesh position={[0, -1.1, -10.8]}>
        <planeGeometry args={[13, 4.2]} />
        <meshBasicMaterial color={PALETTE.skyHorizon} />
      </mesh>

      {buildings.map((b, i) => (
        <mesh key={i} position={[b.x, b.h / 2 - 1.1, b.z]}>
          <boxGeometry args={[b.w, b.h, b.d]} />
          <meshBasicMaterial color={b.near ? PALETTE.cityNear : PALETTE.cityFar} />
        </mesh>
      ))}

      {/* Merdeka 118 — stage 5 lives on its top two floors. */}
      <group position={[1.15, 0, -9]}>
        <mesh position={[0, 2.1, 0]}>
          <boxGeometry args={[0.8, 6.4, 0.8]} />
          <meshBasicMaterial color={PALETTE.tower} />
        </mesh>
        <mesh position={[0, 6.3, 0]}>
          <coneGeometry args={[0.4, 2.2, 4]} />
          <meshBasicMaterial color={PALETTE.tower} />
        </mesh>
        <mesh position={[0, 7.6, 0]}>
          <boxGeometry args={[0.06, 0.9, 0.06]} />
          <meshBasicMaterial color={PALETTE.accentWarm} />
        </mesh>
      </group>
    </group>
  );
}
