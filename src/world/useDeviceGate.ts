import { useEffect, useState } from 'react';

export type GateVerdict = 'checking' | 'ok' | 'blocked';

export interface GateResult {
  verdict: GateVerdict;
  reason: string | null;
  /** Set by the runtime probe once it has watched enough frames. */
  reportSlow: () => void;
  /** True when the block came from the frame probe, which can false-positive. */
  canRetry: boolean;
  retry: () => void;
}

/**
 * Decides whether this device should run the world at all.
 *
 * The obvious implementation is broken. `navigator.deviceMemory` and
 * `navigator.connection.saveData` are Chromium-only and `undefined` on every
 * iPhone and in Firefox, so `deviceMemory < 4` evaluates FALSE there and the
 * gate fails OPEN — every iOS visitor boots the full scene.
 *
 * So the static checks here only ever *block* on something we positively
 * observed, and the real gate is the runtime frame probe in FrameProbe.tsx:
 * if 60 measured frames average under 24fps, we bail to the flat list.
 *
 * Two things deliberately do NOT block:
 *
 * - `prefers-reduced-motion` quiets the motion (parallax, the pulsing ring)
 *   rather than refusing the room. The preference is about motion, not about
 *   3D, and blocking it made the reducedMotion prop threaded through World,
 *   Room and Hotspot unreachable.
 * - `hardwareConcurrency <= 2` excluded a lot of perfectly capable hardware
 *   for a metric with no bearing on a single-threaded WebGL scene. The frame
 *   probe measures the thing we actually care about.
 */
export function useDeviceGate(): GateResult {
  const [verdict, setVerdict] = useState<GateVerdict>('checking');
  const [reason, setReason] = useState<string | null>(null);
  const [wasSlow, setWasSlow] = useState(false);

  useEffect(() => {
    // 1. WebGL2 is a hard requirement — this is a positive check, not a guess.
    let gl: WebGL2RenderingContext | null = null;
    try {
      const canvas = document.createElement('canvas');
      gl = canvas.getContext('webgl2');
    } catch {
      gl = null;
    }
    if (!gl) {
      setReason('This browser has no WebGL2.');
      setVerdict('blocked');
      return;
    }
    // Release the probe context immediately; browsers cap concurrent contexts.
    gl.getExtension('WEBGL_lose_context')?.loseContext();

    // 3. Chromium-only hints. Guarded with typeof, and treated as hints —
    //    their ABSENCE never implies a capable device.
    const nav = navigator as Navigator & {
      deviceMemory?: number;
      connection?: { saveData?: boolean };
      hardwareConcurrency?: number;
    };
    if (typeof nav.connection?.saveData === 'boolean' && nav.connection.saveData) {
      setReason('Your browser is in data-saver mode.');
      setVerdict('blocked');
      return;
    }
    if (typeof nav.deviceMemory === 'number' && nav.deviceMemory < 2) {
      setReason('This device reports very little memory.');
      setVerdict('blocked');
      return;
    }
    setVerdict('ok');
  }, []);

  return {
    verdict,
    reason,
    reportSlow: () => {
      setReason('The room ran too slowly here, so this is the fast version.');
      setWasSlow(true);
      setVerdict('blocked');
    },
    // A device that stutters through shader compilation can trip the probe and
    // then run fine. Offer the way back in rather than making a page reload
    // the only recovery.
    canRetry: wasSlow,
    retry: () => {
      setWasSlow(false);
      setReason(null);
      setVerdict('ok');
    },
  };
}
