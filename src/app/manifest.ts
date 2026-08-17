import type { MetadataRoute } from 'next';

/**
 * Web app manifest. Makes Brawl Zone installable, which is what lets the
 * mobile install prompt appear at all.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Brawl Zone: Brawl Stars stats',
    short_name: 'Brawl Zone',
    description:
      'Look up Brawl Stars players and clubs, browse the brawler database, track the event rotation and global leaderboards.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0b1020',
    theme_color: '#0b1020',
    categories: ['games', 'entertainment', 'utilities'],
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
    ],
  };
}
