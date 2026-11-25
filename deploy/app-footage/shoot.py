"""Walks the Bubble test build on an emulator and keeps what it shows."""
import html, json, os, re, subprocess, sys, time, urllib.request
from xml.etree import ElementTree as ET

PKG = 'net.brawlzone.bubble.test'
ACT = PKG + '/net.brawlzone.bubble.MainActivity'
OUT = 'out'
SITE = 'https://brawlzone.net'
NAMES = ['Nova', 'Kiro', 'Luna', 'Zed', 'Mika']


def adb(*a, raw=False, check=False, t=60):
    r = subprocess.run(['adb', *a], capture_output=True, timeout=t)
    if check and r.returncode:
        print('adb', a, r.stderr.decode()[:300])
    return r.stdout if raw else r.stdout.decode('utf-8', 'replace')


def sh(cmd, t=60):
    return adb('shell', cmd, t=t)


def say(*a):
    print(time.strftime('%H:%M:%S'), *a, flush=True)


def shot(name):
    if name.startswith('live_'):
        return
    png = adb('exec-out', 'screencap', '-p', raw=True)
    open(f'{OUT}/{name}.png', 'wb').write(png)
    say('shot', name, len(png))


def nodes():
    for _ in range(4):
        sh('uiautomator dump --compressed /sdcard/u.xml >/dev/null 2>&1', t=40)
        x = adb('exec-out', 'cat', '/sdcard/u.xml')
        try:
            return list(ET.fromstring(x[x.index('<?xml'):] if '<?xml' in x else x).iter('node'))
        except Exception:
            time.sleep(1.2)
    return []


def centre(n):
    a, b, c, d = map(int, re.findall(r'-?\d+', n.get('bounds')))
    return (a + c) // 2, (b + d) // 2


def find(id=None, text=None, has=None):
    for n in nodes():
        if id and (n.get('resource-id') or '').endswith('/' + id):
            return n
        if text and (n.get('text') or '').strip().lower() == text.lower():
            return n
        if has and has.lower() in ((n.get('text') or '') + ' ' + (n.get('content-desc') or '')).lower():
            return n
    return None


def tap(id=None, text=None, has=None, wait=1.4):
    n = find(id, text, has)
    if n is None:
        say('not found', id or text or has)
        return False
    x, y = centre(n)
    sh(f'input tap {x} {y}')
    time.sleep(wait)
    return True


def start(action=None, wait=5):
    sh(f'am start -n {ACT}' + (f' -a {action}' if action else ''))
    time.sleep(wait)


def stop():
    sh(f'am force-stop {PKG}')
    time.sleep(0.8)


def prefs(name, body):
    xml = "<?xml version='1.0' encoding='utf-8' standalone='yes' ?>\n<map>\n" + body + '\n</map>\n'
    open('p.xml', 'w').write(xml)
    adb('push', 'p.xml', '/data/local/tmp/p.xml')
    d = f'/data/data/{PKG}/shared_prefs'
    sh(f"u=$(stat -c %u /data/data/{PKG}); mkdir -p {d}; cp /data/local/tmp/p.xml {d}/{name}.xml; chown -R $u:$u {d}; chmod 771 {d}; chmod 660 {d}/*.xml; restorecon -R {d}")


def get(path):
    return json.load(urllib.request.urlopen(urllib.request.Request(SITE + path, headers={'User-Agent': 'BrawlZoneBubble'}), timeout=60))


def demo():
    sh('settings put global sysui_demo_allowed 1')
    for c in ('enter', 'clock -e hhmm 1942', 'battery -e level 100 -e plugged false', 'network -e wifi show -e level 4', 'network -e mobile hide', 'notifications -e visible false'):
        sh('am broadcast -a com.android.systemui.demo -e command ' + c + ' >/dev/null')


def record(name, seconds, act):
    p = subprocess.Popen(['adb', 'shell', f'screenrecord --bit-rate 24000000 --time-limit {seconds} /sdcard/{name}.mp4'])
    time.sleep(1.0)
    try:
        act()
    finally:
        p.wait(timeout=seconds + 30)
    adb('pull', f'/sdcard/{name}.mp4', f'{OUT}/{name}.mp4', t=90)
    say('recorded', name)


