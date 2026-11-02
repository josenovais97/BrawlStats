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
from concurrent.futures import ThreadPoolExecutor
import urllib.parse
import urllib.request
from datetime import date

from PIL import Image

FANKIT = 'https://fankit.supercell.com/api/assets/search/324'
BRAWLAPI = 'https://api.brawlapi.com/v1/brawlers'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX = os.path.join(ROOT, 'src', 'data', 'fankit.json')
ICON_INDEX = os.path.join(ROOT, 'src', 'data', 'fankit-icons.json')
CHECK = '--check' in sys.argv
HEADERS = {'User-Agent': 'BrawlZone fankit-sync (brawlzone.net)', 'Accept': 'application/json'}

# A trimmed render is stored at most this wide and this tall: the largest box
# the site draws one in is the podium's first place, 18rem tall.
BODY_MAX_W, BODY_MAX_H = 520, 760
# The figure must come out at least this wide, so a small figure on a big
# canvas is fetched at a higher resolution before it is cut out.
BODY_MIN_FIGURE_W = 440
FETCH_MAX_W = 1800

# How the Fan Kit's file names spell a brawler, where that is not its name.
ALIASES = {'primo': 'elprimo', 'twins': 'larrylawrie', 'larry': 'larrylawrie', 'jae': 'jaeyong', 'colonelruffs': 'ruffs', 'ruff': 'ruffs'}


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

# Game mode icons and ranked league badges, embedded from the CDN like the
# accessory icons. Named by hand in a table, because the Fan Kit has one
# file per mode under no shared scheme and several decoys per name
# (`hot_zone_blue_icon`, `icon_heist_challenge`). Modes missing from the Fan
# Kit -- Knockout, Duo Showdown, Brawl Hockey, Siege on 2026-11-02 -- keep
# the old icon.
MODE_FILES = {
    'gemgrab': 'gem_grab_icon', 'brawlball': 'brawl_ball_icon', 'heist': 'heist_icon',
    'bounty': 'bounty_icon', 'hotzone': 'hot_zone_icon', 'soloshowdown': 'showdown_icon',
    'showdown': 'showdown_icon', 'trioshowdown': 'trio_showdown_icon', 'duels': 'duels_icon',
    'wipeout': 'wipeout_icon', 'payload': 'payload_icon', 'basketbrawl': 'basket_brawl_icon',
    'volleybrawl': 'volley_brawl_icon', 'hunters': 'icon_hunters', 'takedown': 'takedown_icon',
    'lonestar': 'lone_star_icon', 'roborumble': 'robo_rumble_icon', 'presentplunder': 'present_plunder_icon',
    'trophythieves': 'trophy_thieves_icon', 'laststand': 'last_stand_icon', 'dodgebrawl': 'icon_game_mode_dodge_ball',
}
LEAGUE_FILES = {
    'bronze': 'icon_ranked_bronze', 'silver': 'icon_ranked_silver', 'gold': 'icon_ranked_gold',
    'diamond': 'icon_ranked_diamond', 'mythic': 'icon_ranked_mythic', 'legendary': 'icon_ranked_legendary',
    'masters': 'icon_ranked_masters', 'pro': 'icon_ranked_pro_card',
}
by_title = {}
for a in sorted(assets('Icons & Buttons'), key=lambda a: a['width']):
    by_title[a['title'].lower()] = a  # the largest file of a name wins
index['modes'] = {m: file_url(by_title[t]) for m, t in MODE_FILES.items() if t in by_title}
leagues = {l: file_url(by_title[t]) for l, t in LEAGUE_FILES.items() if t in by_title}
for m, t in MODE_FILES.items():
    if t not in by_title:
        unplaced.append(f'mode {m}: no {t}')

