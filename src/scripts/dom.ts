/**
 * The one way this site's scripts build DOM.
 *
 * Every string goes in through textContent, never innerHTML. Half of what the
 * community scripts render was typed by strangers, and this is the line that
 * makes a comment containing <script> show up as text instead of running.
 */
type Child = Node | string | null | undefined | false;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | undefined> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== undefined) node.setAttribute(k, v);
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    node.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

const DAY = 86_400_000;
const rtf = typeof Intl !== 'undefined' ? new Intl.RelativeTimeFormat('en', { numeric: 'auto' }) : null;

/** "2 days ago", "just now". Falls back to the ISO date. */
export function ago(iso: string): string {
  const t = Date.parse(iso);
  if (!rtf || Number.isNaN(t)) return iso.slice(0, 10);
  const diff = t - Date.now();
  const abs = Math.abs(diff);
  if (abs < 60_000) return 'just now';
  if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), 'minute');
  if (abs < DAY) return rtf.format(Math.round(diff / 3_600_000), 'hour');
  if (abs < 30 * DAY) return rtf.format(Math.round(diff / DAY), 'day');
  return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Human date for a YYYY-MM-DD string, matching FormattedDate.astro. */
export function shortDate(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** Local storage that never throws — private windows and blocked storage. */
export const store = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* the preference simply does not persist */
    }
  },
};
