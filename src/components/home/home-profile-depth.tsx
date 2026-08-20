import { ArrowRight, Gauge, LineChart, Sparkles, Swords } from 'lucide-react';
import Link from 'next/link';

import { SAMPLE_PLAYER_TAG } from '@/lib/site';

/**
 * What a visitor actually gets for typing their tag in.
 *
 * The hero asks for a tag; this is the answer to "and then what". It used to
 * be four cards of prose, which is the wrong shape for a question about a
 * product — so the claims are now four short lines and the proof is a real
 * profile you can open, deep-linked to the sections named on the left.
 *
 * Deliberately not a screenshot and deliberately not a mock-up: profiles
 * differ enormously between accounts, a stale image would represent nobody,
 * and inventing numbers to fill a preview panel would be worse than either.
 * The sample profile is the same server-rendered page every other lookup gets.
 */
const FEATURES = [
  {
    icon: Gauge,
    accent: '#ff5c72',
    title: 'Skill score out of 10',
    body: 'Weighted toward Ranked, so it reflects how you play rather than how long you have played.',
    /* Anchors are the profile page's own section ids. */
    hash: '',
  },
  {
    icon: Swords,
    accent: '#ffc53d',
    title: 'Roster read against the meta',
    body: 'Which of your brawlers are strong now, which top picks you are missing.',
    hash: '#brawlers',
  },
  {
    icon: Sparkles,
    accent: '#8b6bff',
    title: 'Progression and unfinished upgrades',
    body: 'Account completion, coins still needed, and hypercharges stranded below power 11.',
    hash: '#progress',
  },
  {
    icon: LineChart,
    accent: '#35d0ff',
    title: 'History the game does not keep',
    body: 'Trophy curve, best win streak and recent battles, recorded on every visit.',
    hash: '#battles',
  },
];

export function HomeProfileDepth() {
  return (
    <section className="reveal" aria-labelledby="profile-depth">
      <div className="card card-glow overflow-hidden lg:grid lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="p-5 sm:p-6">
          <p className="eyebrow text-accent">After you search</p>
          <h2 id="profile-depth" className="display mt-2.5 text-2xl uppercase sm:text-3xl">
            What a profile gives you
          </h2>

          <ul className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, accent, title, body }) => (
              <li key={title} className="flex gap-3">
                <span
                  className="grid size-9 shrink-0 place-items-center rounded-lg"
                  style={{
                    background: `color-mix(in srgb, ${accent} 16%, transparent)`,
                    color: accent,
                  }}
                >
                  <Icon className="size-4.5" />
                </span>
                <span className="min-w-0">
                  <h3 className="text-sm font-bold leading-tight">{title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{body}</p>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* The proof, not a mock-up of it. */}
        <div className="border-t border-border bg-surface-2/40 p-5 sm:p-6 lg:border-l lg:border-t-0">
          <p className="eyebrow">See it live</p>
          <p className="mt-2.5 text-sm leading-relaxed text-muted">
            Every section on the left is on the sample profile below, filled in with
            that account&rsquo;s real data.
          </p>

          <ul className="mt-4 space-y-1.5">
            {FEATURES.map(({ title, hash }) => (
              <li key={title}>
                <Link
                  href={`/player/${SAMPLE_PLAYER_TAG}${hash}`}
                  className="row-interactive flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted hover:text-foreground"
                >
                  <ArrowRight aria-hidden className="size-3.5 shrink-0 text-brand" />
                  <span className="min-w-0 truncate">{title}</span>
                </Link>
              </li>
            ))}
          </ul>

          <Link
            href={`/player/${SAMPLE_PLAYER_TAG}`}
            className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border-strong/70 bg-surface px-4 text-sm font-bold transition-colors hover:border-brand/60 hover:text-brand"
          >
            Open the sample profile
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
