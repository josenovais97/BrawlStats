import type { UiStrings } from '@/lib/bubble-ui-en';
import es from '@/lib/bubble-ui/es';

/** Latin American Spanish: Castilian with the regional words swapped in. */
const es419: UiStrings = {
  ...es,
  'lang.hint': 'Elige el idioma de tu juego para que los nombres de mapas y brawlers coincidan.',
  'account.noTag': 'Agrega tu ID de jugador en la app BrawlZone y este panel marcará los brawlers que tienes.',
  'draft.addBans': 'Agregar un bloqueo…',
  'draft.addAllies': 'Agregar a tu equipo…',
  'draft.addEnemies': 'Agregar un rival…',
  'meta.vsUsual': '{n} vs lo habitual',
  'comps.vsAvg': '{n} vs promedio',
  'playTest.body': 'La misma app, actualizada por Google Play, y nos ayudas a lanzarla. Play la instala encima de esta y conserva tu tag.',
  'update.fallback': 'Si no pasa nada, abre {url} en tu navegador. El archivo lleva su número de versión, así puedes revisar qué instalas.',
  'bracket.title': 'Tu rango',
  'bracket.all': 'Todos los rangos',
  'bracket.thin': 'Aún no hay suficientes combates de {rank} en este modo: se muestran todos los rangos.',
  'bracket.mapsAllRanks': 'Las elecciones por mapa cuentan todos los rangos: un solo rango tiene muy pocos combates por mapa.',
};

export default es419;
