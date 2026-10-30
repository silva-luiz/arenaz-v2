'use client';

import { useSyncExternalStore } from 'react';

/**
 * Favorites of the demo mode: a module-level set, so every card on the screen
 * (and a client-side navigation to the next one) agrees. Memory only, on
 * purpose: nothing is saved, a reload starts empty.
 */
let favorites: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot(): ReadonlySet<string> {
  return favorites;
}

function publish(next: ReadonlySet<string>): void {
  favorites = next;
  listeners.forEach((listener) => {
    listener();
  });
}

/** Test helper: forget every favorite. */
export function resetDemoFavorites(): void {
  publish(new Set());
}

export function useDemoFavorites(): {
  isFavorite: (id: string) => boolean;
  toggle: (id: string) => void;
} {
  const current = useSyncExternalStore(subscribe, snapshot, snapshot);
  return {
    isFavorite: (id) => current.has(id),
    toggle: (id) => {
      const next = new Set(favorites);
      if (!next.delete(id)) next.add(id);
      publish(next);
    },
  };
}
