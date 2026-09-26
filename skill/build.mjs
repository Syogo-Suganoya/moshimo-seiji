// スキルのコマンドを1ファイルにまとめる。エンジンと data/*.json も中に埋め込むので、依存なしに node で動く
import { build } from 'esbuild';

await build({
  entryPoints: ['src/main.ts'],
  outfile: 'moshimo-seiji/scripts/moshimo.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  legalComments: 'none',
  banner: { js: '#!/usr/bin/env node\n// 生成されたファイル。編集せず、skill/src を直して scripts/build_skill.sh で作り直す' },
});
console.log('built moshimo-seiji/scripts/moshimo.mjs');
