import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, Vector3, type Group } from 'three';
import { PALETTE } from './palette';
import { Skyline } from './Skyline';
import { Hotspot } from './Hotspot';
import type { WorldPost } from './types';

/**
 * The room, as a greybox.
 *
 * Every object here is a box, a plane or a cylinder with a flat colour. That
 * is deliberate and it is the whole point of stage 1: the plan says wire the
 * routing against grey boxes BEFORE sourcing final assets, because the art
 * bottleneck is what kills projects like this. When CC0 kits land, the
 * geometry below is swapped out and no interaction code changes.
 *
 * Nothing here is fetched. The entire room is generated from primitives, so
 * there is no .glb to download and no asset budget to blow.
 *
 * ---------------------------------------------------------------------------
 * LAYOUT. Metres. Origin is the middle of the floor.
 *
 *   x: -3 (left wall) .. +3 (right wall)
 *   z: -2 (back wall) .. +2.4 (open, the camera looks in through here)
 *   y:  0 (floor)     .. 2.8 (ceiling)
 *
 * Each of the four hotspots gets its own surface so nothing overlaps:
 *
 *   left wall   x=-3    bookshelf   — essays, one spine per post
 *   back wall   z=-2    desk        — IT knowledge
 *               z=-2    window      — Kuala Lumpur at dusk, Merdeka 118
 *   right wall  x=+3    TV          — markets (stage 3)
 *               x=+3    door        — locked until this room has 5 posts
 * ---------------------------------------------------------------------------
 */

/** Matches the Canvas clear colour, so the shroud reads as empty space. */
const VOID_COLOR = '#10141b';

/** The window opening in the back wall. Wall pieces are derived from these. */
const WIN = { x0: 0.5, x1: 1.7, y0: 1.0, y1: 2.1 } as const;
const ROOM = { left: -3.05, right: 3.05, back: -2.05, front: 2.4, height: 2.8 } as const;

interface Props {
  posts: WorldPost[];
  activeProp: string | null;
  reducedMotion: boolean;
  onOpen: (prop: string) => void;
}

function Box({
  position,
  size,
  color,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
}) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshLambertMaterial color={color} flatShading />
    </mesh>
  );
}

/**
 * The points that MUST stay on screen — the four hotspot markers plus the
 * room's back corners.
 *
 * A flat half-extent is not enough: the door hotspot sits at z=+0.75, much
 * nearer the camera than the room centre, so it needs a wider angle than the
 * back wall does. Framing on a box put the door off-screen on every tablet
 * and desktop aspect. These get projected with a real camera instead.
 */
const FRAME_POINTS: readonly [number, number, number][] = [
  [-1.2, 1.78, -1.8], // desk marker
  [-2.85, 2.32, -0.3], // bookshelf marker
  [2.75, 2.06, -0.85], // TV marker
  [2.75, 2.42, 0.75], // door marker — the binding constraint on wide screens
  [-3.05, 0.1, -2.05],
  [3.05, 0.1, -2.05],
  [-3.05, 2.75, -2.05],
  [3.05, 2.75, -2.05],
];

const FRAME = {
  centreZ: -0.5,
  eyeY: 1.72,
  eyeX: 0.1,
  target: [0, 1.35, -1.2] as const,
  /**
   * Markers must land well inside the viewport, not merely on it: each one
   * carries a DOM label centred on it, so at 0.9 the labels were clipped by
   * the canvas edge on a phone ("BOOKSHELF" rendered as "3OOKSHELF").
   */
  margin: 0.78,
  minDistance: 4.6,
  maxDistance: 17,
} as const;

/**
 * Frames the room for whatever aspect ratio the canvas actually has.
 *
 * Two things went wrong with a fixed camera. R3F's default camera looks at the
 * ORIGIN — the middle of the floor — which parks the room low with dead space
 * above it. And `fov` in three.js is the VERTICAL fov, so on a portrait phone
 * (canvas ~343x503, aspect 0.68) the horizontal fov collapses to about 33°:
 * the desk stayed in frame and the bookshelf, TV and door all projected
 * outside the canvas. drei <Html> portals into the canvas container, which is
 * overflow:hidden, so their labels were not just off-camera — they were gone.
 * Three quarters of the interactive layer was dead on the device class that
 * matters most.
 *
 * So: pick the camera distance from the aspect ratio, and aim at eye height.
 */
