import { titleCase } from '@/lib/format';
import type { Locale } from '@/lib/i18n';
import type { RankedStanding, RoastFacts } from '@/lib/roast';

/**
 * The joke bank behind `lib/roast`.
 *
 * Every line is written here in every site language rather than keyed through
 * `src/i18n`: a joke is rewritten for each language, not translated sentence
 * by sentence, and keeping them side by side is what stops one drifting.
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
  es: ['Bronce', 'Plata', 'Oro', 'Diamante', 'Mítico', 'Legendario', 'Maestros', 'Pro'],
  pt: ['Bronze', 'Prata', 'Ouro', 'Diamante', 'Mítico', 'Lendário', 'Mestres', 'Pro'],
  tr: ['Bronz', 'Gümüş', 'Altın', 'Elmas', 'Gizemli', 'Efsanevi', 'Ustalar', 'Pro'],
  de: ['Bronze', 'Silber', 'Gold', 'Diamant', 'Mythisch', 'Legendär', 'Meister', 'Pro'],
  ru: ['Бронзовый', 'Серебряный', 'Золотой', 'Алмазный', 'Мифический', 'Легендарный', 'Мастер', 'Про'],
  id: ['Perunggu', 'Perak', 'Emas', 'Berlian', 'Mistis', 'Legendaris', 'Master', 'Pro'],
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

const NUMBER_TAG: Record<Locale, string> = { en: 'en-US', es: 'es-419', pt: 'pt-BR', tr: 'tr-TR', de: 'de-DE', ru: 'ru-RU', id: 'id-ID' };

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
      tr: "Main'in Shelly. Eğitimin eline tutuşturduğu savaşçı. Sen de eğitimden hiç çıkmadın.",
      de: 'Dein Main ist Shelly. Die Brawlerin, die dir das Tutorial in die Hand drückt. Du hast das Tutorial nur nie verlassen.',
      ru: 'Твой мейн — Shelly. Боец, которого тебе выдаёт обучение. Ты просто так и не вышел из обучения.',
      id: 'Main kamu Shelly. Jagoan yang dikasih tutorial. Kamu cuma nggak pernah keluar dari tutorial.',
    },
    {
      en: 'Shelly main: sit in a bush, press super, call it strategy.',
      es: 'Main Shelly: esperar en un arbusto, apretar el súper y llamarlo estrategia.',
      pt: 'Main Shelly: ficar na moita, apertar o super e chamar isso de estratégia.',
      tr: "Shelly main'i: çalıya otur, süpere bas, adına strateji de.",
      de: 'Shelly-Main: im Busch sitzen, Super drücken, das Ganze Strategie nennen.',
      ru: 'Мейн Shelly: сидеть в кусте, нажать суперспособность и назвать это стратегией.',
      id: 'Main Shelly: duduk di semak, tekan super, sebut itu strategi.',
    },
  ],
  EDGAR: [
    {
      en: 'You main Edgar. Jump in, die, blame the team. Every single game.',
      es: 'Tu main es Edgar. Saltar, morir, culpar al equipo. Todas las partidas.',
      pt: 'Seu main é o Edgar. Pular, morrer, culpar o time. Toda santa partida.',
      tr: "Main'in Edgar. Atla, öl, takımı suçla. Her maç.",
      de: 'Dein Main ist Edgar. Reinspringen, sterben, dem Team die Schuld geben. Jedes einzelne Spiel.',
      ru: 'Твой мейн — Edgar. Запрыгнуть, умереть, обвинить команду. Каждый. Бой.',
      id: 'Main kamu Edgar. Lompat masuk, mati, salahin tim. Setiap. Game.',
    },
    {
      en: 'Edgar main. Your whole game plan fits in one button.',
      es: 'Main Edgar. Todo tu plan de juego cabe en un botón.',
      pt: 'Main Edgar. Todo o seu plano de jogo cabe em um botão.',
      tr: "Edgar main'i. Bütün oyun planın tek bir tuşa sığıyor.",
      de: 'Edgar-Main. Dein ganzer Spielplan passt auf einen Knopf.',
      ru: 'Мейн Edgar. Весь твой план игры помещается в одну кнопку.',
      id: 'Main Edgar. Seluruh rencana main kamu muat di satu tombol.',
    },
  ],
  MORTIS: [
    {
      en: 'Mortis main. Your teammates play 2v3 while you dash into the enemy spawn.',
      es: 'Main Mortis. Tus compañeros juegan 2 contra 3 mientras tú haces dash al spawn enemigo.',
      pt: 'Main Mortis. Seus parceiros jogam 2 contra 3 enquanto você dá dash no spawn inimigo.',
      tr: "Mortis main'i. Sen rakibin doğma noktasına atılırken takım arkadaşların 2'ye 3 oynuyor.",
      de: 'Mortis-Main. Dein Team spielt 2 gegen 3, während du in den gegnerischen Spawn dashst.',
      ru: 'Мейн Mortis. Твоя команда играет 2 на 3, пока ты рывками летишь на респаун врага.',
      id: 'Main Mortis. Timmu main 2 lawan 3 sementara kamu dash ke spawn musuh.',
    },
    {
      en: 'You main Mortis. Three dashes in, zero kills out.',
      es: 'Tu main es Mortis. Tres dashes para entrar, cero eliminaciones para salir.',
      pt: 'Seu main é o Mortis. Três dashes pra entrar, zero abates pra sair.',
      tr: "Main'in Mortis. Üç atılışla gir, sıfır leşle çık.",
      de: 'Dein Main ist Mortis. Drei Dashes rein, null Kills raus.',
      ru: 'Твой мейн — Mortis. Три рывка внутрь, ноль убийств на выходе.',
      id: 'Main kamu Mortis. Tiga dash masuk, nol kill keluar.',
    },
  ],
  COLT: [
    {
      en: 'Colt main. Six bullets a shot and somehow none of them land.',
      es: 'Main Colt. Seis balas por disparo y de algún modo ninguna acierta.',
      pt: 'Main Colt. Seis balas por tiro e de algum jeito nenhuma acerta.',
      tr: "Colt main'i. Atış başına altı mermi ve nasılsa hiçbiri isabet etmiyor.",
      de: 'Colt-Main. Sechs Kugeln pro Schuss, und irgendwie trifft keine.',
      ru: 'Мейн Colt. Шесть пуль за выстрел, и каким-то образом ни одна не попадает.',
      id: 'Main Colt. Enam peluru sekali tembak, dan entah gimana nggak ada yang kena.',
    },
    {
      en: "You main Colt. The walls you broke this season respect you. The enemies don't.",
      es: 'Tu main es Colt. Las paredes que rompiste esta temporada te respetan. Los enemigos no.',
      pt: 'Seu main é o Colt. As paredes que você quebrou nessa temporada te respeitam. Os inimigos, não.',
      tr: "Main'in Colt. Bu sezon kırdığın duvarlar sana saygı duyuyor. Rakipler duymuyor.",
      de: 'Dein Main ist Colt. Die Wände, die du diese Saison zerlegt hast, respektieren dich. Die Gegner nicht.',
      ru: 'Твой мейн — Colt. Стены, которые ты снёс за сезон, тебя уважают. Враги — нет.',
      id: 'Main kamu Colt. Tembok yang kamu hancurkan musim ini menghormatimu. Musuh nggak.',
    },
  ],
  SPIKE: [
    {
      en: 'Spike main. You throw a cactus and pray. Mostly pray.',
      es: 'Main Spike. Lanzas un cactus y rezas. Más que nada rezas.',
      pt: 'Main Spike. Você joga um cacto e reza. Mais reza do que joga.',
      tr: "Spike main'i. Bir kaktüs fırlatıp dua ediyorsun. Çoğunlukla dua ediyorsun.",
      de: 'Spike-Main. Du wirfst einen Kaktus und betest. Hauptsächlich betest du.',
      ru: 'Мейн Spike. Ты кидаешь кактус и молишься. В основном молишься.',
      id: 'Main Spike. Kamu lempar kaktus terus berdoa. Kebanyakan berdoa.',
    },
  ],
  LEON: [
    {
      en: 'Leon main. Invisible in the match, invisible on the scoreboard.',
      es: 'Main Leon. Invisible en la partida, invisible en el marcador.',
      pt: 'Main Leon. Invisível na partida, invisível no placar.',
      tr: "Leon main'i. Maçta görünmez, skor tablosunda da görünmez.",
      de: 'Leon-Main. Unsichtbar im Match, unsichtbar auf der Anzeigetafel.',
      ru: 'Мейн Leon. Невидимый в бою, невидимый в таблице результатов.',
      id: 'Main Leon. Nggak kelihatan di pertarungan, nggak kelihatan di papan skor.',
    },
    {
      en: "You main Leon. Going invisible to run away isn't the play, by the way.",
      es: 'Tu main es Leon. Volverse invisible para huir no es la jugada, por cierto.',
      pt: 'Seu main é o Leon. Ficar invisível pra fugir não é a jogada, só avisando.',
      tr: "Main'in Leon. Bu arada, kaçmak için görünmez olmak taktik değil.",
      de: 'Dein Main ist Leon. Unsichtbar werden, um wegzulaufen, ist übrigens nicht der Plan.',
      ru: 'Твой мейн — Leon. Кстати, становиться невидимым, чтобы сбежать, — это не тактика.',
      id: 'Main kamu Leon. Ngomong-ngomong, menghilang buat kabur itu bukan strategi.',
    },
  ],
  CROW: [
    {
      en: 'Crow main. You poison everyone and finish no one.',
      es: 'Main Crow. Envenenas a todos y no rematas a nadie.',
      pt: 'Main Crow. Você envenena todo mundo e não finaliza ninguém.',
      tr: "Crow main'i. Herkesi zehirliyorsun, kimseyi bitiremiyorsun.",
      de: 'Crow-Main. Du vergiftest alle und erledigst keinen.',
      ru: 'Мейн Crow. Ты травишь всех и не добиваешь никого.',
      id: 'Main Crow. Kamu racuni semua orang dan nggak menghabisi satu pun.',
    },
  ],
  'EL PRIMO': [
    {
      en: 'El Primo main. Your super is a one-way ticket into the enemy team.',
      es: 'Main El Primo. Tu súper es un boleto de ida al medio del equipo enemigo.',
      pt: 'Main El Primo. Seu super é uma passagem só de ida pro meio do time inimigo.',
      tr: "El Primo main'i. Süperin rakip takımın ortasına tek yön bilet.",
      de: 'El-Primo-Main. Dein Super ist ein One-Way-Ticket ins gegnerische Team.',
      ru: 'Мейн El Primo. Твоя суперспособность — билет в один конец прямо в команду врага.',
      id: 'Main El Primo. Super kamu tiket sekali jalan ke tengah tim musuh.',
    },
    {
      en: 'You main El Primo. Big muscles, small plans.',
      es: 'Tu main es El Primo. Músculos grandes, planes pequeños.',
      pt: 'Seu main é o El Primo. Músculos grandes, planos pequenos.',
      tr: "Main'in El Primo. Büyük kaslar, küçük planlar.",
      de: 'Dein Main ist El Primo. Große Muskeln, kleine Pläne.',
      ru: 'Твой мейн — El Primo. Большие мышцы, маленькие планы.',
      id: 'Main kamu El Primo. Otot besar, rencana kecil.',
    },
  ],
  DYNAMIKE: [
    {
      en: 'Dynamike main. The wall took more damage than the enemies did.',
      es: 'Main Dynamike. La pared recibió más daño que los enemigos.',
      pt: 'Main Dynamike. A parede tomou mais dano que os inimigos.',
      tr: "Dynamike main'i. Duvar rakiplerden daha çok hasar aldı.",
      de: 'Dynamike-Main. Die Wand hat mehr Schaden abbekommen als die Gegner.',
      ru: 'Мейн Dynamike. Стена получила больше урона, чем враги.',
      id: 'Main Dynamike. Temboknya kena damage lebih banyak daripada musuh.',
    },
    {
      en: 'You main Dynamike. Your bombs land where the enemy was three seconds ago.',
      es: 'Tu main es Dynamike. Tus bombas caen donde estaba el enemigo hace tres segundos.',
      pt: 'Seu main é o Dynamike. Suas bombas caem onde o inimigo estava três segundos atrás.',
      tr: "Main'in Dynamike. Bombaların rakibin üç saniye önce olduğu yere düşüyor.",
      de: 'Dein Main ist Dynamike. Deine Bomben landen da, wo der Gegner vor drei Sekunden stand.',
      ru: 'Твой мейн — Dynamike. Твои бомбы падают туда, где враг был три секунды назад.',
      id: 'Main kamu Dynamike. Bom kamu jatuh di tempat musuh berdiri tiga detik yang lalu.',
    },
  ],
  FRANK: [
    {
      en: 'Frank main. Two seconds to swing, half a second to get stunned.',
      es: 'Main Frank. Dos segundos para golpear, medio segundo para que te aturdan.',
      pt: 'Main Frank. Dois segundos pra bater, meio segundo pra ser atordoado.',
      tr: "Frank main'i. Çekiçi sallamak iki saniye, sersemlemek yarım saniye.",
      de: 'Frank-Main. Zwei Sekunden zum Ausholen, eine halbe Sekunde, um betäubt zu werden.',
      ru: 'Мейн Frank. Две секунды на замах, полсекунды, чтобы тебя оглушили.',
      id: 'Main Frank. Dua detik buat ancang-ancang, setengah detik buat kena stun.',
    },
  ],
  BULL: [
    {
      en: 'You main Bull. Your super has taken you into the gas more times than into a kill.',
      es: 'Tu main es Bull. Tu súper te llevó al gas más veces que a una eliminación.',
      pt: 'Seu main é o Bull. Seu super já te levou mais vezes pro gás do que pra um abate.',
      tr: "Main'in Bull. Süperin seni leşten çok gazın içine götürdü.",
      de: 'Dein Main ist Bull. Dein Super hat dich öfter ins Gas getragen als zu einem Kill.',
      ru: 'Твой мейн — Bull. Суперспособность чаще заносила тебя в газ, чем приносила убийство.',
      id: 'Main kamu Bull. Super kamu lebih sering bawa kamu ke gas daripada ke kill.',
    },
  ],
  PIPER: [
    {
      en: 'Piper main. You live in the back corner and call it map control.',
      es: 'Main Piper. Vives en la esquina de atrás y lo llamas control del mapa.',
      pt: 'Main Piper. Você mora no cantinho lá de trás e chama isso de controle do mapa.',
      tr: "Piper main'i. Arka köşede yaşıyorsun ve buna harita kontrolü diyorsun.",
      de: 'Piper-Main. Du wohnst in der hinteren Ecke und nennst das Map-Kontrolle.',
      ru: 'Мейн Piper. Ты живёшь в дальнем углу и называешь это контролем карты.',
      id: 'Main Piper. Kamu tinggal di pojok belakang dan menyebutnya kontrol peta.',
    },
  ],
  BIBI: [
    {
      en: 'Bibi main. You swing that bat like the ball owes you money.',
      es: 'Main Bibi. Bateas como si la pelota te debiera dinero.',
      pt: 'Main Bibi. Você gira esse taco como se a bola te devesse dinheiro.',
      tr: "Bibi main'i. O sopayı top sana borçluymuş gibi sallıyorsun.",
      de: 'Bibi-Main. Du schwingst den Schläger, als schulde dir der Ball Geld.',
      ru: 'Мейн Bibi. Ты машешь битой так, будто мяч тебе денег должен.',
      id: 'Main Bibi. Kamu ayunkan pemukul kayak bolanya punya utang ke kamu.',
    },
  ],
  POCO: [
    {
      en: 'Poco main. You play guitar while the team dies around you.',
      es: 'Main Poco. Tocas la guitarra mientras el equipo muere a tu alrededor.',
      pt: 'Main Poco. Você toca violão enquanto o time morre do seu lado.',
      tr: "Poco main'i. Takım etrafında ölürken sen gitar çalıyorsun.",
      de: 'Poco-Main. Du spielst Gitarre, während das Team um dich herum stirbt.',
      ru: 'Мейн Poco. Ты играешь на гитаре, пока команда вокруг тебя умирает.',
      id: 'Main Poco. Kamu main gitar sementara tim mati di sekelilingmu.',
    },
  ],
  NITA: [
    {
      en: 'Nita main. The bear does the work and you take the credit.',
      es: 'Main Nita. El oso hace el trabajo y tú te llevas el crédito.',
      pt: 'Main Nita. O urso faz o trabalho e você leva o crédito.',
      tr: "Nita main'i. İşi ayı yapıyor, övgüyü sen topluyorsun.",
      de: 'Nita-Main. Der Bär macht die Arbeit, und du kassierst das Lob.',
      ru: 'Мейн Nita. Медведь делает всю работу, а похвалу забираешь ты.',
      id: 'Main Nita. Beruangnya yang kerja, kamu yang dapat pujian.',
    },
  ],
  RICO: [
    {
      en: 'Rico main. Every bullet bounces off a wall. Not one bounces off an enemy.',
      es: 'Main Rico. Todas las balas rebotan en una pared. Ninguna en un enemigo.',
      pt: 'Main Rico. Toda bala quica na parede. Nenhuma no inimigo.',
      tr: "Rico main'i. Her mermi bir duvardan sekiyor. Tek biri bile rakipten sekmiyor.",
      de: 'Rico-Main. Jede Kugel prallt von einer Wand ab. Keine einzige von einem Gegner.',
      ru: 'Мейн Rico. Каждая пуля отскакивает от стены. Ни одна — от врага.',
      id: 'Main Rico. Setiap peluru memantul dari tembok. Nggak satu pun memantul dari musuh.',
    },
  ],
  DARRYL: [
    {
      en: 'Darryl main. Roll in, roll out, hope nobody saw.',
      es: 'Main Darryl. Rodar adentro, rodar afuera y esperar que nadie lo haya visto.',
      pt: 'Main Darryl. Rolar pra dentro, rolar pra fora e torcer pra ninguém ter visto.',
      tr: "Darryl main'i. Yuvarlan gir, yuvarlan çık, kimse görmemiştir umarım.",
      de: 'Darryl-Main. Reinrollen, rausrollen, hoffen, dass es keiner gesehen hat.',
      ru: 'Мейн Darryl. Закатиться, выкатиться и надеяться, что никто не видел.',
      id: 'Main Darryl. Gelinding masuk, gelinding keluar, semoga nggak ada yang lihat.',
    },
  ],
  GALE: [
    {
      en: "Gale main. You've blown more enemies to safety than into a wall.",
      es: 'Main Gale. Mandaste a más enemigos a un lugar seguro que contra una pared.',
      pt: 'Main Gale. Você já soprou mais inimigos pra um lugar seguro do que pra parede.',
      tr: "Gale main'i. Rakipleri duvara savurduğundan çok güvenli yere savurdun.",
      de: 'Gale-Main. Du hast mehr Gegner in Sicherheit gepustet als gegen eine Wand.',
      ru: 'Мейн Gale. Ты сдул больше врагов в безопасность, чем в стену.',
      id: 'Main Gale. Kamu lebih sering meniup musuh ke tempat aman daripada ke tembok.',
    },
  ],
  '8-BIT': [
    {
      en: '8-Bit main. The slowest brawler in the game, and somehow you still arrive late.',
      es: 'Main 8-Bit. El brawler más lento del juego y aun así llegas tarde.',
      pt: 'Main 8-Bit. O brawler mais lento do jogo e mesmo assim você chega atrasado.',
      tr: "8-Bit main'i. Oyunun en yavaş savaşçısı ve nasılsa yine de geç kalıyorsun.",
      de: '8-Bit-Main. Der langsamste Brawler im Spiel, und trotzdem kommst du irgendwie zu spät.',
      ru: 'Мейн 8-Bit. Самый медленный боец в игре, и ты всё равно умудряешься опаздывать.',
      id: 'Main 8-Bit. Jagoan paling lambat di game, dan kamu tetap aja telat.',
    },
  ],
  BROCK: [
    {
      en: 'Brock main. A rocket launcher and a dream.',
      es: 'Main Brock. Un lanzacohetes y un sueño.',
      pt: 'Main Brock. Um lança-foguetes e um sonho.',
      tr: "Brock main'i. Bir roketatar ve bir hayal.",
      de: 'Brock-Main. Ein Raketenwerfer und ein Traum.',
      ru: 'Мейн Brock. Ракетница и мечта.',
      id: 'Main Brock. Peluncur roket dan sebuah mimpi.',
    },
  ],
  FANG: [
    {
      en: 'Fang main. Kick, chain, die. Your teammates know the routine by now.',
      es: 'Main Fang. Patada, cadena, muerte. Tus compañeros ya se saben la rutina.',
      pt: 'Main Fang. Chute, corrente, morte. Seus parceiros já decoraram a rotina.',
      tr: "Fang main'i. Tekme, zincir, ölüm. Takım arkadaşların rutini artık ezbere biliyor.",
      de: 'Fang-Main. Kick, Kette, tot. Dein Team kennt den Ablauf inzwischen.',
      ru: 'Мейн Fang. Пинок, цепочка, смерть. Команда уже знает этот порядок наизусть.',
      id: 'Main Fang. Tendang, rantai, mati. Timmu sudah hafal urutannya.',
    },
  ],
  KENJI: [
    {
      en: 'Kenji main. Samurai sword, zero honor.',
      es: 'Main Kenji. Espada de samurái, cero honor.',
      pt: 'Main Kenji. Espada de samurai, zero honra.',
      tr: "Kenji main'i. Samuray kılıcı, sıfır onur.",
      de: 'Kenji-Main. Samurai-Schwert, null Ehre.',
      ru: 'Мейн Kenji. Меч самурая, ноль чести.',
      id: 'Main Kenji. Pedang samurai, nol kehormatan.',
    },
  ],
  MICO: [
    {
      en: 'Mico main. Monkey see, monkey jump, monkey die.',
      es: 'Main Mico. Mono ve, mono salta, mono muere.',
      pt: 'Main Mico. Macaco vê, macaco pula, macaco morre.',
      tr: "Mico main'i. Maymun görür, maymun zıplar, maymun ölür.",
      de: 'Mico-Main. Affe sieht, Affe springt, Affe stirbt.',
      ru: 'Мейн Mico. Обезьяна видит, обезьяна прыгает, обезьяна умирает.',
      id: 'Main Mico. Monyet lihat, monyet lompat, monyet mati.',
    },
  ],
  GUS: [
    {
      en: 'Gus main. Your teammates get shields. You get excuses.',
      es: 'Main Gus. Tus compañeros reciben escudos. Tú, excusas.',
      pt: 'Main Gus. Seus parceiros ganham escudo. Você ganha desculpas.',
      tr: "Gus main'i. Takım arkadaşların kalkan alıyor. Sen bahane.",
      de: 'Gus-Main. Dein Team bekommt Schilde. Du bekommst Ausreden.',
      ru: 'Мейн Gus. Команда получает щиты. Ты получаешь оправдания.',
      id: 'Main Gus. Timmu dapat perisai. Kamu dapat alasan.',
    },
  ],
  SURGE: [
    {
      en: "Surge main. Three upgrade stages, and you've never seen the third.",
      es: 'Main Surge. Tres etapas de mejora y nunca viste la tercera.',
      pt: 'Main Surge. Três estágios de melhoria e você nunca viu o terceiro.',
      tr: "Surge main'i. Üç yükseltme aşaması ve üçüncüsünü hiç görmedin.",
      de: 'Surge-Main. Drei Upgrade-Stufen, und die dritte hast du nie gesehen.',
      ru: 'Мейн Surge. Три стадии улучшения, а третью ты так ни разу и не видел.',
      id: 'Main Surge. Tiga tahap upgrade, dan kamu nggak pernah lihat yang ketiga.',
    },
  ],
  STU: [
    {
      en: "Stu main. You dash so much that even you don't know where you are.",
      es: 'Main Stu. Haces tantos dashes que ni tú sabes dónde estás.',
      pt: 'Main Stu. Você dá tanto dash que nem você sabe onde está.',
      tr: "Stu main'i. O kadar çok atılıyorsun ki sen bile nerede olduğunu bilmiyorsun.",
      de: 'Stu-Main. Du dashst so viel, dass nicht mal du weißt, wo du bist.',
      ru: 'Мейн Stu. Ты делаешь столько рывков, что сам уже не знаешь, где находишься.',
      id: 'Main Stu. Kamu dash terus sampai kamu sendiri nggak tahu lagi ada di mana.',
    },
  ],
  BUZZ: [
    {
      en: 'Buzz main. A lifeguard who never saves anyone.',
      es: 'Main Buzz. Un salvavidas que nunca salva a nadie.',
      pt: 'Main Buzz. Um salva-vidas que nunca salva ninguém.',
      tr: "Buzz main'i. Kimseyi kurtarmayan bir cankurtaran.",
      de: 'Buzz-Main. Ein Rettungsschwimmer, der nie jemanden rettet.',
      ru: 'Мейн Buzz. Спасатель, который никого не спасает.',
      id: 'Main Buzz. Penjaga pantai yang nggak pernah menyelamatkan siapa pun.',
    },
  ],
  TARA: [
    {
      en: 'Tara main. Your super pulls everyone together. And then what?',
      es: 'Main Tara. Tu súper junta a todos. ¿Y después qué?',
      pt: 'Main Tara. Seu super junta todo mundo. E depois?',
      tr: "Tara main'i. Süperin herkesi bir araya topluyor. Peki sonra?",
      de: 'Tara-Main. Dein Super zieht alle zusammen. Und dann?',
      ru: 'Мейн Tara. Твоя суперспособность стягивает всех в кучу. А дальше что?',
      id: 'Main Tara. Super kamu menarik semua orang jadi satu. Terus apa?',
    },
  ],
  GENE: [
    {
      en: 'Gene main. You pulled the enemy tank into your own team. Again.',
      es: 'Main Gene. Atrajiste al tanque enemigo hacia tu propio equipo. Otra vez.',
      pt: 'Main Gene. Você puxou o tanque inimigo pro seu próprio time. De novo.',
      tr: "Gene main'i. Rakip tankı kendi takımının ortasına çektin. Yine.",
      de: 'Gene-Main. Du hast den gegnerischen Tank in dein eigenes Team gezogen. Schon wieder.',
      ru: 'Мейн Gene. Ты затянул вражеского танка прямо в свою команду. Опять.',
      id: 'Main Gene. Kamu menarik tank musuh ke timmu sendiri. Lagi.',
    },
  ],
  BYRON: [
    {
      en: 'Byron main. You heal from so far back that the team forgets you exist.',
      es: 'Main Byron. Curas desde tan lejos que el equipo olvida que existes.',
      pt: 'Main Byron. Você cura de tão longe que o time esquece que você existe.',
      tr: "Byron main'i. O kadar geriden iyileştiriyorsun ki takım var olduğunu unutuyor.",
      de: 'Byron-Main. Du heilst von so weit hinten, dass das Team vergisst, dass es dich gibt.',
      ru: 'Мейн Byron. Ты лечишь так издалека, что команда забывает о твоём существовании.',
      id: 'Main Byron. Kamu heal dari jauh banget sampai tim lupa kamu ada.',
    },
  ],
  MAX: [
    {
      en: 'Max main. The fastest brawler in the game, and the first one back to spawn.',
      es: 'Main Max. La brawler más rápida del juego y la primera en volver al spawn.',
      pt: 'Main Max. A brawler mais rápida do jogo e a primeira a voltar pro spawn.',
      tr: "Max main'i. Oyunun en hızlı savaşçısı ve doğma noktasına ilk dönen.",
      de: 'Max-Main. Der schnellste Brawler im Spiel, und der Erste zurück im Spawn.',
      ru: 'Мейн Max. Самый быстрый боец в игре — и первый на респауне.',
      id: 'Main Max. Jagoan tercepat di game, dan yang pertama balik ke spawn.',
    },
  ],
  SANDY: [
    {
      en: 'Sandy main. Even your gameplay looks sleepy.',
      es: 'Main Sandy. Hasta tu forma de jugar tiene sueño.',
      pt: 'Main Sandy. Até o seu jeito de jogar tá com sono.',
      tr: "Sandy main'i. Oynayışın bile uykulu görünüyor.",
      de: 'Sandy-Main. Sogar dein Gameplay sieht müde aus.',
      ru: 'Мейн Sandy. Даже твоя игра выглядит сонной.',
      id: 'Main Sandy. Bahkan cara mainmu kelihatan ngantuk.',
    },
  ],
  JESSIE: [
    {
      en: 'Jessie main. The turret is the real MVP.',
      es: 'Main Jessie. La torreta es la verdadera MVP.',
      pt: 'Main Jessie. A torreta é a verdadeira MVP.',
      tr: "Jessie main'i. Asıl MVP taret.",
      de: 'Jessie-Main. Das Geschütz ist der wahre MVP.',
      ru: 'Мейн Jessie. Настоящий MVP — турель.',
      id: 'Main Jessie. MVP yang sebenarnya itu turretnya.',
    },
  ],
  PENNY: [
    {
      en: 'Penny main. Your cannon has more kills than you do.',
      es: 'Main Penny. Tu cañón tiene más eliminaciones que tú.',
      pt: 'Main Penny. Seu canhão tem mais abates que você.',
      tr: "Penny main'i. Topunun senden daha çok leşi var.",
      de: 'Penny-Main. Deine Kanone hat mehr Kills als du.',
      ru: 'Мейн Penny. У твоей пушки больше убийств, чем у тебя.',
      id: 'Main Penny. Meriam kamu punya kill lebih banyak daripada kamu.',
    },
  ],
  BARLEY: [
    {
      en: 'Barley main. You throw bottles from behind a wall and call it teamwork.',
      es: 'Main Barley. Lanzas botellas desde detrás de una pared y lo llamas trabajo en equipo.',
      pt: 'Main Barley. Você joga garrafa atrás da parede e chama isso de trabalho em equipe.',
      tr: "Barley main'i. Duvarın arkasından şişe atıyorsun ve buna takım oyunu diyorsun.",
      de: 'Barley-Main. Du wirfst Flaschen hinter einer Wand hervor und nennst das Teamwork.',
      ru: 'Мейн Barley. Ты кидаешь бутылки из-за стены и называешь это командной игрой.',
      id: 'Main Barley. Kamu lempar botol dari balik tembok dan menyebutnya kerja sama tim.',
    },
  ],
  ROSA: [
    {
      en: 'Rosa main. Bush, punch, shield, repeat. Gardening is a lifestyle.',
      es: 'Main Rosa. Arbusto, golpe, escudo, repetir. La jardinería es un estilo de vida.',
      pt: 'Main Rosa. Moita, soco, escudo, repete. Jardinagem é um estilo de vida.',
      tr: "Rosa main'i. Çalı, yumruk, kalkan, tekrar. Bahçıvanlık bir yaşam tarzı.",
      de: 'Rosa-Main. Busch, Schlag, Schild, Wiederholung. Gärtnern ist ein Lebensstil.',
      ru: 'Мейн Rosa. Куст, удар, щит, повтор. Садоводство — это образ жизни.',
      id: 'Main Rosa. Semak, pukul, perisai, ulangi. Berkebun itu gaya hidup.',
    },
  ],
  EMZ: [
    {
      en: 'Emz main. All that hairspray, and still no followers.',
      es: 'Main Emz. Tanto spray para el pelo y sigues sin seguidores.',
      pt: 'Main Emz. Tanto spray de cabelo e ainda sem seguidores.',
      tr: "Emz main'i. O kadar saç spreyi ve hâlâ takipçi yok.",
      de: 'Emz-Main. So viel Haarspray, und immer noch keine Follower.',
      ru: 'Мейн Emz. Столько лака для волос, а подписчиков всё нет.',
      id: 'Main Emz. Hairspray sebanyak itu, follower tetap nggak ada.',
    },
  ],
  BEA: [
    {
      en: 'Bea main. One supercharged shot per game. If it lands.',
      es: 'Main Bea. Un disparo supercargado por partida. Si acierta.',
      pt: 'Main Bea. Um tiro supercarregado por partida. Se acertar.',
      tr: "Bea main'i. Maç başına bir süper şarjlı atış. İsabet ederse.",
      de: 'Bea-Main. Ein supergeladener Schuss pro Spiel. Wenn er trifft.',
      ru: 'Мейн Bea. Один заряженный выстрел за бой. Если попадёт.',
      id: 'Main Bea. Satu tembakan supercharge per game. Kalau kena.',
    },
  ],
  SQUEAK: [
    {
      en: 'Squeak main. Sticky bombs everywhere, damage nowhere.',
      es: 'Main Squeak. Bombas pegajosas por todas partes, daño en ninguna.',
      pt: 'Main Squeak. Bomba grudenta pra todo lado, dano em lugar nenhum.',
      tr: "Squeak main'i. Her yerde yapışkan bomba, hiçbir yerde hasar.",
      de: 'Squeak-Main. Klebebomben überall, Schaden nirgends.',
      ru: 'Мейн Squeak. Липкие бомбы повсюду, урона нигде.',
      id: 'Main Squeak. Bom lengket di mana-mana, damage nggak ada di mana pun.',
    },
  ],
  GRIFF: [
    {
      en: "Griff main. All those coins and you still can't buy a win.",
      es: 'Main Griff. Tantas monedas y todavía no puedes comprar una victoria.',
      pt: 'Main Griff. Tanta moeda e ainda não dá pra comprar uma vitória.',
      tr: "Griff main'i. O kadar altın ve hâlâ bir galibiyet satın alamıyorsun.",
      de: 'Griff-Main. So viele Münzen, und du kannst dir trotzdem keinen Sieg kaufen.',
      ru: 'Мейн Griff. Столько монет, а победу купить всё равно не получается.',
      id: 'Main Griff. Koin sebanyak itu dan kamu tetap nggak bisa beli kemenangan.',
    },
  ],
  LOLA: [
    {
      en: 'Lola main. Your clone aims better than you do.',
      es: 'Main Lola. Tu clon apunta mejor que tú.',
      pt: 'Main Lola. Seu clone mira melhor que você.',
      tr: "Lola main'i. Klonun senden iyi nişan alıyor.",
      de: 'Lola-Main. Dein Klon zielt besser als du.',
      ru: 'Мейн Lola. Твой клон целится лучше тебя.',
      id: 'Main Lola. Klon kamu membidik lebih baik daripada kamu.',
    },
  ],
  SAM: [
    {
      en: 'Sam main. You throw your knuckle busters away and walk over to get them. Every fight.',
      es: 'Main Sam. Lanzas tus nudilleras y caminas a buscarlas. En cada pelea.',
      pt: 'Main Sam. Você joga as soqueiras longe e anda pra buscar. Em toda luta.',
      tr: "Sam main'i. Muştalarını fırlatıp almaya yürüyorsun. Her kavgada.",
      de: 'Sam-Main. Du wirfst deine Schlagringe weg und läufst hin, um sie zu holen. In jedem Kampf.',
      ru: 'Мейн Sam. Ты бросаешь свои кастеты и идёшь за ними пешком. В каждой драке.',
      id: 'Main Sam. Kamu lempar sarung tinju terus jalan buat mengambilnya. Di setiap pertarungan.',
    },
  ],
  MELODIE: [
    {
      en: 'Melodie main. Three notes spinning around you, and none of them is a plan.',
      es: 'Main Melodie. Tres notas girando a tu alrededor y ninguna es un plan.',
      pt: 'Main Melodie. Três notas girando em volta de você e nenhuma é um plano.',
      tr: "Melodie main'i. Etrafında dönen üç nota var ve hiçbiri bir plan değil.",
      de: 'Melodie-Main. Drei Noten kreisen um dich, und keine davon ist ein Plan.',
      ru: 'Мейн Melodie. Вокруг тебя кружат три ноты, и ни одна из них не план.',
      id: 'Main Melodie. Tiga nada berputar di sekitarmu, dan nggak satu pun yang namanya rencana.',
    },
  ],
  BELLE: [
    {
      en: 'Belle main. You mark the enemy so the team knows who you missed.',
      es: 'Main Belle. Marcas al enemigo para que el equipo sepa a quién fallaste.',
      pt: 'Main Belle. Você marca o inimigo pro time saber em quem você errou.',
      tr: "Belle main'i. Rakibi işaretliyorsun ki takım kimi ıskaladığını bilsin.",
      de: 'Belle-Main. Du markierst den Gegner, damit das Team weiß, wen du verfehlt hast.',
      ru: 'Мейн Belle. Ты помечаешь врага, чтобы команда знала, по кому ты промахнулся.',
      id: 'Main Belle. Kamu menandai musuh supaya tim tahu siapa yang kamu tembak meleset.',
    },
  ],
  AMBER: [
    {
      en: 'Amber main. You set the whole map on fire, except the enemies.',
      es: 'Main Amber. Prendes fuego todo el mapa, menos a los enemigos.',
      pt: 'Main Amber. Você bota fogo no mapa inteiro, menos nos inimigos.',
      tr: "Amber main'i. Rakipler hariç bütün haritayı ateşe veriyorsun.",
      de: 'Amber-Main. Du setzt die ganze Map in Brand, außer die Gegner.',
      ru: 'Мейн Amber. Ты поджигаешь всю карту, кроме врагов.',
      id: 'Main Amber. Kamu bakar seluruh peta, kecuali musuhnya.',
    },
  ],
  MEG: [
    {
      en: 'Meg main. Lose the mech, lose the will to live.',
      es: 'Main Meg. Pierdes el robot y pierdes las ganas de vivir.',
      pt: 'Main Meg. Perdeu o robô, perdeu a vontade de viver.',
      tr: "Meg main'i. Robotu kaybet, yaşama isteğini kaybet.",
      de: 'Meg-Main. Mech weg, Lebenswille weg.',
      ru: 'Мейн Meg. Потерял робота — потерял волю к жизни.',
      id: 'Main Meg. Kehilangan robot, kehilangan semangat hidup.',
    },
  ],
  CHESTER: [
    {
      en: "Chester main. Even you don't know which super is coming next.",
      es: 'Main Chester. Ni tú sabes qué súper viene después.',
      pt: 'Main Chester. Nem você sabe qual super vem depois.',
      tr: "Chester main'i. Sıradaki süperin hangisi olacağını sen bile bilmiyorsun.",
      de: 'Chester-Main. Nicht mal du weißt, welcher Super als Nächstes kommt.',
      ru: 'Мейн Chester. Даже ты не знаешь, какая суперспособность будет следующей.',
      id: 'Main Chester. Bahkan kamu nggak tahu super mana yang keluar berikutnya.',
    },
  ],
  HANK: [
    {
      en: 'Hank main. You charge that bubble for so long the match ends first.',
      es: 'Main Hank. Cargas esa burbuja tanto tiempo que la partida termina antes.',
      pt: 'Main Hank. Você carrega essa bolha por tanto tempo que a partida acaba antes.',
      tr: "Hank main'i. O baloncuğu o kadar uzun dolduruyorsun ki önce maç bitiyor.",
      de: 'Hank-Main. Du lädst die Blase so lange auf, dass das Match vorher endet.',
      ru: 'Мейн Hank. Ты так долго заряжаешь пузырь, что бой заканчивается раньше.',
      id: 'Main Hank. Kamu mengisi gelembung lama banget sampai pertarungan selesai duluan.',
    },
  ],
  JACKY: [
    {
      en: "Jacky main. You pull everyone into a fight you're about to lose.",
      es: 'Main Jacky. Arrastras a todos a una pelea que estás a punto de perder.',
      pt: 'Main Jacky. Você puxa todo mundo pra uma briga que tá prestes a perder.',
      tr: "Jacky main'i. Herkesi kaybetmek üzere olduğun bir kavgaya çekiyorsun.",
      de: 'Jacky-Main. Du ziehst alle in einen Kampf, den du gleich verlierst.',
      ru: 'Мейн Jacky. Ты затягиваешь всех в драку, которую сейчас проиграешь.',
      id: 'Main Jacky. Kamu tarik semua orang ke pertarungan yang sebentar lagi kamu kalah.',
    },
  ],
  CORDELIUS: [
    {
      en: 'Cordelius main. You drag them into the shadow realm and lose there too.',
      es: 'Main Cordelius. Los arrastras al reino de las sombras y también pierdes allí.',
      pt: 'Main Cordelius. Você leva eles pro reino das sombras e perde lá também.',
      tr: "Cordelius main'i. Onları gölge diyarına sürüklüyorsun ve orada da kaybediyorsun.",
      de: 'Cordelius-Main. Du ziehst sie ins Schattenreich und verlierst auch dort.',
      ru: 'Мейн Cordelius. Ты утаскиваешь их в мир теней и проигрываешь и там.',
      id: 'Main Cordelius. Kamu seret mereka ke alam bayangan dan kalah juga di sana.',
    },
  ],
  KIT: [
    {
      en: "Kit main. You ride on your teammates' heads and call that a carry.",
      es: 'Main Kit. Te subes a la cabeza de tus compañeros y lo llamas cargar al equipo.',
      pt: 'Main Kit. Você sobe na cabeça dos parceiros e chama isso de carregar o time.',
      tr: "Kit main'i. Takım arkadaşlarının kafasına binip buna takımı taşımak diyorsun.",
      de: 'Kit-Main. Du reitest auf den Köpfen deiner Teamkollegen und nennst das Carry.',
      ru: 'Мейн Kit. Ты катаешься на головах союзников и называешь это керри.',
      id: 'Main Kit. Kamu naik di kepala rekan tim dan menyebutnya carry.',
    },
  ],
  // From here on written against each brawler's own kit and bio (Brawlify).
  ALLI: [
    {
      en: 'Alli main. You stalk enemies like a horror movie, then miss like a comedy.',
      es: 'Main Alli. Acechas a los enemigos como en una película de terror y fallas como en una comedia.',
      pt: 'Main Alli. Você persegue os inimigos como num filme de terror e erra como numa comédia.',
      tr: "Alli main'i. Rakipleri korku filmi gibi takip ediyorsun, sonra komedi gibi ıskalıyorsun.",
      de: 'Alli-Main. Du schleichst Gegnern nach wie in einem Horrorfilm und verfehlst dann wie in einer Komödie.',
      ru: 'Мейн Alli. Ты подкрадываешься к врагам как в фильме ужасов, а промахиваешься как в комедии.',
      id: 'Main Alli. Kamu mengintai musuh kayak film horor, lalu meleset kayak film komedi.',
    },
  ],
  ANGELO: [
    {
      en: 'Angelo main. A mosquito with a bow. Just as annoying, just as easy to swat.',
      es: 'Main Angelo. Un mosquito con arco. Igual de molesto, igual de fácil de aplastar.',
      pt: 'Main Angelo. Um mosquito com arco. Irritante e tão fácil de esmagar quanto.',
      tr: "Angelo main'i. Yaylı bir sivrisinek. Aynı derecede sinir bozucu, aynı derecede kolay ezilen.",
      de: 'Angelo-Main. Eine Mücke mit Bogen. Genauso nervig, genauso leicht zu erschlagen.',
      ru: 'Мейн Angelo. Комар с луком. Такой же надоедливый, так же легко прихлопнуть.',
      id: 'Main Angelo. Nyamuk bawa busur. Sama-sama nyebelin, sama-sama gampang ditepuk.',
    },
  ],
  ASH: [
    {
      en: 'Ash main. You live in a trash can and play like it.',
      es: 'Main Ash. Vives en un bote de basura y juegas a la altura.',
      pt: 'Main Ash. Você mora numa lata de lixo e joga à altura.',
      tr: "Ash main'i. Bir çöp kutusunda yaşıyorsun ve öyle oynuyorsun.",
      de: 'Ash-Main. Du wohnst in einer Mülltonne und spielst auch so.',
      ru: 'Мейн Ash. Ты живёшь в мусорном баке и играешь соответственно.',
      id: 'Main Ash. Kamu tinggal di tong sampah dan mainnya juga begitu.',
    },
  ],
  BERRY: [
    {
      en: 'Berry main. A unicorn who hates the job. Your teammates can relate.',
      es: 'Main Berry. Un unicornio que odia su trabajo. Tus compañeros te entienden.',
      pt: 'Main Berry. Um unicórnio que odeia o trabalho. Seus parceiros entendem bem.',
      tr: "Berry main'i. İşinden nefret eden bir tek boynuzlu at. Takım arkadaşların seni anlıyor.",
      de: 'Berry-Main. Ein Einhorn, das seinen Job hasst. Dein Team kann das nachfühlen.',
      ru: 'Мейн Berry. Единорог, который ненавидит свою работу. Команда тебя понимает.',
      id: 'Main Berry. Unicorn yang benci pekerjaannya. Timmu bisa merasakannya.',
    },
  ],
  BO: [
    {
      en: 'Bo main. Your weapons came from the gift shop, on sale. It shows.',
      es: 'Main Bo. Tus armas salieron de la tienda de regalos, en oferta. Se nota.',
      pt: 'Main Bo. Suas armas vieram da lojinha, em promoção. Dá pra perceber.',
      tr: "Bo main'i. Silahların hediyelik eşya dükkanından, indirimde alınmış. Belli oluyor.",
      de: 'Bo-Main. Deine Waffen kommen aus dem Souvenirladen, im Angebot. Man merkt es.',
      ru: 'Мейн Bo. Твоё оружие куплено в сувенирной лавке, по скидке. И это заметно.',
      id: 'Main Bo. Senjatamu dari toko suvenir, lagi diskon. Kelihatan kok.',
    },
  ],
  BOLT: [
    {
      en: 'Bolt main. You wanted to be a race car. You ended up a bowling ball.',
      es: 'Main Bolt. Querías ser auto de carreras y terminaste siendo una bola de boliche.',
      pt: 'Main Bolt. Você queria ser carro de corrida e virou bola de boliche.',
      tr: "Bolt main'i. Yarış arabası olmak istedin. Bowling topu oldun.",
      de: 'Bolt-Main. Du wolltest ein Rennwagen sein. Geworden ist es eine Bowlingkugel.',
      ru: 'Мейн Bolt. Ты хотел быть гоночной машиной. Получился шар для боулинга.',
      id: 'Main Bolt. Kamu mau jadi mobil balap. Jadinya bola bowling.',
    },
  ],
  BONNIE: [
    {
      en: 'Bonnie main. Your dream is a cannon ride to the moon. Your team would happily help.',
      es: 'Main Bonnie. Tu sueño es ir a la luna en cañón. Tu equipo te ayudaría encantado.',
      pt: 'Main Bonnie. Seu sonho é ir pra lua de canhão. Seu time ajudaria com prazer.',
      tr: "Bonnie main'i. Hayalin topla Ay'a uçmak. Takımın seve seve yardım eder.",
      de: 'Bonnie-Main. Dein Traum ist ein Kanonenflug zum Mond. Dein Team würde gern helfen.',
      ru: 'Мейн Bonnie. Твоя мечта — полёт на пушке до Луны. Команда с радостью поможет.',
      id: 'Main Bonnie. Mimpimu naik meriam ke bulan. Timmu dengan senang hati bantu.',
    },
  ],
  BUSTER: [
    {
      en: 'Buster main. You brought a movie projector to a fight. Shame the plot is always you losing.',
      es: 'Main Buster. Llevaste un proyector de cine a una pelea. Lástima que la trama siempre sea tú perdiendo.',
      pt: 'Main Buster. Você levou um projetor de cinema pra briga. Pena que o roteiro é sempre você perdendo.',
      tr: "Buster main'i. Kavgaya film projektörü getirdin. Ne yazık ki konu hep senin kaybetmen.",
      de: 'Buster-Main. Du bringst einen Filmprojektor zum Kampf. Schade, dass die Handlung immer deine Niederlage ist.',
      ru: 'Мейн Buster. Ты принёс на драку кинопроектор. Жаль, что сюжет всегда о твоём поражении.',
      id: 'Main Buster. Kamu bawa proyektor film ke pertarungan. Sayang ceritanya selalu tentang kamu kalah.',
    },
  ],
  CARL: [
    {
      en: 'Carl main. Throw the pickaxe, wait for it to come back, die waiting.',
      es: 'Main Carl. Lanzas el pico, esperas a que vuelva y mueres esperando.',
      pt: 'Main Carl. Joga a picareta, espera ela voltar e morre esperando.',
      tr: "Carl main'i. Kazmayı fırlat, geri gelmesini bekle, beklerken öl.",
      de: 'Carl-Main. Spitzhacke werfen, warten, bis sie zurückkommt, beim Warten sterben.',
      ru: 'Мейн Carl. Кинуть кирку, ждать, пока вернётся, умереть в ожидании.',
      id: 'Main Carl. Lempar beliung, tunggu balik, mati sambil menunggu.',
    },
  ],
  CHARLIE: [
    {
      en: 'Charlie main. A whole circus act, and the clown is you.',
      es: 'Main Charlie. Todo un número de circo y el payaso eres tú.',
      pt: 'Main Charlie. Um número de circo inteiro e o palhaço é você.',
      tr: "Charlie main'i. Koca bir sirk gösterisi ve palyaço sensin.",
      de: 'Charlie-Main. Eine ganze Zirkusnummer, und der Clown bist du.',
      ru: 'Мейн Charlie. Целый цирковой номер, и клоун в нём — ты.',
      id: 'Main Charlie. Satu pertunjukan sirkus penuh, dan badutnya kamu.',
    },
  ],
  CHUCK: [
    {
      en: 'Chuck main. You place the posts, plan the route, and the train still goes nowhere.',
      es: 'Main Chuck. Pones los postes, planeas la ruta y el tren igual no va a ningún lado.',
      pt: 'Main Chuck. Você coloca os postes, planeja a rota e o trem não vai pra lugar nenhum.',
      tr: "Chuck main'i. Direkleri dikiyorsun, rotayı planlıyorsun ve tren yine hiçbir yere gitmiyor.",
      de: 'Chuck-Main. Du setzt die Pfosten, planst die Strecke, und der Zug fährt trotzdem nirgendwohin.',
      ru: 'Мейн Chuck. Ты ставишь столбы, прокладываешь маршрут, а поезд всё равно едет в никуда.',
      id: 'Main Chuck. Kamu pasang tiang, rencanakan rute, dan keretanya tetap nggak ke mana-mana.',
    },
  ],
  CLANCY: [
    {
      en: 'Clancy main. A fake crustacean with real ambition. Shame about the aim.',
      es: 'Main Clancy. Un crustáceo falso con ambición de verdad. Lástima la puntería.',
      pt: 'Main Clancy. Um crustáceo falso com ambição de verdade. Pena a mira.',
      tr: "Clancy main'i. Gerçek hırsları olan sahte bir kabuklu. Nişan için üzgünüz.",
      de: 'Clancy-Main. Ein falsches Krustentier mit echtem Ehrgeiz. Schade ums Zielen.',
      ru: 'Мейн Clancy. Ненастоящий рак с настоящими амбициями. Жаль, с прицелом не повезло.',
      id: 'Main Clancy. Krustasea palsu dengan ambisi asli. Sayang bidikannya.',
    },
  ],
  COLETTE: [
    {
      en: "Colette main. You collected every brawler's plushie. Collecting wins was harder, apparently.",
      es: 'Main Colette. Coleccionaste el peluche de cada brawler. Coleccionar victorias, al parecer, cuesta más.',
      pt: 'Main Colette. Você colecionou a pelúcia de todo brawler. Colecionar vitórias pelo jeito é mais difícil.',
      tr: "Colette main'i. Her savaşçının peluşunu topladın. Galibiyet toplamak anlaşılan daha zormuş.",
      de: 'Colette-Main. Du hast das Plüschtier jedes Brawlers gesammelt. Siege zu sammeln war offenbar schwerer.',
      ru: 'Мейн Colette. Ты собрал плюшевую игрушку каждого бойца. Собирать победы, видимо, сложнее.',
      id: 'Main Colette. Kamu mengoleksi boneka setiap jagoan. Mengoleksi kemenangan ternyata lebih susah.',
    },
  ],
  COSMO: [
    {
      en: 'Cosmo main. Always gazing at the stars. Never at the enemy.',
      es: 'Main Cosmo. Siempre mirando las estrellas. Nunca al enemigo.',
      pt: 'Main Cosmo. Sempre olhando as estrelas. Nunca o inimigo.',
      tr: "Cosmo main'i. Gözü hep yıldızlarda. Rakipte asla.",
      de: 'Cosmo-Main. Immer den Blick bei den Sternen. Nie beim Gegner.',
      ru: 'Мейн Cosmo. Всегда смотришь на звёзды. Никогда — на врага.',
      id: 'Main Cosmo. Selalu menatap bintang. Nggak pernah menatap musuh.',
    },
  ],
  DAMIAN: [
    {
      en: 'Damian main. Loud, angry, breaks everything. Your team calls it a concert. The enemy calls it a free win.',
      es: 'Main Damian. Ruidoso, furioso, rompe todo. Tu equipo lo llama concierto. El enemigo, victoria gratis.',
      pt: 'Main Damian. Barulhento, furioso, quebra tudo. Seu time chama de show. O inimigo chama de vitória fácil.',
      tr: "Damian main'i. Gürültülü, sinirli, her şeyi kırıyor. Takımın buna konser diyor. Rakip bedava galibiyet diyor.",
      de: 'Damian-Main. Laut, wütend, macht alles kaputt. Dein Team nennt es Konzert. Der Gegner nennt es Gratis-Sieg.',
      ru: 'Мейн Damian. Громкий, злой, всё ломает. Команда называет это концертом. Враги — бесплатной победой.',
      id: 'Main Damian. Berisik, marah, merusak semuanya. Timmu menyebutnya konser. Musuh menyebutnya kemenangan gratis.',
    },
  ],
  DOUG: [
    {
      en: 'Doug main. You revive your teammates so they can die a second time.',
      es: 'Main Doug. Revives a tus compañeros para que mueran por segunda vez.',
      pt: 'Main Doug. Você revive os parceiros pra eles morrerem de novo.',
      tr: "Doug main'i. Takım arkadaşlarını ikinci kez ölebilsinler diye diriltiyorsun.",
      de: 'Doug-Main. Du belebst deine Teamkollegen wieder, damit sie ein zweites Mal sterben können.',
      ru: 'Мейн Doug. Ты воскрешаешь союзников, чтобы они могли умереть второй раз.',
      id: 'Main Doug. Kamu menghidupkan rekan tim supaya mereka bisa mati untuk kedua kalinya.',
    },
  ],
  DRACO: [
    {
      en: 'Draco main. An inflatable dragon. Fitting: it pops just as fast.',
      es: 'Main Draco. Un dragón inflable. Tiene sentido: se pincha igual de rápido.',
      pt: 'Main Draco. Um dragão inflável. Faz sentido: estoura tão rápido quanto.',
      tr: "Draco main'i. Şişme bir ejderha. Yakışıyor: o da aynı hızla patlıyor.",
      de: 'Draco-Main. Ein aufblasbarer Drache. Passend: Er platzt genauso schnell.',
      ru: 'Мейн Draco. Надувной дракон. Логично: лопается так же быстро.',
      id: 'Main Draco. Naga tiup. Cocok: meletusnya juga sama cepat.',
    },
  ],
  EVE: [
    {
      en: 'Eve main. You fire eggs at people and call it parenting.',
      es: 'Main Eve. Le disparas huevos a la gente y lo llamas maternidad.',
      pt: 'Main Eve. Você atira ovos nas pessoas e chama isso de maternidade.',
      tr: "Eve main'i. İnsanlara yumurta atıyorsun ve buna ebeveynlik diyorsun.",
      de: 'Eve-Main. Du schießt mit Eiern auf Leute und nennst das Erziehung.',
      ru: 'Мейн Eve. Ты стреляешь в людей яйцами и называешь это воспитанием.',
      id: 'Main Eve. Kamu menembaki orang pakai telur dan menyebutnya pengasuhan.',
    },
  ],
  FINX: [
    {
      en: 'Finx main. You can rewind time, and you still make the same mistakes.',
      es: 'Main Finx. Puedes retroceder el tiempo y aun así cometes los mismos errores.',
      pt: 'Main Finx. Você volta no tempo e mesmo assim comete os mesmos erros.',
      tr: "Finx main'i. Zamanı geri sarabiliyorsun ve yine aynı hataları yapıyorsun.",
      de: 'Finx-Main. Du kannst die Zeit zurückspulen und machst trotzdem dieselben Fehler.',
      ru: 'Мейн Finx. Ты умеешь отматывать время и всё равно повторяешь те же ошибки.',
      id: 'Main Finx. Kamu bisa memutar balik waktu dan tetap mengulang kesalahan yang sama.',
    },
  ],
  GIGI: [
    {
      en: 'Gigi main. A cursed puppet. Your teammates feel the curse every game.',
      es: 'Main Gigi. Una marioneta maldita. Tus compañeros sienten la maldición en cada partida.',
      pt: 'Main Gigi. Uma marionete amaldiçoada. Seus parceiros sentem a maldição toda partida.',
      tr: "Gigi main'i. Lanetli bir kukla. Takım arkadaşların laneti her maç hissediyor.",
      de: 'Gigi-Main. Eine verfluchte Puppe. Dein Team spürt den Fluch in jedem Spiel.',
      ru: 'Мейн Gigi. Проклятая кукла. Команда чувствует проклятие каждый бой.',
      id: 'Main Gigi. Boneka terkutuk. Timmu merasakan kutukannya setiap game.',
    },
  ],
  GLOWY: [
    {
      en: "Glowy main. You tether yourself to people. That's a lot of attachment for one game.",
      es: 'Main Glowy. Te conectas a la gente con un rayo. Demasiado apego para una sola partida.',
      pt: 'Main Glowy. Você se prende nas pessoas com um raio. É muito apego pra uma partida só.',
      tr: "Glowy main'i. Kendini insanlara bağlıyorsun. Tek bir maç için fazla bağlılık.",
      de: 'Glowy-Main. Du bindest dich an Leute. Ganz schön viel Bindung für ein Spiel.',
      ru: 'Мейн Glowy. Ты привязываешься к людям. Многовато привязанности для одной игры.',
      id: 'Main Glowy. Kamu mengikat diri ke orang lain. Lumayan lengket untuk satu game.',
    },
  ],
  GRAY: [
    {
      en: 'Gray main. A mime with finger guns. Silent, like your damage.',
      es: 'Main Gray. Un mimo con pistolas de dedo. Silencioso, como tu daño.',
      pt: 'Main Gray. Um mímico com arminha de dedo. Silencioso, igual ao seu dano.',
      tr: "Gray main'i. Parmak tabancalı bir pandomimci. Hasarın gibi sessiz.",
      de: 'Gray-Main. Ein Pantomime mit Fingerpistolen. Stumm, wie dein Schaden.',
      ru: 'Мейн Gray. Мим с пальцами-пистолетами. Молчаливый, как твой урон.',
      id: 'Main Gray. Pantomim dengan pistol jari. Diam, kayak damage-mu.',
    },
  ],
  GROM: [
    {
      en: 'Grom main. Kindergarten kids traumatised Grom. Your teammates know the feeling.',
      es: 'Main Grom. Los niños del jardín de infantes traumatizaron a Grom. Tus compañeros saben lo que se siente.',
      pt: 'Main Grom. As crianças do jardim de infância traumatizaram o Grom. Seus parceiros sabem como é.',
      tr: "Grom main'i. Anaokulu çocukları Grom'u travmatize etti. Takım arkadaşların o hissi biliyor.",
      de: 'Grom-Main. Kindergartenkinder haben Grom traumatisiert. Dein Team kennt das Gefühl.',
      ru: 'Мейн Grom. Детсадовцы довели Grom до травмы. Твоей команде знакомо это чувство.',
      id: 'Main Grom. Anak-anak TK bikin Grom trauma. Timmu tahu rasanya.',
    },
  ],
  'JAE-YONG': [
    {
      en: "Jae-Yong main. He thinks he's a karaoke god. You think you play well. You're both wrong.",
      es: 'Main Jae-Yong. Él cree que es un dios del karaoke. Tú crees que juegas bien. Los dos se equivocan.',
      pt: 'Main Jae-Yong. Ele acha que é um deus do karaokê. Você acha que joga bem. Os dois estão errados.',
      tr: "Jae-Yong main'i. O karaoke tanrısı olduğunu sanıyor. Sen iyi oynadığını sanıyorsun. İkiniz de yanılıyorsunuz.",
      de: 'Jae-Yong-Main. Er hält sich für einen Karaoke-Gott. Du hältst dich für gut. Ihr liegt beide falsch.',
      ru: 'Мейн Jae-Yong. Он считает себя богом караоке. Ты считаешь, что хорошо играешь. Вы оба ошибаетесь.',
      id: 'Main Jae-Yong. Dia pikir dia dewa karaoke. Kamu pikir mainmu bagus. Kalian berdua salah.',
    },
  ],
  JANET: [
    {
      en: "Janet main. You fly over the whole map and still miss what's happening.",
      es: 'Main Janet. Vuelas sobre todo el mapa y aun así no te enteras de lo que pasa.',
      pt: 'Main Janet. Você voa por cima do mapa inteiro e mesmo assim não vê o que tá acontecendo.',
      tr: "Janet main'i. Bütün haritanın üzerinde uçuyorsun ve yine de olan biteni kaçırıyorsun.",
      de: 'Janet-Main. Du fliegst über die ganze Map und verpasst trotzdem, was passiert.',
      ru: 'Мейн Janet. Ты летаешь над всей картой и всё равно не замечаешь, что происходит.',
      id: 'Main Janet. Kamu terbang di atas seluruh peta dan tetap nggak tahu apa yang terjadi.',
    },
  ],
  JUJU: [
    {
      en: 'Juju main. Even your voodoo doll has a better win rate. His name is Gregory, by the way.',
      es: 'Main Juju. Hasta tu muñeco vudú tiene mejor porcentaje de victorias. Se llama Gregory, por cierto.',
      pt: 'Main Juju. Até seu boneco de vodu tem mais vitórias que você. O nome dele é Gregory, aliás.',
      tr: "Juju main'i. Vudu bebeğinin bile kazanma oranı daha iyi. Bu arada adı Gregory.",
      de: 'Juju-Main. Sogar deine Voodoo-Puppe hat eine bessere Siegquote. Sie heißt übrigens Gregory.',
      ru: 'Мейн Juju. Даже у твоей куклы вуду процент побед выше. Её, кстати, зовут Gregory.',
      id: 'Main Juju. Bahkan boneka voodoo-mu punya persentase menang lebih tinggi. Namanya Gregory, by the way.',
    },
  ],
  KAZE: [
    {
      en: 'Kaze main. Two aspects, geisha and ninja. Neither of them wins.',
      es: 'Main Kaze. Dos aspectos, geisha y ninja. Ninguno de los dos gana.',
      pt: 'Main Kaze. Dois aspectos, gueixa e ninja. Nenhum dos dois ganha.',
      tr: "Kaze main'i. İki yüzü var, geyşa ve ninja. Hiçbiri kazanmıyor.",
      de: 'Kaze-Main. Zwei Seiten, Geisha und Ninja. Keine davon gewinnt.',
      ru: 'Мейн Kaze. Две стороны, гейша и ниндзя. Ни одна не побеждает.',
      id: 'Main Kaze. Dua sisi, geisha dan ninja. Nggak ada yang menang.',
    },
  ],
  'LARRY & LAWRIE': [
    {
      en: 'Larry & Lawrie main. Two brawlers for the price of one, and still outnumbered.',
      es: 'Main Larry y Lawrie. Dos brawlers por el precio de uno y aun así en desventaja.',
      pt: 'Main Larry e Lawrie. Dois brawlers pelo preço de um e mesmo assim em desvantagem.',
      tr: "Larry & Lawrie main'i. Bir fiyatına iki savaşçı ve yine de sayıca azsın.",
      de: 'Larry-&-Lawrie-Main. Zwei Brawler zum Preis von einem, und trotzdem in der Unterzahl.',
      ru: 'Мейн Larry & Lawrie. Два бойца по цене одного, и всё равно в меньшинстве.',
      id: 'Main Larry & Lawrie. Dua jagoan dengan harga satu, dan tetap kalah jumlah.',
    },
  ],
  LILY: [
    {
      en: 'Lily main. You dive into the Shadow Realm. Your win rate stays there.',
      es: 'Main Lily. Te metes al Reino de las Sombras. Tu porcentaje de victorias se queda ahí.',
      pt: 'Main Lily. Você entra no Reino das Sombras. Sua taxa de vitória fica por lá.',
      tr: "Lily main'i. Gölge Diyarı'na dalıyorsun. Kazanma oranın orada kalıyor.",
      de: 'Lily-Main. Du tauchst ins Schattenreich ab. Deine Siegquote bleibt dort.',
      ru: 'Мейн Lily. Ты ныряешь в мир теней. Твой процент побед там и остаётся.',
      id: 'Main Lily. Kamu menyelam ke alam bayangan. Persentase menangmu tetap tinggal di sana.',
    },
  ],
  LOU: [
    {
      en: 'Lou main. A snow cone robot that never made a sale. Your record looks familiar.',
      es: 'Main Lou. Un robot de raspados que nunca vendió nada. Tu historial se parece.',
      pt: 'Main Lou. Um robô de raspadinha que nunca vendeu nada. Seu histórico é parecido.',
      tr: "Lou main'i. Hiç satış yapamamış bir buzlu karlı robot. Kaydın tanıdık geliyor.",
      de: 'Lou-Main. Ein Schneekegel-Roboter, der nie etwas verkauft hat. Deine Bilanz kommt mir bekannt vor.',
      ru: 'Мейн Lou. Робот с мороженым, который так ничего и не продал. Твоя статистика выглядит знакомо.',
      id: 'Main Lou. Robot es serut yang nggak pernah laku. Statistikmu kelihatan familiar.',
    },
  ],
  LUMI: [
    {
      en: 'Lumi main. A metal drummer. Loud, fast, and completely off beat.',
      es: 'Main Lumi. Baterista de metal. Ruidosa, rápida y completamente fuera de ritmo.',
      pt: 'Main Lumi. Baterista de metal. Barulhenta, rápida e totalmente fora do ritmo.',
      tr: "Lumi main'i. Bir metal davulcu. Gürültülü, hızlı ve tamamen ritimsiz.",
      de: 'Lumi-Main. Eine Metal-Drummerin. Laut, schnell und komplett aus dem Takt.',
      ru: 'Мейн Lumi. Метал-барабанщица. Громко, быстро и совсем не в такт.',
      id: 'Main Lumi. Drummer metal. Keras, cepat, dan sama sekali nggak sesuai ketukan.',
    },
  ],
  MAISIE: [
    {
      en: "Maisie main. A safety coordinator who walks straight into danger. That's every fight you take.",
      es: 'Main Maisie. Una coordinadora de seguridad que se mete de cabeza en el peligro. Así son todas tus peleas.',
      pt: 'Main Maisie. Uma coordenadora de segurança que vai direto pro perigo. Igual a toda briga sua.',
      tr: "Maisie main'i. Doğrudan tehlikeye yürüyen bir güvenlik sorumlusu. Girdiğin her kavga bu.",
      de: 'Maisie-Main. Eine Sicherheitsbeauftragte, die direkt in die Gefahr läuft. Das ist jeder Kampf, den du annimmst.',
      ru: 'Мейн Maisie. Инспектор по безопасности, который сам идёт прямо в опасность. Как и в каждой твоей драке.',
      id: 'Main Maisie. Petugas keselamatan yang malah jalan langsung ke bahaya. Itu setiap pertarungan yang kamu ambil.',
    },
  ],
  MANDY: [
    {
      en: 'Mandy main. Queen of the candy kingdom, peasant of the scoreboard.',
      es: 'Main Mandy. Reina del reino de los dulces, plebeya del marcador.',
      pt: 'Main Mandy. Rainha do reino dos doces, plebeia do placar.',
      tr: "Mandy main'i. Şeker krallığının kraliçesi, skor tablosunun köylüsü.",
      de: 'Mandy-Main. Königin des Süßigkeitenreichs, Bäuerin auf der Anzeigetafel.',
      ru: 'Мейн Mandy. Королева конфетного королевства, крестьянка в таблице результатов.',
      id: 'Main Mandy. Ratu kerajaan permen, rakyat jelata di papan skor.',
    },
  ],
  MEEPLE: [
    {
      en: 'Meeple main. Every board game rule memorised. Game sense still loading.',
      es: 'Main Meeple. Te sabes las reglas de todos los juegos de mesa. El sentido del juego sigue cargando.',
      pt: 'Main Meeple. Sabe a regra de todo jogo de tabuleiro. A noção de jogo ainda tá carregando.',
      tr: "Meeple main'i. Her kutu oyunu kuralı ezber. Oyun zekâsı hâlâ yükleniyor.",
      de: 'Meeple-Main. Jede Brettspielregel auswendig gelernt. Spielverständnis lädt noch.',
      ru: 'Мейн Meeple. Все правила настолок наизусть. Понимание игры всё ещё загружается.',
      id: 'Main Meeple. Hafal semua aturan board game. Insting main masih loading.',
    },
  ],
  MINA: [
    {
      en: 'Mina main. All that breakdancing, and the only thing you break is your win streak.',
      es: 'Main Mina. Tanto breakdance y lo único que rompes es tu racha.',
      pt: 'Main Mina. Tanto breakdance e a única coisa que você quebra é sua sequência de vitórias.',
      tr: "Mina main'i. O kadar breakdans ve kırdığın tek şey kazanma serin.",
      de: 'Mina-Main. So viel Breakdance, und das Einzige, was du brichst, ist deine Siegesserie.',
      ru: 'Мейн Mina. Столько брейк-данса, а ломаешь ты только свою серию побед.',
      id: 'Main Mina. Breakdance sebanyak itu, dan yang kamu patahkan cuma rentetan kemenanganmu.',
    },
  ],
  MOE: [
    {
      en: 'Moe main. A blind rat. That explains the aim.',
      es: 'Main Moe. Una rata ciega. Eso explica la puntería.',
      pt: 'Main Moe. Um rato cego. Isso explica a mira.',
      tr: "Moe main'i. Kör bir fare. Nişanı açıklıyor.",
      de: 'Moe-Main. Eine blinde Ratte. Das erklärt das Zielen.',
      ru: 'Мейн Moe. Слепая крыса. Это объясняет прицел.',
      id: 'Main Moe. Tikus buta. Itu menjelaskan bidikannya.',
    },
  ],
  'MR. P': [
    {
      en: 'Mr. P main. Your porters do all the work while you yell. Like a real manager.',
      es: 'Main Mr. P. Tus botones hacen todo el trabajo mientras gritas. Como un jefe de verdad.',
      pt: 'Main Mr. P. Seus carregadores fazem todo o trabalho enquanto você grita. Igual a um chefe de verdade.',
      tr: "Mr. P main'i. Sen bağırırken bütün işi hamalların yapıyor. Gerçek bir müdür gibi.",
      de: 'Mr.-P-Main. Deine Träger machen die ganze Arbeit, während du rumschreist. Wie ein echter Manager.',
      ru: 'Мейн Mr. P. Носильщики делают всю работу, пока ты кричишь. Как настоящий менеджер.',
      id: 'Main Mr. P. Para porter yang kerja semua sementara kamu teriak-teriak. Kayak manajer beneran.',
    },
  ],
  NAJIA: [
    {
      en: "Najia main. You hide in a vase. Honestly, the best idea you've had all game.",
      es: 'Main Najia. Te escondes en un jarrón. Sinceramente, la mejor idea que tuviste en toda la partida.',
      pt: 'Main Najia. Você se esconde num vaso. Sinceramente, a melhor ideia que você teve na partida.',
      tr: "Najia main'i. Bir vazoda saklanıyorsun. Açıkçası maç boyunca aklına gelen en iyi fikir.",
      de: 'Najia-Main. Du versteckst dich in einer Vase. Ehrlich gesagt die beste Idee, die du das ganze Spiel hattest.',
      ru: 'Мейн Najia. Ты прячешься в вазе. Честно, лучшая идея за весь бой.',
      id: 'Main Najia. Kamu sembunyi di dalam vas. Jujur, ide terbaikmu sepanjang game.',
    },
  ],
  NANI: [
    {
      en: "Nani main. Peep flies all over the map and still can't find a kill.",
      es: 'Main Nani. Peep vuela por todo el mapa y no encuentra ni una eliminación.',
      pt: 'Main Nani. O Peep voa pelo mapa inteiro e não acha um abate.',
      tr: "Nani main'i. Peep bütün haritayı uçuyor ve yine de bir leş bulamıyor.",
      de: 'Nani-Main. Peep fliegt über die ganze Map und findet trotzdem keinen Kill.',
      ru: 'Мейн Nani. Peep летает по всей карте и всё равно не находит убийства.',
      id: 'Main Nani. Peep terbang ke seluruh peta dan tetap nggak dapat kill.',
    },
  ],
  NORI: [
    {
      en: "Nori main. Kenji and Kaze's kid, destined for greatness. Destiny skipped your games.",
      es: 'Main Nori. El hijo de Kenji y Kaze, destinado a la grandeza. El destino se saltó tus partidas.',
      pt: 'Main Nori. Filho do Kenji e da Kaze, destinado à grandeza. O destino pulou as suas partidas.',
      tr: "Nori main'i. Kenji ile Kaze'nin çocuğu, büyüklüğe yazgılı. Kader senin maçlarını atlamış.",
      de: 'Nori-Main. Das Kind von Kenji und Kaze, zu Großem bestimmt. Das Schicksal hat deine Spiele übersprungen.',
      ru: 'Мейн Nori. Ребёнок Kenji и Kaze, рождённый для величия. Судьба пропустила твои бои.',
      id: 'Main Nori. Anak Kenji dan Kaze, ditakdirkan jadi hebat. Takdir melewatkan game-game kamu.',
    },
  ],
  OLLIE: [
    {
      en: 'Ollie main. You make the enemies dance. Then you lose the dance-off.',
      es: 'Main Ollie. Haces bailar a los enemigos. Y después pierdes la batalla de baile.',
      pt: 'Main Ollie. Você faz os inimigos dançarem. E depois perde a batalha de dança.',
      tr: "Ollie main'i. Rakipleri dans ettiriyorsun. Sonra dans yarışmasını kaybediyorsun.",
      de: 'Ollie-Main. Du bringst die Gegner zum Tanzen. Dann verlierst du das Tanzduell.',
      ru: 'Мейн Ollie. Ты заставляешь врагов танцевать. А потом проигрываешь баттл.',
      id: 'Main Ollie. Kamu bikin musuh menari. Terus kamu kalah adu dance.',
    },
  ],
  OTIS: [
    {
      en: "Otis main. A street artist. Shame your gameplay isn't a masterpiece.",
      es: 'Main Otis. Un artista callejero. Lástima que tu forma de jugar no sea una obra maestra.',
      pt: 'Main Otis. Um artista de rua. Pena que seu jogo não é uma obra-prima.',
      tr: "Otis main'i. Bir sokak sanatçısı. Ne yazık ki oynayışın bir başyapıt değil.",
      de: 'Otis-Main. Ein Straßenkünstler. Schade, dass dein Gameplay kein Meisterwerk ist.',
      ru: 'Мейн Otis. Уличный художник. Жаль, что твоя игра — не шедевр.',
      id: 'Main Otis. Seniman jalanan. Sayang cara mainmu bukan mahakarya.',
    },
  ],
  PAM: [
    {
      en: 'Pam main. You drop the healing turret and your team still finds a way to die next to it.',
      es: 'Main Pam. Pones la torreta de curación y tu equipo igual encuentra la forma de morir al lado.',
      pt: 'Main Pam. Você coloca a torreta de cura e o time ainda dá um jeito de morrer do lado dela.',
      tr: "Pam main'i. İyileştirme taretini koyuyorsun ve takımın yine de yanında ölmenin bir yolunu buluyor.",
      de: 'Pam-Main. Du stellst das Heilgeschütz hin, und dein Team schafft es trotzdem, daneben zu sterben.',
      ru: 'Мейн Pam. Ты ставишь лечащую турель, а команда всё равно умудряется умереть рядом с ней.',
      id: 'Main Pam. Kamu pasang turret penyembuh, dan timmu tetap berhasil mati di sebelahnya.',
    },
  ],
  PEARL: [
    {
      en: 'Pearl main. Burnt cookies and a burnt win rate.',
      es: 'Main Pearl. Galletas quemadas y un porcentaje de victorias quemado.',
      pt: 'Main Pearl. Biscoitos queimados e uma taxa de vitória queimada.',
      tr: "Pearl main'i. Yanık kurabiyeler ve yanık bir kazanma oranı.",
      de: 'Pearl-Main. Verbrannte Kekse und eine verbrannte Siegquote.',
      ru: 'Мейн Pearl. Подгоревшее печенье и подгоревший процент побед.',
      id: 'Main Pearl. Kue gosong dan persentase menang gosong.',
    },
  ],
  PIERCE: [
    {
      en: 'Pierce main. A lifeguard who shoots people instead of saving them. Your teammates noticed.',
      es: 'Main Pierce. Un salvavidas que dispara en vez de salvar. Tus compañeros lo notaron.',
      pt: 'Main Pierce. Um salva-vidas que atira em vez de salvar. Seus parceiros perceberam.',
      tr: "Pierce main'i. İnsanları kurtarmak yerine vuran bir cankurtaran. Takım arkadaşların fark etti.",
      de: 'Pierce-Main. Ein Rettungsschwimmer, der auf Leute schießt, statt sie zu retten. Dein Team hat es gemerkt.',
      ru: 'Мейн Pierce. Спасатель, который стреляет в людей вместо того, чтобы их спасать. Команда заметила.',
      id: 'Main Pierce. Penjaga pantai yang menembaki orang alih-alih menyelamatkan mereka. Timmu sadar.',
    },
  ],
  'R-T': [
    {
      en: "R-T main. An information kiosk with no idea what's going on.",
      es: 'Main R-T. Un kiosco de información que no tiene idea de lo que pasa.',
      pt: 'Main R-T. Um quiosque de informação que não faz ideia do que tá acontecendo.',
      tr: "R-T main'i. Neler olduğu hakkında hiçbir fikri olmayan bir bilgi kulübesi.",
      de: 'R-T-Main. Ein Infokiosk, der keine Ahnung hat, was los ist.',
      ru: 'Мейн R-T. Справочный киоск, который понятия не имеет, что происходит.',
      id: 'Main R-T. Kios informasi yang nggak tahu apa yang sedang terjadi.',
    },
  ],
  RUFFS: [
    {
      en: 'Ruffs main. A space colonel. Your teammates get the power-ups, you get the belly rubs.',
      es: 'Main Ruffs. Un coronel espacial. Tus compañeros reciben las mejoras, tú las caricias en la panza.',
      pt: 'Main Ruffs. Um coronel espacial. Seus parceiros ganham os power-ups, você ganha carinho na barriga.',
      tr: "Ruffs main'i. Bir uzay albayı. Güçlendirmeleri takım arkadaşların alıyor, göbek okşamayı sen.",
      de: 'Ruffs-Main. Ein Weltraum-Oberst. Dein Team bekommt die Power-ups, du bekommst Bauchkraulen.',
      ru: 'Мейн Ruffs. Космический полковник. Команде достаются усиления, тебе — почесать пузико.',
      id: 'Main Ruffs. Kolonel luar angkasa. Timmu dapat power-up, kamu dapat elusan perut.',
    },
  ],
  SHADE: [
    {
      en: 'Shade main. A pile of clothes with sunglasses. Your bedroom floor has the same energy.',
      es: 'Main Shade. Una pila de ropa con lentes de sol. El piso de tu cuarto tiene la misma energía.',
      pt: 'Main Shade. Uma pilha de roupa com óculos escuros. O chão do seu quarto tem a mesma energia.',
      tr: "Shade main'i. Güneş gözlüklü bir yığın kıyafet. Yatak odanın zemini de aynı enerjide.",
      de: 'Shade-Main. Ein Kleiderhaufen mit Sonnenbrille. Dein Zimmerboden hat dieselbe Energie.',
      ru: 'Мейн Shade. Куча одежды в солнечных очках. У пола твоей комнаты та же энергия.',
      id: 'Main Shade. Tumpukan baju pakai kacamata hitam. Lantai kamarmu punya energi yang sama.',
    },
  ],
  SIRIUS: [
    {
      en: "Sirius main. Banned from Starr Park and back for revenge. The revenge isn't going well.",
      es: 'Main Sirius. Expulsado de Starr Park y de vuelta para vengarse. La venganza no va bien.',
      pt: 'Main Sirius. Expulso do Starr Park e de volta pra se vingar. A vingança não tá indo bem.',
      tr: "Sirius main'i. Starr Park'tan kovuldu ve intikam için geri döndü. İntikam iyi gitmiyor.",
      de: 'Sirius-Main. Aus dem Starr Park verbannt und zurück für Rache. Die Rache läuft nicht so gut.',
      ru: 'Мейн Sirius. Изгнан из Старр-парка и вернулся мстить. Месть идёт так себе.',
      id: 'Main Sirius. Diusir dari Starr Park dan kembali untuk balas dendam. Balas dendamnya nggak lancar.',
    },
  ],
  SPROUT: [
    {
      en: 'Sprout main. You build a wall to protect your team. From you, probably.',
      es: 'Main Sprout. Construyes una pared para proteger a tu equipo. De ti, probablemente.',
      pt: 'Main Sprout. Você constrói uma parede pra proteger o time. De você, provavelmente.',
      tr: "Sprout main'i. Takımını korumak için duvar örüyorsun. Muhtemelen senden.",
      de: 'Sprout-Main. Du baust eine Mauer, um dein Team zu schützen. Vor dir, wahrscheinlich.',
      ru: 'Мейн Sprout. Ты строишь стену, чтобы защитить команду. Наверное, от себя.',
      id: 'Main Sprout. Kamu bangun tembok untuk melindungi tim. Dari kamu, mungkin.',
    },
  ],
  'STARR NOVA': [
    {
      en: "Starr Nova main. A cosplayer who thinks she's an anime hero. You think you're a pro. Same energy.",
      es: 'Main Starr Nova. Una cosplayer que se cree heroína de anime. Tú te crees pro. La misma energía.',
      pt: 'Main Starr Nova. Uma cosplayer que se acha heroína de anime. Você se acha pro. Mesma energia.',
      tr: "Starr Nova main'i. Kendini anime kahramanı sanan bir cosplayer. Sen de kendini pro sanıyorsun. Aynı enerji.",
      de: 'Starr-Nova-Main. Eine Cosplayerin, die sich für eine Anime-Heldin hält. Du hältst dich für einen Profi. Dieselbe Energie.',
      ru: 'Мейн Starr Nova. Косплеерша, которая считает себя героиней аниме. Ты считаешь себя профи. Та же энергия.',
      id: 'Main Starr Nova. Cosplayer yang mengira dirinya pahlawan anime. Kamu mengira dirimu pro. Energinya sama.',
    },
  ],
  TICK: [
    {
      en: "Tick main. Your head is literally a bomb. Your plans aren't much better.",
      es: 'Main Tick. Tu cabeza es literalmente una bomba. Tus planes no son mucho mejores.',
      pt: 'Main Tick. Sua cabeça é literalmente uma bomba. Seus planos não são muito melhores.',
      tr: "Tick main'i. Kafan kelimenin tam anlamıyla bomba. Planların da pek farklı değil.",
      de: 'Tick-Main. Dein Kopf ist buchstäblich eine Bombe. Deine Pläne sind nicht viel besser.',
      ru: 'Мейн Tick. Твоя голова — буквально бомба. Твои планы ненамного лучше.',
      id: 'Main Tick. Kepalamu benar-benar bom. Rencanamu nggak jauh lebih baik.',
    },
  ],
  TRUNK: [
    {
      en: 'Trunk main. A colony of ants pretending to be a tree. Still smarter than your draft.',
      es: 'Main Trunk. Una colonia de hormigas que finge ser un árbol. Aun así, más inteligente que tu selección.',
      pt: 'Main Trunk. Uma colônia de formigas fingindo ser árvore. Mesmo assim, mais esperta que o seu draft.',
      tr: "Trunk main'i. Ağaç kılığına girmiş bir karınca kolonisi. Yine de draftından daha akıllı.",
      de: 'Trunk-Main. Eine Ameisenkolonie, die so tut, als wäre sie ein Baum. Immer noch klüger als dein Draft.',
      ru: 'Мейн Trunk. Колония муравьёв, которая притворяется деревом. И всё равно умнее твоего драфта.',
      id: 'Main Trunk. Koloni semut yang pura-pura jadi pohon. Tetap lebih pintar dari draft-mu.',
    },
  ],
  WENDY: [
    {
      en: 'Wendy main. You came to save the planet. Start with your win rate.',
      es: 'Main Wendy. Viniste a salvar el planeta. Empieza por tu porcentaje de victorias.',
      pt: 'Main Wendy. Você veio salvar o planeta. Começa pela sua taxa de vitória.',
      tr: "Wendy main'i. Gezegeni kurtarmaya geldin. Kazanma oranınla başla.",
      de: 'Wendy-Main. Du bist gekommen, um den Planeten zu retten. Fang mit deiner Siegquote an.',
      ru: 'Мейн Wendy. Ты пришёл спасти планету. Начни со своего процента побед.',
      id: 'Main Wendy. Kamu datang untuk menyelamatkan planet. Mulai dari persentase menangmu dulu.',
    },
  ],
  WILLOW: [
    {
      en: 'Willow main. You mind-control the enemy and still lose the fight.',
      es: 'Main Willow. Controlas la mente del enemigo y aun así pierdes la pelea.',
      pt: 'Main Willow. Você controla a mente do inimigo e mesmo assim perde a briga.',
      tr: "Willow main'i. Rakibin zihnini kontrol ediyorsun ve yine de kavgayı kaybediyorsun.",
      de: 'Willow-Main. Du kontrollierst den Gegner mit deinem Geist und verlierst den Kampf trotzdem.',
      ru: 'Мейн Willow. Ты управляешь разумом врага и всё равно проигрываешь драку.',
      id: 'Main Willow. Kamu mengendalikan pikiran musuh dan tetap kalah bertarung.',
    },
  ],
  ZIGGY: [
    {
      en: 'Ziggy main. Not tricks, illusions. Like your rank.',
      es: 'Main Ziggy. No son trucos, son ilusiones. Como tu rango.',
      pt: 'Main Ziggy. Não são truques, são ilusões. Igual ao seu rank.',
      tr: "Ziggy main'i. Numara değil, illüzyon. Rütben gibi.",
      de: 'Ziggy-Main. Keine Tricks, Illusionen. Wie dein Rang.',
      ru: 'Мейн Ziggy. Не фокусы, а иллюзии. Как и твой ранг.',
      id: 'Main Ziggy. Bukan trik, tapi ilusi. Kayak rank-mu.',
    },
  ],
  VINCE: [
    {
      en: 'Vince main. Coffee and bugs. Your customers ran away. So did your teammates.',
      es: 'Main Vince. Café y bichos. Tus clientes huyeron. Tus compañeros también.',
      pt: 'Main Vince. Café e insetos. Seus clientes fugiram. Seus parceiros também.',
      tr: "Vince main'i. Kahve ve böcekler. Müşterilerin kaçtı. Takım arkadaşların da.",
      de: 'Vince-Main. Kaffee und Käfer. Deine Kunden sind weggelaufen. Dein Team auch.',
      ru: 'Мейн Vince. Кофе и жуки. Твои клиенты сбежали. Как и твоя команда.',
      id: 'Main Vince. Kopi dan serangga. Pelangganmu kabur. Timmu juga.',
    },
  ],
  'BUZZ LIGHTYEAR': [
    {
      en: "Buzz Lightyear main. To infinity and beyond: the rank you'll never reach.",
      es: 'Main Buzz Lightyear. Al infinito y más allá: el rango al que nunca vas a llegar.',
      pt: 'Main Buzz Lightyear. Ao infinito e além: o rank que você nunca vai alcançar.',
      tr: "Buzz Lightyear main'i. Sonsuzluğa ve ötesine: asla ulaşamayacağın rütbe.",
      de: 'Buzz-Lightyear-Main. Bis zur Unendlichkeit und noch viel weiter: der Rang, den du nie erreichst.',
      ru: 'Мейн Buzz Lightyear. Бесконечность не предел: как и ранг, до которого ты не дойдёшь.',
      id: 'Main Buzz Lightyear. Menuju tak terbatas dan melampauinya: rank yang nggak akan pernah kamu capai.',
    },
  ],
};

/** By class, for a main with no line of its own. */
const CLASS_MAINS: Record<string, Line> = {
  Assassin: {
    en: '{main} main. Diving into three enemies alone is a personality, not a strategy.',
    es: 'Main {main}. Meterte solo contra tres enemigos es una personalidad, no una estrategia.',
    pt: 'Main {main}. Mergulhar sozinho em três inimigos é personalidade, não estratégia.',
    tr: "{main} main'i. Üç rakibin üstüne tek başına dalmak bir kişilik, strateji değil.",
    de: '{main}-Main. Allein in drei Gegner zu springen ist eine Persönlichkeit, keine Strategie.',
    ru: 'Мейн {main}. Нырять одному в трёх врагов — это характер, а не стратегия.',
    id: 'Main {main}. Menyelam sendirian ke tiga musuh itu kepribadian, bukan strategi.',
  },
  Tank: {
    en: '{main} main. All that health, and you still find a way to waste it.',
    es: 'Main {main}. Tanta vida y aun así encuentras la forma de desperdiciarla.',
    pt: 'Main {main}. Tanta vida e mesmo assim você dá um jeito de desperdiçar.',
    tr: "{main} main'i. O kadar can ve yine de onu harcamanın bir yolunu buluyorsun.",
    de: '{main}-Main. So viel Leben, und du findest trotzdem einen Weg, es zu verschwenden.',
    ru: 'Мейн {main}. Столько здоровья, а ты всё равно находишь способ его потратить впустую.',
    id: 'Main {main}. Darah sebanyak itu, dan kamu tetap menemukan cara buat menyia-nyiakannya.',
  },
  Marksman: {
    en: "{main} main. You stay so far back you're basically spectating.",
    es: 'Main {main}. Te quedas tan atrás que básicamente eres espectador.',
    pt: 'Main {main}. Você fica tão lá atrás que é praticamente espectador.',
    tr: "{main} main'i. O kadar geride duruyorsun ki resmen izleyicisin.",
    de: '{main}-Main. Du bleibst so weit hinten, dass du praktisch zuschaust.',
    ru: 'Мейн {main}. Ты стоишь так далеко сзади, что по сути смотришь бой как зритель.',
    id: 'Main {main}. Kamu di belakang banget sampai praktis jadi penonton.',
  },
  Artillery: {
    en: '{main} main. Behind a wall, far from danger, far from mattering.',
    es: 'Main {main}. Detrás de una pared, lejos del peligro, lejos de importar.',
    pt: 'Main {main}. Atrás da parede, longe do perigo, longe de fazer diferença.',
    tr: "{main} main'i. Duvarın arkasında, tehlikeden uzak, önemli olmaktan da uzak.",
    de: '{main}-Main. Hinter einer Wand, weit weg von der Gefahr, weit weg von jeder Bedeutung.',
    ru: 'Мейн {main}. За стеной, подальше от опасности, подальше от пользы.',
    id: 'Main {main}. Di balik tembok, jauh dari bahaya, jauh dari berguna.',
  },
  Support: {
    en: '{main} main. Healing the team so it can lose more slowly.',
    es: 'Main {main}. Curas al equipo para que pierda más despacio.',
    pt: 'Main {main}. Cura o time pra ele perder mais devagar.',
    tr: "{main} main'i. Takımı daha yavaş kaybetsin diye iyileştiriyorsun.",
    de: '{main}-Main. Du heilst das Team, damit es langsamer verliert.',
    ru: 'Мейн {main}. Лечишь команду, чтобы она проигрывала помедленнее.',
    id: 'Main {main}. Menyembuhkan tim supaya kalahnya lebih pelan.',
  },
  Controller: {
    en: '{main} main. You control the map. Just not the scoreboard.',
    es: 'Main {main}. Controlas el mapa. Pero no el marcador.',
    pt: 'Main {main}. Você controla o mapa. Só não controla o placar.',
    tr: "{main} main'i. Haritayı kontrol ediyorsun. Sadece skor tablosunu değil.",
    de: '{main}-Main. Du kontrollierst die Map. Nur nicht die Anzeigetafel.',
    ru: 'Мейн {main}. Ты контролируешь карту. Только не таблицу результатов.',
    id: 'Main {main}. Kamu mengontrol peta. Cuma nggak mengontrol papan skor.',
  },
  'Damage Dealer': {
    en: '{main} main. "Damage Dealer", says the class. Your stats say otherwise.',
    es: 'Main {main}. "Daño", dice la clase. Tus estadísticas dicen otra cosa.',
    pt: 'Main {main}. "Dano", diz a classe. Suas estatísticas dizem outra coisa.',
    tr: "{main} main'i. Sınıfı \"Yüksek Hasar\" diyor. İstatistiklerin başka söylüyor.",
    de: '{main}-Main. „Damage-Dealer“, sagt die Klasse. Deine Stats sagen was anderes.',
    ru: 'Мейн {main}. Класс говорит «Урон». Твоя статистика говорит другое.',
    id: 'Main {main}. "Penyerang", kata kelasnya. Statistikmu bilang lain.',
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
        tr: "{main} main'i. {total} savaşçı arasından seçtiğin bu. İlginç.",
        de: '{main}-Main. Von {total} Brawlern hast du dir genau den ausgesucht. Interessant.',
        ru: 'Мейн {main}. Из всех бойцов (а их {total}) ты выбрал именно этого. Интересно.',
        id: 'Main {main}. Dari {total} jagoan, kamu pilih yang ini. Menarik.',
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
        tr: "{main} şu an Aşamalı'da {mainTier} tier ve hâlâ main'in. Sadakat tatlı bir şey.",
        de: '{main} ist gerade Tier {mainTier} im Ranked, und du mainst ihn immer noch. Treue ist süß.',
        ru: '{main} сейчас в тире {mainTier} в ранговых боях, а ты всё ещё его мейнишь. Преданность — это мило.',
        id: '{main} sekarang tier {mainTier} di Berperingkat, dan kamu tetap main dia. Setia itu manis.',
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
        tr: "{main} şu an S tier. Galibiyetlerin sana değil yamaya ait.",
        de: '{main} ist gerade S-Tier. Deine Siege gehören dem Patch, nicht dir.',
        ru: '{main} сейчас в S-тире. Твои победы принадлежат патчу, а не тебе.',
        id: '{main} sekarang tier S. Kemenanganmu milik patch, bukan milikmu.',
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
        tr: "Hiç Aşamalı rütben yok. Draft ekranından mı korkuyorsun?",
        de: 'Überhaupt kein Ranked-Rang. Angst vor dem Draft-Bildschirm?',
        ru: 'Ни одного рангового ранга. Боишься экрана драфта?',
        id: 'Sama sekali nggak punya rank Berperingkat. Takut sama layar draft?',
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
        tr: "Tüm zamanların en iyisi: {best}. Bu sezon: {now}. Geri dönüş biraz zaman alıyor.",
        de: 'Bester Rang aller Zeiten: {best}. Diese Saison: {now}. Das Comeback lässt sich Zeit.',
        ru: 'Лучший ранг за всё время: {best}. В этом сезоне: {now}. Камбэк не торопится.',
        id: 'Rank terbaik sepanjang masa: {best}. Musim ini: {now}. Comeback-nya santai banget.',
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
        tr: "Ulaştığın en iyi Aşamalı rütbesi: {best}. Botlar bile daha yükseğe çıkıyor.",
        de: 'Bester Ranked-Rang aller Zeiten: {best}. Sogar die Bots klettern höher.',
        ru: 'Лучший ранг в ранговых боях: {best}. Даже боты забираются выше.',
        id: 'Rank Berperingkat terbaik: {best}. Bahkan bot naik lebih tinggi.',
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
        tr: "En iyi Aşamalı rütben: {best}. Ne iyi, ne kötü. Sadece orada.",
        de: 'Bester Ranked-Rang: {best}. Nicht gut, nicht schlecht. Einfach da.',
        ru: 'Лучший ранг в ранговых боях: {best}. Не хорошо, не плохо. Просто есть.',
        id: 'Rank Berperingkat terbaik: {best}. Nggak bagus, nggak jelek. Ada aja.',
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
        tr: "Aşamalı'da {best}. Ustalar'ı görecek kadar yakın, asla dokunamayacak kadar uzak.",
        de: '{best} im Ranked. Nah genug an Meister, um es zu sehen, weit genug, um es nie zu berühren.',
        ru: '{best} в ранговых боях. Достаточно близко к Мастеру, чтобы его видеть, и достаточно далеко, чтобы никогда не коснуться.',
        id: '{best} di Berperingkat. Cukup dekat dengan Master untuk melihatnya, cukup jauh untuk nggak pernah menyentuhnya.',
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
        tr: "Aşamalı'da {best}. Etkileyici. Bu aralar güneş ışığı nasıl?",
        de: '{best} im Ranked. Beeindruckend. Wie ist eigentlich das Sonnenlicht so?',
        ru: '{best} в ранговых боях. Впечатляет. Как там солнечный свет поживает?',
        id: '{best} di Berperingkat. Mengesankan. Gimana kabarnya sinar matahari?',
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
        tr: "Son {decided} maçında {wins} galibiyet. Takım arkadaşların tazminatı hak ediyor.",
        de: '{wins} Siege in deinen letzten {decided} Spielen. Dein Team verdient eine Entschädigung.',
        ru: 'Побед в последних боях: {wins} из {decided}. Твоя команда заслуживает компенсацию.',
        id: '{wins} menang dari {decided} game terakhirmu. Timmu layak dapat kompensasi.',
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
        tr: "Son maçlarında {wr} kazanma oranı. Hesabında kim oynuyor?",
        de: '{wr} Siegquote in deinen letzten Spielen. Wer hat auf deinem Account gespielt?',
        ru: 'Процент побед в последних боях: {wr}. Кто играл на твоём аккаунте?',
        id: 'Persentase menang {wr} di game-game terakhirmu. Siapa yang main pakai akunmu?',
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
        tr: "Son maçlarında {wins} galibiyet ve {losses} yenilgi. Sen bir oyuncu değilsin, yazı turasın.",
        de: '{wins} Siege und {losses} Niederlagen in deinen letzten Spielen. Du bist kein Spieler, du bist ein Münzwurf.',
        ru: 'Последние бои: побед {wins}, поражений {losses}. Ты не игрок, ты подброшенная монетка.',
        id: '{wins} menang dan {losses} kalah di game terakhirmu. Kamu bukan pemain, kamu lempar koin.',
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
        tr: "Son {games} maçının {rankedGames} tanesi Aşamalı'ydı ve hâlâ {now} rütbesindesin. Bu bağlılığa saygı.",
        de: '{rankedGames} deiner letzten {games} Spiele waren Ranked, und du bist immer noch {now}. Respekt für den Einsatz.',
        ru: 'Ранговых среди последних боёв: {rankedGames} из {games}, а ты всё ещё {now}. Уважаю упорство.',
        id: '{rankedGames} dari {games} game terakhirmu Berperingkat, dan kamu masih di {now}. Hormat untuk komitmennya.',
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
        tr: "Son {lossStreak} maçını üst üste kaybettin. Kapatıp tekrar açmayı denedin mi?",
        de: 'Deine letzten {lossStreak} Spiele in Folge verloren. Schon mal aus- und wieder eingeschaltet?',
        ru: 'Поражений подряд в последних боях: {lossStreak}. Пробовал выключить и включить снова?',
        id: 'Kalah {lossStreak} game berturut-turut. Sudah coba matikan lalu nyalakan lagi?',
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
        tr: "Son {games} maçında sıfır Yıldız Oyuncu. Oyun bile seni fark etmedi.",
        de: 'Null Mal Starspieler in deinen letzten {games} Spielen. Nicht mal das Spiel hat dich bemerkt.',
        ru: 'Ни разу не звёздный игрок за последние бои ({games}). Даже игра тебя не заметила.',
        id: 'Nol kali MVP di {games} game terakhirmu. Bahkan game-nya nggak sadar kamu ada.',
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
        tr: "Son {games} maçında {star} kez Yıldız Oyuncu. Takımı taşımak bir iş. Para alıyor musun?",
        de: '{star} Mal Starspieler in deinen letzten {games} Spielen. Carry ist ein Job. Wirst du bezahlt?',
        ru: 'Звёздный игрок в последних боях: {star} из {games}. Тащить — это работа. Тебе хоть платят?',
        id: 'MVP {star} kali di {games} game terakhirmu. Carry itu pekerjaan. Kamu dibayar?',
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
        tr: "Son {games} maçının {friendly} tanesi dostluk maçıydı. Hiç gelmeyecek bir maça hazırlanıyorsun.",
        de: '{friendly} deiner letzten {games} Spiele waren Freundschaftsspiele. Training für ein Match, das nie kommt.',
        ru: 'Дружеских среди последних боёв: {friendly} из {games}. Тренировка к бою, который так и не наступит.',
        id: '{friendly} dari {games} game terakhirmu laga persahabatan. Latihan untuk pertandingan yang nggak pernah datang.',
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
        tr: "Son {games} maçının {topGames} tanesi {topB} ile. Bilgin olsun, başka savaşçılar da var.",
        de: '{topGames} deiner letzten {games} Spiele mit {topB}. Es gibt auch andere Brawler, weißt du.',
        ru: 'Боёв на {topB} среди последних: {topGames} из {games}. Другие бойцы тоже существуют, если что.',
        id: '{topGames} dari {games} game terakhirmu pakai {topB}. Jagoan lain juga ada, lho.',
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
        tr: "{sdWins} Hesaplaşma galibiyeti ve {v3} 3v3 galibiyeti. Takım arkadaşlarına alerjin mi var?",
        de: '{sdWins} Showdown-Siege und {v3} 3-gegen-3-Siege. Allergisch gegen Teamkollegen?',
        ru: 'Побед в Столкновении: {sdWins}, побед в боях 3 на 3: {v3}. Аллергия на союзников?',
        id: '{sdWins} kemenangan Showdown dan {v3} kemenangan 3 lawan 3. Alergi rekan tim?',
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
        tr: "{soloWins} Tek Kişilik Hesaplaşma galibiyeti. Peki bunların kaçı \"takımlaşma\"ydı?",
        de: '{soloWins} Solo-Showdown-Siege. Und wie viele davon waren „Teaming“?',
        ru: 'Побед в одиночном Столкновении: {soloWins}. И сколько из них были «тимингом»?',
        id: '{soloWins} kemenangan Showdown Solo. Dan berapa yang hasil "teaming"?',
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
        tr: "Son {games} maçının {showdownRecent} tanesi Hesaplaşma. Gaz senin işini yapana kadar çalıda saklanıyorsun.",
        de: '{showdownRecent} deiner letzten {games} Spiele waren Showdown. Im Busch verstecken, bis das Gas deinen Job macht.',
        ru: 'Столкновение среди последних боёв: {showdownRecent} из {games}. Сидеть в кусте, пока газ делает твою работу.',
        id: '{showdownRecent} dari {games} game terakhirmu Showdown. Sembunyi di semak sampai gas yang kerja.',
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
        tr: "Kulüp yok. Botların bile kulübü var.",
        de: 'Kein Club. Sogar die Bots haben einen Club.',
        ru: 'Нет клуба. Даже у ботов есть клуб.',
        id: 'Nggak punya geng. Bahkan bot punya geng.',
      },
      {
        en: 'No club. Nobody sent an invite, or did everyone kick you?',
        es: 'Sin club. ¿Nadie te invitó o todos te expulsaron?',
        pt: 'Sem clube. Ninguém te convidou ou todo mundo te expulsou?',
        tr: "Kulüp yok. Kimse davet göndermedi mi, yoksa herkes seni mi attı?",
        de: 'Kein Club. Hat dir niemand eine Einladung geschickt, oder haben dich alle rausgeworfen?',
        ru: 'Нет клуба. Никто не прислал приглашение, или тебя отовсюду выгнали?',
        id: 'Nggak punya geng. Nggak ada yang ngundang, atau semua orang ngusir kamu?',
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
        tr: "Kulübünün adı \"{club}\". Onunla ilgili en korkutucu şey adı.",
        de: 'Dein Club heißt „{club}“. Das Gruseligste daran ist der Name.',
        ru: 'Твой клуб называется «{club}». Самое страшное в нём — название.',
        id: 'Gengmu namanya "{club}". Yang paling seram dari geng itu namanya.',
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
        tr: "Kulübünün adı \"{club}\". Büyük isim. Muhtemelen küçük Kulüp Ligi sonuçları.",
        de: 'Dein Club heißt „{club}“. Großer Name. Kleine Clubliga-Ergebnisse, vermutlich.',
        ru: 'Твой клуб называется «{club}». Громкое название. Скромные результаты в Лиге клубов, наверное.',
        id: 'Gengmu namanya "{club}". Nama besar. Hasil Liga Geng kecil, kayaknya.',
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
        tr: "{untouched} savaşçı hâlâ Güç 1'de. Bu bir kadro değil, bir müze.",
        de: '{untouched} Brawler noch auf Power 1. Das ist kein Kader, das ist ein Museum.',
        ru: 'Бойцов всё ещё на 1-м уровне силы: {untouched}. Это не коллекция, это музей.',
        id: '{untouched} jagoan masih di Power 1. Itu bukan roster, itu museum.',
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
        tr: "{maxed} savaşçının hepsi Güç 11'de. Bu bir hesap değil, ikinci bir iş.",
        de: 'Alle {maxed} Brawler auf Power 11. Das ist kein Account, das ist ein Zweitjob.',
        ru: 'Все бойцы на 11-м уровне силы ({maxed}). Это не аккаунт, это вторая работа.',
        id: 'Semua {maxed} jagoan di Power 11. Itu bukan akun, itu pekerjaan kedua.',
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
        tr: "{total} savaşçının yalnızca {owned} tanesi açık. Starr Hediyeleri senden nefret ediyor olmalı.",
        de: 'Nur {owned} von {total} Brawlern freigeschaltet. Die Starr-Drops müssen dich hassen.',
        ru: 'Открыто бойцов: {owned} из {total}. Призы Старр, похоже, тебя ненавидят.',
        id: 'Baru {owned} dari {total} jagoan terbuka. Hadiah Starr pasti benci kamu.',
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
        tr: "Yıldız gücü olmayan {noSp} Güç 11 savaşçı. Arabayı almışsın, motoru unutmuşsun.",
        de: '{noSp} Brawler auf Power 11 ohne Starpower. Das Auto gekauft, den Motor vergessen.',
        ru: 'Бойцов на 11-м уровне силы без звёздной силы: {noSp}. Купил машину, забыл про двигатель.',
        id: '{noSp} jagoan Power 11 tanpa Kekuatan Bintang. Beli mobil, lupa mesinnya.',
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
        tr: "Seviye {lvl} ve en iyi Aşamalı rütben {best}. Yılların tecrübesi, sıfır ders.",
        de: 'Level {lvl}, und dein bester Ranked-Rang ist {best}. Jahre an Erfahrung, null Lektionen gelernt.',
        ru: 'Уровень {lvl}, а лучший ранг в ранговых боях — {best}. Годы опыта, ноль выводов.',
        id: 'Level {lvl} dan rank Berperingkat terbaikmu {best}. Bertahun-tahun pengalaman, nol pelajaran.',
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
        tr: "Seviye {lvl} ve {tr} kupa mı? Ya bir dâhisin ya da bu hesabı başkası oynuyor.",
        de: 'Level {lvl} mit {tr} Trophäen? Entweder ein Wunderkind, oder jemand anderes spielt diesen Account.',
        ru: 'Уровень {lvl} и трофеев: {tr}? Либо вундеркинд, либо на этом аккаунте играет кто-то другой.',
        id: 'Level {lvl} dengan {tr} trofi? Entah anak ajaib, atau ada orang lain yang main akun ini.',
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
        tr: "Seviye {lvl}. Brawl Stars'ta okulda geçirdiğinden daha çok zaman geçirdin.",
        de: 'Level {lvl}. Du hast mehr Zeit in Brawl Stars verbracht als in der Schule.',
        ru: 'Уровень {lvl}. Ты провёл в Brawl Stars больше времени, чем в школе.',
        id: 'Level {lvl}. Kamu menghabiskan lebih banyak waktu di Brawl Stars daripada di sekolah.',
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
        tr: "{streakB} ile {streak} maçlık galibiyet serisi. Bir kez. O zamandan beri o hissin peşindesin.",
        de: 'Eine Siegesserie von {streak} mit {streakB}. Einmal. Seitdem jagst du diesem Gefühl hinterher.',
        ru: 'Серия побед на {streakB}: {streak}. Один раз. С тех пор ты гоняешься за этим чувством.',
        id: 'Rentetan {streak} kemenangan dengan {streakB}. Sekali. Sejak itu kamu terus mengejar perasaan itu.',
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
        tr: "Tüm zamanların en iyi galibiyet serin {streak}. İstikrar senin işin değil.",
        de: 'Deine beste Siegesserie aller Zeiten ist {streak}. Beständigkeit ist nicht dein Ding.',
        ru: 'Твоя лучшая серия побед за всё время: {streak}. Стабильность — не твоё.',
        id: 'Rentetan kemenangan terbaikmu sepanjang masa: {streak}. Konsistensi bukan gayamu.',
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
        tr: "{main} ile Prestij {prestige}. Bilgin olsun, uyku bedava.",
        de: 'Prestige {prestige} auf {main}. Schlafen ist kostenlos, weißt du.',
        ru: 'Прайм {prestige} на {main}. Сон, между прочим, бесплатный.',
        id: 'Prestise {prestige} di {main}. Tidur itu gratis, lho.',
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
        tr: "Kendine \"{name}\" adını vermişsin. {wr} kazanma oranı için cesurca.",
        de: 'Du nennst dich „{name}“. Mutig, bei {wr} Siegquote.',
        ru: 'Ты назвал себя «{name}». Смело для процента побед {wr}.',
        id: 'Kamu menamai dirimu "{name}". Berani, untuk persentase menang {wr}.',
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
        tr: "Süslü harflerle bir isim. Emek oynayışa değil yazı tipine gitmiş.",
        de: 'Ein Name in schicken Buchstaben. Die Mühe ging in die Schrift, nicht ins Gameplay.',
        ru: 'Ник красивыми буквами. Все силы ушли в шрифт, а не в игру.',
        id: 'Nama pakai huruf-huruf aesthetic. Usahanya masuk ke font, bukan ke cara main.',
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
        tr: "{tr} kupa. Her biri zor yoldan kazanıldı: yavaş yavaş.",
        de: '{tr} Trophäen. Jede davon auf die harte Tour verdient: langsam.',
        ru: 'Трофеев: {tr}. Каждый заработан тяжёлым путём: медленно.',
        id: '{tr} trofi. Setiap satunya didapat dengan cara susah: pelan-pelan.',
      },
      {
        en: '{tr} trophies. Somewhere, a bot is proud of you.',
        es: '{tr} trofeos. En algún lugar, un bot está orgulloso de ti.',
        pt: '{tr} troféus. Em algum lugar, um bot tá orgulhoso de você.',
        tr: "{tr} kupa. Bir yerlerde bir bot seninle gurur duyuyor.",
        de: '{tr} Trophäen. Irgendwo ist ein Bot stolz auf dich.',
        ru: 'Трофеев: {tr}. Где-то один бот тобой гордится.',
        id: '{tr} trofi. Di suatu tempat, ada bot yang bangga sama kamu.',
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
        tr: "{owned} savaşçı ve yine de her maç aynısını seçiyorsun.",
        de: '{owned} Brawler, und du nimmst trotzdem jedes Spiel denselben.',
        ru: 'Бойцов: {owned}, а ты всё равно каждый бой берёшь одного и того же.',
        id: '{owned} jagoan, dan kamu tetap pilih yang sama setiap game.',
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
  { min: 9, title: { en: 'Touch Grass Immediately', es: 'Sal a tocar pasto YA', pt: 'Vai tocar grama AGORA', tr: 'Hemen Dışarı Çık', de: 'Sofort an die frische Luft', ru: 'Срочно иди погуляй', id: 'Segera Sentuh Rumput' } },
  { min: 7.5, title: { en: 'Actually Cracked', es: 'Muy roto, la verdad', pt: 'Brabo demais, sendo honesto', tr: 'Gerçekten Çok İyi', de: 'Richtig stark', ru: 'Реально сильный', id: 'Beneran Jago' } },
  { min: 6, title: { en: 'Sweaty Tryhard', es: 'Tryhard sudoroso', pt: 'Tryhard suado', tr: 'Terli Tryhard', de: 'Verschwitzter Tryhard', ru: 'Потный трайхардер', id: 'Tryhard Berkeringat' } },
  { min: 4.5, title: { en: 'Professional Mid', es: 'Mediocre profesional', pt: 'Mediano profissional', tr: 'Profesyonel Ortalama', de: 'Profi-Mittelmaß', ru: 'Профессиональный середняк', id: 'Biasa Aja Profesional' } },
  { min: 3, title: { en: 'Bush Camper', es: 'Campero de arbustos', pt: 'Campeiro de moita', tr: 'Çalı Kampçısı', de: 'Busch-Camper', ru: 'Кустовой кемпер', id: 'Kemper Semak' } },
  { min: 1.5, title: { en: "Teammates' Nightmare", es: 'La pesadilla de tus compañeros', pt: 'O pesadelo dos parceiros', tr: 'Takım Arkadaşlarının Kâbusu', de: 'Albtraum deines Teams', ru: 'Кошмар своей команды', id: 'Mimpi Buruk Tim' } },
  { min: 0, title: { en: 'Certified Bot', es: 'Bot certificado', pt: 'Bot certificado', tr: 'Onaylı Bot', de: 'Zertifizierter Bot', ru: 'Сертифицированный бот', id: 'Bot Bersertifikat' } },
];

export const CLOSERS: { min: number; lines: Line[] }[] = [
  {
    min: 7.5,
    lines: [
      {
        en: 'Fine, {name}, you play well. Now go drink some water.',
        es: 'Está bien, {name}, juegas bien. Ahora ve a tomar agua.',
        pt: 'Tá bom, {name}, você joga bem. Agora vai beber uma água.',
        tr: "Tamam {name}, iyi oynuyorsun. Şimdi git biraz su iç.",
        de: 'Na gut, {name}, du spielst gut. Jetzt trink mal ein Glas Wasser.',
        ru: 'Ладно, {name}, ты хорошо играешь. А теперь иди попей воды.',
        id: 'Oke, {name}, mainmu bagus. Sekarang minum air dulu sana.',
      },
      {
        en: 'Good account. Terrible sleep schedule, probably.',
        es: 'Buena cuenta. Horario de sueño terrible, seguramente.',
        pt: 'Conta boa. Horário de sono péssimo, com certeza.',
        tr: "İyi hesap. Muhtemelen berbat bir uyku düzeni.",
        de: 'Guter Account. Furchtbarer Schlafrhythmus, vermutlich.',
        ru: 'Хороший аккаунт. Ужасный режим сна, наверное.',
        id: 'Akun bagus. Jadwal tidur jelek, kayaknya.',
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
        tr: "Tryhard tespit edildi {name}. Kasma gerçek. Sonuçlar hâlâ yükleniyor.",
        de: 'Tryhard erkannt, {name}. Der Grind ist echt. Die Ergebnisse laden noch.',
        ru: 'Обнаружен трайхардер, {name}. Гринд реальный. Результаты всё ещё загружаются.',
        id: 'Tryhard terdeteksi, {name}. Grind-nya nyata. Hasilnya masih loading.',
      },
      {
        en: "You take this game very seriously, {name}. The game has noticed. It isn't impressed yet.",
        es: 'Te tomas este juego muy en serio, {name}. El juego lo notó. Todavía no está impresionado.',
        pt: 'Você leva esse jogo muito a sério, {name}. O jogo percebeu. Ainda não ficou impressionado.',
        tr: "Bu oyunu çok ciddiye alıyorsun {name}. Oyun fark etti. Henüz etkilenmedi.",
        de: 'Du nimmst dieses Spiel sehr ernst, {name}. Das Spiel hat es bemerkt. Beeindruckt ist es noch nicht.',
        ru: 'Ты очень серьёзно относишься к этой игре, {name}. Игра это заметила. Пока не впечатлена.',
        id: 'Kamu serius banget main game ini, {name}. Game-nya sudah sadar. Belum terkesan.',
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
        tr: "Bugün gördüğümüz en kötü hesap değil. En iyisi de değil.",
        de: 'Nicht der schlechteste Account, den wir heute gesehen haben. Aber auch nicht der beste.',
        ru: 'Не худший аккаунт, что мы сегодня видели. Но и не лучший.',
        id: 'Bukan akun terburuk yang kami lihat hari ini. Tapi juga bukan yang terbaik.',
      },
      {
        en: 'A mid account, {name}. But mid is a place you can climb out of.',
        es: 'Una cuenta promedio, {name}. Pero de lo promedio se puede salir.',
        pt: 'Uma conta mediana, {name}. Mas do mediano dá pra sair.',
        tr: "Ortalama bir hesap {name}. Ama ortalama, tırmanıp çıkabileceğin bir yer.",
        de: 'Ein mittelmäßiger Account, {name}. Aber aus dem Mittelmaß kann man rausklettern.',
        ru: 'Средний аккаунт, {name}. Но из середины можно выбраться.',
        id: 'Akun biasa-biasa aja, {name}. Tapi dari biasa-biasa aja kamu bisa naik.',
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
        tr: "Oyunu sil mi? Hayır. Ama arada bir tier listesine bakabilirsin.",
        de: 'Das Spiel löschen? Nein. Aber vielleicht ab und zu mal die Tierlist anschauen.',
        ru: 'Удалить игру? Нет. Но, может, иногда заглядывай в тир-лист.',
        id: 'Hapus game-nya? Jangan. Tapi mungkin sesekali cek tier list.',
      },
      {
        en: "It's okay, {name}. Every pro started as a bot. Most of them stayed bots, though.",
        es: 'Tranqui, {name}. Todo pro empezó como bot. Aunque la mayoría siguió siendo bot.',
        pt: 'Relaxa, {name}. Todo pro começou como bot. Mas a maioria continuou bot.',
        tr: "Sorun değil {name}. Her pro bot olarak başladı. Gerçi çoğu bot olarak kaldı.",
        de: 'Alles gut, {name}. Jeder Profi hat als Bot angefangen. Die meisten sind allerdings Bots geblieben.',
        ru: 'Всё нормально, {name}. Каждый профи начинал как бот. Правда, большинство так ботами и остались.',
        id: 'Santai, {name}. Setiap pro mulai sebagai bot. Walaupun kebanyakan tetap jadi bot.',
      },
    ],
  },
];
