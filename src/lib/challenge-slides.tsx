import type { ReactElement } from 'react';

import { titleCase } from '@/lib/format';
import {
  ACCENT,
  BRAND,
  Card,
  DIM,
  DISPLAY,
  FG,
  Frame,
  Hero,
  MUTED,
  loadArt,
  loadLogo,
  outro,
  withPips,
} from '@/lib/slide-chrome';
import type { Clue, GuessResult } from '@/lib/brawldle';

export { SLIDE_SIZE, slideFonts, toJpeg } from '@/lib/slide-chrome';

/**
 * The daily challenge, as a carousel.
 *
 * A promotional post rather than a daily one — there is no timer for it, and
 * it is run by hand. Four scheduled posts already sit against TikTok's five
 * pending uploads per 24h, and a fifth would leave no headroom to re-run a
 * failed one.
 *
 * It shows a REAL solved board, built from YESTERDAY's answer and real guesses
 * judged by the same `compareGuess` the game uses. Two reasons. A mocked-up
 * board would eventually drift from the real one and become a lie about the
 * product. And yesterday's puzzle is over, so showing it spoils nothing —
 * using today's would hand the answer to everyone who saw the post.
 */

const cap = (name: string) => titleCase(name);

const TILE: Record<Clue['verdict'], { bg: string; border: string; text: string }> = {
  hit: { bg: 'rgba(52,211,153,0.18)', border: 'rgba(52,211,153,0.6)', text: '#d1fae5' },
  near: { bg: 'rgba(251,191,36,0.18)', border: 'rgba(251,191,36,0.6)', text: '#fef3c7' },
  miss: { bg: 'rgba(244,63,94,0.14)', border: 'rgba(244,63,94,0.4)', text: '#ffe4e6' },
};

const ARROW: Record<'up' | 'down', string> = { up: '▲', down: '▼' };

/**
 * Values that do not fit a tile, shortened rather than clipped.
 *
 * "Damage Dealer" rendered as "Damage Dea…", which looks like a rendering bug
 * rather than an abbreviation. Dropping the noun keeps the word a player
 * recognises; the ellipsis at the end keeps nothing.
 */
const SHORT: Record<string, string> = {
  'Damage Dealer': 'Damage',
  'Ultra Legendary': 'Ultra Leg.',
  'Very Short': 'V. Short',
};
const short = (v: string) => SHORT[v] ?? v;

/**
 * One guess, drawn the way the board draws it.
 *
 * `revealed` is how many of this row's tiles have turned. A tile that has not
 * turned yet keeps its exact size and draws as an empty outline, so the board
 * never reflows as the animation runs — a layout that shifts mid-reveal reads
 * as a glitch rather than a game.
 */