def page_set(prefix):
    """Every screen of the app, as it is now."""
    start(wait=4)
    tap('nav_home'); time.sleep(2.2)
    shot(prefix + 'home')
    tap('nav_season'); time.sleep(2.5)
    shot(prefix + 'season_rank')
    tap(text='Stats'); time.sleep(2.2)
    shot(prefix + 'season_stats')
    tap(text='Brawlers'); time.sleep(2.2)
    shot(prefix + 'season_brawlers')
    tap(text='K/D'); time.sleep(1.6)
    shot(prefix + 'season_brawlers_kd')
    tap(text='Played'); time.sleep(1)
    if tap(text='Season 50', wait=2.5):
        shot(prefix + 'last_brawlers')
        tap(text='Rank'); time.sleep(2)
        shot(prefix + 'last_rank')
        tap(text='Season 51', wait=1.5)
    tap(text='Rank')
    tap('nav_squad'); time.sleep(2.5)
    shot(prefix + 'squad')
    tap('nav_settings'); time.sleep(1.5)
    shot(prefix + 'settings')


def step(name, f):
    say('---', name)
    try:
        f()
    except Exception as e:
        say('FAILED', name, repr(e)[:300])


tags = [t for t in urllib.request.urlopen(SITE + '/social/viral/' + open('deploy/app-footage/where.txt').read().strip(), timeout=30).read().decode().split() if t]
people = {}
for t in tags:
    try:
        people[t] = get(f'/api/bubble/me?tag={t}&lang=en')['name']
    except Exception as e:
        say('no profile', e)
tags = [t for t in tags if t in people]
say('people', len(tags))

adb('root'); time.sleep(3); adb('wait-for-device')
say(adb('install', '-r', '-g', 'bubble-test.apk', t=180).strip())
sh('settings put system firebase.test.lab true')  # no usage counts from here
sh(f'appops set {PKG} SYSTEM_ALERT_WINDOW allow')
sh(f'pm grant {PKG} android.permission.POST_NOTIFICATIONS')
sh('settings put system accelerometer_rotation 0')
sh('settings put global stay_on_while_plugged_in 3; input keyevent 82; svc power stayon true')
sh('logcat -c; logcat -b crash -c')
demo()


def no_tag():
    start(wait=6)
    shot('notag_home')
    tap('nav_season'); time.sleep(2)
    shot('notag_season')
    tap('nav_squad'); time.sleep(1)
    shot('notag_squad')


step('no tag', no_tag)


def bubble():
    sh('input keyevent 3'); time.sleep(1)
    start('net.brawlzone.bubble.COUNTERS', wait=14)
    shot('bubble_counters')
    sh('input keyevent 3'); time.sleep(2)
    shot('bubble_home')
    sh('settings put system user_rotation 1'); time.sleep(3)
    start('net.brawlzone.bubble.COUNTERS', wait=8)
    shot('bubble_land')
    sh('settings put system user_rotation 0'); time.sleep(2)
    sh(f'am stopservice {PKG}/net.brawlzone.bubble.BubbleService'); time.sleep(1)


step('bubble', bubble)
stop()
prefs('brawlzone-account', f'<string name="tag">{tags[0]}</string>')
prefs('brawlzone-friends', '<string name="tags">' + html.escape(json.dumps(tags[1:5])) + '</string>')


def warm():
    start(wait=14)
    sh('input swipe 540 700 540 1700 400'); time.sleep(16)
    tap('nav_season'); time.sleep(8)
    tap(text='Stats'); time.sleep(4)
    tap(text='Brawlers'); time.sleep(4)
    for _ in range(2):
        sh('input swipe 540 1800 540 700 500'); time.sleep(1.5)
    tap(text='Season 50'); time.sleep(8)
    tap(text='Season 51'); time.sleep(2)
    tap('nav_squad'); time.sleep(6)
    sh('input swipe 540 700 540 1700 400'); time.sleep(16)
    page_set('live_')


step('warm', warm)

# What is kept on the phone, with made-up names, and no way out to fetch the real ones.
stop()
sh('svc wifi disable; svc data disable'); time.sleep(3)


