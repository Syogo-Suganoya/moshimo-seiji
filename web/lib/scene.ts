// 背景パターン（状況に応じて差し替え）。本番は事前に画像生成した7枚を使う。プロンプトは docs/background_prompts.md
import type { SceneKind } from '@moshimo/engine';

interface Scene {
  name: string;
  cap: string;
  sky: [string, string, string];
  b: [string, string, string];
  win: string;
  lit: number;
  sun?: [string, number, number];
  clouds?: 1;
  dim?: 1;
  stars?: 1;
  moon?: 1;
  crowd?: 1;
  cranes?: 1;
  tall?: 1;
  mountains?: 1;
  trees?: 1;
  rain?: 1;
  ships?: 1;
}

export const SCENES: Record<SceneKind, Scene> = {
  good: { name: '順調', cap: '順調｜夕暮れの東京。街は穏やかに回っている', sky: ['#6f7fd6', '#f59a8b', '#ffd29a'], b: ['#7d6aa8', '#9c7fb8', '#b995c2'], win: '#ffe07a', lit: 0.35, sun: ['#ffdf6e', 1180, 560] },
  stall: { name: '停滞', cap: '停滞｜どんよりした空。閉まった店が目立つ', sky: ['#8f9bb0', '#a9b2c2', '#c3c9d3'], b: ['#6b7488', '#7c8599', '#8e97a9'], win: '#e8dcae', lit: 0.1, clouds: 1, dim: 1 },
  ruin: { name: '荒廃', cap: '荒廃｜夜の官邸前に、抗議の群衆', sky: ['#141735', '#23265a', '#3a2a5c'], b: ['#1d2046', '#262a58', '#30356a'], win: '#ffb86b', lit: 0.3, stars: 1, moon: 1, crowd: 1, dim: 1 },
  urban: { name: '都市化', cap: '都市化｜再開発が進み、クレーンが空を埋める', sky: ['#4f9fe8', '#8fcbf5', '#d6eefc'], b: ['#5a6bb8', '#6b7fc8', '#8fa0d8'], win: '#fff2b0', lit: 0.5, sun: ['#fff3b0', 1320, 150], cranes: 1, tall: 1 },
  rural: { name: '地方化', cap: '地方化｜山並みと田畑が広がり、町がゆっくり息をする', sky: ['#8fd3c7', '#ffe3a8', '#fff3d6'], b: ['#9c8a7a', '#b7a48f', '#cdbba5'], win: '#ffe07a', lit: 0.3, sun: ['#ffd98a', 300, 520], mountains: 1, trees: 1 },
  disaster: { name: '災害', cap: '災害｜暴風雨。各地で被害が出ている', sky: ['#2d4552', '#3f5a67', '#58727d'], b: ['#28404b', '#324c58', '#3d5864'], win: '#b9e0f0', lit: 0.08, clouds: 1, rain: 1, dim: 1 },
  tension: { name: '緊張', cap: '緊張｜湾の沖合に艦影。外交の緊張が高まる', sky: ['#6b2340', '#c2474a', '#ff8a5c'], b: ['#5a2240', '#6e2a4c', '#833458'], win: '#ffcf8a', lit: 0.2, ships: 1, sun: ['#ffd6a0', 1270, 600] },
};

function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

