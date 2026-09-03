import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Emits .next/standalone — a self-contained server with only the modules it
  // actually imports, which is what the Dockerfile ships.
  output: 'standalone',

  /*
   * The APK's own headers.
   *
   * Next serves everything in `public/` as `application/octet-stream` when it
   * does not recognise the extension, which downloads but leaves Android
   * guessing at what it received. Naming the type is what makes the browser
   * hand the file to the package installer rather than the file manager, and
   * `Content-Disposition` keeps the filename intact through any redirect.
   *
   * The path is versionless by design — a new build overwrites it — so the
   * cache is a day rather than immutable: long enough not to re-fetch 2.5 MB
   * for every visit to the page, short enough that a new release reaches
   * people without anyone having to bust a URL.
   */
  async headers() {
    return [
      {
        source: '/downloads/brawlzone-bubble.apk',
        headers: [
          { key: 'Content-Type', value: 'application/vnd.android.package-archive' },
          {
            key: 'Content-Disposition',
            value: 'attachment; filename="brawlzone-bubble.apk"',
          },
          { key: 'Cache-Control', value: 'public, max-age=86400' },
        ],
      },
    ];
  },

  images: {
    // Self-hosting change. On Vercel, image optimization ran on the platform;
    // here it would run in-process on 2 shared cores, resizing CDN artwork on
    // demand and proxying every byte through this box. Since all of it is
    // already served from a fast public CDN, passing the URLs straight to the
    // browser costs nothing and spends neither CPU nor bandwidth — the two
    // things that got the site paused in the first place.
    //
    // To re-enable: drop this line and add `sharp` to dependencies. Next 16
    // has no built-in fallback optimizer, so it is one or the other.
    unoptimized: true,
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
      // Video thumbnails for the channel card. See lib/youtube.
      { protocol: 'https', hostname: 'i.ytimg.com', pathname: '/**' },
    ],
  },
};

export default nextConfig;
