import { useEffect, useMemo, useRef } from 'react';
import { CanvasTexture, LinearFilter, type Mesh } from 'three';
import { useMarketTicker } from './useMarketTicker';

/**
 * The TV, in-world.
 *
 * TWO THINGS CONSTRAIN THIS DESIGN, both of them hard:
 *
 * 1. LICENSING. Every free equity-data tier forbids public display — Finnhub
 *    is "strictly for personal use", Twelve Data's free plan is labelled
 *    "internal non-display", and paying does not fix it: that needs an
 *    enterprise redistribution contract. So nothing here shows equity prices.
 *    The ambient screen draws only sources whose terms permit public display
 *    with attribution (see useMarketTicker), and the real chart is a
 *    TradingView widget, which is licensed precisely for this.
 *
 * 2. NO BROWSER RASTERIZES AN IFRAME. Not a cross-origin one, not a
 *    same-origin one — HTMLIFrameElement is not a valid texImage2D source and
 *    the WebGL extension for it was never shipped. So the TradingView widget
 *    physically cannot become a texture on this mesh. Do not spend a weekend
 *    building a same-origin proxy to try.
 *
 * Hence two states: this canvas texture is the ambient far view, and the
 * widget opens as DOM when you interact with it.
 *
 * The canvas is redrawn on a setInterval at 4fps, never in the render loop —
 * a 512px texture upload every frame would cost more than the whole room.
 */
const W = 512;
const H = 288;

export function TvScreen({
  position,
  rotation,
  size,
}: {
  position: readonly [number, number, number];
  rotation: readonly [number, number, number];
  size: readonly [number, number];
}) {
  const mesh = useRef<Mesh>(null);
  const series = useMarketTicker();

  const { canvas, texture } = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const t = new CanvasTexture(c);
    t.minFilter = LinearFilter;
    t.generateMipmaps = false;
    return { canvas: c, texture: t };
  }, []);

  useEffect(() => () => texture.dispose(), [texture]);

  useEffect(() => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let frame = 0;

    const draw = () => {
      frame += 1;
      ctx.fillStyle = '#0d1620';
      ctx.fillRect(0, 0, W, H);

      // header
      ctx.fillStyle = '#de8b4c';
      ctx.fillRect(0, 0, W, 34);
      ctx.fillStyle = '#10141b';
      ctx.font = 'bold 17px ui-monospace, Menlo, monospace';
      ctx.fillText(series.label.toUpperCase(), 14, 23);
      ctx.font = '12px ui-monospace, Menlo, monospace';
      ctx.fillText('DELAYED', W - 78, 23);

      if (series.points.length > 1) {
        const lo = Math.min(...series.points);
        const hi = Math.max(...series.points);
        const range = hi - lo || 1;
        const x0 = 22;
        const x1 = W - 22;
        const y0 = 62;
        const y1 = H - 46;

        // grid
        ctx.strokeStyle = 'rgba(131,142,161,0.16)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 3; i++) {
          const y = y0 + ((y1 - y0) / 3) * i;
          ctx.beginPath();
          ctx.moveTo(x0, y);
          ctx.lineTo(x1, y);
          ctx.stroke();
        }

        const px = (i: number) => x0 + ((x1 - x0) * i) / (series.points.length - 1);
        const py = (v: number) => y1 - ((v - lo) / range) * (y1 - y0);

        // area fill
        ctx.beginPath();
        ctx.moveTo(px(0), y1);
        series.points.forEach((v, i) => ctx.lineTo(px(i), py(v)));
        ctx.lineTo(px(series.points.length - 1), y1);
        ctx.closePath();
        ctx.fillStyle = 'rgba(87,179,162,0.18)';
        ctx.fill();

        // line
        ctx.beginPath();
        series.points.forEach((v, i) => (i ? ctx.lineTo(px(i), py(v)) : ctx.moveTo(px(i), py(v))));
        ctx.strokeStyle = series.change >= 0 ? '#57b3a2' : '#dd7a76';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // endpoint
        const lastX = px(series.points.length - 1);
        const lastY = py(series.points[series.points.length - 1]);
        ctx.beginPath();
        ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
        ctx.fillStyle = series.change >= 0 ? '#57b3a2' : '#dd7a76';
        ctx.fill();

        // readout
        ctx.fillStyle = '#dfe5ee';
        ctx.font = 'bold 26px ui-monospace, Menlo, monospace';
        ctx.fillText(series.display, 22, H - 14);
        ctx.fillStyle = series.change >= 0 ? '#57b3a2' : '#dd7a76';
        ctx.font = '15px ui-monospace, Menlo, monospace';
        ctx.fillText(
          `${series.change >= 0 ? '+' : ''}${series.change.toFixed(2)}%`,
          22 + ctx.measureText(series.display).width + 60,
          H - 14,
        );
      } else {
        ctx.fillStyle = '#838ea1';
        ctx.font = '15px ui-monospace, Menlo, monospace';
        ctx.fillText(series.status, 22, H / 2);
      }

      // scanlines + a slow flicker, so it reads as a screen and not a poster
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
      ctx.fillStyle = `rgba(255,255,255,${0.012 + 0.012 * Math.sin(frame / 3)})`;
      ctx.fillRect(0, 0, W, H);

      texture.needsUpdate = true;
    };

    draw();
    // 4fps. Never in useFrame: a 512px upload every frame would cost more
    // than the entire rest of the room.
    const id = window.setInterval(draw, 250);
    return () => window.clearInterval(id);
  }, [canvas, texture, series]);

  return (
    <mesh ref={mesh} position={position as [number, number, number]} rotation={rotation as [number, number, number]}>
      <planeGeometry args={size as [number, number]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}
