// node render.mjs stills|video <plan dir> <out> [frames...]
// Bundles src once with <plan dir>/public as the public folder, then renders
// the composition the plan's kind belongs to: stills of the given frames
// (out = a folder) or the whole video, silent (out = an .mp4; the job lays
// the music under it with ffmpeg, as for the Pillow videos).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {bundle} from '@remotion/bundler';
import {renderMedia, renderStill, selectComposition} from '@remotion/renderer';

const [mode, dir, out, ...frames] = process.argv.slice(2);
const plan = JSON.parse(fs.readFileSync(path.join(dir, 'plan.json'), 'utf8'));
const id = plan.kind.endsWith('quiz') ? 'Quiz' : 'Countdown';
const here = path.dirname(new URL(import.meta.url).pathname);
const serveUrl = await bundle({entryPoint: path.join(here, 'src/index.ts'), publicDir: path.resolve(dir, 'public')});
const inputProps = {plan};
const composition = await selectComposition({serveUrl, id, inputProps});
const concurrency = Math.max(1, Math.min(2, os.cpus().length));
if (mode === 'stills') {
  fs.mkdirSync(out, {recursive: true});
  for (const f of frames) {
    await renderStill({composition, serveUrl, inputProps, frame: Number(f), output: path.join(out, `f${String(f).padStart(4, '0')}.jpg`),
      imageFormat: 'jpeg', jpegQuality: 88});
  }
} else {
  let last = 0;
  await renderMedia({composition, serveUrl, inputProps, codec: 'h264', crf: 18, muted: true, outputLocation: out, concurrency,
    onProgress: ({progress}) => { if (progress - last >= 0.1) { last = progress; console.log(`rendered ${Math.round(progress * 100)}%`); } }});
}
console.log(id, mode, 'done', composition.durationInFrames, 'frames');
