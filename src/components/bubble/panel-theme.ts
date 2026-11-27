'use client';

import { useEffect } from 'react';

/**
 * Bubble themes in the panel (1.42). The player picks a theme for the bubble
 * in the app; the panel wears the same accent so the two read as one thing.
 * The app passes it as `th=` in the panel's hash and, for a panel already
 * open, through window.__bzTheme(id). Gold is the default and sets nothing.
 *
 * Kept in step with BubbleLook.THEMES in the app (the ring colours there are
 * the `top` and `strong` stops here).
 */

type Theme = { brand: string; strong: string; ink: string; top: string; depth: string };

export const PANEL_THEMES: Record<string, Theme> = {
  diamond: { brand: '#4fd8ff', strong: '#1fb4e6', ink: '#03202c', top: '#a6f4ff', depth: '#0e7fa8' },
  mythic: { brand: '#c77dff', strong: '#a64df0', ink: '#1c0733', top: '#ecc2ff', depth: '#6e23b3' },
  legendary: { brand: '#ff7a5c', strong: '#f0523c', ink: '#2c0a05', top: '#ffc0a8', depth: '#a8301f' },
  masters: { brand: '#ff6fb5', strong: '#ff4fa3', ink: '#2c0719', top: '#ffd0e8', depth: '#b32470' },
  emerald: { brand: '#4be08a', strong: '#26c26a', ink: '#04230f', top: '#b4f7cc', depth: '#13823f' },
  frost: { brand: '#dde5ff', strong: '#b7c3e6', ink: '#0b1024', top: '#ffffff', depth: '#7d8bb5' },
  midnight: { brand: '#8fa4ff', strong: '#6f86f0', ink: '#070b22', top: '#c3cdff', depth: '#4459c2' },
  // Bubble Supporter themes (app 1.46): gold on dark stone, and holographic.
  obsidian: { brand: '#ffc53d', strong: '#e0a92a', ink: '#120f1a', top: '#9a90ad', depth: '#2e2938' },
  holo: { brand: '#c7a8ff', strong: '#9f7dff', ink: '#1a1033', top: '#ffb3e6', depth: '#5a8fd6' },
};

const KEY = 'brawlzone.bubble.theme';
const VARS = ['--brand', '--brand-strong', '--brand-ink', '--bz-chip-top', '--bz-chip-depth'];

export function applyPanelTheme(id: string | null) {
  const root = document.documentElement;
  const theme = id ? PANEL_THEMES[id] : undefined;
  if (!theme) {
    delete root.dataset.bzTheme;
    for (const v of VARS) root.style.removeProperty(v);
    return;
  }
  root.dataset.bzTheme = id ?? '';
  root.style.setProperty('--brand', theme.brand);
  root.style.setProperty('--brand-strong', theme.strong);
  root.style.setProperty('--brand-ink', theme.ink);
  root.style.setProperty('--bz-chip-top', theme.top);
  root.style.setProperty('--bz-chip-depth', theme.depth);
}

export function usePanelTheme() {
  useEffect(() => {
    const fromHash = new URLSearchParams(window.location.hash.slice(1)).get('th');
    let saved: string | null = null;
    try {
      if (fromHash !== null) window.localStorage.setItem(KEY, fromHash);
      saved = window.localStorage.getItem(KEY);
    } catch {
      // Private windows and blocked site data both throw; the hash still works.
    }
    applyPanelTheme(fromHash ?? saved);
    const w = window as unknown as { __bzTheme?: (id: string) => void };
    w.__bzTheme = (id: string) => {
      try {
        window.localStorage.setItem(KEY, id);
      } catch {
        /* see above */
      }
      applyPanelTheme(id);
    };
  }, []);
}
