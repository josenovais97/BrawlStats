'use client';

import { useState } from 'react';
import { Loader2, Swords } from 'lucide-react';

import { SectionHeading } from '@/components/ui/section-heading';
import { formatNumber, titleCaseLabel } from '@/lib/format';
import type { ClubScan } from '@/lib/club-scan';

/**
 * What the club can field, between them.
 *
 * Everything else on this page is the game's own payload rendered back — names,
 * trophies, who is president — all of it two taps away inside Brawl Stars. This
 * is the part only this site can say, because it is thirty rosters read against
 * the Ranked tier list.
 *
 * **Behind a button on purpose.** One scan is up to thirty upstream player
 * fetches, which is the most expensive thing this site can be asked to do; a
 * crawler, a link unfurl and somebody who opened the page to check a trophy
 * count must all cost nothing. Pressing it is the consent.
 *
 * The union leads rather than the best member. "Between them" is the number
 * that belongs to the club, and a club at 91% carried by one player is a
 * different club from one at 91% evenly — which the board underneath shows.
 */
export function ClubPower({ tag, name }: { tag: string; name: string }) {
  const [scan, setScan] = useState<ClubScan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/club/scan/${encodeURIComponent(tag)}`);
      if (!response.ok) {
        setError(
          response.status === 429
            ? 'Too many scans at once. Give it a minute.'
            : 'Could not read this club right now.',
        );
        return;
      }
      const data = (await response.json()) as { scan: ClubScan };
      setScan(data.scan);
    } catch {
      setError('Could not read this club right now.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <SectionHeading
        title="Club power"
        subtitle="Every member's roster read against the current Ranked S and A tier — what this club can actually put on the field."
      />

      {scan === null ? (
        <div className="card flex flex-col items-start gap-3 p-5">
          <p className="text-sm text-muted">
            Reads all {' '}
            <span className="font-semibold text-foreground">30 members&rsquo; rosters</span>{' '}
            live. It takes a few seconds, so it only runs when you ask.
          </p>
          <button
            type="button"
            onClick={run}
            disabled={busy}
            className="btn-game inline-flex items-center justify-center gap-2.5 bg-brand px-5 py-3 text-sm uppercase text-brand-ink hover:bg-brand-strong disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Swords className="size-4" />
            )}
            {busy ? 'Reading rosters…' : 'Rank this club'}
          </button>
          {error ? <p className="text-sm text-defeat">{error}</p> : null}
        </div>
      ) : (
        <Result scan={scan} name={name} />
      )}
    </section>
  );
}

function Result({ scan, name }: { scan: ClubScan; name: string }) {
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const carried = scan.members[0];

  return (
    <div className="space-y-4">
      <div className="card card-glow p-5">
        <p className="text-3xl font-black tabular-nums text-brand sm:text-4xl">
          {pct(scan.coverage)}
        </p>
        <p className="mt-1 text-sm text-muted">
          of the {scan.topTierSize} brawlers in the current Ranked S and A tier,{' '}
          {name} can field between them.
          {scan.missed > 0 ? (
            <>
              {' '}
              <span className="text-foreground">
                {scan.missed} {scan.missed === 1 ? 'member' : 'members'} could not be read
              </span>
              , so the real figure is this or better.
            </>
          ) : null}
        </p>

        {scan.gaps.length > 0 ? (
          <p className="mt-4 border-t border-border pt-4 text-sm">
            <span className="font-semibold text-foreground">Nobody can field:</span>{' '}
            <span className="text-muted">
              {scan.gaps.map((g) => titleCaseLabel(g)).join(', ')}
            </span>
          </p>
        ) : null}
      </div>

      <ol className="space-y-2">
        {scan.members.map((member, index) => (
          <li
            key={member.tag}
            className="card flex items-center gap-3 p-3.5"
          >
            <span className="w-6 shrink-0 text-center text-sm font-bold tabular-nums text-muted">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{member.name}</p>
              <p className="truncate text-xs text-muted">
                {member.powerEleven} at power 11 · {formatNumber(member.trophies)} trophies
                {member.exclusives.length > 0 ? (
                  <>
                    {' · '}
                    {/*
                      The reason to read past the first row. A member at 40% who
                      is the only one holding a key pick matters more to the
                      club than one at 60% who duplicates everybody.
                    */}
                    <span className="text-brand">
                      only one with{' '}
                      {member.exclusives.slice(0, 2).map((e) => titleCaseLabel(e)).join(', ')}
                      {member.exclusives.length > 2
                        ? ` +${member.exclusives.length - 2}`
                        : ''}
                    </span>
                  </>
                ) : null}
              </p>
            </div>
            <span className="shrink-0 text-sm font-black tabular-nums text-foreground">
              {pct(member.coverage)}
            </span>
          </li>
        ))}
      </ol>

      {carried ? (
        <p className="text-xs text-muted">
          Ranked by what each member can field, not by trophies — the game already
          sorts the member list that way.
        </p>
      ) : null}
    </div>
  );
}
