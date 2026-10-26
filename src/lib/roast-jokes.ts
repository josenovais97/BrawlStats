import { titleCase } from '@/lib/format';
import type { Locale } from '@/lib/i18n';
import type { RankedStanding, RoastFacts } from '@/lib/roast';

/**
 * The joke bank behind `lib/roast`.
 *
 * Every line is written here in all three languages rather than keyed through
 * `src/i18n`: a joke is rewritten for each language, not translated sentence
 * by sentence, and keeping the three side by side is what stops one drifting.
 * Game words follow the game's own translations (Competitivo / Ranqueado,
 * Supervivencia / Combate, habilidad estelar / poder de estrela).
 *
 * Rules for adding one: second person ("you"), never a pronoun for the
 * player; roast the account and the gameplay, never the person -- much of
 * the audience is young. A joke must be gated on a fact about the account,
 * and should quote that account's number when it has one.
 */

export type Line = Record<Locale, string>;

export interface Joke {
  id: string;
  /** One joke per topic per roast, so no point is made twice. */
  topic: string;
  /**
   * How sharp this joke is for this account, roughly 1 (filler) to 10 (it
   * could only be about them). Falsy when it does not apply at all.
   */
  when: (f: RoastFacts) => number | false | null | undefined;
  lines: Line[];
}

/* ------------------------------- vocabulary -------------------------------- */

const RANK_WORDS: Record<Locale, string[]> = {
  en: ['Bronze', 'Silver', 'Gold', 'Diamond', 'Mythic', 'Legendary', 'Masters', 'Pro'],
  es: ['Bronce', 'Plata', 'Oro', 'Diamante', 'Mítico', 'Legendario', 'Maestro', 'Pro'],
  pt: ['Bronze', 'Prata', 'Ouro', 'Diamante', 'Mítico', 'Lendário', 'Mestre', 'Pro'],
};

export function rankName(r: RankedStanding | null, lang: Locale): string {
  if (!r) return '–';
  const division = r.raw.split(/\s+/)[1];
  const word = RANK_WORDS[lang][r.index];
  return division ? `${word} ${division}` : word;
}

/** "EL PRIMO" -> "El Primo", "8-BIT" -> "8-Bit", "MR. P" -> "Mr. P". */
export function brawlerName(name: string | null | undefined): string {
  return name ? titleCase(name) : '–';
}

const NUMBER_TAG: Record<Locale, string> = { en: 'en-US', es: 'es-419', pt: 'pt-BR' };

/** Numbers in the roast's language, whatever page it is printed on. */
export function formatIn(n: number, lang: Locale): string {
  return n.toLocaleString(NUMBER_TAG[lang]);
}

/** Every placeholder a line may use, filled from the facts once. */
export function varsFor(f: RoastFacts, lang: Locale): Record<string, string | number> {
  const log = f.log;
  const pct = (n: number, d: number) => `${Math.round((n / d) * 100)}%`;
  return {
    name: f.name,
    main: brawlerName(f.main?.name),
    mainTier: f.main?.tier ?? '–',
    prestige: f.main?.prestige ?? 0,
    tr: f.trophies,
    lvl: f.expLevel,
    owned: f.owned,
    total: f.rosterSize,
    maxed: f.maxed,
    untouched: f.untouched,
    noSp: f.maxedNoStarPower,
    v3: f.wins3v3,
    soloWins: f.winsSolo,
    sdWins: f.winsSolo + f.winsDuo,
    best: rankName(f.rankedBest, lang),
    now: rankName(f.rankedNow, lang),
    streak: f.bestStreak?.streak ?? 0,
    streakB: brawlerName(f.bestStreak?.brawler),
    games: log?.games ?? 0,
    decided: log?.decided ?? 0,
    wins: log?.wins ?? 0,
    wr: log && log.decided > 0 ? pct(log.wins, log.decided) : '–',
    losses: log ? log.decided - log.wins : 0,
    lossStreak: log?.lossStreak ?? 0,
    rankedGames: log?.ranked ?? 0,
    club: f.clubName ?? '–',
    star: log?.starPlayer ?? 0,
    friendly: log?.friendly ?? 0,
    showdownRecent: log?.showdown ?? 0,
    topB: brawlerName(log?.topBrawler?.name),
    topGames: log?.topBrawler?.games ?? 0,
  };
}

const winRate = (f: RoastFacts) => (f.log && f.log.decided >= 10 ? f.log.wins / f.log.decided : null);

/* ---------------------------------- mains ---------------------------------- */

/**
 * Brawler stereotypes the community already jokes about. Keys are the API's
 * shouted names. A brawler missing here falls back to its class, which is
 * fine: a weak specific joke is worse than a decent class one.
 */