function CameraAim() {
  const { camera, size } = useThree();
  // One scratch camera and vector, reused — this runs on every resize.
  const probe = useMemo(() => new PerspectiveCamera(), []);
  const scratch = useMemo(() => new Vector3(), []);

  useEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return;

    const aspect = size.width / Math.max(size.height, 1);

    // Walk outward until every point in FRAME_POINTS actually projects inside
    // the viewport. Using the real projection rather than a closed-form box
    // fit is what makes this correct at BOTH extremes: a tall portrait phone
    // and a short wide desktop bind on different points.
    const fits = (distance: number) => {
      probe.fov = camera.fov;
      probe.aspect = aspect;
      probe.near = camera.near;
      probe.far = camera.far;
      probe.position.set(FRAME.eyeX, FRAME.eyeY, FRAME.centreZ + distance);
      probe.lookAt(FRAME.target[0], FRAME.target[1], FRAME.target[2]);
      probe.updateMatrixWorld(true);
      probe.updateProjectionMatrix();
      return FRAME_POINTS.every((p) => {
        scratch.set(p[0], p[1], p[2]).project(probe);
        return Math.abs(scratch.x) <= FRAME.margin && Math.abs(scratch.y) <= FRAME.margin;
      });
    };

    // Annotated: FRAME is `as const`, so this would otherwise infer the
    // literal type 17 and reject every other distance.
    let distance: number = FRAME.maxDistance;
    for (let d = FRAME.minDistance; d <= FRAME.maxDistance; d += 0.1) {
      if (fits(d)) {
        distance = d;
        break;
      }
    }

    camera.position.set(FRAME.eyeX, FRAME.eyeY, FRAME.centreZ + distance);
    camera.lookAt(FRAME.target[0], FRAME.target[1], FRAME.target[2]);
    camera.updateProjectionMatrix();
  }, [camera, size, probe, scratch]);

  return null;
}

