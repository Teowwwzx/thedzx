import { PALETTE } from './palette';

/** Every piece of furniture in this world is one of these. */
export function Box({
  position,
  size,
  color,
  rotation,
}: {
  position: readonly [number, number, number];
  size: readonly [number, number, number];
  color: string;
  rotation?: readonly [number, number, number];
}) {
  return (
    <mesh
      position={position as [number, number, number]}
      rotation={rotation as [number, number, number] | undefined}
    >
      <boxGeometry args={size as [number, number, number]} />
      <meshLambertMaterial color={color} flatShading />
    </mesh>
  );
}

/** An unlit panel — screens, and anything that must not pick up room light. */
export function Panel({
  position,
  size,
  color,
  rotation,
}: {
  position: readonly [number, number, number];
  size: readonly [number, number];
  color: string;
  rotation?: readonly [number, number, number];
}) {
  return (
    <mesh
      position={position as [number, number, number]}
      rotation={rotation as [number, number, number] | undefined}
    >
      <planeGeometry args={size as [number, number]} />
      <meshBasicMaterial color={color} />
    </mesh>
  );
}

/** Floor plane. */
export function Floor({
  size,
  color,
  position = [0, 0, 0],
}: {
  size: readonly [number, number];
  color: string;
  position?: readonly [number, number, number];
}) {
  return (
    <mesh position={position as [number, number, number]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={size as [number, number]} />
      <meshLambertMaterial color={color} />
    </mesh>
  );
}

/** Matches the Canvas clear colour, so a shroud reads as empty space. */
export const VOID_COLOR = '#10141b';

/**
 * A wall with a rectangular hole in it, built from four boxes.
 *
 * Used for every window and doorway. The pieces are derived from the opening
 * so it can never drift out of the hole — getting this wrong by a few
 * centimetres leaks whatever is behind the wall through the seam.
 */
export function WallWithHole({
  axis,
  at,
  span,
  height,
  hole,
  thickness = 0.12,
  color = PALETTE.wallBack,
}: {
  /** 'z' = wall runs along X at a fixed z; 'x' = runs along Z at a fixed x. */
  axis: 'x' | 'z';
  at: number;
  span: readonly [number, number];
  height: number;
  hole: { a0: number; a1: number; y0: number; y1: number };
  thickness?: number;
  color?: string;
}) {
  const [s0, s1] = span;
  const pieces: { c: number; y: number; w: number; h: number }[] = [
    { c: (s0 + hole.a0) / 2, y: height / 2, w: hole.a0 - s0, h: height },
    { c: (hole.a1 + s1) / 2, y: height / 2, w: s1 - hole.a1, h: height },
    { c: (hole.a0 + hole.a1) / 2, y: hole.y0 / 2, w: hole.a1 - hole.a0, h: hole.y0 },
    {
      c: (hole.a0 + hole.a1) / 2,
      y: (hole.y1 + height) / 2,
      w: hole.a1 - hole.a0,
      h: height - hole.y1,
    },
  ];

  return (
    <>
      {pieces
        .filter((p) => p.w > 0.001 && p.h > 0.001)
        .map((p, i) =>
          axis === 'z' ? (
            <Box key={i} position={[p.c, p.y, at]} size={[p.w, p.h, thickness]} color={color} />
          ) : (
            <Box key={i} position={[at, p.y, p.c]} size={[thickness, p.h, p.w]} color={color} />
          ),
        )}
    </>
  );
}