const MAINS: Record<string, Line[]> = {
  SHELLY: [
    {
      en: 'You main Shelly. The brawler the tutorial hands you. You just never left the tutorial.',
      es: 'Tu main es Shelly. La brawler que te da el tutorial. Simplemente nunca saliste del tutorial.',
      pt: 'Seu main é a Shelly. A brawler que o tutorial te dá. Você só nunca saiu do tutorial.',
    },
    {
      en: 'Shelly main: sit in a bush, press super, call it strategy.',
      es: 'Main Shelly: esperar en un arbusto, apretar el súper y llamarlo estrategia.',
      pt: 'Main Shelly: ficar na moita, apertar o super e chamar isso de estratégia.',
    },
  ],
  EDGAR: [
    {
      en: 'You main Edgar. Jump in, die, blame the team. Every single game.',
      es: 'Tu main es Edgar. Saltar, morir, culpar al equipo. Todas las partidas.',
      pt: 'Seu main é o Edgar. Pular, morrer, culpar o time. Toda santa partida.',
    },
    {
      en: 'Edgar main. Your whole game plan fits in one button.',
      es: 'Main Edgar. Todo tu plan de juego cabe en un botón.',
      pt: 'Main Edgar. Todo o seu plano de jogo cabe em um botão.',
    },
  ],
  MORTIS: [
    {
      en: 'Mortis main. Your teammates play 2v3 while you dash into the enemy spawn.',
      es: 'Main Mortis. Tus compañeros juegan 2 contra 3 mientras tú haces dash al spawn enemigo.',
      pt: 'Main Mortis. Seus parceiros jogam 2 contra 3 enquanto você dá dash no spawn inimigo.',
    },
    {
      en: 'You main Mortis. Three dashes in, zero kills out.',
      es: 'Tu main es Mortis. Tres dashes para entrar, cero eliminaciones para salir.',
      pt: 'Seu main é o Mortis. Três dashes pra entrar, zero abates pra sair.',
    },
  ],
  COLT: [
    {
      en: 'Colt main. Six bullets a shot and somehow none of them land.',
      es: 'Main Colt. Seis balas por disparo y de algún modo ninguna acierta.',
      pt: 'Main Colt. Seis balas por tiro e de algum jeito nenhuma acerta.',
    },
    {
      en: "You main Colt. The walls you broke this season respect you. The enemies don't.",
      es: 'Tu main es Colt. Las paredes que rompiste esta temporada te respetan. Los enemigos no.',
      pt: 'Seu main é o Colt. As paredes que você quebrou nessa temporada te respeitam. Os inimigos, não.',
    },
  ],
  SPIKE: [
    {
      en: 'Spike main. You throw a cactus and pray. Mostly pray.',
      es: 'Main Spike. Lanzas un cactus y rezas. Más que nada rezas.',
      pt: 'Main Spike. Você joga um cacto e reza. Mais reza do que joga.',
    },
  ],
  LEON: [
    {
      en: 'Leon main. Invisible in the match, invisible on the scoreboard.',
      es: 'Main Leon. Invisible en la partida, invisible en el marcador.',
      pt: 'Main Leon. Invisível na partida, invisível no placar.',
    },
    {
      en: "You main Leon. Going invisible to run away isn't the play, by the way.",
      es: 'Tu main es Leon. Volverse invisible para huir no es la jugada, por cierto.',
      pt: 'Seu main é o Leon. Ficar invisível pra fugir não é a jogada, só avisando.',
    },
  ],
  CROW: [
    {
      en: 'Crow main. You poison everyone and finish no one.',
      es: 'Main Crow. Envenenas a todos y no rematas a nadie.',
      pt: 'Main Crow. Você envenena todo mundo e não finaliza ninguém.',
    },
  ],
  'EL PRIMO': [
    {
      en: 'El Primo main. Your super is a one-way ticket into the enemy team.',
      es: 'Main El Primo. Tu súper es un boleto de ida al medio del equipo enemigo.',
      pt: 'Main El Primo. Seu super é uma passagem só de ida pro meio do time inimigo.',
    },
    {
      en: 'You main El Primo. Big muscles, small plans.',
      es: 'Tu main es El Primo. Músculos grandes, planes pequeños.',
      pt: 'Seu main é o El Primo. Músculos grandes, planos pequenos.',
    },
  ],
  DYNAMIKE: [
    {
      en: 'Dynamike main. The wall took more damage than the enemies did.',
      es: 'Main Dynamike. La pared recibió más daño que los enemigos.',
      pt: 'Main Dynamike. A parede tomou mais dano que os inimigos.',
    },
    {
      en: 'You main Dynamike. Your bombs land where the enemy was three seconds ago.',
      es: 'Tu main es Dynamike. Tus bombas caen donde estaba el enemigo hace tres segundos.',
      pt: 'Seu main é o Dynamike. Suas bombas caem onde o inimigo estava três segundos atrás.',
    },
  ],
  FRANK: [
    {
      en: 'Frank main. Two seconds to swing, half a second to get stunned.',
      es: 'Main Frank. Dos segundos para golpear, medio segundo para que te aturdan.',
      pt: 'Main Frank. Dois segundos pra bater, meio segundo pra ser atordoado.',
    },
  ],
  BULL: [
    {
      en: 'You main Bull. Your super has taken you into the gas more times than into a kill.',
      es: 'Tu main es Bull. Tu súper te llevó al gas más veces que a una eliminación.',
      pt: 'Seu main é o Bull. Seu super já te levou mais vezes pro gás do que pra um abate.',
    },
  ],
  PIPER: [
    {
      en: 'Piper main. You live in the back corner and call it map control.',
      es: 'Main Piper. Vives en la esquina de atrás y lo llamas control del mapa.',
      pt: 'Main Piper. Você mora no cantinho lá de trás e chama isso de controle do mapa.',
    },
  ],
  BIBI: [
    {
      en: 'Bibi main. You swing that bat like the ball owes you money.',
      es: 'Main Bibi. Bateas como si la pelota te debiera dinero.',
      pt: 'Main Bibi. Você gira esse taco como se a bola te devesse dinheiro.',
    },
  ],
  POCO: [
    {
      en: 'Poco main. You play guitar while the team dies around you.',
      es: 'Main Poco. Tocas la guitarra mientras el equipo muere a tu alrededor.',
      pt: 'Main Poco. Você toca violão enquanto o time morre do seu lado.',
    },
  ],
  NITA: [
    {
      en: 'Nita main. The bear does the work and you take the credit.',
      es: 'Main Nita. El oso hace el trabajo y tú te llevas el crédito.',
      pt: 'Main Nita. O urso faz o trabalho e você leva o crédito.',
    },
  ],
  RICO: [
    {
      en: 'Rico main. Every bullet bounces off a wall. Not one bounces off an enemy.',
      es: 'Main Rico. Todas las balas rebotan en una pared. Ninguna en un enemigo.',
      pt: 'Main Rico. Toda bala quica na parede. Nenhuma no inimigo.',
    },
  ],
  DARRYL: [
    {
      en: 'Darryl main. Roll in, roll out, hope nobody saw.',
      es: 'Main Darryl. Rodar adentro, rodar afuera y esperar que nadie lo haya visto.',
      pt: 'Main Darryl. Rolar pra dentro, rolar pra fora e torcer pra ninguém ter visto.',
    },
  ],
  GALE: [
    {
      en: "Gale main. You've blown more enemies to safety than into a wall.",
      es: 'Main Gale. Mandaste a más enemigos a un lugar seguro que contra una pared.',
      pt: 'Main Gale. Você já soprou mais inimigos pra um lugar seguro do que pra parede.',
    },
  ],
  '8-BIT': [
    {
      en: '8-Bit main. The slowest brawler in the game, and somehow you still arrive late.',
      es: 'Main 8-Bit. El brawler más lento del juego y aun así llegas tarde.',
      pt: 'Main 8-Bit. O brawler mais lento do jogo e mesmo assim você chega atrasado.',
    },
  ],
  BROCK: [
    {
      en: 'Brock main. A rocket launcher and a dream.',
      es: 'Main Brock. Un lanzacohetes y un sueño.',
      pt: 'Main Brock. Um lança-foguetes e um sonho.',
    },
  ],
  FANG: [
    {
      en: 'Fang main. Kick, chain, die. Your teammates know the routine by now.',
      es: 'Main Fang. Patada, cadena, muerte. Tus compañeros ya se saben la rutina.',
      pt: 'Main Fang. Chute, corrente, morte. Seus parceiros já decoraram a rotina.',
    },
  ],
  KENJI: [
    {
      en: 'Kenji main. Samurai sword, zero honor.',
      es: 'Main Kenji. Espada de samurái, cero honor.',
      pt: 'Main Kenji. Espada de samurai, zero honra.',
    },
  ],
  MICO: [
    {
      en: 'Mico main. Monkey see, monkey jump, monkey die.',
      es: 'Main Mico. Mono ve, mono salta, mono muere.',
      pt: 'Main Mico. Macaco vê, macaco pula, macaco morre.',
    },
  ],
  GUS: [
    {
      en: 'Gus main. Your teammates get shields. You get excuses.',
      es: 'Main Gus. Tus compañeros reciben escudos. Tú, excusas.',
      pt: 'Main Gus. Seus parceiros ganham escudo. Você ganha desculpas.',
    },
  ],
  SURGE: [
    {
      en: "Surge main. Three upgrade stages, and you've never seen the third.",
      es: 'Main Surge. Tres etapas de mejora y nunca viste la tercera.',
      pt: 'Main Surge. Três estágios de melhoria e você nunca viu o terceiro.',
    },
  ],
  STU: [
    {
      en: "Stu main. You dash so much that even you don't know where you are.",
      es: 'Main Stu. Haces tantos dashes que ni tú sabes dónde estás.',
      pt: 'Main Stu. Você dá tanto dash que nem você sabe onde está.',
    },
  ],
  BUZZ: [
    {
      en: 'Buzz main. A lifeguard who never saves anyone.',
      es: 'Main Buzz. Un salvavidas que nunca salva a nadie.',
      pt: 'Main Buzz. Um salva-vidas que nunca salva ninguém.',
    },
  ],
  TARA: [
    {
      en: 'Tara main. Your super pulls everyone together. And then what?',
      es: 'Main Tara. Tu súper junta a todos. ¿Y después qué?',
      pt: 'Main Tara. Seu super junta todo mundo. E depois?',
    },
  ],
  GENE: [
    {
      en: 'Gene main. You pulled the enemy tank into your own team. Again.',
      es: 'Main Gene. Atrajiste al tanque enemigo hacia tu propio equipo. Otra vez.',
      pt: 'Main Gene. Você puxou o tanque inimigo pro seu próprio time. De novo.',
    },
  ],
  BYRON: [
    {
      en: 'Byron main. You heal from so far back that the team forgets you exist.',
      es: 'Main Byron. Curas desde tan lejos que el equipo olvida que existes.',
      pt: 'Main Byron. Você cura de tão longe que o time esquece que você existe.',
    },
  ],
  MAX: [
    {
      en: 'Max main. The fastest brawler in the game, and the first one back to spawn.',
      es: 'Main Max. La brawler más rápida del juego y la primera en volver al spawn.',
      pt: 'Main Max. A brawler mais rápida do jogo e a primeira a voltar pro spawn.',
    },
  ],
  SANDY: [
    {
      en: 'Sandy main. Even your gameplay looks sleepy.',
      es: 'Main Sandy. Hasta tu forma de jugar tiene sueño.',
      pt: 'Main Sandy. Até o seu jeito de jogar tá com sono.',
    },
  ],
  JESSIE: [
    {
      en: 'Jessie main. The turret is the real MVP.',
      es: 'Main Jessie. La torreta es la verdadera MVP.',
      pt: 'Main Jessie. A torreta é a verdadeira MVP.',
    },
  ],
  PENNY: [
    {
      en: 'Penny main. Your cannon has more kills than you do.',
      es: 'Main Penny. Tu cañón tiene más eliminaciones que tú.',
      pt: 'Main Penny. Seu canhão tem mais abates que você.',
    },
  ],
  BARLEY: [
    {
      en: 'Barley main. You throw bottles from behind a wall and call it teamwork.',
      es: 'Main Barley. Lanzas botellas desde detrás de una pared y lo llamas trabajo en equipo.',
      pt: 'Main Barley. Você joga garrafa atrás da parede e chama isso de trabalho em equipe.',
    },
  ],
  ROSA: [
    {
      en: 'Rosa main. Bush, punch, shield, repeat. Gardening is a lifestyle.',
      es: 'Main Rosa. Arbusto, golpe, escudo, repetir. La jardinería es un estilo de vida.',
      pt: 'Main Rosa. Moita, soco, escudo, repete. Jardinagem é um estilo de vida.',
    },
  ],
  EMZ: [
    {
      en: 'Emz main. All that hairspray, and still no followers.',
      es: 'Main Emz. Tanto spray para el pelo y sigues sin seguidores.',
      pt: 'Main Emz. Tanto spray de cabelo e ainda sem seguidores.',
    },
  ],
  BEA: [
    {
      en: 'Bea main. One supercharged shot per game. If it lands.',
      es: 'Main Bea. Un disparo supercargado por partida. Si acierta.',
      pt: 'Main Bea. Um tiro supercarregado por partida. Se acertar.',
    },
  ],
  SQUEAK: [
    {
      en: 'Squeak main. Sticky bombs everywhere, damage nowhere.',
      es: 'Main Squeak. Bombas pegajosas por todas partes, daño en ninguna.',
      pt: 'Main Squeak. Bomba grudenta pra todo lado, dano em lugar nenhum.',
    },
  ],
  GRIFF: [
    {
      en: "Griff main. All those coins and you still can't buy a win.",
      es: 'Main Griff. Tantas monedas y todavía no puedes comprar una victoria.',
      pt: 'Main Griff. Tanta moeda e ainda não dá pra comprar uma vitória.',
    },
  ],
  LOLA: [
    {
      en: 'Lola main. Your clone aims better than you do.',
      es: 'Main Lola. Tu clon apunta mejor que tú.',
      pt: 'Main Lola. Seu clone mira melhor que você.',
    },
  ],
  SAM: [
    {
      en: 'Sam main. You throw your knuckle busters away and walk over to get them. Every fight.',
      es: 'Main Sam. Lanzas tus nudilleras y caminas a buscarlas. En cada pelea.',
      pt: 'Main Sam. Você joga as soqueiras longe e anda pra buscar. Em toda luta.',
    },
  ],
  MELODIE: [
    {
      en: 'Melodie main. Three notes spinning around you, and none of them is a plan.',
      es: 'Main Melodie. Tres notas girando a tu alrededor y ninguna es un plan.',
      pt: 'Main Melodie. Três notas girando em volta de você e nenhuma é um plano.',
    },
  ],
  BELLE: [
    {
      en: 'Belle main. You mark the enemy so the team knows who you missed.',
      es: 'Main Belle. Marcas al enemigo para que el equipo sepa a quién fallaste.',
      pt: 'Main Belle. Você marca o inimigo pro time saber em quem você errou.',
    },
  ],
  AMBER: [
    {
      en: 'Amber main. You set the whole map on fire, except the enemies.',
      es: 'Main Amber. Prendes fuego todo el mapa, menos a los enemigos.',
      pt: 'Main Amber. Você bota fogo no mapa inteiro, menos nos inimigos.',
    },
  ],
  MEG: [
    {
      en: 'Meg main. Lose the mech, lose the will to live.',
      es: 'Main Meg. Pierdes el robot y pierdes las ganas de vivir.',
      pt: 'Main Meg. Perdeu o robô, perdeu a vontade de viver.',
    },
  ],
  CHESTER: [
    {
      en: "Chester main. Even you don't know which super is coming next.",
      es: 'Main Chester. Ni tú sabes qué súper viene después.',
      pt: 'Main Chester. Nem você sabe qual super vem depois.',
    },
  ],
  HANK: [
    {
      en: 'Hank main. You charge that bubble for so long the match ends first.',
      es: 'Main Hank. Cargas esa burbuja tanto tiempo que la partida termina antes.',
      pt: 'Main Hank. Você carrega essa bolha por tanto tempo que a partida acaba antes.',
    },
  ],
  JACKY: [
    {
      en: "Jacky main. You pull everyone into a fight you're about to lose.",
      es: 'Main Jacky. Arrastras a todos a una pelea que estás a punto de perder.',
      pt: 'Main Jacky. Você puxa todo mundo pra uma briga que tá prestes a perder.',
    },
  ],
  CORDELIUS: [
    {
      en: 'Cordelius main. You drag them into the shadow realm and lose there too.',
      es: 'Main Cordelius. Los arrastras al reino de las sombras y también pierdes allí.',
      pt: 'Main Cordelius. Você leva eles pro reino das sombras e perde lá também.',
    },
  ],
  KIT: [
    {
      en: "Kit main. You ride on your teammates' heads and call that a carry.",
      es: 'Main Kit. Te subes a la cabeza de tus compañeros y lo llamas cargar al equipo.',
      pt: 'Main Kit. Você sobe na cabeça dos parceiros e chama isso de carregar o time.',
    },
  ],
  // From here on written against each brawler's own kit and bio (Brawlify).
  ALLI: [
    {
      en: 'Alli main. You stalk enemies like a horror movie, then miss like a comedy.',
      es: 'Main Alli. Acechas a los enemigos como en una película de terror y fallas como en una comedia.',
      pt: 'Main Alli. Você persegue os inimigos como num filme de terror e erra como numa comédia.',
    },
  ],
  ANGELO: [
    {
      en: 'Angelo main. A mosquito with a bow. Just as annoying, just as easy to swat.',
      es: 'Main Angelo. Un mosquito con arco. Igual de molesto, igual de fácil de aplastar.',
      pt: 'Main Angelo. Um mosquito com arco. Irritante e tão fácil de esmagar quanto.',
    },
  ],
  ASH: [
    {
      en: 'Ash main. You live in a trash can and play like it.',
      es: 'Main Ash. Vives en un bote de basura y juegas a la altura.',
      pt: 'Main Ash. Você mora numa lata de lixo e joga à altura.',
    },
  ],
  BERRY: [
    {
      en: 'Berry main. A unicorn who hates the job. Your teammates can relate.',
      es: 'Main Berry. Un unicornio que odia su trabajo. Tus compañeros te entienden.',
      pt: 'Main Berry. Um unicórnio que odeia o trabalho. Seus parceiros entendem bem.',
    },
  ],
  BO: [
    {
      en: 'Bo main. Your weapons came from the gift shop, on sale. It shows.',
      es: 'Main Bo. Tus armas salieron de la tienda de regalos, en oferta. Se nota.',
      pt: 'Main Bo. Suas armas vieram da lojinha, em promoção. Dá pra perceber.',
    },
  ],
  BOLT: [
    {
      en: 'Bolt main. You wanted to be a race car. You ended up a bowling ball.',
      es: 'Main Bolt. Querías ser auto de carreras y terminaste siendo una bola de boliche.',
      pt: 'Main Bolt. Você queria ser carro de corrida e virou bola de boliche.',
    },
  ],
  BONNIE: [
    {
      en: 'Bonnie main. Your dream is a cannon ride to the moon. Your team would happily help.',
      es: 'Main Bonnie. Tu sueño es ir a la luna en cañón. Tu equipo te ayudaría encantado.',
      pt: 'Main Bonnie. Seu sonho é ir pra lua de canhão. Seu time ajudaria com prazer.',
    },
  ],
  BUSTER: [
    {
      en: 'Buster main. You brought a movie projector to a fight. Shame the plot is always you losing.',
      es: 'Main Buster. Llevaste un proyector de cine a una pelea. Lástima que la trama siempre sea tú perdiendo.',
      pt: 'Main Buster. Você levou um projetor de cinema pra briga. Pena que o roteiro é sempre você perdendo.',
    },
  ],
  CARL: [
    {
      en: 'Carl main. Throw the pickaxe, wait for it to come back, die waiting.',
      es: 'Main Carl. Lanzas el pico, esperas a que vuelva y mueres esperando.',
      pt: 'Main Carl. Joga a picareta, espera ela voltar e morre esperando.',
    },
  ],
  CHARLIE: [
    {
      en: 'Charlie main. A whole circus act, and the clown is you.',
      es: 'Main Charlie. Todo un número de circo y el payaso eres tú.',
      pt: 'Main Charlie. Um número de circo inteiro e o palhaço é você.',
    },
  ],
  CHUCK: [
    {
      en: 'Chuck main. You place the posts, plan the route, and the train still goes nowhere.',
      es: 'Main Chuck. Pones los postes, planeas la ruta y el tren igual no va a ningún lado.',
      pt: 'Main Chuck. Você coloca os postes, planeja a rota e o trem não vai pra lugar nenhum.',
    },
  ],
  CLANCY: [
    {
      en: 'Clancy main. A fake crustacean with real ambition. Shame about the aim.',
      es: 'Main Clancy. Un crustáceo falso con ambición de verdad. Lástima la puntería.',
      pt: 'Main Clancy. Um crustáceo falso com ambição de verdade. Pena a mira.',
    },
  ],
  COLETTE: [
    {
      en: "Colette main. You collected every brawler's plushie. Collecting wins was harder, apparently.",
      es: 'Main Colette. Coleccionaste el peluche de cada brawler. Coleccionar victorias, al parecer, cuesta más.',
      pt: 'Main Colette. Você colecionou a pelúcia de todo brawler. Colecionar vitórias pelo jeito é mais difícil.',
    },
  ],
  COSMO: [
    {
      en: 'Cosmo main. Always gazing at the stars. Never at the enemy.',
      es: 'Main Cosmo. Siempre mirando las estrellas. Nunca al enemigo.',
      pt: 'Main Cosmo. Sempre olhando as estrelas. Nunca o inimigo.',
    },
  ],
  DAMIAN: [
    {
      en: 'Damian main. Loud, angry, breaks everything. Your team calls it a concert. The enemy calls it a free win.',
      es: 'Main Damian. Ruidoso, furioso, rompe todo. Tu equipo lo llama concierto. El enemigo, victoria gratis.',
      pt: 'Main Damian. Barulhento, furioso, quebra tudo. Seu time chama de show. O inimigo chama de vitória fácil.',
    },
  ],
  DOUG: [
    {
      en: 'Doug main. You revive your teammates so they can die a second time.',
      es: 'Main Doug. Revives a tus compañeros para que mueran por segunda vez.',
      pt: 'Main Doug. Você revive os parceiros pra eles morrerem de novo.',
    },
  ],
  DRACO: [
    {
      en: 'Draco main. An inflatable dragon. Fitting: it pops just as fast.',
      es: 'Main Draco. Un dragón inflable. Tiene sentido: se pincha igual de rápido.',
      pt: 'Main Draco. Um dragão inflável. Faz sentido: estoura tão rápido quanto.',
    },
  ],
  EVE: [
    {
      en: 'Eve main. You fire eggs at people and call it parenting.',
      es: 'Main Eve. Le disparas huevos a la gente y lo llamas maternidad.',
      pt: 'Main Eve. Você atira ovos nas pessoas e chama isso de maternidade.',
    },
  ],
  FINX: [
    {
      en: 'Finx main. You can rewind time, and you still make the same mistakes.',
      es: 'Main Finx. Puedes retroceder el tiempo y aun así cometes los mismos errores.',
      pt: 'Main Finx. Você volta no tempo e mesmo assim comete os mesmos erros.',
    },
  ],
  GIGI: [
    {
      en: 'Gigi main. A cursed puppet. Your teammates feel the curse every game.',
      es: 'Main Gigi. Una marioneta maldita. Tus compañeros sienten la maldición en cada partida.',
      pt: 'Main Gigi. Uma marionete amaldiçoada. Seus parceiros sentem a maldição toda partida.',
    },
  ],
  GLOWY: [
    {
      en: "Glowy main. You tether yourself to people. That's a lot of attachment for one game.",
      es: 'Main Glowy. Te conectas a la gente con un rayo. Demasiado apego para una sola partida.',
      pt: 'Main Glowy. Você se prende nas pessoas com um raio. É muito apego pra uma partida só.',
    },
  ],
  GRAY: [
    {
      en: 'Gray main. A mime with finger guns. Silent, like your damage.',
      es: 'Main Gray. Un mimo con pistolas de dedo. Silencioso, como tu daño.',
      pt: 'Main Gray. Um mímico com arminha de dedo. Silencioso, igual ao seu dano.',
    },
  ],
  GROM: [
    {
      en: 'Grom main. Kindergarten kids traumatised Grom. Your teammates know the feeling.',
      es: 'Main Grom. Los niños del jardín de infantes traumatizaron a Grom. Tus compañeros saben lo que se siente.',
      pt: 'Main Grom. As crianças do jardim de infância traumatizaram o Grom. Seus parceiros sabem como é.',
    },
  ],
  'JAE-YONG': [
    {
      en: "Jae-Yong main. He thinks he's a karaoke god. You think you play well. You're both wrong.",
      es: 'Main Jae-Yong. Él cree que es un dios del karaoke. Tú crees que juegas bien. Los dos se equivocan.',
      pt: 'Main Jae-Yong. Ele acha que é um deus do karaokê. Você acha que joga bem. Os dois estão errados.',
    },
  ],
  JANET: [
    {
      en: "Janet main. You fly over the whole map and still miss what's happening.",
      es: 'Main Janet. Vuelas sobre todo el mapa y aun así no te enteras de lo que pasa.',
      pt: 'Main Janet. Você voa por cima do mapa inteiro e mesmo assim não vê o que tá acontecendo.',
    },
  ],
  JUJU: [
    {
      en: 'Juju main. Even your voodoo doll has a better win rate. His name is Gregory, by the way.',
      es: 'Main Juju. Hasta tu muñeco vudú tiene mejor porcentaje de victorias. Se llama Gregory, por cierto.',
      pt: 'Main Juju. Até seu boneco de vodu tem mais vitórias que você. O nome dele é Gregory, aliás.',
    },
  ],
  KAZE: [
    {
      en: 'Kaze main. Two aspects, geisha and ninja. Neither of them wins.',
      es: 'Main Kaze. Dos aspectos, geisha y ninja. Ninguno de los dos gana.',
      pt: 'Main Kaze. Dois aspectos, gueixa e ninja. Nenhum dos dois ganha.',
    },
  ],
  'LARRY & LAWRIE': [
    {
      en: 'Larry & Lawrie main. Two brawlers for the price of one, and still outnumbered.',
      es: 'Main Larry y Lawrie. Dos brawlers por el precio de uno y aun así en desventaja.',
      pt: 'Main Larry e Lawrie. Dois brawlers pelo preço de um e mesmo assim em desvantagem.',
    },
  ],
  LILY: [
    {
      en: 'Lily main. You dive into the Shadow Realm. Your win rate stays there.',
      es: 'Main Lily. Te metes al Reino de las Sombras. Tu porcentaje de victorias se queda ahí.',
      pt: 'Main Lily. Você entra no Reino das Sombras. Sua taxa de vitória fica por lá.',
    },
  ],
  LOU: [
    {
      en: 'Lou main. A snow cone robot that never made a sale. Your record looks familiar.',
      es: 'Main Lou. Un robot de raspados que nunca vendió nada. Tu historial se parece.',
      pt: 'Main Lou. Um robô de raspadinha que nunca vendeu nada. Seu histórico é parecido.',
    },
  ],
  LUMI: [
    {
      en: 'Lumi main. A metal drummer. Loud, fast, and completely off beat.',
      es: 'Main Lumi. Baterista de metal. Ruidosa, rápida y completamente fuera de ritmo.',
      pt: 'Main Lumi. Baterista de metal. Barulhenta, rápida e totalmente fora do ritmo.',
    },
  ],
  MAISIE: [
    {
      en: "Maisie main. A safety coordinator who walks straight into danger. That's every fight you take.",
      es: 'Main Maisie. Una coordinadora de seguridad que se mete de cabeza en el peligro. Así son todas tus peleas.',
      pt: 'Main Maisie. Uma coordenadora de segurança que vai direto pro perigo. Igual a toda briga sua.',
    },
  ],
  MANDY: [
    {
      en: 'Mandy main. Queen of the candy kingdom, peasant of the scoreboard.',
      es: 'Main Mandy. Reina del reino de los dulces, plebeya del marcador.',
      pt: 'Main Mandy. Rainha do reino dos doces, plebeia do placar.',
    },
  ],
  MEEPLE: [
    {
      en: 'Meeple main. Every board game rule memorised. Game sense still loading.',
      es: 'Main Meeple. Te sabes las reglas de todos los juegos de mesa. El sentido del juego sigue cargando.',
      pt: 'Main Meeple. Sabe a regra de todo jogo de tabuleiro. A noção de jogo ainda tá carregando.',
    },
  ],
  MINA: [
    {
      en: 'Mina main. All that breakdancing, and the only thing you break is your win streak.',
      es: 'Main Mina. Tanto breakdance y lo único que rompes es tu racha.',
      pt: 'Main Mina. Tanto breakdance e a única coisa que você quebra é sua sequência de vitórias.',
    },
  ],
  MOE: [
    {
      en: 'Moe main. A blind rat. That explains the aim.',
      es: 'Main Moe. Una rata ciega. Eso explica la puntería.',
      pt: 'Main Moe. Um rato cego. Isso explica a mira.',
    },
  ],
  'MR. P': [
    {
      en: 'Mr. P main. Your porters do all the work while you yell. Like a real manager.',
      es: 'Main Mr. P. Tus botones hacen todo el trabajo mientras gritas. Como un jefe de verdad.',
      pt: 'Main Mr. P. Seus carregadores fazem todo o trabalho enquanto você grita. Igual a um chefe de verdade.',
    },
  ],
  NAJIA: [
    {
      en: "Najia main. You hide in a vase. Honestly, the best idea you've had all game.",
      es: 'Main Najia. Te escondes en un jarrón. Sinceramente, la mejor idea que tuviste en toda la partida.',
      pt: 'Main Najia. Você se esconde num vaso. Sinceramente, a melhor ideia que você teve na partida.',
    },
  ],
  NANI: [
    {
      en: "Nani main. Peep flies all over the map and still can't find a kill.",
      es: 'Main Nani. Peep vuela por todo el mapa y no encuentra ni una eliminación.',
      pt: 'Main Nani. O Peep voa pelo mapa inteiro e não acha um abate.',
    },
  ],
  NORI: [
    {
      en: "Nori main. Kenji and Kaze's kid, destined for greatness. Destiny skipped your games.",
      es: 'Main Nori. El hijo de Kenji y Kaze, destinado a la grandeza. El destino se saltó tus partidas.',
      pt: 'Main Nori. Filho do Kenji e da Kaze, destinado à grandeza. O destino pulou as suas partidas.',
    },
  ],
  OLLIE: [
    {
      en: 'Ollie main. You make the enemies dance. Then you lose the dance-off.',
      es: 'Main Ollie. Haces bailar a los enemigos. Y después pierdes la batalla de baile.',
      pt: 'Main Ollie. Você faz os inimigos dançarem. E depois perde a batalha de dança.',
    },
  ],
  OTIS: [
    {
      en: "Otis main. A street artist. Shame your gameplay isn't a masterpiece.",
      es: 'Main Otis. Un artista callejero. Lástima que tu forma de jugar no sea una obra maestra.',
      pt: 'Main Otis. Um artista de rua. Pena que seu jogo não é uma obra-prima.',
    },
  ],
  PAM: [
    {
      en: 'Pam main. You drop the healing turret and your team still finds a way to die next to it.',
      es: 'Main Pam. Pones la torreta de curación y tu equipo igual encuentra la forma de morir al lado.',
      pt: 'Main Pam. Você coloca a torreta de cura e o time ainda dá um jeito de morrer do lado dela.',
    },
  ],
  PEARL: [
    {
      en: 'Pearl main. Burnt cookies and a burnt win rate.',
      es: 'Main Pearl. Galletas quemadas y un porcentaje de victorias quemado.',
      pt: 'Main Pearl. Biscoitos queimados e uma taxa de vitória queimada.',
    },
  ],
  PIERCE: [
    {
      en: 'Pierce main. A lifeguard who shoots people instead of saving them. Your teammates noticed.',
      es: 'Main Pierce. Un salvavidas que dispara en vez de salvar. Tus compañeros lo notaron.',
      pt: 'Main Pierce. Um salva-vidas que atira em vez de salvar. Seus parceiros perceberam.',
    },
  ],
  'R-T': [
    {
      en: "R-T main. An information kiosk with no idea what's going on.",
      es: 'Main R-T. Un kiosco de información que no tiene idea de lo que pasa.',
      pt: 'Main R-T. Um quiosque de informação que não faz ideia do que tá acontecendo.',
    },
  ],
  RUFFS: [
    {
      en: 'Ruffs main. A space colonel. Your teammates get the power-ups, you get the belly rubs.',
      es: 'Main Ruffs. Un coronel espacial. Tus compañeros reciben las mejoras, tú las caricias en la panza.',
      pt: 'Main Ruffs. Um coronel espacial. Seus parceiros ganham os power-ups, você ganha carinho na barriga.',
    },
  ],
  SHADE: [
    {
      en: 'Shade main. A pile of clothes with sunglasses. Your bedroom floor has the same energy.',
      es: 'Main Shade. Una pila de ropa con lentes de sol. El piso de tu cuarto tiene la misma energía.',
      pt: 'Main Shade. Uma pilha de roupa com óculos escuros. O chão do seu quarto tem a mesma energia.',
    },
  ],
  SIRIUS: [
    {
      en: "Sirius main. Banned from Starr Park and back for revenge. The revenge isn't going well.",
      es: 'Main Sirius. Expulsado de Starr Park y de vuelta para vengarse. La venganza no va bien.',
      pt: 'Main Sirius. Expulso do Starr Park e de volta pra se vingar. A vingança não tá indo bem.',
    },
  ],
  SPROUT: [
    {
      en: 'Sprout main. You build a wall to protect your team. From you, probably.',
      es: 'Main Sprout. Construyes una pared para proteger a tu equipo. De ti, probablemente.',
      pt: 'Main Sprout. Você constrói uma parede pra proteger o time. De você, provavelmente.',
    },
  ],
  'STARR NOVA': [
    {
      en: "Starr Nova main. A cosplayer who thinks she's an anime hero. You think you're a pro. Same energy.",
      es: 'Main Starr Nova. Una cosplayer que se cree heroína de anime. Tú te crees pro. La misma energía.',
      pt: 'Main Starr Nova. Uma cosplayer que se acha heroína de anime. Você se acha pro. Mesma energia.',
    },
  ],
  TICK: [
    {
      en: "Tick main. Your head is literally a bomb. Your plans aren't much better.",
      es: 'Main Tick. Tu cabeza es literalmente una bomba. Tus planes no son mucho mejores.',
      pt: 'Main Tick. Sua cabeça é literalmente uma bomba. Seus planos não são muito melhores.',
    },
  ],
  TRUNK: [
    {
      en: 'Trunk main. A colony of ants pretending to be a tree. Still smarter than your draft.',
      es: 'Main Trunk. Una colonia de hormigas que finge ser un árbol. Aun así, más inteligente que tu selección.',
      pt: 'Main Trunk. Uma colônia de formigas fingindo ser árvore. Mesmo assim, mais esperta que o seu draft.',
    },
  ],
  WENDY: [
    {
      en: 'Wendy main. You came to save the planet. Start with your win rate.',
      es: 'Main Wendy. Viniste a salvar el planeta. Empieza por tu porcentaje de victorias.',
      pt: 'Main Wendy. Você veio salvar o planeta. Começa pela sua taxa de vitória.',
    },
  ],
  WILLOW: [
    {
      en: 'Willow main. You mind-control the enemy and still lose the fight.',
      es: 'Main Willow. Controlas la mente del enemigo y aun así pierdes la pelea.',
      pt: 'Main Willow. Você controla a mente do inimigo e mesmo assim perde a briga.',
    },
  ],
  ZIGGY: [
    {
      en: 'Ziggy main. Not tricks, illusions. Like your rank.',
      es: 'Main Ziggy. No son trucos, son ilusiones. Como tu rango.',
      pt: 'Main Ziggy. Não são truques, são ilusões. Igual ao seu rank.',
    },
  ],
  VINCE: [
    {
      en: 'Vince main. Coffee and bugs. Your customers ran away. So did your teammates.',
      es: 'Main Vince. Café y bichos. Tus clientes huyeron. Tus compañeros también.',
      pt: 'Main Vince. Café e insetos. Seus clientes fugiram. Seus parceiros também.',
    },
  ],
  'BUZZ LIGHTYEAR': [
    {
      en: "Buzz Lightyear main. To infinity and beyond: the rank you'll never reach.",
      es: 'Main Buzz Lightyear. Al infinito y más allá: el rango al que nunca vas a llegar.',
      pt: 'Main Buzz Lightyear. Ao infinito e além: o rank que você nunca vai alcançar.',
    },
  ],
};

