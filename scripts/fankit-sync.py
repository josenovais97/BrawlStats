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

from PIL import Image, ImageDraw, ImageFilter
import numpy as np

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


def assets(kind=None):
    """Every asset of one type, or every asset in the kit with no type."""
    out, page = [], 1
    while True:
        q = urllib.parse.urlencode({'limit': 100, 'page': page, 'order': 'NEWEST', **({'asset-type18': kind} if kind else {})})
        d = fetch(f'{FANKIT}?{q}')
        out += d['data']
        if not d.get('hasMore'):
            return out
        page += 1
        time.sleep(0.25)


def safe(f, *args):
    try:
        return f(*args)
    except Exception:
        return None


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
# Files named for an ability the game calls something else, matched by eye
# against the old icons (2026-11-02).
ACCESSORY_FILES = {
    'damian_gadget_thirsty': 23001247, 'damian_gadget_builder': 23001248,  # Spiritual Healing, Wall Of Sound
    'damian_starpower_tko': 23001245, 'damian_starpower_firepower': 23001246,  # Crowdkill, Vulgar Display Of Punch
    'starrnova_gadget_fluffytime': 23001255,  # Floaty Time
}
for kind, field in (('Gadgets', 'gadgets'), ('Star Powers', 'starPowers')):
    for a in sorted(assets(kind), key=lambda a: len(a['title'])):
        if a['title'].lower() in ACCESSORY_FILES:
            index['accessories'].setdefault(str(ACCESSORY_FILES[a['title'].lower()]), file_url(a))
            continue
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
    'knockout': 'knock_out_icon',
}
# The rank's own head, as the game draws it beside a player's name: the
# numbered tier badges are these with I, II or III under the chin.
LEAGUE_FILES = {
    'bronze': 'icon_rank_sticker_bronze', 'silver': 'icon_rank_sticker_silver', 'gold': 'icon_rank_sticker_gold',
    'diamond': 'icon_rank_sticker_diamond', 'mythic': 'icon_rank_sticker_mythic',
    'legendary': 'icon_rank_sticker_legendary', 'masters': 'icon_rank_sticker_masters', 'pro': 'icon_rank_sticker_pro',
}
by_title = {}
# UI Assets too: the Buffie key (`icon_key_buddy`) is filed there.
for a in sorted(assets('Icons & Buttons') + assets('UI Assets'), key=lambda a: a['width']):
    by_title[a['title'].lower()] = a  # the largest file of a name wins
index['modes'] = {m: file_url(by_title[t]) for m, t in MODE_FILES.items() if t in by_title}
leagues = {l: file_url(by_title[t]) for l, t in LEAGUE_FILES.items() if t in by_title}
for m, t in MODE_FILES.items():
    if t not in by_title:
        unplaced.append(f'mode {m}: no {t}')

