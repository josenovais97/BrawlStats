"""One Instagram Story as data for deploy/motion's Story scene (2026-11-25).

    python plan.py <kind> <in.json> <state.json> <out dir>

kind   reward    today's free reward in the Supercell Store
       duel      two brawlers, which wins more; the answer after a countdown
       roast     a roast line for a brawler's mains
       gems      three brawlers few pick that win a lot
       traps     three brawlers many pick that lose
       tiers     a rank's tier list with the week's risers and fallers marked
       guess     the first zoom steps of the site's daily puzzle, never the answer
       giveaway  days left and players in, until it closes
       telegram  the Telegram channel; "manual" leaves room for a link sticker
in     {"day", "snapshot" (a viral-data file), "daily" (daily.json), "entrants",
       "days", "zooms" [paths], "manual", "tiers" (a scripts/story-tiers.ts file)}, whichever the kind needs.
state  what recent Stories showed, so they do not repeat; read only here.

Writes <out>/plan.json, <out>/public (the pictures it names), <out>/sfx.wav and
<out>/used.json (what to remember once posted). Exits 3 when there is nothing
to say. Every Ranked number is Mythic and up and tagged so (owner, 2026-11-23).
"""
import json, os, random, re, sys
from PIL import Image

sys.path.insert(0, '/viral')
from engine import art, has_model, load_face, nice  # noqa: E402
import sfx  # noqa: E402

KIND, IN, STATE, OUT = sys.argv[1:5]
ASSETS = os.environ.get('ASSETS', '.')
REPO = '/repo'
FPS = 30
data = json.load(open(IN))
try:
    state = json.load(open(STATE))
except (OSError, ValueError):
    state = {}
rnd = random.Random(f"{data['day']}/{KIND}")
os.makedirs(f'{OUT}/public/c', exist_ok=True)
plan = {'kind': 'story', 'story': KIND, 'fps': FPS, 'step': 1, 'beats': 1, 'period': 1, 'episode': 1, 'segments': []}
used, cues = None, []


def nothing(why):
    print(why); sys.exit(3)


def save(img, rel):
    img.convert('RGBA').save(f'{OUT}/public/{rel}')
    return rel


def brawler(b, size=900):
    return {'id': b['id'], 'name': nice(b['n']).upper(), 'wr': b.get('wr'),
            'art': save(art(b, size, size), f"c/{b['id']}-art.png"),
            'face': save(load_face(b).resize((256, 256), Image.LANCZOS), f"c/{b['id']}-face.png")}


def rank_tag():
    badges = []
    for n in ('mythic', 'legendary', 'masters', 'pro'):
        p = f'{ASSETS}/ranked/league-{n}.png'
        if os.path.exists(p):
            badges.append(save(Image.open(p), f'c/league-{n}.png'))
    return {'label': 'MYTHIC+', 'badges': badges}


def reward_art(name):
    """The site's art for a reward, then the drops videos', else the gift."""
    slug = re.sub(r'[^a-z0-9]+', '-', re.sub(r'^\s*[\d,. ]*\s*[x×]?\s*', '', name.lower())).strip('-')
    tries = [slug, slug + 's', slug.rstrip('s'), re.sub(r'box$', 'boxes', slug), re.sub(r'boxes$', 'box', slug)]
    paths = [f'{REPO}/public/rewards/art/{s}.png' for s in tries] + [f'{ASSETS}/drops/{s}.png' for s in tries]
    if re.search(r'\bpins?\b', name, re.I): paths.append(f'{REPO}/public/rewards/art/pin.png')
    if re.search(r'\bgems?\b', name, re.I): paths.append(f'{REPO}/public/rewards/art/gems.png')
    if re.search(r'box', name, re.I): paths.append(f'{REPO}/public/rewards/box-blue.png')
    for p in paths + [f'{REPO}/public/rewards/gift.png']:
        if os.path.exists(p):
            im = Image.open(p).convert('RGBA'); box = im.getchannel('A').getbbox()
            return im.crop(box) if box else im
    nothing(f'no art for {name}')


def short(name):
    return re.sub(r'^\s*1\s*[x×]\s*', '', name, flags=re.I).strip().upper()