# Our own icon files that have an exact Fan Kit counterpart, overwritten in
# place at their current size: the components that draw them keep working
# unchanged. Checked side by side on 2026-11-02; where the Fan Kit's nearest
# file is a different picture (the hypercharge drop, the winged Ranked skull,
# the Starr Drop) ours stays.
LOCAL_ICONS = {
    'class-artillery.png': 'icon_class_artillery', 'class-assassin.png': 'icon_class_assassin',
    'class-controller.png': 'icon_class_controller', 'class-damage-dealer.png': 'icon_class_damage',
    'class-marksman.png': 'icon_class_marksmen', 'class-support.png': 'icon_class_support',
    'class-tank.png': 'icon_class_tank', 'skin-rare.png': 'icon_catalogue_skins_rare',
    'skin-super-rare.png': 'icon_catalogue_skins_super_rare', 'skin-epic.png': 'icon_catalogue_skins_epic',
    'skin-mythic.png': 'icon_catalogue_skins_mythic', 'skin-legendary.png': 'icon_catalogue_skins_legendary',
    'power-point.png': 'icon_powerpoints_stack', 'leaderboard.png': 'icon_leaderboards',
    'solo-showdown.png': 'showdown_icon', 'coin.png': 'icon_coin_stack', 'trophy.png': 'icon_trophy',
}
for local, title in LOCAL_ICONS.items():
    a = by_title.get(title)
    path = os.path.join(ROOT, 'public', 'icons', local)
    if not a or not os.path.exists(path):
        unplaced.append(f'icon {local}: no {title}')
        continue
    if CHECK:
        continue
    box = Image.open(path).size
    img = Image.open(io.BytesIO(fetch(a['generic_url'].replace('{width}', str(max(box) * 2)), binary=True))).convert('RGBA')
    img.thumbnail(box, Image.LANCZOS)
    canvas = Image.new('RGBA', box, (0, 0, 0, 0))
    canvas.paste(img, ((box[0] - img.width) // 2, (box[1] - img.height) // 2), img)
    canvas.save(path, 'PNG', optimize=True)

# Gears, keyed by the game's gear name ("SHIELD" -> shield) since that is what
# every page drawing one already has, and mythic gears by their brawler
# (`mythic:amber`), whose gear names are their own. Where the Fan Kit has a
# gear at two rarities the current one is named.
GEAR_FILES = {
    'speed': 'gear_superrare_speed', 'vision': 'gear_superrare_vision', 'health': 'gear_superrare_heal',
    'damage': 'gear_superrare_damage', 'shield': 'gear_superrare_shield', 'gadgetcharge': 'gear_plus_gadgets',
    'supercharge': 'gear_epic_super', 'reloadspeed': 'gear_epic_reload', 'petpower': 'gear_epic_pet',
    'gadgetcooldown': 'gear_gadget_cooldown',
}
gear_assets = {a['title'].lower(): a for a in sorted(assets('Gears'), key=lambda a: a['width'])}
index['gears'] = {k: file_url(gear_assets[t]) for k, t in GEAR_FILES.items() if t in gear_assets}
for t, a in gear_assets.items():
    m = re.match(r'^gear_mythic_(.+)$', t)
    b = by_token.get(norm(m.group(1))) if m else None
    if b:
        index['gears'][f"mythic:{norm(b['name'])}"] = file_url(a)

SKINS = assets('Skins')

# Full-body art: the default skin standing (`amber_default_001`, `spike_default`)
# and, for brawlers that have no standing render, an animation frame of it
# (`vince_default_happy_002`).
standing, frames = {}, {}
for a in sorted(SKINS, key=lambda a: len(a['title'])):
    t = a['title'].lower()
    m = re.match(r'^(.+?)_default(?:_(happy|idle))?(?:_\d+)?$', t)
    if not m:
        continue
    b, rest = brawler_in(tokens(m.group(1)))
    if not b or rest:
        continue
    (frames if m.group(2) else standing).setdefault(b['id'], a)
chosen = {**frames, **standing}

# Every other skin, one render each, keyed `<brawler id>|<skin>` where <skin>
# is the skin's own words with the brawler's name taken off either end -- the
# same key `lib/fankit` builds from the game API's skin name, so "Starr
# Patrol Amber" finds `amber_starr_patrol_amber_happy_402`. A standing render
# beats an animation frame; a sad frame is never used.
FRAMES = {'happy', 'idle', 'win', 'loop', 'happyloop'}
skins, skin_rank = {}, {}
for a in SKINS:
    words = tokens(a['title'])
    while words and words[0].isdigit():
        words = words[1:]
    if not words:
        continue
    pair = words[0] + (words[1] if len(words) > 1 else '')
    b = by_token.get(ALIASES.get(pair, pair)) if len(words) > 1 else None
    rest = words[2:] if b else []
    if not b:
        b = by_token.get(ALIASES.get(words[0], words[0]))
        rest = words[1:]
    if not b or 'sad' in rest or 'default' in rest:
        continue
    rank = 0
    while rest and (rest[-1].isdigit() or rest[-1] in FRAMES):
        if rest[-1] in FRAMES:
            rank = 1
        rest = rest[:-1]
    bt = norm(b['name'])
    variant = ''.join(rest)
    if variant.startswith(bt):
        variant = variant[len(bt):]
    if variant.endswith(bt):
        variant = variant[: -len(bt)]
    if not variant:
        continue
    key = f"{b['id']}|{variant}"
    if key not in skin_rank or rank < skin_rank[key]:
        skins[key], skin_rank[key] = a, rank

# Square icons for lists: each brawler's portrait, cropped to a square from the
# top. The classic in-game portrait wins over a newer, larger one of the same
# brawler (`Portrait_Colt` exists in both), so neighbours in a grid match.
icons = {}
for a in sorted(assets('Brawler Portraits'), key=lambda a: a['width']):
    words = tokens(a['title'])
    words = [w for w in words if w != 'portrait']
    b, rest = brawler_in(words)
    if b and not rest:
        icons.setdefault(b['id'], a)


def alpha_box(img):
    return img.getchannel('A').point(lambda v: 255 if v > 12 else 0).getbbox()


def trimmed(a, min_figure_w, max_w, max_h):
    """The render cut to its figure, at a size the site can use."""
    probe = Image.open(io.BytesIO(fetch(a['generic_url'].replace('{width}', '400'), binary=True))).convert('RGBA')
    box = alpha_box(probe)
    if not box:
        return None
    share = (box[2] - box[0]) / probe.width
    # Capped: a figure that is a sliver of an 8,000px master is not worth
    # decoding the master for, on a box that is also serving the site.
    width = min(a['width'], FETCH_MAX_W, max(400, math.ceil(min_figure_w / max(share, 0.05))))
    img = Image.open(io.BytesIO(fetch(a['generic_url'].replace('{width}', str(width)), binary=True))).convert('RGBA')
    img = img.crop(alpha_box(img))
    img.thumbnail((max_w, max_h), Image.LANCZOS)
    return img


# Where across a wide portrait the face is, for the few that are not centred:
# 0 is the left edge, 1 the right. Cosmo's face is the lens on the right; a
# centred square of him was a cannon (2026-11-02).
SQUARE_ACROSS = {'Portrait_Cosmo': 1.0}


def square(a, size=192):
    """
    The portrait cropped to a square from its top. A cut-out on a transparent
    canvas (Wendy) is trimmed to its figure first, so it fills the tile like
    its neighbours rather than sitting small in the middle of one.
    """
    img = Image.open(io.BytesIO(fetch(a['generic_url'].replace('{width}', str(min(a['width'], 600))), binary=True))).convert('RGBA')
    box = alpha_box(img)
    if box and (box[2] - box[0] < img.width * 0.97 or box[3] - box[1] < img.height * 0.97):
        img = img.crop(box)
    side = min(img.size)
    x = round((img.width - side) * SQUARE_ACROSS.get(a['title'], 0.5))
    return img.crop((x, 0, x + side, side)).resize((size, size), Image.LANCZOS)


def saved(folder, stem, a, make, quality):
    """
    The site path of `a` rendered by `make`, writing it once. Named for the
    Fan Kit file it came from, so a changed render is a new address and the
    year-long cache on /fankit never serves a stale one.
    """
    name = f"{stem}-{hashlib.sha1(file_url(a).encode()).hexdigest()[:8]}.webp"
    if not CHECK:
        os.makedirs(os.path.join(ROOT, 'public', 'fankit', folder), exist_ok=True)
        path = os.path.join(ROOT, 'public', 'fankit', folder, name)
        if not os.path.exists(path):
            img = make(a)
            if img is None:
                unplaced.append(f"empty render: {a['title']}")
                return None
            img.save(path, 'WEBP', quality=quality, method=6)
    return f'/fankit/{folder}/{name}'


# Three at a time: the first request for a size makes Frontify resize the
# original, which takes seconds, so one at a time is slow -- but the decode
# and trim run on the box that serves the site, which more would crowd.
def render_all(items, folder, stem, make, quality):
    with ThreadPoolExecutor(max_workers=3) as pool:
        paths = pool.map(lambda kv: saved(folder, stem(kv[0]), kv[1], make, quality), items)
        return {k: p for (k, _), p in zip(items, paths) if p}


index['bodies'] = {
    str(k): p
    for k, p in render_all(sorted(chosen.items()), 'body', str,
                           lambda a: trimmed(a, BODY_MIN_FIGURE_W, BODY_MAX_W, BODY_MAX_H), 84).items()
}
index['skins'] = render_all(sorted(skins.items()), 'skin',
                            lambda key: '-'.join([key.split('|')[0], key.split('|')[1][:24]]),
                            lambda a: trimmed(a, 200, 200, 300), 72)
icon_index = {str(k): p for k, p in render_all(sorted(icons.items()), 'icon', str, square, 82).items()}
# League badges ride in the small client index too (`league:<name>`): the
# rank chips and the ranked ladder that draw them are client components.
icon_index.update({f'league:{l}': f'{u}?width=96' for l, u in leagues.items()})
# The generic gadget, star power and gear marks the site draws beside a
# heading -- the same Shelly badges and Speed gear it used before, from the
# Fan Kit now.
for key, url in (('gadget', index['accessories'].get('23000255')), ('starpower', index['accessories'].get('23000076')),
                 ('gear', index['gears'].get('speed'))):
    if url:
        icon_index[f'generic:{key}'] = f'{url}?width=96'

names = {b['id']: b['name'] for b in brawlers}
gaps = lambda field: [b['name'] for b in brawlers if any(str(x['id']) not in index['accessories'] for x in b[field])]
print(f"bodies {len(index['bodies'])}/{len(brawlers)} ({len(standing)} standing, the rest animation frames), "
      f"icons {sum(k.isdigit() for k in icon_index)}/{len(brawlers)}, skins {len(index['skins'])}, "
      f"accessories {len(index['accessories'])}, hypercharges {len(index['hypercharges'])}, "
      f"modes {len(index['modes'])}, leagues {len(leagues)}, gears {len(index['gears'])}")
print('no icon:', ', '.join(names[b['id']] for b in brawlers if str(b['id']) not in icon_index) or 'none')
print('no body:', ', '.join(names[b['id']] for b in brawlers if str(b['id']) not in index['bodies']) or 'none')
print('gadget gaps:', ', '.join(gaps('gadgets')) or 'none')
print('star power gaps:', ', '.join(gaps('starPowers')) or 'none')
print('unplaced:', ' | '.join(unplaced) or 'none')

if not CHECK:
    # Renders no longer in the index are left for a person to delete.
    with open(INDEX, 'w') as f:
        json.dump(index, f, indent=1, sort_keys=True)
        f.write('\n')
    # The list icons apart, and small: client components draw them.
    with open(ICON_INDEX, 'w') as f:
        json.dump(icon_index, f, indent=1, sort_keys=True)
        f.write('\n')
    print('wrote', INDEX, ICON_INDEX)