function Row({
  result,
  art,
  revealed = Infinity,
}: {
  result: GuessResult;
  art: string | null;
  revealed?: number;
}): ReactElement {
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 8 }}>
      <div
        style={{
          display: 'flex',
          width: 104,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {art ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={art} width={96} height={96} alt="" />
        ) : (
          <div style={{ display: 'flex', width: 84, height: 84 }} />
        )}
      </div>
      {result.clues.map((c, i) => {
        const shown = i < revealed;
        const t = TILE[c.verdict];
        return (
          <div
            key={c.key}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              width: 110,
              gap: 6,
              padding: '16px 4px',
              borderRadius: 18,
              border: `2px solid ${shown ? t.border : 'rgba(255,255,255,0.10)'}`,
              background: shown ? t.bg : 'rgba(255,255,255,0.03)',
            }}
          >
            <div
              style={{
                display: 'flex',
                fontSize: 21,
                fontFamily: DISPLAY,
                color: t.text,
                textAlign: 'center',
              }}
            >
              {shown ? short(c.value) : ''}
            </div>
            {shown && c.direction ? (
              <div style={{ display: 'flex', fontSize: 20, color: t.text }}>
                {ARROW[c.direction]}
              </div>
            ) : (
              <div style={{ display: 'flex' }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function cover(art: string | null): ReactElement {
  return (
    <Frame>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', fontSize: 32, letterSpacing: 3, color: ACCENT }}>
          NEW ON BRAWLZONE
        </div>
        <div style={{ display: 'flex', fontSize: 120, fontFamily: DISPLAY, marginTop: 10 }}>
          Guess the
        </div>
        <div style={{ display: 'flex', fontSize: 120, fontFamily: DISPLAY, color: BRAND }}>
          brawler
        </div>
        <div style={{ display: 'flex', fontSize: 42, color: MUTED, marginTop: 20 }}>
          A new one every day. Seven clues a guess.
        </div>
      </div>
      <div style={{ display: 'flex', marginTop: 20 }}>
        <Hero src={art} size={470} />
      </div>
      <div style={{ display: 'flex', fontSize: 34, color: ACCENT, marginTop: 10 }}>
        Swipe to see how it works
      </div>
    </Frame>
  );
}

function clues(): ReactElement {
  const rows = [
    ['Rarity', 'Common up to Ultra Legendary'],
    ['Class', 'Tank, Marksman, Assassin…'],
    ['Movement', 'Very Slow up to Very Fast'],
    ['Range', 'Very Short up to Very Long'],
    ['Reload', 'Very Slow up to Very Fast'],
    ['Released', 'Where it sits in release order'],
    ['Tier', 'Its place on the live Ranked list'],
  ];
  return (
    <Frame>
      <div style={{ display: 'flex', fontSize: 30, letterSpacing: 3, color: ACCENT }}>
        EVERY GUESS TELLS YOU
      </div>
      <div style={{ display: 'flex', fontSize: 78, fontFamily: DISPLAY, marginTop: 12 }}>
        Seven clues
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 44 }}>
        {rows.map(([name, what]) => (
          <Card key={name} pad="18px 26px">
            <div style={{ display: 'flex', width: 240, fontSize: 38, fontFamily: DISPLAY, color: FG }}>
              {name}
            </div>
            <div style={{ display: 'flex', fontSize: 28, color: DIM }}>{what}</div>
          </Card>
        ))}
      </div>
      <div style={{ display: 'flex', fontSize: 30, color: MUTED, marginTop: 34 }}>
        Green is exact. Amber is one step away. The arrow points at the answer.
      </div>
    </Frame>
  );
}

function board(
  results: GuessResult[],
  art: (string | null)[],
  answerName: string,
  date: string,
): ReactElement {
  return (
    <Frame>
      <div style={{ display: 'flex', fontSize: 30, letterSpacing: 3, color: ACCENT }}>
        {`YESTERDAY — ${date}`}
      </div>
      <div style={{ display: 'flex', fontSize: 72, fontFamily: DISPLAY, marginTop: 12 }}>
        {`${cap(answerName)} in ${results.length}`}
      </div>
      <div style={{ display: 'flex', fontSize: 30, color: DIM, marginTop: 10 }}>
        Each row is one guess, narrowing it down
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 48 }}>
        {results.map((r, i) => (
          <Row key={r.brawler.slug} result={r} art={art[i] ?? null} />
        ))}
      </div>
      <div style={{ display: 'flex', fontSize: 28, color: DIM, marginTop: 34 }}>
        Real clues, from the same numbers the tier list uses.
      </div>
    </Frame>
  );
}

function extras(): ReactElement {
  const rows: [string, string][] = [
    ['Stuck at four guesses?', 'It shows the answer’s star power'],
    ['Still stuck at eight?', 'It shows the gadget too'],
    ['Solved it?', 'Copy the grid and post your score'],
    ['Come back tomorrow', 'Streaks, best run and your guess spread'],
  ];
  return (
    <Frame>
      <div style={{ display: 'flex', fontSize: 30, letterSpacing: 3, color: ACCENT }}>
        THERE IS MORE
      </div>
      <div style={{ display: 'flex', fontSize: 78, fontFamily: DISPLAY, marginTop: 12 }}>
        Hints and streaks
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 48 }}>
        {rows.map(([title, body], i) => (
          <Card key={title} lead={i === 0} column gap={6} pad="26px 28px">
            <div style={{ display: 'flex', fontSize: 40, fontFamily: DISPLAY, color: FG }}>
              {title}
            </div>
            <div style={{ display: 'flex', fontSize: 30, color: MUTED }}>{body}</div>
          </Card>
        ))}
      </div>
      <div style={{ display: 'flex', fontSize: 30, color: MUTED, marginTop: 38 }}>
        Free, no account, nothing to install.
      </div>
    </Frame>
  );
}

