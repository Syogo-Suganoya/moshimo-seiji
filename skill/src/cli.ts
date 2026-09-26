// スキル版のコマンド。Claude がこれを呼んでゲームを進める。
// 数値はすべてエンジンで確定させ、結果を JSON で返す。状態はターンごとに state ファイルへ保存する
import {
  DOMESTIC, FAC_NAME, FOREIGN, FREEFORM_EXAMPLE, FREEFORM_LIMITS, FREEFORM_RULES, FREEFORM_SCHEMA,
  GAME, PARTY, POLICY_DATA, QUEST,
  approval, declare, endQuarter, expiredLines, matchPolicy, news, newGame, pickScene, quarterLabel,
  respondQuest, runElection, sanitizeFreeform, summary, tenure,
  type ElectionResult, type Fx, type GameState, type Line, type Reaction,
} from '@moshimo/engine';
import { SCENES } from '../../web/lib/scene';
import { renderView } from './view';

export interface Io {
  read(path: string): string | null;
  write(path: string, text: string): void;
  env(name: string): string | undefined;
  now(): number;
}

export const DEFAULT_STATE = 'moshimo_state.json';
export const DEFAULT_VIEW = 'moshimo_view.html';

class UserError extends Error {}

const HELP = `もしも政治（スキル版）のコマンド

  new [--seed N]                 新しいゲームを始める（就任の新聞と官邸の発言）
  status                         いまの状態（支持率・属性・危機と陳情など）
  policies [--party ID] [--cat 分野] [--q 語]
                                 公約データを探す
  match "表明文"                 表明文が公約・その他の政策に当たるか
  guide                          公約に当たらない表明への反応の作り方（freeform のルールと例）
  declare "表明文" [--freeform JSON|@ファイル]
                                 政策を表明する。公約に当たらないときは freeform を渡す
  promise 陳情ID / decline 陳情ID
                                 陳情に約束する／断る
  end                            ターンを終える（新聞、選挙、失脚まで進める）
  dissolve                       解散総選挙
  view [--out ファイル]          街と支持率を HTML に書き出す（既定 ${DEFAULT_VIEW}）

共通：--state ファイル（既定 ${DEFAULT_STATE}、環境変数 MOSHIMO_STATE でも指定できる）`;

// ================= 引数 =================
function parseArgs(argv: string[]) {
  const pos: string[] = [];
  const opt: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) opt[k] = 'true';
      else { opt[k] = v; i++; }
    } else pos.push(a);
  }
  return { cmd: pos[0], args: pos.slice(1), opt };
}

// ================= 表示用に整える =================
const fxNamed = (fx: Fx) => Object.fromEntries(Object.entries(fx).filter(([, d]) => d).map(([k, d]) => [FAC_NAME[k as keyof typeof FAC_NAME], d]));
const role = (who: Line['who']) => GAME.speakers[who].role;
const lineOut = (l: Line) => ({ who: l.who, role: role(l.who), emo: l.emo, text: l.text, fx: fxNamed(l.fx) });
const dateOf = (turn: number) => { const [y, q] = quarterLabel(turn); return `${y}年 Q${q}`; };

function questsOut(s: GameState) {
  return s.quests.map((q) => {
    const Q = QUEST[q.id];
    return {
      id: q.id,
      kind: Q.kind === 'crisis' ? '危機' : '陳情',
      title: Q.title,
      who: role(Q.who),
      say: Q.say,
      todo: Q.desc,
      turnsLeft: q.left,
      // 陳情は約束しないと、ターンの終わりに消える（断ったのと同じ扱いにはならない）
      status: Q.kind === 'crisis' ? '対応待ち' : q.promised ? '約束済み' : '返事待ち（promise か decline）',
    };
  });
}

export function statusOut(s: GameState) {
  const scene = pickScene(s);
  return {
    date: dateOf(s.turn),
    tenure: tenure(s.turn),
    approval: approval(s),
    prevApproval: s.prevAppr,
    capital: `${s.capital}/${GAME.quarter.capital.max}`,
    turnsToElection: s.elec,
    trust: Math.round(s.trust),
    coalition: s.coalBroken ? '維新が連立を離脱' : Math.round(s.coal),
    fiscalBill: `${s.bill}/${GAME.quarter.bill.limit}`,
    domestic: DOMESTIC.map((f) => ({ name: f.name, weight: f.weight, value: Math.round(s.v[f.id]) })),
    foreign: FOREIGN.map((f) => ({ name: f.name, value: Math.round(s.v[f.id]) })),
    quests: questsOut(s),
    scene: { kind: scene, caption: SCENES[scene].cap },
    over: s.over,
  };
}

