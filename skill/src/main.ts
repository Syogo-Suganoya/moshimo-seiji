// スキルの入口：node moshimo.mjs <コマンド> ...
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { run } from './cli';

const { code, out } = run(process.argv.slice(2), {
  read: (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null),
  write: (p, t) => writeFileSync(p, t),
  env: (n) => process.env[n],
  now: () => Date.now(),
});
process.stdout.write((typeof out === 'string' ? out : JSON.stringify(out, null, 2)) + '\n');
process.exitCode = code;