if KIND in ('duel', 'gems', 'traps', 'roast'):
    snap = json.load(open(data['snapshot']))
    pool = [b for b in snap.get('mythicPlus') or [] if has_model(b)]
    if len(pool) < 40: nothing('no Mythic+ data')

if KIND == 'reward':
    d = data['daily']
    if d.get('day') != data['day'] or not d.get('name'): nothing("today's store reward is not known yet")
    plan.update(name=short(d['name']), art=save(reward_art(d['name']), 'c/reward.png'))
    frames = 225
    cues = [(0.0, 'impact', .7), (0.4, 'pop', .7), (0.66, 'chime', .8), (1.13, 'impact', .8), (1.87, 'pop', .6), (2.47, 'whoosh', .6), (3.0, 'ding', .6)]

if KIND == 'duel':
    # A popular brawler against one that wins clearly more: a guess that can go wrong.
    recent = [tuple(x) for x in state.get('duels', [])][-21:]
    seen = {i for p in recent[-7:] for i in p}
    solid = [b for b in pool if b['battles'] >= 5000 and b['id'] not in seen]
    by_use = sorted(solid, key=lambda b: -b['use'])
    famous = by_use[:35]
    pairs = [(a, b) for a in famous for b in solid
             if a['id'] != b['id'] and 0.025 <= b['wr'] - a['wr'] <= 0.08 and b['use'] < a['use'] and tuple(sorted((a['id'], b['id']))) not in recent]
    if not pairs: nothing('no duel worth showing')
    a, b = rnd.choice(pairs)
    sides = [dict(brawler(a), win=False), dict(brawler(b), win=True)]
    rnd.shuffle(sides)
    reveal = 165
    plan.update(rank=rank_tag(), sides=sides, reveal=reveal)
    used = {'duels': [sorted((a['id'], b['id']))]}
    frames = reveal + 130
    r = reveal / FPS
    cues = [(0.27, 'whoosh', .8), (0.8, 'impact', .7), (r - 3, 'tap', .8), (r - 2, 'tap', .9), (r - 1, 'tap', 1), (r - 1, 'riser', .8), (r, 'impact', 1), (r + .1, 'chime', .8), (r + 1.2, 'whoosh', .5)]

if KIND == 'roast':
    lines = snap.get('roast') or {}
    gone = set(state.get('roasts', [])[-60:])
    last = {g.split('|')[0] for g in state.get('roasts', [])[-14:]}
    cands = [(b, t) for b in sorted(pool, key=lambda b: -b['use'])[:60] for t in lines.get(b['n'], [])
             if f"{b['id']}|{t}" not in gone and str(b['id']) not in last and len(t) <= 110]
    if not cands: nothing('no roast line left')
    b, text = rnd.choice(cands)
    plan.update(b=brawler(b), line=text)
    used = {'roasts': [f"{b['id']}|{text}"]}
    done = 34 + len(text) / 1.5
    frames = int(done + 20 + 110)
    cues = [(0.0, 'impact', .7), (0.47, 'pop', .8), (done / FPS + .2, 'buzz', .9), (done / FPS + .9, 'whoosh', .6)] + \
           [(34 / FPS + i * .13, 'tap', .28) for i in range(int(len(text) / 1.5 / FPS / .13))]

if KIND in ('gems', 'traps'):
    by_use = sorted(pool, key=lambda b: -b['use'])
    rank = {b['id']: i + 1 for i, b in enumerate(by_use)}
    solid = [b for b in pool if b['battles'] >= 4000]
    cands = (sorted((b for b in solid if rank[b['id']] > 45 and b['wr'] >= 0.515), key=lambda b: -b['wr']) if KIND == 'gems'
             else sorted((b for b in solid if rank[b['id']] <= 35 and b['wr'] <= 0.495), key=lambda b: b['wr']))
    last = set(state.get(KIND, [])[-6:])
    cands = [b for b in cands if b['id'] not in last][:8]
    if len(cands) < 3: nothing(f'not enough brawlers for {KIND}')
    rows = sorted(rnd.sample(cands, 3), key=lambda b: abs(b['wr'] - 0.5))
    plan.update(rank=rank_tag(), items=[dict(brawler(b), picks=rank[b['id']], of=len(pool)) for b in rows])
    used = {KIND: [b['id'] for b in rows]}
    frames = 255
    cues = [(0.0, 'impact', .7)] + [(0.8 + i * 26 / FPS, 'whoosh', .6) for i in range(3)] + [(1.2 + i * 26 / FPS, 'ding' if KIND == 'gems' else 'buzz', .6) for i in range(3)] + [(3.8, 'pop', .7)]

