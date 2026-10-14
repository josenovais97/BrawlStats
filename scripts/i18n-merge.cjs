/* eslint-disable */
/**
 * Merges a batch of translations into the dictionaries.
 *
 *   node scripts/i18n-merge.cjs batch.json [more.json...]
 *
 * A batch is {"English": ["Spanish", "Portuguese"]}. Each entry goes to the
 * server dictionaries, and to the client one too when a client component uses
 * it (per `scripts/missing.json` from i18n-keys). Placeholders must match, or
 * the entry is refused: a dropped {n} would print a sentence missing its number.
 */
const fs = require('fs');
const missing = JSON.parse(fs.readFileSync('scripts/missing.json', 'utf8'));
const clientKeys = new Set(Object.values(missing.client).flat());
const ph = (s) => (s.match(/\{\w+\}/g) || []).sort().join(',');

function append(file, constName, entries) {
  if (!entries.length) return;
  let src = fs.readFileSync(file, 'utf8');
  const start = src.indexOf(`export const ${constName}`);
  const close = src.indexOf('\n};', start);
  const body = entries.map(([k, v]) => `  ${JSON.stringify(k)}:\n    ${JSON.stringify(v)},`).join('\n');
  src = src.slice(0, close) + '\n' + body + src.slice(close);
  fs.writeFileSync(file, src);
}
const existing = (file) => fs.readFileSync(file, 'utf8');
let n = 0, bad = 0;
const es = [], pt = [], ces = [], cpt = [];
const serverSrc = existing('src/i18n/es.ts'), clientSrc = existing('src/i18n/client.ts');
for (const f of process.argv.slice(2)) {
  const batch = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const [en, [esT, ptT]] of Object.entries(batch)) {
    if (ph(en) !== ph(esT) || ph(en) !== ph(ptT)) { console.log(`REFUSED (placeholders): ${en}`); bad++; continue; }
    const key = `  ${JSON.stringify(en)}:`;
    if (!serverSrc.includes(key)) { es.push([en, esT]); pt.push([en, ptT]); }
    if (clientKeys.has(en) && !clientSrc.includes(key)) { ces.push([en, esT]); cpt.push([en, ptT]); }
    n++;
  }
}
append('src/i18n/es.ts', 'ES', es);
append('src/i18n/pt.ts', 'PT', pt);
append('src/i18n/client.ts', 'CLIENT_ES', ces);
append('src/i18n/client.ts', 'CLIENT_PT', cpt);
console.log(`merged ${n} (${es.length} server, ${ces.length} client), refused ${bad}`);
