/* eslint-disable */
/**
 * Merges a batch of translations into the dictionaries.
 *
 *   node scripts/i18n-merge.cjs batch.json [more.json...]
 *
 * A batch is {"English": {"es": "...", "pt": "...", ...}} with every language in
 * INTL_LOCALES: an entry missing one is refused, because new text ships in
 * every live language or not at all (owner, 2026-11-04). Each entry goes to
 * the server dictionaries, and to the client ones too when a client component
 * uses it (per `scripts/missing.json` from i18n-keys). Placeholders must match,
 * or the entry is refused: a dropped {n} would print a sentence missing its number.
 */
const fs = require('fs');
const missing = JSON.parse(fs.readFileSync('scripts/missing.json', 'utf8'));
const clientKeys = new Set(Object.values(missing.client).flat());
const ph = (s) => (s.match(/\{\w+\}/g) || []).sort().join(',');
const LANGS = JSON.parse(fs.readFileSync('src/lib/i18n.ts', 'utf8').match(/INTL_LOCALES = (\[[^\]]*\])/)[1].replace(/'/g, '"'));

function append(file, constName, entries) {
  if (!entries.length) return;
  let src = fs.readFileSync(file, 'utf8');
  const start = src.indexOf(`export const ${constName}`);
  const close = src.indexOf('\n};', start);
  const body = entries.map(([k, v]) => `  ${JSON.stringify(k)}:\n    ${JSON.stringify(v)},`).join('\n');
  src = src.slice(0, close) + '\n' + body + src.slice(close);
  fs.writeFileSync(file, src);
}
const serverFile = (l) => `src/i18n/${l}.ts`, clientFile = (l) => `src/i18n/client/${l}.ts`;
const has = Object.fromEntries(LANGS.map((l) => [l, { server: fs.readFileSync(serverFile(l), 'utf8'), client: fs.readFileSync(clientFile(l), 'utf8') }]));
const add = Object.fromEntries(LANGS.map((l) => [l, { server: [], client: [] }]));
let n = 0, bad = 0;
for (const f of process.argv.slice(2)) {
  const batch = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const [en, tr] of Object.entries(batch)) {
    const gap = LANGS.find((l) => typeof tr[l] !== 'string' || ph(en) !== ph(tr[l]));
    if (gap) { console.log(`REFUSED (${gap}: missing or placeholders differ): ${en}`); bad++; continue; }
    const key = `  ${JSON.stringify(en)}:`;
    for (const l of LANGS) {
      if (!has[l].server.includes(key)) add[l].server.push([en, tr[l]]);
      if (clientKeys.has(en) && !has[l].client.includes(key)) add[l].client.push([en, tr[l]]);
    }
    n++;
  }
}
for (const l of LANGS) {
  append(serverFile(l), l.toUpperCase(), add[l].server);
  append(clientFile(l), `CLIENT_${l.toUpperCase()}`, add[l].client);
}
console.log(`merged ${n} into ${LANGS.join(', ')}, refused ${bad}`);
