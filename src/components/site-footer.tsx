import { ExternalLink } from 'lucide-react';

export function SiteFooter() {
  return (
    <footer className="border-t border-border/70 bg-background/60">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 text-sm text-muted sm:px-6 lg:px-8">
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
          , with artwork and metadata from{' '}
          <a
            href="https://brawlapi.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-foreground underline decoration-border underline-offset-4 hover:decoration-brand"
          >
            BrawlAPI
            <ExternalLink className="size-3" />
          </a>
          .
        </p>
        <p className="mt-3 text-xs text-muted/80">
          This material is unofficial and is not endorsed by Supercell. For more information
          see Supercell&apos;s Fan Content Policy.
        </p>
      </div>
    </footer>
  );
}
