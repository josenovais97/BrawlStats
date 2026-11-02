"""
Indexes Supercell's Brawl Stars Fan Kit into src/data/fankit.json, and saves
each brawler's full-body render, trimmed, under public/fankit/body/.

  docker run --rm --user $(id -u):$(id -g) -v $PWD:/app -w /app \\
    -v /var/lib/brawlzone/viral-cache:/cache:ro -e PYTHONPATH=/cache/py \\
    python:3.12-slim python scripts/fankit-sync.py [--check]

`--check` prints what matched and writes nothing. Pillow comes from the viral
engine's cache on the box; nothing else outside the standard library.

The Fan Kit (fankit.supercell.com) is Supercell's own library of game art for
fan content, public and offered for exactly this use; BrawlZone joined the
Supercell Creators program on 2026-10-31. Its files are served from Frontify's
CDN, which resizes on request (`?width=`), returns WebP and caches for a year,
so icons are embedded from there directly and only recorded here.

Full-body renders are the exception and are copied: the Fan Kit draws them on
loose canvases -- a standing `shelly_default_001` has a sixth of its height
empty above the head, and the newer brawlers only have animation frames like
`vince_default_happy_002`, where the figure is a fifth of the width. Shown as
they are, they stand small and adrift on every podium. Trimmed to the figure
once, here, they fit the boxes the site already draws.

Everything is keyed by the game's own ids, because the Fan Kit's file names
are written by hand and follow no single scheme -- `amber_gadget_01`,
`gadget_amber_1`, `bolt_gd1`, `Najia_Gadget2`, `damian_gadget_builder`. A name
is read for a brawler and a position, and the position is matched against that
brawler's accessories in id order, which is the order the Fan Kit numbers them
in (checked by eye against the old icons for Shelly, Crow, Bolt, 8-Bit, El
Primo and Leon on 2026-11-02). Anything it cannot place is listed, and the site
keeps its previous art for that item.

Run by hand when a brawler is released. The index and the renders are
committed, so a build never depends on the Fan Kit being up.
"""

import hashlib
import io
import json
import math
import os
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
from datetime import date

from PIL import Image

FANKIT = 'https://fankit.supercell.com/api/assets/search/324'
BRAWLAPI = 'https://api.brawlapi.com/v1/brawlers'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX = os.path.join(ROOT, 'src', 'data', 'fankit.json')
BODY_DIR = os.path.join(ROOT, 'public', 'fankit', 'body')
CHECK = '--check' in sys.argv
HEADERS = {'User-Agent': 'BrawlZone fankit-sync (brawlzone.net)', 'Accept': 'application/json'}

# A trimmed render is stored at most this wide and this tall: the largest box
# the site draws one in is the podium's first place, 18rem tall.
BODY_MAX_W, BODY_MAX_H = 520, 760
# The figure must come out at least this wide, so a small figure on a big
# canvas is fetched at a higher resolution before it is cut out.
BODY_MIN_FIGURE_W = 440

# How the Fan Kit's file names spell a brawler, where that is not its name.
ALIASES = {'primo': 'elprimo', 'twins': 'larrylawrie', 'larry': 'larrylawrie', 'jae': 'jaeyong'}


def norm(s):
    s = unicodedata.normalize('NFD', s.lower())
    return re.sub(r'[^a-z0-9]', '', s)


def fetch(url, binary=False):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as res:
        data = res.read()
    return data if binary else json.loads(data)


def assets(kind):
    out, page = [], 1
    while True:
        q = urllib.parse.urlencode({'limit': 100, 'page': page, 'order': 'NEWEST', 'asset-type18': kind})
        d = fetch(f'{FANKIT}?{q}')
        out += d['data']
        if not d.get('hasMore'):
            return out
        page += 1
        time.sleep(0.25)


def file_url(a):
    """The file's address without the `?width={width}` template."""
    return a['generic_url'].split('?')[0]


def tokens(title):
    return [t for t in (norm(x) for x in re.split(r'[_\s]+', title)) if t]


brawlers = fetch(BRAWLAPI)['list']
by_token = {norm(b['name']): b for b in brawlers}


def brawler_in(words):
    """The brawler a file name is about, and the name's other words."""
    for i, w in enumerate(words):
        # Two words first, so `buzz_lightyear` is not read as Buzz.
        if i + 1 < len(words):
            pair = w + words[i + 1]
            b = by_token.get(ALIASES.get(pair, pair))
            if b:
                return b, words[:i] + words[i + 2:]
        b = by_token.get(ALIASES.get(w, w))
        if b:
            return b, words[:i] + words[i + 1:]
    return None, words


index = {
    'source': 'https://fankit.supercell.com/d/YvtsWV4pUQVm/game-assets',
    'syncedAt': date.today().isoformat(),
    'bodies': {},
    'accessories': {},
    'hypercharges': {},
}
unplaced = []