/** By class, for a main with no line of its own. */
const CLASS_MAINS: Record<string, Line> = {
  Assassin: {
    en: '{main} main. Diving into three enemies alone is a personality, not a strategy.',
    es: 'Main {main}. Meterte solo contra tres enemigos es una personalidad, no una estrategia.',
    pt: 'Main {main}. Mergulhar sozinho em três inimigos é personalidade, não estratégia.',
  },
  Tank: {
    en: '{main} main. All that health, and you still find a way to waste it.',
    es: 'Main {main}. Tanta vida y aun así encuentras la forma de desperdiciarla.',
    pt: 'Main {main}. Tanta vida e mesmo assim você dá um jeito de desperdiçar.',
  },
  Marksman: {
    en: "{main} main. You stay so far back you're basically spectating.",
    es: 'Main {main}. Te quedas tan atrás que básicamente eres espectador.',
    pt: 'Main {main}. Você fica tão lá atrás que é praticamente espectador.',
  },
  Artillery: {
    en: '{main} main. Behind a wall, far from danger, far from mattering.',
    es: 'Main {main}. Detrás de una pared, lejos del peligro, lejos de importar.',
    pt: 'Main {main}. Atrás da parede, longe do perigo, longe de fazer diferença.',
  },
  Support: {
    en: '{main} main. Healing the team so it can lose more slowly.',
    es: 'Main {main}. Curas al equipo para que pierda más despacio.',
    pt: 'Main {main}. Cura o time pra ele perder mais devagar.',
  },
  Controller: {
    en: '{main} main. You control the map. Just not the scoreboard.',
    es: 'Main {main}. Controlas el mapa. Pero no el marcador.',
    pt: 'Main {main}. Você controla o mapa. Só não controla o placar.',
  },
  'Damage Dealer': {
    en: '{main} main. "Damage Dealer", says the class. Your stats say otherwise.',
    es: 'Main {main}. "Daño", dice la clase. Tus estadísticas dicen otra cosa.',
    pt: 'Main {main}. "Dano", diz a classe. Suas estatísticas dizem outra coisa.',
  },
};

