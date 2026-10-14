import type { Locale } from '@/lib/i18n';

/**
 * Small flags for the language menu, drawn inline.
 *
 * Not emoji: Windows renders flag emoji as two letters ("PT", "BR"), which is
 * the opposite of the point. Simplified to what reads at 18x12 -- the shapes
 * and colours, not every detail of the arms.
 */

type FlagProps = { className?: string };

const box = 'h-3 w-[18px] shrink-0 overflow-hidden rounded-[2px] shadow-[0_0_0_1px_rgb(0_0_0/0.25)]';

function Uk({ className = '' }: FlagProps) {
  return (
    <svg viewBox="0 0 60 40" aria-hidden className={`${box} ${className}`}>
      <rect width="60" height="40" fill="#012169" />
      <path d="M0 0 60 40M60 0 0 40" stroke="#fff" strokeWidth="8" />
      <path d="M0 0 60 40M60 0 0 40" stroke="#C8102E" strokeWidth="3" />
      <path d="M30 0v40M0 20h60" stroke="#fff" strokeWidth="12" />
      <path d="M30 0v40M0 20h60" stroke="#C8102E" strokeWidth="7" />
    </svg>
  );
}

function Us({ className = '' }: FlagProps) {
  return (
    <svg viewBox="0 0 60 40" aria-hidden className={`${box} ${className}`}>
      <rect width="60" height="40" fill="#fff" />
      {[0, 2, 4, 6, 8, 10, 12].map((i) => (
        <rect key={i} y={(i * 40) / 13} width="60" height={40 / 13} fill="#B22234" />
      ))}
      <rect width="26" height={(40 / 13) * 7} fill="#3C3B6E" />
    </svg>
  );
}

function Es({ className = '' }: FlagProps) {
  return (
    <svg viewBox="0 0 60 40" aria-hidden className={`${box} ${className}`}>
      <rect width="60" height="40" fill="#AA151B" />
      <rect y="10" width="60" height="20" fill="#F1BF00" />
    </svg>
  );
}

function Mx({ className = '' }: FlagProps) {
  return (
    <svg viewBox="0 0 60 40" aria-hidden className={`${box} ${className}`}>
      <rect width="20" height="40" fill="#006847" />
      <rect x="20" width="20" height="40" fill="#fff" />
      <rect x="40" width="20" height="40" fill="#CE1126" />
      <circle cx="30" cy="20" r="5" fill="#8C6A2B" />
    </svg>
  );
}

function Pt({ className = '' }: FlagProps) {
  return (
    <svg viewBox="0 0 60 40" aria-hidden className={`${box} ${className}`}>
      <rect width="60" height="40" fill="#DA291C" />
      <rect width="24" height="40" fill="#046A38" />
      <circle cx="24" cy="20" r="8" fill="#FFE900" />
      <circle cx="24" cy="20" r="4.5" fill="#DA291C" />
    </svg>
  );
}

function Br({ className = '' }: FlagProps) {
  return (
    <svg viewBox="0 0 60 40" aria-hidden className={`${box} ${className}`}>
      <rect width="60" height="40" fill="#009C3B" />
      <path d="M30 5 55 20 30 35 5 20z" fill="#FFDF00" />
      <circle cx="30" cy="20" r="8" fill="#002776" />
    </svg>
  );
}

const FLAGS: Record<Locale, ((p: FlagProps) => React.ReactNode)[]> = {
  en: [Uk, Us],
  es: [Es, Mx],
  pt: [Pt, Br],
};

/** The flags for a language, side by side. */
export function LocaleFlags({ locale, className = '' }: { locale: Locale; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {FLAGS[locale].map((Flag, i) => (
        <Flag key={i} />
      ))}
    </span>
  );
}
