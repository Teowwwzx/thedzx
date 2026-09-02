import { PALETTE } from '../palette';
import { Box, Floor, Panel, WallWithHole, VOID_COLOR } from '../prims';
import type { LocationSpec } from './spec';

/**
 * Merdeka 118 — the top.
 *
 * The whole navigation argument in one room. Level 116 faces OUT at the
 * horizon: that is the macro view. Level 118 looks straight DOWN at
 * individual streets: that is the micro view. Being higher and seeing further
 * is already what "macro" means, so the altitude explains itself and the
 * place needs no menu.
 *
 * Both decks are modelled as one floor with two windows, because walking two
 * storeys is not the point — looking in two directions is.
 *
 * FACTS, kept honest: the tower is 678.9 m over 118 storeys, second-tallest
 * in the world. The observation decks are Levels 116 and 118 (there is no
 * Level 115 deck). Much of it was still closed to the public as of mid-2026,
 * so this is stylised and claims no first-hand detail.
 */
function CityBelow() {
  const blocks = [
    [-6, -2.2, 1.4], [-3.6, -3.4, 2.1], [-1.2, -2.6, 1.1], [1.4, -3.8, 2.6],
    [3.8, -2.4, 1.5], [6.2, -3.2, 1.9], [-4.8, -5.6, 2.4], [0.2, -6.2, 3.1],
    [4.6, -5.8, 2.2], [-2.4, -8.4, 1.7], [2.8, -8.8, 2.4],
  ] as const;
  return (
    <group>
      <mesh position={[0, -12, -6]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[40, 34]} />
        <meshBasicMaterial color="#0b1017" />
      </mesh>
      {blocks.map(([x, z, h], i) => (
        <group key={i} position={[x * 1.5, -12 + h / 2, z * 1.5]}>
          <mesh>
            <boxGeometry args={[1.5, h, 1.5]} />
            <meshBasicMaterial color={i % 2 ? PALETTE.cityNear : PALETTE.cityFar} />
          </mesh>
          <mesh position={[0, h / 2 + 0.02, 0]}>
            <boxGeometry args={[1.5, 0.04, 1.5]} />
            <meshBasicMaterial color={PALETTE.accent} />
          </mesh>
        </group>
      ))}
      {/* streets, lit */}
      {[-9, -3, 3, 9].map((x) => (
        <mesh key={x} position={[x, -11.96, -9]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.5, 30]} />
          <meshBasicMaterial color="#3a4a5e" />
        </mesh>
      ))}
    </group>
  );
}

function Scenery() {
  return (
    <>
      <Floor size={[9, 8]} color={PALETTE.towerFloor} />
      <mesh position={[0, 3, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[9, 8]} />
        <meshLambertMaterial color={PALETTE.ceiling} />
      </mesh>

      {/* L116 — the macro window, facing out at the horizon */}
      <WallWithHole
        axis="z"
        at={-4}
        span={[-4.5, 4.5]}
        height={3}
        hole={{ a0: -3.2, a1: 3.2, y0: 0.35, y1: 2.5 }}
        color={PALETTE.towerWall}
      />
      <Panel position={[0, 1.42, -4.02]} size={[6.4, 2.15]} color={PALETTE.glass} />
      {[-1.6, 0, 1.6].map((x) => (
        <Box key={x} position={[x, 1.42, -4.04]} size={[0.06, 2.15, 0.05]} color={PALETTE.skirting} />
      ))}

      {/* L118 — the micro window, in the FLOOR. You look down. */}
      <Box position={[0, 0.02, 2.6]} size={[3.4, 0.04, 2.2]} color={PALETTE.glass} />
      <Box position={[-1.75, 0.06, 2.6]} size={[0.12, 0.12, 2.3]} color={PALETTE.steel} />
      <Box position={[1.75, 0.06, 2.6]} size={[0.12, 0.12, 2.3]} color={PALETTE.steel} />
      <Box position={[0, 0.06, 1.45]} size={[3.6, 0.12, 0.12]} color={PALETTE.steel} />
      <Box position={[0, 0.06, 3.75]} size={[3.6, 0.12, 0.12]} color={PALETTE.steel} />
      <group position={[0, 0, 2.6]}>
        <CityBelow />
      </group>

      <Box position={[-4.5, 1.5, 0]} size={[0.14, 3, 8]} color={PALETTE.towerWall} />
      <Box position={[4.5, 1.5, 0]} size={[0.14, 3, 8]} color={PALETTE.towerWall} />
      <WallWithHole
        axis="z"
        at={4}
        span={[-4.5, 4.5]}
        height={3}
        hole={{ a0: -0.7, a1: 0.7, y0: 0, y1: 2.1 }}
        color={PALETTE.towerWall}
      />

      {/* the horizon beyond the macro window */}
      <mesh position={[0, 3, -22]}>
        <planeGeometry args={[46, 20]} />
        <meshBasicMaterial color={PALETTE.skyTop} />
      </mesh>
      <mesh position={[0, -3.4, -21.6]}>
        <planeGeometry args={[46, 8]} />
        <meshBasicMaterial color={PALETTE.skyHorizon} />
      </mesh>
      {Array.from({ length: 16 }, (_, i) => (
        <mesh key={i} position={[-11 + i * 1.5, -1.2 + (i % 3) * 0.5, -18]}>
          <boxGeometry args={[0.9, 2.6 + (i % 4), 0.9]} />
          <meshBasicMaterial color={i % 2 ? PALETTE.cityFar : PALETTE.cityNear} />
        </mesh>
      ))}
      {/* shroud, so nothing shows above the wall */}
      <Box position={[0, 9, -4.2]} size={[40, 12, 0.1]} color={VOID_COLOR} />

      {/* two plaques, which is where the argument lives */}
      <Box position={[-2.6, 1.15, -3.85]} size={[0.9, 0.24, 0.04]} color={PALETTE.accent} />
      <Box position={[0, 1.0, 1.3]} size={[0.9, 0.04, 0.24]} color={PALETTE.accentWarm} rotation={[0, 0, 0]} />

      {/* a bench to sit and look */}
      <Box position={[0, 0.44, -2.6]} size={[2.4, 0.1, 0.45]} color={PALETTE.crate} />
      <Box position={[-1.0, 0.2, -2.6]} size={[0.12, 0.38, 0.4]} color={PALETTE.deskLeg} />
      <Box position={[1.0, 0.2, -2.6]} size={[0.12, 0.38, 0.4]} color={PALETTE.deskLeg} />
    </>
  );
}

export const tower: LocationSpec = {
  id: 'tower',
  bounds: [-4.3, 4.3, -3.8, 3.8],
  spawn: [0, 3.0],
  blockers: [[0, -2.6, 1.2, 0.24]],
  hotspots: [
    { prop: 'window-116', label: 'Level 116 · macro', position: [-2.6, 2.2, -3.9] },
    { prop: 'window-118', label: 'Level 118 · micro', position: [0, 1.5, 2.6] },
  ],
  doors: [{ to: 'city', label: 'Down to the street', position: [0, 1.05, 4], arriveAt: [11, -3] }],
  frameWidth: 9.5,
  ambience: '#0c1017',
  Scenery,
};
