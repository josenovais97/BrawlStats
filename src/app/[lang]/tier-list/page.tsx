import { notFound, redirect } from 'next/navigation';

import { isIntlLocale } from '@/lib/i18n';

/** As in English: the bare tier list opens on Ranked. */
export default async function IntlTierListIndexPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isIntlLocale(lang)) notFound();
  redirect(`/${lang}/tier-list/ranked`);
}
