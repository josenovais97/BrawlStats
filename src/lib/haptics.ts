/**
 * Haptic feedback (2026-11-12). Inside the Bubble app's panel the app's own
 * haptics (window.BrawlZoneApp.haptic, 1.41+); elsewhere navigator.vibrate,
 * which Android browsers have and iOS Safari does not. Silent everywhere it
 * is missing or refused.
 */
export type HapticKind = 'tap' | 'success' | 'error';

const PATTERN: Record<HapticKind, number | number[]> = {
  tap: 8,
  success: [10, 60, 18],
  error: [24, 50, 24],
};

type AppBridge = { haptic?: (kind: string) => void };

export function haptic(kind: HapticKind = 'tap'): void {
  if (typeof window === 'undefined') return;
  try {
    const app = (window as unknown as { BrawlZoneApp?: AppBridge }).BrawlZoneApp;
    if (app?.haptic) {
      app.haptic(kind);
      return;
    }
    navigator.vibrate?.(PATTERN[kind]);
  } catch {
    // A nicety; a browser that refuses is fine.
  }
}
