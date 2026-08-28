"use client";

import { useEffect } from "react";

import { addRecentSearch, type RecentKind } from "@/lib/recent-searches";

/**
 * Renders nothing. Dropped into a player or club page so that visiting it
 * remembers the tag on this device.
 */
export function RecentSearchRecorder({
  kind,
  tag,
  name,
  icon,
}: {
  kind: RecentKind;
  tag: string;
  name: string;
  /** Profile-icon id for a player, badge id for a club. */
  icon?: number;
}) {
  useEffect(() => {
    addRecentSearch({ kind, tag, name, ...(icon ? { icon } : {}) });
  }, [kind, tag, name, icon]);

  return null;
}