if KIND == 'tiers':
    d = json.load(open(data['tiers']))
    caps = {'S': 16, 'A': 16, 'B': 16, 'C': 8}
    rows = []
    for r in d['rows']:
        cap = caps[r['tier']]
        # A row that overflows keeps its last place for the "+N".
        # Whoever moved is always on it, in the list's own order.
        shown = r['items']
        if len(shown) > cap:
            keep = {b['id'] for b in ([b for b in shown if b['dir']] + [b for b in shown if not b['dir']])[:cap - 1]}
            shown = [b for b in shown if b['id'] in keep]
        rows.append({'tier': r['tier'], 'more': len(r['items']) - len(shown),
                     'items': [{'id': b['id'], 'dir': b['dir'], 'face': save(load_face(b).resize((184, 184), Image.LANCZOS), f"c/{b['id']}-face.png")} for b in shown]})
    rows = [r for r in rows if r['items']]
    if sum(len(r['items']) for r in rows) < 15: nothing(f"too few rated brawlers in {d['rank']}")
    plan.update(word=d['rank'].upper(), rows=rows)
    frames = 345
    cues = [(0.0, 'impact', .7)] + [((18 + i * 22) / FPS, 'whoosh', .6) for i in range(len(rows))] + [((18 + i * 22 + 6) / FPS, 'impact', .35) for i in range(len(rows))]
    up = 26 + len(rows) * 22 + 14
    cues += [(up / FPS, 'chime', .8), ((up + 30) / FPS, 'pop', .7), ((up + 44) / FPS, 'whoosh', .5)]

if KIND == 'guess':
    zooms = [Image.open(z).convert('RGBA').resize((760, 760), Image.LANCZOS) for z in data.get('zooms', [])]
    if len(zooms) < 3: nothing("today's puzzle pictures are missing")
    per = 66
    plan.update(zooms=[save(z, f'c/zoom-{i}.png') for i, z in enumerate(zooms)], per=per)
    frames = 20 + per * len(zooms) + 70
    cues = [(0.0, 'impact', .7), (0.5, 'pop', .8)] + [((20 + i * per) / FPS, 'whoosh', .6) for i in range(1, len(zooms))] + [((per * len(zooms)) / FPS, 'ding', .7)]

if KIND == 'giveaway':
    if data['days'] < 0: nothing('the giveaway has closed')
    prize = next((p for p in (f'{ASSETS}/brawl-pass.png', f'{ASSETS}/box-rainbow.png') if os.path.exists(p)), None)
    if not prize: nothing('no prize art')
    plan.update(days=data['days'], entrants=data['entrants'] // 10 * 10, prize=save(Image.open(prize), 'c/prize.png'))
    frames = 230
    cues = [(0.0, 'impact', .7), (0.33, 'impact', .7), (0.67, 'chime', .8), (1.33, 'impact', .9), (2.07, 'pop', .7), (2.67, 'whoosh', .6)]

if KIND == 'telegram':
    plan.update(art=save(reward_art(data['daily'].get('name') or '20x Gems'), 'c/reward.png'), name=short(data['daily'].get('name') or '20 Gems'),
                manual=bool(data.get('manual')))
    frames = 300
    cues = [(0.0, 'impact', .7), (0.4, 'impact', .6), (0.73, 'pop', .9), (1.13, 'whoosh', .7), (2.6, 'pop', .7), (3.07, 'whoosh', .6), (3.6, 'ding', .7)]

plan['duration'] = round(frames / FPS, 3)
sfx.track(cues, plan['duration'], f'{OUT}/sfx.wav')
json.dump(plan, open(f'{OUT}/plan.json', 'w'), ensure_ascii=False)
json.dump(used or {}, open(f'{OUT}/used.json', 'w'), ensure_ascii=False)
print(KIND, plan['duration'], 's')
