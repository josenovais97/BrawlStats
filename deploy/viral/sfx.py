"""Sound effects, synthesised (2026-11-19, the Bubble promo v2: "make it real
pro"). No sample packs, so nothing to license: every sound is a few lines of
numpy. Mono float32 at SR, peaks around -6 dBFS; `track()` lays cues on a
timeline and writes one WAV the job mixes under the music and the voice.
"""
import math, wave
import numpy as np

SR = 44100
_rng = np.random.default_rng(7)


def _t(d): return np.arange(int(d * SR)) / SR


def _norm(x, peak=0.5):
    m = float(np.max(np.abs(x))) or 1.0
    return (x / m * peak).astype(np.float32)


def _onepole(x, cut):
    """Low-pass with a cutoff (Hz) per sample."""
    a = np.exp(-2 * np.pi * np.asarray(cut, dtype=np.float64) / SR) * np.ones(len(x))
    y = np.empty_like(x); acc = 0.0
    for i in range(len(x)):
        acc = (1 - a[i]) * x[i] + a[i] * acc
        y[i] = acc
    return y


def _sweep(f0, f1, d):
    t = _t(d); f = f0 * (f1 / f0) ** (t / d)
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def whoosh(d=0.42):
    t = _t(d); n = _rng.standard_normal(len(t))
    cut = 300 + 5200 * np.sin(np.pi * t / d) ** 2
    lo = _onepole(n, cut); hi = n - _onepole(n, 900)
    env = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 1.6
    return _norm((lo * 0.8 + hi * 0.15) * env, 0.42)


def tap():
    t = _t(0.05)
    return _norm(np.sin(2 * np.pi * 2300 * t) * np.exp(-t * 90) + _rng.standard_normal(len(t)) * np.exp(-t * 300) * 0.4, 0.38)


def pop():
    d = 0.11; t = _t(d)
    return _norm(_sweep(950, 260, d) * np.exp(-t * 32), 0.45)


def ding():
    d = 0.9; t = _t(d); x = np.zeros_like(t)
    for f, a in ((1318.5, 1), (2637, 0.42), (3956, 0.18), (1975.5, 0.3)):
        x += a * np.sin(2 * np.pi * f * t) * np.exp(-t * (4 + f / 900))
    return _norm(x * (1 - np.exp(-t * 400)), 0.4)


def chime():
    """Two rising notes: a win, a rank up."""
    d = 0.9; t = _t(d); x = np.zeros(len(t) + int(0.11 * SR))
    for k, base in enumerate((1046.5, 1568)):
        o = int(k * 0.11 * SR)
        for f, amp in ((base, 1), (base * 2, 0.35), (base * 3, 0.12)):
            x[o:o + len(t)] += amp * np.sin(2 * np.pi * f * t) * np.exp(-t * 5)
    return _norm(x, 0.42)


def impact():
    d = 0.7; t = _t(d)
    boom = _sweep(110, 38, d) * np.exp(-t * 6)
    hit = _onepole(_rng.standard_normal(len(t)), 1800) * np.exp(-t * 28)
    return _norm(np.tanh(2.2 * (boom + hit * 0.9)), 0.55)


def buzz():
    """The loss: two low, rough notes going down."""
    x = []
    for f in (196, 147):
        t = _t(0.16); s = np.sign(np.sin(2 * np.pi * f * t)) * 0.5 + np.sin(2 * np.pi * f * t) * 0.5
        x.append(_onepole(s, 1400) * np.exp(-t * 6)); x.append(np.zeros(int(0.03 * SR)))
    return _norm(np.concatenate(x), 0.38)


def riser(d=1.0):
    t = _t(d); n = _onepole(_rng.standard_normal(len(t)), 600 + 6000 * (t / d) ** 2)
    tone = _sweep(220, 1100, d) * 0.25
    return _norm((n + tone) * (t / d) ** 2.2, 0.36)


SOUNDS = {'whoosh': whoosh, 'tap': tap, 'pop': pop, 'ding': ding, 'chime': chime, 'impact': impact, 'buzz': buzz, 'riser': riser}


def track(cues, duration, path, gain=0.9):
    """cues: (seconds, name[, gain]) -> a mono 16-bit WAV of `duration` seconds."""
    out = np.zeros(int(duration * SR) + SR, dtype=np.float32)
    cache = {}
    for cue in cues:
        at, name = cue[0], cue[1]; g = cue[2] if len(cue) > 2 else 1.0
        if name not in cache: cache[name] = SOUNDS[name]()
        s = cache[name]; i = max(0, int(at * SR)); j = min(len(out), i + len(s))
        if j > i: out[i:j] += s[:j - i] * g
    out = np.tanh(out[:int(duration * SR)] * gain)
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(out, -1, 1) * 32767).astype('<i2').tobytes())
