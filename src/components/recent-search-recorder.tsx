'use client';

import { useEffect } from 'react';

import { addRecentSearch, type RecentKind } from '@/lib/recent-searches';

/**
 * Renders nothing. Dropped into a player or club page so that visiting it
 * remembers the tag on this device.
 */
export function RecentSearchRecorder({
  kind,
  tag,
  name,
}: {
  kind: RecentKind;
  tag: string;
  name: string;
}) {
  useEffect(() => {
    addRecentSearch({ kind, tag, name });
  }, [kind, tag, name]);

  return null;
}
