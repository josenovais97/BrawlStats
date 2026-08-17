/** Presentation helpers shared across pages. */

/** 317840 -> "317,840" */
export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return n.toLocaleString('en-US');
}

/** 317840 -> "317.8K", for tight card layouts. */
export function compactNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  if (Math.abs(n) < 1000) return String(n);
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n);
}

/**
 * The API returns compact ISO-8601 basic format ("20260813T235142.000Z"),
 * which `new Date()` will not parse. Expand it to the extended form first.
 */
export function parseApiDate(value: string): Date | null {
  if (!value) return null;
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(?:\.(\d{3}))?Z$/.exec(value);
  if (!m) {
    const fallback = new Date(value);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }
  const [, y, mo, d, h, mi, s, ms = '000'] = m;
  const date = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}.${ms}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "3h ago", "2d ago". Returns "—" for unparseable input. */
export function relativeTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? parseApiDate(value) : value;
  if (!date) return '—';

  const diffMs = date.getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['second', 1000],
    ['minute', 60_000],
    ['hour', 3_600_000],
    ['day', 86_400_000],
  ];

  let chosen: [Intl.RelativeTimeFormatUnit, number] = units[0];
  for (const unit of units) {
    if (abs >= unit[1]) chosen = unit;
  }
  return rtf.format(Math.round(diffMs / chosen[1]), chosen[0]);
}

/** Countdown label like "4h 12m" until the given time. */
export function timeUntil(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? parseApiDate(value) : value;
  if (!date) return '—';

  const ms = date.getTime() - Date.now();
  if (ms <= 0) return 'ending now';

  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * The API sends colours as "0xffcb5aff" (ARGB). Convert to a CSS hex colour,
 * dropping the alpha channel. Falls back to white for missing/invalid values.
 */
export function nameColorToCss(color: string | null | undefined): string {
  if (!color) return '#ffffff';
  const hex = color.replace(/^0x/i, '');
  if (hex.length === 8) return `#${hex.slice(2)}`;
  if (hex.length === 6) return `#${hex}`;
  return '#ffffff';
}

/** "vicePresident" -> "Vice President" */
export function humanizeRole(role: string): string {
  return role
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

/** "soloShowdown" -> "Solo Showdown", "deathmatch5v5" -> "Deathmatch 5v5" */
export function humanizeMode(mode: string | null | undefined): string {
  if (!mode) return 'Unknown';
  return mode
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([a-zA-Z])(\d)/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase());
}

/**
 * Title-cases an API label while keeping roman numerals upright.
 *
 * The API shouts its ranks ("GOLD III"). Naive lowercasing plus a CSS
 * `capitalize` turns that into "Gold Iii", so numerals are detected and
 * uppercased explicitly.
 */
const ROMAN_NUMERAL = /^(?=[IVXLCDM]+$)M*(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;

export function titleCaseLabel(value: string | null | undefined): string {
  if (!value) return '';

  return value
    .trim()
    .split(/\s+/)
    .map((word) => {
      const upper = word.toUpperCase();
      if (ROMAN_NUMERAL.test(upper)) return upper;
      return upper.charAt(0) + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/** Rank suffix for showdown placements: 1 -> "1st". */
export function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/**
 * Splits an event rotation into what is running now and what is queued.
 *
 * Lives here rather than in the page because it reads the clock: keeping the
 * time-dependent logic in a plain function makes the page component pure and
 * the partitioning testable with a fixed `now`.
 */
export function partitionRotation<T extends { startTime: string }>(
  slots: T[],
  now: number = Date.now(),
): { active: T[]; upcoming: T[] } {
  const active: T[] = [];
  const upcoming: T[] = [];

  for (const slot of slots) {
    const start = parseApiDate(slot.startTime);
    if (start && start.getTime() > now) upcoming.push(slot);
    else active.push(slot);
  }

  upcoming.sort(
    (a, b) =>
      (parseApiDate(a.startTime)?.getTime() ?? 0) -
      (parseApiDate(b.startTime)?.getTime() ?? 0),
  );

  return { active, upcoming };
}

/** Percentage with one decimal, e.g. 0.5432 -> "54.3%". */
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * Minutes elapsed since `value`, or null if it cannot be parsed.
 *
 * Lives here rather than inline in a component because reading the clock during
 * render is impure, and the React Compiler lint correctly rejects it.
 */
export function minutesSince(value: string | Date | null | undefined): number | null {
  if (!value) return null;
  const date = value instanceof Date ? value : parseApiDate(value);
  if (!date) return null;
  return (Date.now() - date.getTime()) / 60_000;
}
