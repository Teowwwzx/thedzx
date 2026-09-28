/**
 * The homepage board: the preview panel and the region highlight.
 *
 * Progressive enhancement only. Without this script every piece is still a
 * link and the page is complete; with it, pointing at a piece names it in the
 * panel, and pointing at a topic lights up that topic's region.
 */
import { el, shortDate } from './dom';

interface TopicInfo {
  label: string;
  zh: string;
  swatch: string;
  href: string;
}
interface PostInfo {
  title: string;
  href: string;
  topic: string;
  date: string;
}
interface PuzzleData {
  topics: Record<string, TopicInfo>;
  posts: Record<string, PostInfo>;
}

/** Another script (community.ts) can describe asked-for pieces here. */
export interface AskedInfo {
  id: number;
  question: string;
  name: string;
  votes: number;
}
const asked = new Map<Element, AskedInfo>();
let panelFor: ((piece: Element) => void) | null = null;

export function registerAsked(piece: Element, info: AskedInfo) {
  asked.set(piece, info);
}

/** Re-render the panel for a piece, e.g. after its vote count changed. */
export function refreshPanel(piece: Element) {
  panelFor?.(piece);
}

const swatchVars = (s: string) => `--sw: var(--sw-${s}); --bold: var(--bold-${s})`;

export function initBoard() {
  const board = document.querySelector<HTMLElement>('[data-board]');
  const panel = document.querySelector<HTMLElement>('[data-panel]');
  const raw = document.getElementById('puzzle-data')?.textContent;
  if (!board || !panel || !raw) return;

  let data: PuzzleData;
  try {
    data = JSON.parse(raw) as PuzzleData;
  } catch {
    return;
  }

  let current: Element | null = null;

  function show(piece: Element) {
    const topicId = piece.getAttribute('data-topic') ?? '';
    const topic = data.topics[topicId];
    if (!topic) return;
    current = piece;

    const postId = piece.getAttribute('data-post');
    const post = postId ? data.posts[postId] : undefined;
    const request = asked.get(piece);
    const chip = el('p', { class: 'pp-topic' }, `${topic.label} · `, el('span', { lang: 'zh' }, topic.zh));

    let body: HTMLElement;
    if (post) {
      body = el(
        'div',
        { style: swatchVars(topic.swatch) },
        el('p', { class: 'pp-kicker' }, el('span', { class: 'dot' }), ` ${shortDate(post.date)}`),
        el('a', { class: 'pp-title', href: post.href }, post.title),
        chip,
      );
    } else if (request) {
      const vote = el('button', { type: 'button', class: 'pp-vote', 'data-vote': String(request.id) }, 'Me too');
      body = el(
        'div',
        { style: swatchVars(topic.swatch) },
        el(
          'p',
          { class: 'pp-kicker' },
          el('span', { class: 'dot' }),
          ` Asked by ${request.name || 'a reader'} · ${request.votes} want this`,
        ),
        el('p', { class: 'pp-title is-question' }, request.question),
        el('p', { class: 'pp-actions' }, vote),
        chip,
      );
    } else {
      body = el(
        'div',
        { style: swatchVars(topic.swatch) },
        el('p', { class: 'pp-kicker' }, el('span', { class: 'dot is-hollow' }), ' Empty piece'),
        el('p', { class: 'pp-title is-empty' }, 'Not written yet.'),
        chip,
      );
    }
    panel!.replaceChildren(body);
  }
  panelFor = (piece) => {
    if (piece === current) show(piece);
  };

  const pieceOf = (t: EventTarget | null) =>
    t instanceof Element ? t.closest('.piece') : null;

  board.addEventListener('pointerover', (e) => {
    const p = pieceOf(e.target);
    if (p) show(p);
  });
  board.addEventListener('focusin', (e) => {
    const p = pieceOf(e.target);
    if (p) show(p);
  });

  // An empty piece asks for itself: jump to the ask form with its topic
  // chosen. If the community API is down the form stays hidden, and the
  // piece's own href (#join) is the right fallback — so only intercept when
  // there is somewhere better to go.
  board.addEventListener('click', (e) => {
    const p = pieceOf(e.target);
    if (!p || !p.classList.contains('is-empty')) return;
    if (asked.has(p)) {
      e.preventDefault();
      show(p);
      panel.querySelector<HTMLButtonElement>('.pp-vote')?.focus();
      return;
    }
    const ask = document.getElementById('ask');
    const form = document.querySelector<HTMLFormElement>('[data-ask-form]');
    if (!ask || ask.hidden || !form) return;
    e.preventDefault();
    const select = form.elements.namedItem('topic');
    if (select instanceof HTMLSelectElement) select.value = p.getAttribute('data-topic') ?? select.value;
    ask.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    const q = form.elements.namedItem('question');
    if (q instanceof HTMLInputElement) q.focus({ preventScroll: true });
  });

  // Pointing at a topic lights up its region.
  for (const chip of document.querySelectorAll<HTMLElement>('[data-topic-chip]')) {
    const id = chip.dataset.topicChip;
    if (!id) continue;
    const on = () => (board.dataset.focus = id);
    const off = () => delete board.dataset.focus;
    chip.addEventListener('pointerenter', on);
    chip.addEventListener('pointerleave', off);
    chip.addEventListener('focus', on);
    chip.addEventListener('blur', off);
  }
}
