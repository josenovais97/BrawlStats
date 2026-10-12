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
  'update.fallback': 'Si no pasa nada, abre {url} en tu navegador. El archivo lleva su número de versión, así puedes revisar qué instalas.',
};

export default es419;
