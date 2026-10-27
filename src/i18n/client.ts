/**
 * The text of client components, which ships to the browser -- so it is kept
 * apart from the server dictionaries (`es.ts`, `pt.ts`), which hold the whole
 * site. Keyed by the English sentence, like those.
 */
export const CLIENT_ES: Record<string, string> = {
  // search bar
  'Enter a tag to search.': 'Escribe un tag para buscar.',
  'Tags only use the characters 0289PYLQGRJCUV, so check for typos.':
    'Los tags solo usan los caracteres 0289PYLQGRJCUV, así que revisa si hay errores.',
  'Search type': 'Tipo de búsqueda',
  player: 'jugador',
  club: 'club',
  'player tag': 'tag de jugador',
  'club tag': 'tag de club',
  Search: 'Buscar',
  'Your tag is on your in-game profile, just below your profile icon.':
    'Tu tag está en tu perfil del juego, justo debajo de tu icono de perfil.',
  'A club tag is shown on the club screen, under the club name.':
    'El tag del club aparece en la pantalla del club, debajo del nombre.',
  // tag hint
  'Where do I find it?': '¿Dónde lo encuentro?',
  'Finding a club tag': 'Cómo encontrar el tag de un club',
  'Finding your tag': 'Cómo encontrar tu tag',
  'Open the club screen. The tag sits under the club name.':
    'Abre la pantalla del club. El tag está debajo del nombre del club.',
  'Tap your profile icon in the top-left of the game. The tag is directly underneath it.':
    'Toca tu icono de perfil, arriba a la izquierda en el juego. El tag está justo debajo.',
  Close: 'Cerrar',
  'It always begins with #. You can type it with or without the #, and case does not matter.':
    'Siempre empieza por #. Puedes escribirlo con o sin la #, y da igual si usas mayúsculas o minúsculas.',
  'Diagram of the club screen with the club tag highlighted beneath the club name':
    'Esquema de la pantalla del club con el tag resaltado debajo del nombre del club',
  'Diagram of the game profile screen with the player tag highlighted beneath the profile icon':
    'Esquema del perfil del juego con el tag del jugador resaltado debajo del icono de perfil',
  'CLUB TAG': 'TAG DEL CLUB',
  'YOUR TAG': 'TU TAG',
  // recent and saved profiles
  'Continue with': 'Seguir con',
  'Clear recent profiles': 'Borrar perfiles recientes',
  'Saved profiles': 'Perfiles guardados',
  'Clear all': 'Borrar todo',
  'Remove {name} from favourites': 'Quitar a {name} de favoritos',
  "Ranked Maps":
    "Mapas de Competitivo",
  "Tools":
    "Herramientas",
  "Draft":
    "Draft",
  "Leaderboard":
    "Clasificación",
  "Power 11":
    "Fuerza 11",
  "Ranked":
    "Competitivo",
  "Win streak":
    "Racha de victorias",
  "All findings":
    "Todos los hallazgos",
  "BrawlZone Radar":
    "Radar de BrawlZone",
  "Discovered today":
    "Descubierto hoy",
  "Finding {v} of {count}":
    "Hallazgo {v} de {count}",
  "Next finding":
    "Siguiente hallazgo",
  "Previous finding":
    "Hallazgo anterior",
  "Things our own sampling turned up that no tier list would tell you.":
    "Cosas que encontró nuestro propio muestreo y que ninguna tier list te diría.",
  "Brawl Stars Wiki":
    "Brawl Stars Wiki",
  "Legacy":
    "Retirado",
  "Win rate":
    "Tasa de victorias",
  "Brawlers":
    "Brawlers",
  "At peak":
    "En su máximo",
  "Peak {highestTrophies}":
    "Máximo {highestTrophies}",
  "Power {power}":
    "Fuerza {power}",
  "Buffies":
    "Buffies",
  "Gadgets":
    "Gadgets",
  "Gears":
    "Refuerzos",
  "Star powers":
    "Habilidades estelares",
  "Compare":
    "Comparar",
  " of {length}":
    " de {length}",
  ", {legacy} withdrawn":
    ", {legacy} retirados",
  ", {upcoming} not released yet":
    ", {upcoming} sin salir todavía",
  "All":
    "Todos",
  "Clear filters":
    "Quitar filtros",
  "Clear search":
    "Borrar búsqueda",
  "Filters":
    "Filtros",
  "Name A–Z":
    "Nombre A–Z",
  "Newest first":
    "Más nuevos primero",
  "No brawlers match those filters.":
    "Ningún brawler coincide con esos filtros.",
  "No longer available in the game. Kept for its history.":
    "Ya no está en el juego. Se mantiene por su historial.",
  "Rarest first":
    "Más raros primero",
  "Release order":
    "Orden de salida",
  "Revealed but not in the game yet.":
    "Anunciado pero todavía no está en el juego.",
  "Search brawlers":
    "Buscar brawlers",
  "Search brawlers by name":
    "Buscar brawlers por nombre",
  "Soon":
    "Pronto",
  "Sort":
    "Ordenar",
  "Strongest":
    "Más fuertes",
  "brawler":
    "brawler",
  "{tier} tier in Ranked{v}":
    "Tier {tier} en Competitivo{v}",
  "· {playable} currently playable":
    "· {playable} jugables ahora",
  "Best win streak {best}":
    "Mejor racha de victorias: {best}",
  "Filter brawlers":
    "Filtrar brawlers",
  "Filter brawlers by name":
    "Filtrar brawlers por nombre",
  "Name":
    "Nombre",
  "No brawlers match “{query}”.":
    "Ningún brawler coincide con «{query}».",
  "Off peak":
    "Bajo su máximo",
  "On {live} in a row; best {best}":
    "Lleva {live} seguidas; mejor racha {best}",
  "Power":
    "Fuerza",
  "Prestige {prestige}":
    "Prestigio {prestige}",
  "Rank":
    "Rango",
  "Rank {rank}":
    "Rango {rank}",
  "Show {hidden} more":
    "Mostrar {hidden} más",
  "best {best}":
    "mejor {best}",
  "{live} in a row":
    "{live} seguidas",
  "{name}: not enough sampled battles to rate":
    "{name}: no hay suficientes partidas para puntuarlo",
  "{name}: {tier} tier on the trophy list, meta score {v}":
    "{name}: tier {tier} en la lista de trofeos, puntuación meta {v}",
  "−{gap} off peak":
    "−{gap} bajo su máximo",
  "Choose a brawler":
    "Elige un brawler",
  "No brawler matches “{query}”.":
    "Ningún brawler coincide con «{query}».",
  "First brawler":
    "Primer brawler",
  "Second brawler":
    "Segundo brawler",
  "{decidedSampleSize} battles here":
    "{decidedSampleSize} partidas aquí",
  "All modes":
    "Todos los modos",
  "Clear":
    "Borrar",
  "{mapName} map layout":
    "Diseño del mapa {mapName}",
  "Maps":
    "Mapas",
  "{length} maps":
    "{length} mapas",
  "map":
    "mapa",
  "maps":
    "mapas",
  " · thin":
    " · pocos datos",
  "At power 11":
    "Con fuerza 11",
  "Every brawler":
    "Todos los brawlers",
  "None of the brawlers with a record on this map are in that list.":
    "Ninguno de los brawlers con récord en este mapa está en esa lista.",
  "Show":
    "Mostrar",
  "no matchup data":
    "sin datos de enfrentamiento",
  "{name} owns":
    "Los de {name}",
  "{v} beside yours":
    "{v} junto a los tuyos",
  "{v} vs their picks":
    "{v} contra sus elecciones",
  "Close map preview":
    "Cerrar vista previa del mapa",
  "Expand the {mapName} map layout":
    "Ampliar el diseño del mapa {mapName}",
  "No map preview":
    "Sin vista previa del mapa",
  "No map matches “{query}”.":
    "Ningún mapa coincide con «{query}».",
  "Open the {v} page":
    "Abrir la página de {v}",
  "Search maps":
    "Buscar mapas",
  "Search {total} maps by name":
    "Buscar entre {total} mapas por nombre",
  "matching “{query}”":
    "que coinciden con «{query}»",
  "and":
    "y",
  "Hypercharges":
    "Hipercargas",
  "Prestige":
    "Prestigio",
  "Skill score":
    "Puntuación de habilidad",
  "Trophies":
    "Trofeos",
  "Show all {length}":
    "Mostrar los {length}",
  "Hypercharge":
    "Hipercarga",
  "Class":
    "Clase",
  "Rarity":
    "Rareza",
  "Tier":
    "Tier",
  "vs":
    "vs",
  "Unranked":
    "Sin rango",
  "main":
    "main",
  "Star player":
    "Estelar",
  " · power {brawlerPower}":
    " · fuerza {brawlerPower}",
  "All results":
    "Todos los resultados",
  "By brawler":
    "Por brawler",
  "By mode":
    "Por modo",
  "Draws":
    "Empates",
  "Filter by mode":
    "Filtrar por modo",
  "Filter by result":
    "Filtrar por resultado",
  "Last {length} games":
    "Últimas {length} partidas",
  "Losses":
    "Derrotas",
  "No battles match that filter.":
    "Ninguna partida coincide con ese filtro.",
  "Star player ×{stars}":
    "Estelar ×{stars}",
  "Team":
    "Equipo",
  "This battle reported no player list.":
    "Esta partida no trae lista de jugadores.",
  "Unknown brawler":
    "Brawler desconocido",
  "Wins":
    "Victorias",
  "· mostly":
    "· sobre todo",
  "Brawl Stars player comparison":
    "Comparación de jugadores de Brawl Stars",
  "Clear recent":
    "Borrar recientes",
  "Clear the comparison":
    "Borrar la comparación",
  "Clear {v}":
    "Borrar {v}",
  "Look a player up from the search box and they are remembered on this device, ready to pick here without typing the tag again. Nothing is sent to the server.":
    "Busca un jugador en el buscador y se recordará en este dispositivo, listo para elegirlo aquí sin volver a escribir el tag. No se envía nada al servidor.",
  "Looked up on this device":
    "Buscados en este dispositivo",
  "Other side":
    "El otro lado",
  "Player 1":
    "Jugador 1",
  "Player 2":
    "Jugador 2",
  "Share":
    "Compartir",
  "Swap players":
    "Cambiar jugadores",
  "Swap the two players":
    "Intercambiar los dos jugadores",
  ", so the real figure is this or better.":
    ", así que la cifra real es esta o mejor.",
  "30 members’ rosters":
    "los brawlers de los 30 miembros",
  "Club power":
    "Poder del club",
  "Every member's roster read against the current Ranked S and A tier — what this club can actually put on the field.":
    "Los brawlers de cada miembro comparados con los tiers S y A actuales de Competitivo: lo que este club puede sacar de verdad.",
  "No hypercharge in the club:":
    "Sin hipercarga en el club:",
  "Nobody can field:":
    "Nadie puede sacar:",
  "Rank this club":
    "Analizar este club",
  "Ranked by hypercharged coverage of the top tier, then by what they can field at all. Trophies only break a tie — the game already sorts the member list that way.":
    "Ordenados por cuántos de los mejores tiers tienen con hipercarga, y luego por los que pueden sacar. Los trofeos solo desempatan: el juego ya ordena así la lista de miembros.",
  "Reading rosters…":
    "Leyendo brawlers…",
  "Reads all":
    "Lee",
  "The game’s API only answered for {length} of":
    "La API del juego solo respondió para {length} de",
  "can field":
    "puede sacar",
  "could not be read":
    "no se pudieron leer",
  "fieldable,":
    "disponibles,",
  "hyper":
    "hiper",
  "hypercharged":
    "con hipercarga",
  "hypercharged.":
    "con hipercarga.",
  "live. It takes a few seconds, so it only runs when you ask.":
    "en vivo. Tarda unos segundos, así que solo se hace cuando lo pides.",
  "member":
    "miembro",
  "members":
    "miembros",
  "members, so this is incomplete and has not been saved.":
    "miembros, así que está incompleto y no se ha guardado.",
  "of the {topTierSize} brawlers in the current Ranked S and A tier, for the typical member of {name}. Between all {length} of them:":
    "de los {topTierSize} brawlers de los tiers S y A actuales de Competitivo, para el miembro típico de {name}. Entre los {length}:",
  "only hypercharged":
    "solo con hipercarga",
  "{coverage} fieldable · {powerEleven} at power 11 ·":
    "{coverage} disponibles · {powerEleven} con fuerza 11 ·",
  "1 day ago":
    "hace 1 día",
  "Since your last visit":
    "Desde tu última visita",
  "{days} days ago":
    "hace {days} días",
  "· kept in this browser only":
    "· guardado solo en este navegador",
  "All countries":
    "Todos los países",
  "No country matches “{query}”.":
    "Ningún país coincide con «{query}».",
  "Search countries":
    "Buscar países",
  "Link copied":
    "Enlace copiado",
  "Share this profile":
    "Compartir este perfil",
  "No members match that search.":
    "Ningún miembro coincide con esa búsqueda.",
  "Search club members":
    "Buscar miembros del club",
  "Search members by name or tag":
    "Buscar miembros por nombre o tag",
  "This club has no members listed.":
    "Este club no tiene miembros en la lista.",
  "Profile sections":
    "Secciones del perfil",
  "A 27-second tutorial: adding a player tag so brawlers you do not own are greyed out, turning on Hide unavailable brawlers, then opening the bubble mid-draft for the best picks on the map and the build to run.":
    "Un tutorial de 27 segundos: añadir un tag de jugador para que los brawlers que no tienes salgan en gris, activar Ocultar brawlers no disponibles y luego abrir la burbuja en pleno draft para ver los mejores brawlers del mapa y la build que llevar.",
  "A Bounty draft on Hideout: the bubble opens the Ranked tier list, the filter narrows to that map, the panel shows Brock’s most-owned build, and Brock is then picked and given that star power.":
    "Un draft de Caza estelar en Escondite: la burbuja abre la tier list de Competitivo, el filtro se reduce a ese mapa, el panel muestra la build más común de Brock y luego se elige a Brock con esa habilidad estelar.",
  "The BrawlZone panel open during a Bounty draft on Hideout, listing the brawlers measured best on that map":
    "El panel de BrawlZone abierto durante un draft de Caza estelar en Escondite, con los brawlers que mejor rinden en ese mapa",
  "Add it to your home screen":
    "Añádelo a tu pantalla de inicio",
  "Dismiss install prompt":
    "Cerrar aviso de instalación",
  "Install":
    "Instalar",
  "Install BrawlZone":
    "Instalar BrawlZone",
  "Back to search":
    "Volver a buscar",
  "Something went wrong":
    "Algo salió mal",
  "This page could not be loaded. It is usually the game API being slow or rate-limited, which clears on its own — trying again often just works.":
    "No se pudo cargar esta página. Normalmente es la API del juego, que va lenta o limita las peticiones, y se arregla sola: volver a intentarlo suele funcionar.",
  "Try again":
    "Intentar de nuevo",
  "Save":
    "Guardar",
  "Save to favourites":
    "Guardar en favoritos",
  "Save {name} to favourites":
    "Guardar a {name} en favoritos",
  "Saved":
    "Guardado",
  "Saved. Click to remove":
    "Guardado. Haz clic para quitarlo",
  "brawlers":
    "brawlers",
  "Overrated":
    "Sobrevalorados",
  "Starr Drops":
    "Premios Starr",
  "Movement":
    "Movimiento",
  "Released":
    "Salida",
  "Gadget":
    "Gadget",
  "News":
    "Noticias",
  "Star power":
    "Habilidad estelar",
  "Daily":
    "Diario",
  "Cosmetics":
    "Cosméticos",
  "Played":
    "Jugados",
  " of ":
    " de ",
  "Copy share link":
    "Copiar enlace para compartir",
  "Every brawler is placed. Tap one in a row to send it back here.":
    "Todos los brawlers están colocados. Toca uno de una fila para devolverlo aquí.",
  "Place the selected brawler in {tier} tier":
    "Colocar el brawler elegido en el tier {tier}",
  "Start from the live meta":
    "Empezar con el meta actual",
  "placed":
    "colocados",
  "selected — now tap a tier to place it.":
    "elegido: ahora toca un tier para colocarlo.",
  "{name}: tap to select, tap again to unrank":
    "{name}: toca para elegir, vuelve a tocar para quitarlo",
  "{name}: tap to select, then tap a tier":
    "{name}: toca para elegir y luego toca un tier",
  ". Bubble size is the sample behind each point. Tap one for its numbers.":
    ". El tamaño de cada burbuja es la muestra que tiene detrás. Toca una para ver sus números.",
  "Every rated brawler plotted by pick rate against meta score, over {windowDays} days":
    "Cada brawler puntuado, según su tasa de uso y su puntuación meta, en {windowDays} días",
  "How often it is picked →":
    "Cuánto se elige →",
  "How well it does →":
    "Cuánto rinde →",
  "Lit brawlers are the ones this account can field. It has":
    "Los brawlers iluminados son los que esta cuenta puede usar. Tiene",
  "Meta":
    "Meta",
  "Out of favour":
    "Fuera del meta",
  "Sleepers":
    "Dormidos",
  "in the meta corner":
    "en la esquina del meta",
  "picked · {sampleSize} battles":
    "de uso · {sampleSize} partidas",
  "sleepers":
    "dormidos",
  "strongest 30%":
    "el 30% más fuerte",
  "weakest 40%":
    "el 40% más débil",
  "win rate ·":
    "de victorias ·",
  "{count} brawlers with enough ranked battles to rate over {windowDays} days. Bubble size is the sample behind each one, so the least certain points are the smallest. Tap one for its numbers.":
    "{count} brawlers con suficientes partidas de Competitivo para puntuarlos en {windowDays} días. El tamaño de cada burbuja es la muestra que tiene detrás, así que los puntos menos seguros son los más pequeños. Toca uno para ver sus números.",
  "{haveMeta} of the {length}":
    "{haveMeta} de los {length}",
  "{haveSleepers} of the {length}":
    "{haveSleepers} de los {length}",
  "A new brawler at midnight UTC.":
    "Un brawler nuevo a medianoche UTC.",
  "Average {v} guesses":
    "Media de {v} intentos",
  "Best":
    "Mejor",
  "Copied":
    "Copiado",
  "Copy result":
    "Copiar resultado",
  "Got it in {length}":
    "Lo sacaste en {length}",
  "Guess a brawler":
    "Adivina un brawler",
  "Guess today’s brawler. Each guess shows how close you are on five clues — green is exact, amber is one step away, and an arrow points toward the answer.":
    "Adivina el brawler de hoy. Cada intento muestra lo cerca que estás en cinco pistas: verde es exacto, ámbar está a un paso, y una flecha apunta hacia la respuesta.",
  "Guesses to solve":
    "Intentos para resolver",
  "Next brawler in":
    "Siguiente brawler en",
  "Range":
    "Alcance",
  "Reload":
    "Recarga",
  "Revealed":
    "Revelado",
  "Streak":
    "Racha",
  "Type a brawler name…":
    "Escribe el nombre de un brawler…",
  "Won":
    "Ganados",
  "Yesterday was":
    "Ayer era",
  "guess":
    "intento",
  "guesses":
    "intentos",
  "higher":
    "más alto",
  "in {left} {v}":
    "en {left} {v}",
  "lower":
    "más bajo",
  "Nothing matches “{query}”.":
    "Nada coincide con «{query}».",
  "Search by skin or brawler":
    "Buscar por aspecto o brawler",
  "Search icons by number":
    "Buscar iconos por número",
  "Search profile icons":
    "Buscar iconos de perfil",
  "Search skins":
    "Buscar aspectos",
  "of":
    "de",
  "{stats} first-guess solve":
    "{stats} acierto al primer intento",
  "{stats} first-guess solves":
    "{stats} aciertos al primer intento",
  "Android app":
    "App para Android",
  "Big Brawler":
    "Megabrawl",
  "Club":
    "Club",
  "Coins":
    "Monedas",
  "Duo showdown":
    "Supervivencia (dúo)",
  "Events":
    "Eventos",
  "Experience":
    "Experiencia",
  "Players":
    "Jugadores",
  "Power points":
    "Puntos de fuerza",
  "President":
    "Presidente",
  "Robo Rumble":
    "Pelea robótica",
  "Solo showdown":
    "Supervivencia (solo)",
  "Starr Drop":
    "Premio Starr",
  "Tier list":
    "Tier list",
  "Time played":
    "Tiempo jugado",
  "Trophy gain":
    "Trofeos ganados",
  "App Store":
    "App Store",
  "Download on the":
    "Descárgalo en el",
  "Download on the App Store":
    "Descárgalo en el App Store",
  "GET IT ON":
    "DISPONIBLE EN",
  "Get it on Google Play":
    "Disponible en Google Play",
  "Google Play":
    "Google Play",
  "Skins":
    "Aspectos",
  "Buffie":
    "Buffie",
  "No preview":
    "Sin vista previa",
  "3v3 wins":
    "Victorias en 3c3",
  "Battles":
    "Partidas",
  "Daily challenge":
    "Reto diario",
  "Release notes":
    "Notas de versión",
  "Gear":
    "Refuerzo",
  "From {sampleSize} sampled battles.":
    "Con {sampleSize} partidas.",
  "See every matchup":
    "Ver todos los enfrentamientos",
  "See the full record":
    "Ver el récord completo",
  "See the map":
    "Ver el mapa",
  "See what changed":
    "Ver qué cambió",
  "See who else pairs well":
    "Ver con quién más combina",
  "See why it underperforms":
    "Ver por qué rinde menos",
  "The giant killer":
    "El matagigantes",
  "The map surprise":
    "La sorpresa del mapa",
  "The meta trap":
    "La trampa del meta",
  "The overnight rise":
    "La subida de la noche",
  "The secret duo":
    "El dúo secreto",
  "The secret pick":
    "La elección secreta",
  "Almost nobody picks {name}. It is winning anyway.":
    "Casi nadie elige a {name}. Y aun así está ganando.",
  "Could not check that guess.":
    "No se pudo comprobar ese intento.",
  "Could not copy. Select the grid and copy it by hand.":
    "No se pudo copiar. Selecciona la cuadrícula y cópiala a mano.",
  "Could not reach the server. Try again.":
    "No se pudo conectar con el servidor. Inténtalo de nuevo.",
  "Could not read this club right now.":
    "No se pudo leer este club ahora mismo.",
  "Meta score {from} to {to} in a single day, on enough battles for the move to be real rather than noise.":
    "Puntuación meta de {from} a {to} en un solo día, con suficientes partidas para que el cambio sea real y no ruido.",
  "Picked in {picks} of sampled battles and returning {rate} adjusted — below the average of the very players picking it.":
    "Elegido en el {picks} de las partidas y con un {rate} ajustado: por debajo de la media de los propios jugadores que lo eligen.",
  "Teamed up, {name} wins {rate} — {edge} better than it does otherwise. Neither is picked for the other.":
    "Juntos, {name} gana el {rate}: {edge} más de lo normal. Ninguno de los dos se elige pensando en el otro.",
  "That is not a current brawler.":
    "Ese no es un brawler actual.",
  "Too many scans at once. Give it a minute.":
    "Demasiados análisis a la vez. Espera un minuto.",
  "adjusted win rate":
    "tasa de victorias ajustada",
  "meta score, 1 day":
    "puntuación meta, 1 día",
  "of all picks":
    "de todas las elecciones",
  "on {map}":
    "en {map}",
  "this map":
    "este mapa",
  "vs its usual form":
    "frente a su nivel normal",
  "when paired":
    "cuando van juntos",
  "{name} and {other} belong together.":
    "{name} y {other} van juntos.",
  "{name} climbed overnight.":
    "{name} subió de la noche a la mañana.",
  "{name} is a different brawler on {map}.":
    "{name} es otro brawler en {map}.",
  "{name} is everywhere, and losing.":
    "{name} está en todas partes, y pierde.",
  "{name} is picked constantly and losing.":
    "{name} se elige todo el tiempo y pierde.",
  "{name} moved more than anything else since yesterday.":
    "{name} es el que más se movió desde ayer.",
  "{name} owns {other}.":
    "{name} domina a {other}.",
  "{rate} adjusted win rate on just {picks} of picks — one of the strongest records on the roster, from a brawler most drafts never consider.":
    "{rate} de victorias ajustadas con solo el {picks} de uso: uno de los mejores récords de todos los brawlers, de un brawler que casi ningún draft tiene en cuenta.",
  "{rate} against {other} specifically, {edge} above {name}'s own record. The most lopsided matchup in the sample.":
    "{rate} contra {other} en concreto, {edge} por encima del récord propio de {name}. El enfrentamiento más desigual de la muestra.",
  "{rate} here against {other} across every other map — the widest gap between a brawler and one piece of terrain.":
    "{rate} aquí frente al {other} en el resto de mapas: la mayor diferencia entre un brawler y un terreno concreto.",
  "Common":
    "Común",
  "Rare":
    "Especial",
  "Super Rare":
    "Superespecial",
  "Epic":
    "Épico",
  "Mythic":
    "Mítico",
  "Legendary":
    "Legendario",
  "Ultra Legendary":
    "Ultralegendario",
  "Starting Brawler":
    "Brawler inicial",
  "Damage Dealer":
    "Destructor",
  "Tank":
    "Tanque",
  "Marksman":
    "Tiro de élite",
  "Support":
    "Apoyo",
  "Controller":
    "Control",
  "Assassin":
    "Asesino",
  "Artillery":
    "Artillería",
  "Type a brawler, e.g. Shade":
    "Escribe un brawler, p. ej. Shade",
  "Brawler to counter":
    "Brawler a counterear",
  "Counters":
    "Counters",
  "No brawler by that name.":
    "No hay ningún brawler con ese nombre.",
  "A 51-second tour of BrawlZone Bubble: the bubble floating over Brawl Stars, the best picks for the exact map, the build owners run, the panel in your language, and the bubble’s size and fade settings.":
    "Un recorrido de 51 segundos por BrawlZone Bubble: la burbuja flotando sobre Brawl Stars, las mejores elecciones para el mapa exacto, la build que usan los jugadores, el panel en tu idioma y los ajustes de tamaño y transparencia de la burbuja.",
  "Share as image":
    "Compartir como imagen",
  "Making your image…":
    "Creando tu imagen…",
  "Calculate":
    "Calcular",
  "Your player tag, e.g. #2PQ8LJ9V":
    "Tu tag de jugador, ej. #2PQ8LJ9V",
  "Compared with the Ranked tier list from the last 7 days of battles.":
    "Comparada con la tier list de Competitivo de los últimos 7 días de combates.",
  "No disagreements: you see the meta exactly as the battles do.":
    "Sin desacuerdos: ves el meta exactamente como lo dicen los combates.",
  "Save as image":
    "Guardar como imagen",
  "Your list matches the real data: {n}%":
    "Tu lista coincide con los datos reales: {n}%",
  "you put it in {mine}, the data says {data}: you rate it higher":
    "lo pusiste en {mine}, los datos dicen {data}: lo valoras más",
  "you put it in {mine}, the data says {data}: you rate it lower":
    "lo pusiste en {mine}, los datos dicen {data}: lo valoras menos",
  // YouTube card (2026-10-20)
  'The best Ranked picks, as 30-second Shorts': 'Los mejores picks de Competitivo, en Shorts de 30 segundos',
  'A new one every few hours: counters, builds, best brawlers per map. Free on YouTube.':
    'Uno nuevo cada pocas horas: counters, builds y los mejores brawlers por mapa. Gratis en YouTube.',
  Subscribe: 'Suscribirme',
  Later: 'Más tarde',
  "Don't show again": 'No volver a mostrar',
  "All three done!":
    "¡Los tres resueltos!",
  "Classic":
    "Clásico",
  "Every wrong guess zooms out a little.":
    "Cada intento fallido aleja un poco la imagen.",
  "It was":
    "Era",
  "New puzzles in":
    "Nuevos retos en",
  "Out of guesses.":
    "Sin intentos.",
  "Shadow":
    "Sombra",
  "Share your results":
    "Comparte tus resultados",
  "Today’s mystery brawler":
    "El brawler misterioso de hoy",
  "Zoom":
    "Zoom",
  "new":
    "nuevo",
  "playing":
    "jugando",
  "{n} guesses left":
    "quedan {n} intentos",
  "{n} of 3 done":
    "{n} de 3 resueltos",
  "{n}-day streak":
    "racha de {n} días",
  "Who is this, up close?":
    "¿Quién es, de cerca?",
  "Whose shadow is this?":
    "¿De quién es esta sombra?",
  "average {n} guesses":
    "promedio de {n} intentos",
  "{n} players solved today’s Classic":
    "{n} jugadores resolvieron el Clásico de hoy",
  "{pct}% of players solved today’s {mode}":
    "El {pct}% de los jugadores resolvió el reto {mode} de hoy",
  "Yesterday’s answers":
    "Respuestas de ayer",
  "finish one puzzle today to keep it":
    "termina un reto hoy para mantenerla",
  "A friend sent you: entering gives them +1 entry too.":
    "Te invitó un amigo: si entras, él también gana +1 entrada.",
  "Closed":
    "Cerrado",
  "Confirmed on Discord":
    "Confirmado en Discord",
  "Copy":
    "Copiar",
  "Enter for free":
    "Participar gratis",
  "Enter the giveaway":
    "Participa en el sorteo",
  "Entered the giveaway":
    "Participando en el sorteo",
  "Entering…":
    "Participando…",
  "Entries are closed.":
    "Las participaciones están cerradas.",
  "Free Brawl Stars giveaway: win a €10 gift card for the Brawl Pass. Enter here:":
    "Sorteo gratis de Brawl Stars: gana una tarjeta regalo de 10 € para el Brawl Pass. Participa aquí:",
  "Friends who entered with your link: {n} of {max}":
    "Amigos que entraron con tu link: {n} de {max}",
  "I am 13 or older (under 18: a parent knows I am entering) and I accept the":
    "Tengo 13 años o más (si tengo menos de 18, mi madre, padre o tutor lo sabe) y acepto las",
  "Join our Discord and type /giveaway {code}":
    "Únete a nuestro Discord y escribe /giveaway {code}",
  "Keep this page: it is saved in this browser, and the link with your code always shows it.":
    "Guarda esta página: queda guardada en este navegador, y el link con tu código siempre la muestra.",
  "Open Discord":
    "Abrir Discord",
  "Send on WhatsApp":
    "Enviar por WhatsApp",
  "You are in, {name}!":
    "¡Ya estás dentro, {name}!",
  "Your code":
    "Tu código",
  "Your email, only to tell you if you win":
    "Tu email, solo para avisarte si ganas",
  "Your friend link: +1 entry for every friend who enters with it":
    "Tu link para amigos: +1 entrada por cada amigo que entre con él",
  "Your player tag":
    "Tu tag de jugador",
  "entries":
    "entradas",
  "entry":
    "entrada",
  "giveaway rules":
    "reglas del sorteo",
  "Tick the box to confirm your age and the rules.":
    "Marca la casilla para confirmar tu edad y las reglas.",
  "That email does not look right.":
    "Ese email no parece correcto.",
  "No Brawl Stars account has that tag. Check it under your name in game.":
    "Ninguna cuenta de Brawl Stars tiene ese tag. Revísalo debajo de tu nombre en el juego.",
  "This tag is already entered. Lost your page? Write to contact@brawlzone.net.":
    "Este tag ya está participando. ¿Perdiste tu página? Escribe a contact@brawlzone.net.",
  "This email is already entered. One entry per person.":
    "Este email ya está participando. Una participación por persona.",
  "Too many entries from this network today. Try again tomorrow.":
    "Demasiadas participaciones desde esta red hoy. Inténtalo mañana.",
  "Something went wrong on our side. Try again in a minute.":
    "Algo salió mal de nuestro lado. Inténtalo en un minuto.",
};

