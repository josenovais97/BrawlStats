import { ArrowLeft, Compass } from "lucide-react";
import Link from "next/link";

import { FullPageMessage } from "@/components/ui/full-page-message";

/*
 * The root 404, which Next also serves for any URL that matches no route at
 * all — not just for `notFound()` calls inside a segment.
 *
 * No `metadata` export: this version only supports that on
 * `global-not-found.js`, and Next already injects `noindex` on anything
 * returning a 404 status, so setting robots here would be redundant anyway.
 *
 * The links are the point. A dead end that only says "not found" wastes the
 * one thing a lost visitor still has, which is the intent that brought them —
 * so the most likely destinations are offered rather than just a way home.
 */
export default function NotFound() {
  return (
    <FullPageMessage
      title="Page not found"
      body="This page does not exist, or it did once and no longer does. Maps and modes rotate, so an old link can outlive the thing it pointed at."
    >
      <Link
        href="/"
        className="btn-game inline-flex items-center gap-2 bg-brand px-6 py-3 uppercase text-[#1a1200] hover:bg-brand-strong"
      >
        <ArrowLeft className="size-4" />
        Back to search
      </Link>
      <Link
        href="/tier-list/ranked"
        className="inline-flex items-center gap-2 rounded-xl border border-border px-6 py-3 font-medium text-muted transition-colors hover:border-brand/50 hover:text-foreground"
      >
        <Compass className="size-4" />
        Tier list
      </Link>
    </FullPageMessage>
  );
}
