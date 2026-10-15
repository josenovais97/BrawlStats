'use client';

import { Coffee, ExternalLink, Mail, MessagesSquare, Music2, PlayCircle } from 'lucide-react';
import Link from 'next/link';

import { BrandMark } from '@/components/brand-mark';
import { useLocale } from '@/components/i18n/use-locale';
import { localePath, type Locale } from '@/lib/i18n';
import { GooglePlayBadge } from '@/components/store-badges';
import { PLAY_TEST } from '@/lib/bubble-app';
import { CONTACT_EMAIL, SITE_NAME, TIKTOK_PROFILE_URL } from '@/lib/site';

/*
 * Our own app, not the game's (2026-10-15). The footer used to link Brawl
 * Stars on both stores, which sent our visitors to Supercell's listing; it now
 * points at BrawlZone Bubble: the tester page while the Google Play closed
 * test is recruiting, the app page otherwise.
 */
const BUBBLE_PATH = PLAY_TEST.open ? '/bubble/test' : '/bubble';
const BUY_ME_A_COFFEE_URL = 'https://buymeacoffee.com/josenovais';

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
    'Starr Drops': 'Starr Drops', News: 'Noticias', 'Release Notes': 'Notas de versión',
    tagline:
      'Estadísticas de Brawl Stars que te muestran dónde estás. Búsqueda de jugadores y clubes, tier lists y mejores brawlers por mapa, con partidas que recogemos nosotros mismos.',
    follow: 'Síguenos y apóyanos', coffee: 'Invítame a un café', free: 'Gratis, sin anuncios y sin pagos.',
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
    'Starr Drops': 'Starr Drops', News: 'Notícias', 'Release Notes': 'Notas de atualização',
    tagline:
      'Estatísticas de Brawl Stars que mostram onde você está. Busca de jogadores e clubes, tier lists e melhores brawlers por mapa, com partidas que nós mesmos coletamos.',
    follow: 'Siga e apoie', coffee: 'Me pague um café', free: 'Grátis, sem anúncios e sem pagamento.',
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
  follow: 'Follow and support', coffee: 'Buy me a coffee', free: 'Free, ad-free, no paywall.',
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
  return (
    <footer className="relative mt-16 border-t border-border/70 bg-background sm:mt-20">
      {/*
        A single hairline of brand light along the top edge, which is what ties
        the footer to the page above it rather than letting it read as a
        detached slab.
      */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent, color-mix(in srgb, var(--brand) 45%, transparent), color-mix(in srgb, var(--accent) 35%, transparent), transparent)',
        }}
      />

      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        {/*
          Four columns rather than three, and the link groups carry their own
          headings. The old layout put the brand in one column and everything
          else in two, which left three hundred pixels of dead space under the
          store badges while the right-hand column ran on past it — the reason
          the whole block read as unbalanced.
        */}
        {/*
          Every link in the footer has prefetching off, and that is a fix, not a
          micro-optimisation.

          Next prefetches each <Link> the moment it scrolls into view. The
          footer is ~25 links on every page, so reaching the bottom of any page
          fired ~25 requests at once -- on top of the page's own. Measured on
          2026-10-07: one visitor opening the home page and scrolling it once
          sent 112 requests in ten seconds, and Cloudflare's rate limit bans an
          IP at 100. Real visitors were reaching it -- nine in a week -- and
          the reward for reading to the bottom of the page was Error 1015.

          Nobody needs the footer's links instant. They still navigate; the
          next page just loads when it is clicked instead of before.
        */}
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))] lg:gap-8">
          <div className="min-w-0">
            <Link
              href={href('/')}
              prefetch={false}
              className="inline-flex items-center gap-2.5 rounded-lg font-black tracking-tight"
            >
              <BrandMark className="size-7" />
              <span className="display text-xl uppercase">{SITE_NAME}</span>
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">{t('tagline')}</p>

            {/*
              One row of equal-weight links, not three stacked buttons.

              They used to be a filled brand pill above two outlined ones, which
              read as three unrelated calls to action of descending importance —
              and put a donation button at the visual top of the stack. They are
              three ways to follow the same project, so they now look like it.
              The coffee link keeps a warm tint because it is an offer rather
              than a destination, but never the solid brand fill: that belongs
              to the search button, and a donation should not be the loudest
              control on a page about looking up players.
            */}
            <p className="eyebrow mt-7">{t('follow')}</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <a
                href={DISCORD_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-surface-2/50 px-3.5 text-sm font-semibold text-muted transition-colors hover:border-brand/50 hover:text-foreground"
              >
                {/* Generic speech marks rather than Discord's own wordmark:
                    it is a trademark, licensed only for unmodified use. */}
                <MessagesSquare aria-hidden className="size-4" />
                Discord
              </a>
              <a
                href={YOUTUBE_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-surface-2/50 px-3.5 text-sm font-semibold text-muted transition-colors hover:border-brand/50 hover:text-foreground"
              >
                {/* lucide dropped its brand icons, so this is the generic play
                    mark rather than YouTube's own, for the same reason. */}
                <PlayCircle aria-hidden className="size-4" />
                YouTube
              </a>
              <a
                href={TIKTOK_PROFILE_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-surface-2/50 px-3.5 text-sm font-semibold text-muted transition-colors hover:border-brand/50 hover:text-foreground"
              >
                {/* A generic music note rather than TikTok's own mark, for the
                    same reason as Discord and YouTube above: the logo is a
                    trademark, licensed only for unmodified use. */}
                <Music2 aria-hidden className="size-4" />
                TikTok
              </a>
              <a
                href={BUY_ME_A_COFFEE_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-brand/35 bg-brand/10 px-3.5 text-sm font-bold text-brand transition-colors hover:border-brand/60 hover:bg-brand/15"
              >
                <Coffee aria-hidden className="size-4" />
                {t('coffee')}
              </a>
            </div>
            <p className="mt-2.5 text-xs text-muted/80">{t('free')}</p>

          </div>

          {LINK_GROUPS.map((group) => (
            <nav key={group.heading} aria-label={t(group.heading)} className="min-w-0">
              <p className="eyebrow">{t(group.heading)}</p>
              <ul className="mt-3 space-y-0.5">
                {group.links.map(({ href, label }) => (
                  <li key={href}>
                    <Link
                      href={localePath(locale, href)}
                      prefetch={false}
                      className="inline-flex min-h-9 items-center text-sm text-muted transition-colors hover:text-foreground"
                    >
                      {t(label)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/*
          About, contact and attribution together on one quiet line.

          Sources used to sit in a column of navigation styled exactly like it,
          which made "RoyaleAPI proxy" look like a page on this site. They are
          credit, not destinations, so they belong with the disclaimer that is
          also credit.
        */}
        <div className="mt-10 space-y-4 border-t border-border/70 pt-6 text-xs leading-relaxed text-muted">
          {/*
            The store badges close the footer rather than sitting in the brand
            column. Up there they made that column half again as tall as the
            three beside it, so the block ended in a wide empty rectangle; down
            here they balance the attribution line and read as what they are —
            a link out, next to the other links out.
          */}
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <Link
                href={href(BUBBLE_PATH)}
                prefetch={false}
                aria-label={t('googlePlay')}
                className="rounded transition-opacity hover:opacity-80"
              >
                <GooglePlayBadge className="h-9 w-auto" />
              </Link>
            </div>
            <p className="text-muted/80">{t('getGame')}</p>
          </div>

          <div className="flex flex-wrap items-center gap-x-1 gap-y-2 border-t border-border/50 pt-4">
            <Link
              href={href('/about')}
              prefetch={false}
              className="transition-colors hover:text-foreground"
            >
              {t('about')} {SITE_NAME}
            </Link>
            <Dot />
            <Link href={href('/privacy')} prefetch={false} className="transition-colors hover:text-foreground">
              {t('privacy')}
            </Link>
            <Dot />
            <Link href={href('/terms')} prefetch={false} className="transition-colors hover:text-foreground">
              {t('terms')}
            </Link>
            <Dot />
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
            >
              <Mail aria-hidden className="size-3.5 shrink-0" />
              {t('contact')}
            </a>
            <Dot />
            <span className="text-muted/80">{t('sources')}</span>
            {SOURCES.map((source, index) => (
              <span key={source.href} className="inline-flex items-center gap-1">
                <a
                  href={source.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                >
                  {source.label}
                  <ExternalLink aria-hidden className="size-3 shrink-0" />
                </a>
                {index < SOURCES.length - 1 ? <Dot /> : null}
              </span>
            ))}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-2xl">
              {t('disclaimer')}{' '}
              <a
                href={FAN_CONTENT_POLICY_URL}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-border underline-offset-4 transition-colors hover:text-foreground hover:decoration-brand"
              >
                {t('policy')}
              </a>
              .
            </p>
            <p className="shrink-0 text-muted/80">
              {SITE_NAME} &middot; {t('notAffiliated')}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

/** The separator between attribution links, so they read as one sentence. */
function Dot() {
  return (
    <span aria-hidden className="px-0.5 text-muted/40">
      &middot;
    </span>
  );
}
