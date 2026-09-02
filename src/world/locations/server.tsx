import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh, MeshBasicMaterial } from 'three';
import { PALETTE } from '../palette';
import { Box, Floor, Panel, WallWithHole } from '../prims';
import type { LocationSpec } from './spec';

/** The Server Room — the thesis, the homelab, the infrastructure. */
function Leds({ x, z, seed }: { x: number; z: number; seed: number }) {
  const ref = useRef<Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const m = ref.current.material as MeshBasicMaterial;
    const t = Math.sin(state.clock.elapsedTime * (2 + seed) + seed * 3);
    m.color.set(t > 0.4 ? PALETTE.led : t < -0.7 ? PALETTE.ledWarn : '#1e2a30');
  });
  return (
    <mesh ref={ref} position={[x, 0, z]}>
      <boxGeometry args={[0.05, 0.05, 0.02]} />
      <meshBasicMaterial color={PALETTE.led} />
    </mesh>
  );
}

function Rack({ x }: { x: number }) {
  return (
    <group position={[x, 0, -2.2]}>
      <Box position={[0, 1.05, 0]} size={[0.9, 2.1, 0.85]} color={PALETTE.rackMetal} />
      <Panel position={[0, 1.05, 0.431]} size={[0.78, 1.95]} color={PALETTE.rackFace} />
      {Array.from({ length: 9 }, (_, i) => (
        <group key={i} position={[0, 0.28 + i * 0.2, 0.44]}>
          <Box position={[0, 0, 0]} size={[0.74, 0.15, 0.03]} color="#2f3540" />
          <Leds x={-0.28} z={0.02} seed={i + x} />
          <Leds x={-0.2} z={0.02} seed={i * 1.7 + x} />
        </group>
      ))}
    </group>
  );
}

function Scenery() {
  return (
    <>
      <Floor size={[9, 7]} color={PALETTE.rackFace} />
      <mesh position={[0, 2.6, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[9, 7]} />
        <meshLambertMaterial color="#171b22" />
      </mesh>
      <Box position={[0, 1.3, -3.5]} size={[9, 2.6, 0.14]} color="#272d36" />
      <Box position={[-4.5, 1.3, 0]} size={[0.14, 2.6, 7]} color="#272d36" />
      <Box position={[4.5, 1.3, 0]} size={[0.14, 2.6, 7]} color="#272d36" />
      <WallWithHole
        axis="z"
        at={3.5}
        span={[-4.5, 4.5]}
        height={2.6}
        hole={{ a0: -0.6, a1: 0.6, y0: 0, y1: 2 }}
        color="#272d36"
      />

      {[-3, -1.4, 0.2, 1.8, 3.4].map((x) => (
        <Rack key={x} x={x} />
      ))}

      {/* raised-floor grille, cable trays, and one lonely terminal */}
      {Array.from({ length: 5 }, (_, i) => (
        <Panel
          key={i}
          position={[-3.4 + i * 1.7, 0.011, 0.6]}
          size={[1.4, 1.4]}
          color="#1d222a"
          rotation={[-Math.PI / 2, 0, 0]}
        />
      ))}
      <Box position={[0, 2.45, -1.2]} size={[8, 0.08, 0.3]} color="#333b47" />

      <group position={[3.4, 0, 1.9]}>
        <Box position={[0, 0.72, 0]} size={[1.1, 0.06, 0.6]} color={PALETTE.deskLeg} />
        <Box position={[-0.5, 0.36, 0]} size={[0.06, 0.72, 0.55]} color={PALETTE.deskLeg} />
        <Box position={[0.5, 0.36, 0]} size={[0.06, 0.72, 0.55]} color={PALETTE.deskLeg} />
        <Box position={[0, 1.05, -0.2]} size={[0.7, 0.42, 0.04]} color={PALETTE.tvBody} />
        <Panel position={[0, 1.05, -0.177]} size={[0.64, 0.36]} color="#1c3a2f" />
      </group>
    </>
  );
}

export const server: LocationSpec = {
  id: 'server',
  bounds: [-4.3, 4.3, -3.3, 3.3],
  spawn: [0, 2.6],
  blockers: [
    ...[-3, -1.4, 0.2, 1.8, 3.4].map((x) => [x, -2.2, 0.5, 0.45] as const),
    [3.4, 1.9, 0.6, 0.35],
  ],
  hotspots: [{ prop: 'rack', label: 'The racks', position: [0.2, 2.35, -2.2] }],
  doors: [{ to: 'room', label: 'Back up the hatch', position: [0, 1.0, 3.5], arriveAt: [0.5, 1.6] }],
  frameWidth: 9,
  ambience: '#0a0d12',
  Scenery,
};
