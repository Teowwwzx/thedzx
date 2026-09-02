import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { World } from './World';
import type { WorldData } from './types';

/**
 * Entry point for the world bundle.
 *
 * This module — and everything it imports, which is React, three.js, R3F and
 * drei — is loaded by a dynamic import() that only runs when the visitor
 * clicks "Enter the room". Nothing here is on the critical path of any page,
 * and no article route can ever pull it in.
 */
export async function mount(container: HTMLElement) {
  const res = await fetch('/world.json', { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`world.json responded ${res.status}`);
  const data: WorldData = await res.json();

  createRoot(container).render(createElement(World, { data }));
}
