'use client';

import { Check, ImageDown, Loader2 } from 'lucide-react';
import { useState } from 'react';

import { useLocale } from '@/components/i18n/use-locale';
import { useT } from '@/components/i18n/use-t';

/**
 * Shares a ready-made picture (a profile card, a tier list) rather than a link.
 *
 * On a phone, where three quarters of the site's visitors are, it hands the
 * image to the system share sheet -- Instagram or TikTok stories, WhatsApp
 * status, Discord -- through the Web Share API's file support. Where that is
 * missing (most desktops) it downloads the file instead, so the click always
 * produces the picture. `src` is the image route without its last segment; the
 * page's language is appended as that segment (`.../story/pt`).
 *
 * Counted as an anonymous `share_image` event with its kind, like the APK
 * download, so we can see whether anyone uses it.
 */
export function ShareImageButton({
  src,
  fileName,
  kind,
  label,
  query,
  disabled = false,
  className = '',
}: {
  src: string;
  /** Appended after the language segment, for images drawn from state (the tier maker's board). */
  query?: string;
  disabled?: boolean;
  fileName: string;
  kind: string;
  label?: string;
  className?: string;
}) {
  const t = useT();
  const locale = useLocale();
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');

  async function share() {
    if (state === 'busy') return;
    setState('busy');
    let how = 'download';
    try {
      const url = `${src}/${locale}${query ? `?${query}` : ''}`;
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], fileName, { type: blob.type || 'image/png' });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        how = 'share';
        try {
          await nav.share({ files: [file] });
        } catch {
          // The sheet was dismissed: not an error, and nothing else to do.
        }
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(file);
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      }
      try {
        (window as Window & { umami?: { track: (e: string, d?: Record<string, unknown>) => void } }).umami?.track(
          'share_image',
          { kind, how },
        );
      } catch {}
      setState('done');
      setTimeout(() => setState('idle'), 2500);
    } catch {
      setState('idle');
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      disabled={disabled || state === 'busy'}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-3.5 py-2 text-sm font-bold text-brand-ink transition-opacity hover:opacity-90 disabled:opacity-70 ${className}`}
    >
      {state === 'busy' ? (
        <Loader2 aria-hidden className="size-4 animate-spin" />
      ) : state === 'done' ? (
        <Check aria-hidden className="size-4" />
      ) : (
        <ImageDown aria-hidden className="size-4" />
      )}
      {state === 'busy' ? t('Making your image…') : label ?? t('Share as image')}
    </button>
  );
}
