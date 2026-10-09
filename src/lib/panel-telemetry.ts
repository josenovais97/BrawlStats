/**
 * Anonymous usage events from the bubble's panel, into the site's Umami.
 *
 * Which tabs, maps, builds and filters get used, so the next feature is built
 * on what people actually open rather than on a guess. Never the player tag or
 * name: whether a tag is set is sent as a yes/no and nothing more, which keeps
 * this inside what the privacy page already says Umami collects.
 *
 * Fire-and-forget. The Umami script is deferred and may not have loaded yet;
 * an event that finds no tracker is dropped rather than queued, because
 * telemetry must never cost the panel a frame or an error.
 */
export function panelTrack(event: string, data?: Record<string, string | number | boolean>): void {
  try {
    (window as Window & { umami?: { track: (e: string, d?: Record<string, unknown>) => void } }).umami?.track(
      event,
      data,
    );
  } catch {
    // Analytics blocked or unavailable. Never a reason to break the panel.
  }
}

/**
 * The opening event, sent once the deferred script has had a moment to load.
 *
 * At mount the tracker is usually not there yet, so the one event that happens
 * at mount would almost always be dropped. A short wait, once, is the cheapest
 * fix; if it still is not there, the open goes uncounted, as it would anyway.
 */
export function panelTrackOpen(
  data: () => Record<string, string | number | boolean>,
): () => void {
  // Read when it fires, not at mount: the saved tab and the account are both
  // restored from storage in effects, after the first render.
  const timer = window.setTimeout(() => panelTrack('panel_open', data()), 2500);
  return () => window.clearTimeout(timer);
}
