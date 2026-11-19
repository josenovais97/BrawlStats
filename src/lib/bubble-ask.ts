/**
 * Ask Bubble (2026-11-19): the panel's question box, answered from our own
 * stats with no AI model. This file is the understanding half: it finds the
 * brawlers, map and mode a question names (in English or in the panel's
 * language, typos forgiven, CJK and Thai without spaces) and what is being
 * asked (counters, build, bans...). components/bubble/panel-ask.tsx turns
 * that into an answer card.
 *
 * Pure and synchronous: the panel builds the index once from what it has
 * already loaded (roster, Ranked maps, modes, each with its localized name).
 */

export type AskIntent = 'counters' | 'strong' | 'mates' | 'build' | 'maps' | 'picks' | 'bans' | 'trio' | 'good' | 'versus';

export interface AskParsed {
  brawlers: number[];
  map: string | null;
  mode: string | null;
  intent: AskIntent | null;
  /** "for me", "should I": answer from the player's own brawlers. */
  mine: boolean;
}

type Kind = 'brawler' | 'map' | 'mode';
interface Entity {
  kind: Kind;
  /** Brawler id as a string, map English name, or mode key. */
  id: string;
}

export interface AskIndex {
  /** Normalized name (and its spaceless form) -> entities. */
  exact: Map<string, Entity[]>;
  /** Names for the fuzzy pass and the substring pass. */
  names: { name: string; entity: Entity; dense: boolean }[];
  /** Longest name in tokens, for the window scan. */
  maxTokens: number;
}

/** Lowercase, no accents, apostrophes dropped, other punctuation to spaces. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’`´]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Scripts written without spaces between words: matched as substrings. */
const DENSE = /[぀-ヿ㐀-鿿가-힯฀-๿]/;

/** What players type for a brawler besides its name. Keys are normalized English names. */
const ALIASES: Record<string, string[]> = {
  'mr p': ['mrp', 'mister p', 'mr penguin'],
  'el primo': ['primo'],
  '8 bit': ['8bit', 'eight bit'],
  'larry lawrie': ['larry', 'lawrie', 'larry and lawrie'],
  'jae yong': ['jae', 'jaeyong'],
  'r t': ['rt'],
  dynamike: ['dyna', 'mike'],
  'colonel ruffs': ['ruffs', 'colonel'],
  'chester': ['chest'],
  'buzz lightyear': ['buzz l'],
};

export function buildIndex(input: {
  brawlers: { id: number; names: string[] }[];
  maps: { name: string; names: string[] }[];
  modes: { key: string; names: string[] }[];
}): AskIndex {
  const exact = new Map<string, Entity[]>();
  const names: AskIndex['names'] = [];
  let maxTokens = 1;
  const add = (raw: string, entity: Entity) => {
    const name = normalize(raw);
    if (!name) return;
    for (const key of new Set([name, name.replace(/ /g, '')])) {
      const list = exact.get(key) ?? [];
      if (!list.some((e) => e.kind === entity.kind && e.id === entity.id)) list.push(entity);
      exact.set(key, list);
    }
    names.push({ name, entity, dense: DENSE.test(name) });
    maxTokens = Math.max(maxTokens, name.split(' ').length);
  };
  for (const b of input.brawlers) {
    const entity: Entity = { kind: 'brawler', id: String(b.id) };
    for (const n of b.names) {
      add(n, entity);
      for (const alias of ALIASES[normalize(n)] ?? []) add(alias, entity);
    }
  }
  for (const m of input.maps) {
    const entity: Entity = { kind: 'map', id: m.name };
    for (const n of m.names) {
      add(n, entity);
      // "Belle's Rock" is also typed "belle rock".
      if (/['’]s\b/i.test(n)) add(n.replace(/['’]s\b/gi, ''), entity);
    }
  }
  for (const m of input.modes) {
    const entity: Entity = { kind: 'mode', id: m.key };
    for (const n of m.names) add(n, entity);
  }
  return { exact, names, maxTokens: Math.min(maxTokens, 5) };
}

