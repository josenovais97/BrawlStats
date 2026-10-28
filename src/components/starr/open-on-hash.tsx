'use client';

import { useEffect } from 'react';

/**
 * Opens the folded drop a `#slug` link points at.
 *
 * Every drop on /starr-drops is a closed `<details>`, and following a link to
 * one scrolls to its summary and leaves it shut -- so the schedule's "Chaos
 * Drop" link landed on a heading with the answer still folded away.
 */
export function OpenOnHash() {
  useEffect(() => {
    const open = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      const target = id ? document.getElementById(id) : null;
      if (target instanceof HTMLDetailsElement) target.open = true;
    };
    open();
    window.addEventListener('hashchange', open);
    return () => window.removeEventListener('hashchange', open);
  }, []);
  return null;
}
