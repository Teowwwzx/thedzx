import { useEffect, useState } from 'react';

export interface Series {
  label: string;
  display: string;
  change: number;
  points: number[];
  status: string;
  attribution: string;
}

const EMPTY: Series = {
  label: 'Markets',
  display: '—',
  change: 0,
  points: [],
  status: 'Connecting…',
  attribution: '',
};

/**
 * Data for the in-world TV.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO: show equity prices. Every free tier of
 * every equity API forbids public display — Finnhub's free tier is "strictly
 * for personal use", Twelve Data's is labelled "internal non-display", Alpha
 * Vantage free is 25 requests a DAY, and Massive/Polygon's individual plans
 * are "individual use only" up to $199/month. That is a contract term, not a
 * rate limit, so paying does not lift it; only an enterprise redistribution
 * agreement does. Equities live in the TradingView widget instead, which is
 * licensed for exactly this and requires the attribution link we render.
 *
 * What IS shown here is CoinGecko's public market chart: their free tier
 * permits public display with visible attribution, which the panel carries.
 * No API key, so nothing secret ever reaches the browser and there is no
 * proxy to run.
 */
export function useMarketTicker(): Series {
  const [series, setSeries] = useState<Series>(EMPTY);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(
          'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=1',
          { headers: { Accept: 'application/json' } },
        );
        if (res.status === 429) {
          // Honour the brush-off instead of retrying into it.
          const retry = Number(res.headers.get('Retry-After')) || 120;
          if (!cancelled) {
            setSeries((cur) => ({ ...cur, status: 'Rate limited — retrying shortly' }));
            window.setTimeout(() => { if (!cancelled) void load(); }, retry * 1000);
          }
          return;
        }
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as { prices?: [number, number][] };
        const prices = (json.prices ?? []).map((p) => p[1]);
        if (cancelled || prices.length < 2) throw new Error('no data');

        // ~60 points is plenty for a 512px sparkline. The last sample is
        // appended explicitly: plain modulo sampling drops the tail whenever
        // the count is not divisible by the step, which made the headline
        // price up to fifteen minutes staler than the data actually returned.
        const step = Math.max(1, Math.floor(prices.length / 60));
        const points = prices.filter((_, i) => i % step === 0);
        const newest = prices[prices.length - 1];
        if (points[points.length - 1] !== newest) points.push(newest);
        const first = points[0];
        const last = points[points.length - 1];

        setSeries({
          label: 'BTC / USD · 24h',
          display: last.toLocaleString('en-GB', { maximumFractionDigits: 0, style: 'currency', currency: 'USD' }),
          change: ((last - first) / first) * 100,
          points,
          status: '',
          attribution: 'Powered by CoinGecko',
        });
      } catch {
        if (cancelled) return;
        // The TV is decoration, not infrastructure. If it cannot reach the
        // network it says so and the rest of the room is unaffected.
        setSeries({ ...EMPTY, status: 'Market data unavailable' });
      }
    };

    load();
    // The KEYLESS public endpoint is rate limited per IP (single-digit calls
    // per minute), not by the Demo plan's monthly quota — that only applies
    // once you send a key. One call every five minutes per tab is well
    // inside it, but several tabs behind one NAT is not, so `load` backs off
    // rather than hammering. days=1 returns roughly 5-minutely points.
    const id = window.setInterval(load, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return series;
}
