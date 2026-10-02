#!/usr/bin/env bash
# プロモのリアクション画像（2〜4コマ目）を PNG に書き出す。Mac の Google Chrome を使う
#   ./docs/promo/shot.sh ldp   → docs/promo/images/自由民主党/2.png, 3.png, 4.png
set -euo pipefail
cd "$(dirname "$0")"
name="${1:?党のファイル名（例：ldp）}"
chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
profile="$(mktemp -d)"
trap 'rm -rf "$profile"' EXIT
dir="$PWD/images/$(python3 build.py "$name")"
mkdir -p "$dir"

for k in 2 3 4; do
  out="$dir/${k}.png"
  rm -f "$out"
  # 書き出したあとも Chrome が終わらないことがあるので、ファイルができたら止める
  "$chrome" --headless=new --disable-gpu --hide-scrollbars --user-data-dir="$profile" \
    --virtual-time-budget=6000 --window-size=1280,720 \
    --screenshot="$out" "file://$PWD/${name}.html#k${k}" >/dev/null 2>&1 &
  pid=$!
  for _ in $(seq 1 60); do [ -s "$out" ] && break; sleep 0.5; done
  sleep 0.5
  kill "$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true
  echo "$out"
done
