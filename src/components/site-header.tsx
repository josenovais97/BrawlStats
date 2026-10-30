'use client';

import { ChevronDown, Menu, Search, X } from 'lucide-react';
import Link from 'next/link';
import { ShareButton } from '@/components/player/share-button';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { BrandMark } from '@/components/brand-mark';
import { LanguageMenu } from '@/components/i18n/language-menu';
import { useLocale } from '@/components/i18n/use-locale';
import { localePath, stripLocale, type Locale } from '@/lib/i18n';
import { SITE_NAME } from '@/lib/site';
import { CoinIcon,
  RewardsIcon,
  Battle3v3Icon,
  BubbleAppIcon,
  BrawlersIcon,
  BuffieIcon,
  ClockIcon,
  ClubIcon,
  CosmeticsIcon,
  CompareIcon,
  DraftIcon,
  EventsIcon,
  LeaderboardIcon,
  MapsIcon,
  NewsIcon,
  RankedIcon,
  DailyChallengeIcon,
  ReleaseNotesIcon,
  StarPowerIcon,
  StarrDropIcon,
  TierListIcon,
  TrophyGainIcon,
} from '@/components/game-icons';

interface NavItem {
  href: string;
  /** Overrides `href` for the active check, when an entry links into a section. */
  match?: string;
  label: string;
  /*
   * Structural rather than a lucide type: the game-artwork icons are our own
   * components, not lucide forwardRefs, and a `className` is all the two share.
   */
  icon: (props: { className?: string }) => React.ReactNode;
}

/**
 * The desktop bar fits six labelled items beside the wordmark and the search
 * button, and not one more: at ten it wrapped "Tier List" and "Release Notes"
 * onto two lines each and pushed the bar to double height.
 *
 * So the bar is curated rather than complete. These six are the destinations
 * worth a permanent slot — the ones people arrive looking for.
 */
const NAV: NavItem[] = [
  { href: '/brawlers', label: 'Brawlers', icon: BrawlersIcon },
  // Points straight at the Ranked list so the nav does not bounce through the
  // /tier-list redirect, but stays highlighted on the trophy list too.
  { href: '/tier-list/ranked', match: '/tier-list', label: 'Tier List', icon: TierListIcon },
  { href: '/ranked', label: 'Ranked', icon: RankedIcon },
  { href: '/maps', label: 'Maps', icon: MapsIcon },
  { href: '/draft', label: 'Draft', icon: DraftIcon },
  { href: '/leaderboard', label: 'Leaderboard', icon: LeaderboardIcon },
];

/**
 * Everything else, behind "More".
 *
 * Not a junk drawer: each of these is either reached from somewhere more
 * relevant (a map page links to the Ranked map board, a brawler page to a
 * comparison) or is a page people come back to rather than look for.
 */
const MORE: NavItem[] = [
  // Team comps answers a question people ask before a match rather than after
  // one, so it would earn a permanent slot if there were a seventh. There is
  // not — see above — and the draft helper is the main bar's entry point into
  // the same question.
  { href: '/bubble', label: 'Android App', icon: BubbleAppIcon },
  { href: '/daily', label: 'Daily', icon: ClockIcon },
  { href: '/comps', label: 'Team Comps', icon: Battle3v3Icon },
  { href: '/meta', label: 'Meta Report', icon: TrophyGainIcon },
  // A star power is the strength a brawler has that its base kit does not
  // show, which is the whole subject of the page.
  { href: '/hidden-meta', label: 'Hidden Meta', icon: StarPowerIcon },
  { href: '/daily-challenge', label: 'Daily Challenge', icon: DailyChallengeIcon },
  // Next to the meta report because it is the other half of the same question:
  // that one says what moved this week, this one says whether the update did
  // it. /meta links straight here from its own update section.
  // Buffie is the game's own mark for a balance change, which is exactly what
  // this page measures. It was the last nav entry drawing a generic line icon,
  // and the only non-game icon left in the menu.
  { href: '/patches', label: 'Patch Impact', icon: BuffieIcon },
  // "Community events", not "Events": the live rotation left this page on
  // 2026-09-24 and a label promising it would be a broken promise. What is
  // here now is the game-wide challenges, which nothing else on the site or
  // anywhere else publishes as a set.
  { href: '/events', label: 'Community Events', icon: EventsIcon },
  /*
   * Clubs had full pages and no way in from anywhere but a profile's club
   * chip. The board is the honest destination: there is no club index to point
   * at, and the leaderboard's Clubs tab is the closest thing to one.
   *
   * Player rows elsewhere still show club names as plain text, and that is not
   * an oversight — the game's ranking payload carries `club.name` with no tag,
   * so there is no URL to link to. Only a profile knows its club's tag.
   */
  { href: '/leaderboard/clubs', match: '/club', label: 'Clubs', icon: ClubIcon },
  { href: '/compare', label: 'Compare', icon: CompareIcon },
  { href: '/tier-list/maker', label: 'Tier List Maker', icon: TierListIcon },
  { href: '/account-value', label: 'Account Value', icon: CoinIcon },
  { href: '/rewards', label: 'Free Rewards', icon: RewardsIcon },
  { href: '/starr-drops', label: 'Starr Drops', icon: StarrDropIcon },
  { href: '/cosmetics', label: 'Cosmetics', icon: CosmeticsIcon },
  { href: '/news', label: 'News', icon: NewsIcon },
  { href: '/release-notes', label: 'Release Notes', icon: ReleaseNotesIcon },
];

