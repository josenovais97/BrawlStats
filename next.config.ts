import { BUBBLE_APP } from './src/lib/bubble-app';
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
   * The URL carries the version, and the cache rule follows from that.
   *
   * It used to be one versionless path that every  release overwrote, served with
   * `max-age=86400`. The reasoning written here was that a day is "short enough
   * that a new release reaches people without anyone having to bust a URL",
   * and it was wrong in the only way that mattered: a day is enormous when six
   * releases ship in one, and a client that had the old bytes kept serving them
   * to itself. Updates installed the previous build. Four releases of fixes
   * were reported as not working, because the binary carrying them never
   * arrived — while the page around it redeployed in minutes and announced the
   * new version as installed.
   *
   * A versioned URL cannot answer with the wrong bytes, so it can be cached
   * hard. The old address is a redirect that is never cached, so anything
   * holding a stale bookmark lands on the current release instead of a stale
   * copy of it.
   */
  async headers() {
    return [
      {
        source: '/downloads/:file(brawlzone-bubble-.*\\.apk)',
        headers: [
          { key: 'Content-Type', value: 'application/vnd.android.package-archive' },
          { key: 'Content-Disposition', value: 'attachment' },
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/downloads/brawlzone-bubble.apk',
        headers: [{ key: 'Cache-Control', value: 'no-store' }],
      },
    ];
  },

  /**
   * The versionless address, kept working for links already in the world.
   *
   * Temporary rather than permanent on purpose: it points at whatever the
   * current release is, so it must never be the kind of redirect a browser is
   * entitled to remember.
   */
  async redirects() {
    return [
      {
        source: '/downloads/brawlzone-bubble.apk',
        destination: BUBBLE_APP.path,
        permanent: false,
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
