import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

/**
 * Frames to ignore before measuring. Shader compilation, the first texture
 * upload and layout settling all land in the opening burst; 5 was not enough
 * and could block a device that then held a steady 60fps.
 */
const WARMUP_FRAMES = 20;
const SAMPLE_FRAMES = 60;
const MIN_FPS = 24;
/** A delta this large means a tab switch or a stall, not a slow device. */
const MAX_PLAUSIBLE_DELTA = 0.5;

/**
 * The real device gate: watch the first 60 rendered frames and bail if the
 * average is under 24fps. Feature detection lies about phones; a stopwatch
 * does not. Runs once, then does nothing for the rest of the session.
 */
export function FrameProbe({ onSlow }: { onSlow: () => void }) {
  const warmup = useRef(0);
  const measured = useRef(0);
  const elapsed = useRef(0);
  const done = useRef(false);

  useFrame((_, delta) => {
    if (done.current) return;

    if (warmup.current < WARMUP_FRAMES) {
      warmup.current += 1;
      return;
    }

    // Drop implausible frames from BOTH counters. The previous version
    // incremented the frame count before this bail, so skipped frames stayed
    // in the numerator while their time never reached the denominator — which
    // inflated the fps estimate and made the probe fail open on exactly the
    // devices it exists to catch.
    if (delta > MAX_PLAUSIBLE_DELTA) return;

    measured.current += 1;
    elapsed.current += delta;

    if (measured.current >= SAMPLE_FRAMES) {
      done.current = true;
      if (elapsed.current <= 0) return;
      const fps = measured.current / elapsed.current;
      if (fps < MIN_FPS) onSlow();
    }
  });

  return null;
}
