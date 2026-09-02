import { useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { DoubleSide, type Mesh } from 'three';
import { PALETTE } from './palette';

interface Props {
  position: [number, number, number];
  /** Matches a post's `prop`. Used to return focus after the panel closes. */
  prop: string;
  label: string;
  count: number;
  active: boolean;
  reducedMotion: boolean;
  onOpen: () => void;
}

/**
 * A clickable marker floating over an object in the room.
 *
 * The label is drei <Html>, i.e. REAL DOM — crisp at any resolution, readable
 * by a screen reader, and focusable with a keyboard. Deliberately not
 * `transform` mode, which is documented to render blurry on some devices.
 * The canvas never draws text. See AGENTS.md, rule 1.
 */
export function Hotspot({ position, prop, label, count, active, reducedMotion, onOpen }: Props) {
  const ring = useRef<Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (!ring.current) return;
    if (reducedMotion) {
      // Park it at rest rather than freezing at whatever scale it reached.
      ring.current.scale.setScalar(1);
      return;
    }
    const t = state.clock.elapsedTime;
    ring.current.scale.setScalar(1 + Math.sin(t * 2 + position[0]) * 0.08);
  });

  return (
    <group position={position}>
      {/* Faces the camera (+Z) rather than lying flat: a ring rotated onto
          the XZ plane is edge-on from this camera, back-face culled, and its
          raycast target is a sliver — so the marker was invisible and its
          handlers never fired. DoubleSide keeps it visible under parallax. */}
      <mesh
        ref={ring}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
      >
        <ringGeometry args={[0.075, 0.115, 24]} />
        <meshBasicMaterial
          color={hovered || active ? PALETTE.accentWarm : PALETTE.accent}
          transparent
          opacity={hovered || active ? 1 : 0.85}
          side={DoubleSide}
        />
      </mesh>

      <Html center distanceFactor={6} zIndexRange={[20, 0]}>
        <button
          type="button"
          className={`hotspot-label${active ? ' is-active' : ''}`}
          data-prop={prop}
          aria-expanded={active}
          onClick={onOpen}
          onPointerOver={() => setHovered(true)}
          onPointerOut={() => setHovered(false)}
        >
          {label}
          <span className="hotspot-count">{count}</span>
        </button>
      </Html>
    </group>
  );
}
