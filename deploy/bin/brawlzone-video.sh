# shellcheck shell=bash
# render_video, sourced by the jobs that turn slides into a vertical video
# (2026-10-21): brawlzone-tiktok (the TikTok video and the YouTube Short) and
# brawlzone-rate. Moved out of brawlzone-tiktok so a second caller does not
# need a copy. Callers set SLIDES (one URL per line); FFMPEG_IMAGE may be set
# to override the pinned image below.

# Pinned like everything else on the box: a floating tag would be pulled
# fresh the first time a post needs it.
: "${FFMPEG_IMAGE:=lscr.io/linuxserver/ffmpeg:9.0-cli-ls84}"

# Renders the slides into ${work}/out.mp4, into VIDEO_SIZE. Returns 1 with
# VIDEO_ERR set. Shared by the TikTok video and the YouTube Short.
#
# With a music file the soundtrack is that track, faded in and out; without
# one it stays silent. Only the YouTube Short passes one: on TikTok a trending
# sound is added by hand in the app, and a baked-in track would fight it.
#
# With a banner (a transparent PNG) it slides in over the top of the cover:
# the Short's subscribe ask, for the many who never reach the last slide.
render_video () { # work dir [music file] [banner png]
  local work="$1" music="${2:-}" banner="${3:-}" n=0 slide size
  local -a args
  if [ -n "$music" ]; then
    cp "$music" "${work}/music.mp3" || { VIDEO_ERR="could not read ${music}"; return 1; }
  fi
  if [ -n "$banner" ]; then
    cp "$banner" "${work}/banner.png" || { VIDEO_ERR="could not read ${banner}"; return 1; }
  fi

  while IFS= read -r slide; do
    [ -n "$slide" ] || continue
    curl -sf --max-time 240 -o "${work}/s${n}.jpg" "$slide" || { VIDEO_ERR="could not download ${slide}"; return 1; }
    n=$((n + 1))
  done <<< "$SLIDES"

  # One argument per line. The filter graph has no spaces in it, so nothing
  # here needs quoting beyond that.
  mapfile -t args < <(python3 - "$n" "$([ -n "$music" ] && echo 1 || echo 0)" "$([ -n "$banner" ] && echo 1 || echo 0)" <<'PY'
import random, sys
n, music, banner = int(sys.argv[1]), sys.argv[2] == '1', sys.argv[3] == '1'
FPS, T = 30, 0.4  # frame rate, slide-in length
# The cover is the hook and is short; the last slide (the site) is shorter
# still. The rest get four seconds, about what a ten-row list needs.
dur = [2.6] + [4.0] * (n - 2) + [2.4] if n >= 3 else [3.5] * n
if music:
    # The Short's last slide is the subscribe ask: long enough to act on.
    dur[-1] = 3.5
args = ['-hide_banner', '-loglevel', 'error', '-y']
for i in range(n):
    args += ['-i', f'/w/s{i}.jpg']
# A silent soundtrack. Without one TikTok takes the whole file (201, every
# byte counted) and then never finishes processing it: on 2026-10-13 a
# video-only upload sat in PROCESSING_UPLOAD for good while the same video
# with this track added reached the inbox in twenty seconds.
if music:
    # A few seconds in, skipping the quiet intro most library tracks open with.
    args += ['-ss', str(random.randint(4, 15)), '-stream_loop', '-1', '-i', '/w/music.mp3']
else:
    args += ['-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo']
if banner:
    args += ['-loop', '1', '-i', '/w/banner.png']  # input n + 1
parts = []
for i in range(n):
    frames = round(dur[i] * FPS)
    out = 'v0raw' if i == 0 and banner else f'v{i}'
    # Upscaled first: zoompan rounds its crop to whole pixels, which makes a
    # slow zoom at 1080 wide visibly shimmer. Ends 5% in, which stays inside
    # the slides' safe margins.
    parts.append(
        f"[{i}:v]scale=2160:3840,zoompan=z='1+0.05*on/{frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
        f":d={frames}:s=1080x1920:fps={FPS},setsar=1,format=yuv420p[{out}]"
    )
if banner:
    # Drops in from above the frame a quarter-second in, over the logo row.
    parts.append(f'[{n + 1}:v]format=rgba[bn]')
    parts.append("[v0raw][bn]overlay=x=(W-w)/2:y='60-220*max(0,1-(t-0.25)/0.3)'"
                 ":shortest=1:enable='gte(t,0.25)',format=yuv420p[v0]")
last, offset = 'v0', 0.0
for i in range(1, n):
    offset += dur[i - 1] - T
    parts.append(f'[{last}][v{i}]xfade=transition=slideleft:duration={T}:offset={offset:.2f}[x{i}]')
    last = f'x{i}'
audio = f'{n}:a'
if music:
    total = sum(dur) - T * (n - 1)
    parts.append(f'[{n}:a]volume=0.8,afade=t=in:d=0.6,afade=t=out:st={total - 1.5:.2f}:d=1.5[a]')
    audio = '[a]'
args += ['-filter_complex', ';'.join(parts), '-map', f'[{last}]', '-map', audio, '-shortest', '-r', str(FPS),
         '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
         '-c:a', 'aac', '-b:a', '64k',
         '-movflags', '+faststart', '/w/out.mp4']
print('\n'.join(args))
PY
  )
  [ "${#args[@]}" -gt 10 ] || { VIDEO_ERR="could not build the ffmpeg arguments"; return 1; }

  if ! docker run --rm -v "${work}:/w" "$FFMPEG_IMAGE" "${args[@]}" > "${work}/ffmpeg.log" 2>&1; then
    VIDEO_ERR="ffmpeg failed: $(tail -c 300 "${work}/ffmpeg.log")"
    return 1
  fi
  size=$(stat -c %s "${work}/out.mp4" 2>/dev/null)
  # Under 64 MB TikTok takes the file as one chunk; these run 2-6 MB.
  if [ "${size:-0}" -lt 100000 ] || [ "$size" -gt 60000000 ]; then
    VIDEO_ERR="the rendered video is ${size:-0} bytes"
    return 1
  fi
  echo "video rendered: ${n} slides, ${size} bytes"
  VIDEO_SIZE=$size
}
