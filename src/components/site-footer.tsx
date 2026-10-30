'use client';

import { Camera, Coffee, Mail, MessageCircle, MessagesSquare, Music2, PlayCircle } from 'lucide-react';
import Link from 'next/link';

import { BrandMark } from '@/components/brand-mark';
import { useLocale } from '@/components/i18n/use-locale';
import { localePath, type Locale } from '@/lib/i18n';
import { GooglePlayBadge } from '@/components/store-badges';
import { PLAY_LIVE, PLAY_TEST } from '@/lib/bubble-app';
import { BUY_ME_A_COFFEE_URL, CONTACT_EMAIL, SITE_NAME, TIKTOK_PROFILE_URL, WHATSAPP_URL } from '@/lib/site';

/*
 * Our own app, not the game's (2026-10-15). The footer used to link Brawl
 * Stars on both stores, which sent our visitors to Supercell's listing; it now
 * points at BrawlZone Bubble: the tester page while the Google Play closed
 * test is recruiting, the app page otherwise.
 */
const BUBBLE_PATH = PLAY_TEST.open ? '/bubble/test' : '/bubble';

/**
 * `?sub_confirmation=1` opens YouTube's subscribe dialog straight away rather
 * than dropping the visitor on the channel to find the button themselves.
 */
const YOUTUBE_URL = 'https://www.youtube.com/@brawlzonenet?sub_confirmation=1';

/**
 * The community server.
 *
 * This one is permanent — verified against Discord's API rather than assumed,
 * because the two invites before it were both created as "never expiring" and
 * both came back with a 30-day expiry.
 *
 * `brawlzone-healthcheck` still queries it every ten minutes. A permanent
 * invite cannot lapse, but it can be revoked, and the channel it points at can
 * be deleted — either of which leaves a dead link on every page of the site
 * with nothing else to notice. The check reads the code out of this file, so
 * changing the constant is all it takes to move it.
 *
 * If you are reading this because that alert fired: make a new invite with no
 * expiry and no use limit, put the code below, and the alert stops on its own.
 */
const DISCORD_URL = 'https://discord.gg/964EMQBBUJ';

/** Every daily carousel goes out here as a Reel too, since 2026-10-20. */
const INSTAGRAM_URL = 'https://www.instagram.com/brawlzonenet/';



const FAN_CONTENT_POLICY_URL = 'https://supercell.com/en/fan-content-policy/';

/**
 * Where every route on the site is reachable from, grouped by what it is for.
 *
 * One list of fifteen links was the problem rather than the styling. Rendered
 * two-up it came out ragged — seven items beside six, with "Release Notes"
 * dangling under an empty cell — and it asked the reader to scan an
 * alphabet-soup of page names for the one they wanted. Three named groups of
 * five are the same links doing an extra job: the headings say what the site
 * actually offers before a single link is read.
 *
 * Only routes that exist are listed. A footer link to a page that 404s is worse
 * than no footer link, and it is the kind of thing that rots quietly.
 */
const LINK_GROUPS: { heading: string; links: { href: string; label: string }[] }[] = [
  {
    heading: 'Stats',
    links: [
      { href: '/brawlers', label: 'Brawlers' },
      { href: '/tier-list/ranked', label: 'Tier List' },
      { href: '/ranked', label: 'Ranked Maps' },
      { href: '/maps', label: 'Maps' },
      { href: '/leaderboard', label: 'Leaderboard' },
    ],
  },
  {
    heading: 'Tools',
    links: [
      { href: '/draft', label: 'Draft' },
      { href: '/comps', label: 'Team Comps' },
      { href: '/compare', label: 'Compare' },
      { href: '/daily', label: 'Daily' },
      { href: '/meta', label: 'Meta Report' },
      { href: '/hidden-meta', label: 'Hidden Meta' },
      { href: '/daily-challenge', label: 'Daily Challenge' },
      { href: '/patches', label: 'Patch Impact' },
      { href: '/meta-score', label: 'How Scores Work' },
      { href: '/bubble', label: 'Android App' },
    ],
  },
  {
    heading: 'Game',
    links: [
      { href: '/rewards', label: 'Free Rewards' },
      { href: '/events', label: 'Community Events' },
      { href: '/cosmetics', label: 'Cosmetics' },
      { href: '/starr-drops', label: 'Starr Drops' },
      { href: '/news', label: 'News' },
      { href: '/release-notes', label: 'Release Notes' },
    ],
  },
];

/**
 * Where the numbers and the artwork come from. Required attribution.
 *
 * The wiki was missing from this list while supplying class, rarity, every
 * combat stat, ability text, prestige titles and the artwork for brawlers the
 * mirror has not published — which is most of what a brawler page shows.
 * Crediting three of four sources is not crediting the sources.
 */
/**
 * The footer's words. A client component only so it can read the page's
 * language from the address: the root layout renders it without the route.
 */
