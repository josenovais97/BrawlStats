'use client';

import { ArrowLeft, Compass } from 'lucide-react';
import Link from 'next/link';

import { useLocale } from '@/components/i18n/use-locale';
import { FullPageMessage } from '@/components/ui/full-page-message';
import { localePath } from '@/lib/i18n';

const WORDS = {
  en: {
    title: 'Page not found',
    body: 'This page does not exist, or it did once and no longer does. Maps and modes rotate, so an old link can outlive the thing it pointed at.',
    back: 'Back to search',
    tiers: 'Tier list',
  },
  es: {
    title: 'Página no encontrada',
    body: 'Esta página no existe, o existió y ya no. Los mapas y los modos rotan, así que un enlace viejo puede durar más que aquello a lo que apuntaba.',
    back: 'Volver a buscar',
    tiers: 'Tier list',
  },
  pt: {
    title: 'Página não encontrada',
    body: 'Esta página não existe, ou existiu e não existe mais. Mapas e modos mudam, então um link antigo pode durar mais do que aquilo para onde apontava.',
    back: 'Voltar para a busca',
    tiers: 'Tier list',
  },
};

/** The 404, in the language of the address that was asked for. */
export function NotFoundBody() {
  const locale = useLocale();
  const w = WORDS[locale];
  return (
    <FullPageMessage title={w.title} body={w.body}>
      <Link
        href={localePath(locale, '/')}
        className="btn-game inline-flex items-center gap-2 bg-brand px-6 py-3 uppercase text-[#1a1200] hover:bg-brand-strong"
      >
        <ArrowLeft className="size-4" />
        {w.back}
      </Link>
      <Link
        href={localePath(locale, '/tier-list/ranked')}
        className="inline-flex items-center gap-2 rounded-xl border border-border px-6 py-3 font-medium text-muted transition-colors hover:border-brand/50 hover:text-foreground"
      >
        <Compass className="size-4" />
        {w.tiers}
      </Link>
    </FullPageMessage>
  );
}