# Gadgets and star powers. `bolt_gd1_icon` is the bare symbol of `bolt_gd1`;
# the framed badge is the game's own look, so it wins, and so does the
# shortest title when two name the same thing (`gadget_nori_1` over
# `gadget_nori_1_1`).
for kind, field in (('Gadgets', 'gadgets'), ('Star Powers', 'starPowers')):
    for a in sorted(assets(kind), key=lambda a: len(a['title'])):
        words = tokens(a['title'])
        if {'icon', 'emoji'} & set(words) or any(w.startswith('starpowerbase') for w in words):
            continue
        b, rest = brawler_in(words)
        accs = sorted(b[field], key=lambda x: x['id']) if b else []
        acc = None
        digits = re.search(r'(\d+)', '_'.join(rest))
        if b and digits:
            n = int(digits.group(1))
            acc = accs[n - 1] if 0 < n <= len(accs) else None
        elif b:
            # Named rather than numbered, or unnumbered (`Najia_Gadget` is the first).
            named = [w for w in rest if w not in ('gadget', 'gd', 'starpower', 'sp')]
            acc = next((x for x in accs if any(w in norm(x['name']) for w in named)), None) if named else accs[0] if accs else None
        if not acc:
            unplaced.append(f"{kind}: {a['title']}")
            continue
        index['accessories'].setdefault(str(acc['id']), file_url(a))

# Hypercharges: `amber_hypercharge` or `hc_wendy`, never the button or emoji art.
for a in sorted(assets('Hypercharge'), key=lambda a: len(a['title'])):
    words = tokens(a['title'])
    if not ('hypercharge' in words or words[:1] == ['hc']) or {'button', 'emoji'} & set(words):
        continue
    b, _ = brawler_in([w for w in words if w not in ('hypercharge', 'hc')])
    if not b:
        unplaced.append(f"Hypercharge: {a['title']}")
        continue
    index['hypercharges'].setdefault(str(b['id']), file_url(a))

# Full-body art: the default skin standing (`amber_default_001`, `spike_default`)
# and, for brawlers that have no standing render, an animation frame of it
# (`vince_default_happy_002`).
standing, frames = {}, {}
for a in sorted(assets('Skins'), key=lambda a: len(a['title'])):
    t = a['title'].lower()
    m = re.match(r'^(.+?)_default(?:_(happy|idle))?(?:_\d+)?$', t)
    if not m:
        continue
    b, rest = brawler_in(tokens(m.group(1)))
    if not b or rest:
        continue
    (frames if m.group(2) else standing).setdefault(b['id'], a)
chosen = {**frames, **standing}


def trimmed(a):
    """The render cut to its figure, at a size the site can use."""
    probe = Image.open(io.BytesIO(fetch(a['generic_url'].replace('{width}', '400'), binary=True))).convert('RGBA')
    box = probe.getchannel('A').point(lambda v: 255 if v > 12 else 0).getbbox()
    if not box:
        return None
    share = (box[2] - box[0]) / probe.width
    width = min(a['width'], max(400, math.ceil(BODY_MIN_FIGURE_W / max(share, 0.05))))
    img = Image.open(io.BytesIO(fetch(a['generic_url'].replace('{width}', str(width)), binary=True))).convert('RGBA')
    img = img.crop(img.getchannel('A').point(lambda v: 255 if v > 12 else 0).getbbox())
    img.thumbnail((BODY_MAX_W, BODY_MAX_H), Image.LANCZOS)
    return img


if not CHECK:
    os.makedirs(BODY_DIR, exist_ok=True)
for bid, a in sorted(chosen.items()):
    # Named for the Fan Kit file it came from, so a changed render is a new
    # address and the year-long cache on /fankit never serves a stale one.
    name = f"{bid}-{hashlib.sha1(file_url(a).encode()).hexdigest()[:8]}.webp"
    if not CHECK:
        path = os.path.join(BODY_DIR, name)
        if not os.path.exists(path):
            img = trimmed(a)
            if img is None:
                unplaced.append(f"Skins (empty): {a['title']}")
                continue
            img.save(path, 'WEBP', quality=84, method=6)
            time.sleep(0.2)
    index['bodies'][str(bid)] = f'/fankit/body/{name}'

names = {b['id']: b['name'] for b in brawlers}
gaps = lambda field: [b['name'] for b in brawlers if any(str(x['id']) not in index['accessories'] for x in b[field])]
print(f"bodies {len(index['bodies'])}/{len(brawlers)} ({len(standing)} standing, the rest animation frames), "
      f"accessories {len(index['accessories'])}, hypercharges {len(index['hypercharges'])}")
print('no body:', ', '.join(names[b['id']] for b in brawlers if str(b['id']) not in index['bodies']) or 'none')
print('gadget gaps:', ', '.join(gaps('gadgets')) or 'none')
print('star power gaps:', ', '.join(gaps('starPowers')) or 'none')
print('unplaced:', ' | '.join(unplaced) or 'none')

if not CHECK:
    # Renders no longer in the index are left for a person to delete.
    with open(INDEX, 'w') as f:
        json.dump(index, f, indent=1, sort_keys=True)
        f.write('\n')
    print('wrote', INDEX)