const WORDS: Record<Locale, Record<string, string>> = {
  en: {},
  es: {
    Stats: 'Estadísticas', Tools: 'Herramientas', Game: 'Juego',
    Brawlers: 'Brawlers', 'Tier List': 'Tier list', 'Ranked Maps': 'Mapas de Competitivo', Maps: 'Mapas',
    Leaderboard: 'Rankings', Draft: 'Draft', 'Team Comps': 'Equipos', Compare: 'Comparar', Daily: 'Diario',
    'Meta Report': 'Informe del meta', 'Hidden Meta': 'Meta oculto', 'Daily Challenge': 'Reto diario',
    'Patch Impact': 'Impacto de parches', 'How Scores Work': 'Cómo funcionan las puntuaciones',
    'Android App': 'App para Android', 'Community Events': 'Eventos de la comunidad', Cosmetics: 'Cosméticos',
    'Starr Drops': 'Starr Drops', News: 'Noticias', 'Release Notes': 'Notas de versión', 'Free Rewards': 'Recompensas gratis',
    tagline:
      'Estadísticas de Brawl Stars que te muestran dónde estás. Búsqueda de jugadores y clubes, tier lists y mejores brawlers por mapa, con partidas que recogemos nosotros mismos.',
    follow: 'Síguenos y apóyanos', coffee: 'Invítame a un café', free: 'Gratis y sin pagos.',
    googlePlay: 'BrawlZone Bubble en Google Play',
    getGame: 'BrawlZone Bubble: el asistente de draft que flota sobre el juego. Gratis.', about: 'Sobre', privacy: 'Privacidad',
    terms: 'Términos', contact: 'Contacto', sources: 'Datos e imágenes de',
    disclaimer: 'Este material no es oficial y no está respaldado por Supercell. Para más información, consulta la',
    policy: 'Política de contenido de fans de Supercell', notAffiliated: 'sin relación con Supercell',
  },
  pt: {
    Stats: 'Estatísticas', Tools: 'Ferramentas', Game: 'Jogo',
    Brawlers: 'Brawlers', 'Tier List': 'Tier list', 'Ranked Maps': 'Mapas do Ranqueado', Maps: 'Mapas',
    Leaderboard: 'Rankings', Draft: 'Draft', 'Team Comps': 'Times', Compare: 'Comparar', Daily: 'Diário',
    'Meta Report': 'Relatório do meta', 'Hidden Meta': 'Meta oculto', 'Daily Challenge': 'Desafio diário',
    'Patch Impact': 'Impacto dos patches', 'How Scores Work': 'Como as pontuações funcionam',
    'Android App': 'App para Android', 'Community Events': 'Eventos da comunidade', Cosmetics: 'Cosméticos',
    'Starr Drops': 'Starr Drops', News: 'Notícias', 'Release Notes': 'Notas de atualização', 'Free Rewards': 'Recompensas grátis',
    tagline:
      'Estatísticas de Brawl Stars que mostram onde você está. Busca de jogadores e clubes, tier lists e melhores brawlers por mapa, com partidas que nós mesmos coletamos.',
    follow: 'Siga e apoie', coffee: 'Me pague um café', free: 'Grátis e sem pagamento.',
    googlePlay: 'BrawlZone Bubble no Google Play',
    getGame: 'BrawlZone Bubble: o ajudante de draft que flutua sobre o jogo. Grátis.', about: 'Sobre o', privacy: 'Privacidade',
    terms: 'Termos', contact: 'Contato', sources: 'Dados e imagens de',
    disclaimer: 'Este material não é oficial e não é endossado pela Supercell. Para mais informações, veja a',
    policy: 'Política de Conteúdo de Fãs da Supercell', notAffiliated: 'sem ligação com a Supercell',
  },
};

const EN: Record<string, string> = {
  tagline:
    'Brawl Stars stats that show where you stand. Player and club lookups, tier lists and map picks, from battles we sample ourselves.',
  follow: 'Follow and support', coffee: 'Buy me a coffee', free: 'Free, no paywall.',
  googlePlay: 'BrawlZone Bubble on Google Play',
  getGame: 'BrawlZone Bubble: the draft helper that floats over the game. Free.', about: 'About', privacy: 'Privacy', terms: 'Terms',
  contact: 'Contact', sources: 'Data and artwork from',
  disclaimer: 'This material is unofficial and is not endorsed by Supercell. For more information see',
  policy: 'Supercell’s Fan Content Policy', notAffiliated: 'not affiliated with Supercell',
};

const SOURCES = [
  { href: 'https://developer.brawlstars.com', label: 'Brawl Stars API' },
  { href: 'https://docs.royaleapi.com/proxy.html', label: 'RoyaleAPI proxy' },
  { href: 'https://brawlify.com', label: 'Brawlify artwork' },
  { href: 'https://brawlstars.fandom.com', label: 'Brawl Stars Wiki' },
];

