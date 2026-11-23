#!/usr/bin/env bash
# Re-encodes bundled landing videos (H.264 High 4.2, CRF 24, no audio, faststart, no tmcd)
# in place. A re-encode replaces the original only when it saves at least 10% and its SSIM
# against the source (scaled to the same width) is at least 0.97. Otherwise the original
# stays. The 10% minimum makes a re-run a no-op; always run it on the original, never on
# an output.
#   scripts/encode-videos.sh public/videos/tutor2.mp4 [more files]
#   WIDTH=720 scripts/encode-videos.sh <file>    override the width from the table
# Files are required: every run re-encodes its input, so a run over the whole folder would
# re-encode files that are already encoded (generation loss).
# Widths are 2x the largest rendered CSS width, capped at the source (never upscaled).
set -euo pipefail

THRESHOLD=0.97
TMP=""
trap 'rc=$?; rm -f "${TMP:-}"; exit $rc' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

for bin in ffmpeg ffprobe; do
  command -v "$bin" >/dev/null 2>&1 || {
    echo "encode-videos: $bin not found on PATH (Homebrew: brew install ffmpeg)" >&2
    exit 1
  }
done

# Target width per file. how-to: 1231 px wide at most (1279 px viewport), 2x is above the
# 1920 px source. Showcase tutor cards: 461 px at lg and up, so 2x is 922. tutor1 is 720 wide.
target_width() {
  case "$1" in
    how-to-guardians.mp4 | how-to-tutor.mp4) echo 1920 ;;
    tutor1.mp4) echo 720 ;;
    tutor2.mp4 | tutor3.mp4 | tutor4.mp4 | tutor5.mp4 | tutor6.mp4 | tutor7.mp4 | tutor8.mp4)
      echo 922 ;;
    *) echo "" ;;
  esac
}

megabytes() {
  awk -v b="$1" 'BEGIN { printf "%.1f MB", b / 1000000 }'
}

encode() {
  local src="$1" name dir src_w target old new ssim log decision
  name="$(basename "$src")"
  dir="$(dirname "$src")"

  if [ -n "${WIDTH:-}" ]; then
    target="$WIDTH"
  else
    target="$(target_width "$name")"
  fi
  case "$target" in
    '')
      echo "encode-videos: no target width for $name; set WIDTH=<px>" >&2
      exit 1
      ;;
    *[!0-9]*)
      echo "encode-videos: WIDTH must be a whole number of pixels" >&2
      exit 1
      ;;
  esac

  # A file with a data stream prints the width twice, so keep the first line only.
  src_w="$(ffprobe -v error -select_streams v:0 -show_entries stream=width \
    -of csv=p=0 "$src" | sed -n '1p')"
  if [ "$target" -gt "$src_w" ]; then
    target="$src_w"
  fi
  target=$((target - target % 2))

  TMP="$dir/.$name.encoding.mp4"
  ffmpeg -hide_banner -loglevel error -y -i "$src" -map 0:v:0 \
    -vf "scale=$target:-2" \
    -c:v libx264 -crf 24 -preset slow -pix_fmt yuv420p -profile:v high -level:v 4.2 -an \
    -write_tmcd 0 -movflags +faststart -f mp4 "$TMP"

  log="$(ffmpeg -hide_banner -nostats -i "$TMP" -i "$src" \
    -lavfi "[1:v]scale=$target:-2[ref];[0:v][ref]ssim" -f null - 2>&1 || true)"
  ssim="$(printf '%s\n' "$log" | sed -n 's/.*All:\([0-9.]*\).*/\1/p' | tail -n 1)"
  if [ -z "$ssim" ]; then
    echo "encode-videos: SSIM failed for $name" >&2
    exit 1
  fi

  old="$(wc -c < "$src" | tr -d ' ')"
  new="$(wc -c < "$TMP" | tr -d ' ')"
  if [ "$new" -gt $((old * 9 / 10)) ]; then
    decision="kept (saves under 10%)"
  elif ! awk -v s="$ssim" -v t="$THRESHOLD" 'BEGIN { exit !(s >= t) }'; then
    decision="kept (SSIM below $THRESHOLD)"
  else
    mv -f "$TMP" "$src"
    decision="replaced"
  fi
  [ "$decision" = replaced ] || rm -f "$TMP"
  TMP=""

  printf '%-22s %5spx  %9s -> %9s  SSIM %.4f  %s\n' "$name" "$target" \
    "$(megabytes "$old")" "$(megabytes "$new")" "$ssim" "$decision"
}

if [ "$#" -eq 0 ]; then
  echo "usage: scripts/encode-videos.sh <file.mp4> [more files]" >&2
  echo "       WIDTH=<px> scripts/encode-videos.sh <file.mp4>   override the width" >&2
  exit 1
fi

for f in "$@"; do
  encode "$f"
done
