/* eslint-disable */
/**
 * One-off codemod behind the site's translation (2026-10-13). Not part of the
 * build; kept for the pages still to come.
 *
 *   node scripts/i18n-codemod.cjs <file.tsx>...
 *
 * In each file it wraps visible English in `t(...)` and every internal link in
 * `lp(...)` (the link in the page's language), then declares `t` / `lp` at the
 * top of each component that needs them:
 *
 * - JSX text. Runs of text and plain `{expressions}` between elements become
 *   one sentence with `{placeholders}`, so word order can change per language.
 * - String and template props that people read (title, alt, aria-label...).
 * - Strings in object literals under keys like title / description / label,
 *   inside functions (module-level ones are listed for hand-editing).
 * - String branches of `cond ? 'a' : 'b'` and `x || 'a'` inside JSX.
 * - `href` props and `router.push(...)`.
 *
 * Server files get `getT(requestLocale())`, client files `useT()` /
 * `useLocale()`. Anything it cannot place is printed as TODO.
 */
const fs = require('fs');
const ts = require('typescript');

const ATTRS = new Set([
  'title', 'alt', 'aria-label', 'placeholder', 'label', 'eyebrow', 'subtitle', 'ctaLabel', 'cta', 'body',
  'heading', 'summary', 'emptyLabel', 'description', 'caption', 'hint', 'tooltip', 'message', 'text', 'detail',
  'note', 'question', 'answer', 'sublabel', 'kicker', 'empty', 'unit', 'suffix', 'prefix', 'footnote', 'lead',
  'name', 'tagline', 'badge',
]);
const KEYS = new Set([
  'title', 'body', 'label', 'heading', 'question', 'answer', 'description', 'hint', 'cta', 'subtitle', 'eyebrow',
  'detail', 'summary', 'caption', 'note', 'sublabel', 'text', 'blurb', 'tagline', 'emptyLabel', 'kicker', 'lead',
  'tooltip', 'unit', 'verdict', 'reason', 'headline', 'message', 'badge', 'ctaLabel', 'footnote',
]);
const ENTITIES = {
  '&apos;': "'", '&quot;': '"', '&mdash;': '—', '&ndash;': '–', '&rsquo;': '’', '&lsquo;': '‘', '&ldquo;': '“',
  '&rdquo;': '”', '&nbsp;': ' ', '&amp;': '&', '&hellip;': '…', '&middot;': '·', '&times;': '×', '&larr;': '←',
  '&rarr;': '→', '&gt;': '>', '&lt;': '<', '&minus;': '−', '&deg;': '°', '&#39;': "'", '&check;': '✓', '&uarr;': '↑',
  '&darr;': '↓', '&le;': '≤', '&ge;': '≥', '&plusmn;': '±', '&bull;': '•', '&trade;': '™', '&copy;': '©',
};
const decode = (s) => s.replace(/&[a-z#0-9]+;/gi, (e) => ENTITIES[e] ?? e);
const hasWords = (s) => /\p{L}{2,}/u.test(s);
const q = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;

/** JSX's own whitespace rule for a text node. */
function jsxText(raw) {
  const lines = raw.split(/\r\n|\n|\r/);
  const out = [];
  lines.forEach((line, i) => {
    let l = line.replace(/\t/g, ' ');
    if (i !== 0) l = l.replace(/^ +/, '');
    if (i !== lines.length - 1) l = l.replace(/ +$/, '');
    if (l) out.push(l);
  });
  return decode(out.join(' '));
}

function placeholderName(expr, sf, used) {
  let e = expr;
  for (let i = 0; i < 4; i++) {
    if (ts.isParenthesizedExpression(e) || ts.isNonNullExpression(e) || ts.isAsExpression(e)) e = e.expression;
    else if (ts.isCallExpression(e) && e.arguments.length) e = e.arguments[0];
    else break;
  }
  let name = ts.isIdentifier(e) ? e.text : ts.isPropertyAccessExpression(e) ? e.name.text : null;
  if (!name || !/^[A-Za-z_]\w*$/.test(name)) name = 'v';
  let n = name, k = 2;
  while (used.has(n)) n = `${name}${k++}`;
  used.add(n);
  return n;
}

function processFile(file) {
  const src = fs.readFileSync(file, 'utf8');
  const isClient = /^\s*['"]use client['"]/.test(src);
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = []; // {start, end, text}
  const todo = [];
  const needT = new Set(); // function nodes
  const needLp = new Set();

  // Names already bound in the file, to avoid shadowing.
  const bound = new Set();
  (function scan(n) {
    if ((ts.isParameter(n) || ts.isVariableDeclaration(n) || ts.isBindingElement(n)) && ts.isIdentifier(n.name)) bound.add(n.name.text);
    ts.forEachChild(n, scan);
  })(sf);
  const T = bound.has('t') ? 'tx' : 't';
  const LP = bound.has('lp') ? 'lpx' : 'lp';

  /** The outermost function enclosing a node: where `t` gets declared. */
  function host(node) {
    let fn = null;
    for (let p = node.parent; p; p = p.parent) {
      if (ts.isFunctionDeclaration(p) || ts.isArrowFunction(p) || ts.isFunctionExpression(p) || ts.isMethodDeclaration(p)) fn = p;
    }
    return fn;
  }
  function claim(node, set, what) {
    const fn = host(node);
    if (!fn) {
      todo.push(`${file}:${sf.getLineAndCharacterOfPosition(node.getStart()).line + 1} module-level ${what}: ${node.getText().slice(0, 70)}`);
      return false;
    }
    if (!ts.isBlock(fn.body)) {
      todo.push(`${file}:${sf.getLineAndCharacterOfPosition(node.getStart()).line + 1} expression-bodied function, add ${what} by hand`);
      return false;
    }
    if (isClient) {
      const name = fn.name?.text ?? (ts.isVariableDeclaration(fn.parent) ? fn.parent.name.getText() : '');
      if (!/^[A-Z]/.test(name) && !/^use[A-Z]/.test(name)) {
        todo.push(`${file}:${sf.getLineAndCharacterOfPosition(node.getStart()).line + 1} client helper ${name || '(anonymous)'} needs ${what} passed in`);
        return false;
      }
    }
    set.add(fn);
    return true;
  }

  /** A string-ish expression as a t() call, or null if it has no words. */
  function tCall(expr) {
    if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
      return hasWords(expr.text) ? `${T}(${q(expr.text)})` : null;
    }
    if (ts.isTemplateExpression(expr)) {
      const used = new Set();
      let key = expr.head.text;
      const vars = [];
      for (const span of expr.templateSpans) {
        const name = placeholderName(span.expression, sf, used);
        vars.push(`${name}: ${span.expression.getText()}`);
        key += `{${name}}` + span.literal.text;
      }
      if (!hasWords(key.replace(/\{\w+\}/g, ''))) return null;
      return `${T}(${q(key)}, { ${vars.join(', ')} })`;
    }
    return null;
  }

  /** Wrap string branches of a JSX expression. */
  function wrapBranches(expr) {
    if (!expr) return;
    if (ts.isParenthesizedExpression(expr)) return wrapBranches(expr.expression);
    if (ts.isConditionalExpression(expr)) { wrapBranches(expr.whenTrue); wrapBranches(expr.whenFalse); return; }
    if (ts.isBinaryExpression(expr) && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.AmpersandAmpersandToken].includes(expr.operatorToken.kind)) {
      if (expr.operatorToken.kind !== ts.SyntaxKind.AmpersandAmpersandToken) wrapBranches(expr.left);
      wrapBranches(expr.right);
      return;
    }
    const call = tCall(expr);
    if (call && claim(expr, needT, 't')) edits.push({ start: expr.getStart(), end: expr.getEnd(), text: call });
  }

  const containsJsx = (n) => {
    let found = false;
    (function walk(x) { if (found) return; if (ts.isJsxElement(x) || ts.isJsxSelfClosingElement(x) || ts.isJsxFragment(x)) { found = true; return; } ts.forEachChild(x, walk); })(n);
    return found;
  };
  const isTCall = (e) => ts.isCallExpression(e) && ts.isIdentifier(e.expression) && [T, 'useT'].includes(e.expression.text);

  /** Children of an element: runs of text + simple expressions -> one sentence. */
  function children(list) {
    const inline = (c) =>
      ts.isJsxText(c) ||
      (ts.isJsxExpression(c) && c.expression && !containsJsx(c.expression) && !isTCall(c.expression) &&
        !ts.isConditionalExpression(c.expression) && !ts.isBinaryExpression(c.expression) &&
        !ts.isStringLiteral(c.expression) && !ts.isArrowFunction(c.expression));
    let run = [];
    const flush = () => {
      // Expressions at either end stay where they are: only text anchors a sentence.
      while (run.length && !ts.isJsxText(run[0])) run.shift();
      while (run.length && !ts.isJsxText(run[run.length - 1])) run.pop();
      const r = run;
      run = [];
      if (!r.some((c) => ts.isJsxText(c) && hasWords(jsxText(c.text)))) return;
      const used = new Set();
      let key = '';
      const vars = [];
      for (const c of r) {
        if (ts.isJsxText(c)) key += jsxText(c.text);
        else {
          const name = placeholderName(c.expression, sf, used);
          vars.push(`${name}: ${c.expression.getText()}`);
          key += `{${name}}`;
        }
      }
      const lead = key.startsWith(' ');
      const trail = key.endsWith(' ') && key.trim() !== '';
      const core = key.trim();
      const call = vars.length ? `${T}(${q(core)}, { ${vars.join(', ')} })` : `${T}(${q(core)})`;
      if (!claim(r[0], needT, 't')) return;
      edits.push({
        start: r[0].pos,
        end: r[r.length - 1].end,
        text: `${lead ? "{' '}" : ''}{${call}}${trail ? "{' '}" : ''}`,
      });
    };
    for (const c of list) {
      if (inline(c)) run.push(c);
      else {
        flush();
        if (ts.isJsxExpression(c) && c.expression) wrapBranches(c.expression);
      }
    }
    flush();
  }

  /** `{title}` / `{item.label}` where the name says it is text: translate by value. */
  const textName = (e) => {
    const name = ts.isIdentifier(e) ? e.text : ts.isPropertyAccessExpression(e) ? e.name.text : null;
    return name && (KEYS.has(name) || name === 'name' && false) ? name : null;
  };
  function wrapValue(expr) {
    if (textName(expr) && claim(expr, needT, 't')) edits.push({ start: expr.getStart(), end: expr.getEnd(), text: `${T}(${expr.getText()})` });
  }

  function visit(n) {
    if (ts.isJsxExpression(n) && n.expression && (ts.isJsxElement(n.parent) || ts.isJsxFragment(n.parent)
      || (ts.isJsxAttribute(n.parent) && ATTRS.has(n.parent.name.getText())))) {
      wrapValue(n.expression);
    }
    if (ts.isJsxElement(n) || ts.isJsxFragment(n)) {
      children([...n.children]);
    }
    if (ts.isJsxAttribute(n)) {
      const name = n.name.getText();
      const init = n.initializer;
      if (name === 'href' && init) {
        if (ts.isStringLiteral(init)) {
          if (init.text.startsWith('/') && claim(n, needLp, 'lp')) edits.push({ start: init.getStart(), end: init.getEnd(), text: `{${LP}(${q(init.text)})}` });
        } else if (ts.isJsxExpression(init) && init.expression) {
          const e = init.expression;
          const txt = e.getText();
          const external = (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) && !e.text.startsWith('/');
          const already = /^(lp|lpx|localePath|href)\(/.test(txt);
          const constLike = /_URL$|^(https?|mailto)/.test(txt) || /URL\b/.test(txt);
          if (!external && !already && !constLike && !ts.isObjectLiteralExpression(e) && claim(n, needLp, 'lp')) {
            edits.push({ start: e.getStart(), end: e.getEnd(), text: `${LP}(${txt})` });
          }
        }
      } else if (ATTRS.has(name) && init) {
        if (ts.isStringLiteral(init)) {
          if (hasWords(init.text) && claim(n, needT, 't')) edits.push({ start: init.getStart(), end: init.getEnd(), text: `{${T}(${q(decode(init.text))})}` });
        } else if (ts.isJsxExpression(init) && init.expression) {
          wrapBranches(init.expression);
        }
      }
    }
    if (ts.isPropertyAssignment(n) && KEYS.has(n.name.getText().replace(/['"]/g, ''))) {
      const call = tCall(n.initializer);
      if (call) {
        if (host(n)) { if (claim(n, needT, 't')) edits.push({ start: n.initializer.getStart(), end: n.initializer.getEnd(), text: call }); }
        else todo.push(`${file}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1} module-level string: ${n.getText().slice(0, 90)}`);
      } else if (ts.isConditionalExpression(n.initializer) && host(n)) {
        wrapBranches(n.initializer);
      }
    }
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'push'
      && /router/i.test(n.expression.expression.getText()) && n.arguments[0] && !/^lp/.test(n.arguments[0].getText())) {
      if (claim(n, needLp, 'lp')) edits.push({ start: n.arguments[0].getStart(), end: n.arguments[0].getEnd(), text: `${LP}(${n.arguments[0].getText()})` });
    }
    ts.forEachChild(n, visit);
  }
  visit(sf);

  // Declarations at the top of each host function.
  for (const fn of new Set([...needT, ...needLp])) {
    const lines = [];
    if (isClient) {
      if (needT.has(fn)) lines.push(`const ${T} = useT();`);
      if (needLp.has(fn)) lines.push(`const ${LP} = useLp();`);
    } else {
      if (needT.has(fn)) lines.push(`const ${T} = getT(requestLocale());`);
      if (needLp.has(fn)) lines.push(`const ${LP} = (path: string) => localePath(requestLocale(), path);`);
    }
    const at = fn.body.getStart() + 1;
    edits.push({ start: at, end: at, text: `\n  ${lines.join('\n  ')}` });
  }

  if (!edits.length) return { file, changed: false, todo };

  // Apply back to front; drop edits nested inside a larger one.
  edits.sort((a, b) => a.start - b.start || b.end - a.end);
  const kept = [];
  for (const e of edits) {
    const parent = kept.find((k) => k.start <= e.start && e.end <= k.end && k.end > k.start && !(k.start === e.start && k.end === e.end && k.text === e.text));
    if (parent && parent.end > parent.start && e.end > e.start) continue;
    if (kept.some((k) => k.start === e.start && k.end === e.end && k.text === e.text)) continue;
    kept.push(e);
  }
  let out = src;
  for (const e of kept.sort((a, b) => b.start - a.start || b.end - a.end)) out = out.slice(0, e.start) + e.text + out.slice(e.end);

  // Imports.
  const imports = [];
  if (isClient) {
    if (needT.size && !/from '@\/components\/i18n\/use-t'/.test(out)) imports.push(`import { useT } from '@/components/i18n/use-t';`);
    if (needLp.size && !/useLp/.test(src)) imports.push(`import { useLp } from '@/components/i18n/use-lp';`);
  } else {
    if (needT.size && !/from '@\/lib\/t'/.test(out)) imports.push(`import { getT } from '@/lib/t';`);
    if (needLp.size && !/import \{[^}]*localePath/.test(out)) imports.push(`import { localePath } from '@/lib/i18n';`);
    if ((needT.size || needLp.size) && !/from '@\/lib\/request-locale'/.test(out)) imports.push(`import { requestLocale } from '@/lib/request-locale';`);
  }
  if (imports.length) {
    const sf2 = ts.createSourceFile(file, out, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const lastImport = sf2.statements.filter(ts.isImportDeclaration).pop();
    const pos = lastImport ? lastImport.getEnd() : (out.match(/^\s*['"]use client['"];?\s*\n/)?.[0].length ?? 0);
    out = out.slice(0, pos) + '\n' + imports.join('\n') + out.slice(pos);
  }
  fs.writeFileSync(file, out);
  return { file, changed: true, todo, t: needT.size, lp: needLp.size };
}

const results = process.argv.slice(2).map(processFile);
for (const r of results) {
  if (r.changed) console.log(`ok ${r.file} (t in ${r.t}, lp in ${r.lp})`);
  for (const line of r.todo) console.log(`TODO ${line}`);
}
