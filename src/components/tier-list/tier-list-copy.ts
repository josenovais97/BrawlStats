import type { Locale } from '@/lib/i18n';
import type { TierFormat } from '@/lib/stats';

/**
 * Every sentence on the tier list pages, per language.
 *
 * The English is the page's original wording, moved here unchanged. Spanish is
 * written for Latin America and Portuguese for Brazil, in the words players
 * use: "tier list" and "brawlers" stay as they are in both communities, and
 * Ranked is the game's own "Competitivo" / "Ranqueado".
 *
 * Arguments arrive already formatted (numbers, percentages, translated mode
 * and rank names), so nothing here formats anything.
 */

interface FormatCopy {
  eyebrow: string;
  heading: string;
  /** Names the battles counted, mid-sentence. */
  battles: string;
  intro: string;
  caveat: string;
  unratedHeading: string;
  unratedBody: string;
  /** The list's own name in a sentence: "Ranked", "trophy ladder". */
  where: string;
}

export interface TierCopy {
  format: Record<TierFormat, FormatCopy>;
  heading: (format: TierFormat, mode?: string, rank?: string) => string;
  scopeLabel: (window: string, mode?: string) => string;
  faq: {
    bestQ: (format: TierFormat, mode?: string) => string;
    bestA: (a: { first: string; second?: string; third?: string; rate: string; games: string; battles: string; window: string; mode?: string }) => string;
    noneA: (a: { battles: string; mode?: string; window: string; floor: number }) => string;
    howQ: string;
    howA: (a: { sampled: string; scope: string; floor: number }) => string;
    oftenQ: string;
    oftenA: string;
  };
  /** "Gem Grab in competitive only" / the battles noun, for the FAQ. */
  scopeName: (format: TierFormat, mode?: string) => string;
  itemList: (mode?: string) => string;
  breadcrumbRoot: string;
  answer: (a: { first: string; second: string; third: string; format: TierFormat; mode?: string; asOf?: string }) => string;
  lead: (a: { first: string; rate: string; games: string }) => string;
  based: (a: { sampled?: string; battles: string; mode?: string; rank?: string; days?: number; asOf?: string }) => string;
  disagree: string;
  howSummary: string;
  how1: (format: TierFormat) => string;
  how2a: string;
  metaScore: string;
  how2b: string;
  how3a: string;
  otherList: (format: TierFormat) => string;
  how3b: (floor: number) => string;
  fullMethod: string;
  how3c: string;
  bracketMissingStrong: (rank: string) => string;
  bracketMissingRest: string;
  bracketWidened: (rank: string, days: number, normal: number) => string;
  unratedSub: (floor: number, window: string) => string;
  unratedChip: (name: string, games: number, floor: number, battles: string) => string;
  chipTitle: (a: { name: string; score: string; adj: string; raw: string; base: string; pick: string; games: string }) => string;
  winLetter: string;
  winTitle: string;
  pickLetter: string;
  pickTitle: string;
  emptyTitle: (configured: boolean) => string;
  emptyBody: (configured: boolean, window: string) => string;
  browse: string;
  podium: string;
  podiumDetail: (rate: string) => string;
}

