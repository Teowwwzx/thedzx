import { PALETTE } from '../palette';
import { Box, Floor, Panel, WallWithHole, VOID_COLOR } from '../prims';
import { Skyline } from '../Skyline';
import { TvScreen } from '../TvScreen';
import type { LocationSpec } from './spec';

/**
 * The Room — where it started. IT knowledge on the desk, essays on the shelf,
 * the markets on the TV, and a door that now actually opens.
 *
 *   x: -3.05 .. 3.05    z: -2.05 .. 2.45    ceiling 2.8
 */
const WIN = { a0: 0.5, a1: 1.7, y0: 1.0, y1: 2.1 };
const DOOR = { a0: 0.25, a1: 1.25, y0: 0, y1: 2.05 };

function Scenery() {
  return (
    <>
      <Floor size={[6.1, 4.5]} color={PALETTE.floor} position={[0, 0, 0.2]} />
      <mesh position={[0, 2.8, 0.2]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[6.1, 4.5]} />
        <meshLambertMaterial color={PALETTE.ceiling} />
      </mesh>

      {/* back wall, with the window */}
      <WallWithHole axis="z" at={-2.05} span={[-3.05, 3.05]} height={2.8} hole={WIN} />
      {/* right wall, with the doorway out to the street */}
      <WallWithHole
        axis="x"
        at={3.05}
        span={[-2.05, 2.45]}
        height={2.8}
        hole={DOOR}
        color={PALETTE.wall}
      />
      <Box position={[-3.05, 1.4, 0.2]} size={[0.12, 2.8, 4.5]} color={PALETTE.wall} />

      {/* skirting */}
      <Box position={[0, 0.07, -1.96]} size={[6.1, 0.14, 0.06]} color={PALETTE.skirting} />
      <Box position={[-2.96, 0.07, 0.2]} size={[0.06, 0.14, 4.5]} color={PALETTE.skirting} />

      {/* shroud: stops the camera seeing over the wall into the void where the
          skyline floats. Clear colour, so it reads as nothing at all. */}
      <WallWithHole
        axis="z"
        at={-2.19}
        span={[-16, 16]}
        height={14}
        hole={{ ...WIN, y0: WIN.y0, y1: WIN.y1 }}
        thickness={0.1}
        color={VOID_COLOR}
      />

      {/* window reveal + the city beyond */}
      <Box position={[0.5, 1.55, -2.14]} size={[0.06, 1.1, 0.18]} color={PALETTE.skirting} />
      <Box position={[1.7, 1.55, -2.14]} size={[0.06, 1.1, 0.18]} color={PALETTE.skirting} />
      <Box position={[1.1, 1.0, -2.14]} size={[1.26, 0.08, 0.22]} color={PALETTE.skirting} />
      <Box position={[1.1, 2.1, -2.14]} size={[1.26, 0.06, 0.18]} color={PALETTE.skirting} />
      <Box position={[1.1, 1.55, -2.07]} size={[0.045, 1.1, 0.04]} color={PALETTE.skirting} />
      <group position={[1.1, 0, -2.05]}>
        <Skyline />
      </group>

      {/* desk */}
      <Box position={[-1.2, 0.74, -1.55]} size={[1.8, 0.06, 0.8]} color={PALETTE.desk} />
      <Box position={[-2.03, 0.37, -1.55]} size={[0.08, 0.74, 0.74]} color={PALETTE.deskLeg} />
      <Box position={[-0.37, 0.37, -1.55]} size={[0.08, 0.74, 0.74]} color={PALETTE.deskLeg} />
      <Box position={[-1.2, 0.82, -1.82]} size={[0.24, 0.1, 0.18]} color={PALETTE.deskLeg} />
      <Box position={[-1.2, 1.0, -1.82]} size={[0.06, 0.28, 0.06]} color={PALETTE.deskLeg} />
      <Box position={[-1.2, 1.32, -1.85]} size={[1.0, 0.6, 0.05]} color={PALETTE.tvBody} />
      <Panel position={[-1.2, 1.32, -1.816]} size={[0.92, 0.52]} color={PALETTE.screen} />
      <Box position={[-1.2, 0.79, -1.34]} size={[0.56, 0.02, 0.17]} color={PALETTE.crate} />
      <mesh position={[-0.6, 0.82, -1.38]}>
        <cylinderGeometry args={[0.05, 0.045, 0.11, 12]} />
        <meshLambertMaterial color={PALETTE.accent} flatShading />
      </mesh>

      {/* chair */}
      <Box position={[-1.2, 0.46, -0.85]} size={[0.52, 0.07, 0.5]} color={PALETTE.chair} />
      <Box position={[-1.2, 0.76, -0.62]} size={[0.52, 0.58, 0.07]} color={PALETTE.chair} />
      <mesh position={[-1.2, 0.22, -0.85]}>
        <cylinderGeometry args={[0.055, 0.055, 0.44, 10]} />
        <meshLambertMaterial color={PALETTE.deskLeg} flatShading />
      </mesh>

      {/* bookshelf */}
      <Box position={[-2.87, 1.05, -0.3]} size={[0.05, 2.1, 0.9]} color={PALETTE.shelf} />
      <Box position={[-2.72, 0.05, -0.3]} size={[0.36, 0.1, 0.9]} color={PALETTE.shelf} />
      {[0.55, 1.05, 1.55, 2.05].map((y) => (
        <Box key={y} position={[-2.72, y, -0.3]} size={[0.36, 0.06, 0.88]} color={PALETTE.shelf} />
      ))}

      {/* the TV — a live canvas, see TvScreen */}
      <Box position={[2.94, 1.6, -1.1]} size={[0.09, 0.78, 1.32]} color={PALETTE.tvBody} />
      <TvScreen position={[2.885, 1.6, -1.1]} rotation={[0, -Math.PI / 2, 0]} size={[1.2, 0.66]} />

      {/* rug + crates */}
      <mesh position={[-0.2, 0.012, -0.35]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.6, 1.8]} />
        <meshLambertMaterial color={PALETTE.rug} />
      </mesh>
      <Box position={[0.55, 0.22, -1.72]} size={[0.44, 0.44, 0.44]} color={PALETTE.crate} />
      <Box position={[0.52, 0.6, -1.7]} size={[0.32, 0.32, 0.32]} color={PALETTE.crate} />

      {/* door frame */}
      <Box position={[3.05, 2.1, 0.75]} size={[0.16, 0.1, 1.1]} color={PALETTE.skirting} />

      {/* the hatch behind the desk, down to the server room */}
      <Box position={[-2.3, 0.02, 1.5]} size={[1.0, 0.05, 1.0]} color={PALETTE.rackMetal} />
      <Box position={[-2.3, 0.06, 1.5]} size={[0.86, 0.04, 0.86]} color={PALETTE.rackFace} />
      <mesh position={[-1.95, 0.09, 1.5]}>
        <cylinderGeometry args={[0.06, 0.06, 0.04, 10]} />
        <meshLambertMaterial color={PALETTE.accentWarm} flatShading />
      </mesh>
    </>
  );
}

export const room: LocationSpec = {
  id: 'room',
  bounds: [-2.95, 2.95, -1.95, 2.35],
  spawn: [0, 1.2],
  blockers: [
    [-1.2, -1.55, 0.9, 0.42], // desk
    [-1.2, -0.78, 0.28, 0.32], // chair
    [-2.8, -0.3, 0.25, 0.46], // bookshelf
    [0.54, -1.7, 0.24, 0.24], // crates
  ],
  hotspots: [
    { prop: 'monitor', label: 'Desk', position: [-1.2, 1.76, -1.82] },
    { prop: 'bookshelf', label: 'Bookshelf', position: [-2.72, 2.34, -0.3] },
    { prop: 'screen', label: 'TV', position: [2.7, 2.18, -1.1] },
  ],
  doors: [
    { to: 'city', label: 'Outside', position: [3.05, 1.0, 0.75], arriveAt: [-7.5, 0] },
    { to: 'server', label: 'Down the hatch', position: [-2.3, 0.4, 1.5], arriveAt: [0, 2.6] },
  ],
  frameWidth: 6.9,
  ambience: '#10141b',
  Scenery,
};