let svgN = 0;
export function sceneSVG(kind: SceneKind): string {
  const P = SCENES[kind], r = rng(11), u = kind + ++svgN, O = '#1f2244', sw = 3;
  let s = `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="k${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.sky[0]}"/><stop offset=".6" stop-color="${P.sky[1]}"/><stop offset="1" stop-color="${P.sky[2]}"/></linearGradient></defs>
  <rect width="1600" height="900" fill="url(#k${u})"/>`;
  if (P.stars) for (let i = 0; i < 70; i++) { const x = r() * 1600, y = r() * 380, z = r() * 3 + 2; s += `<path d="M${x} ${y - z}L${x + z * 0.3} ${y - z * 0.3}L${x + z} ${y}L${x + z * 0.3} ${y + z * 0.3}L${x} ${y + z}L${x - z * 0.3} ${y + z * 0.3}L${x - z} ${y}L${x - z * 0.3} ${y - z * 0.3}Z" fill="#fff" opacity="${0.4 + r() * 0.6}"/>`; }
  if (P.moon) s += `<circle cx="1320" cy="140" r="40" fill="#fff3c4" stroke="${O}" stroke-width="${sw}"/><circle cx="1305" cy="130" r="7" fill="#e9dca8"/><circle cx="1332" cy="155" r="5" fill="#e9dca8"/>`;
  if (P.sun) s += `<circle cx="${P.sun[1]}" cy="${P.sun[2]}" r="110" fill="#fff" opacity=".18"/><circle cx="${P.sun[1]}" cy="${P.sun[2]}" r="70" fill="${P.sun[0]}" stroke="${O}" stroke-width="${sw}"/>`;
  const cloud = (x: number, y: number, sc: number, c: string) => `<g transform="translate(${x} ${y}) scale(${sc})"><path d="M-80 20 Q-80 -10 -50 -10 Q-40 -45 0 -40 Q35 -60 60 -25 Q95 -25 95 10 Q95 25 80 25 H-70 Q-80 25 -80 20Z" fill="${c}" stroke="${O}" stroke-width="${sw / sc}"/></g>`;
  const cc = P.clouds ? (kind === 'disaster' ? '#5c7480' : '#d2d7e0') : '#fff7ea';
  ([[240, 150, 1], [700, 110, 0.8], [1000, 190, 1.1], [1450, 130, 0.9]] as const).forEach(([x, y, sc], i) => { if (P.clouds || i % 2 === 0) s += cloud(x, y, sc * (P.clouds ? 1.5 : 1), cc); });
  // 奥：山並み（地方化）／ビル群（高層化で背が伸びる）
  let x = 0;
  if (P.mountains) {
    s += `<path d="M-20 660 L160 420 L300 560 L470 380 L640 560 L820 430 L1000 580 L1180 400 L1380 570 L1540 440 L1640 560 L1640 700 L-20 700Z" fill="#7fb59a" stroke="${O}" stroke-width="${sw}"/><path d="M440 420 L470 380 L500 420 M1150 440 L1180 400 L1210 440" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/>`;
    while (x < 1600) { const w = 60 + r() * 50, h = 40 + r() * 50; s += `<rect x="${x}" y="${650 - h}" width="${w}" height="${h + 30}" rx="6" fill="${P.b[2]}" stroke="${O}" stroke-width="${sw}"/>`; x += w + 60 + r() * 80; }
  } else while (x < 1600) { const w = 50 + r() * 70, h = (90 + r() * 170) * (P.tall ? 1.7 : 1); s += `<rect x="${x}" y="${640 - h}" width="${w}" height="${h + 30}" rx="6" fill="${P.b[2]}" stroke="${O}" stroke-width="${sw}"/>`; x += w - 3; }
  const win = (x0: number, y0: number, w: number, h: number, cols: number, rows: number) => { let o = ''; const cw = (w - 16) / cols, rh = (h - 18) / rows; for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) o += `<rect x="${(x0 + 8 + i * cw + 2).toFixed(1)}" y="${(y0 + 10 + j * rh + 2).toFixed(1)}" width="${(cw - 6).toFixed(1)}" height="${(rh - 7).toFixed(1)}" rx="2" fill="${r() < P.lit ? P.win : '#00000030'}"/>`; return o; };
  // タワー
  const tc = P.dim && !P.crowd ? '#8e97a9' : '#ff6b57';
  s += `<path d="M1150 660 L1172 330 H1188 L1210 660 Z" fill="${tc}" stroke="${O}" stroke-width="${sw}"/><rect x="1140" y="560" width="80" height="16" rx="3" fill="#fff" stroke="${O}" stroke-width="${sw}"/><rect x="1160" y="440" width="40" height="12" rx="3" fill="#fff" stroke="${O}" stroke-width="${sw}"/><line x1="1180" y1="330" x2="1180" y2="270" stroke="${O}" stroke-width="5"/><circle cx="1180" cy="266" r="7" fill="#ff6b57" stroke="${O}" stroke-width="2" class="blink"/>`;
  // 海
  s += `<rect x="1380" y="700" width="230" height="210" fill="${kind === 'tension' ? '#6a3a6a' : '#4f7fcf'}" stroke="${O}" stroke-width="${sw}"/>`;
  for (let i = 0; i < 5; i++) s += `<path d="M${1400 + r() * 150} ${720 + i * 18} q10 -6 20 0 t20 0" stroke="#fff" stroke-width="3" fill="none" opacity=".5" stroke-linecap="round"/>`;
  if (P.ships) for (const [sx, sy, sc] of [[1450, 736, 1], [1545, 760, 0.8], [1415, 790, 1.1]]) s += `<g transform="translate(${sx} ${sy}) scale(${sc})"><g class="bob"><path d="M-46 0h92l-14 16h-64z" fill="#4a4e6e" stroke="${O}" stroke-width="3"/><rect x="-16" y="-18" width="28" height="18" rx="3" fill="#6a6e8e" stroke="${O}" stroke-width="3"/><rect x="-3" y="-34" width="5" height="16" fill="${O}"/></g></g>`;
  else s += `<g transform="translate(1480 750)"><g class="bob"><path d="M-50 0h100l-14 16h-72z" fill="#fff" stroke="${O}" stroke-width="3"/><rect x="-30" y="-18" width="50" height="18" rx="3" fill="#ff6b57" stroke="${O}" stroke-width="3"/></g></g>`;
  // 田んぼの丘
  s += `<path d="M-10 700 Q90 630 210 690 L210 910 L-10 910Z" fill="${P.dim ? '#6b8a6a' : '#6fcf7a'}" stroke="${O}" stroke-width="${sw}"/>`;
  for (let i = 0; i < 4; i++) s += `<path d="M0 ${725 + i * 22} Q95 ${705 + i * 22} 205 ${720 + i * 22}" stroke="${O}" stroke-width="2" fill="none" opacity=".25"/>`;
  s += `<path d="M52 692 l34 -26 l34 26 v26 h-68z" fill="#fff5e1" stroke="${O}" stroke-width="${sw}"/><path d="M46 694 l40 -32 l40 32" fill="none" stroke="#ff6b57" stroke-width="7" stroke-linejoin="round"/>`;
  // 団地
  for (const [bx, by, bw, bh] of [[205, 600, 125, 112], [252, 552, 100, 52], [334, 622, 58, 90]]) s += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="5" fill="${P.b[1]}" stroke="${O}" stroke-width="${sw}"/>` + win(bx, by, bw, bh, 5, 4);
  // 国会議事堂風
  s += `<g stroke="${O}" stroke-width="${sw}"><rect x="400" y="620" width="240" height="92" rx="4" fill="#efe3c8"/><rect x="478" y="562" width="84" height="58" fill="#efe3c8"/><rect x="494" y="524" width="52" height="38" fill="#efe3c8"/><path d="M490 526 L520 470 L550 526Z" fill="#9fd0c0"/></g>`;
  for (let i = 0; i < 9; i++) s += `<rect x="${414 + i * 25}" y="640" width="10" height="56" rx="3" fill="${P.lit > 0.2 ? '#d9c7a0' : '#cbbd9f'}" stroke="${O}" stroke-width="2"/>`;
  // オフィス街
  x = 700;
  const oc = [P.b[0], P.b[1], '#5a6bb8', '#6b5aa8'];
  let k = 0;
  while (x < 1125) { const w = 58 + r() * 44, h = (180 + r() * 210) * (P.mountains ? 0.6 : P.tall ? 1.15 : 1); s += `<rect x="${x}" y="${718 - h}" width="${w}" height="${h}" rx="5" fill="${P.dim ? P.b[k % 2] : oc[k % 4]}" stroke="${O}" stroke-width="${sw}"/>` + win(x, 718 - h, w, h, 3, Math.floor(h / 32)); x += w + 6; k++; }
  // クレーン（都市化）
  if (P.cranes) for (const [cx, top] of [[760, 170], [1060, 230], [330, 330]]) s += `<g stroke="${O}" stroke-width="3" fill="#ffc93c"><rect x="${cx - 6}" y="${top}" width="12" height="${720 - top}"/><rect x="${cx - 70}" y="${top - 12}" width="170" height="12"/><rect x="${cx - 70}" y="${top - 12}" width="24" height="26" fill="#1f2244"/></g><line x1="${cx + 80}" y1="${top}" x2="${cx + 80}" y2="${top + 90}" stroke="${O}" stroke-width="2"/><rect x="${cx + 70}" y="${top + 90}" width="20" height="14" fill="#ff6b57" stroke="${O}" stroke-width="2"/>`;
  // 木々（地方化）
  if (P.trees) for (let i = 0; i < 16; i++) { const tx = 220 + i * 72 + r() * 20, ty = 700 + r() * 8; s += `<rect x="${tx - 3}" y="${ty}" width="6" height="14" fill="#8a5a3a"/><circle cx="${tx}" cy="${ty - 8}" r="${14 + r() * 6}" fill="${i % 2 ? '#5fbf6f' : '#7fd08a'}" stroke="${O}" stroke-width="2.5"/>`; }
  // 大学
  s += `<g stroke="${O}" stroke-width="${sw}"><rect x="1236" y="612" width="176" height="100" rx="4" fill="#e9b98a"/><rect x="1302" y="516" width="44" height="96" fill="#e9b98a"/><path d="M1296 518 L1324 470 L1352 518Z" fill="#8c6cf2"/><circle cx="1324" cy="548" r="14" fill="#fff"/></g><path d="M1324 548v-8M1324 548h7" stroke="${O}" stroke-width="3"/>` + win(1236, 612, 176, 100, 6, 3);
  // 道路・商店街
  s += `<rect x="200" y="712" width="1190" height="200" fill="#3a3d63" stroke="${O}" stroke-width="${sw}"/>`;
  for (let i = 0; i < 14; i++) s += `<rect x="${230 + i * 85}" y="860" width="40" height="8" rx="4" fill="#fff" opacity=".5"/>`;
  x = 450;
  const aw = ['#ff6b57', '#5ab4ff', '#ffc93c', '#35cfa1', '#8c6cf2'];
  for (let i = 0; i < 8; i++) {
    const open = kind === 'stall' ? r() < 0.25 : r() < 0.9;
    s += `<rect x="${x}" y="738" width="48" height="50" rx="3" fill="${open ? '#fff5e1' : '#a3a9bd'}" stroke="${O}" stroke-width="${sw}"/>` + (open ? `<path d="M${x - 4} 738 h56 l-6 14 h-44z" fill="${aw[i % 5]}" stroke="${O}" stroke-width="${sw}" stroke-linejoin="round"/><rect x="${x + 12}" y="758" width="24" height="24" rx="3" fill="${P.win}" stroke="${O}" stroke-width="2"/>` : [0, 1, 2, 3].map((j) => `<line x1="${x + 4}" y1="${748 + j * 10}" x2="${x + 44}" y2="${748 + j * 10}" stroke="${O}" stroke-width="2" opacity=".5"/>`).join(''));
    x += 54;
  }
  // 工場
  s += `<g stroke="${O}" stroke-width="${sw}" stroke-linejoin="round"><path d="M1030 742 v-30 l30 -18 v18 l30 -18 v18 l30 -18 v48z" fill="#b9bfd6"/><rect x="1030" y="742" width="130" height="50" fill="#b9bfd6"/><rect x="1140" y="660" width="18" height="82" fill="#ff6b57"/></g>`;
  if (kind !== 'stall') for (let i = 0; i < 3; i++) s += `<circle cx="1146" cy="652" r="${9 + i * 3}" fill="#fff" opacity="0"><animate attributeName="cy" values="652;610" dur="6s" begin="${i * 2}s" repeatCount="indefinite"/><animate attributeName="cx" values="1146;1120" dur="6s" begin="${i * 2}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;.55;0" dur="6s" begin="${i * 2}s" repeatCount="indefinite"/></circle>`;
  // 群衆
  if (P.crowd) {
    const cols = ['#ff6b57', '#5ab4ff', '#ffc93c', '#35cfa1', '#c7b8ff'];
    for (let i = 0; i < 110; i++) { const cx = 320 + r() * 730, cy = 812 + r() * 70; s += `<g class="${i % 3 ? '' : 'bob'}" style="animation-delay:${r()}s"><rect x="${cx - 9}" y="${cy + 4}" width="18" height="24" rx="6" fill="${cols[i % 5]}" stroke="${O}" stroke-width="2"/><circle cx="${cx}" cy="${cy}" r="8" fill="#ffd9b8" stroke="${O}" stroke-width="2"/></g>`; }
    ['NO!', '退陣', '生活を守れ', '説明して', '増税反対'].forEach((t, k2) => { const px = 380 + k2 * 145, py = 770; s += `<g class="bob" style="animation-delay:${k2 * 0.25}s"><line x1="${px}" y1="${py}" x2="${px}" y2="${py + 46}" stroke="${O}" stroke-width="4"/><rect x="${px - 44}" y="${py - 30}" width="88" height="34" rx="6" fill="#fff" stroke="${O}" stroke-width="3"/><text x="${px}" y="${py - 6}" font-size="17" text-anchor="middle" fill="#d9493a" font-family="Dela Gothic One,sans-serif">${t}</text></g>`; });
    s += `<circle cx="600" cy="730" r="9" fill="#ff6b57" stroke="${O}" stroke-width="2" class="blink"/><circle cx="622" cy="730" r="9" fill="#5ab4ff" stroke="${O}" stroke-width="2" class="blink" style="animation-delay:.5s"/>`;
  }
  return s + `</svg>`;
}