const en: TierCopy = {
  format: {
    ranked: {
      eyebrow: 'Competitive only',
      heading: 'Ranked tier list',
      battles: 'Ranked battles',
      intro:
        'How brawlers perform in competitive Ranked, where matchmaking pairs comparable opponents. So what is left reflects the brawler rather than who was holding it.',
      caveat:
        'Ranked is 3v3 modes only and a small slice of what gets sampled, so the list is shorter and moves faster than the ladder one.',
      unratedHeading: 'Not enough Ranked data',
      unratedBody:
        'Competitive Ranked is a small slice of what gets sampled, so plenty of brawlers that see regular ladder play still have too few Ranked battles to rank.',
      where: 'Ranked',
    },
    trophy: {
      eyebrow: 'Trophy ladder',
      heading: 'Trophy tier list',
      battles: 'trophy-ladder battles',
      intro:
        'How brawlers perform on the trophy ladder. The games most people actually play, showdown included, where you pick what you own rather than what the draft leaves you.',
      caveat:
        'Ladder matchmaking is looser than Ranked, so some of a brawler’s record here is the lobby rather than the brawler. Each mode is scored against its own average to keep that from deciding the list.',
      unratedHeading: 'Not enough ladder data',
      unratedBody:
        'Newly released brawlers, and anything barely played on ladder, need more battles before a win rate means anything.',
      where: 'trophy ladder',
    },
  },
  heading: (format, mode, rank) => {
    const h = en.format[format].heading;
    const base = mode ? `${mode} ${h.toLowerCase()}` : h;
    return rank ? `${rank} ${base.charAt(0).toLowerCase()}${base.slice(1)}` : base;
  },
  scopeLabel: (w, mode) => (mode ? `${mode} over the ${w} window` : `${w} window`),
  faq: {
    bestQ: (format, mode) =>
      mode
        ? `What is the best brawler for ${mode} in Brawl Stars?`
        : `What is the best brawler in Brawl Stars ${format === 'ranked' ? 'Ranked' : 'on the trophy ladder'}?`,
    bestA: (a) =>
      `${a.first} ranks highest${a.mode ? ` in ${a.mode}` : ''}, with an adjusted win rate of ${a.rate} across ${a.games} decided ${a.battles} over the last ${a.window}.${a.third ? ` ${a.second} and ${a.third} follow.` : ''}`,
    noneA: (a) =>
      `Not enough ${a.battles} have been sampled${a.mode ? ` in ${a.mode}` : ''} over the last ${a.window} to rank brawlers yet. A brawler needs ${a.floor} decided battles before it is placed.`,
    howQ: 'How is this tier list made?',
    howA: (a) =>
      `From ${a.sampled} ${a.scope} sampled from real matches, not from votes or opinion. Win rate is adjusted against the average of the same sample, because the sampled pool wins more than half its games regardless of brawler — so a tier reflects the brawler rather than who was holding it. A brawler needs ${a.floor} decided battles in the window before it is rated at all.`,
    oftenQ: 'How often is the tier list updated?',
    oftenA:
      'The sampler collects new battles every few hours and this page is rebuilt from the latest aggregate, so it never trails the data by more than a few hours.',
  },
  scopeName: (format, mode) => (mode ? `${mode} in ${en.format[format].eyebrow.toLowerCase()}` : en.format[format].battles),
  itemList: (mode) => `Brawl Stars brawlers ranked by meta score${mode ? ` in ${mode}` : ''}.`,
  breadcrumbRoot: 'Tier list',
  answer: (a) =>
    `${a.first}, ${a.second} and ${a.third} are the best${a.mode ? ` ${a.mode}` : ''} brawlers in ${a.format === 'ranked' ? 'Ranked' : 'trophy ladder'} right now`,
  lead: (a) => `${a.first} leads with a ${a.rate} adjusted win rate over ${a.games} decided battles.`,
  based: (a) =>
    `Based on ${a.sampled ? `${a.sampled} sampled ` : 'sampled '}${a.battles}${a.mode ? ` in ${a.mode}` : ''}${
      a.rank && a.days ? ` played in ${a.rank} lobbies over the last ${a.days} days.` : ' from players across the Ranked ladder.'
    }`,
  disagree: 'Disagree? Build your own',
  howSummary: 'How the meta score works',
  how1: (format) => `Meta score combines adjusted win rate and pick rate, relative to this ${format === 'ranked' ? 'Ranked' : 'trophy'} list.`,
  how2a: 'Brawlers are ranked by',
  metaScore: 'meta score',
  how2b:
    'out of 10, which combines an adjusted win rate with a log-scaled pick rate. Win rate alone would rate a brawler nobody plays the same as a staple with identical results, so popularity breaks the ties.',
  how3a: 'The scale is calibrated within this list, so scores rank brawlers against each other here and cannot be compared with the',
  otherList: (format) => (format === 'ranked' ? 'trophy list' : 'Ranked list'),
  how3b: (floor) =>
    `. A brawler needs ${floor} decided battles in the window before it is rated at all. Tap or hover a brawler for the full breakdown, or read`,
  fullMethod: 'the full method',
  how3c: '— sampling, the mode adjustment, the anchors, and what it cannot tell you.',
  bracketMissingStrong: (rank) => `Not enough battles from ${rank} lobbies yet`,
  bracketMissingRest:
    'to rate brawlers at this rank, so this is the list for every rank. It fills in over the next few days as more of them are sampled.',
  bracketWidened: (rank, days, normal) =>
    `${rank} lobbies are thin in the sample right now (the first days of a Ranked season usually are), so this list covers the last ${days} days rather than ${normal}.`,
  unratedSub: (floor, w) =>
    `Each needs ${floor} decided battles in the ${w} window; the count below is how far along it is. Closest first.`,
  unratedChip: (name, games, floor, battles) => `${name}: ${games} of ${floor} decided ${battles} needed to be ranked`,
  chipTitle: (a) =>
    `${a.name}: meta score ${a.score} from ${a.adj} adjusted win rate (${a.raw} raw, against a ${a.base} average for the modes it is played in) and ${a.pick} pick rate, over ${a.games} decided battles`,
  winLetter: 'W',
  winTitle: 'Adjusted win rate',
  pickLetter: 'P',
  pickTitle: 'Pick rate',
  emptyTitle: (c) => (c ? 'No aggregated data yet' : 'Database not configured'),
  emptyBody: (c, w) =>
    c ? `Not enough battles sampled in the ${w} yet. Try a longer window, or check back shortly.` : 'Rankings are not available right now.',
  browse: 'Browse the brawler database',
  podium: 'Top three right now',
  podiumDetail: (rate) => `${rate} win rate`,
};