/** Mode words players use that are not the mode's name. */
const MODE_WORDS: Record<string, string[]> = {
  gemGrab: ['gems', 'gem', 'gemas', 'joyas', 'gemmes', 'juwelen', 'кристаллы', 'mucevher'],
  brawlBall: ['ball', 'football', 'soccer', 'futebol', 'futbol', 'fussball', 'calcio', 'футбол', 'futbol topu'],
  knockout: ['ko', 'nocaute', 'noqueo', 'k o', 'нокаут', 'nakavt'],
  bounty: ['bounty', 'recompensa', 'caza estelar', 'prime', 'kopfgeld', 'награда'],
  heist: ['heist', 'golpe', 'atraco', 'braquage', 'tresorraub', 'ограбление', 'soygun'],
  hotZone: ['zone', 'zona', 'hot zone', 'zona estrategica', 'zone reservee', 'горячая зона', 'sicak bolge'],
  wipeout: ['wipeout'],
  brawlHockey: ['hockey', 'hoquei', 'hockey'],
};

/**
 * Words that say what is being asked, normalized, in the panel's main
 * languages. Checked in this order; the first that matches wins. A question
 * with none still works: the entities decide (one brawler: its overview;
 * two: which is better; a map: its picks; a mode: its best).
 */
const INTENTS: [AskIntent, string[]][] = [
  ['build', ['build', 'gadget', 'star power', 'starpower', 'gear', 'gears', 'sp', 'acessorio', 'acessorios', 'poder de estrela', 'engrenagem',
    'accesorio', 'poder estelar', 'engranaje', 'gadgets', 'pouvoir stellaire', 'equipement', 'sternenkraft', 'ausrustung', 'abilita stellare',
    'accessorio', 'гаджет', 'звездная сила', 'снаряжение', 'yildiz gucu', 'alet', 'ビルド', 'ガジェット', 'スターパワー', '빌드', '가젯', '스타파워', '配装', '出装', '妙具', '星徽之力']],
  ['bans', ['ban', 'bans', 'banir', 'banimento', 'bloquear', 'bloqueo', 'bloqueos', 'banear', 'bane', 'bannir', 'bannen', 'bannare', 'бан', 'банить', 'забанить', 'yasakla', 'banla', 'バン', '밴', '禁用', 'แบน']],
  ['trio', ['trio', 'trios', 'comp', 'comps', 'composition', 'team comp', 'team', 'squad', 'equipe', 'time', 'equipo', 'composicion', 'squadra', 'команда', 'состав',
    'takim', 'kompozycja', 'druzyna', 'チーム', '編成', '조합', '팀', '阵容', '组合', 'ทีม']],
  ['mates', ['with', 'teammate', 'teammates', 'duo', 'synergy', 'partner', 'pair', 'com', 'dupla', 'parceiro', 'sinergia', 'con', 'pareja', 'companero',
    'avec', 'mit', 'partner', 'compagno', 'с кем', 'вместе', 'ile', 'beraber', 'z kim', '一緒', '相性', '같이', '시너지', '搭配', '一起']],
  ['counters', ['counter', 'counters', 'counterar', 'beat', 'beats', 'beating', 'kill', 'stop', 'against', 'vs', 'contra', 'vence', 'ganha de', 'ganha do', 'ganha da', 'quem ganha', 'quem vence', 'ganhar de', 'le gana', 'gana al', 'quien gana',
    'bater', 'como ganhar', 'gana a', 'ganarle', 'vencer', 'contre', 'battre', 'konter', 'kontern', 'gegen', 'schlagen', 'contro', 'battere', 'контр', 'контрить',
    'против', 'победить', 'karsi', 'kontra', 'yener', 'kontrować', 'przeciw', 'tegen', 'verslaan', 'melawan', 'lawan', 'カウンター', '対策', '勝てる', '카운터',
    '상대', '克制', '打', 'เคาน์เตอร์']],
  ['maps', ['where', 'which map', 'best map', 'best maps', 'maps', 'onde', 'qual mapa', 'mapas', 'donde', 'que mapa', 'quelle carte', 'cartes', 'wo', 'welche map',
    'karten', 'dove', 'mappe', 'где', 'какие карты', 'nerede', 'haritalar', 'gdzie', 'mapy', 'waar', 'どこ', 'マップ', '어디', '맵', '哪里', '地图']],
  ['bans', ['what to ban']],
  ['picks', ['pick', 'picks', 'best', 'escolha', 'escolher', 'melhor', 'melhores', 'elegir', 'mejor', 'mejores', 'choisir', 'meilleur', 'meilleurs', 'beste', 'besten',
    'wahlen', 'migliore', 'migliori', 'scegliere', 'лучший', 'лучшие', 'выбрать', 'en iyi', 'sec', 'najlepszy', 'wybrac', 'kies', 'terbaik', 'pilih', '最強', 'おすすめ',
    '최고', '추천', '最好', '最强', 'ดีที่สุด']],
  ['good', ['good', 'op', 'broken', 'strong', 'tier', 'meta', 'worth', 'bom', 'forte', 'quebrado', 'bueno', 'fuerte', 'roto', 'bon', 'fort', 'gut', 'stark', 'buono',
    'forte', 'хорош', 'сильный', 'имба', 'iyi', 'guclu', 'dobry', 'mocny', 'goed', 'sterk', 'bagus', 'kuat', '強い', '좋아', '강해', '强吗', 'เก่ง']],
];

