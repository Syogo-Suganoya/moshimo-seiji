import { describe, expect, it } from 'vitest';
import { DEFAULT_STATE, DEFAULT_VIEW, run, type Io } from '../src/cli';

// ファイルの読み書きをメモリ上で行う
function memIo(files: Record<string, string> = {}): Io & { files: Record<string, string> } {
  return {
    files,
    read: (p) => files[p] ?? null,
    write: (p, t) => { files[p] = t; },
    env: () => undefined,
    now: () => 1,
  };
}
const out = (r: { out: unknown }) => r.out as any;

describe('スキルのコマンド', () => {
  it('new で状態ファイルができ、就任の新聞が出る', () => {
    const io = memIo();
    const r = run(['new', '--seed', '7'], io);
    expect(r.code).toBe(0);
    expect(io.files[DEFAULT_STATE]).toBeDefined();
    expect(out(r).news.head).toBe('新内閣が発足！');
    expect(out(r).status.approval).toBe(50.7);
  });

  it('ゲームがないときはエラー（終了コード1）', () => {
    const r = run(['status'], memIo());
    expect(r.code).toBe(1);
    expect(out(r).error).toContain('new');
  });

  it('公約に当たる表明は、Web版と同じ結果になる', () => {
    const io = memIo();
    run(['new', '--seed', '1'], io);
    const r = run(['declare', '全国民に2万円を給付します'], io);
    expect(out(r).policy.source).toBe('データ');
    expect(out(r).approval).toEqual({ before: 50.7, after: 52.2 });
    expect(out(r).capital).toBe('2/5');
    expect(out(r).lines[0].fx).not.toHaveProperty('oM'); // 属性は日本語の名前で返す
  });

  it('公約に当たらない表明は freeform で反応を受け取り、値を範囲に収める', () => {
    const io = memIo();
    run(['new', '--seed', '1'], io);
    expect(out(run(['match', '全国の公園に無料Wi-Fiを整備します'], io)).matched).toBe(false);
    const ff = JSON.stringify({
      isPolicy: true, title: '公園Wi-Fi', cat: 'その他', cost: 1,
      reactions: [{ who: 'young', emo: '喜', text: 'うれしい！', fx: { yM: 99 } }],
    });
    const r = run(['declare', '全国の公園に無料Wi-Fiを整備します', '--freeform', ff], io);
    expect(out(r).policy.source).toBe('freeform');
    expect(out(r).lines[0].fx).toEqual({ 若年男性: 10 });
  });

  it('freeform はファイル（@パス）からも読める', () => {
    const io = memIo({
      'ff.json': JSON.stringify({ isPolicy: true, title: 'X', cost: 1, reactions: [{ who: 'sala', emo: '安', text: 'まあ、いいんじゃない。', fx: { mM: 2 } }] }),
    });
    run(['new', '--seed', '1'], io);
    const r = run(['declare', '全国の公園に無料Wi-Fiを整備します', '--freeform', '@ff.json'], io);
    expect(out(r).lines).toHaveLength(1);
  });

  it('政策でない文は、政治資本を使わずに記者が聞き返す', () => {
    const io = memIo();
    run(['new', '--seed', '1'], io);
    const r = run(['declare', 'こんにちは', '--freeform', JSON.stringify({ isPolicy: false, reactions: [] })], io);
    expect(out(r).capital).toBe('3/5');
    expect(out(r).hint).toBeDefined();
  });

  it('end で次の四半期へ進み、陳情に約束できる', () => {
    const io = memIo();
    run(['new', '--seed', '7'], io);
    const e = out(run(['end'], io));
    expect(e.outcome).toBe('次の四半期へ');
    expect(e.date).toBe('2027年 Q1');
    const q = e.status.quests[0];
    expect(q.status).toContain('返事待ち');
    const p = run(['promise', q.id], io);
    expect(p.code).toBe(0);
    expect(run(['promise', q.id], io).code).toBe(1);
  });

  it('支持率が低いまま続くと総辞職し、そのあとは表明できない', () => {
    const io = memIo();
    run(['new', '--seed', '1'], io);
    const s = JSON.parse(io.files[DEFAULT_STATE]);
    for (const k of Object.keys(s.v)) s.v[k] = 5;
    io.files[DEFAULT_STATE] = JSON.stringify(s);
    run(['end'], io);
    const r = out(run(['end'], io));
    expect(r.outcome).toBe('内閣総辞職');
    expect(r.summary.title).toBeDefined();
    expect(run(['declare', '全国民に2万円を給付します'], io).code).toBe(1);
  });

  it('解散すると選挙の結果が出る', () => {
    const io = memIo();
    run(['new', '--seed', '1'], io);
    const r = out(run(['dissolve'], io));
    expect(r.election.seats.reduce((a: number, x: { seats: number }) => a + x.seats, 0)).toBe(465);
  });

  it('--state で状態ファイルの場所を変えられる', () => {
    const io = memIo();
    run(['new', '--state', 'a.json'], io);
    expect(io.files['a.json']).toBeDefined();
    expect(io.files[DEFAULT_STATE]).toBeUndefined();
  });

  it('view で HTML を書き出す', () => {
    const io = memIo();
    run(['new', '--seed', '1'], io);
    run(['view'], io);
    expect(io.files[DEFAULT_VIEW]).toContain('<svg');
    expect(io.files[DEFAULT_VIEW]).toContain('フィクション');
  });

  it('guide は Web版（Gemini）と同じルールを返す', () => {
    const g = out(run(['guide'], memIo()));
    expect(g.rules).toContain('isPolicy');
    expect(g.schema.required).toContain('reactions');
  });

  it('policies で公約を探せる', () => {
    const r = out(run(['policies', '--party', 'ldp'], memIo()));
    expect(r.count).toBe(15);
  });
});
