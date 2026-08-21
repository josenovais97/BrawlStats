import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    // All artwork comes from Brawlify's CDN (via api.brawlapi.com metadata).
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.brawlify.com', pathname: '/**' },
      { protocol: 'https', hostname: 'cdn-misc.brawlify.com', pathname: '/**' },
      { protocol: 'https', hostname: 'cdn-old.brawlify.com', pathname: '/**' },
      // Thumbnails on official Brawl Stars news posts.
      { protocol: 'https', hostname: 'brawlstars.inbox.supercell.com', pathname: '/**' },
      // Drop artwork and reward marks on the Starr Drops page, from the wiki
      // the odds themselves come from.
      { protocol: 'https', hostname: 'static.wikia.nocookie.net', pathname: '/**' },
    ],
  },
};

export default nextConfig;
