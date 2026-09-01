import type { RoleComposition } from '@/lib/stats';

/**
 * What shape your team is becoming, and whether that shape wins.
 *
 * A draft screen already says which brawlers are strong here and which answer
 * the enemy. It says nothing about the team as a thing in itself — three
 * individually good picks can still be three assassins and no way to hold a
 * zone. This is the part a drafter reasons about and the only part no
 * competitor can show, because it needs both teams of tens of thousands of
 * sampled battles.
 *
 * Read at role level because that is what the data supports: identity-level
 * trios average ten battles each, role shapes average thousands. It is also
 * the level the question is actually asked at.
 *
 * Every number is baseline-adjusted, so 50% means average for this sample
 * rather than a coin flip. That correction is not cosmetic: the weakest shape
 * measured wins 50.4% of its battles raw, which reads as fine, and is in fact
 * nearly six points below the sample's own mean.
 */
export function CompShape({
  allies,
  roleOf,
  comps,
}: {
  /** Ally brawler ids, in pick order. Fewer than three is the normal case. */
  allies: number[];
  roleOf: Map<number, string | null>;
  comps: RoleComposition[];
}) {
  if (comps.length === 0) return null;

  const picked = allies.map((id) => roleOf.get(id) ?? null).filter((r): r is string => r !== null);
  const key = (roles: string[]) => roles.slice().sort().join(' + ');

  const yours = picked.length === 3 ? comps.find((c) => key(c.roles) === key(picked)) ?? null : null;
  // Partial picks still narrow it: show the best shape those roles can reach.
  const reachable =
    !yours && picked.length > 0
      ? comps.find((c) => {
          const pool = c.roles.slice();
          return picked.every((r) => {
            const i = pool.indexOf(r);
            if (i === -1) return false;
            pool.splice(i, 1);
            return true;
          });
        }) ?? null
      : null;

  const best = comps.slice(0, 4);
  const worst = comps.slice(-3).reverse();

  return (
    <section className="space-y-3" aria-labelledby="comp-shape">
      <div>
        <h2 id="comp-shape" className="display text-xl uppercase">
          Team shape
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          How this combination of roles performs in Ranked, measured across both
          teams of sampled battles. 50% is average for the sample, not a coin
          flip — every shape is adjusted against the same baseline the tier list
          uses.
        </p>
      </div>

      {yours ? (
        <div className="card p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Your shape</p>
          <ShapeRow comp={yours} emphasis />
        </div>
      ) : reachable ? (
        <div className="card p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">
            Strongest shape you can still reach
          </p>
          <ShapeRow comp={reachable} emphasis />
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="card p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-victory">Shapes that win</p>
          <ul className="mt-2 space-y-1.5">
            {best.map((c) => (
              <li key={key(c.roles)}>
                <ShapeRow comp={c} />
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-defeat">Shapes that lose</p>
          <ul className="mt-2 space-y-1.5">
            {worst.map((c) => (
              <li key={key(c.roles)}>
                <ShapeRow comp={c} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function ShapeRow({ comp, emphasis = false }: { comp: RoleComposition; emphasis?: boolean }) {
  const delta = (comp.score - 0.5) * 100;
  const good = delta >= 0;

  return (
    <div className={`flex items-baseline justify-between gap-3 ${emphasis ? 'mt-2' : ''}`}>
      <span className={`min-w-0 truncate ${emphasis ? 'text-base font-bold' : 'text-sm'}`}>
        {comp.roles.join(' + ')}
      </span>
      <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
        <span
          className={`font-bold ${emphasis ? 'text-lg' : 'text-sm'} ${good ? 'text-victory' : 'text-defeat'}`}
        >
          {good ? '+' : ''}
          {delta.toFixed(1)}
        </span>
        <span className="text-xs text-muted">{comp.decided.toLocaleString('en-GB')} battles</span>
      </span>
    </div>
  );
}
