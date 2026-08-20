'use client';

import { Download, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { BrandMark } from '@/components/brand-mark';

/**
 * The event Chromium fires when a site meets the installability criteria.
 * Not in the standard DOM lib types, so it is declared here.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'brawlzone:install-dismissed';

/**
 * Offers to install BrawlZone as an app on mobile.
 *
 * Only shows when the browser says the site is actually installable, which
 * rules out desktop, already-installed sessions and browsers that do not
 * support it. A dismissal is remembered so it is never nagging.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (window.localStorage.getItem(DISMISSED_KEY) === '1') return;

    // Already running as an installed app.
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    function onBeforeInstallPrompt(event: Event) {
      // Keep the event so the prompt can be shown from our own button.
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setVisible(true);
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // Storage disabled — the banner just reappears next visit.
    }
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setVisible(false);
    setDeferred(null);
  }

  if (!visible || !deferred) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 md:hidden">
      <div className="card card-glow flex items-center gap-3 p-3 shadow-2xl shadow-black/60">
        <BrandMark className="size-10 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Install BrawlZone</p>
          <p className="truncate text-xs text-muted">Add it to your home screen</p>
        </div>
        <button
          type="button"
          onClick={install}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-bold text-[#1a1200]"
        >
          <Download className="size-4" />
          Install
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss install prompt"
          className="grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