/** "What is Bo good against": what the brawler beats, not what beats it. */
const STRONG = ['good against', 'strong against', 'bom contra', 'forte contra', 'bueno contra', 'fuerte contra', 'bon contre', 'fort contre', 'gut gegen',
  'stark gegen', 'buono contro', 'forte contro', 'хорош против', 'силен против', 'iyi oldugu', 'dobry przeciw', 'goed tegen', 'bagus melawan'];
const ASKING_WHAT = ['what', 'who does', 'which brawlers does', 'o que', 'quem o', 'que', 'quoi', 'was', 'cosa', 'что', 'кого', 'neye', 'kime', 'co', 'wat'];

const MINE = ['me', 'my', 'mine', 'i', 'should i', 'for me', 'eu', 'meu', 'meus', 'pra mim', 'para mim', 'yo', 'mi', 'mis', 'para mi', 'je', 'moi', 'mon', 'mes', 'ich',
  'mich', 'mein', 'meine', 'io', 'mio', 'miei', 'я', 'мне', 'мой', 'мои', 'ben', 'bana', 'benim', 'ja', 'mnie', 'moj', 'moje', 'ik', 'mijn', 'aku', 'saya', '私', '僕', '俺',
  '내', '나', '我'];

function hasPhrase(text: string, phrase: string): boolean {
  if (DENSE.test(phrase)) return text.includes(phrase);
  return ` ${text} `.includes(` ${phrase} `);
}

function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      row.push(v);
      best = Math.min(best, v);
    }
    if (best > max) return max + 1;
    prev = row;
  }
  return prev[b.length];
}

/** Every keyword word, and a few small words, never mistaken for a name in the typo pass ("beat" is not Bea). */
const NOT_NAMES = new Set<string>([
  ...INTENTS.flatMap(([, words]) => words),
  ...STRONG,
  ...ASKING_WHAT,
  ...MINE,
  ...Object.values(MODE_WORDS).flat(),
  'the', 'and', 'for', 'this', 'that', 'with', 'from', 'what', 'which', 'when', 'right', 'now', 'today', 'should', 'would', 'could', 'have', 'there', 'here',
  'para', 'pelo', 'pela', 'como', 'qual', 'quais', 'agora', 'hoje', 'esse', 'essa', 'este', 'esta', 'cual', 'ahora', 'pour', 'avec', 'dans', 'quel', 'quelle',
  'maintenant', 'fuer', 'jetzt', 'heute', 'welcher', 'welche', 'sono', 'quale', 'adesso', 'oggi',
].flatMap((w) => normalize(w).split(' ')));

