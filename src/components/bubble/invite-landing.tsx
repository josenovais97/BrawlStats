'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

/**
 * The invite card (1.42, see app/bubble/invite). Its words are here in the
 * site's seven languages rather than in the dictionaries, because the page is
 * one static URL: the language comes from the inviter's app (`l=` in the
 * hash) or the visitor's browser.
 */

const PACKAGE = 'net.brawlzone.bubble';
const CODE = /^[2-9A-HJKMNP-Z]{8}$/;

type Words = { invited: string; someone: string; pitch: string; accept: string; play: string; after: string; android: string; bad: string };
const WORDS: Record<string, Words> = {
  en: {
    invited: '{name} invited you',
    someone: 'A friend invited you',
    pitch: 'Race each other up Ranked with BrawlZone Bubble: the free app that floats over Brawl Stars with the best picks for your map.',
    accept: 'Accept the invite',
    play: 'Get it on Google Play',
    after: 'Open the app after installing: {name} is on your friends ladder already.',
    android: 'BrawlZone Bubble is an Android app. Open this link on your Android phone.',
    bad: 'This invite link is not complete. Ask your friend to send it again.',
  },
  es: {
    invited: '{name} te ha invitado',
    someone: 'Un amigo te ha invitado',
    pitch: 'Compite con tu amigo en Clasificatoria con BrawlZone Bubble: la app gratis que flota sobre Brawl Stars con las mejores elecciones para tu mapa.',
    accept: 'Aceptar la invitación',
    play: 'Consíguela en Google Play',
    after: 'Abre la app después de instalarla: {name} ya estará en tu clasificación de amigos.',
    android: 'BrawlZone Bubble es una app para Android. Abre este enlace en tu móvil Android.',
    bad: 'Este enlace de invitación no está completo. Pide a tu amigo que lo envíe otra vez.',
  },
  pt: {
    invited: '{name} te convidou',
    someone: 'Um amigo te convidou',
    pitch: 'Dispute o Ranqueado com seu amigo usando o BrawlZone Bubble: o app grátis que flutua sobre o Brawl Stars com as melhores escolhas para o seu mapa.',
    accept: 'Aceitar o convite',
    play: 'Baixe no Google Play',
    after: 'Abra o app depois de instalar: {name} já vai estar no seu ranking de amigos.',
    android: 'O BrawlZone Bubble é um app para Android. Abra este link no seu celular Android.',
    bad: 'Este link de convite está incompleto. Peça ao seu amigo para enviar de novo.',
  },
  tr: {
    invited: '{name} seni davet etti',
    someone: 'Bir arkadaşın seni davet etti',
    pitch: 'BrawlZone Bubble ile Dereceli\'de yarışın: Brawl Stars\'ın üstünde duran, haritan için en iyi seçimleri gösteren ücretsiz uygulama.',
    accept: 'Daveti kabul et',
    play: 'Google Play\'den indir',
    after: 'Kurduktan sonra uygulamayı aç: {name} arkadaş sıralamanda olacak.',
    android: 'BrawlZone Bubble bir Android uygulamasıdır. Bu bağlantıyı Android telefonunda aç.',
    bad: 'Bu davet bağlantısı eksik. Arkadaşından tekrar göndermesini iste.',
  },
  de: {
    invited: '{name} hat dich eingeladen',
    someone: 'Ein Freund hat dich eingeladen',
    pitch: 'Tretet in Ranked gegeneinander an, mit BrawlZone Bubble: die kostenlose App, die über Brawl Stars schwebt und die besten Picks für deine Map zeigt.',
    accept: 'Einladung annehmen',
    play: 'Bei Google Play holen',
    after: 'Öffne die App nach der Installation: {name} steht dann schon auf deiner Freundesliste.',
    android: 'BrawlZone Bubble ist eine Android-App. Öffne diesen Link auf deinem Android-Handy.',
    bad: 'Dieser Einladungslink ist unvollständig. Bitte deinen Freund, ihn noch einmal zu schicken.',
  },
  ru: {
    invited: '{name} приглашает тебя',
    someone: 'Друг приглашает тебя',
    pitch: 'Соревнуйтесь в Рейтинговых боях с BrawlZone Bubble: бесплатное приложение поверх Brawl Stars с лучшими выборами для твоей карты.',
    accept: 'Принять приглашение',
    play: 'Скачать в Google Play',
    after: 'Открой приложение после установки: {name} уже будет в твоём рейтинге друзей.',
    android: 'BrawlZone Bubble — приложение для Android. Открой эту ссылку на Android-телефоне.',
    bad: 'Ссылка-приглашение неполная. Попроси друга отправить её ещё раз.',
  },
  fr: {
    invited: '{name} t\'a invité',
    someone: 'Un ami t\'a invité',
    pitch: 'Affrontez-vous en Classé avec BrawlZone Bubble : l\'appli gratuite qui flotte sur Brawl Stars avec les meilleurs choix pour ta carte.',
    accept: 'Accepter l\'invitation',
    play: 'Disponible sur Google Play',
    after: 'Ouvre l\'appli après l\'installation : {name} sera déjà dans ton classement d\'amis.',
    android: 'BrawlZone Bubble est une appli Android. Ouvre ce lien sur ton téléphone Android.',
    bad: 'Ce lien d\'invitation est incomplet. Demande à ton ami de le renvoyer.',
  },
};

