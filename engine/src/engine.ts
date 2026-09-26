// ゲームの計算ロジック。画面から独立した純粋な関数にまとめる。
// 各関数は状態をコピーして返し、渡された状態は書き換えない。
// 乱数は状態の中にシードを持つので、同じ状態と入力からは同じ結果になる。
import {
  DOMESTIC, FAC_IDS, FOREIGN, GAME, OTHER_POLICIES, PARTIES, PARTY, POLICIES, QUEST, QUESTS,
} from './data';
import type {
  ActiveQuest, DeclareResult, FacId, Fx, GameState, Line, Policy, Reaction, SceneKind,
} from './types';

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const round1 = (v: number) => +v.toFixed(1);

// ================= 乱数（mulberry32） =================
function random(s: GameState): number {
  let t = (s.rng = (s.rng + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function shuffle<T>(s: GameState, a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random(s) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ================= 状態 =================
export function newGame(seed = Date.now()): GameState {
  const q = GAME.quarter;
  return {
    version: 1,
    rng: seed >>> 0,
    turn: 0,
    v: Object.fromEntries([...DOMESTIC, ...FOREIGN].map((f) => [f.id, f.init])) as Record<FacId, number>,
    capital: q.capital.init,
    elec: GAME.election.firstTermTurns,
    elecNo: GAME.start.firstElectionNo,
    low: 0,
    trust: GAME.psy.trust.init,
    coal: q.coalition.init,
    coalBroken: false,
    bill: 0,
    fade: {},
    urban: 0,
    forceQuest: null,
    events: [],
    lastNews: null,
    quests: [],
    seen: [],
    used: [],
    taxUp: false,
    maxAppr: 0,
    prevAppr: null,
    expired: [],
    over: null,
  };
}

const copy = (s: GameState): GameState => structuredClone(s);

// 内閣支持率：国内の属性を重み付きで平均（外国は含まない）
export function approvalOf(v: Record<FacId, number>): number {
  return round1(DOMESTIC.reduce((a, f) => a + v[f.id] * f.weight, 0));
}
export const approval = (s: GameState) => approvalOf(s.v);

// ターン番号 → [年, 四半期]。0ターン目が2026年Q4
export function quarterLabel(turn: number): [number, number] {
  const k = GAME.start.quarter - 1 + turn;
  return [GAME.start.year + Math.floor(k / 4), (k % 4) + 1];
}
export function tenure(turn: number): string {
  const m = turn * 3;
  return `${Math.floor(m / 12)}年${m % 12}ヶ月`;
}

// ================= 行動経済学・ゲーム理論モデル =================
// ・損失回避（プロスペクト理論）：同じ大きさなら、損は得の約1.6倍強く感じる
// ・組織化された少数者（オルソン）：大企業・農業・労組は声が大きく、反応が1.3倍
// ・フレーミング：「支援」「投資」「守る」などの言い方は反発をやや和らげ、「増税」「削減」などは強める
// ・信頼（繰り返しゲームの評判）：約束を守るほど、同じ言葉でも好意的に受け取られる（0.6〜1.4倍）
// ・慣れ（快楽順応）：上がった支持の半分は、その後数ターンで元に戻る。下がった分は戻らない
const FRAMING = GAME.psy.framing.map((f) => ({ re: new RegExp(f.pattern), mult: f.mult }));
export function framing(text: string): number {
  let f = 1;
  if (!text) return f;
  for (const r of FRAMING) if (r.re.test(text)) f *= r.mult;
  return f;
}

export function transformFx(fx: Fx, { text = '', trust = GAME.psy.trust.init } = {}): Fx {
  const P = GAME.psy;
  const out: Fx = {};
  const fr = framing(text);
  const cred = P.trust.credBase + trust / P.trust.credDiv;
  for (const [k, d0] of Object.entries(fx) as [FacId, number][]) {
    if (!d0) continue;
    let d = d0 * (P.organized[k] ?? 1);
    d = d < 0 ? d * P.lossAversion * fr : d * cred;
    out[k] = Math.sign(d) * Math.max(1, Math.round(Math.abs(d)));
  }
  return out;
}

// fx は「素の値」。心理効果を通した値を適用し、実際に動いた値を返す
function applyFx(s: GameState, fx: Fx, text = ''): Fx {
  const t = transformFx(fx, { text, trust: s.trust });
  for (const [k, d] of Object.entries(t) as [FacId, number][]) {
    const before = s.v[k];
    s.v[k] = clamp(s.v[k] + d);
    if (d > 0) s.fade[k] = (s.fade[k] ?? 0) + (s.v[k] - before) * GAME.psy.fadeShare;
  }
  return t;
}

function trustDelta(s: GameState, d: number, notes?: string[], why?: string) {
  s.trust = clamp(s.trust + d);
  if (why && notes) notes.push(`信頼 ${d > 0 ? '+' : ''}${d}：${why}`);
}

// 都市化・地方化の軸（背景の差し替えに使う）
const URBAN = GAME.declare.urban;
const URBAN_RE = URBAN.patterns.map((p) => ({ re: new RegExp(p.pattern), shift: p.shift }));
function urbanShift(s: GameState, p: Policy, text: string) {
  let u = (p.cat && URBAN.cats[p.cat]) || 0;
  for (const r of URBAN_RE) if (r.re.test(text)) u += r.shift;
  s.urban = clamp(s.urban + u, URBAN.min, URBAN.max);
}

// ================= 背景 =================
export function pickScene(s: GameState): SceneKind {
  for (const q of s.quests) {
    const sc = QUEST[q.id]?.scene;
    if (sc) return sc;
  }
  const a = approval(s);
  if (a < 25) return 'ruin';
  if (s.v.us < 30 || s.v.cn < 20) return 'tension';
  if (a < 38) return 'stall';
  if (s.urban >= 4) return 'urban';
  if (s.urban <= -4) return 'rural';
  return 'good';
}

// ================= 政策の照合 =================
// 当てはまった公約のうち、入力文に含まれるキーワードの文字数合計が最も大きい（＝具体的な）ものを採用。
// 同点はデータの並び順（自民党が先）を優先する。公約に当てはまらなければ「その他の政策」を探す
export function matchPolicy(text: string): (Policy & { supporters: string[] }) | null {
  const score = (terms: string[]) => terms.filter((t) => text.includes(t)).reduce((n, t) => n + t.length, 0);
  const hits = POLICIES.filter((p) => p.re.test(text));
  const best = hits
    .map((p, i) => ({ p, sc: score(p.terms), i }))
    .sort((a, b) => b.sc - a.sc || a.i - b.i)[0]?.p;
  const supporters = [...new Set(hits.map((p) => p.party))];
  if (best) return { ...best, supporters };
  const other = OTHER_POLICIES.find((p) => p.re.test(text));
  return other ? { ...other, supporters: [] } : null;
}

// Geminiなどが作った自由な政策の値を、ゲームの範囲に収める
export const FREEFORM_LIMITS = { maxLines: 5, maxDelta: 10, minCost: 1, maxCost: 3, maxText: 80 };
export function sanitizeFreeform(p: {
  title: string; cat?: string; cost?: number; reactions: Partial<Reaction>[];
}): Policy {
  const L = FREEFORM_LIMITS;
  const reactions: Reaction[] = [];
  for (const r of p.reactions) {
    if (reactions.length >= L.maxLines) break;
    if (!r.who || !(r.who in GAME.speakers) || !r.text) continue;
    const fx: Fx = {};
    for (const [k, d] of Object.entries(r.fx ?? {})) {
      if (!FAC_IDS.includes(k as FacId) || typeof d !== 'number' || !Number.isFinite(d)) continue;
      fx[k as FacId] = Math.round(clamp(d, -L.maxDelta, L.maxDelta));
    }
    reactions.push({
      who: r.who,
      emo: r.emo && GAME.emotions.includes(r.emo) ? r.emo : '疑',
      text: String(r.text).slice(0, L.maxText),
      fx,
    });
  }
  const title = String(p.title || '新方針').slice(0, 40);
  return {
    id: `free:${title}`,
    cat: p.cat,
    title,
    cost: Math.round(clamp(p.cost ?? 1, L.minCost, L.maxCost)),
    reactions,
  };
}

// ================= 政策表明 =================
// freeform：公約にもその他の政策にも当てはまらないときに使う政策（Geminiが作った反応）
export function declare(
  s0: GameState,
  text: string,
  opts: { freeform?: Policy } = {},
): { state: GameState; result: DeclareResult } {
  const s = copy(s0);
  const D = GAME.declare;
  const notes: string[] = [];
  const pending: Reaction[] = [];
  const matched = matchPolicy(text);
  const hit: (Policy & { supporters: string[] }) | null =
    matched ?? (opts.freeform ? { ...opts.freeform, supporters: [] } : null);
  const cost = hit ? hit.cost : 1;

  if (s.capital < cost) {
    return { state: s, result: { lines: [{ ...GAME.lines.noCapital, fx: {} }], notes, policy: null, rejected: true } };
  }

  // 外交の囚人のジレンマ：関税に報復すると、相手もしっぺ返しで応じる
  const R = D.retaliation;
  const tq = s.quests.find((q) => R.quests.includes(q.id));
  if (tq && new RegExp(R.pattern).test(text)) {
    pending.push(...R.reactions);
    resolveQuest(s, tq.id, false, notes);
    s.forceQuest = R.next;
    trustDelta(s, R.trust);
  }
  // 危機への対応、約束した陳情の実行
  for (const q of [...s.quests]) {
    const Q = QUEST[q.id];
    if (Q.re.test(text) && (Q.kind === 'crisis' || q.promised)) {
      pending.push({ who: Q.who, emo: '喜', text: Q.thanks, fx: Q.ok });
      const crisis = Q.kind === 'crisis';
      trustDelta(s, crisis ? D.crisisTrust : D.promiseTrust, notes, crisis ? '危機に対応した' : '約束を守った');
      resolveQuest(s, q.id, true, notes);
    }
  }

  let policy: DeclareResult['policy'] = null;
  if (hit) {
    policy = { id: hit.id, title: hit.title, supporters: hit.supporters };
    if (s.used.includes(hit.id)) {
      pending.push(GAME.lines.repeat);
      trustDelta(s, D.repeatTrust, notes, '同じ話の繰り返し（安い約束）');
    } else {
      s.used.push(hit.id);
      if (hit.setsTaxUp) s.taxUp = true;
      s.lastNews = `首相、「${hit.title}」を表明`;
      pending.push(...shuffle(s, [...hit.reactions]));
      // 現在バイアス：財源の重い政策は、効果は今、負担は後から「ツケ」として来る
      if (hit.cost >= 2) s.bill += hit.cost;
      urbanShift(s, hit, text);
      // 連立相手（維新）との交渉ゲーム
      if (hit.party) {
        const C = D.coalitionShift;
        const dc = hit.party === 'ishin' ? C.ishin : hit.party === 'ldp' ? C.ldp : C.other;
        s.coal = clamp(s.coal + dc);
        if (dc < 0 && !s.coalBroken) pending.push(GAME.lines.coalitionUnhappy);
      }
      const sup = hit.supporters;
      if (sup.length) {
        notes.push(`この政策の公約：${sup.map((id) => PARTY[id].name).join('、')}`);
        if (!sup.includes('ldp')) {
          const o = GAME.lines.opposition;
          pending.push({ ...o, text: o.text.replace('{party}', PARTY[sup[0]].name) });
        }
      }
    }
  }

  if (!pending.length) {
    return {
      state: copy(s0),
      result: { lines: GAME.lines.fallback.map((r) => ({ ...r, fx: {} })), notes: [], policy: null, rejected: false },
    };
  }
  s.capital -= cost;
  if (!hit) s.lastNews = '首相、危機対応を表明';
  const lines: Line[] = pending.map((r) => ({ ...r, fx: applyFx(s, r.fx, text) }));
  return { state: s, result: { lines, notes, policy, rejected: false } };
}

// ================= 危機・陳情 =================
function resolveQuest(s: GameState, id: string, ok: boolean, notes?: string[]) {
  s.quests = s.quests.filter((q) => q.id !== id);
  notes?.push(`${QUEST[id].title}：${ok ? '達成！' : '却下'}`);
}

// 陳情に「約束する」か「断る」か
export function respondQuest(s0: GameState, id: string, accept: boolean): { state: GameState; lines: Line[]; notes: string[] } {
  const s = copy(s0);
  const q = s.quests.find((x) => x.id === id);
  const Q = QUEST[id];
  if (!q || !Q || Q.kind !== 'demand' || q.promised) return { state: s, lines: [], notes: [] };
  const notes: string[] = [];
  if (accept) {
    q.promised = true;
    const bonus = Object.fromEntries(Object.keys(Q.ok).map((k) => [k, GAME.declare.promiseBonus]));
    const fx = applyFx(s, bonus);
    notes.push(`「${Q.title}」を約束（残り${q.left}ターン）`);
    return { state: s, lines: [{ who: Q.who, emo: '安', text: GAME.lines.promised, fx }], notes };
  }
  const half = Object.fromEntries(Object.entries(Q.ng).map(([k, v]) => [k, Math.round((v ?? 0) / 2)]));
  const fx = applyFx(s, half);
  trustDelta(s, GAME.declare.declineTrust);
  resolveQuest(s, id, false, notes);
  return { state: s, lines: [{ who: Q.who, emo: '怒', text: GAME.lines.declined, fx }], notes };
}

function spawnQuest(s: GameState, force: boolean) {
  const add = (id: string) => s.quests.push({ id, left: QUEST[id].ttl, promised: false, fresh: true });
  if (s.forceQuest) {
    add(s.forceQuest);
    s.forceQuest = null;
    return;
  }
  if (!force && random(s) > GAME.quarter.questChance) return;
  const pool = QUESTS.filter((q) => !q.hidden && !s.quests.some((x) => x.id === q.id) && !s.seen.includes(q.id));
  if (!pool.length) return;
  const base = force ? pool.filter((q) => q.kind === 'demand') : pool;
  if (!base.length) return;
  const t = base[Math.floor(random(s) * base.length)];
  s.seen.push(t.id);
  add(t.id);
}

// 期限切れの危機・陳情について、当事者が文句を言うセリフ
export function expiredLines(s: GameState): Line[] {
  return s.expired.map(({ id, fx }) => {
    const Q = QUEST[id];
    return { who: Q.who, emo: '怒', text: Q.kind === 'crisis' ? GAME.lines.crisisIgnored : GAME.lines.promiseBroken, fx };
  });
}

// ================= ターン終了 =================
export type QuarterOutcome = 'continue' | 'resign' | 'election';

export function endQuarter(s0: GameState): { state: GameState; outcome: QuarterOutcome; headline: string | null } {
  const s = copy(s0);
  const Q = GAME.quarter;
  const headline = s.lastNews;
  s.lastNews = null;
  s.prevAppr = approval(s);
  s.expired = [];
  for (const q of s.quests) q.fresh = false;

  for (const f of DOMESTIC) s.v[f.id] = clamp(s.v[f.id] + Q.drift + (random(s) * 2 - 1) * Q.noise);
  for (const [k, d] of Object.entries(Q.extraDrift) as [FacId, number][]) s.v[k] = clamp(s.v[k] + d);
  // 慣れ：上がった分の一時的な部分が半分ずつ抜けていく
  for (const k of Object.keys(s.fade) as FacId[]) {
    const d = s.fade[k]! * 0.5;
    s.v[k] = clamp(s.v[k] - d);
    s.fade[k]! -= d;
    if (s.fade[k]! < 0.2) delete s.fade[k];
  }
  // バンドワゴン／沈黙の螺旋：高い支持はさらに支持を呼び、低い支持は離反を呼ぶ
  {
    const a0 = approval(s), B = Q.bandwagon;
    const dd = a0 > B.high ? B.step : a0 < B.low ? -B.step : 0;
    if (dd) for (const f of DOMESTIC) s.v[f.id] = clamp(s.v[f.id] + dd);
  }
  // 財政のツケ：重い財政支出が積み上がると、市場と将来不安が支持を削る
  if (s.bill >= Q.bill.limit) {
    s.bill -= Q.bill.limit;
    applyFx(s, Q.bill.fx);
    s.events.push(Q.bill.news);
    trustDelta(s, Q.bill.trust);
  }
  // 連立：関係が冷えると維新が離脱
  const C = Q.coalition;
  if (s.coal < C.recoverBelow) s.coal += C.recover;
  if (!s.coalBroken && s.coal < C.breakBelow) {
    s.coalBroken = true;
    s.events.push(C.news);
    trustDelta(s, C.trust);
  }
  // 危機・陳情の期限。約束しなかった陳情は消え、期限が切れたものは罰を受ける
  for (const q of [...s.quests]) {
    const QD = QUEST[q.id];
    if (QD.kind === 'demand' && !q.promised) {
      s.quests = s.quests.filter((x) => x !== q);
      continue;
    }
    q.left--;
    if (q.left <= 0) {
      const fx = applyFx(s, QD.ng);
      trustDelta(s, QD.kind === 'crisis' ? GAME.declare.brokenCrisisTrust : GAME.declare.brokenPromiseTrust);
      s.expired.push({ id: q.id, fx });
      s.quests = s.quests.filter((x) => x !== q);
    }
  }

  s.turn++;
  s.elec--;
  s.capital = Math.min(Q.capital.max, s.capital + (approval(s) > Q.capital.highAbove ? Q.capital.gainHigh : Q.capital.gainLow));
  spawnQuest(s, s.turn === 1);
  const a = approval(s);
  s.maxAppr = Math.max(s.maxAppr, Math.round(a));
  s.low = a < Q.resign.below ? s.low + 1 : 0;

  if (s.low >= Q.resign.turns) {
    s.over = 'resign';
    return { state: s, outcome: 'resign', headline };
  }
  if (s.elec <= 0) return { state: s, outcome: 'election', headline };
  return { state: s, outcome: 'continue', headline };
}

// ================= 選挙 =================
export interface ElectionResult {
  electionNo: number;
  // 投票率で重み付けした支持率
  weighted: number;
  ruling: number;
  seats: [string, number][];
  win: boolean;
}

// 任期満了でも解散でも同じ。勝てば任期リセット、負ければ失脚
export function runElection(s0: GameState): { state: GameState; result: ElectionResult } {
  const s = copy(s0);
  const E = GAME.election;
  // 投票率で重み付けした「実際の得票」：高齢層ほど投票に行く
  const tw = DOMESTIC.reduce((n, f) => n + f.weight * f.turnout, 0);
  const a = round1(DOMESTIC.reduce((n, f) => n + f.weight * f.turnout * s.v[f.id], 0) / tw);
  const share = clamp(E.base + a * E.perPoint + (random(s) * 2 - 1) * E.noise, E.min, E.max);
  let ruling = Math.round(E.seats * share);
  if (s.coalBroken) ruling = Math.round(ruling * E.coalitionBrokenMult);
  const win = ruling >= E.majority;

  // 与党（自民・維新）と野党を、2026年衆院選の議席比で配分
  const alloc = (ids: string[], total: number): [string, number][] => {
    const w = ids.map((id) => Math.max(PARTY[id].seats, 0.5));
    const ws = w.reduce((x, y) => x + y, 0);
    const r: [string, number][] = ids.map((id, i) => [id, Math.floor((total * w[i]) / ws)]);
    let rest = total - r.reduce((x, y) => x + y[1], 0);
    for (let i = 0; rest > 0; i = (i + 1) % r.length, rest--) r[i][1]++;
    return r;
  };
  const inRuling = (p: (typeof PARTIES)[number]) => p.bloc === 'ruling' && !(s.coalBroken && p.id === 'ishin');
  const seats = [
    ...alloc(PARTIES.filter(inRuling).map((p) => p.id), ruling),
    ...alloc(PARTIES.filter((p) => !inRuling(p)).map((p) => p.id), E.seats - ruling),
  ];
  const result: ElectionResult = { electionNo: s.elecNo, weighted: a, ruling, seats, win };
  if (win) {
    s.elec = E.termTurns;
    s.elecNo++;
    s.capital = GAME.quarter.capital.max;
    s.lastNews = `与党${ruling}議席、政権続投へ`;
  } else {
    s.over = 'election';
  }
  return { state: s, result };
}

// ================= 失脚 =================
export function summary(s: GameState) {
  const t = s.turn;
  const reason = s.over === 'election'
    ? '総選挙で与党が過半数割れ。政権交代です。'
    : '内閣支持率が2ターン連続で20%を下回り、与党内から退陣論が噴出。内閣総辞職となりました。';
  const title = t < 4 ? '1年もたない短命宰相'
    : s.taxUp ? '増税に散った宰相'
    : s.over === 'election' ? '民意に敗れた宰相'
    : t >= 20 ? '長期政権の宰相'
    : '志半ばの宰相';
  return { turns: t, tenure: tenure(t), score: t * 100 + s.maxAppr * 10, maxAppr: s.maxAppr, reason, title };
}

// ================= 新聞 =================
export function news(s0: GameState, opts: { first?: boolean; headline?: string | null } = {}) {
  const s = copy(s0);
  const [year, quarter] = quarterLabel(s.turn);
  const a = approval(s);
  const d = s.prevAppr == null ? 0 : round1(a - s.prevAppr);
  const head = opts.first ? '新内閣が発足！' : opts.headline || '政権、動かず';
  const lead = opts.first
    ? '少子高齢化、長引く低成長、GDP比250%の政府債務。重い課題を背負っての船出となった。新首相は就任会見で「この国の未来から逃げない」と語った。'
    : opts.headline
      ? '政府の方針をめぐり、国民の受け止めは割れている。期待の声がある一方、負担増を心配する声も根強い。野党は「場当たり的だ」と批判している。'
      : '今期、政府は目立った政策を打ち出さなかった。「何もしない内閣」との声も出始めている。';
  const cols: [string, string][] = [];
  for (const e of s.events.splice(0)) cols.push([e, '政権運営への影響は避けられないとの見方が広がっている。']);
  const nq = s.quests.find((q) => q.fresh);
  if (nq) {
    const Q = QUEST[nq.id];
    cols.push([Q.title, `${GAME.speakers[Q.who].role}「${Q.say}」`]);
  }
  const filler = shuffle(s, [...GAME.fillerNews]).slice(0, Math.max(0, 3 - cols.length));
  return {
    state: s,
    paper: { year, quarter, head, lead, approval: Math.round(a), delta: opts.first ? null : d, columns: [...cols, ...filler], scene: opts.first ? 'good' as SceneKind : pickScene(s) },
  };
}

export type { ActiveQuest };
