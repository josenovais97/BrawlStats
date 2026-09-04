import { Check, Download } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { HomeSection } from '@/components/home/home-section';
import { BUBBLE_APP, bubbleAppSize } from '@/lib/bubble-app';

/**
 * The Android app, on the landing page.
 *
 * Placed high for the same reason `HomeSplit` was moved up: it is a thing no
 * competitor's website can copy, and the argument only works on people who
 * actually reach it. Every other block on this page — search, a profile, live
 * events, a tier list — is something the other sites also have. This one is
 * not, and it is not a matter of them not having built it yet: a browser tab
 * cannot draw over another app on any phone.
 *
 * A still rather than the recording. The clip is 1.3 MB and belongs on the page
 * that exists to sell the app; the landing page's job here is to say the thing
 * exists and hand over a link, and a poster frame does that for a tenth of the
 * bytes on a page that already loads plenty.
 */
export function HomeBubble() {
  return (
    <HomeSection
      id="bubble-app"
      eyebrow="Free Android app"
      title="Take the tier list into the game"
      subtitle="A floating bubble that draws the Ranked meta on top of Brawl Stars, so you can check a pick without leaving the draft."
      ctaHref="/bubble"
      ctaLabel="About the app"
    >
      <div className="grid items-center gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <Link
          href="/bubble"
          className="card card-interactive block overflow-hidden"
          aria-label="See the BrawlZone Bubble app"
        >
          <Image
            src="/bubble/demo-poster.jpg"
            alt="The BrawlZone panel open over a live Hot Zone draft, showing the Ranked tier list filtered to that mode"
            width={1280}
            height={590}
            className="w-full"
            loading="lazy"
          />
        </Link>

        <div className="space-y-4">
          <p className="leading-relaxed text-muted">
            Brawl Stars gives you seconds to pick, and switching apps costs more of them than you
            have. The bubble sits on the edge of the screen, opens the full Ranked tier list on a
            tap, filters to the mode you are drafting, and folds away again.
          </p>

          <ul className="grid gap-2 sm:grid-cols-2">
            {['Free forever', 'No ads', 'No account', 'No tracking'].map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm font-semibold">
                <Check className="size-4 shrink-0 text-victory" />
                {item}
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
            <a
              href={BUBBLE_APP.path}
              download
              className="inline-flex items-center gap-2.5 rounded-xl bg-brand px-5 py-3 font-bold text-brand-ink transition-transform hover:-translate-y-0.5"
            >
              <Download className="size-4" />
              Download for Android
            </a>
            <p className="text-xs text-muted">
              {bubbleAppSize()} · Android {BUBBLE_APP.minAndroid}+
            </p>
          </div>
        </div>
      </div>
    </HomeSection>
  );
}
