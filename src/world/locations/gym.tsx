import { PALETTE } from '../palette';
import { Box, Floor, Panel, WallWithHole } from '../prims';
import type { LocationSpec } from './spec';

/** The Gym — discipline, habits, the mindset that carries everything else. */
function Rack({ x }: { x: number }) {
  return (
    <group position={[x, 0, -2.6]}>
      <Box position={[-0.55, 1.1, 0]} size={[0.12, 2.2, 0.12]} color={PALETTE.rubber} />
      <Box position={[0.55, 1.1, 0]} size={[0.12, 2.2, 0.12]} color={PALETTE.rubber} />
      <Box position={[0, 1.45, 0]} size={[1.22, 0.08, 0.08]} color={PALETTE.steel} />
      <Box position={[0, 0.06, 0.3]} size={[1.3, 0.12, 0.9]} color={PALETTE.gymMat} />
      {/* loaded bar */}
      <Box position={[0, 1.45, 0.34]} size={[1.9, 0.05, 0.05]} color={PALETTE.steel} />
      {[-0.78, 0.78].map((o) => (
        <mesh key={o} position={[o, 1.45, 0.34]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.24, 0.24, 0.09, 14]} />
          <meshLambertMaterial color={PALETTE.rubber} flatShading />
        </mesh>
      ))}
    </group>
  );
}

function Scenery() {
  return (
    <>
      <Floor size={[12, 9]} color={PALETTE.gymFloor} />
      <mesh position={[0, 3.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12, 9]} />
        <meshLambertMaterial color={PALETTE.ceiling} />
      </mesh>

      <Box position={[0, 1.6, -4.5]} size={[12, 3.2, 0.14]} color={PALETTE.wall} />
      <Box position={[-6, 1.6, 0]} size={[0.14, 3.2, 9]} color={PALETTE.wall} />
      <Box position={[6, 1.6, 0]} size={[0.14, 3.2, 9]} color={PALETTE.wall} />
      <WallWithHole
        axis="z"
        at={4.5}
        span={[-6, 6]}
        height={3.2}
        hole={{ a0: -0.65, a1: 0.65, y0: 0, y1: 2.1 }}
        color={PALETTE.wall}
      />

      {/* mirror wall — a flat panel, not a real reflection: this is a greybox */}
      <Panel position={[-5.9, 1.7, 0]} size={[7.6, 2.2]} color="#54637a" rotation={[0, Math.PI / 2, 0]} />
      <Box position={[-5.87, 0.58, 0]} size={[0.04, 0.06, 7.6]} color={PALETTE.steel} />
      <Box position={[-5.87, 2.82, 0]} size={[0.04, 0.06, 7.6]} color={PALETTE.steel} />

      <Rack x={-3} />
      <Rack x={0} />

      {/* dumbbell rack */}
      <group position={[3.6, 0, -3.9]}>
        <Box position={[0, 0.45, 0]} size={[2.4, 0.1, 0.5]} color={PALETTE.steel} />
        <Box position={[0, 0.9, -0.16]} size={[2.4, 0.1, 0.5]} color={PALETTE.steel} />
        {Array.from({ length: 6 }, (_, i) => (
          <group key={i} position={[-1 + i * 0.4, 0.58, 0.05]}>
            <Box position={[0, 0, 0]} size={[0.1, 0.1, 0.34]} color={PALETTE.rubber} />
            <Box position={[0, 0, -0.19]} size={[0.19, 0.19, 0.1]} color={PALETTE.rubber} />
            <Box position={[0, 0, 0.19]} size={[0.19, 0.19, 0.1]} color={PALETTE.rubber} />
          </group>
        ))}
      </group>

      {/* bench */}
      <group position={[2.6, 0, 0.4]}>
        <Box position={[0, 0.44, 0]} size={[0.42, 0.12, 1.5]} color={PALETTE.gymMat} />
        <Box position={[0, 0.19, -0.6]} size={[0.14, 0.38, 0.14]} color={PALETTE.rubber} />
        <Box position={[0, 0.19, 0.6]} size={[0.14, 0.38, 0.14]} color={PALETTE.rubber} />
      </group>

      {/* treadmill */}
      <group position={[-3.4, 0, 2.4]}>
        <Box position={[0, 0.18, 0]} size={[0.8, 0.16, 1.9]} color={PALETTE.rubber} />
        <Panel position={[0, 0.27, 0]} size={[0.62, 1.5]} color="#191c22" rotation={[-Math.PI / 2, 0, 0]} />
        <Box position={[-0.36, 0.72, -0.7]} size={[0.07, 0.95, 0.07]} color={PALETTE.steel} />
        <Box position={[0.36, 0.72, -0.7]} size={[0.07, 0.95, 0.07]} color={PALETTE.steel} />
        <Box position={[0, 1.2, -0.72]} size={[0.8, 0.34, 0.08]} color={PALETTE.tvBody} />
        <Panel position={[0, 1.2, -0.67]} size={[0.68, 0.26]} color={PALETTE.screen} />
      </group>

      {/* floor mat */}
      <Panel position={[0.6, 0.011, 2.6]} size={[2.4, 1.6]} color={PALETTE.gymMat} rotation={[-Math.PI / 2, 0, 0]} />

      {/* clock — discipline is a time thing */}
      <mesh position={[0, 2.5, -4.4]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.34, 0.34, 0.07, 20]} />
        <meshLambertMaterial color={PALETTE.steel} flatShading />
      </mesh>
      <Panel position={[0, 2.5, -4.35]} size={[0.54, 0.54]} color="#e8eef6" />
    </>
  );
}

export const gym: LocationSpec = {
  id: 'gym',
  bounds: [-5.8, 5.8, -4.3, 4.3],
  spawn: [0, 3.2],
  blockers: [
    [-3, -2.5, 0.75, 0.9],
    [0, -2.5, 0.75, 0.9],
    [3.6, -3.9, 1.3, 0.5],
    [2.6, 0.4, 0.4, 0.9],
    [-3.4, 2.4, 0.55, 1.1],
  ],
  hotspots: [
    { prop: 'rack', label: 'The rack', position: [-1.5, 2.1, -2.6] },
    { prop: 'treadmill', label: 'Treadmill', position: [-3.4, 1.75, 2.4] },
  ],
  doors: [{ to: 'city', label: 'Outside', position: [0, 1.05, 4.5], arriveAt: [-2, 3.6] }],
  frameWidth: 9.5,
  ambience: '#12161d',
  Scenery,
};