export const CLIENT_PT: Record<string, string> = {
  // search bar
  'Enter a tag to search.': 'Digite uma tag para buscar.',
  'Tags only use the characters 0289PYLQGRJCUV, so check for typos.':
    'As tags só usam os caracteres 0289PYLQGRJCUV, então confira se não há erro de digitação.',
  'Search type': 'Tipo de busca',
  player: 'jogador',
  club: 'clube',
  'player tag': 'tag do jogador',
  'club tag': 'tag do clube',
  Search: 'Buscar',
  'Your tag is on your in-game profile, just below your profile icon.':
    'Sua tag fica no seu perfil do jogo, logo abaixo do ícone de perfil.',
  'A club tag is shown on the club screen, under the club name.':
    'A tag do clube aparece na tela do clube, abaixo do nome.',
  // tag hint
  'Where do I find it?': 'Onde eu encontro?',
  'Finding a club tag': 'Como achar a tag de um clube',
  'Finding your tag': 'Como achar a sua tag',
  'Open the club screen. The tag sits under the club name.':
    'Abra a tela do clube. A tag fica abaixo do nome do clube.',
  'Tap your profile icon in the top-left of the game. The tag is directly underneath it.':
    'Toque no seu ícone de perfil, no canto superior esquerdo do jogo. A tag fica logo abaixo.',
  Close: 'Fechar',
  'It always begins with #. You can type it with or without the #, and case does not matter.':
    'Ela sempre começa com #. Você pode digitar com ou sem o #, e maiúsculas ou minúsculas não fazem diferença.',
  'Diagram of the club screen with the club tag highlighted beneath the club name':
    'Desenho da tela do clube com a tag destacada abaixo do nome do clube',
  'Diagram of the game profile screen with the player tag highlighted beneath the profile icon':
    'Desenho do perfil do jogo com a tag do jogador destacada abaixo do ícone de perfil',
  'CLUB TAG': 'TAG DO CLUBE',
  'YOUR TAG': 'SUA TAG',
  // recent and saved profiles
  'Continue with': 'Continuar com',
  'Clear recent profiles': 'Limpar perfis recentes',
  'Saved profiles': 'Perfis salvos',
  'Clear all': 'Limpar tudo',
  'Remove {name} from favourites': 'Remover {name} dos favoritos',
  "Ranked Maps":
    "Mapas do Ranqueado",
  "Tools":
    "Ferramentas",
  "Draft":
    "Draft",
  "Leaderboard":
    "Ranking",
  "Power 11":
    "Poder 11",
  "Ranked":
    "Ranqueado",
  "Win streak":
    "Vitórias em série",
  "All findings":
    "Todas as descobertas",
  "BrawlZone Radar":
    "Radar do BrawlZone",
  "Discovered today":
    "Descoberto hoje",
  "Finding {v} of {count}":
    "Descoberta {v} de {count}",
  "Next finding":
    "Próxima descoberta",
  "Previous finding":
    "Descoberta anterior",
  "Things our own sampling turned up that no tier list would tell you.":
    "Coisas que a nossa própria amostragem encontrou e que nenhuma tier list contaria.",
  "Brawl Stars Wiki":
    "Brawl Stars Wiki",
  "Legacy":
    "Removido",
  "Win rate":
    "Taxa de vitória",
  "Brawlers":
    "Brawlers",
  "At peak":
    "No máximo",
  "Peak {highestTrophies}":
    "Máximo {highestTrophies}",
  "Power {power}":
    "Poder {power}",
  "Buffies":
    "Buffies",
  "Gadgets":
    "Acessórios",
  "Gears":
    "Engrenagens",
  "Star powers":
    "Poderes de estrela",
  "Compare":
    "Comparar",
  " of {length}":
    " de {length}",
  ", {legacy} withdrawn":
    ", {legacy} removidos",
  ", {upcoming} not released yet":
    ", {upcoming} ainda não lançados",
  "All":
    "Todos",
  "Clear filters":
    "Limpar filtros",
  "Clear search":
    "Limpar busca",
  "Filters":
    "Filtros",
  "Name A–Z":
    "Nome A–Z",
  "Newest first":
    "Mais novos primeiro",
  "No brawlers match those filters.":
    "Nenhum brawler corresponde a esses filtros.",
  "No longer available in the game. Kept for its history.":
    "Não está mais no jogo. Mantido pelo histórico.",
  "Rarest first":
    "Mais raros primeiro",
  "Release order":
    "Ordem de lançamento",
  "Revealed but not in the game yet.":
    "Anunciado, mas ainda não está no jogo.",
  "Search brawlers":
    "Buscar brawlers",
  "Search brawlers by name":
    "Buscar brawlers pelo nome",
  "Soon":
    "Em breve",
  "Sort":
    "Ordenar",
  "Strongest":
    "Mais fortes",
  "brawler":
    "brawler",
  "{tier} tier in Ranked{v}":
    "Tier {tier} no Ranqueado{v}",
  "· {playable} currently playable":
    "· {playable} jogáveis agora",
  "Best win streak {best}":
    "Melhor sequência de vitórias: {best}",
  "Filter brawlers":
    "Filtrar brawlers",
  "Filter brawlers by name":
    "Filtrar brawlers pelo nome",
  "Name":
    "Nome",
  "No brawlers match “{query}”.":
    "Nenhum brawler corresponde a “{query}”.",
  "Off peak":
    "Abaixo do máximo",
  "On {live} in a row; best {best}":
    "Está com {live} seguidas; melhor sequência {best}",
  "Power":
    "Poder",
  "Prestige {prestige}":
    "Prestígio {prestige}",
  "Rank":
    "Rank",
  "Rank {rank}":
    "Rank {rank}",
  "Show {hidden} more":
    "Mostrar mais {hidden}",
  "best {best}":
    "melhor {best}",
  "{live} in a row":
    "{live} seguidas",
  "{name}: not enough sampled battles to rate":
    "{name}: partidas insuficientes para avaliar",
  "{name}: {tier} tier on the trophy list, meta score {v}":
    "{name}: tier {tier} na lista de troféus, pontuação meta {v}",
  "−{gap} off peak":
    "−{gap} abaixo do máximo",
  "Choose a brawler":
    "Escolha um brawler",
  "No brawler matches “{query}”.":
    "Nenhum brawler corresponde a “{query}”.",
  "First brawler":
    "Primeiro brawler",
  "Second brawler":
    "Segundo brawler",
  "{decidedSampleSize} battles here":
    "{decidedSampleSize} partidas aqui",
  "All modes":
    "Todos os modos",
  "Clear":
    "Limpar",
  "{mapName} map layout":
    "Layout do mapa {mapName}",
  "Maps":
    "Mapas",
  "{length} maps":
    "{length} mapas",
  "map":
    "mapa",
  "maps":
    "mapas",
  " · thin":
    " · poucos dados",
  "At power 11":
    "No poder 11",
  "Every brawler":
    "Todos os brawlers",
  "None of the brawlers with a record on this map are in that list.":
    "Nenhum dos brawlers com resultado neste mapa está nessa lista.",
  "Show":
    "Mostrar",
  "no matchup data":
    "sem dados de confronto",
  "{name} owns":
    "Os de {name}",
  "{v} beside yours":
    "{v} ao lado dos seus",
  "{v} vs their picks":
    "{v} contra as escolhas deles",
  "Close map preview":
    "Fechar prévia do mapa",
  "Expand the {mapName} map layout":
    "Ampliar o layout do mapa {mapName}",
  "No map preview":
    "Sem prévia do mapa",
  "No map matches “{query}”.":
    "Nenhum mapa corresponde a “{query}”.",
  "Open the {v} page":
    "Abrir a página de {v}",
  "Search maps":
    "Buscar mapas",
  "Search {total} maps by name":
    "Buscar entre {total} mapas pelo nome",
  "matching “{query}”":
    "que correspondem a “{query}”",
  "and":
    "e",
  "Hypercharges":
    "Hipercargas",
  "Prestige":
    "Prestígio",
  "Skill score":
    "Pontuação de habilidade",
  "Trophies":
    "Troféus",
  "Show all {length}":
    "Mostrar todos os {length}",
  "Hypercharge":
    "Hipercarga",
  "Class":
    "Classe",
  "Rarity":
    "Raridade",
  "Tier":
    "Tier",
  "vs":
    "vs",
  "Unranked":
    "Sem rank",
  "main":
    "main",
  "Star player":
    "Craque",
  " · power {brawlerPower}":
    " · poder {brawlerPower}",
  "All results":
    "Todos os resultados",
  "By brawler":
    "Por brawler",
  "By mode":
    "Por modo",
  "Draws":
    "Empates",
  "Filter by mode":
    "Filtrar por modo",
  "Filter by result":
    "Filtrar por resultado",
  "Last {length} games":
    "Últimas {length} partidas",
  "Losses":
    "Derrotas",
  "No battles match that filter.":
    "Nenhuma partida corresponde a esse filtro.",
  "Star player ×{stars}":
    "Craque ×{stars}",
  "Team":
    "Time",
  "This battle reported no player list.":
    "Esta partida não trouxe a lista de jogadores.",
  "Unknown brawler":
    "Brawler desconhecido",
  "Wins":
    "Vitórias",
  "· mostly":
    "· principalmente",
  "Brawl Stars player comparison":
    "Comparação de jogadores de Brawl Stars",
  "Clear recent":
    "Limpar recentes",
  "Clear the comparison":
    "Limpar a comparação",
  "Clear {v}":
    "Limpar {v}",
  "Look a player up from the search box and they are remembered on this device, ready to pick here without typing the tag again. Nothing is sent to the server.":
    "Busque um jogador na caixa de busca e ele fica lembrado neste aparelho, pronto para escolher aqui sem digitar a tag de novo. Nada é enviado ao servidor.",
  "Looked up on this device":
    "Buscados neste aparelho",
  "Other side":
    "O outro lado",
  "Player 1":
    "Jogador 1",
  "Player 2":
    "Jogador 2",
  "Share":
    "Compartilhar",
  "Swap players":
    "Trocar jogadores",
  "Swap the two players":
    "Trocar os dois jogadores",
  ", so the real figure is this or better.":
    ", então o número real é este ou melhor.",
  "30 members’ rosters":
    "os brawlers dos 30 membros",
  "Club power":
    "Força do clube",
  "Every member's roster read against the current Ranked S and A tier — what this club can actually put on the field.":
    "Os brawlers de cada membro comparados com os tiers S e A atuais do Ranqueado: o que este clube realmente pode colocar em campo.",
  "No hypercharge in the club:":
    "Sem hipercarga no clube:",
  "Nobody can field:":
    "Ninguém pode usar:",
  "Rank this club":
    "Analisar este clube",
  "Ranked by hypercharged coverage of the top tier, then by what they can field at all. Trophies only break a tie — the game already sorts the member list that way.":
    "Ordenados por quantos dos melhores tiers têm com hipercarga, e depois pelos que podem usar. Os troféus só desempatam: o jogo já ordena a lista de membros assim.",
  "Reading rosters…":
    "Lendo os brawlers…",
  "Reads all":
    "Lê",
  "The game’s API only answered for {length} of":
    "A API do jogo só respondeu para {length} de",
  "can field":
    "pode usar",
  "could not be read":
    "não puderam ser lidos",
  "fieldable,":
    "disponíveis,",
  "hyper":
    "hiper",
  "hypercharged":
    "com hipercarga",
  "hypercharged.":
    "com hipercarga.",
  "live. It takes a few seconds, so it only runs when you ask.":
    "ao vivo. Leva alguns segundos, então só roda quando você pede.",
  "member":
    "membro",
  "members":
    "membros",
  "members, so this is incomplete and has not been saved.":
    "membros, então está incompleto e não foi salvo.",
  "of the {topTierSize} brawlers in the current Ranked S and A tier, for the typical member of {name}. Between all {length} of them:":
    "dos {topTierSize} brawlers dos tiers S e A atuais do Ranqueado, para o membro típico de {name}. Entre todos os {length}:",
  "only hypercharged":
    "só com hipercarga",
  "{coverage} fieldable · {powerEleven} at power 11 ·":
    "{coverage} disponíveis · {powerEleven} no poder 11 ·",
  "1 day ago":
    "há 1 dia",
  "Since your last visit":
    "Desde a sua última visita",
  "{days} days ago":
    "há {days} dias",
  "· kept in this browser only":
    "· guardado só neste navegador",
  "All countries":
    "Todos os países",
  "No country matches “{query}”.":
    "Nenhum país corresponde a “{query}”.",
  "Search countries":
    "Buscar países",
  "Link copied":
    "Link copiado",
  "Share this profile":
    "Compartilhar este perfil",
  "No members match that search.":
    "Nenhum membro corresponde a essa busca.",
  "Search club members":
    "Buscar membros do clube",
  "Search members by name or tag":
    "Buscar membros pelo nome ou tag",
  "This club has no members listed.":
    "Este clube não tem membros na lista.",
  "Profile sections":
    "Seções do perfil",
  "A 27-second tutorial: adding a player tag so brawlers you do not own are greyed out, turning on Hide unavailable brawlers, then opening the bubble mid-draft for the best picks on the map and the build to run.":
    "Um tutorial de 27 segundos: adicionar uma tag de jogador para os brawlers que você não tem ficarem cinza, ativar Esconder brawlers indisponíveis e depois abrir a bolha no meio do draft para ver os melhores brawlers do mapa e a build para usar.",
  "A Bounty draft on Hideout: the bubble opens the Ranked tier list, the filter narrows to that map, the panel shows Brock’s most-owned build, and Brock is then picked and given that star power.":
    "Um draft de Caça-Estrelas na Tocaia: a bolha abre a tier list do Ranqueado, o filtro se reduz a esse mapa, o painel mostra a build mais comum do Brock e depois o Brock é escolhido com esse poder de estrela.",
  "The BrawlZone panel open during a Bounty draft on Hideout, listing the brawlers measured best on that map":
    "O painel do BrawlZone aberto durante um draft de Caça-Estrelas na Tocaia, com os brawlers que rendem melhor nesse mapa",
  "Add it to your home screen":
    "Adicione à sua tela inicial",
  "Dismiss install prompt":
    "Fechar aviso de instalação",
  "Install":
    "Instalar",
  "Install BrawlZone":
    "Instalar o BrawlZone",
  "Back to search":
    "Voltar para a busca",
  "Something went wrong":
    "Algo deu errado",
  "This page could not be loaded. It is usually the game API being slow or rate-limited, which clears on its own — trying again often just works.":
    "Não foi possível carregar esta página. Normalmente é a API do jogo lenta ou limitando os pedidos, o que se resolve sozinho: tentar de novo costuma funcionar.",
  "Try again":
    "Tentar de novo",
  "Save":
    "Salvar",
  "Save to favourites":
    "Salvar nos favoritos",
  "Save {name} to favourites":
    "Salvar {name} nos favoritos",
  "Saved":
    "Salvo",
  "Saved. Click to remove":
    "Salvo. Clique para remover",
  "brawlers":
    "brawlers",
  "Overrated":
    "Superestimados",
  "Starr Drops":
    "Sorteios Starr",
  "Movement":
    "Movimento",
  "Released":
    "Lançamento",
  "Gadget":
    "Acessório",
  "News":
    "Notícias",
  "Star power":
    "Poder de estrela",
  "Daily":
    "Diário",
  "Cosmetics":
    "Cosméticos",
  "Played":
    "Jogados",
  " of ":
    " de ",
  "Copy share link":
    "Copiar link para compartilhar",
  "Every brawler is placed. Tap one in a row to send it back here.":
    "Todos os brawlers estão colocados. Toque num de uma linha para mandá-lo de volta para cá.",
  "Place the selected brawler in {tier} tier":
    "Colocar o brawler escolhido no tier {tier}",
  "Start from the live meta":
    "Começar com o meta atual",
  "placed":
    "colocados",
  "selected — now tap a tier to place it.":
    "escolhido: agora toque num tier para colocá-lo.",
  "{name}: tap to select, tap again to unrank":
    "{name}: toque para escolher, toque de novo para tirar",
  "{name}: tap to select, then tap a tier":
    "{name}: toque para escolher e depois toque num tier",
  ". Bubble size is the sample behind each point. Tap one for its numbers.":
    ". O tamanho de cada bolha é a amostra por trás dela. Toque numa para ver os números.",
  "Every rated brawler plotted by pick rate against meta score, over {windowDays} days":
    "Cada brawler pontuado, pela taxa de escolha e pela pontuação meta, em {windowDays} dias",
  "How often it is picked →":
    "Quanto é escolhido →",
  "How well it does →":
    "Quanto rende →",
  "Lit brawlers are the ones this account can field. It has":
    "Os brawlers acesos são os que esta conta pode usar. Ela tem",
  "Meta":
    "Meta",
  "Out of favour":
    "Fora do meta",
  "Sleepers":
    "Esquecidos",
  "in the meta corner":
    "no canto do meta",
  "picked · {sampleSize} battles":
    "de escolha · {sampleSize} partidas",
  "sleepers":
    "esquecidos",
  "strongest 30%":
    "os 30% mais fortes",
  "weakest 40%":
    "os 40% mais fracos",
  "win rate ·":
    "de vitórias ·",
  "{count} brawlers with enough ranked battles to rate over {windowDays} days. Bubble size is the sample behind each one, so the least certain points are the smallest. Tap one for its numbers.":
    "{count} brawlers com partidas ranqueadas suficientes para pontuar em {windowDays} dias. O tamanho de cada bolha é a amostra por trás dela, então os pontos menos certos são os menores. Toque num para ver os números.",
  "{haveMeta} of the {length}":
    "{haveMeta} dos {length}",
  "{haveSleepers} of the {length}":
    "{haveSleepers} dos {length}",
  "A new brawler at midnight UTC.":
    "Um brawler novo à meia-noite UTC.",
  "Average {v} guesses":
    "Média de {v} palpites",
  "Best":
    "Melhor",
  "Copied":
    "Copiado",
  "Copy result":
    "Copiar resultado",
  "Got it in {length}":
    "Acertou em {length}",
  "Guess a brawler":
    "Adivinhe um brawler",
  "Guess today’s brawler. Each guess shows how close you are on five clues — green is exact, amber is one step away, and an arrow points toward the answer.":
    "Adivinhe o brawler de hoje. Cada palpite mostra quão perto você está em cinco dicas: verde é exato, âmbar está a um passo, e uma seta aponta para a resposta.",
  "Guesses to solve":
    "Palpites para acertar",
  "Next brawler in":
    "Próximo brawler em",
  "Range":
    "Alcance",
  "Reload":
    "Recarga",
  "Revealed":
    "Revelado",
  "Streak":
    "Sequência",
  "Type a brawler name…":
    "Digite o nome de um brawler…",
  "Won":
    "Vencidos",
  "Yesterday was":
    "Ontem era",
  "guess":
    "palpite",
  "guesses":
    "palpites",
  "higher":
    "mais alto",
  "in {left} {v}":
    "em {left} {v}",
  "lower":
    "mais baixo",
  "Nothing matches “{query}”.":
    "Nada corresponde a “{query}”.",
  "Search by skin or brawler":
    "Buscar por visual ou brawler",
  "Search icons by number":
    "Buscar ícones pelo número",
  "Search profile icons":
    "Buscar ícones de perfil",
  "Search skins":
    "Buscar visuais",
  "of":
    "de",
  "{stats} first-guess solve":
    "{stats} acerto no primeiro palpite",
  "{stats} first-guess solves":
    "{stats} acertos no primeiro palpite",
  "Android app":
    "App para Android",
  "Big Brawler":
    "Todos contra Um",
  "Club":
    "Clube",
  "Coins":
    "Moedas",
  "Duo showdown":
    "Combate duplo",
  "Events":
    "Eventos",
  "Experience":
    "Experiência",
  "Players":
    "Jogadores",
  "Power points":
    "Pontos de poder",
  "President":
    "Presidente",
  "Robo Rumble":
    "Caos Cibernético",
  "Solo showdown":
    "Combate solitário",
  "Starr Drop":
    "Sorteio Starr",
  "Tier list":
    "Tier list",
  "Time played":
    "Tempo jogado",
  "Trophy gain":
    "Troféus ganhos",
  "App Store":
    "App Store",
  "Download on the":
    "Baixar na",
  "Download on the App Store":
    "Baixar na App Store",
  "GET IT ON":
    "DISPONÍVEL NO",
  "Get it on Google Play":
    "Disponível no Google Play",
  "Google Play":
    "Google Play",
  "Skins":
    "Visuais",
  "Buffie":
    "Buffie",
  "No preview":
    "Sem prévia",
  "3v3 wins":
    "Vitórias no 3v3",
  "Battles":
    "Partidas",
  "Daily challenge":
    "Desafio diário",
  "Release notes":
    "Notas de atualização",
  "Gear":
    "Engrenagem",
  "From {sampleSize} sampled battles.":
    "Com {sampleSize} partidas.",
  "See every matchup":
    "Ver todos os confrontos",
  "See the full record":
    "Ver o resultado completo",
  "See the map":
    "Ver o mapa",
  "See what changed":
    "Ver o que mudou",
  "See who else pairs well":
    "Ver com quem mais combina",
  "See why it underperforms":
    "Ver por que rende menos",
  "The giant killer":
    "O mata-gigantes",
  "The map surprise":
    "A surpresa do mapa",
  "The meta trap":
    "A armadilha do meta",
  "The overnight rise":
    "A subida da noite",
  "The secret duo":
    "A dupla secreta",
  "The secret pick":
    "A escolha secreta",
  "Almost nobody picks {name}. It is winning anyway.":
    "Quase ninguém escolhe {name}. E mesmo assim está ganhando.",
  "Could not check that guess.":
    "Não foi possível conferir esse palpite.",
  "Could not copy. Select the grid and copy it by hand.":
    "Não foi possível copiar. Selecione a grade e copie à mão.",
  "Could not reach the server. Try again.":
    "Não foi possível falar com o servidor. Tente de novo.",
  "Could not read this club right now.":
    "Não foi possível ler este clube agora.",
  "Meta score {from} to {to} in a single day, on enough battles for the move to be real rather than noise.":
    "Pontuação meta de {from} para {to} em um único dia, com partidas suficientes para a mudança ser real, e não ruído.",
  "Picked in {picks} of sampled battles and returning {rate} adjusted — below the average of the very players picking it.":
    "Escolhido em {picks} das partidas e com {rate} ajustado: abaixo da média dos próprios jogadores que o escolhem.",
  "Teamed up, {name} wins {rate} — {edge} better than it does otherwise. Neither is picked for the other.":
    "Juntos, {name} vence {rate}: {edge} a mais do que o normal. Nenhum dos dois é escolhido pensando no outro.",
  "That is not a current brawler.":
    "Esse não é um brawler atual.",
  "Too many scans at once. Give it a minute.":
    "Análises demais ao mesmo tempo. Espere um minuto.",
  "adjusted win rate":
    "taxa de vitória ajustada",
  "meta score, 1 day":
    "pontuação meta, 1 dia",
  "of all picks":
    "de todas as escolhas",
  "on {map}":
    "em {map}",
  "this map":
    "este mapa",
  "vs its usual form":
    "contra o nível normal",
  "when paired":
    "quando jogam juntos",
  "{name} and {other} belong together.":
    "{name} e {other} combinam.",
  "{name} climbed overnight.":
    "{name} subiu de um dia para o outro.",
  "{name} is a different brawler on {map}.":
    "{name} é outro brawler em {map}.",
  "{name} is everywhere, and losing.":
    "{name} está em todo lugar, e perdendo.",
  "{name} is picked constantly and losing.":
    "{name} é escolhido o tempo todo e está perdendo.",
  "{name} moved more than anything else since yesterday.":
    "{name} foi quem mais se moveu desde ontem.",
  "{name} owns {other}.":
    "{name} domina {other}.",
  "{rate} adjusted win rate on just {picks} of picks — one of the strongest records on the roster, from a brawler most drafts never consider.":
    "{rate} de vitórias ajustadas com só {picks} de escolha: um dos melhores resultados de todos os brawlers, de um brawler que quase nenhum draft considera.",
  "{rate} against {other} specifically, {edge} above {name}'s own record. The most lopsided matchup in the sample.":
    "{rate} contra {other} especificamente, {edge} acima do resultado próprio de {name}. O confronto mais desigual da amostra.",
  "{rate} here against {other} across every other map — the widest gap between a brawler and one piece of terrain.":
    "{rate} aqui contra {other} em todos os outros mapas: a maior diferença entre um brawler e um terreno.",
  "Common":
    "Comum",
  "Rare":
    "Raro",
  "Super Rare":
    "Super-raro",
  "Epic":
    "Épico",
  "Mythic":
    "Mítico",
  "Legendary":
    "Lendário",
  "Ultra Legendary":
    "Ultralendário",
  "Starting Brawler":
    "Brawler inicial",
  "Damage Dealer":
    "Destruidor",
  "Tank":
    "Tanque",
  "Marksman":
    "Tiro preciso",
  "Support":
    "Suporte",
  "Controller":
    "Controle",
  "Assassin":
    "Algoz",
  "Artillery":
    "Detonador",
  "Type a brawler, e.g. Shade":
    "Digite um brawler, ex.: Shade",
  "Brawler to counter":
    "Brawler para counterar",
  "Counters":
    "Counters",
  "No brawler by that name.":
    "Nenhum brawler com esse nome.",
  "A 51-second tour of BrawlZone Bubble: the bubble floating over Brawl Stars, the best picks for the exact map, the build owners run, the panel in your language, and the bubble’s size and fade settings.":
    "Um tour de 51 segundos pelo BrawlZone Bubble: a bolha flutuando sobre o Brawl Stars, as melhores escolhas para o mapa exato, a build que os jogadores usam, o painel no seu idioma e os ajustes de tamanho e transparência da bolha.",
  "Share as image":
    "Compartilhar como imagem",
  "Making your image…":
    "Criando sua imagem…",
  "Calculate":
    "Calcular",
  "Your player tag, e.g. #2PQ8LJ9V":
    "Sua tag de jogador, ex. #2PQ8LJ9V",
  "Compared with the Ranked tier list from the last 7 days of battles.":
    "Comparada com a tier list do Ranqueado dos últimos 7 dias de partidas.",
  "No disagreements: you see the meta exactly as the battles do.":
    "Sem discordâncias: você vê o meta exatamente como as partidas mostram.",
  "Save as image":
    "Salvar como imagem",
  "Your list matches the real data: {n}%":
    "Sua lista bate com os dados reais: {n}%",
  "you put it in {mine}, the data says {data}: you rate it higher":
    "você colocou em {mine}, os dados dizem {data}: você valoriza mais",
  "you put it in {mine}, the data says {data}: you rate it lower":
    "você colocou em {mine}, os dados dizem {data}: você valoriza menos",
  // YouTube card (2026-10-20)
  'The best Ranked picks, as 30-second Shorts': 'Os melhores picks do Ranqueado, em Shorts de 30 segundos',
  'A new one every few hours: counters, builds, best brawlers per map. Free on YouTube.':
    'Um novo a cada poucas horas: counters, builds e os melhores brawlers por mapa. Grátis no YouTube.',
  Subscribe: 'Inscrever-se',
  Later: 'Mais tarde',
  "Don't show again": 'Não mostrar de novo',
  "All three done!":
    "Os três resolvidos!",
  "Classic":
    "Clássico",
  "Every wrong guess zooms out a little.":
    "Cada palpite errado afasta um pouco a imagem.",
  "It was":
    "Era",
  "New puzzles in":
    "Novos desafios em",
  "Out of guesses.":
    "Sem palpites.",
  "Shadow":
    "Sombra",
  "Share your results":
    "Compartilhe seus resultados",
  "Today’s mystery brawler":
    "O brawler misterioso de hoje",
  "Zoom":
    "Zoom",
  "new":
    "novo",
  "playing":
    "jogando",
  "{n} guesses left":
    "restam {n} palpites",
  "{n} of 3 done":
    "{n} de 3 resolvidos",
  "{n}-day streak":
    "sequência de {n} dias",
  "Who is this, up close?":
    "Quem é, de perto?",
  "Whose shadow is this?":
    "De quem é essa sombra?",
  "average {n} guesses":
    "média de {n} palpites",
  "{n} players solved today’s Classic":
    "{n} jogadores resolveram o Clássico de hoje",
  "{pct}% of players solved today’s {mode}":
    "{pct}% dos jogadores resolveram o desafio {mode} de hoje",
  "Yesterday’s answers":
    "Respostas de ontem",
  "finish one puzzle today to keep it":
    "termine um desafio hoje para mantê-la",
  "A friend sent you: entering gives them +1 entry too.":
    "Um amigo te mandou: se você entrar, ele também ganha +1 entrada.",
  "Closed":
    "Encerrado",
  "Confirmed on Discord":
    "Confirmado no Discord",
  "Copy":
    "Copiar",
  "Enter for free":
    "Participar grátis",
  "Enter the giveaway":
    "Participe do sorteio",
  "Entered the giveaway":
    "Participando do sorteio",
  "Entering…":
    "Participando…",
  "Entries are closed.":
    "As participações estão encerradas.",
  "Free Brawl Stars giveaway: win a €10 gift card for the Brawl Pass. Enter here:":
    "Sorteio grátis de Brawl Stars: ganhe um gift card de 10 € para o Brawl Pass. Participe aqui:",
  "Friends who entered with your link: {n} of {max}":
    "Amigos que entraram com o seu link: {n} de {max}",
  "I am 13 or older (under 18: a parent knows I am entering) and I accept the":
    "Tenho 13 anos ou mais (se tenho menos de 18, meu responsável sabe que estou participando) e aceito as",
  "Join our Discord and type /giveaway {code}":
    "Entre no nosso Discord e digite /giveaway {code}",
  "Keep this page: it is saved in this browser, and the link with your code always shows it.":
    "Guarde esta página: ela fica salva neste navegador, e o link com o seu código sempre mostra ela.",
  "Open Discord":
    "Abrir Discord",
  "Send on WhatsApp":
    "Enviar no WhatsApp",
  "You are in, {name}!":
    "Você está dentro, {name}!",
  "Your code":
    "Seu código",
  "Your email, only to tell you if you win":
    "Seu email, só para avisar se você ganhar",
  "Your friend link: +1 entry for every friend who enters with it":
    "Seu link para amigos: +1 entrada para cada amigo que entrar com ele",
  "Your player tag":
    "Sua tag de jogador",
  "entries":
    "entradas",
  "entry":
    "entrada",
  "giveaway rules":
    "regras do sorteio",
  "Tick the box to confirm your age and the rules.":
    "Marque a caixa para confirmar sua idade e as regras.",
  "That email does not look right.":
    "Esse email não parece certo.",
  "No Brawl Stars account has that tag. Check it under your name in game.":
    "Nenhuma conta de Brawl Stars tem essa tag. Confira embaixo do seu nome no jogo.",
  "This tag is already entered. Lost your page? Write to contact@brawlzone.net.":
    "Esta tag já está participando. Perdeu sua página? Escreva para contact@brawlzone.net.",
  "This email is already entered. One entry per person.":
    "Este email já está participando. Uma participação por pessoa.",
  "Too many entries from this network today. Try again tomorrow.":
    "Participações demais desta rede hoje. Tente amanhã.",
  "Something went wrong on our side. Try again in a minute.":
    "Algo deu errado do nosso lado. Tente de novo em um minuto.",
};