export function mainLines(f: RoastFacts): Line[] | null {
  if (!f.main) return null;
  return MAINS[f.main.name.toUpperCase()] ?? null;
}

/* ---------------------------------- jokes ---------------------------------- */

const rankedIdx = (f: RoastFacts) => f.rankedBest?.index ?? -1;

export const JOKES: Joke[] = [
  // ---- the main -----------------------------------------------------------
  {
    id: 'main-specific',
    topic: 'main',
    when: (f) => (mainLines(f) ? 9 : 0),
    // Replaced per account in `jokeLines`; the bank entry only gates it.
    lines: [],
  },
  {
    id: 'main-class',
    topic: 'main',
    when: (f) => !mainLines(f) && f.main?.className && CLASS_MAINS[f.main.className] ? 7 : 0,
    lines: [],
  },
  {
    id: 'main-unknown',
    // Shares the meta topic: a tier joke already names the main, better.
    topic: 'meta',
    when: (f) => (f.main && !mainLines(f) && !(f.main.className && CLASS_MAINS[f.main.className]) ? 3 : 0),
    lines: [
      {
        en: '{main} main. Out of {total} brawlers, this is the one you chose. Interesting.',
        es: 'Main {main}. De {total} brawlers, elegiste este. Interesante.',
        pt: 'Main {main}. De {total} brawlers, você escolheu esse. Interessante.',
      },
    ],
  },

  // ---- the main against the meta ----------------------------------------
  {
    id: 'meta-low',
    topic: 'meta',
    when: (f) => (f.main?.tier && 'DEF'.includes(f.main.tier) ? 7 : 0),
    lines: [
      {
        en: '{main} is {mainTier} tier in Ranked right now, and you still main it. Loyalty is cute.',
        es: '{main} está en tier {mainTier} en Competitivo ahora mismo y sigue siendo tu main. Qué tierna la lealtad.',
        pt: '{main} tá no tier {mainTier} no Ranqueado agora e continua sendo seu main. Que fofa essa lealdade.',
      },
    ],
  },
  {
    id: 'meta-s',
    topic: 'meta',
    when: (f) => (f.main?.tier === 'S' ? 6 : 0),
    lines: [
      {
        en: '{main} is S tier right now. Your wins belong to the patch, not to you.',
        es: '{main} está en tier S ahora mismo. Tus victorias son del parche, no tuyas.',
        pt: '{main} tá no tier S agora. Suas vitórias são do patch, não suas.',
      },
    ],
  },

  // ---- Ranked -------------------------------------------------------------
  {
    id: 'ranked-none',
    topic: 'ranked',
    when: (f) => (!f.rankedBest ? 6 : 0),
    lines: [
      {
        en: 'No Ranked rank at all. Scared of the draft screen?',
        es: 'Ni un rango en Competitivo. ¿Te da miedo la pantalla de selección?',
        pt: 'Nenhum rank no Ranqueado. Medo da tela de draft?',
      },
    ],
  },
  {
    id: 'ranked-fall',
    topic: 'ranked',
    // Ranked resets each season, so a gap is often just early season: the
    // line is worded to be true either way.
    when: (f) => (f.rankedBest && f.rankedNow && f.rankedBest.index - f.rankedNow.index >= 2 ? 8 : 0),
    lines: [
      {
        en: 'All-time best: {best}. This season: {now}. The comeback is taking its time.',
        es: 'Tu mejor rango histórico: {best}. Esta temporada: {now}. La remontada se está tomando su tiempo.',
        pt: 'Melhor rank da vida: {best}. Nessa temporada: {now}. A volta por cima tá demorando.',
      },
    ],
  },
  {
    id: 'ranked-low',
    topic: 'ranked',
    when: (f) => (rankedIdx(f) >= 0 && rankedIdx(f) <= 2 ? 7 : 0),
    lines: [
      {
        en: 'Best Ranked rank ever: {best}. Even the bots climb higher.',
        es: 'Tu mejor rango en Competitivo: {best}. Hasta los bots suben más.',
        pt: 'Seu melhor rank no Ranqueado: {best}. Até os bots sobem mais.',
      },
    ],
  },
  {
    id: 'ranked-mid',
    topic: 'ranked',
    when: (f) => (rankedIdx(f) === 3 || rankedIdx(f) === 4 ? 4 : 0),
    lines: [
      {
        en: 'Best Ranked rank: {best}. Not good, not bad. Just there.',
        es: 'Tu mejor rango en Competitivo: {best}. Ni bueno ni malo. Simplemente ahí.',
        pt: 'Seu melhor rank no Ranqueado: {best}. Nem bom nem ruim. Só tá lá.',
      },
    ],
  },
  {
    id: 'ranked-legendary',
    topic: 'ranked',
    when: (f) => (rankedIdx(f) === 5 ? 6 : 0),
    lines: [
      {
        en: '{best} in Ranked. Close enough to Masters to see it, far enough to never touch it.',
        es: '{best} en Competitivo. Lo bastante cerca de Maestro para verlo, lo bastante lejos para nunca tocarlo.',
        pt: '{best} no Ranqueado. Perto do Mestre pra ver, longe demais pra encostar.',
      },
    ],
  },
  {
    id: 'ranked-high',
    topic: 'ranked',
    when: (f) => (rankedIdx(f) >= 6 ? 7 : 0),
    lines: [
      {
        en: "{best} in Ranked. Impressive. How's the sunlight these days?",
        es: '{best} en Competitivo. Impresionante. ¿Qué tal la luz del sol estos días?',
        pt: '{best} no Ranqueado. Impressionante. Como anda a luz do sol?',
      },
    ],
  },

  // ---- recent form --------------------------------------------------------
  {
    id: 'form-bad',
    topic: 'form',
    when: (f) => (winRate(f) !== null && winRate(f)! <= 0.4 ? 8 : 0),
    lines: [
      {
        en: '{wins} wins in your last {decided} games. Your teammates deserve compensation.',
        es: '{wins} victorias en tus últimas {decided} partidas. Tus compañeros merecen una compensación.',
        pt: '{wins} vitórias nas suas últimas {decided} partidas. Seus parceiros merecem uma indenização.',
      },
    ],
  },
  {
    id: 'form-good',
    topic: 'form',
    when: (f) => (winRate(f) !== null && winRate(f)! >= 0.7 ? 6 : 0),
    lines: [
      {
        en: "{wr} win rate in your last games. Who's been playing on your account?",
        es: '{wr} de victorias en tus últimas partidas. ¿Quién está jugando en tu cuenta?',
        pt: '{wr} de vitórias nas últimas partidas. Quem anda jogando na sua conta?',
      },
    ],
  },
  {
    id: 'form-coin-flip',
    topic: 'form',
    when: (f) => (f.log && f.log.decided >= 12 && winRate(f)! > 0.42 && winRate(f)! < 0.58 ? 5 : 0),
    lines: [
      {
        en: "{wins} wins and {losses} losses in your last games. You're not a player, you're a coin flip.",
        es: '{wins} victorias y {losses} derrotas en tus últimas partidas. No eres un jugador, eres una moneda al aire.',
        pt: '{wins} vitórias e {losses} derrotas nas últimas partidas. Você não é um jogador, é cara ou coroa.',
      },
    ],
  },
  {
    id: 'ranked-grind',
    topic: 'grind',
    when: (f) => ((f.log?.ranked ?? 0) >= 12 && f.rankedNow && f.rankedNow.index <= 5 ? 6 : 0),
    lines: [
      {
        en: "{rankedGames} of your last {games} games were Ranked, and you're still in {now}. Respect the commitment.",
        es: '{rankedGames} de tus últimas {games} partidas fueron de Competitivo y sigues en {now}. Respeto el compromiso.',
        pt: '{rankedGames} das suas últimas {games} partidas foram no Ranqueado e você continua no {now}. Respeito o compromisso.',
      },
    ],
  },
  {
    id: 'loss-streak',
    topic: 'streak-now',
    when: (f) => ((f.log?.lossStreak ?? 0) >= 4 ? 9 : 0),
    lines: [
      {
        en: 'Lost your last {lossStreak} games in a row. Have you tried turning it off and on again?',
        es: 'Perdiste tus últimas {lossStreak} partidas seguidas. ¿Probaste apagarlo y volver a encenderlo?',
        pt: 'Perdeu as últimas {lossStreak} partidas seguidas. Já tentou desligar e ligar de novo?',
      },
    ],
  },
  {
    id: 'star-none',
    topic: 'star',
    when: (f) => (f.log && f.log.decided >= 12 && f.log.starPlayer === 0 ? 6 : 0),
    lines: [
      {
        en: "Zero Star Player in your last {games} games. Even the game didn't notice you.",
        es: 'Cero veces jugador estrella en tus últimas {games} partidas. Ni el juego te notó.',
        pt: 'Zero vezes MVP nas suas últimas {games} partidas. Nem o jogo te notou.',
      },
    ],
  },
  {
    id: 'star-many',
    topic: 'star',
    when: (f) => ((f.log?.starPlayer ?? 0) >= 8 ? 5 : 0),
    lines: [
      {
        en: 'Star Player {star} times in your last {games} games. Carrying is a job. Are you getting paid?',
        es: 'Jugador estrella {star} veces en tus últimas {games} partidas. Cargar al equipo es un trabajo. ¿Te pagan?',
        pt: 'MVP {star} vezes nas suas últimas {games} partidas. Carregar o time é trabalho. Tão te pagando?',
      },
    ],
  },
  {
    id: 'friendlies',
    topic: 'friendly',
    when: (f) => ((f.log?.friendly ?? 0) >= 8 ? 6 : 0),
    lines: [
      {
        en: '{friendly} of your last {games} games were friendlies. Training for a match that never comes.',
        es: '{friendly} de tus últimas {games} partidas fueron amistosas. Entrenando para un partido que nunca llega.',
        pt: '{friendly} das suas últimas {games} partidas foram amistosos. Treinando pra uma partida que nunca chega.',
      },
    ],
  },
  {
    id: 'one-trick',
    topic: 'one-trick',
    when: (f) => ((f.log?.topBrawler?.games ?? 0) >= 15 ? 6 : 0),
    lines: [
      {
        en: '{topGames} of your last {games} games with {topB}. Other brawlers exist, you know.',
        es: '{topGames} de tus últimas {games} partidas con {topB}. Existen otros brawlers, ¿sabías?',
        pt: '{topGames} das suas últimas {games} partidas de {topB}. Existem outros brawlers, sabia?',
      },
    ],
  },

  // ---- Showdown -----------------------------------------------------------
  {
    id: 'showdown-over-3v3',
    topic: 'showdown',
    when: (f) => (f.winsSolo + f.winsDuo >= 200 && f.winsSolo + f.winsDuo > f.wins3v3 ? 7 : 0),
    lines: [
      {
        en: '{sdWins} Showdown wins and {v3} 3v3 wins. Allergic to teammates?',
        es: '{sdWins} victorias en Supervivencia y {v3} en 3c3. ¿Alergia a los compañeros?',
        pt: '{sdWins} vitórias no Combate e {v3} no 3x3. Alergia a parceiro?',
      },
    ],
  },
  {
    id: 'showdown-teaming',
    topic: 'showdown',
    when: (f) => (f.winsSolo >= 1500 ? 5 : 0),
    lines: [
      {
        en: '{soloWins} Solo Showdown wins. And how many of those were "teaming"?',
        es: '{soloWins} victorias en Supervivencia (solo). ¿Y cuántas fueron haciendo "teaming"?',
        pt: '{soloWins} vitórias no Combate solitário. E quantas foram de "teaming"?',
      },
    ],
  },
  {
    id: 'showdown-recent',
    topic: 'showdown',
    when: (f) => ((f.log?.showdown ?? 0) >= 12 ? 6 : 0),
    lines: [
      {
        en: '{showdownRecent} of your last {games} games were Showdown. Hiding in a bush until the gas does your job.',
        es: '{showdownRecent} de tus últimas {games} partidas fueron de Supervivencia. Escondido en un arbusto hasta que el gas haga tu trabajo.',
        pt: '{showdownRecent} das suas últimas {games} partidas foram de Combate. Escondido na moita até o gás fazer o seu trabalho.',
      },
    ],
  },

  // ---- club ---------------------------------------------------------------
  {
    id: 'no-club',
    topic: 'club',
    when: (f) => (!f.hasClub ? 5 : 0),
    lines: [
      {
        en: 'No club. Even the bots have a club.',
        es: 'Sin club. Hasta los bots tienen club.',
        pt: 'Sem clube. Até os bots têm clube.',
      },
      {
        en: 'No club. Nobody sent an invite, or did everyone kick you?',
        es: 'Sin club. ¿Nadie te invitó o todos te expulsaron?',
        pt: 'Sem clube. Ninguém te convidou ou todo mundo te expulsou?',
      },
    ],
  },

  {
    id: 'club-brag',
    topic: 'club',
    when: (f) => (f.braggingClub ? 6 : 0),
    lines: [
      {
        en: 'Your club is called "{club}". The scariest thing about it is the name.',
        es: 'Tu club se llama "{club}". Lo más aterrador es el nombre.',
        pt: 'Seu clube se chama "{club}". A coisa mais assustadora nele é o nome.',
      },
    ],
  },
  {
    id: 'club-name',
    topic: 'club',
    when: (f) => (f.clubName && !f.braggingClub ? 3 : 0),
    lines: [
      {
        en: 'Your club is called "{club}". Big name. Small Club League results, probably.',
        es: 'Tu club se llama "{club}". Nombre grande. Resultados chicos en la Liga de Clubes, seguramente.',
        pt: 'Seu clube se chama "{club}". Nome grande. Resultado pequeno na Liga de Clubes, com certeza.',
      },
    ],
  },

  // ---- collection ---------------------------------------------------------
  {
    id: 'untouched',
    topic: 'collection',
    when: (f) => (f.untouched >= 15 ? (f.untouched >= 40 ? 6 : 4) : 0),
    lines: [
      {
        en: "{untouched} brawlers still at Power 1. That's not a roster, it's a museum.",
        es: '{untouched} brawlers siguen en poder 1. Eso no es un plantel, es un museo.',
        pt: '{untouched} brawlers ainda no poder 1. Isso não é um elenco, é um museu.',
      },
    ],
  },
  {
    id: 'all-maxed',
    topic: 'collection',
    when: (f) => (f.owned >= 80 && f.maxed === f.owned ? 7 : 0),
    lines: [
      {
        en: "All {maxed} brawlers at Power 11. That's not an account, it's a second job.",
        es: 'Los {maxed} brawlers en poder 11. Eso no es una cuenta, es un segundo trabajo.',
        pt: 'Todos os {maxed} brawlers no poder 11. Isso não é uma conta, é um segundo emprego.',
      },
    ],
  },
  {
    id: 'few-owned',
    topic: 'collection',
    when: (f) => (f.rosterSize - f.owned >= 25 ? 5 : 0),
    lines: [
      {
        en: 'Only {owned} of {total} brawlers unlocked. The Starr Drops must hate you.',
        es: 'Solo {owned} de {total} brawlers desbloqueados. Los Premios Starr deben odiarte.',
        pt: 'Só {owned} de {total} brawlers desbloqueados. Os Sorteios Starr devem te odiar.',
      },
    ],
  },
  {
    id: 'no-star-power',
    topic: 'build',
    when: (f) => (f.maxedNoStarPower >= 3 ? 7 : 0),
    lines: [
      {
        en: '{noSp} brawlers at Power 11 with no star power. Bought the car, forgot the engine.',
        es: '{noSp} brawlers en poder 11 sin habilidad estelar. Compraste el auto y te olvidaste del motor.',
        pt: '{noSp} brawlers no poder 11 sem poder de estrela. Comprou o carro e esqueceu o motor.',
      },
    ],
  },

  // ---- level --------------------------------------------------------------
  {
    id: 'level-no-lessons',
    topic: 'level',
    when: (f) => (f.expLevel >= 150 && f.rankedBest && f.rankedBest.index <= 3 ? 8 : 0),
    lines: [
      {
        en: 'Level {lvl} and your best Ranked is {best}. Years of experience, zero lessons learned.',
        es: 'Nivel {lvl} y tu mejor rango es {best}. Años de experiencia, cero lecciones aprendidas.',
        pt: 'Nível {lvl} e seu melhor rank é {best}. Anos de experiência, zero lições aprendidas.',
      },
    ],
  },
  {
    id: 'level-prodigy',
    topic: 'level',
    when: (f) => (f.expLevel < 60 && f.trophies >= 40_000 ? 6 : 0),
    lines: [
      {
        en: 'Level {lvl} with {tr} trophies? Either a prodigy or somebody else plays this account.',
        es: '¿Nivel {lvl} con {tr} trofeos? O eres un prodigio o esta cuenta la juega otra persona.',
        pt: 'Nível {lvl} com {tr} troféus? Ou é um prodígio ou outra pessoa joga nessa conta.',
      },
    ],
  },
  {
    id: 'level-school',
    topic: 'level',
    when: (f) => (f.expLevel >= 300 ? 5 : 0),
    lines: [
      {
        en: "Level {lvl}. You've spent more time in Brawl Stars than at school.",
        es: 'Nivel {lvl}. Pasaste más tiempo en Brawl Stars que en la escuela.',
        pt: 'Nível {lvl}. Você passou mais tempo no Brawl Stars do que na escola.',
      },
    ],
  },

  // ---- win streaks and prestige ------------------------------------------
  {
    id: 'streak-legend',
    topic: 'streak-best',
    when: (f) => ((f.bestStreak?.streak ?? 0) >= 30 ? 5 : 0),
    lines: [
      {
        en: "A {streak}-win streak with {streakB}. Once. You've been chasing that feeling ever since.",
        es: 'Una racha de {streak} victorias con {streakB}. Una vez. Desde entonces persigues esa sensación.',
        pt: 'Uma sequência de {streak} vitórias de {streakB}. Uma vez. Desde então você corre atrás dessa sensação.',
      },
    ],
  },
  {
    id: 'streak-short',
    topic: 'streak-best',
    when: (f) => (f.bestStreak && f.bestStreak.streak <= 6 ? 6 : 0),
    lines: [
      {
        en: "Your best win streak ever is {streak}. Consistency isn't your thing.",
        es: 'Tu mejor racha de victorias es de {streak}. La constancia no es lo tuyo.',
        pt: 'Sua melhor sequência de vitórias é {streak}. Constância não é com você.',
      },
    ],
  },
  {
    id: 'prestige',
    topic: 'prestige',
    when: (f) => ((f.main?.prestige ?? 0) >= 3 ? 5 : 0),
    lines: [
      {
        en: 'Prestige {prestige} on {main}. Sleep is free, you know.',
        es: 'Prestigio {prestige} con {main}. Dormir es gratis, ¿sabías?',
        pt: 'Prestígio {prestige} no {main}. Dormir é de graça, sabia?',
      },
    ],
  },

  // ---- the name -----------------------------------------------------------
  {
    id: 'name-brag',
    topic: 'name',
    when: (f) => (f.braggingName && winRate(f) !== null && winRate(f)! < 0.55 ? 8 : 0),
    lines: [
      {
        en: 'You named yourself "{name}". Bold, for a {wr} win rate.',
        es: 'Te pusiste "{name}" de nombre. Valiente, con {wr} de victorias.',
        pt: 'Você se chamou de "{name}". Coragem, pra quem tem {wr} de vitórias.',
      },
    ],
  },
  {
    id: 'name-fancy',
    topic: 'name',
    when: (f) => (f.fancyName ? 5 : 0),
    lines: [
      {
        en: 'A name in fancy letters. The effort went into the font, not the gameplay.',
        es: 'Un nombre con letras de lujo. El esfuerzo fue para la fuente, no para el juego.',
        pt: 'Nome com letrinha estilizada. O esforço foi pra fonte, não pro jogo.',
      },
    ],
  },

  // ---- filler, so a quiet account still gets five lines ------------------
  {
    id: 'trophies',
    topic: 'trophies',
    when: () => 1,
    lines: [
      {
        en: '{tr} trophies. Every one of them earned the hard way: slowly.',
        es: '{tr} trofeos. Cada uno ganado por las malas: lentamente.',
        pt: '{tr} troféus. Cada um conquistado do jeito difícil: devagar.',
      },
      {
        en: '{tr} trophies. Somewhere, a bot is proud of you.',
        es: '{tr} trofeos. En algún lugar, un bot está orgulloso de ti.',
        pt: '{tr} troféus. Em algum lugar, um bot tá orgulhoso de você.',
      },
    ],
  },
  {
    id: 'owned-filler',
    topic: 'one-trick',
    // Only true of someone who does play one brawler a lot.
    when: (f) => (f.owned >= 30 && (f.log?.topBrawler?.games ?? 0) >= 8 ? 2 : 0),
    lines: [
      {
        en: '{owned} brawlers, and you still pick the same one every game.',
        es: '{owned} brawlers y sigues eligiendo el mismo en cada partida.',
        pt: '{owned} brawlers e você ainda escolhe o mesmo toda partida.',
      },
    ],
  },
];

