import type { NextRequest } from 'next/server';

import { brawlerIconUrl } from '@/lib/brawlapi';
import { getBrawlerArtMap } from '@/lib/brawler-catalog';
import { appNames } from '@/lib/bubble-app-l10n';
import { okResponse } from '@/lib/route-helpers';
import { SITE_URL } from '@/lib/site';

/**
 * Every brawler with its portrait, in the app's language (1.42): the "Bubble
 * face" picker, where a player wears any brawler instead of their icon.
 */

export const revalidate = 86400;

export async function GET(request: NextRequest) {
  const [art, name] = await Promise.all([getBrawlerArtMap().catch(() => new Map()), appNames(request.nextUrl.searchParams.get('lang'))]);
  const brawlers = [...art.entries()]
    .map(([id, b]) => ({ id, name: name(b.name ?? ''), icon: absolute(b.imageUrl ?? brawlerIconUrl(id)) }))
    .filter((b) => b.name && b.icon)
    .sort((a, b) => a.name.localeCompare(b.name));
  return okResponse({ brawlers }, 86400);
}

function absolute(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith('http') ? url : `${SITE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}
