import type { Metadata } from 'next';
import { Geist, Geist_Mono, Lilita_One } from 'next/font/google';

import { InstallPrompt } from '@/components/install-prompt';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { SITE_NAME, SITE_URL } from '@/lib/site';

import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

/**
 * Display face for headings and the wordmark.
 *
 * Brawl Stars uses a heavy rounded display type; Lilita One is the closest
 * free match and is what gives the site its game feel. Body copy stays on
 * Geist, which is far more readable at small sizes.
 */
const lilita = Lilita_One({
  variable: '--font-display',
  weight: '400',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'BrawlZone: Brawl Stars player, club and brawler stats',
    template: '%s · BrawlZone',
  },
  description:
    'Look up Brawl Stars players and clubs, browse the brawler database, track the event rotation and global leaderboards.',

  /** Google Search Console ownership. Rendered as the verification meta tag. */
  verification: {
    google: 'MiIdig1YXgfLeQWD89d1Kagjh5w1wiXivuByKgHHHsw',
  },

  /*
   * Site-wide social defaults, so a page that sets no `openGraph` of its own
   * still unfurls as this site rather than as a bare link. Individual pages
   * override the title and description; only the home page and player profiles
   * currently override the image.
   */
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    /*
      The font variables have to land on <html>, not <body>. Tailwind's theme
      maps `--font-sans` to `--font-geist-sans` at `:root`, and a custom
      property that references an undefined variable computes to
      guaranteed-invalid and stays that way for every descendant. Which
      silently dropped Geist and Lilita One across the whole site.
    */
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${lilita.variable}`}
    >
      <body className="antialiased">
        <div className="flex min-h-dvh flex-col">
          <SiteHeader />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
            {children}
          </main>
          <SiteFooter />
        </div>
        <InstallPrompt />
      </body>
    </html>
  );
}
