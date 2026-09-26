// 街と支持率を1枚の HTML にする（スキル版で、ターンの終わりなどに見せる）。
// 外部のファイルを読まずに開けるよう、背景の SVG も CSS も埋め込む
import { DOMESTIC, FOREIGN, GAME, QUEST, approval, pickScene, quarterLabel, tenure, type GameState } from '@moshimo/engine';
import { SCENES, sceneSVG } from '../../web/lib/scene';

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const moodCol = (v: number) => (v < 25 ? '#ff6b57' : v < 40 ? '#ffc93c' : '#35cfa1');

export function renderView(s: GameState): string {
  const [y, q] = quarterLabel(s.turn);
  const a = approval(s);
  const d = s.prevAppr == null ? null : +(a - s.prevAppr).toFixed(1);
  const kind = pickScene(s);
  const bar = (name: string, v: number, sub = '') =>
    `<div class="row"><span>${esc(name)}</span><small>${sub}</small><div class="bar"><i style="width:${v}%;background:${moodCol(v)}"></i></div><b>${Math.round(v)}</b></div>`;
  const quests = s.quests.map((aq) => {
    const Q = QUEST[aq.id];
    const state = Q.kind === 'crisis' ? `残り${aq.left}ターン` : aq.promised ? `約束済み・残り${aq.left}ターン` : '返事待ち';
    return `<div class="q ${Q.kind}"><b>${esc(Q.title)}</b><span>${esc(GAME.speakers[Q.who].role)}「${esc(Q.say)}」</span><small>${state}</small></div>`;
  }).join('');
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>もしも政治 ${y}年Q${q}</title>
<style>
:root{--navy:#1f2244;--cream:#fff5e1;--mint:#35cfa1;--coral:#ff6b57;--sun:#ffc93c;--mute:#8c8aa6}
*{box-sizing:border-box}
body{margin:0;background:var(--navy);color:var(--navy);font-family:"M PLUS Rounded 1c","Hiragino Maru Gothic ProN",system-ui,sans-serif;font-weight:700}
.scene{position:relative;aspect-ratio:16/9;max-height:62vh;width:100%;overflow:hidden;border-bottom:3px solid var(--navy)}
.scene svg{width:100%;height:100%;display:block}
.cap{position:absolute;left:50%;bottom:12px;transform:translateX(-50%);background:var(--navy);color:var(--cream);padding:4px 14px;border-radius:999px;font-size:12px;white-space:nowrap}
.hud{position:absolute;top:12px;left:12px;right:12px;display:flex;gap:10px;flex-wrap:wrap}
.panel{background:var(--cream);border:3px solid var(--navy);border-radius:14px;box-shadow:0 5px 0 var(--navy);padding:8px 14px}
.hud small{display:block;font-size:10px;color:var(--mute)}
.hud b{font-size:18px}
.ap{flex:1;min-width:200px}
.ap .meter{height:14px;border:3px solid var(--navy);border-radius:999px;background:#e6d6b3;overflow:hidden;margin-top:4px}
.ap .meter i{display:block;height:100%;background:var(--mint)}
.up{color:#20a47d}.dn{color:#d9493a}
main{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px;padding:16px;max-width:1100px;margin:0 auto}
h2{margin:0 0 8px;font-size:14px}
.row{display:grid;grid-template-columns:78px 34px 1fr 32px;gap:6px;align-items:center;font-size:12px;padding:2px 0}
.row small{color:var(--mute);font-size:10px;text-align:right}
.bar{height:9px;border:2px solid var(--navy);border-radius:999px;background:#eadcbc;overflow:hidden}
.bar i{display:block;height:100%}
.row b{text-align:right}
.meta{display:grid;grid-template-columns:1fr auto;gap:4px 10px;font-size:12px}
.q{border:2px solid var(--navy);border-radius:10px;padding:6px 10px;margin-bottom:8px;font-size:12px;font-weight:500;background:#fff}
.q b{display:block;font-size:13px}.q small{display:block;color:var(--mute);margin-top:2px}
.q.crisis{border-left:8px solid var(--coral)}.q.demand{border-left:8px solid #5ab4ff}
.foot{color:var(--cream);opacity:.7;font-size:10px;text-align:center;padding:0 16px 16px}
</style></head><body>
<div class="scene">${sceneSVG(kind)}
  <div class="hud">
    <div class="panel"><small>在任 ${tenure(s.turn)}</small><b>${y}年 Q${q}</b></div>
    <div class="panel ap"><small>内閣支持率</small><b>${a.toFixed(1)}%</b> ${d ? `<span class="${d > 0 ? 'up' : 'dn'}">${d > 0 ? '▲' : '▼'}${Math.abs(d)}</span>` : ''}<div class="meter"><i style="width:${a}%"></i></div></div>
    <div class="panel"><small>政治資本</small><b>${s.capital}/${GAME.quarter.capital.max}</b></div>
    <div class="panel"><small>選挙まで</small><b>${s.elec}</b></div>
  </div>
  <div class="cap">${esc(SCENES[kind].cap)}</div>
</div>
<main>
  <section class="panel"><h2>属性別の支持率（国内・重み付き）</h2>${[...DOMESTIC].sort((x, z) => s.v[x.id] - s.v[z.id]).map((f) => bar(f.name, s.v[f.id], `${Math.round(f.weight * 100)}%`)).join('')}</section>
  <section class="panel"><h2>外国</h2>${FOREIGN.map((f) => bar(f.name, s.v[f.id])).join('')}
    <h2 style="margin-top:12px">政権の状態</h2><div class="meta">
      <span>政権への信頼</span><b>${Math.round(s.trust)}</b>
      <span>連立（維新）との関係</span><b>${s.coalBroken ? '離脱' : Math.round(s.coal)}</b>
      <span>財政のツケ</span><b>${s.bill}/${GAME.quarter.bill.limit}</b>
    </div></section>
  <section class="panel"><h2>危機・陳情</h2>${quests || '<p style="font-size:12px;font-weight:500">いまはありません。</p>'}</section>
</main>
<div class="foot">フィクションのシミュレーションです。公約は実在の政党の要旨ですが、反応や支持率の変化はゲーム用の仮定です。</div>
</body></html>
`;
}