export function Room({ posts, activeProp, reducedMotion, onOpen }: Props) {
  const rig = useRef<Group>(null);
  const { pointer } = useThree();

  const countFor = (prop: string) => posts.filter((p) => p.prop === prop).length;
  const spines = useMemo(() => posts.filter((p) => p.prop === 'bookshelf'), [posts]);

  // Fixed camera. Stage 1 is deliberately not walkable — that is stage 2.
  // It gets a small parallax instead, so the room reads as three-dimensional
  // with no controls to learn.
  useFrame(() => {
    if (!rig.current || reducedMotion) return;
    rig.current.rotation.y += (pointer.x * -0.045 - rig.current.rotation.y) * 0.05;
    rig.current.rotation.x += (pointer.y * 0.022 - rig.current.rotation.x) * 0.05;
  });

  // Back wall, derived from WIN so the opening can never drift out of the
  // hole. Getting this wrong by 5cm leaks the skyline through the wall.
  const wallY = ROOM.height / 2;

  // Same four-piece cut, at a far larger extent, sitting just behind the wall.
  const SHROUD = { x: 16, yLow: -8, yHigh: 14, z: ROOM.back - 0.14 };
  const shroudPieces: { pos: [number, number, number]; size: [number, number, number] }[] = [
    {
      pos: [(-SHROUD.x + WIN.x0) / 2, (SHROUD.yLow + SHROUD.yHigh) / 2, SHROUD.z],
      size: [WIN.x0 + SHROUD.x, SHROUD.yHigh - SHROUD.yLow, 0.1],
    },
    {
      pos: [(WIN.x1 + SHROUD.x) / 2, (SHROUD.yLow + SHROUD.yHigh) / 2, SHROUD.z],
      size: [SHROUD.x - WIN.x1, SHROUD.yHigh - SHROUD.yLow, 0.1],
    },
    {
      pos: [(WIN.x0 + WIN.x1) / 2, (SHROUD.yLow + WIN.y0) / 2, SHROUD.z],
      size: [WIN.x1 - WIN.x0, WIN.y0 - SHROUD.yLow, 0.1],
    },
    {
      pos: [(WIN.x0 + WIN.x1) / 2, (WIN.y1 + SHROUD.yHigh) / 2, SHROUD.z],
      size: [WIN.x1 - WIN.x0, SHROUD.yHigh - WIN.y1, 0.1],
    },
  ];
  const backPieces: { pos: [number, number, number]; size: [number, number, number] }[] = [
    // left of the window, full height
    {
      pos: [(ROOM.left + WIN.x0) / 2, wallY, ROOM.back],
      size: [WIN.x0 - ROOM.left, ROOM.height, 0.12],
    },
    // right of the window, full height
    {
      pos: [(WIN.x1 + ROOM.right) / 2, wallY, ROOM.back],
      size: [ROOM.right - WIN.x1, ROOM.height, 0.12],
    },
    // under the sill
    {
      pos: [(WIN.x0 + WIN.x1) / 2, WIN.y0 / 2, ROOM.back],
      size: [WIN.x1 - WIN.x0, WIN.y0, 0.12],
    },
    // over the head
    {
      pos: [(WIN.x0 + WIN.x1) / 2, (WIN.y1 + ROOM.height) / 2, ROOM.back],
      size: [WIN.x1 - WIN.x0, ROOM.height - WIN.y1, 0.12],
    },
  ];

  return (
    <group ref={rig}>
      <CameraAim />

      {/* ---- lighting: no shadow maps, three lights, cheap ---- */}
      <ambientLight intensity={1.15} />
      <hemisphereLight args={['#b9c9e2', '#3a2f26', 1.5]} />
      <directionalLight position={[3.5, 5, 4]} intensity={1.5} />
      {/* dusk spilling in through the window */}
      <directionalLight position={[2, 2.2, -3]} intensity={0.7} color={PALETTE.skyHorizon} />
      {/* the monitor lights its own corner of the desk */}
      <pointLight
        position={[-1.2, 1.3, -1.2]}
        intensity={3.2}
        distance={3.4}
        color={PALETTE.screenGlow}
      />

      {/* ---- shell ---- */}
      <mesh position={[0, 0, 0.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[6.1, 4.45]} />
        <meshLambertMaterial color={PALETTE.floor} />
      </mesh>
      <mesh position={[0, ROOM.height, 0.2]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[6.1, 4.45]} />
        <meshLambertMaterial color={PALETTE.ceiling} />
      </mesh>

      {backPieces.map((piece, i) => (
        <Box key={i} position={piece.pos} size={piece.size} color={PALETTE.wallBack} />
      ))}

      <Box position={[ROOM.left, wallY, 0.2]} size={[0.12, ROOM.height, 4.45]} color={PALETTE.wall} />
      <Box position={[ROOM.right, wallY, 0.2]} size={[0.12, ROOM.height, 4.45]} color={PALETTE.wall} />

      {/* skirting, so the floor/wall join reads as a room and not a box */}
      <Box position={[0, 0.07, ROOM.back + 0.09]} size={[6.1, 0.14, 0.06]} color={PALETTE.skirting} />
      <Box position={[ROOM.left + 0.09, 0.07, 0.2]} size={[0.06, 0.14, 4.45]} color={PALETTE.skirting} />
      <Box position={[ROOM.right - 0.09, 0.07, 0.2]} size={[0.06, 0.14, 4.45]} color={PALETTE.skirting} />

      {/* ---- the window, and Kuala Lumpur beyond it ---- */}
      {/* reveal, so the wall reads as having thickness */}
      <Box position={[WIN.x0, 1.55, ROOM.back - 0.09]} size={[0.06, 1.1, 0.18]} color={PALETTE.skirting} />
      <Box position={[WIN.x1, 1.55, ROOM.back - 0.09]} size={[0.06, 1.1, 0.18]} color={PALETTE.skirting} />
      <Box position={[1.1, WIN.y0, ROOM.back - 0.09]} size={[1.26, 0.08, 0.22]} color={PALETTE.skirting} />
      <Box position={[1.1, WIN.y1, ROOM.back - 0.09]} size={[1.26, 0.06, 0.18]} color={PALETTE.skirting} />
      {/* the mullion */}
      <Box position={[1.1, 1.55, ROOM.back - 0.02]} size={[0.045, 1.1, 0.04]} color={PALETTE.skirting} />

      {/*
        The shroud: the back wall continued far past the room, in the canvas's
        own background colour, with the same window hole cut in it.

        Without it the camera sees OVER the top of the back wall into the void
        beyond, where the sky plane and Merdeka 118's spire are floating — so
        the city appeared hovering above the ceiling and broke the illusion of
        being indoors. Pulling the camera back to fit a portrait phone made it
        much worse, because the further back you stand the more you see over
        the wall.

        Colouring it the clear colour means it reads as nothing at all: the
        room sits in darkness, and the window is the only way the city gets in.
      */}
      {shroudPieces.map((piece, i) => (
        <mesh key={`shroud-${i}`} position={piece.pos}>
          <boxGeometry args={piece.size} />
          {/* Basic, not Lambert: a lit material would shade this and give the
              trick away as a big grey slab. */}
          <meshBasicMaterial color={VOID_COLOR} />
        </mesh>
      ))}

      {/* The city sits behind the window and is seen only through it. */}
      <group position={[1.1, 0, ROOM.back]}>
        <Skyline />
      </group>

      {/* ---- the desk: IT knowledge ---- */}
      <Box position={[-1.2, 0.74, -1.55]} size={[1.8, 0.06, 0.8]} color={PALETTE.desk} />
      <Box position={[-2.03, 0.37, -1.55]} size={[0.08, 0.74, 0.74]} color={PALETTE.deskLeg} />
      <Box position={[-0.37, 0.37, -1.55]} size={[0.08, 0.74, 0.74]} color={PALETTE.deskLeg} />
      {/* monitor */}
      <Box position={[-1.2, 0.82, -1.82]} size={[0.24, 0.1, 0.18]} color={PALETTE.deskLeg} />
      <Box position={[-1.2, 1.0, -1.82]} size={[0.06, 0.28, 0.06]} color={PALETTE.deskLeg} />
      <Box position={[-1.2, 1.32, -1.85]} size={[1.0, 0.6, 0.05]} color={PALETTE.tvBody} />
      <mesh position={[-1.2, 1.32, -1.816]}>
        <planeGeometry args={[0.92, 0.52]} />
        <meshBasicMaterial color={PALETTE.screen} />
      </mesh>
      {/* keyboard + mug */}
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

      {/* ---- the bookshelf: essays, one spine each ---- */}
      {/* Back panel: thin along X (against the wall), not along Z — the
          earlier size stood it up as a divider through the middle of the
          shelf, intersecting every board and two spines in seven. */}
      <Box position={[-2.96, 1.05, -0.3]} size={[0.05, 2.1, 0.9]} color={PALETTE.shelf} />
      <Box position={[-2.85, 0.05, -0.3]} size={[0.36, 0.1, 0.9]} color={PALETTE.shelf} />
      {[0.55, 1.05, 1.55, 2.05].map((y) => (
        <Box key={y} position={[-2.85, y, -0.3]} size={[0.36, 0.06, 0.88]} color={PALETTE.shelf} />
      ))}
      {spines.map((post, i) => {
        const shelfY = [0.68, 1.18, 1.68][Math.floor(i / 7) % 3];
        const z = -0.68 + (i % 7) * 0.11;
        return (
          <mesh key={post.slug} position={[-2.85, shelfY, z]}>
            <boxGeometry args={[0.26, 0.24, 0.06]} />
            <meshLambertMaterial color={PALETTE.spines[i % PALETTE.spines.length]} flatShading />
          </mesh>
        );
      })}

      {/* ---- the TV: markets ---- */}
      <Box position={[ROOM.right - 0.11, 1.6, -0.85]} size={[0.09, 0.78, 1.32]} color={PALETTE.tvBody} />
      <mesh position={[ROOM.right - 0.16, 1.6, -0.85]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[1.2, 0.66]} />
        <meshBasicMaterial color={PALETTE.accent} />
      </mesh>

      {/* ---- the locked door: expandable, not unfinished ---- */}
      <Box position={[ROOM.right - 0.07, 1.03, 0.75]} size={[0.1, 2.06, 0.96]} color={PALETTE.skirting} />
      <Box position={[ROOM.right - 0.11, 1.03, 0.75]} size={[0.06, 1.92, 0.84]} color={PALETTE.crate} />
      <mesh position={[ROOM.right - 0.16, 1.02, 0.42]}>
        <sphereGeometry args={[0.05, 10, 8]} />
        <meshLambertMaterial color={PALETTE.accentWarm} flatShading />
      </mesh>
      {/* the sign nailed to it */}
      <Box position={[ROOM.right - 0.15, 1.52, 0.75]} size={[0.02, 0.22, 0.6]} color={PALETTE.accent} />

      {/* ---- dressing ---- */}
      <mesh position={[-0.2, 0.012, -0.35]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.6, 1.8]} />
        <meshLambertMaterial color={PALETTE.rug} />
      </mesh>
      <Box position={[0.55, 0.22, -1.72]} size={[0.44, 0.44, 0.44]} color={PALETTE.crate} />
      <Box position={[0.52, 0.6, -1.7]} size={[0.32, 0.32, 0.32]} color={PALETTE.crate} />

      {/* ---- the interactive layer ---- */}
      <Hotspot
        position={[-1.2, 1.78, -1.8]}
        prop="monitor"
        label="Desk"
        count={countFor('monitor')}
        active={activeProp === 'monitor'}
        reducedMotion={reducedMotion}
        onOpen={() => onOpen('monitor')}
      />
      <Hotspot
        position={[-2.85, 2.32, -0.3]}
        prop="bookshelf"
        label="Bookshelf"
        count={countFor('bookshelf')}
        active={activeProp === 'bookshelf'}
        reducedMotion={reducedMotion}
        onOpen={() => onOpen('bookshelf')}
      />
      <Hotspot
        position={[ROOM.right - 0.3, 2.06, -0.85]}
        prop="screen"
        label="TV"
        count={countFor('screen')}
        active={activeProp === 'screen'}
        reducedMotion={reducedMotion}
        onOpen={() => onOpen('screen')}
      />
      <Hotspot
        position={[ROOM.right - 0.3, 2.42, 0.75]}
        prop="door"
        label="Door"
        count={0}
        active={activeProp === 'door'}
        reducedMotion={reducedMotion}
        onOpen={() => onOpen('door')}
      />
    </group>
  );
}
