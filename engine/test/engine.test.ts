import { describe, expect, it } from 'vitest';
import {
  applyInterview, approval, declare, endQuarter, matchPolicy, newGame, pickInterviewees, quarterLabel, respondQuest,
  runElection, sanitizeFreeform, sanitizeJudgements, sanitizeQuestions, skippedJudgement, summary, transformFx, POLICIES,
  type GameState, type Line,
} from '../src';

describe('初期状態', () => {
  it('内閣支持率は国内属性の重み付き平均', () => {
    expect(approval(newGame(1))).toBe(50.7);
  });
  it('0ターン目は2026年Q4、1ターン目は2027年Q1', () => {
    expect(quarterLabel(0)).toEqual([2026, 4]);
    expect(quarterLabel(1)).toEqual([2027, 1]);
  });
  it('公約データを60件読み込む', () => {
    expect(POLICIES).toHaveLength(60);
    expect(POLICIES.every((p) => p.reactions.length > 0)).toBe(true);
  });
});

describe('補正', () => {
  it('損失回避：下げは1.6倍、上げは信頼50で1.0倍', () => {
    expect(transformFx({ oM: -5, oF: 5 })).toEqual({ oM: -8, oF: 5 });
  });
  it('組織された団体は1.3倍', () => {
    expect(transformFx({ uni: 10 })).toEqual({ uni: 13 });
  });
  it('言い回し：「支援」は下げを和らげ、「増税」は強める', () => {
    expect(transformFx({ oM: -10 }, { text: '支援します' })).toEqual({ oM: -14 });
    expect(transformFx({ oM: -10 }, { text: '増税します' })).toEqual({ oM: -18 });
  });
  it('信頼が高いほど上げが大きい', () => {
    expect(transformFx({ oM: 10 }, { trust: 100 })).toEqual({ oM: 14 });
    expect(transformFx({ oM: 10 }, { trust: 0 })).toEqual({ oM: 6 });
  });
});

describe('公約の照合', () => {
  it('キーワードで自民党の公約に当たる', () => {
    const p = matchPolicy('全国民に2万円を給付します');
    expect(p?.id).toBe('cash2man');
    expect(p?.supporters).toContain('ldp');
  });
  it('公約に当たらなければ「その他の政策」を探す', () => {
    expect(matchPolicy('消費税を15%に引き上げる')?.id).toBe('tax_up');
  });
  it('何にも当たらなければ null', () => {
    expect(matchPolicy('今日はいい天気ですね')).toBeNull();
  });
});

describe('政策表明', () => {
  it('政治資本を使い、支持率を動かす', () => {
    const s0 = newGame(1);
    const { state, result } = declare(s0, '全国民に2万円を給付します');
    expect(result.rejected).toBe(false);
    expect(result.policy?.id).toBe('cash2man');
    expect(state.capital).toBe(s0.capital - 1);
    expect(state.v.oF).toBeGreaterThan(s0.v.oF);
    expect(state.lastNews).toContain('2万円');
    // 渡した状態は書き換えない
    expect(s0.capital).toBe(3);
  });
  it('同じ話を繰り返すと信頼が下がる', () => {
    const a = declare(newGame(1), '全国民に2万円を給付します').state;
    const { state, result } = declare(a, '全国民に2万円を給付します');
    expect(state.trust).toBe(a.trust - 3);
    expect(result.lines[0].who).toBe('press');
  });
  it('政治資本が足りなければ何も起きない', () => {
    const s = { ...newGame(1), capital: 0 };
    const { state, result } = declare(s, '全国民に2万円を給付します');
    expect(result.rejected).toBe(true);
    expect(state.v).toEqual(s.v);
  });
  it('何にも当たらない表明は、政治資本を使わず記者が聞き返す', () => {
    const s = newGame(1);
    const { state, result } = declare(s, '今日はいい天気ですね');
    expect(state.capital).toBe(s.capital);
    expect(result.lines.map((l) => l.who)).toEqual(['press', 'sala']);
  });
  it('自由な政策（Gemini）を受け取って適用する', () => {
    const free = sanitizeFreeform({
      title: '全国の公園にWi-Fi',
      cost: 9,
      reactions: [
        { who: 'young', emo: '喜', text: 'めっちゃ助かる！', fx: { yM: 50, yF: 3 } },
        { who: 'nobody' as never, emo: '喜', text: '無効な話者', fx: { yM: 5 } },
      ],
    });
    expect(free.cost).toBe(3);
    expect(free.reactions).toHaveLength(1);
    expect(free.reactions[0].fx.yM).toBe(10);
    const s = newGame(1);
    const { state, result } = declare(s, '全国の公園にWi-Fiを整備する', { freeform: free });
    expect(result.policy?.title).toBe('全国の公園にWi-Fi');
    expect(state.capital).toBe(0);
    expect(state.v.yM).toBe(s.v.yM + 10);
  });
  it('野党の公約だけに当たると記者が突っ込み、維新との関係が冷える', () => {
    const s = { ...newGame(1), capital: 5 };
    const { state, result } = declare(s, '全国一律1700円を実現する');
    expect(result.policy?.id).toBe('jcp_wage');
    expect(result.policy?.supporters).toEqual(['jcp']);
    expect(state.coal).toBe(s.coal - 6);
    expect(result.lines.some((l) => l.text.includes('日本共産党の公約では'))).toBe(true);
  });
});