/** The lines a joke can say for this account (mains are looked up per account). */
export function jokeLines(joke: Joke, f: RoastFacts): Line[] {
  if (joke.id === 'main-specific') return mainLines(f) ?? [];
  if (joke.id === 'main-class') {
    const line = f.main?.className ? CLASS_MAINS[f.main.className] : undefined;
    return line ? [line] : [];
  }
  return joke.lines;
}

/* ---------------------------- titles and closers ---------------------------- */

export const TITLES: { min: number; title: Line }[] = [
  { min: 9, title: { en: 'Touch Grass Immediately', es: 'Sal a tocar pasto YA', pt: 'Vai tocar grama AGORA' } },
  { min: 7.5, title: { en: 'Actually Cracked', es: 'Muy roto, la verdad', pt: 'Brabo demais, sendo honesto' } },
  { min: 6, title: { en: 'Sweaty Tryhard', es: 'Tryhard sudoroso', pt: 'Tryhard suado' } },
  { min: 4.5, title: { en: 'Professional Mid', es: 'Mediocre profesional', pt: 'Mediano profissional' } },
  { min: 3, title: { en: 'Bush Camper', es: 'Campero de arbustos', pt: 'Campeiro de moita' } },
  { min: 1.5, title: { en: "Teammates' Nightmare", es: 'La pesadilla de tus compañeros', pt: 'O pesadelo dos parceiros' } },
  { min: 0, title: { en: 'Certified Bot', es: 'Bot certificado', pt: 'Bot certificado' } },
];