export function SiteFooter() {
  const locale = useLocale();
  const t = (key: string) => WORDS[locale][key] ?? EN[key] ?? key;
  const href = (path: string) => localePath(locale, path);
  const chip = 'bz-chip inline-flex min-h-10 items-center gap-2 px-3.5 text-sm';
  /*
    Rebuilt 2026-10-30 in the game-menu style: the brand and the channels on
    one row, the three link groups three across even on a phone (they ran two
    and a half screens stacked), the Play badge once, and the legal lines in
    one quiet block. Every link keeps prefetch off: ~25 links scrolling into
    view at once used to trip the per-IP rate limit (2026-10-07).
  */
  return (
    <footer className="site-footer relative mt-16 sm:mt-24">
      <div className="mx-auto w-full max-w-6xl px-4 pb-10 pt-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-sm">
            <Link href={href('/')} prefetch={false} className="inline-flex items-center gap-2.5">
              <BrandMark className="size-8" />
              <span className="display text-game-stroke text-2xl">{SITE_NAME}</span>
            </Link>
            <p className="mt-2 text-sm leading-relaxed text-muted">{t('tagline')}</p>
          </div>
          {/* Generic icons, not the networks' own marks: those are trademarks
              licensed only for unmodified use. */}
          <div className="flex flex-wrap gap-2 lg:max-w-md lg:justify-end">
            <a href={DISCORD_URL} target="_blank" rel="noreferrer" className={chip}>
              <MessagesSquare aria-hidden className="size-4" />Discord
            </a>
            <a href={YOUTUBE_URL} target="_blank" rel="noreferrer" className={chip}>
              <PlayCircle aria-hidden className="size-4" />YouTube
            </a>
            <a href={TIKTOK_PROFILE_URL} target="_blank" rel="noreferrer" className={chip}>
              <Music2 aria-hidden className="size-4" />TikTok
            </a>
            <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer" className={chip}>
              <Camera aria-hidden className="size-4" />Instagram
            </a>
            <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className={chip}>
              <MessageCircle aria-hidden className="size-4" />WhatsApp
            </a>
            <a href={BUY_ME_A_COFFEE_URL} target="_blank" rel="noreferrer" className={`${chip.replace('bz-chip', 'bz-chip-on')}`}>
              <Coffee aria-hidden className="size-4" />{t('coffee')}
            </a>
          </div>
        </div>

        <div className="mt-9 grid grid-cols-3 gap-x-4 gap-y-8 lg:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,1.2fr)]">
          {LINK_GROUPS.map((group) => (
            <nav key={group.heading} aria-label={t(group.heading)} className="min-w-0">
              <p className="display text-lg text-foreground">{t(group.heading)}</p>
              <ul className="mt-2">
                {group.links.map(({ href: path, label }) => (
                  <li key={path}>
                    <Link
                      href={localePath(locale, path)}
                      prefetch={false}
                      className="inline-flex min-h-8 items-center text-[13px] leading-tight text-muted transition-colors hover:text-foreground sm:text-sm"
                    >
                      {t(label)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
          <div className="col-span-3 flex flex-wrap items-center gap-4 lg:col-span-1 lg:flex-col lg:items-start">
            {PLAY_LIVE ? (
              <a
                href={PLAY_TEST.listingUrl}
                rel="noopener"
                data-umami-event="play_store"
                data-umami-event-from="footer"
                aria-label={t('googlePlay')}
                className="rounded transition-opacity hover:opacity-80"
              >
                <GooglePlayBadge className="h-10 w-auto" />
              </a>
            ) : (
              <Link
                href={href(BUBBLE_PATH)}
                prefetch={false}
                data-umami-event="playtest_entry"
                data-umami-event-from="footer"
                aria-label={t('googlePlay')}
                className="rounded transition-opacity hover:opacity-80"
              >
                <GooglePlayBadge className="h-10 w-auto" />
              </Link>
            )}
            <p className="max-w-xs text-sm text-muted">{t('getGame')}</p>
          </div>
        </div>

        {/* Credit and the legal lines: what they are, not destinations. */}
        <div className="mt-9 space-y-3 border-t-2 border-[var(--ink)] pt-5 text-xs leading-relaxed text-muted">
          <p className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <Link href={href('/about')} prefetch={false} className="font-semibold text-foreground hover:text-brand">
              {t('about')} {SITE_NAME}
            </Link>
            <Link href={href('/privacy')} prefetch={false} className="hover:text-foreground">{t('privacy')}</Link>
            <Link href={href('/terms')} prefetch={false} className="hover:text-foreground">{t('terms')}</Link>
            <a href={`mailto:${CONTACT_EMAIL}`} className="inline-flex items-center gap-1.5 hover:text-foreground">
              <Mail aria-hidden className="size-3.5 shrink-0" />{t('contact')}
            </a>
          </p>
          <p>
            {t('sources')}{' '}
            {SOURCES.map((source, index) => (
              <span key={source.href}>
                <a href={source.href} target="_blank" rel="noreferrer" className="underline decoration-border underline-offset-2 hover:text-foreground">
                  {source.label}
                </a>
                {index < SOURCES.length - 1 ? ', ' : '.'}
              </span>
            ))}
          </p>
          <p className="max-w-3xl">
            {t('disclaimer')}{' '}
            <a
              href={FAN_CONTENT_POLICY_URL}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-border underline-offset-2 hover:text-foreground"
            >
              {t('policy')}
            </a>
            . {SITE_NAME} {t('notAffiliated')}.
          </p>
        </div>
      </div>
    </footer>
  );
}