/** The mobile panel has room for the lot, so it never hides anything. */
const ALL_NAV: NavItem[] = [...NAV, ...MORE];

/** The menu in Spanish and Portuguese, by English label. */
const LABELS: Record<Exclude<Locale, 'en'>, Record<string, string>> = {
  es: {
    Brawlers: 'Brawlers',
    'Tier List': 'Tier list',
    Ranked: 'Competitivo',
    Maps: 'Mapas',
    Draft: 'Draft',
    Leaderboard: 'Rankings',
    'Android App': 'App para Android',
    Daily: 'Diario',
    'Team Comps': 'Equipos',
    'Meta Report': 'Informe del meta',
    'Hidden Meta': 'Meta oculto',
    'Daily Challenge': 'Reto diario',
    'Patch Impact': 'Impacto de parches',
    'Community Events': 'Eventos de la comunidad',
    Clubs: 'Clubes',
    Compare: 'Comparar',
    'Tier List Maker': 'Crear tier list',
    'Account Value': 'Valor de la cuenta',
    'Free Rewards': 'Recompensas gratis',
    'Starr Drops': 'Starr Drops',
    Cosmetics: 'Cosméticos',
    News: 'Noticias',
    'Release Notes': 'Notas de versión',
    More: 'Más',
    Search: 'Buscar',
    searchLabel: 'Buscar un jugador o club',
    shareText: 'Estadísticas de Brawl Stars en BrawlZone',
    home: 'Inicio de BrawlZone',
    open: 'Abrir menú',
    close: 'Cerrar menú',
    main: 'Principal',
  },
  pt: {
    Brawlers: 'Brawlers',
    'Tier List': 'Tier list',
    Ranked: 'Ranqueado',
    Maps: 'Mapas',
    Draft: 'Draft',
    Leaderboard: 'Rankings',
    'Android App': 'App para Android',
    Daily: 'Diário',
    'Team Comps': 'Times',
    'Meta Report': 'Relatório do meta',
    'Hidden Meta': 'Meta oculto',
    'Daily Challenge': 'Desafio diário',
    'Patch Impact': 'Impacto dos patches',
    'Community Events': 'Eventos da comunidade',
    Clubs: 'Clubes',
    Compare: 'Comparar',
    'Tier List Maker': 'Criar tier list',
    'Account Value': 'Valor da conta',
    'Free Rewards': 'Recompensas grátis',
    'Starr Drops': 'Starr Drops',
    Cosmetics: 'Cosméticos',
    News: 'Notícias',
    'Release Notes': 'Notas de atualização',
    More: 'Mais',
    Search: 'Buscar',
    searchLabel: 'Buscar um jogador ou clube',
    shareText: 'Estatísticas de Brawl Stars no BrawlZone',
    home: 'Início do BrawlZone',
    open: 'Abrir menu',
    close: 'Fechar menu',
    main: 'Principal',
  },
};

const EN_EXTRA: Record<string, string> = {
  searchLabel: 'Search a player or club',
  shareText: 'Brawl Stars stats on BrawlZone',
  home: 'BrawlZone home',
  open: 'Open menu',
  close: 'Close menu',
  main: 'Main',
};

function word(locale: Locale, english: string): string {
  return locale === 'en' ? (EN_EXTRA[english] ?? english) : (LABELS[locale][english] ?? english);
}