type Inviter = { name: string | null; iconUrl: string | null; rank: string | null; rankIcon: string | null };

function readHash(): { code: string | null; lang: string | null } {
  const raw = window.location.hash.replace(/^#/, '');
  const params = new URLSearchParams(raw.includes('=') ? raw : `c=${raw}`);
  const code = (params.get('c') ?? '').toUpperCase();
  return { code: CODE.test(code) ? code : null, lang: params.get('l') };
}

export function InviteLanding() {
  const [state, setState] = useState<{ code: string | null; lang: string; android: boolean; inviter: Inviter | null; ready: boolean }>({
    code: null,
    lang: 'en',
    android: true,
    inviter: null,
    ready: false,
  });

  useEffect(() => {
    const { code, lang } = readHash();
    const browser = (navigator.language || 'en').slice(0, 2).toLowerCase();
    const pick = [lang, browser].find((l): l is string => !!l && l in WORDS) ?? 'en';
    const android = /android/i.test(navigator.userAgent);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((s) => ({ ...s, code, lang: pick, android, ready: !code }));
    if (!code) return;
    fetch(`/api/bubble/invite?c=${code}&lang=${pick}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((inviter: Inviter | null) => setState((s) => ({ ...s, inviter, ready: true })))
      .catch(() => setState((s) => ({ ...s, ready: true })));
  }, []);

  const w = WORDS[state.lang] ?? WORDS.en;
  if (!state.ready) return <div className="card h-64 w-full animate-pulse" aria-hidden />;
  if (!state.code) return <p className="card w-full p-6 text-center text-muted">{w.bad}</p>;

  const name = state.inviter?.name ?? null;
  const play = `https://play.google.com/store/apps/details?id=${PACKAGE}&referrer=${encodeURIComponent(`invite=${state.code}`)}`;
  const intent = `intent://invite/${state.code}#Intent;scheme=brawlzonebubble;package=${PACKAGE};S.browser_fallback_url=${encodeURIComponent(play)};end`;

  return (
    <section className="card relative isolate w-full overflow-hidden p-6 text-center sm:p-8">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: 'radial-gradient(110% 80% at 50% 0%, color-mix(in srgb, var(--brand) 28%, transparent), transparent 65%)' }}
      />
      <div className="mx-auto size-24 overflow-hidden rounded-full border-4 border-brand bg-surface-2 shadow-lg">
        {state.inviter?.iconUrl ? (
          <Image src={state.inviter.iconUrl} alt="" width={96} height={96} className="size-full object-cover" unoptimized />
        ) : (
          <Image src="/bubble/app-icon.png" alt="" width={96} height={96} className="size-full object-cover" />
        )}
      </div>
      <h1 className="display text-game-stroke mt-4 text-3xl leading-tight">{name ? w.invited.replace('{name}', name) : w.someone}</h1>
      {state.inviter?.rank ? (
        <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-surface-2 px-3 py-1 text-sm font-bold">
          {state.inviter.rankIcon ? <Image src={state.inviter.rankIcon} alt="" width={22} height={22} unoptimized /> : null}
          {state.inviter.rank}
        </p>
      ) : null}
      <p className="mx-auto mt-4 max-w-md leading-relaxed text-muted">{w.pitch}</p>
      {state.android ? (
        <a href={intent} className="btn-game mt-6 inline-flex w-full items-center justify-center bg-brand px-5 py-3.5 text-base text-brand-ink hover:bg-brand-strong">
          {w.accept}
        </a>
      ) : (
        <p className="mt-6 text-sm text-muted">{w.android}</p>
      )}
      <a href={play} className="mt-3 block text-sm font-bold text-brand underline-offset-4 hover:underline">
        {w.play}
      </a>
      {name ? <p className="mt-5 text-xs text-muted">{w.after.replace('{name}', name)}</p> : null}
    </section>
  );
}
