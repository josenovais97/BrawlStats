"""Builds src/i18n/<lang>.ts from i18n-work/<lang>/c<offset>.json batches (2026-11-04).

Each batch is a JSON list of translations for keys[offset:offset+len], in the
order of keys.json (the English keys of src/i18n/es.ts). Placeholders must
match the key's. Work files only: delete i18n-work/ once the language ships.
"""
import json, re, sys, glob, os
lang, const, header = sys.argv[1], sys.argv[2], sys.argv[3]
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
work = os.path.join(root, 'i18n-work', lang)
keys = json.load(open(os.path.join(work, 'keys.json')))
ph = lambda s: sorted(re.findall(r'\{[a-zA-Z0-9_]+\}', s))
out = {}
for f in sorted(glob.glob(os.path.join(work, 'c[0-9]*.json'))):
    off = int(os.path.basename(f)[1:-5])
    for i, t in enumerate(json.load(open(f))):
        k = keys[off + i]
        if ph(k) != ph(t):
            sys.exit(f'placeholder mismatch at {off + i}: {k!r} -> {t!r}')
        out[k] = t
lines = [header.rstrip('\n'), f'export const {const}: Record<string, string> = {{']
for k in keys:
    if k in out:
        lines.append(f'  {json.dumps(k, ensure_ascii=False)}:\n    {json.dumps(out[k], ensure_ascii=False)},')
lines.append('};\n')
open(os.path.join(root, 'src', 'i18n', f'{lang}.ts'), 'w').write('\n'.join(lines))
print(f'{lang}: {len(out)} of {len(keys)} keys')
