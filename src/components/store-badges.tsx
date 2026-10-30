import type { T } from '@/lib/t-core';
import { getUT } from '@/lib/t-universal';

/**
 * App Store and Google Play download badges.
 *
 * Drawn inline as SVG so they stay crisp and need no network request. They
 * follow the familiar badge layout; if you want strict brand compliance,
 * replace these with the official artwork from Apple's Marketing Resources
 * and Google Play's badge generator — the components are swappable in place.
 *
 * Every label is pinned with `textLength`, and that is load-bearing rather
 * than tidy. The labels are set in `system-ui`, which is a different typeface
 * on every platform: the widths that fit inside the 135-unit badge on one
 * machine ran past its right edge on another, and "Google Play" was rendering
 * with the "y" sliced off. Pinning the advance width makes the fit a property
 * of the badge instead of a property of whoever is looking at it.
 */

interface BadgeProps {
  className?: string;
  /**
   * The page's language, from a client component that has it (`useT`).
   * Without it the badge reads `requestLocale`, which is right in a server
   * component and always English while a client component renders on the
   * server -- the footer's badge said GET IT ON on /es and /pt and the
   * browser corrected it, a hydration error (#418) on every translated page.
   */
  t?: T;
}

export function AppStoreBadge({ className = 'h-11 w-auto', t = getUT() }: BadgeProps) {
  return (
    <svg
      viewBox="0 0 135 40"
      className={className}
      role="img"
      aria-label={t('Download on the App Store')}
    >
      <rect
        x="0.5"
        y="0.5"
        width="134"
        height="39"
        rx="7"
        fill="#000000"
        stroke="#a6a6a6"
      />
      {/* Apple mark */}
      <path
        d="M27.9 20.3c-.02-2.4 1.96-3.55 2.05-3.61-1.12-1.63-2.86-1.86-3.47-1.88-1.47-.15-2.88.87-3.63.87-.75 0-1.9-.85-3.13-.83-1.61.02-3.1.94-3.93 2.38-1.68 2.9-.43 7.2 1.2 9.55.8 1.16 1.75 2.46 3 2.41 1.2-.05 1.66-.78 3.11-.78 1.45 0 1.86.78 3.13.75 1.29-.02 2.11-1.18 2.9-2.34.92-1.34 1.3-2.64 1.32-2.7-.03-.01-2.53-.97-2.55-3.82z"
        fill="#ffffff"
      />
      <path
        d="M25.53 13.24c.66-.8 1.1-1.9.98-3.01-.95.04-2.1.63-2.78 1.43-.61.7-1.15 1.83-1 2.91 1.06.08 2.14-.54 2.8-1.33z"
        fill="#ffffff"
      />
      <text
        x="45"
        y="16.5"
        fill="#ffffff"
        fontFamily="system-ui, -apple-system, Helvetica, Arial, sans-serif"
        fontSize="8.5"
        textLength="60"
        lengthAdjust="spacingAndGlyphs"
      >{t('Download on the')}</text>
      <text
        x="45"
        y="30"
        fill="#ffffff"
        fontFamily="system-ui, -apple-system, Helvetica, Arial, sans-serif"
        fontSize="16"
        fontWeight="600"
        textLength="78"
        lengthAdjust="spacingAndGlyphs"
      >{t('App Store')}</text>
    </svg>
  );
}

export function GooglePlayBadge({ className = 'h-11 w-auto', t = getUT() }: BadgeProps) {
  return (
    <svg
      viewBox="0 0 135 40"
      className={className}
      role="img"
      aria-label={t('Get it on Google Play')}
    >
      <rect
        x="0.5"
        y="0.5"
        width="134"
        height="39"
        rx="7"
        fill="#000000"
        stroke="#a6a6a6"
      />
      {/* Play mark: four facets of the classic triangle */}
      <g transform="translate(14 10)">
        <path d="M0.6 0.5a1.6 1.6 0 0 0-.4 1.1v16.8a1.6 1.6 0 0 0 .4 1.1l.1.05L10 10.2v-.22z" fill="#00d0ff" />
        <path d="M13.2 13.4 10.1 10.2v-.22l3.1-3.1.07.04 3.7 2.1c1.06.6 1.06 1.58 0 2.19l-3.7 2.1z" fill="#ffd400" />
        <path d="m13.27 13.36-3.17-3.17L0.6 19.6a1.28 1.28 0 0 0 1.63.05z" fill="#ff3a44" />
        <path d="M13.27 7.02 2.23 0.35A1.28 1.28 0 0 0 .6 0.4l9.5 9.5z" fill="#00e676" />
      </g>
      <text
        x="45"
        y="16.5"
        fill="#ffffff"
        fontFamily="system-ui, -apple-system, Helvetica, Arial, sans-serif"
        fontSize="8.5"
        textLength="44"
        lengthAdjust="spacingAndGlyphs"
      >{t('GET IT ON')}</text>
      <text
        x="45"
        y="30"
        fill="#ffffff"
        fontFamily="system-ui, -apple-system, Helvetica, Arial, sans-serif"
        fontSize="14.5"
        fontWeight="600"
        textLength="78"
        lengthAdjust="spacingAndGlyphs"
      >{t('Google Play')}</text>
    </svg>
  );
}

/** The Play triangle on its own, for marking a step that happens on Google Play. */
export function PlayMark({ className = 'size-6' }: BadgeProps) {
  return (
    <svg viewBox="0 0 18 20" className={className} aria-hidden>
      <path d="M0.6 0.5a1.6 1.6 0 0 0-.4 1.1v16.8a1.6 1.6 0 0 0 .4 1.1l.1.05L10 10.2v-.22z" fill="#00d0ff" />
      <path d="M13.2 13.4 10.1 10.2v-.22l3.1-3.1.07.04 3.7 2.1c1.06.6 1.06 1.58 0 2.19l-3.7 2.1z" fill="#ffd400" />
      <path d="m13.27 13.36-3.17-3.17L0.6 19.6a1.28 1.28 0 0 0 1.63.05z" fill="#ff3a44" />
      <path d="M13.27 7.02 2.23 0.35A1.28 1.28 0 0 0 .6 0.4l9.5 9.5z" fill="#00e676" />
    </svg>
  );
}