export const CLOSERS: { min: number; lines: Line[] }[] = [
  {
    min: 7.5,
    lines: [
      {
        en: 'Fine, {name}, you play well. Now go drink some water.',
        es: 'Está bien, {name}, juegas bien. Ahora ve a tomar agua.',
        pt: 'Tá bom, {name}, você joga bem. Agora vai beber uma água.',
      },
      {
        en: 'Good account. Terrible sleep schedule, probably.',
        es: 'Buena cuenta. Horario de sueño terrible, seguramente.',
        pt: 'Conta boa. Horário de sono péssimo, com certeza.',
      },
    ],
  },
  {
    min: 6,
    lines: [
      {
        en: 'Tryhard detected, {name}. The grind is real. The results are still loading.',
        es: 'Tryhard detectado, {name}. El esfuerzo es real. Los resultados siguen cargando.',
        pt: 'Tryhard detectado, {name}. O esforço é real. Os resultados ainda tão carregando.',
      },
      {
        en: "You take this game very seriously, {name}. The game has noticed. It isn't impressed yet.",
        es: 'Te tomas este juego muy en serio, {name}. El juego lo notó. Todavía no está impresionado.',
        pt: 'Você leva esse jogo muito a sério, {name}. O jogo percebeu. Ainda não ficou impressionado.',
      },
    ],
  },
  {
    min: 4.5,
    lines: [
      {
        en: "Not the worst account we've seen today. Not the best either.",
        es: 'No es la peor cuenta que vimos hoy. Tampoco la mejor.',
        pt: 'Não é a pior conta que vimos hoje. Nem a melhor.',
      },
      {
        en: 'A mid account, {name}. But mid is a place you can climb out of.',
        es: 'Una cuenta promedio, {name}. Pero de lo promedio se puede salir.',
        pt: 'Uma conta mediana, {name}. Mas do mediano dá pra sair.',
      },
    ],
  },
  {
    min: 0,
    lines: [
      {
        en: 'Delete the game? No. But maybe check the tier list once in a while.',
        es: '¿Borrar el juego? No. Pero tal vez mira la tier list de vez en cuando.',
        pt: 'Apagar o jogo? Não. Mas talvez dê uma olhada na tier list de vez em quando.',
      },
      {
        en: "It's okay, {name}. Every pro started as a bot. Most of them stayed bots, though.",
        es: 'Tranqui, {name}. Todo pro empezó como bot. Aunque la mayoría siguió siendo bot.',
        pt: 'Relaxa, {name}. Todo pro começou como bot. Mas a maioria continuou bot.',
      },
    ],
  },
];