# Our own icon files that have an exact Fan Kit counterpart, overwritten in
# place at their current size: the components that draw them keep working
# unchanged. Checked side by side on 2026-11-02; where the Fan Kit's nearest
# file is a different picture (the hypercharge drop, the Starr Drop, the win
# streak flame, the crown) ours stays.
LOCAL_ICONS = {
    'class-artillery.png': 'icon_class_artillery', 'class-assassin.png': 'icon_class_assassin',
    'class-controller.png': 'icon_class_controller', 'class-damage-dealer.png': 'icon_class_damage',
    'class-marksman.png': 'icon_class_marksmen', 'class-support.png': 'icon_class_support',
    'class-tank.png': 'icon_class_tank', 'skin-rare.png': 'icon_catalogue_skins_rare',
    'skin-super-rare.png': 'icon_catalogue_skins_super_rare', 'skin-epic.png': 'icon_catalogue_skins_epic',
    'skin-mythic.png': 'icon_catalogue_skins_mythic', 'skin-legendary.png': 'icon_catalogue_skins_legendary',
    'power-point.png': 'icon_powerpoints_stack', 'leaderboard.png': 'icon_leaderboards',
    'solo-showdown.png': 'showdown_icon', 'coin.png': 'icon_coin_stack', 'trophy.png': 'icon_trophy',
    'battles.png': 'duels_icon', 'buffie.png': 'icon_key_buddy', 'robo-rumble.png': 'robo_rumble_icon',
    'skins.png': 'icon_catalogue_skins_legendary', 'cosmetics.png': 'skin_rarity_hypercharge',
    'ranked.png': 'icon_ranked_front',
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
# The whole kit, untyped: some renders were never filed under Skins --
# `trunk_royale_trunk_happy_730`, `najia_default_happy_458` -- and some player
# icons were never filed under Player Icons.
EVERYTHING = assets()
_skin_ids = {a['id'] for a in SKINS}
# Outside Skins only a numbered animation frame counts as a render: `sirius_happy`
# and `primo_mha_happy` there are the emote, not the figure.
SKINS += [a for a in EVERYTHING if a['id'] not in _skin_ids
          and re.search(r'_(happy|idle|win|happyloop)_\d+$', a['title'].lower())]

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


# Where to fetch each body large, for the puzzles that zoom into it -- the
# site's daily Shadow and Zoom pictures and the quiz videos: the Fan Kit file
# at a width that makes the figure about HIRES_FIGURE_W across (the canvases
# are loose, so the figure's share of the width is measured first), capped so
# a sliver on an 8,000px master is not decoded whole.
HIRES_FIGURE_W = 1400


def hires(a):
    probe = Image.open(io.BytesIO(fetch(a['generic_url'].replace('{width}', '400'), binary=True))).convert('RGBA')
    box = alpha_box(probe)
    share = (box[2] - box[0]) / probe.width if box else 1
    width = min(a['width'], 4000, max(400, math.ceil(HIRES_FIGURE_W / max(share, 0.05))))
    return f'{file_url(a)}?width={width}'


with ThreadPoolExecutor(max_workers=3) as pool:
    _bodies = sorted(chosen.items())
    index['bodySources'] = {str(k): u for (k, _), u in zip(_bodies, pool.map(lambda kv: safe(hires, kv[1]), _bodies)) if u}
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


# Numbered rank badges, `rank:<n>` for the API's 1-based `rankedRank`:
# Bronze I is 1, Masters III is 21, Pro is 22. The game's badge is the rank's
# head with a Roman numeral under the chin; the Fan Kit has the heads alone,
# so the numeral is drawn here -- in the rank's colour, with the same white
# rim and dark outline the head has -- and Pro is its trophy as it comes.
TIER_LEAGUES = ['bronze', 'silver', 'gold', 'diamond', 'mythic', 'legendary', 'masters']
TIER_COLOURS = {
    'bronze': (240, 138, 36), 'silver': (184, 176, 240), 'gold': (255, 210, 58), 'diamond': (63, 224, 240),
    'mythic': (240, 60, 230), 'legendary': (255, 59, 48), 'masters': (255, 210, 58),
}
TIER_DESIGN = 'numeral-v1'  # change to re-render every badge under new names
TIER_W = 192
OUTLINE = (24, 22, 34, 255)


def dilate(mask, r):
    return mask.filter(ImageFilter.MaxFilter(2 * r + 1)) if r > 0 else mask


def tier_badge(a, league, n):
    """The head with `n` serifed strokes under it, as the game draws I to III."""
    W = TIER_W * 2  # drawn at twice the size and scaled down, for clean edges
    head = Image.open(io.BytesIO(fetch(a['generic_url'].replace('{width}', str(W * 2)), binary=True))).convert('RGBA')
    head = head.crop(alpha_box(head))
    head.thumbnail((round(W * 0.92), W * 2), Image.LANCZOS)
    h = round(head.height * 0.34)  # numeral height
    bar, gap, over, serif = round(h * 0.26), round(h * 0.13), round(h * 0.17), round(h * 0.17)
    rim, line = max(2, round(h * 0.07)), max(2, round(h * 0.07))
    nw = n * bar + (n - 1) * gap + 2 * over
    pad = rim + line + 2
    mask = Image.new('L', (nw + 2 * pad, h + 2 * pad), 0)
    d = ImageDraw.Draw(mask)
    d.rectangle((pad, pad, pad + nw - 1, pad + serif - 1), fill=255)
    d.rectangle((pad, pad + h - serif, pad + nw - 1, pad + h - 1), fill=255)
    for i in range(n):
        x = pad + over + i * (bar + gap)
        d.rectangle((x, pad, x + bar - 1, pad + h - 1), fill=255)
    if n > 1:  # the strokes stand apart between the serifs, as in the game
        for i in range(n - 1):
            x = pad + over + i * (bar + gap) + bar
            d.rectangle((x, pad + serif, x + gap - 1, pad + h - serif - 1), fill=0)
    white = dilate(mask, rim)
    dark = dilate(white, line)
    r, g, b = TIER_COLOURS[league]
    shade = Image.linear_gradient('L').resize(mask.size)  # lighter at the top
    fill = Image.merge('RGB', [c.point(lambda v, c0=c0: round(c0 * (1 - 0.28 * v / 255))) for c, c0 in
                               zip((shade, shade, shade), (r, g, b))]).convert('RGBA')
    numeral = Image.new('RGBA', mask.size, (0, 0, 0, 0))
    numeral.paste(OUTLINE, None, dark)
    numeral.paste((255, 255, 255, 255), None, white)
    numeral.paste(fill, (0, 0), mask)
    top = head.height - round(h * 0.42)
    canvas = Image.new('RGBA', (max(head.width, numeral.width), top + numeral.height), (0, 0, 0, 0))
    canvas.alpha_composite(head, ((canvas.width - head.width) // 2, 0))
    canvas.alpha_composite(numeral, ((canvas.width - numeral.width) // 2, top))
    canvas = canvas.crop(alpha_box(canvas))
    canvas.thumbnail((TIER_W, TIER_W * 2), Image.LANCZOS)
    return canvas


def save_tier(rank, league, n):
    a = by_title.get(LEAGUE_FILES[league])
    if not a:
        return None
    digest = hashlib.sha1(f'{file_url(a)}|{n}|{TIER_DESIGN}'.encode()).hexdigest()[:8]
    name = f'{rank}-{digest}.webp'
    if not CHECK:
        folder = os.path.join(ROOT, 'public', 'fankit', 'rank')
        os.makedirs(folder, exist_ok=True)
        path = os.path.join(folder, name)
        if not os.path.exists(path):
            img = tier_badge(a, league, n) if n else Image.open(io.BytesIO(
                fetch(a['generic_url'].replace('{width}', str(TIER_W * 2)), binary=True))).convert('RGBA')
            if not n:
                img = img.crop(alpha_box(img))
                img.thumbnail((TIER_W, TIER_W * 2), Image.LANCZOS)
            img.save(path, 'WEBP', quality=90, method=6)
    return f'/fankit/rank/{name}'


tiers = [(i * 3 + n, league, n) for i, league in enumerate(TIER_LEAGUES) for n in (1, 2, 3)] + [(22, 'pro', 0)]
for rank, league, n in tiers:
    url = save_tier(rank, league, n)
    if url:
        icon_index[f'rank:{rank}'] = url
    else:
        unplaced.append(f'rank {rank}: no {LEAGUE_FILES[league]}')

# Player icons, by the game's icon id. The Fan Kit names its files by hand
# (`player_icon_frank_royale`) and the game API gives only an id, so each id's
# picture is matched by eye -- the mirror's copy against every Fan Kit icon,
# both shrunk to 16x16 over grey -- and kept when it is unmistakably the same
# image (an RMS difference under 10 of 255; the nearest wrong match measured
# 13+ and the right ones mostly under 5, checked by eye on 2026-11-02). The
# plain brawler icons (`hero1`...) are not in the kit as player icons, and are
# the brawler's portrait, so they are cut from the same Fan Kit portraits as
# the square brawler icons.
#
# Matches are remembered in scripts/fankit-player-icons.json and never
# re-matched, and a file once written is never rewritten: the files are named
# by game id under a year-long immutable cache, so a corrected picture needs a
# new folder, not a new file.
PLAYER_INDEX = os.path.join(ROOT, 'scripts', 'fankit-player-icons.json')
CLUB_INDEX = os.path.join(ROOT, 'scripts', 'fankit-club-badges.json')
MATCH_RMS = 10


def thumb_feature(url):
    img = Image.open(io.BytesIO(fetch(url, binary=True))).convert('RGBA').resize((64, 64), Image.LANCZOS)
    bg = Image.new('RGBA', img.size, (128, 128, 128, 255))
    bg.alpha_composite(img)
    return np.asarray(bg.convert('RGB').resize((16, 16), Image.BILINEAR), dtype=np.float32).ravel()


def load_known(path):
    try:
        with open(path) as f:
            return json.load(f)
    except FileNotFoundError:
        return {}


def match_by_image(known, game, kit):
    """Adds to `known` each game icon whose picture is unmistakably a kit file."""
    todo = [v for k, v in sorted(game.items()) if k not in known and not v.get('brawler')]
    if not todo or not kit:
        return
    with ThreadPoolExecutor(max_workers=3) as pool:
        kit_f = list(pool.map(lambda a: safe(thumb_feature, a['generic_url'].replace('{width}', '64')), kit))
        game_f = list(pool.map(lambda v: safe(thumb_feature, v['imageUrl']), todo))
    kit_ok = [(a, f) for a, f in zip(kit, kit_f) if f is not None]
    K = np.stack([f for _, f in kit_ok])
    for v, f in zip(todo, game_f):
        if f is None:
            continue
        rms = np.sqrt(((K - f) ** 2).mean(axis=1))
        i = int(rms.argmin())
        if rms[i] < MATCH_RMS:
            known[str(v['id'])] = file_url(kit_ok[i][0])


def write_icons(known, folder, size):
    """Saves each known icon as public/fankit/<folder>/<game id>.webp, once."""
    out = os.path.join(ROOT, 'public', 'fankit', folder)

    def save(item):
        gid, src = item
        path = os.path.join(out, f'{gid}.webp')
        if os.path.exists(path):
            return gid
        if src.startswith('icon:'):
            img = Image.open(os.path.join(ROOT, 'public', icon_index[src[5:]].lstrip('/'))).convert('RGBA')
        else:
            img = Image.open(io.BytesIO(fetch(f'{src}?width={size}', binary=True))).convert('RGBA')
        img.thumbnail((size, size), Image.LANCZOS)
        canvas = Image.new('RGBA', (max(img.size),) * 2, (0, 0, 0, 0))
        canvas.paste(img, ((canvas.width - img.width) // 2, (canvas.height - img.height) // 2), img)
        canvas.save(path, 'WEBP', quality=80, method=6)
        return gid

    if CHECK:
        return list(known)
    os.makedirs(out, exist_ok=True)
    with ThreadPoolExecutor(max_workers=3) as pool:
        return [g for g in pool.map(lambda it: safe(save, it), sorted(known.items())) if g]


def id_ranges(ids, base):
    """The client's list of ids with a file: offsets from `base` as ranges ("0-2,5,9-40")."""
    offsets = sorted(int(g) - base for g in ids)
    ranges, start = [], None
    for i, o in enumerate(offsets):
        if start is None:
            start = o
        if i + 1 == len(offsets) or offsets[i + 1] != o + 1:
            ranges.append(str(start) if start == o else f'{start}-{o}')
            start = None
    return ','.join(ranges)


game_icon_lists = fetch('https://api.brawlapi.com/v1/icons')
game_icons, game_clubs = game_icon_lists['player'], game_icon_lists['club']

player_known = load_known(PLAYER_INDEX)
kit_icons = assets('Player Icons')
_ids = {a['id'] for a in kit_icons}
kit_icons += [a for a in EVERYTHING if a['id'] not in _ids and re.match(r'(player|profile)[ _]icon', a['title'].lower())]
match_by_image(player_known, game_icons, kit_icons)
# The brawler icons, from the square portraits made above.
for k, v in game_icons.items():
    if v.get('brawler') and k not in player_known and str(v['brawler']) in icon_index:
        player_known[k] = f"icon:{v['brawler']}"
written = write_icons(player_known, 'player', 160)
icon_index['players'] = id_ranges(written, 28000000)
print(f"player icons {len(written)}/{len(game_icons)} "
      f"({sum(not str(v).startswith('icon:') for v in player_known.values())} matched, "
      f"{sum(str(v).startswith('icon:') for v in player_known.values())} brawler portraits)")

# Club badges, the same way. The kit has only a handful (`icon_club_badge_1`
# to `_10`), so most clubs keep the mirror's badge.
club_known = load_known(CLUB_INDEX)
match_by_image(club_known, game_clubs,
               [a for a in EVERYTHING if re.match(r'icon_club_badge_\d+$', a['title'].lower())])
clubs_written = write_icons(club_known, 'club', 128)
icon_index['clubs'] = id_ranges(clubs_written, 8000000)
print(f'club badges {len(clubs_written)}/{len(game_clubs)}')

# Buffies (added to the game December 2025): each brawler's gadget, star
# power and hypercharge Buffie icons, for the "what's new" video. Named
# `buddy_icon_gus_star_power`, `emoji_nita_buffy_hc`, `emoji_colt_keychain_gadget`;
# `order` is the brawler's place in the kit's newest-first listing, so the
# latest Buffies come first.
BUFFIE_KIND = {'gadget': 'gadget', 'star': 'starPower', 'starpower': 'starPower', 'power': 'starPower',
               'hc': 'hyperCharge', 'hypercharge': 'hyperCharge'}
index['buffies'] = {}
for n, a in enumerate(assets('Buffies')):
    title = a['title'].lower().replace('@4x', '')
    if not re.match(r'(buddy_icon_|emoji_[a-z0-9]+_(buffy|keychain)_)', title):
        continue
    words = [w for w in tokens(title) if w not in ('buddy', 'icon', 'emoji', 'buffy', 'keychain')]
    b, rest = brawler_in(words)
    kind = next((BUFFIE_KIND[w] for w in rest if w in BUFFIE_KIND), None)
    if not b or not kind:
        continue
    entry = index['buffies'].setdefault(str(b['id']), {'order': n})
    entry.setdefault(kind, file_url(a))
index['buffies'] = {k: v for k, v in index['buffies'].items() if all(x in v for x in ('gadget', 'starPower', 'hyperCharge'))}
print(f"buffies: {len(index['buffies'])} brawlers")

# Reward and box art for the Starr Drops and free-rewards pages, keyed by the
# wiki file name those pages look up (letters and digits only: "Gigi Box.png"
# -> gigibox), so the Fan Kit's picture is used and the wiki is not asked.
# Matched by eye against the wiki's files on 2026-11-02; the kit has no
# regular Starr Drop, Mega Box, or the boxes of most newer brawlers.
ITEM_FILES = {
    'icongem': 'icon_gems', 'iconcredit': 'icon_credits', 'bling': 'icon_bling_stack', 'iconbling': 'icon_bling',
    'iconcoin': 'icon_coin_stack', 'iconpowerpoint': 'icon_powerpoints_stack', 'brawlpass': 'icon_brawl_pass',
    'propassxp': 'icon_pro_pass_icon', 'xpdoubler': 'icon_xp_doubler', 'monsteregg': 'icon_godzila_egg',
    'powermeal': 'icon_power_meal_box_1', 'sushiroll': 'icon_sushi_roll', 'nanodrops': 'gachabox_green',
    'nanodrop': 'gachabox_green', 'rankedstarrdrop': 'icon_ranked_starr_drop',
    'angelicdrop': 'pin_angels_vs_demons_angelic_drop_1', 'boombox': 'ic_boom_box',
    'coffinbox': 'coffin_box_ui_render', 'gigibox': 'image_box_gigi', 'minabox': 'image_box_mina',
    'ziggybox': 'image_box_ziggy', 'najiabox': 'shop_item_brawler_box_najia', 'siriusbox': 'image_box_sirius',
    'mechabox': 'mecha_box_shop_item', 'wendybox': 'wendy_box_ui_render', 'noribox': 'nori_box_ui_render',
    'pumpkinbox': 'trick_box1',
}
kit_by_title = {}
for a in sorted(EVERYTHING, key=lambda a: a.get('width') or 0):
    kit_by_title[a['title'].lower()] = a  # the largest file of a name wins
index['items'] = {}
for key, title in ITEM_FILES.items():
    if title in kit_by_title:
        index['items'][key] = file_url(kit_by_title[title])
    else:
        unplaced.append(f'item {key}: no {title}')

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
    for path, known in ((PLAYER_INDEX, player_known), (CLUB_INDEX, club_known)):
        with open(path, 'w') as f:
            json.dump(known, f, indent=0, sort_keys=True)
            f.write('\n')
    print('wrote', INDEX, ICON_INDEX, PLAYER_INDEX, CLUB_INDEX)