/**
 * One frame of the reveal, for the promo video.
 *
 * `turned` counts tiles across the whole board, so a single increasing number
 * drives the entire animation and ffmpeg only has to hold each frame for a
 * fixed time. Rows that have not started yet are not drawn at all — a row of
 * seven empty outlines appearing before its guess would give away how many
 * guesses are coming.
 */
export async function challengeFrame(
  post: ChallengePost,
  turned: number,
): Promise<ReactElement> {
  const perRow = post.results[0]?.clues.length ?? 7;
  const rowsStarted = Math.min(post.results.length, Math.ceil(turned / perRow) || 1);
  const shown = post.results.slice(0, rowsStarted);

  const art = await Promise.all(
    shown.map((r) => loadArt(r.brawler.id, 128, r.brawler.imageUrl)),
  );

  return (
    <Frame>
      <div style={{ display: 'flex', fontSize: 30, letterSpacing: 3, color: ACCENT }}>
        GUESS THE BRAWLER
      </div>
      <div style={{ display: 'flex', fontSize: 84, fontFamily: DISPLAY, marginTop: 10 }}>
        Seven clues
      </div>
      <div style={{ display: 'flex', fontSize: 32, color: DIM, marginTop: 10 }}>
        Green is exact · amber is close · the arrow points at the answer
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 52 }}>
        {shown.map((r, i) => (
          <Row
            key={r.brawler.slug}
            result={r}
            art={art[i] ?? null}
            revealed={Math.max(0, turned - i * perRow)}
          />
        ))}
      </div>

      <div style={{ display: 'flex', fontSize: 34, color: BRAND, marginTop: 44 }}>
        {turned >= post.results.length * perRow
          ? `${cap(post.answerName)}, in ${post.results.length}`
          : ''}
      </div>
    </Frame>
  );
}

export interface ChallengePost {
  date: string;
  answerName: string;
  answerId: number;
  results: GuessResult[];
}

type Step = 'cover' | 'clues' | 'board' | 'extras' | 'outro';

function plan(post: ChallengePost): Step[] {
  const out: Step[] = ['cover', 'clues'];
  if (post.results.length > 0) out.push('board');
  out.push('extras', 'outro');
  return out;
}

export function challengeSlideCount(post: ChallengePost | null): number {
  return post ? plan(post).length : 0;
}

export async function challengeSlides(
  post: ChallengePost,
  only?: number,
): Promise<ReactElement[]> {
  const steps = plan(post);
  const wanted = (kind: Step) => only === undefined || steps[only] === kind;

  const [coverArt, rowArt, logo] = await Promise.all([
    wanted('cover') ? loadArt(post.answerId, 560) : Promise.resolve(null),
    wanted('board')
      ? Promise.all(post.results.map((r) => loadArt(r.brawler.id, 128, r.brawler.imageUrl)))
      : Promise.resolve<(string | null)[]>([]),
    wanted('cover') || wanted('outro') ? loadLogo(208) : Promise.resolve(null),
  ]);

  return withPips(
    steps.map((step) => {
      switch (step) {
        case 'cover':
          return cover(coverArt);
        case 'clues':
          return clues();
        case 'board':
          return board(post.results, rowArt, post.answerName, post.date);
        case 'extras':
          return extras();
        default:
          return outro(logo);
      }
    }),
  );
}

export function challengeCaption(post: ChallengePost, site: string): {
  title: string;
  description: string;
} {
  return {
    title: 'Can you guess the brawler?',
    description:
      `A new Brawl Stars brawler to guess every day. Seven clues a guess — rarity, class, movement, ` +
      `range, reload, release order and its place on the live Ranked tier list. ` +
      `Yesterday was ${cap(post.answerName)}. Play free, no account, at ${site}/daily-challenge ` +
      '#brawlstars #brawlstarsquiz #brawlstarsdaily #brawlstarsgame #brawlstarstips',
  };
}
