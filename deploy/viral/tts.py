"""Kokoro text to speech for the narrated Shorts (2026-11-19, the Bubble promo
v4: owner "make sure the voice is nice"). Kokoro-82M through kokoro-onnx, on
the box's CPU, no account and no API: the package lives in
$ASSETS/kokoro-py, the model and voices in $ASSETS/kokoro (both from
kokoro-onnx's model-files-v1.0 release).

    PYTHONPATH=$ASSETS/kokoro-py python tts.py <model dir> <voice> <speed> < lines

Each input line is "<out.wav><TAB><text>"; the model loads once for all of
them. Writes 16-bit mono WAV at Kokoro's 24 kHz. A voice can be a blend,
"am_michael:0.6+am_puck:0.4".
"""
import os
import sys
import wave

import numpy as np
from kokoro_onnx import Kokoro


def main():
    model_dir, voice, speed = sys.argv[1:4]
    jobs = [ln.split('\t', 1) for ln in sys.stdin.read().splitlines() if '\t' in ln]
    k = Kokoro(f'{model_dir}/kokoro-v1.0.onnx', f'{model_dir}/voices-v1.0.bin')
    if '+' in voice or ':' in voice:
        style = None
        for part in voice.split('+'):
            name, _, w = part.partition(':')
            v = k.get_voice_style(name) * float(w or 1)
            style = v if style is None else style + v
        voice = style
    for out, text in jobs:
        samples, rate = k.create(text.strip(), voice=voice, speed=float(speed), lang='en-us')
        pcm = (np.clip(samples, -1, 1) * 32767).astype('<i2')
        with wave.open(out + '.part', 'wb') as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate); w.writeframes(pcm.tobytes())
        os.replace(out + '.part', out)
        print(out, round(len(samples) / rate, 2), flush=True)


if __name__ == '__main__':
    main()
