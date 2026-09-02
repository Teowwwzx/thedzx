import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Object3D, type InstancedMesh } from 'three';
import { PALETTE } from '../palette';
import { Box, Floor, Glow, Panel } from '../prims';
import type { LocationSpec } from './spec';

/** The Server Room — the thesis, the homelab, the infrastructure. */

const RACK_X = [-3, -1.4, 0.2, 1.8, 3.4];
const ROWS = 9;

/**
 * Every LED in the room, as ONE instanced mesh.
 *
 * The first version was 90 separate meshes, each with its own geometry,
 * material and useFrame subscription, and each parsing a CSS colour string
 * from scratch on every frame. This is one draw call, one material, one
 * callback, and three Color objects allocated once.
 */
function Leds() {
  const ref = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const colors = useMemo(
    () => ({ on: new Color(PALETTE.led), warn: new Color(PALETTE.ledWarn), off: new Color('#1e2a30') }),
    [],
  );
  const seeds = useMemo(() => {
    const out: { x: number; y: number; z: number; seed: number }[] = [];
    RACK_X.forEach((rx, r) => {
      for (let i = 0; i < ROWS; i++) {
        out.push({ x: rx - 0.28, y: 0.28 + i * 0.2, z: -1.74, seed: i + r * 1.7 });
        out.push({ x: rx - 0.2, y: 0.28 + i * 0.2, z: -1.74, seed: i * 1.7 + r });
      }
    });
    return out;
  }, []);

  useFrame((state) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = state.clock.elapsedTime;
    seeds.forEach((led, i) => {
      dummy.position.set(led.x, led.y, led.z);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      const v = Math.sin(t * (2 + led.seed * 0.3) + led.seed * 3);
      mesh.setColorAt(i, v > 0.4 ? colors.on : v < -0.7 ? colors.warn : colors.off);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, seeds.length]}>
      <boxGeometry args={[0.05, 0.05, 0.02]} />
      <meshBasicMaterial />
    </instancedMesh>
  );
}

function Rack({ x }: { x: number }) {
  return (
    <group position={[x, 0, -2.2]}>
      <Box position={[0, 1.05, 0]} size={[0.9, 2.1, 0.85]} color={PALETTE.rackMetal} />
      <Panel position={[0, 1.05, 0.431]} size={[0.78, 1.95]} color={PALETTE.rackFace} />
      {Array.from({ length: ROWS }, (_, i) => (
        <Box key={i} position={[0, 0.28 + i * 0.2, 0.44]} size={[0.74, 0.15, 0.03]} color="#2f3540" />
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
      {/* Open on +z. A solid wall here would stand between the camera
          and the player, hiding them behind its outside face over about
          a third of the floor. What is left is a free-standing frame, so
          the way out still reads as a door. */}
      <Box position={[-0.68, 1.05, 3.5]} size={[0.16, 2.1, 0.16]} color={"#272d36"} />
      <Box position={[0.68, 1.05, 3.5]} size={[0.16, 2.1, 0.16]} color={"#272d36"} />
      <Box position={[0, 2.16, 3.5]} size={[1.52, 0.14, 0.16]} color={"#272d36"} />

      {RACK_X.map((x) => (
        <Rack key={x} x={x} />
      ))}
      <Leds />

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
        <Glow position={[0, 1.05, -0.177]} size={[0.64, 0.36]} color="#3fae86" intensity={0.9} />
      </group>
    </>
  );
}

export const server: LocationSpec = {
  id: 'server',
  bounds: [-4.3, 4.3, -3.3, 3.3],
  spawn: [0, 2.6],
  blockers: [
    ...RACK_X.map((x) => [x, -2.2, 0.5, 0.45] as const),
    [3.4, 1.9, 0.6, 0.35],
  ],
  hotspots: [{ prop: 'rack', label: 'The racks', position: [0.2, 2.35, -2.2] }],
  doors: [{ to: 'room', label: 'Back up the hatch', position: [0, 1.0, 3.5], arriveAt: [0.5, 1.6] }],
  frameWidth: 9,
  ambience: '#0a0d12',
  Scenery,
};