describe('危機・陳情', () => {
  const withQuest = (id: string, promised = false): GameState => ({
    ...newGame(1),
    quests: [{ id, left: 2, promised, fresh: false }],
  });
  it('約束すると関係者が少し喜ぶ', () => {
    const s = withQuest('daycare');
    const { state } = respondQuest(s, 'daycare', true);
    expect(state.quests[0].promised).toBe(true);
    expect(state.v.mF).toBeGreaterThan(s.v.mF);
  });
  it('断ると支持と信頼が下がり、陳情は消える', () => {
    const s = withQuest('daycare');
    const { state } = respondQuest(s, 'daycare', false);
    expect(state.quests).toHaveLength(0);
    expect(state.trust).toBe(s.trust - 2);
    expect(state.v.mF).toBeLessThan(s.v.mF);
  });
  it('約束した陳情を表明で果たすと信頼が大きく上がる', () => {
    const s = withQuest('daycare', true);
    const { state, result } = declare(s, '保育園を増やして待機児童をゼロにする');
    expect(state.quests).toHaveLength(0);
    expect(state.trust).toBe(s.trust + 12);
    expect(result.notes).toContain('信頼 +12：約束を守った');
  });
  it('関税に報復すると、報復関税の拡大が次に来る', () => {
    const s = withQuest('tariff');
    const { state } = declare(s, '関税で報復する');
    expect(state.forceQuest).toBe('tariff2');
    const next = endQuarter(state).state;
    expect(next.quests.map((q) => q.id)).toContain('tariff2');
  });
  it('期限切れの危機は次のターンで罰を受ける', () => {
    const s: GameState = { ...newGame(1), quests: [{ id: 'typhoon', left: 1, promised: false, fresh: false }] };
    const { state } = endQuarter(s);
    expect(state.expired.map((e) => e.id)).toEqual(['typhoon']);
    expect(state.trust).toBe(s.trust - 8);
  });
});

describe('ターン終了と選挙', () => {
  it('同じシードなら同じ結果になる', () => {
    expect(endQuarter(newGame(42))).toEqual(endQuarter(newGame(42)));
  });
  it('1ターン目の終わりに必ず陳情が1つ来る', () => {
    const { state } = endQuarter(newGame(7));
    expect(state.turn).toBe(1);
    expect(state.quests).toHaveLength(1);
  });
  it('支持率20%未満が2ターン続くと総辞職', () => {
    const low = newGame(1);
    for (const k of Object.keys(low.v) as (keyof GameState['v'])[]) low.v[k] = 5;
    const r1 = endQuarter(low);
    expect(r1.outcome).toBe('continue');
    const r2 = endQuarter(r1.state);
    expect(r2.outcome).toBe('resign');
    expect(summary(r2.state).title).toBe('1年もたない短命宰相');
  });
  it('支持が高ければ選挙に勝ち、任期がリセットされる', () => {
    const s = newGame(1);
    for (const k of Object.keys(s.v) as (keyof GameState['v'])[]) s.v[k] = 80;
    const { state, result } = runElection(s);
    expect(result.win).toBe(true);
    expect(result.seats.reduce((a, [, n]) => a + n, 0)).toBe(465);
    expect(state.elec).toBe(16);
    expect(state.elecNo).toBe(53);
  });
  it('支持が低ければ選挙に負けて失脚', () => {
    const s = newGame(1);
    for (const k of Object.keys(s.v) as (keyof GameState['v'])[]) s.v[k] = 20;
    const { state, result } = runElection(s);
    expect(result.win).toBe(false);
    expect(state.over).toBe('election');
  });
});

