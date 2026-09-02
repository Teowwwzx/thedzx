import { PALETTE } from '../palette';
import { Box, Floor, Panel } from '../prims';
import type { LocationSpec } from './spec';

/**
 * Outside — the street.
 *
 * The thesis made literal: every building is signed with the technology that
 * runs it. Merdeka 118 stands at the end of the road, which is where the
 * elevator to stages 5 lives.
 */
const SIGNS = [
  { x: -9, label: 'TCP/IP', color: '#8c4517' },
  { x: -5.5, label: 'SQL', color: '#2f6f66' },
  { x: -2, label: 'LINUX', color: '#54607a' },
  { x: 1.5, label: 'HTTP', color: '#8a6a2e' },
  { x: 5, label: 'DNS', color: '#6b3f52' },
];

function Scenery() {
  return (
    <>
      <Floor size={[34, 16]} color={PALETTE.road} position={[0, 0, 0]} />
      {/* pavements */}
      <Box position={[0, 0.08, -4.4]} size={[34, 0.16, 3.2]} color={PALETTE.kerb} />
      <Box position={[0, 0.08, 4.4]} size={[34, 0.16, 3.2]} color={PALETTE.kerb} />
      {/* centre line */}
      {Array.from({ length: 15 }, (_, i) => (
        <Panel
          key={i}
          position={[-14 + i * 2, 0.012, 0]}
          size={[1.1, 0.14]}
          color="#6b7789"
          rotation={[-Math.PI / 2, 0, 0]}
        />
      ))}

      {/* the block you just came out of */}
      <Box position={[-11.5, 2.6, -8]} size={[7, 5.2, 5]} color={PALETTE.building} />
      <Box position={[-8.1, 1.05, -5.6]} size={[0.2, 2.1, 1.1]} color={PALETTE.skirting} />
      <Panel position={[-7.98, 1.05, -5.6]} size={[1.0, 2.0]} color="#1b2028" rotation={[0, Math.PI / 2, 0]} />
      <Panel position={[-11.5, 3.6, -5.45]} size={[2.4, 0.5]} color={PALETTE.accent} />

      {/* the signed buildings */}
      {SIGNS.map((b, i) => {
        const h = 4.4 + (i % 3) * 1.6;
        return (
          <group key={b.label} position={[b.x, 0, -8.5]}>
            <Box position={[0, h / 2, 0]} size={[3, h, 5]} color={i % 2 ? PALETTE.buildingAlt : PALETTE.building} />
            {/* windows */}
            {Array.from({ length: Math.floor(h / 1.3) }, (_, r) => (
              <Panel
                key={r}
                position={[0, 0.9 + r * 1.3, 2.51]}
                size={[2.1, 0.5]}
                color={r % 3 === 0 ? PALETTE.screen : '#243040'}
              />
            ))}
            <Box position={[0, h + 0.28, 2.3]} size={[2.6, 0.56, 0.12]} color={b.color} />
          </group>
        );
      })}

      {/* far side of the street */}
      {[-10, -6, -2, 2, 6, 10].map((x, i) => (
        <Box
          key={x}
          position={[x, 3 + (i % 2), 9]}
          size={[3.4, 6 + (i % 2) * 2, 5]}
          color={i % 2 ? PALETTE.buildingAlt : PALETTE.building}
        />
      ))}

      {/* Merdeka 118 at the end of the road, with its lobby door */}
      <group position={[13.5, 0, -3]}>
        <Box position={[0, 9, 0]} size={[4, 18, 4]} color={PALETTE.tower} />
        <mesh position={[0, 20.5, 0]}>
          <coneGeometry args={[1.6, 5, 4]} />
          <meshLambertMaterial color={PALETTE.tower} flatShading />
        </mesh>
        <Box position={[0, 24.5, 0]} size={[0.16, 3, 0.16]} color={PALETTE.accentWarm} />
        {Array.from({ length: 11 }, (_, r) => (
          <Panel key={r} position={[-2.01, 2.4 + r * 1.5, 0]} size={[2.6, 0.6]} color="#26313f" rotation={[0, -Math.PI / 2, 0]} />
        ))}
        {/* lobby entrance */}
        <Box position={[-2.05, 1.15, 0]} size={[0.22, 2.3, 1.4]} color={PALETTE.skirting} />
        <Panel position={[-2.17, 1.15, 0]} size={[1.3, 2.2]} color={PALETTE.glass} rotation={[0, -Math.PI / 2, 0]} />
      </group>

      {/* the gym, across the road */}
      <group position={[-2, 0, 8.5]}>
        <Box position={[0, 2.2, 0]} size={[6, 4.4, 5]} color={PALETTE.buildingTrim} />
        <Box position={[0, 1.05, -2.55]} size={[1.3, 2.1, 0.2]} color={PALETTE.skirting} />
        <Panel position={[0, 1.05, -2.44]} size={[1.2, 2.0]} color="#1b2028" />
        <Box position={[0, 3.5, -2.5]} size={[3.2, 0.6, 0.14]} color="#2f6f66" />
      </group>

      {/* street furniture */}
      {[-10, -3, 4, 10].map((x) => (
        <group key={x} position={[x, 0, 4.0]}>
          <mesh position={[0, 1.7, 0]}>
            <cylinderGeometry args={[0.07, 0.09, 3.4, 8]} />
            <meshLambertMaterial color={PALETTE.deskLeg} flatShading />
          </mesh>
          <Box position={[0, 3.45, 0.35]} size={[0.3, 0.12, 0.8]} color={PALETTE.deskLeg} />
          <Panel position={[0, 3.38, 0.35]} size={[0.26, 0.7]} color={PALETTE.accentWarm} rotation={[Math.PI / 2, 0, 0]} />
        </group>
      ))}

      {/* night sky */}
      <mesh position={[0, 12, -30]}>
        <planeGeometry args={[90, 44]} />
        <meshBasicMaterial color={PALETTE.skyTop} />
      </mesh>
      <mesh position={[0, 1.5, -29.5]}>
        <planeGeometry args={[90, 6]} />
        <meshBasicMaterial color={PALETTE.skyHorizon} />
      </mesh>
    </>
  );
}

export const city: LocationSpec = {
  id: 'city',
  bounds: [-14.5, 14.5, -5.4, 5.4],
  spawn: [-7.5, 0],
  blockers: [
    [-11.5, -8, 3.5, 2.5],
    ...SIGNS.map((b) => [b.x, -8.5, 1.5, 2.5] as const),
    [13.5, -3, 2, 2],
    [-2, 8.5, 3, 2.5],
    [0, 9, 17, 2.5],
    // the lamp posts, which previously had no collider at all
    ...[-10, -3, 4, 10].map((x) => [x, 4.0, 0.16, 0.16] as const),
  ],
  hotspots: [{ prop: 'building', label: 'The street', position: [-2, 3.2, -5.4] }],
  doors: [
    { to: 'room', label: 'The Room', position: [-8.1, 1.05, -5.4], arriveAt: [2.4, 0.75] },
    { to: 'gym', label: 'The Gym', position: [-2, 1.05, 5.6], arriveAt: [0, 3.2] },
    { to: 'tower', label: 'Merdeka 118', position: [11.3, 1.15, -3], arriveAt: [0, 3.0] },
  ],
  frameWidth: 15,
  ambience: '#0d1119',
  Scenery,
};
