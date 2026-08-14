import { Coffee, ExternalLink } from 'lucide-react';
import Link from 'next/link';

import { AppStoreBadge, GooglePlayBadge } from '@/components/store-badges';

const APP_STORE_URL = 'https://apps.apple.com/app/brawl-stars/id1229016807';
const GOOGLE_PLAY_URL =
  'https://play.google.com/store/apps/details?id=com.supercell.brawlstars';
const BUY_ME_A_COFFEE_URL = 'https://buymeacoffee.com/josenovais';

export function SiteFooter() {
  return (
    <footer className="border-t border-border/70 bg-background/60">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold">Get the game</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <a
                href={APP_STORE_URL}
                target="_blank"
                rel="noreferrer"
                aria-label="Download Brawl Stars on the App Store (opens in a new tab)"
                className="transition-opacity hover:opacity-80"
              >
                <AppStoreBadge className="h-11 w-auto" />
              </a>
              <a
                href={GOOGLE_PLAY_URL}
                target="_blank"
                rel="noreferrer"
                aria-label="Download Brawl Stars on Google Play (opens in a new tab)"
                className="transition-opacity hover:opacity-80"
              >
                <GooglePlayBadge className="h-11 w-auto" />
              </a>
            </div>
          </div>

          <div className="md:text-right">
            <p className="text-sm font-semibold">Enjoying Brawl Zone?</p>
            <a
              href={BUY_ME_A_COFFEE_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-[#1a1200] transition-colors hover:bg-brand-strong"
            >
              <Coffee className="size-4" />
              Buy me a coffee
            </a>
          </div>
        </div>

        <div className="mt-8 border-t border-border/70 pt-6 text-sm text-muted">
          <p className="mb-3">
            <Link
              href="/about"
              className="font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-brand"
            >
              About Brawl Zone
            </Link>
          </p>
          <p>
            Data from the official{' '}
            <a
              href="https://developer.brawlstars.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-foreground underline decoration-border underline-offset-4 hover:decoration-brand"
            >
              Brawl Stars API
              <ExternalLink className="size-3" />
            </a>{' '}
            via the{' '}
            <a
              href="https://docs.royaleapi.com/proxy.html"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-foreground underline decoration-border underline-offset-4 hover:decoration-brand"
            >
              RoyaleAPI proxy
              <ExternalLink className="size-3" />
            </a>
            , with artwork from{' '}
            <a
              href="https://brawlify.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-foreground underline decoration-border underline-offset-4 hover:decoration-brand"
            >
              Brawlify
              <ExternalLink className="size-3" />
            </a>
            .
          </p>
          <p className="mt-3 text-xs text-muted/80">
            This material is unofficial and is not endorsed by Supercell. For more
            information see Supercell&apos;s Fan Content Policy.
          </p>
        </div>
      </div>
    </footer>
  );
}