describe('バランス', () => {
  // 何もしないと数年で失脚する程度を目安にする
  it('何もしないと、ほとんどの場合5年以内に失脚する', () => {
    const tenures: number[] = [];
    for (let seed = 1; seed <= 200; seed++) {
      let s = newGame(seed);
      let turns = 0;
      for (; turns < 80; turns++) {
        const r = endQuarter(s);
        s = r.state;
        if (r.outcome === 'resign') break;
        if (r.outcome === 'election') {
          const e = runElection(s);
          s = e.state;
          if (!e.result.win) break;
        }
      }
      tenures.push(s.turn);
    }
    const within5y = tenures.filter((t) => t <= 20).length / tenures.length;
    expect(within5y).toBeGreaterThan(0.9);
  });
});

describe('深掘りモード', () => {
  const line = (who: Line['who'], fx: Line['fx']): Line => ({ who, emo: '安', text: '', fx });
  it('反応の大きい人から最大3人、反対した人を必ず入れる', () => {
    const lines = [line('old', { oM: 6, oF: 6 }), line('young', { yM: 5 }), line('mom', { mF: 4 }), line('big', { big: -2 }), line('cab', {})];
    expect(pickInterviewees(lines)).toEqual(['old', 'young', 'big']);
  });
  it('支持率を持たない話者は選ばない', () => {
    expect(pickInterviewees([line('cab', {}), line('press', {})])).toEqual([]);
  });
  it('質問は選んだ人だけ・1人1問・長さを収める', () => {
    const q = sanitizeQuestions([
      { who: 'old', text: 'あ'.repeat(200), replies: ['い'.repeat(50), '', 'う', 'え', 'お'] },
      { who: 'old', text: '二問目', replies: [] },
      { who: 'big', text: '選ばれていない', replies: [] },
    ], ['old']);
    expect(q).toHaveLength(1);
    expect(q[0].text.length).toBe(80);
    expect(q[0].replies).toEqual(['い'.repeat(20), 'う', 'え']);
  });
  it('判定の区分が不正なら ok にする', () => {
    const j = sanitizeJudgements([{ who: 'old', verdict: '満点', emo: '?', text: 'ふむ' }], ['old']);
    expect(j[0]).toMatchObject({ verdict: 'ok', emo: '安' });
  });
  it('長い反応は収まる範囲の文末で切る', () => {
    const j = sanitizeJudgements([{ who: 'old', verdict: 'good', emo: '喜', text: 'あ'.repeat(30) + '。' + 'い'.repeat(40) }], ['old']);
    expect(j[0].text).toBe('あ'.repeat(30) + '。');
  });
  it('正面から答えれば支持率と信頼が上がる', () => {
    const s0 = newGame(1);
    const { state, lines } = applyInterview(s0, [{ who: 'old', verdict: 'good', emo: '喜', text: 'なるほど' }]);
    expect(state.v.oM).toBeGreaterThan(s0.v.oM);
    expect(state.trust).toBe(s0.trust + 1);
    expect(lines[0].fx.oM).toBeGreaterThan(0);
  });
  it('はぐらかすと支持率と信頼が下がる', () => {
    const s0 = newGame(1);
    const { state, notes } = applyInterview(s0, [
      { who: 'old', verdict: 'good', emo: '喜', text: '' },
      skippedJudgement('young'),
    ]);
    expect(state.v.yM).toBeLessThan(s0.v.yM);
    expect(state.trust).toBe(s0.trust - 1);
    expect(notes.join()).toContain('はぐらかした');
  });
});
