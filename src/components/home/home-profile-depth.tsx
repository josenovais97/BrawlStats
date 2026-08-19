import { Gauge, LineChart, Sparkles, Swords } from 'lucide-react';

/**
 * What a visitor actually gets for typing their tag in.
 *
 * The hero asks for a tag and the value props say why the site exists, but
 * nothing between them showed what a profile *contains* — which is the moment
 * a first-time visitor decides whether to bother. Every item here is something
 * the game itself does not tell you about your own account.
 *
 * Deliberately not a screenshot: profiles differ enormously between accounts,
 * and one stale image of somebody else's would age badly and represent nobody.
 *
 * No call to action either. The hero's search box sits directly above this and
 * `HomeCta` closes the page with the same ask; a third button in between is
 * noise, not conversion.
 */
const FEATURES = [
  {
    icon: Gauge,
    accent: '#ff5c72',
    title: 'Skill score out of 10',
    body: 'Weighted toward Ranked, the only mode where matchmaking pairs comparable opponents. So it reflects how you play, not how long you have played. Smurfs and collectors get called out.',
  },
  {
    icon: Swords,
    accent: '#ffc53d',
    title: 'Your roster vs the meta',
    body: 'Which of your brawlers are strong right now, which top-tier picks you are missing, and which of your mains have quietly fallen out of favour.',
  },
  {
    icon: LineChart,
    accent: '#35d0ff',
    title: 'Trophy history',
    body: 'The game shows one number. We record yours every time the profile is viewed, so the curve fills in over time.',
  },
  {
    icon: Sparkles,
    accent: '#8b6bff',
    title: 'The things nobody surfaces',
    body: 'Best win streak, per-brawler prestige, how far each brawler sits below its own peak, and hypercharges stranded on brawlers below power 11.',
  },
];

export function HomeProfileDepth() {
  return (
    <section className="reveal" aria-labelledby="profile-depth">
      <div className="max-w-2xl">
        <p className="eyebrow text-accent">Look yourself up</p>
        <h2 id="profile-depth" className="display mt-2.5 text-2xl uppercase sm:text-3xl">
          More than a trophy count
        </h2>
        <p className="mt-3 leading-relaxed text-muted">
          A Brawl Stars profile is a pile of numbers with no context. These put
          yours against everyone else we sample.
        </p>
      </div>

      <ul className="mt-6 grid gap-3 sm:grid-cols-2 sm:gap-4">
        {FEATURES.map(({ icon: Icon, accent, title, body }) => (
          <li key={title} className="card flex gap-4 p-5">
            <span
              className="grid size-10 shrink-0 place-items-center rounded-xl"
              style={{
                background: `color-mix(in srgb, ${accent} 16%, transparent)`,
                color: accent,
              }}
            >
              <Icon className="size-5" />
            </span>
            <span className="min-w-0">
              <h3 className="text-base font-bold leading-tight">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
