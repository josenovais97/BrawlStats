import type { Metadata } from 'next';
import { Geist, Geist_Mono, Lilita_One } from 'next/font/google';

import { InstallPrompt } from '@/components/install-prompt';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';

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
  title: {
    default: 'Brawl Zone — Brawl Stars player, club and brawler stats',
    template: '%s · Brawl Zone',
  },
  description:
    'Look up Brawl Stars players and clubs, browse the brawler database, track the event rotation and global leaderboards.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${lilita.variable} antialiased`}
      >
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