def rename():
    d = f'/data/data/{PKG}/shared_prefs'
    for f in sh(f'ls {d}').split():
        raw = adb('exec-out', 'cat', f'{d}/{f}', raw=True).decode('utf-8', 'replace')
        new = raw
        for i, t in enumerate(tags[:5]):
            n = people[t]
            for form in {n, html.escape(n), json.dumps(n)[1:-1], html.escape(json.dumps(n)[1:-1]), json.dumps(n, ensure_ascii=False)[1:-1]}:
                if form:
                    new = new.replace(form, NAMES[i])
        if new != raw:
            open('r.xml', 'w').write(new)
            adb('push', 'r.xml', '/data/local/tmp/r.xml')
            sh(f'u=$(stat -c %u /data/data/{PKG}); cp /data/local/tmp/r.xml {d}/{f}; chown $u:$u {d}/{f}; chmod 660 {d}/{f}; restorecon {d}/{f}')
            say('renamed in', f)


step('rename', rename)


def notifications():
    start(wait=3)
    tap('nav_settings')
    tap(has='Notifications') or tap(has='alerts')
    time.sleep(1)
    shot('settings_notifications')
    tap('alerts_test'); time.sleep(22)
    sh('cmd statusbar expand-notifications'); time.sleep(2.5)
    shot('notifications')
    sh('cmd statusbar collapse'); time.sleep(1)


step('notifications', notifications)


def look():
    start(wait=3)
    tap('nav_settings')
    tap(has='look'); time.sleep(1.2)
    shot('settings_look')


step('look', look)


def widgets():
    start(wait=3)
    tap('nav_settings')
    tap(has='Widgets'); time.sleep(1.2)
    shot('settings_widgets')
    for i in range(8):
        adds = [n for n in nodes() if (n.get('text') or '').strip().lower() == 'add']
        if not adds:
            break
        x, y = centre(adds[0])
        sh(f'input tap {x} {y}'); time.sleep(2)
        if i == 0:
            shot('widget_dialog')
        if not (tap(has='Add to home', wait=2) or tap(has='Add automatically', wait=2)):
            sh('input keyevent 4')
            break
        start(wait=2)
        if find(text='Add') is None:
            tap('nav_settings'); tap(has='Widgets')
    time.sleep(4)
    sh('input keyevent 3'); time.sleep(3)
    shot('launcher1')
    for i in (2, 3, 4):
        sh('input swipe 950 1200 120 1200 250'); time.sleep(1.6)
        shot(f'launcher{i}')


step('widgets', widgets)


def passes():
    start(wait=3)
    tap('nav_home'); time.sleep(1)
    if tap('pass_card', wait=4):
        shot('pass')
        sh('input swipe 540 1800 540 600 900'); time.sleep(1.2)
        shot('pass2')
        sh('input keyevent 4')
    tap('nav_squad'); time.sleep(1.5)
    if tap('feed_all', wait=3):
        shot('feed')


step('pass', passes)


def motion():
    start(wait=3)
    tap('nav_season'); tap(text='Rank')

    def a():
        for x in ((900, 180), (900, 180), (180, 900), (180, 900)):
            sh(f'input swipe {x[0]} 1400 {x[1]} 1400 120'); time.sleep(1.7)
    record('v_season', 12, a)
    stop()

    def b():
        start(wait=4)
        sh('input swipe 540 1900 540 700 700'); time.sleep(1)
        sh('input swipe 540 1900 540 700 700'); time.sleep(1)
        sh('input swipe 540 700 540 1900 500'); time.sleep(1)
    record('v_home', 12, b)


step('motion', motion)


step('still', lambda: page_set('s_'))
step('still pass', passes)


def tall():
    sh('wm size 1080x7000'); time.sleep(4)
    page_set('t_')
    start(wait=2); tap('nav_home'); time.sleep(1)
    if tap('pass_card', wait=4):
        shot('t_pass')
    sh('wm size reset'); time.sleep(2)


step('tall', tall)

crash = adb('logcat', '-b', 'crash', '-d')
open(f'{OUT}/crash.txt', 'w').write(crash)
app = adb('logcat', '-d', t=90)
open(f'{OUT}/app-log.txt', 'w').write('\n'.join(l for l in app.split('\n') if 'brawlzone' in l.lower() or 'AndroidRuntime' in l)[-200000:])
say('crashes of ours:', len(re.findall(r'Process: ' + re.escape(PKG), crash)))
