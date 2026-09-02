import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

const SAMPLE_FRAMES = 60;
const MIN_FPS = 24;

/**
 * The real device gate: watch the first 60 rendered frames and bail if the
 * average is under 24fps. Feature detection lies about phones; a stopwatch
 * does not. Runs once, then does nothing for the rest of the session.
 */
export function FrameProbe({ onSlow }: { onSlow: () => void }) {
  const frames = useRef(0);
  const elapsed = useRef(0);
  const done = useRef(false);

  useFrame((_, delta) => {
    if (done.current) return;

    // Skip the first few frames — shader compilation and the first upload
    // make them meaningless, and delta can spike after a tab switch.
    frames.current += 1;
    if (frames.current <= 5) return;
    if (delta > 1) return;

    elapsed.current += delta;

    if (frames.current >= SAMPLE_FRAMES) {
      done.current = true;
      const fps = (frames.current - 5) / elapsed.current;
      if (fps < MIN_FPS) onSlow();
    }
  });

  return null;
}
