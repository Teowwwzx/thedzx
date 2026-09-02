import { useEffect, useRef, useState } from 'react';

/**
 * The TV's focused state: a real TradingView chart, as DOM.
 *
 * It is DOM and not a texture because no browser rasterizes an iframe — not
 * cross-origin, not same-origin. HTMLIFrameElement is not a valid
 * texImage2D source and the WebGL extension for it was never shipped, so a
 * chart physically cannot be painted onto the screen mesh in the room.
 *
 * TradingView's free widgets are used because they are the only route that is
 * actually licensed for public display. Every free equity API tier forbids it
 * outright, and paying does not fix that — it takes an enterprise
 * redistribution contract. The attribution link below is a condition of the
 * widget licence: do not remove it.
 *
 * Quotes are delayed. The label says so, because TradingView does not
 * document per-exchange delay for anonymous embeds and international
 * exchanges default to 15-20 minutes.
 */
const SYMBOLS = [
  { s: 'FTSEMYX:FBMKLCI', label: 'FBM KLCI' },
  { s: 'SP:SPX', label: 'S&P 500' },
  { s: 'NASDAQ:NDX', label: 'Nasdaq 100' },
  { s: 'BITSTAMP:BTCUSD', label: 'BTC / USD' },
];

export function MarketPanel() {
  const host = useRef<HTMLDivElement>(null);
  const [symbol, setSymbol] = useState(SYMBOLS[0]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    el.innerHTML = '';
    setFailed(false);

    // The widget is injected by a script tag whose JSON body configures it.
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js';
    script.async = true;
    script.type = 'text/javascript';
    script.innerHTML = JSON.stringify({
      symbol: symbol.s,
      width: '100%',
      height: 210,
      locale: 'en',
      dateRange: '3M',
      colorTheme: 'dark',
      isTransparent: true,
      autosize: false,
    });
    script.onerror = () => setFailed(true);
    el.appendChild(script);

    return () => {
      el.innerHTML = '';
    };
  }, [symbol]);

  return (
    <div className="market-panel">
      <div className="market-tabs" role="tablist" aria-label="Market">
        {SYMBOLS.map((s) => (
          <button
            key={s.s}
            type="button"
            role="tab"
            aria-selected={s.s === symbol.s}
            className={s.s === symbol.s ? 'is-on' : undefined}
            onClick={() => setSymbol(s)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div ref={host} className="market-widget" />

      {failed && (
        <p className="market-note">
          The chart could not load — it needs a third-party script that some
          browsers and blockers refuse.
        </p>
      )}

      <p className="market-note">
        Quotes are <strong>delayed</strong>, not live. Charts by{' '}
        <a href="https://www.tradingview.com/" rel="noopener" target="_blank">TradingView</a>.
      </p>
    </div>
  );
}