const es: TierCopy = {
  format: {
    ranked: {
      eyebrow: 'Solo Competitivo',
      heading: 'Tier list de Competitivo',
      battles: 'partidas de Competitivo',
      intro:
        'Cómo rinde cada brawler en Competitivo, donde el emparejamiento junta a rivales de nivel parecido. Así lo que queda refleja al brawler y no a quien lo jugaba.',
      caveat:
        'Competitivo es solo de modos 3c3 y una parte pequeña de lo que se recoge, así que la lista es más corta y cambia más rápido que la de trofeos.',
      unratedHeading: 'Sin datos suficientes de Competitivo',
      unratedBody:
        'Competitivo es una parte pequeña de las partidas recogidas, así que muchos brawlers que se juegan seguido en trofeos todavía tienen muy pocas partidas de Competitivo para clasificarlos.',
      where: 'Competitivo',
    },
    trophy: {
      eyebrow: 'Trofeos',
      heading: 'Tier list de trofeos',
      battles: 'partidas de trofeos',
      intro:
        'Cómo rinde cada brawler en trofeos. Las partidas que más gente juega, Supervivencia incluida, donde eliges lo que tienes y no lo que te deja la selección.',
      caveat:
        'El emparejamiento en trofeos es más flojo que en Competitivo, así que parte del récord de un brawler es la sala y no el brawler. Cada modo se compara con su propia media para que eso no decida la lista.',
      unratedHeading: 'Sin datos suficientes de trofeos',
      unratedBody:
        'Los brawlers recién salidos, y los que casi no se juegan en trofeos, necesitan más partidas antes de que su tasa de victorias signifique algo.',
      where: 'trofeos',
    },
  },
  heading: (format, mode, rank) => {
    const base = mode
      ? `Tier list de ${mode} en ${format === 'ranked' ? 'Competitivo' : 'trofeos'}`
      : es.format[format].heading;
    return rank ? `${base}: ${rank}` : base;
  },
  scopeLabel: (w, mode) => (mode ? `${mode} en la ventana de ${w}` : `la ventana de ${w}`),
  faq: {
    bestQ: (format, mode) =>
      mode
        ? `¿Cuál es el mejor brawler para ${mode} en Brawl Stars?`
        : `¿Cuál es el mejor brawler de Brawl Stars en ${format === 'ranked' ? 'Competitivo' : 'trofeos'}?`,
    bestA: (a) =>
      `${a.first} es el mejor${a.mode ? ` en ${a.mode}` : ''}, con una tasa de victorias ajustada del ${a.rate} en ${a.games} ${a.battles} decididas en los últimos ${a.window}.${a.third ? ` Le siguen ${a.second} y ${a.third}.` : ''}`,
    noneA: (a) =>
      `Todavía no hay suficientes ${a.battles}${a.mode ? ` de ${a.mode}` : ''} en los últimos ${a.window} para clasificar brawlers. Un brawler necesita ${a.floor} partidas decididas antes de entrar en la lista.`,
    howQ: '¿Cómo se hace esta tier list?',
    howA: (a) =>
      `Con ${a.sampled} ${a.scope} recogidas de partidas reales, no de votos ni opiniones. La tasa de victorias se ajusta contra la media de la misma muestra, porque los jugadores recogidos ganan más de la mitad de sus partidas sea cual sea el brawler; así el tier refleja al brawler y no a quien lo jugaba. Un brawler necesita ${a.floor} partidas decididas en el periodo para entrar en la lista.`,
    oftenQ: '¿Cada cuánto se actualiza la tier list?',
    oftenA:
      'Se recogen partidas nuevas cada pocas horas y esta página se rehace con los datos más recientes, así que nunca va más de unas horas por detrás.',
  },
  scopeName: (format, mode) => (mode ? `partidas de ${mode} en ${es.format[format].where}` : es.format[format].battles),
  itemList: (mode) => `Brawlers de Brawl Stars ordenados por puntuación meta${mode ? ` en ${mode}` : ''}.`,
  breadcrumbRoot: 'Tier list',
  answer: (a) =>
    `${a.first}, ${a.second} y ${a.third} son los mejores brawlers${a.mode ? ` de ${a.mode}` : ''} en ${a.format === 'ranked' ? 'Competitivo' : 'trofeos'} ahora mismo`,
  lead: (a) => `${a.first} va primero con una tasa de victorias ajustada del ${a.rate} en ${a.games} partidas decididas.`,
  based: (a) =>
    `Basado en ${a.sampled ? `${a.sampled} ` : ''}${a.battles}${a.mode ? ` de ${a.mode}` : ''}${
      a.rank && a.days ? ` jugadas en ${a.rank} en los últimos ${a.days} días.` : ' de jugadores de todos los rangos.'
    }${a.asOf ? ` Datos del ${a.asOf}.` : ''}`,
  disagree: '¿No estás de acuerdo? Haz la tuya',
  howSummary: 'Cómo funciona la puntuación meta',
  how1: (format) =>
    `La puntuación meta combina la tasa de victorias ajustada y la tasa de uso, en relación con esta lista de ${format === 'ranked' ? 'Competitivo' : 'trofeos'}.`,
  how2a: 'Los brawlers se ordenan por',
  metaScore: 'puntuación meta',
  how2b:
    'sobre 10, que combina una tasa de victorias ajustada con una tasa de uso en escala logarítmica. Solo con la tasa de victorias, un brawler que nadie juega valdría lo mismo que uno muy usado con los mismos resultados, así que la popularidad desempata.',
  how3a: 'La escala se calibra dentro de esta lista, así que las puntuaciones comparan brawlers entre sí aquí y no se pueden comparar con la',
  otherList: (format) => (format === 'ranked' ? 'lista de trofeos' : 'lista de Competitivo'),
  how3b: (floor) =>
    `. Un brawler necesita ${floor} partidas decididas en el periodo para entrar en la lista. Toca o pasa el ratón por un brawler para ver el detalle, o lee`,
  fullMethod: 'el método completo',
  how3c: '(en inglés).',
  bracketMissingStrong: (rank) => `Todavía no hay suficientes partidas de ${rank}`,
  bracketMissingRest:
    'para clasificar brawlers en este rango, así que esta es la lista de todos los rangos. Se irá llenando en los próximos días.',
  bracketWidened: (rank, days, normal) =>
    `Hay pocas partidas de ${rank} ahora mismo (pasa en los primeros días de cada temporada), así que esta lista cubre los últimos ${days} días en vez de ${normal}.`,
  unratedSub: (floor, w) =>
    `Cada uno necesita ${floor} partidas decididas en la ventana de ${w}; el número indica cuánto le falta. Los más cercanos primero.`,
  unratedChip: (name, games, floor) => `${name}: ${games} de ${floor} partidas decididas necesarias para entrar`,
  chipTitle: (a) =>
    `${a.name}: puntuación meta ${a.score} con ${a.adj} de victorias ajustadas (${a.raw} sin ajustar, frente a una media de ${a.base} en sus modos) y ${a.pick} de uso, en ${a.games} partidas decididas`,
  winLetter: 'V',
  winTitle: 'Tasa de victorias ajustada',
  pickLetter: 'U',
  pickTitle: 'Tasa de uso',
  emptyTitle: (c) => (c ? 'Todavía no hay datos' : 'Base de datos no configurada'),
  emptyBody: (c, w) =>
    c ? `Todavía no hay suficientes partidas en ${w}. Prueba una ventana más larga o vuelve en un rato.` : 'La clasificación no está disponible ahora mismo.',
  browse: 'Ver todos los brawlers',
  podium: 'El top 3 ahora mismo',
  podiumDetail: (rate) => `${rate} de victorias`,
};

