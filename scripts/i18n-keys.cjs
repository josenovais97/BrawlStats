/* eslint-disable */
/**
 * Lists every sentence the site passes to `t` that a dictionary lacks.
 *
 *   node scripts/i18n-keys.cjs            -> counts
 *   node scripts/i18n-keys.cjs --json out  -> {server: [...], client: [...]}
 *
 * A key is the first argument of `t(...)` / `tx(...)` when it is a literal,
 * plus text-named strings (title, body, label...) defined at module level in
 * files that translate by value, plus every page's static metadata. Client
 * files' keys belong in `i18n/client.ts`, the rest in `i18n/es.ts` / `pt.ts`.
 */
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const KEYS = new Set(['title', 'body', 'label', 'heading', 'question', 'answer', 'description', 'hint', 'cta', 'subtitle', 'eyebrow', 'detail', 'summary', 'caption', 'note', 'sublabel', 'text', 'blurb', 'tagline', 'emptyLabel', 'kicker', 'lead', 'tooltip', 'unit', 'verdict', 'reason', 'headline', 'message', 'badge', 'ctaLabel', 'footnote']);
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.tsx?$/.test(e.name)) files.push(p);
  }
})('src');

const server = new Set(), client = new Set();
const where = new Map();
for (const f of files) {
  if (f.includes('/i18n/') && !f.endsWith('.tsx')) continue;
  const src = fs.readFileSync(f, 'utf8');
  const usesT = /\b(t|tx)\(/.test(src);
  const isPage = /\/page\.tsx$/.test(f) && !f.includes('[lang]');
  if (!usesT && !isPage) continue;
  const isClient = /^\s*['"]use client['"]/.test(src) || src.includes("@/lib/t-universal");
  const bucket = isClient ? client : server;
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const inFn = (n) => { for (let p = n.parent; p; p = p.parent) if (ts.isFunctionLike(p)) return true; return false; };
  (function visit(n) {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && ['t', 'tx'].includes(n.expression.text) && n.arguments[0]) {
      const add = (x) => {
        if (ts.isParenthesizedExpression(x)) return add(x.expression);
        if (ts.isConditionalExpression(x)) { add(x.whenTrue); add(x.whenFalse); return; }
        if (ts.isStringLiteral(x) || ts.isNoSubstitutionTemplateLiteral(x)) { bucket.add(x.text); if (!where.has(x.text)) where.set(x.text, f); }
      };
      add(n.arguments[0]);
    }
    if (ts.isPropertyAssignment(n) && !inFn(n) && (ts.isStringLiteral(n.initializer) || ts.isNoSubstitutionTemplateLiteral(n.initializer))) {
      const k = n.name.getText().replace(/['"]/g, '');
      if ((usesT && KEYS.has(k)) || (isPage && ['title', 'description', 'absolute'].includes(k))) {
        if (/\p{L}{2,}/u.test(n.initializer.text)) { bucket.add(n.initializer.text); if (!where.has(n.initializer.text)) where.set(n.initializer.text, f); }
      }
    }
    ts.forEachChild(n, visit);
  })(sf);
}
const load = (p, name) => {
  const src = fs.readFileSync(p, 'utf8');
  const m = new Function(src.replace(/export const (\w+)[^=]*=/g, 'exports.$1 =').replace(/^import.*$/gm, '') + '; return exports;');
  return m.call(null, {}) ;
};
const run = (p) => { const exports = {}; new Function('exports', fs.readFileSync(p, 'utf8').replace(/export const (\w+)[^=]*=/g, 'exports.$1 =').replace(/^import.*$/gm, ''))(exports); return exports; };
const { ES } = run('src/i18n/es.ts');
const { PT } = run('src/i18n/pt.ts');
const { CLIENT_ES, CLIENT_PT } = run('src/i18n/client.ts');
const missing = {
  server: [...server].filter((k) => !(k in ES) || !(k in PT)).sort(),
  client: [...client].filter((k) => !(k in CLIENT_ES) || !(k in CLIENT_PT)).sort(),
};
const i = process.argv.indexOf('--json');
if (i > 0) {
  const group = (keys) => { const g = {}; for (const k of keys) (g[where.get(k) || '?'] ??= []).push(k); return g; };
  fs.writeFileSync(process.argv[i + 1], JSON.stringify({ server: group(missing.server), client: group(missing.client) }, null, 1));
}
console.log(`server keys ${server.size}, missing ${missing.server.length}; client keys ${client.size}, missing ${missing.client.length}`);
console.log('words to translate:', [...missing.server, ...missing.client].join(' ').split(/\s+/).length);
