import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3, type Group } from 'three';
import type { Blocker } from './locations/spec';

const RADIUS = 0.3;
const SPEED = 2.6;
const ARRIVE = 0.12;
const TURN_RATE = 9;

export interface CharacterState {
  /** World position, mutated in place — read it, never reassign it. */
  position: Vector3;
  moving: boolean;
}

/**
 * The character controller.
 *
 * Hand-rolled on purpose. `ecctrl` is the obvious dependency, but its
 * point-to-move mode was deleted in v2 — leaving a DOM joystick as the only
 * touch input, which is exactly the mobile experience to avoid — and it is a
 * single-maintainer package at ~4k weekly downloads carrying a breaking
 * rewrite. What it would give us here is about ninety lines.
 *
 * No physics engine either: the world is flat rectangles, so collision is a
 * circle-vs-AABB push-out in 2D. That keeps rapier (~200 KB) out of the bundle
 * entirely, which matters more than fidelity for a room full of boxes.
 */
export function useCharacter(
  rig: React.RefObject<Group | null>,
  bounds: readonly [number, number, number, number],
  blockers: readonly Blocker[],
  spawn: readonly [number, number],
) {
  const target = useRef(new Vector3(spawn[0], 0, spawn[1]));
  const position = useMemo(() => new Vector3(spawn[0], 0, spawn[1]), []);
  const keys = useRef({ f: 0, r: 0 });
  const facing = useRef(0);
  const [moving, setMoving] = useState(false);
  const { camera } = useThree();

  // Re-place on a location change without re-creating the vector.
  useEffect(() => {
    position.set(spawn[0], 0, spawn[1]);
    target.current.copy(position);
  }, [spawn, position]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === 'w' || k === 'arrowup') keys.current.f = 1;
      else if (k === 's' || k === 'arrowdown') keys.current.f = -1;
      else if (k === 'a' || k === 'arrowleft') keys.current.r = -1;
      else if (k === 'd' || k === 'arrowright') keys.current.r = 1;
      else return;

      // Do not steal keys from anything the visitor is actually typing in,
      // or from a focused control elsewhere on the page.
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;

      // Keyboard overrides any click-to-move already in flight.
      target.current.copy(position);
      e.preventDefault();
    };
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'w' || k === 'arrowup' || k === 's' || k === 'arrowdown') keys.current.f = 0;
      if (k === 'a' || k === 'arrowleft' || k === 'd' || k === 'arrowright') keys.current.r = 0;
    };
    // Losing focus mid-stride left the key held down and the character
    // walking into a wall forever.
    const release = () => {
      keys.current.f = 0;
      keys.current.r = 0;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', release);
    document.addEventListener('visibilitychange', release);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', release);
      document.removeEventListener('visibilitychange', release);
    };
  }, [position]);

  const walkTo = useCallback(
    (x: number, z: number) => {
      keys.current.f = 0;
      keys.current.r = 0;
      // Resolve the target the same way a step is resolved. Tapping inside a
      // desk or beyond a wall used to set an unreachable goal: the character
      // pressed against it forever, `moving` never went false, and the walk
      // cycle ran for the rest of the session.
      target.current.copy(resolveRef.current(scratchTarget.set(x, 0, z)));
    },
    [],
  );

  const resolve = useCallback(
    (next: Vector3) => {
      // Keep inside the room.
      next.x = Math.min(Math.max(next.x, bounds[0] + RADIUS), bounds[1] - RADIUS);
      next.z = Math.min(Math.max(next.z, bounds[2] + RADIUS), bounds[3] - RADIUS);

      // Push out of furniture. Smallest-overlap axis wins, which slides the
      // character along an edge instead of sticking to it.
      for (const [bx, bz, hw, hd] of blockers) {
        const dx = next.x - bx;
        const dz = next.z - bz;
        const ox = hw + RADIUS - Math.abs(dx);
        const oz = hd + RADIUS - Math.abs(dz);
        if (ox > 0 && oz > 0) {
          if (ox < oz) next.x += dx >= 0 ? ox : -ox;
          else next.z += dz >= 0 ? oz : -oz;
        }
      }
      return next;
    },
    [bounds, blockers],
  );

  const scratch = useMemo(() => new Vector3(), []);
  const scratchTarget = useMemo(() => new Vector3(), []);

  // walkTo is created once but `resolve` changes with the location, so it is
  // read through a ref rather than captured.
  const resolveRef = useRef(resolve);
  resolveRef.current = resolve;

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    let vx = 0;
    let vz = 0;

    if (keys.current.f || keys.current.r) {
      // Move relative to the camera, so "up" is always away from the viewer.
      const camDir = camera.getWorldDirection(scratch);
      const fx = camDir.x;
      const fz = camDir.z;
      const len = Math.hypot(fx, fz) || 1;
      vx = (fx / len) * keys.current.f + (-fz / len) * keys.current.r;
      vz = (fz / len) * keys.current.f + (fx / len) * keys.current.r;
      const m = Math.hypot(vx, vz) || 1;
      vx = (vx / m) * SPEED;
      vz = (vz / m) * SPEED;
    } else {
      const dx = target.current.x - position.x;
      const dz = target.current.z - position.z;
      const dist = Math.hypot(dx, dz);
      if (dist > ARRIVE) {
        vx = (dx / dist) * SPEED;
        vz = (dz / dist) * SPEED;
      }
    }

    const isMoving = vx !== 0 || vz !== 0;
    if (isMoving) {
      position.copy(resolve(scratch.set(position.x + vx * delta, 0, position.z + vz * delta)));
      const want = Math.atan2(vx, vz);
      let diff = want - facing.current;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      facing.current += diff * Math.min(1, TURN_RATE * delta);
    }
    if (isMoving !== moving) setMoving(isMoving);

    if (rig.current) {
      rig.current.position.set(position.x, 0, position.z);
      rig.current.rotation.y = facing.current;
    }
  });

  return { position, moving, walkTo };
}