export function parseAsk(question: string, index: AskIndex): AskParsed {
  let text = normalize(question);
  const found: Entity[] = [];
  const take = (e: Entity) => {
    if (!found.some((f) => f.kind === e.kind && f.id === e.id)) found.push(e);
  };

  // 1. Names written without spaces (CJK, Thai): longest first, as substrings.
  for (const n of [...index.names].filter((x) => x.dense).sort((a, b) => b.name.length - a.name.length)) {
    if (n.name.length >= 2 && text.includes(n.name)) {
      take(n.entity);
      text = text.split(n.name).join(' ');
    }
  }

  // 2. Exact names, longest window first, each word used once.
  const tokens = text.split(' ').filter(Boolean);
  const used = new Array<boolean>(tokens.length).fill(false);
  for (let size = Math.min(index.maxTokens, tokens.length); size >= 1; size--) {
    for (let i = 0; i + size <= tokens.length; i++) {
      if (used.slice(i, i + size).some(Boolean)) continue;
      const words = tokens.slice(i, i + size);
      const hits = index.exact.get(words.join(' ')) ?? index.exact.get(words.join(''));
      if (!hits) continue;
      // A one-letter or very common word alone is not a name ("i", "ko" is a mode only).
      if (size === 1 && words[0].length < 2) continue;
      for (const h of hits) take(h);
      used.fill(true, i, i + size);
    }
  }

  // 3. Typos: a word or two close to a name ("mortiz", "hank's" handled above).
  for (let i = 0; i < tokens.length; i++) {
    if (used[i]) continue;
    for (const size of [2, 1]) {
      if (i + size > tokens.length || used.slice(i, i + size).some(Boolean)) continue;
      const word = tokens.slice(i, i + size).join(' ');
      if (word.length < 4 || word.split(' ').some((w) => NOT_NAMES.has(w))) continue;
      const max = word.length >= 8 ? 2 : 1;
      let best: { e: Entity; d: number } | null = null;
      for (const n of index.names) {
        if (n.dense || Math.abs(n.name.length - word.length) > max) continue;
        const d = distance(word, n.name, max);
        if (d <= max && (!best || d < best.d)) best = { e: n.entity, d };
      }
      if (best) {
        take(best.e);
        used.fill(true, i, i + size);
        break;
      }
    }
  }

  // 4. The start of a map name, two words or more ("hard rock" -> Hard Rock Mine).
  if (!found.some((e) => e.kind === 'map')) {
    const rest = tokens.filter((_, i) => !used[i]).join(' ');
    for (let size = 3; size >= 2; size--) {
      const words = rest.split(' ');
      for (let i = 0; i + size <= words.length; i++) {
        const head = words.slice(i, i + size).join(' ');
        const maps = index.names.filter((n) => n.entity.kind === 'map' && n.name.startsWith(`${head} `));
        const ids = new Set(maps.map((m) => m.entity.id));
        if (ids.size === 1) {
          take(maps[0].entity);
          size = 0;
          break;
        }
      }
    }
  }

  const whole = normalize(question);
  let mode = found.find((e) => e.kind === 'mode')?.id ?? null;
  if (!mode) {
    for (const [key, words] of Object.entries(MODE_WORDS)) {
      if (words.some((w) => hasPhrase(whole, normalize(w)))) {
        mode = key;
        break;
      }
    }
  }
  let intent: AskIntent | null = null;
  for (const [name, words] of INTENTS) {
    if (words.some((w) => hasPhrase(whole, normalize(w)))) {
      intent = name;
      break;
    }
  }
  if (STRONG.some((w) => hasPhrase(whole, normalize(w))) && ASKING_WHAT.some((w) => whole.startsWith(`${normalize(w)} `))) intent = 'strong';
  const brawlers = found.filter((e) => e.kind === 'brawler').map((e) => Number(e.id));
  // "Bo or Bibi", "Bo vs Bibi": two brawlers and no other ask is a comparison.
  if (brawlers.length >= 2 && (intent === null || intent === 'counters' || intent === 'good' || intent === 'picks')) intent = 'versus';
  return {
    brawlers,
    map: found.find((e) => e.kind === 'map')?.id ?? null,
    mode,
    intent,
    mine: MINE.some((w) => hasPhrase(whole, normalize(w))),
  };
}