function electionOut(r: ElectionResult) {
  return {
    title: `第${r.electionNo}回 衆議院選挙`,
    turnoutWeightedApproval: r.weighted,
    ruling: r.ruling,
    majority: GAME.election.majority,
    win: r.win,
    seats: r.seats.filter(([, n]) => n > 0).map(([id, n]) => ({ party: PARTY[id].name, seats: n })),
  };
}

// ================= 本体 =================
export function run(argv: string[], io: Io): { code: number; out: unknown } {
  const { cmd, args, opt } = parseArgs(argv);
  const statePath = opt.state ?? io.env('MOSHIMO_STATE') ?? DEFAULT_STATE;
  const load = (): GameState => {
    const text = io.read(statePath);
    if (text == null) throw new UserError(`${statePath} がありません。先に new でゲームを始めてください。`);
    const s = JSON.parse(text) as GameState;
    if (s.version !== 1) throw new UserError(`${statePath} の形式が古いか壊れています。new で始め直してください。`);
    return s;
  };
  const save = (s: GameState) => io.write(statePath, JSON.stringify(s));
  const playing = () => {
    const s = load();
    if (s.over) throw new UserError('このゲームは終わっています。new で新しいゲームを始めてください。');
    return s;
  };

  try {
    switch (cmd) {
      case undefined:
      case 'help':
        return { code: 0, out: HELP };

      case 'new': {
        const g = newGame(opt.seed ? Number(opt.seed) : io.now());
        const n = news(g, { first: true });
        save(n.state);
        return {
          code: 0,
          out: {
            message: `第${GAME.start.cabinetNo}代 内閣総理大臣に就任！`,
            news: n.paper,
            lines: [
              { who: 'cab', role: role('cab'), emo: '安', text: '総理、就任おめでとうございます！まずは所信表明を。', fx: {} },
              { who: 'press', role: role('press'), emo: '疑', text: '総理、物価高・少子化・財政。最優先はどれですか？', fx: {} },
            ],
            status: statusOut(n.state),
          },
        };
      }

      case 'status':
        return { code: 0, out: statusOut(load()) };

      case 'policies': {
        const q = opt.q;
        const list = POLICY_DATA.filter((p) =>
          (!opt.party || p.party === opt.party) && (!opt.cat || p.cat === opt.cat) &&
          (!q || p.title.includes(q) || p.summary.includes(q) || new RegExp(p.keywords).test(q)));
        return {
          code: 0,
          out: {
            parties: Object.values(PARTY).map((p) => ({ id: p.id, name: p.name, seats: p.seats, bloc: p.bloc === 'ruling' ? '与党' : '野党' })),
            count: list.length,
            policies: list.map((p) => ({ id: p.id, party: PARTY[p.party].short, cat: p.cat, title: p.title, summary: p.summary, cost: p.cost })),
            note: '公約データは各党の公約の要旨。支持率の変化や反応はゲーム用の仮定。',
          },
        };
      }

      case 'match': {
        const text = args.join(' ').trim();
        if (!text) throw new UserError('表明文を渡してください。例：match "全国民に2万円を給付します"');
        const m = matchPolicy(text);
        return {
          code: 0,
          out: m
            ? { matched: true, id: m.id, title: m.title, cost: m.cost, parties: m.supporters.map((id) => PARTY[id].name) }
            : { matched: false, next: '公約に当たりません。guide のルールで反応を作り、declare に --freeform で渡してください。政策でない文なら freeform なしで declare します。' },
        };
      }

      case 'guide':
        return {
          code: 0,
          out: {
            how: '公約に当たらない表明への反応を JSON で作り、declare "表明文" --freeform \'JSON\' で渡す。値はエンジンが範囲に収めてから計算する。isPolicy が false なら freeform は渡さない。',
            rules: FREEFORM_RULES,
            limits: FREEFORM_LIMITS,
            schema: FREEFORM_SCHEMA,
            example: FREEFORM_EXAMPLE,
          },
        };

      case 'declare': {
        const text = args.join(' ').trim();
        if (!text) throw new UserError('表明文を渡してください。');
        const s = playing();
        let freeform;
        if (opt.freeform) {
          const raw = opt.freeform.startsWith('@') ? io.read(opt.freeform.slice(1)) : opt.freeform;
          if (raw == null) throw new UserError(`${opt.freeform.slice(1)} がありません。`);
          let parsed: { isPolicy?: boolean; title?: string; cat?: string; cost?: number; reactions?: Partial<Reaction>[] };
          try { parsed = JSON.parse(raw); } catch { throw new UserError('--freeform の JSON が読めません。'); }
          if (parsed.isPolicy !== false && Array.isArray(parsed.reactions) && parsed.reactions.length) {
            const p = sanitizeFreeform({ title: parsed.title ?? '', cat: parsed.cat, cost: parsed.cost, reactions: parsed.reactions });
            if (p.reactions.length) freeform = p;
          }
        }
        const before = approval(s);
        const { state, result } = declare(s, text, { freeform });
        save(state);
        const matched = !!matchPolicy(text);
        return {
          code: 0,
          out: {
            statement: text,
            policy: result.policy && {
              title: result.policy.title,
              source: matched ? 'データ' : 'freeform',
              parties: result.policy.supporters.map((id) => PARTY[id].name),
            },
            rejected: result.rejected,
            lines: result.lines.map(lineOut),
            notes: result.notes,
            approval: { before, after: approval(state) },
            capital: `${state.capital}/${GAME.quarter.capital.max}`,
            ...(!result.policy && !result.rejected && !matched && !freeform
              ? { hint: '公約に当たらず、freeform もないので、記者が聞き返しただけ（政治資本は減っていない）。政策なら guide を見て --freeform を付けて表明し直す。' }
              : {}),
          },
        };
      }

      case 'promise':
      case 'decline': {
        const id = args[0];
        const s = playing();
        const q = s.quests.find((x) => x.id === id);
        if (!q || QUEST[id]?.kind !== 'demand' || q.promised) {
          throw new UserError(`返事待ちの陳情に ${id ?? '(なし)'} はありません。status の quests を見てください。`);
        }
        const r = respondQuest(s, id, cmd === 'promise');
        save(r.state);
        return { code: 0, out: { lines: r.lines.map(lineOut), notes: r.notes, approval: approval(r.state), trust: Math.round(r.state.trust) } };
      }

      case 'end': {
        const s = playing();
        const r = endQuarter(s);
        if (r.outcome === 'resign') {
          save(r.state);
          return { code: 0, out: { outcome: '内閣総辞職', summary: summary(r.state) } };
        }
        if (r.outcome === 'election') return { code: 0, out: { outcome: '任期満了で衆議院選挙', ...electionFlow(r.state, save) } };
        const n = news(r.state, { headline: r.headline });
        save(n.state);
        return { code: 0, out: { outcome: '次の四半期へ', ...quarterStart(n.state, n.paper) } };
      }

      case 'dissolve': {
        const s = playing();
        return { code: 0, out: { outcome: '解散総選挙', ...electionFlow(s, save) } };
      }

      case 'view': {
        const s = load();
        const out = opt.out ?? DEFAULT_VIEW;
        io.write(out, renderView(s));
        return { code: 0, out: { written: out } };
      }

      default:
        throw new UserError(`${cmd} というコマンドはありません。help で一覧を見られます。`);
    }
  } catch (e) {
    if (e instanceof UserError) return { code: 1, out: { error: e.message } };
    throw e;
  }
}

// 新しい四半期の始まり：新聞、新しい危機・陳情、期限切れの文句
function quarterStart(s: GameState, paper: ReturnType<typeof news>['paper']) {
  const fresh = s.quests.filter((q) => q.fresh).map((q) => {
    const Q = QUEST[q.id];
    return { who: Q.who, role: role(Q.who), emo: Q.kind === 'crisis' ? '焦' : '疑', text: Q.say, fx: {} };
  });
  return {
    date: dateOf(s.turn),
    news: paper,
    lines: [...fresh, ...expiredLines(s).map(lineOut)],
    status: statusOut(s),
  };
}

function electionFlow(s0: GameState, save: (s: GameState) => void) {
  const { state, result } = runElection(s0);
  if (!result.win) {
    save(state);
    return { election: electionOut(result), result: '与党 過半数割れ。政権交代', summary: summary(state) };
  }
  const n = news(state, { headline: state.lastNews });
  const next = { ...n.state, lastNews: null };
  save(next);
  return { election: electionOut(result), result: '与党 過半数確保。政権続投', ...quarterStart(next, n.paper) };
}