const pt: TierCopy = {
  format: {
    ranked: {
      eyebrow: 'Só Ranqueado',
      heading: 'Tier list do Ranqueado',
      battles: 'partidas ranqueadas',
      intro:
        'Como cada brawler se sai no Ranqueado, onde o matchmaking junta adversários de nível parecido. Assim o que sobra mostra o brawler, e não quem estava jogando com ele.',
      caveat:
        'O Ranqueado tem só modos 3v3 e é uma parte pequena do que é coletado, então a lista é mais curta e muda mais rápido que a de troféus.',
      unratedHeading: 'Dados insuficientes do Ranqueado',
      unratedBody:
        'O Ranqueado é uma parte pequena das partidas coletadas, então muitos brawlers que aparecem sempre nos troféus ainda têm poucas partidas ranqueadas para entrar na lista.',
      where: 'Ranqueado',
    },
    trophy: {
      eyebrow: 'Troféus',
      heading: 'Tier list de troféus',
      battles: 'partidas de troféus',
      intro:
        'Como cada brawler se sai nos troféus. As partidas que a maioria das pessoas joga, Combate incluído, onde você escolhe o que tem e não o que o draft deixa.',
      caveat:
        'O matchmaking dos troféus é mais solto que o do Ranqueado, então parte do resultado de um brawler aqui é a sala, e não o brawler. Cada modo é comparado com a própria média para isso não decidir a lista.',
      unratedHeading: 'Dados insuficientes de troféus',
      unratedBody:
        'Brawlers recém-lançados, e os que quase ninguém joga nos troféus, precisam de mais partidas antes que a taxa de vitória queira dizer alguma coisa.',
      where: 'troféus',
    },
  },
  heading: (format, mode, rank) => {
    const base = mode
      ? `Tier list de ${mode} ${format === 'ranked' ? 'no Ranqueado' : 'nos troféus'}`
      : pt.format[format].heading;
    return rank ? `${base}: ${rank}` : base;
  },
  scopeLabel: (w, mode) => (mode ? `${mode} na janela de ${w}` : `a janela de ${w}`),
  faq: {
    bestQ: (format, mode) =>
      mode
        ? `Qual é o melhor brawler para ${mode} no Brawl Stars?`
        : `Qual é o melhor brawler do Brawl Stars ${format === 'ranked' ? 'no Ranqueado' : 'nos troféus'}?`,
    bestA: (a) =>
      `${a.first} é o melhor${a.mode ? ` em ${a.mode}` : ''}, com taxa de vitória ajustada de ${a.rate} em ${a.games} ${a.battles} decididas nos últimos ${a.window}.${a.third ? ` Depois vêm ${a.second} e ${a.third}.` : ''}`,
    noneA: (a) =>
      `Ainda não há ${a.battles}${a.mode ? ` de ${a.mode}` : ''} suficientes nos últimos ${a.window} para ranquear os brawlers. Um brawler precisa de ${a.floor} partidas decididas para entrar na lista.`,
    howQ: 'Como esta tier list é feita?',
    howA: (a) =>
      `Com ${a.sampled} ${a.scope} coletadas de partidas reais, não de votos ou opiniões. A taxa de vitória é ajustada pela média da mesma amostra, porque os jogadores coletados ganham mais da metade das partidas seja qual for o brawler; assim o tier mostra o brawler, e não quem jogava com ele. Um brawler precisa de ${a.floor} partidas decididas no período para entrar na lista.`,
    oftenQ: 'De quanto em quanto tempo a tier list é atualizada?',
    oftenA:
      'Novas partidas são coletadas a cada poucas horas e esta página é refeita com os dados mais recentes, então nunca fica mais que algumas horas atrás.',
  },
  scopeName: (format, mode) => (mode ? `partidas de ${mode} ${format === 'ranked' ? 'no Ranqueado' : 'nos troféus'}` : pt.format[format].battles),
  itemList: (mode) => `Brawlers do Brawl Stars ordenados por pontuação meta${mode ? ` em ${mode}` : ''}.`,
  breadcrumbRoot: 'Tier list',
  answer: (a) =>
    `${a.first}, ${a.second} e ${a.third} são os melhores brawlers${a.mode ? ` de ${a.mode}` : ''} ${a.format === 'ranked' ? 'no Ranqueado' : 'nos troféus'} agora`,
  lead: (a) => `${a.first} lidera com taxa de vitória ajustada de ${a.rate} em ${a.games} partidas decididas.`,
  based: (a) =>
    `Com base em ${a.sampled ? `${a.sampled} ` : ''}${a.battles}${a.mode ? ` de ${a.mode}` : ''}${
      a.rank && a.days ? ` jogadas no ${a.rank} nos últimos ${a.days} dias.` : ' de jogadores de todos os ranks.'
    }${a.asOf ? ` Dados de ${a.asOf}.` : ''}`,
  disagree: 'Não concorda? Monte a sua',
  howSummary: 'Como a pontuação meta funciona',
  how1: (format) =>
    `A pontuação meta junta a taxa de vitória ajustada e a taxa de escolha, em relação a esta lista ${format === 'ranked' ? 'do Ranqueado' : 'de troféus'}.`,
  how2a: 'Os brawlers são ordenados pela',
  metaScore: 'pontuação meta',
  how2b:
    'de 0 a 10, que junta uma taxa de vitória ajustada com a taxa de escolha em escala logarítmica. Só pela taxa de vitória, um brawler que ninguém joga valeria o mesmo que um muito usado com os mesmos resultados, então a popularidade desempata.',
  how3a: 'A escala é calibrada dentro desta lista, então as pontuações comparam os brawlers entre si aqui e não podem ser comparadas com a',
  otherList: (format) => (format === 'ranked' ? 'lista de troféus' : 'lista do Ranqueado'),
  how3b: (floor) =>
    `. Um brawler precisa de ${floor} partidas decididas no período para entrar na lista. Toque ou passe o mouse num brawler para ver os detalhes, ou leia`,
  fullMethod: 'o método completo',
  how3c: '(em inglês).',
  bracketMissingStrong: (rank) => `Ainda não há partidas suficientes do ${rank}`,
  bracketMissingRest:
    'para ranquear os brawlers neste rank, então esta é a lista de todos os ranks. Ela vai sendo preenchida nos próximos dias.',
  bracketWidened: (rank, days, normal) =>
    `Há poucas partidas do ${rank} agora (é normal nos primeiros dias de cada temporada), então esta lista cobre os últimos ${days} dias em vez de ${normal}.`,
  unratedSub: (floor, w) =>
    `Cada um precisa de ${floor} partidas decididas na janela de ${w}; o número mostra quanto falta. Os mais perto primeiro.`,
  unratedChip: (name, games, floor) => `${name}: ${games} de ${floor} partidas decididas para entrar na lista`,
  chipTitle: (a) =>
    `${a.name}: pontuação meta ${a.score} com ${a.adj} de vitórias ajustadas (${a.raw} sem ajuste, contra uma média de ${a.base} nos modos dele) e ${a.pick} de escolha, em ${a.games} partidas decididas`,
  winLetter: 'V',
  winTitle: 'Taxa de vitória ajustada',
  pickLetter: 'E',
  pickTitle: 'Taxa de escolha',
  emptyTitle: (c) => (c ? 'Ainda não há dados' : 'Banco de dados não configurado'),
  emptyBody: (c, w) =>
    c ? `Ainda não há partidas suficientes em ${w}. Tente uma janela maior ou volte daqui a pouco.` : 'O ranking não está disponível agora.',
  browse: 'Ver todos os brawlers',
  podium: 'Top 3 agora',
  podiumDetail: (rate) => `${rate} de vitórias`,
};

export const TIER_COPY: Record<Locale, TierCopy> = { en, es, pt };
