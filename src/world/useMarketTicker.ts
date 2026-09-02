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
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as { prices?: [number, number][] };
        const prices = (json.prices ?? []).map((p) => p[1]);
        if (cancelled || prices.length < 2) throw new Error('no data');

        // ~60 points is plenty for a 512px sparkline.
        const step = Math.max(1, Math.floor(prices.length / 60));
        const points = prices.filter((_, i) => i % step === 0);
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
    // CoinGecko's free tier is ~10k calls/month. Once every 5 minutes per
    // open tab is far inside that and the chart is hourly anyway.
    const id = window.setInterval(load, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return series;
}
