"use client";

import { Check, Share2 } from "lucide-react";
import { useState } from "react";

/**
 * Shares the current profile, or copies its link.
 *
 * The page already renders a full share card through `opengraph-image`, so the
 * link is the whole payload — nothing has to be generated here. Uses the Web
 * Share API where it exists (which is where sharing is actually done, on a
 * phone) and falls back to the clipboard everywhere else.
 */
export function ShareButton({ title, text }: { title: string; text: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        // Cancelling the sheet rejects, which is not a failure worth reporting
        // — fall through to the clipboard so the click still did something.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard permission can be refused outright; the button simply does
      // nothing rather than throwing up an error for a non-essential action.
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      /* Deliberately the same shape as FavoriteButton: the two sit side by
         side in the profile header, and a different radius, padding and weight
         on each made them read as two unrelated controls that happened to be
         adjacent. */
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface-2 px-3.5 py-2 text-sm font-semibold text-muted transition-colors hover:border-brand/40 hover:text-foreground"
    >
      {copied ? (
        <Check className="size-4 text-victory" />
      ) : (
        <Share2 className="size-4" />
      )}
      {copied ? "Link copied" : "Share"}
    </button>
  );
}
