#!/bin/sh
# スキル版をビルドする。
#   skill/moshimo-seiji/scripts/moshimo.mjs … エンジンと data/*.json を1ファイルにまとめたコマンド
#   dist/moshimo-seiji.zip                  … claude.ai にアップロードする zip（Claude Code のプラグイン定義は除く）
# Docker では：docker compose exec web ./scripts/build_skill.sh
set -eu
cd "$(dirname "$0")/.."

npm run build -w skill

mkdir -p dist
rm -f dist/moshimo-seiji.zip
(cd skill && zip -qr ../dist/moshimo-seiji.zip moshimo-seiji -x '*.DS_Store' 'moshimo-seiji/.claude-plugin/*')
echo "built dist/moshimo-seiji.zip"