/** `match` overrides `href` when a nav entry links into a section. */
function isActive(pathname: string, href: string, match?: string) {
  const prefix = match ?? href;
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function SiteHeader() {
  const locale = useLocale();
  const t = (english: string) => word(locale, english);
  const href = (path: string) => localePath(locale, path);
  // Active-tab matching runs on the English path, so /es/maps lights Maps.
  const rawPath = usePathname();
  const pathname = stripLocale(rawPath);
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [lastPath, setLastPath] = useState(rawPath);

  // Any route change closes both panels, including a browser back that no link
  // handler ever sees. Adjusting during render rather than in an effect keeps
  // the closed panel out of the committed frame.
  if (lastPath !== rawPath) {
    setLastPath(rawPath);
    setOpen(false);
    setMoreOpen(false);
  }

  const moreActive = MORE.some((item) => isActive(pathname, item.href, item.match));

  return (
    <header className="sticky top-0 z-40">
      {/* The game's top bar (2026-10-30): solid, lit from above, on a thick
          dark edge. It used to be a see-through veil that faded in on scroll,
          which read as a web page's header rather than a game's. */}
      <span aria-hidden className="game-bar pointer-events-none absolute inset-0 -z-10" />

      <div className="relative mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href={href('/')}
          className="group flex shrink-0 items-center gap-2.5"
          aria-label={t('home')}
        >
          <BrandMark className="size-9 shrink-0 transition-transform duration-200 group-hover:-rotate-6" />
          <span className="display text-game-stroke text-xl uppercase leading-none tracking-wide">
            Brawl<span className="text-brand">Zone</span>
          </span>
        </Link>

        {/*
          Icons are dropped from the desktop bar on purpose: six labelled items
          plus a brand plus a button is already the full width, and the icons
          were what pushed it into overflow between 768px and 1100px.

          `whitespace-nowrap` is the backstop. Without it a label that no longer
          fits breaks across two lines rather than overflowing, which doubles the
          height of the whole bar and is far harder to notice in review than a
          crowded one.
        */}
        <nav aria-label={t('main')} className="ml-auto hidden items-center lg:flex">
          {NAV.map(({ href: path, match, label }) => {
            const active = isActive(pathname, path, match);
            return (
              <Link
                key={path}
                href={href(path)}
                aria-current={active ? 'page' : undefined}
                className={`whitespace-nowrap px-3 py-1.5 text-[0.9375rem] ${
                  active ? 'bz-chip-on' : 'nav-game'
                }`}
              >
                {t(label)}
              </Link>
            );
          })}

          <div className="relative">
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              aria-expanded={moreOpen}
              aria-haspopup="true"
              className={`flex items-center gap-1 whitespace-nowrap px-3 py-1.5 text-[0.9375rem] ${
                moreActive ? 'bz-chip-on' : moreOpen ? 'nav-game text-white' : 'nav-game'
              }`}
            >
              {t('More')}
              <ChevronDown
                className={`size-3.5 transition-transform ${moreOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {moreOpen ? (
              <>
                {/* Catches the click that should dismiss the menu. Sits under
                    the panel and over everything else, which is the cheapest
                    correct way to do outside-click without a global listener. */}
                <button
                  type="button"
                  tabIndex={-1}
                  aria-hidden
                  onClick={() => setMoreOpen(false)}
                  className="fixed inset-0 z-0 cursor-default"
                />
                <ul className="card absolute right-0 z-10 mt-2 grid w-56 gap-2 p-2">
                  {MORE.map(({ href: path, match, label, icon: Icon }) => {
                    const active = isActive(pathname, path, match);
                    return (
                      <li key={path}>
                        <Link
                          href={href(path)}
                          aria-current={active ? 'page' : undefined}
                          onClick={() => setMoreOpen(false)}
                          className={`flex items-center gap-2.5 px-3 py-2 text-[0.9375rem] ${
                            active ? 'bz-chip-on' : 'bz-chip hover:text-white'
                          }`}
                        >
                          <Icon className="size-4 shrink-0" />
                          {t(label)}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : null}
          </div>

          <div className="ml-1">
            <LanguageMenu />
          </div>

          <Link
            href={`${href('/')}#search`}
            className="btn-game ml-2 inline-flex shrink-0 items-center gap-2 whitespace-nowrap bg-brand px-3.5 py-1.5 text-[0.9375rem] text-brand-ink hover:bg-brand-strong"
          >
            <Search className="size-4" />
            {t('Search')}
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:hidden">
          <LanguageMenu compact />
          <Link
            href={`${href('/')}#search`}
            aria-label={t('searchLabel')}
            className="btn-game grid size-10 place-items-center bg-brand text-brand-ink"
          >
            <Search className="size-5" />
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? t('close') : t('open')}
            aria-expanded={open}
            aria-controls="mobile-nav"
            className={`grid size-10 place-items-center ${open ? 'bz-chip-on' : 'bz-chip hover:text-white'}`}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {open ? (
        <nav
          id="mobile-nav"
          aria-label={t('main')}
          className="game-drawer lg:hidden"
        >
          {/*
            One column below 380px: "Release Notes" and "Leaderboard" both get
            clipped in a two-column grid on the narrowest phones.
          */}
          {/* Sharing, first on a phone (three quarters of visitors): the bar
              itself has no room for a fourth button at 360px. */}
          <div className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6">
            <ShareButton title={SITE_NAME} text={t('shareText')} />
          </div>
          <ul className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-2 px-4 py-4 min-[380px]:grid-cols-2 sm:px-6">
            {ALL_NAV.map(({ href: path, match, label, icon: Icon }) => {
              const active = isActive(pathname, path, match);
              return (
                <li key={path}>
                  <Link
                    href={href(path)}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 text-base ${
                      active ? 'bz-chip-on' : 'bz-chip hover:text-white'
                    }`}
                  >
                    <Icon className="size-5 shrink-0" />
                    <span className="truncate">{t(label)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
