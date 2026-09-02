import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { PALETTE } from './palette';

/**
 * The player. A greybox person: capsule torso, box limbs, no rig, no
 * animation clips. The legs swing on a sine wave while moving, which is
 * enough to read as walking at this scale and costs no asset budget.
 *
 * When a real character lands (Mixamo, Ready Player Me), this component is
 * the only thing that changes — the controller in useCharacter.ts does not
 * know or care what it is moving.
 */
export function Character({ moving, reducedMotion }: { moving: boolean; reducedMotion: boolean }) {
  const legL = useRef<Group>(null);
  const legR = useRef<Group>(null);
  const armL = useRef<Group>(null);
  const armR = useRef<Group>(null);

  useFrame((state) => {
    const swing = moving && !reducedMotion ? Math.sin(state.clock.elapsedTime * 9) * 0.55 : 0;
    if (legL.current) legL.current.rotation.x = swing;
    if (legR.current) legR.current.rotation.x = -swing;
    if (armL.current) armL.current.rotation.x = -swing * 0.7;
    if (armR.current) armR.current.rotation.x = swing * 0.7;
  });

  return (
    <group>
      {/* legs — pivot at the hip so they swing rather than slide */}
      <group ref={legL} position={[-0.1, 0.46, 0]}>
        <mesh position={[0, -0.23, 0]}>
          <boxGeometry args={[0.15, 0.46, 0.16]} />
          <meshLambertMaterial color={PALETTE.charLegs} flatShading />
        </mesh>
      </group>
      <group ref={legR} position={[0.1, 0.46, 0]}>
        <mesh position={[0, -0.23, 0]}>
          <boxGeometry args={[0.15, 0.46, 0.16]} />
          <meshLambertMaterial color={PALETTE.charLegs} flatShading />
        </mesh>
      </group>

      {/* torso */}
      <mesh position={[0, 0.75, 0]} castShadow>
        <boxGeometry args={[0.38, 0.56, 0.22]} />
        <meshLambertMaterial color={PALETTE.charShirt} flatShading />
      </mesh>
      <mesh position={[0, 1.02, 0]} castShadow>
        <boxGeometry args={[0.4, 0.08, 0.24]} />
        <meshLambertMaterial color={PALETTE.accent} flatShading />
      </mesh>

      {/* arms */}
      <group ref={armL} position={[-0.245, 0.95, 0]}>
        <mesh position={[0, -0.22, 0]}>
          <boxGeometry args={[0.11, 0.44, 0.13]} />
          <meshLambertMaterial color={PALETTE.charShirt} flatShading />
        </mesh>
      </group>
      <group ref={armR} position={[0.245, 0.95, 0]}>
        <mesh position={[0, -0.22, 0]}>
          <boxGeometry args={[0.11, 0.44, 0.13]} />
          <meshLambertMaterial color={PALETTE.charShirt} flatShading />
        </mesh>
      </group>

      {/* head */}
      <mesh position={[0, 1.19, 0]} castShadow>
        <boxGeometry args={[0.25, 0.26, 0.24]} />
        <meshLambertMaterial color={PALETTE.charSkin} flatShading />
      </mesh>
      {/*
        THE FACE POINTS +Z. This is load-bearing, not cosmetic.

        useCharacter orients the rig with `atan2(vx, vz)`, which aims the
        model's +Z axis along the direction of travel. The fringe used to sit
        at -Z, so the face pointed backwards and the character walked
        everywhere in reverse. If you re-model the head, keep the front on +Z.
      */}
      <mesh position={[0, 1.3, 0.02]}>
        <boxGeometry args={[0.27, 0.09, 0.24]} />
        <meshLambertMaterial color={PALETTE.charHair} flatShading />
      </mesh>
      <mesh position={[0, 1.24, 0.005]}>
        <boxGeometry args={[0.26, 0.06, 0.25]} />
        <meshLambertMaterial color={PALETTE.charHair} flatShading />
      </mesh>
      {/* eyes, so which way it faces is unmistakable at any distance */}
      {[-0.055, 0.055].map((x) => (
        <mesh key={x} position={[x, 1.19, 0.121]}>
          <boxGeometry args={[0.035, 0.045, 0.01]} />
          <meshBasicMaterial color="#20242c" />
        </mesh>
      ))}
    </group>
  );
}
