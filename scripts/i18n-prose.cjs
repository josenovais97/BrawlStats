/* eslint-disable */
/**
 * Strings that read like prose, in files that translate, with no dictionary
 * entry yet -- the ones `i18n-keys` cannot see because they are not a `t()`
 * argument (array items, values passed through helpers). For review, not for
 * blind merging: some are data, ids or class names.
 *
 *   node scripts/i18n-prose.cjs [--json out]
 */
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (!['i18n', '[lang]', 'api'].includes(e.name)) walk(p); }
    else if (/\.tsx?$/.test(e.name)) files.push(p);
  }
})('src');
const run = (p) => { const exports = {}; new Function('exports', fs.readFileSync(p, 'utf8').replace(/export const (\w+)[^=]*=/g, 'exports.$1 =').replace(/^import.*$/gm, ''))(exports); return exports; };
const { ES } = run('src/i18n/es.ts');
const { CLIENT_ES } = run('src/i18n/client.ts');
const out = {};
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  if (!/\b(t|tx)\(/.test(src) && !/getUT|getT|useT/.test(src)) continue;
  if (/panel|bubble-ui|slides|opengraph|-og\.tsx|discord|tiktok/.test(f)) continue;
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  (function visit(n) {
    if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && !ts.isImportDeclaration(n.parent) && !ts.isExportDeclaration(n.parent)) {
      const s = n.text;
      const p = n.parent;
      const attr = p && ts.isJsxAttribute(p) ? p.name.getText() : p && ts.isPropertyAssignment(p) ? p.name.getText() : '';
      const inT = p && ts.isCallExpression(p) && /^(t|tx)$/.test(p.expression.getText());
      const words = s.match(/[A-Za-z’']+/g) || [];
      if (!inT && !/class|href|src|key|id|type|mode|slug|kind|tone|variant|rel|target|icon|color/i.test(attr)
        && words.length >= 3 && /^[A-Z“"‘(]/.test(s) && !/^[a-z-]+( [a-z-:/[\]0-9.]+)+$/.test(s)
        && !(s in ES) && !(s in CLIENT_ES)) (out[f] ??= []).push(s);
    }
    ts.forEachChild(n, visit);
  })(sf);
}
const i = process.argv.indexOf('--json');
if (i > 0) fs.writeFileSync(process.argv[i + 1], JSON.stringify(out, null, 1));
let n = 0; for (const [f, list] of Object.entries(out)) { n += list.length; console.log(`${list.length}\t${f}`); }
console.log('total', n);
