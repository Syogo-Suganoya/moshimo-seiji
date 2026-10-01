'use client';
// ゲーム画面一式（タイトル、公約ブック、新聞、官邸、選挙、失脚）。
// 数値はすべて @moshimo/engine で確定させ、この画面は演出と入力だけを受け持つ
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  DOMESTIC, FOREIGN, GAME, PARTIES, PARTY, POLICIES, POLICY_DATA, QUEST,
  approval, approvalOf, declare, endQuarter, expiredLines, matchPolicy, news, newGame, pickScene,
  quarterLabel, respondQuest, runElection, sanitizeFreeform, summary, tenure, transformFx,
  type ElectionResult, type Emotion, type FacId, type Fx, type GameState, type Line, type Policy,
  type SceneKind, type SpeakerId,
} from '@moshimo/engine';
import { SCENES, sceneSVG } from '@/lib/scene';
import { EMO, FN, ME, SPEAKER_IDS, SPK, moodCol, moodIc, role, store, wait } from '@/lib/ui';

type Screen = 'title' | 'book' | 'news' | 'main' | 'election' | 'over';
type Paper = ReturnType<typeof news>['paper'];
type NewLog =
  | { kind: 'sys'; text: string }
  | { kind: 'me'; text: string }
  | { kind: 'spk'; who: SpeakerId; emo?: Emotion; text: string; fx: Fx };
type LogItem = NewLog & { id: number };
// step：自動で出している発言。'next' なら「次へ」、'last' なら「OK」ボタンを吹き出しの中に出す
interface Bubble { text: string; emo?: Emotion; peek?: boolean; sup?: number | null; n: number; step?: 'next' | 'last' }
interface ModalState { title: string; body: ReactNode; btns: [string, string, (() => void) | null][]; align?: string }
interface Records { best: number; maxAppr: number; plays: number }

const SAVE_KEY = 'moshimo_game';
const REC_KEY = 'moshimo_rec';
const clamp = (v: number) => Math.max(0, Math.min(100, v));
const facAvg = (v: Record<FacId, number>, k: SpeakerId) => {
  const f = GAME.speakers[k].fac;
  return f.length ? Math.round(f.reduce((a, x) => a + v[x], 0) / f.length) : null;
};
const Svg = ({ html, className, style }: { html: string; className?: string; style?: React.CSSProperties }) => (
  <div className={className} style={style} dangerouslySetInnerHTML={{ __html: html }} />
);

export default function Game() {
  const [mounted, setMounted] = useState(false);
  const [screen, setScreen] = useState<Screen>('title');
  const [game, setGame] = useState<GameState>(() => newGame(1));
  const gameRef = useRef(game);
  const [saved, setSaved] = useState<GameState | null>(null);
  const [records, setRecords] = useState<Records>({ best: 0, maxAppr: 0, plays: 0 });
  const [mode, setMode] = useState<'gemini' | 'mock' | null>(null);

  // 官邸
  const [shownV, setShownV] = useState<Record<FacId, number> | null>(null);
  const [log, setLog] = useState<LogItem[]>([]);
  const logId = useRef(0);
  const [bubbles, setBubbles] = useState<Partial<Record<SpeakerId, Bubble>>>({});
  const [fnums, setFnums] = useState<Partial<Record<SpeakerId, { d: number; n: number }>>>({});
  // 吹き出しの「次へ」で進めるための待ち
  const advanceRef = useRef<(() => void) | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [thinking, setThinking] = useState(false);
  const [input, setInput] = useState('');
  const [stmt, setStmt] = useState<{ text: string; n: number } | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [apTip, setApTip] = useState(false);
  const [shake, setShake] = useState(0);
  const [layers, setLayers] = useState<{ kind: SceneKind; id: number; html: string }[]>([]);
  const [cap, setCap] = useState<{ text: string; n: number } | null>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLTextAreaElement>(null);

  // 画面遷移まわり
  const [paper, setPaper] = useState<Paper | null>(null);
  const [election, setElection] = useState<ElectionResult | null>(null);
  const [elecShown, setElecShown] = useState(false);
  const [wipeSt, setWipeSt] = useState<{ sub: string; main: string; phase: 'pre' | 'on' | 'out'; key: number } | null>(null);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [toast, setToast] = useState<{ text: string; n: number } | null>(null);
  const [bookFrom, setBookFrom] = useState<'title' | 'main'>('title');
  const [bookParty, setBookParty] = useState('ldp');
  const [bookCat, setBookCat] = useState('すべて');

  useEffect(() => {
    setMounted(true);
    setRecords(store.get<Records>(REC_KEY, { best: 0, maxAppr: 0, plays: 0 }));
    const g = store.get<GameState | null>(SAVE_KEY, null);
    if (g && g.version === 1 && !g.over) setSaved(g);
    fetch('/api/react').then((r) => r.json()).then((j) => setMode(j.mode)).catch(() => setMode('mock'));
  }, []);

  // 状態を確定させる（画面・参照・保存をそろえる）
  const commit = useCallback((s: GameState) => {
    gameRef.current = s;
    setGame(s);
    store.set(SAVE_KEY, s.over ? null : s);
  }, []);

  // ================= 演出 =================
  const addLog = useCallback((item: NewLog) => {
    setLog((l) => [...l, { ...item, id: ++logId.current }]);
  }, []);
  const sys = useCallback((text: string) => addLog({ kind: 'sys', text }), [addLog]);
  const showToast = useCallback((text: string, ms = 1800) => {
    const n = Date.now();
    setToast({ text, n });
    setTimeout(() => setToast((t) => (t?.n === n ? null : t)), ms);
  }, []);
  const wipe = useCallback((sub: string, main: string, next: () => void, ms = 1300) => {
    const key = Date.now();
    // 一度 'pre' で描いてから 'on' にすると、ストライプが横から入ってくる
    setWipeSt({ sub, main, phase: 'pre', key });
    requestAnimationFrame(() => requestAnimationFrame(() => setWipeSt((w) => (w?.key === key ? { ...w, phase: 'on' } : w))));
    setTimeout(() => {
      next();
      setWipeSt((w) => (w?.key === key ? { ...w, phase: 'out' } : w));
      setTimeout(() => setWipeSt((w) => (w?.key === key ? null : w)), 550);
    }, ms);
  }, []);

  // 1人分の発言を吹き出しに出し、「次へ」が押されるまで待つ。吹き出しは同時に1つだけ出す
  const speak = useCallback(async (k: SpeakerId, text: string, emo?: Emotion, fx: Fx = {}, last = true) => {
    const n = Date.now() + Math.random();
    setBubbles({ [k]: { text, emo, n, step: last ? 'last' : 'next' } });
    const d = Object.values(fx).reduce((a, v) => a + (v ?? 0), 0);
    if (d) setFnums((f) => ({ ...f, [k]: { d, n } }));
    // 話している人が画面外なら、そこまでスクロール
    const w = worldRef.current, st = stageRef.current;
    if (w && st) {
      const mx = (SPK[k].x / 1600) * st.offsetWidth;
      if (mx < w.scrollLeft + 100 || mx > w.scrollLeft + w.clientWidth - 100) w.scrollTo({ left: mx - w.clientWidth / 2, behavior: 'smooth' });
    }
    addLog({ kind: 'spk', who: k, emo, text, fx });
    await new Promise<void>((res) => { advanceRef.current = res; });
    setBubbles((b) => (b[k]?.n === n ? {} : b));
  }, [addLog]);

  const advance = useCallback(() => {
    const f = advanceRef.current;
    advanceRef.current = null;
    f?.();
  }, []);

  // 何人かの発言を順に出す。each は各発言を出す直前に呼ぶ（支持率の表示を1人ずつ進めるため）
  const speakAll = useCallback(async (lines: Line[], each?: (l: Line) => void) => {
    for (const [i, l] of lines.entries()) {
      each?.(l);
      await speak(l.who, l.text, l.emo, l.fx, i === lines.length - 1);
    }
  }, [speak]);

  // Enter でも「次へ」。入力欄の外ならスペースと→でも進める
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!advanceRef.current || e.isComposing) return;
      const inField = e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement;
      if (e.key === 'Enter' || (!inField && (e.key === ' ' || e.key === 'ArrowRight'))) {
        e.preventDefault();
        advance();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance]);

  // 発言を順に出している間は、ほかの操作を受け付けない
  const withBusy = async (fn: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await fn();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const peek = (k: SpeakerId, on: boolean) => {
    if (!on) {
      setBubbles((b) => (b[k]?.peek ? { ...b, [k]: undefined } : b));
      return;
    }
    if (bubbles[k] && !bubbles[k]!.peek) return;
    const g = gameRef.current;
    const dq = g.quests.map((q) => QUEST[q.id]).find((q) => q.who === k);
    const pv = facAvg(g.v, k);
    let text: string, emo: Emotion;
    const mood = GAME.mood[k];
    if (dq) { text = dq.say; emo = dq.kind === 'crisis' ? '焦' : '疑'; }
    else if (pv !== null && mood) { const t = pv < 30 ? 0 : pv < 55 ? 1 : 2; text = mood[t]; emo = (['怒', '疑', '喜'] as const)[t]; }
    else if (k === 'cab') { const a = approval(g); text = `支持率は${a.toFixed(1)}%です。${a < 30 ? '世論が荒れています、ご注意を。' : '今のところ落ち着いています。'}`; emo = '安'; }
    else if (k === 'press') { text = '総理、次の一手をお聞かせください。'; emo = '疑'; }
    else return;
    setBubbles((b) => ({ ...b, [k]: { text, emo, peek: true, sup: pv, n: Date.now() } }));
  };

  const setScene = useCallback((kind: SceneKind, instant = false) => {
    setLayers((ls) => {
      if (!instant && ls.at(-1)?.kind === kind) return ls;
      return [...ls.slice(-1), { kind, id: Date.now(), html: sceneSVG(kind) }];
    });
    const n = Date.now();
    setCap({ text: SCENES[kind].cap, n });
    setTimeout(() => setCap((c) => (c?.n === n ? null : c)), 4500);
  }, []);

  // ================= 政策表明 =================
  const react = useCallback(async (lines: Line[], final: GameState) => {
    const a0 = approval(gameRef.current);
    const v = { ...gameRef.current.v };
    await wait(400);
    await speakAll(lines, (l) => {
      for (const [k, d] of Object.entries(l.fx) as [FacId, number][]) v[k] = clamp(v[k] + d);
      setShownV({ ...v });
    });
    commit(final);
    setShownV(null);
    if (approval(final) < a0 - 0.5) setShake((x) => x + 1);
    await wait(700);
    setScene(pickScene(final));
  }, [commit, setScene, speakAll]);

  const say = () => {
    const text = input.trim();
    if (!text) return;
    return withBusy(async () => {
      setInput('');
      const sn = Date.now();
      setStmt({ text, n: sn });
      setTimeout(() => setStmt((x) => (x?.n === sn ? null : x)), 5000);
      addLog({ kind: 'me', text });
      const g = gameRef.current;
      let freeform: Policy | undefined;
      // 公約に当たらない表明だけ Gemini に反応を作らせる
      if (mode === 'gemini' && !matchPolicy(text) && g.capital >= 1) {
        setThinking(true);
        try {
          const r = await fetch('/api/react', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ text, v: g.v }),
          });
          if (r.status === 429) showToast('街の声が混み合っています。少し待ってから、もう一度どうぞ', 3000);
          const j = await r.json();
          if (j.policy) freeform = sanitizeFreeform(j.policy);
        } catch {
          // 失敗したらキーワード方式だけで続ける
        } finally {
          setThinking(false);
        }
      }
      const { state, result } = declare(gameRef.current, text, { freeform });
      result.notes.forEach(sys);
      const sup = result.policy?.supporters ?? [];
      if (sup.length && !result.rejected) {
        const names = sup.map((id) => PARTY[id].short).join('・');
        setTimeout(() => showToast(sup.includes('ldp') ? `${names} の公約に沿った表明` : `${names} の公約と同じ方向！野党が賛同`, 2600), 400);
      }
      await react(result.lines, state);
    });
  };

  const answerQuest = (id: string, accept: boolean) => withBusy(async () => {
    const { state, lines, notes } = respondQuest(gameRef.current, id, accept);
    commit(state);
    notes.forEach(sys);
    if (!accept) setShake((x) => x + 1);
    await speakAll(accept ? lines.map((l) => ({ ...l, fx: {} })) : lines);
  });

  // ================= 画面遷移 =================
  const resetOffice = () => {
    setLog([]);
    setBubbles({});
    setFnums({});
    setShownV(null);
    setLayers([]);
  };

  const start = () => {
    const g = newGame(Date.now());
    commit(g);
    setSaved(null);
    resetOffice();
    wipe(`第${GAME.start.cabinetNo}代`, '内閣総理大臣に就任！', () => {
      const n = news(g, { first: true });
      commit(n.state);
      setPaper(n.paper);
      setScreen('news');
    }, 1800);
  };

  const resume = () => {
    if (!saved) return;
    commit(saved);
    resetOffice();
    wipe('', '官邸へ', () => {
      setScreen('main');
      setScene(pickScene(saved), true);
      sys(`${quarterLabel(saved.turn).join('年 Q')}　再開`);
    }, 900);
  };

  const toOffice = () => withBusy(async () => {
    const g = gameRef.current;
    setScreen('main');
    setScene(pickScene(g), true);
    requestAnimationFrame(() => {
      const w = worldRef.current;
      if (w) w.scrollLeft = (w.scrollWidth - w.clientWidth) / 2;
    });
    await wait(900);
    if (g.turn === 0) {
      sys('新内閣 発足！');
      await speakAll([
        { who: 'cab', emo: '安', text: '総理、就任おめでとうございます！まずは所信表明を。下の欄にどうぞ。', fx: {} },
        { who: 'press', emo: '疑', text: '総理、物価高・少子化・財政。最優先はどれですか？', fx: {} },
      ]);
      return;
    }
    const [y, q] = quarterLabel(g.turn);
    sys(`${y}年 Q${q}`);
    const fresh: Line[] = g.quests.filter((x) => x.fresh).map((aq) => {
      const Q = QUEST[aq.id];
      return { who: Q.who, emo: Q.kind === 'crisis' ? '焦' : '疑', text: Q.say, fx: {} };
    });
    await speakAll([...fresh, ...expiredLines(g)]);
  });

  const gameOver = () => {
    const g = gameRef.current;
    const r = store.get<Records>(REC_KEY, { best: 0, maxAppr: 0, plays: 0 });
    const next = { best: Math.max(r.best, g.turn), maxAppr: Math.max(r.maxAppr, g.maxAppr), plays: r.plays + 1 };
    store.set(REC_KEY, next);
    store.set(SAVE_KEY, null);
    setRecords(next);
    setScreen('over');
  };

  const startElection = () => {
    const { state, result } = runElection(gameRef.current);
    commit(state);
    setElection(result);
    setElecShown(false);
    setScreen('election');
    setTimeout(() => setElecShown(true), 2600);
  };

  const endTurn = () => {
    if (busyRef.current) return;
    wipe('', '次の四半期へ', () => {
      const r = endQuarter(gameRef.current);
      commit(r.state);
      if (r.outcome === 'resign') return setTimeout(() => wipe('与党内で退陣論', '内閣総辞職', gameOver, 1500), 600);
      if (r.outcome === 'election') return setTimeout(() => wipe('任期満了', '衆議院選挙！', startElection, 1500), 600);
      const n = news(r.state, { headline: r.headline });
      commit(n.state);
      setPaper(n.paper);
      setScreen('news');
    }, 1000);
  };

  const afterElection = () => {
    if (!election) return;
    if (!election.win) return wipe('政権交代', '首相退陣', gameOver, 1300);
    const g = gameRef.current;
    const n = news(g, { headline: g.lastNews });
    commit({ ...n.state, lastNews: null });
    setPaper(n.paper);
    setScreen('news');
  };

  const dissolve = () =>
    !busyRef.current && setModal({
      title: '解散総選挙する？',
      body: <>いまの内閣支持率は <b>{approval(gameRef.current).toFixed(1)}%</b>。<br />勝てば任期リセット、負ければ即失脚！</>,
      btns: [['やめる', '', null], ['解散！', 'coral', () => wipe('衆議院', '解散総選挙！', startElection, 1500)]],
    });

  const howTo = () =>
    setModal({
      title: '遊び方',
      align: 'right',
      body: (
        <>
          政策は自分の言葉で表明しよう。困ったら「政策」ボタンの公約ブックから選んでもOK。<br />
          街の人や外国がその場で反応して、支持率が動く。<br />
          人は得より損に敏感で、うれしさには慣れてしまう。約束を守るほど、言葉が信じてもらえる。<br />
          次々くる危機と陳情に期限内に応えよう。<br />
          <b>支持率が2ターン連続20%未満／選挙で過半数割れ</b>で失脚！<br />
          <small>これはフィクションのシミュレーションです。公約は実在の政党の要旨ですが、反応や支持率の変化はゲーム用の仮定です。</small>
        </>
      ),
      btns: [['OK', 'sun', null]],
    });

  const openBook = (from: 'title' | 'main') => {
    setBookFrom(from);
    setScreen('book');
  };

  // ================= 描画 =================
  const v = shownV ?? game.v;
  const a = approvalOf(v);
  const titleScene = useMemo(() => (mounted ? sceneSVG('good') : ''), [mounted]);
  const overScene = useMemo(() => (mounted ? sceneSVG('ruin') : ''), [mounted]);
  const scene = layers.at(-1)?.kind;
  if (!mounted) return null;

  return (
    <>
      {toast && <div className="toast panel on" key={toast.n}>{toast.text}</div>}
      <div className={`wipe ${wipeSt && wipeSt.phase !== 'pre' ? 'on' : ''} ${wipeSt?.phase === 'out' ? 'out' : ''}`} key={wipeSt?.key ?? 0}>
        <div className="bg" />
        <div className="tx">
          {wipeSt?.sub && <small>{wipeSt.sub}</small>}
          <b className="disp">{wipeSt?.main}</b>
        </div>
      </div>
      {modal && (
        <div className="modal-bg on">
          <div className="modal panel">
            <h3 className="disp">{modal.title}</h3>
            <p className={modal.align}>{modal.body}</p>
            <div className="row">
              {modal.btns.map(([l, cls, fn]) => (
                <button key={l} className={`btn ${cls}`} onClick={() => { setModal(null); fn?.(); }}>{l}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {screen === 'title' && (
        <section className="screen on" id="title">
          <Svg className="scn" html={titleScene} />
          <div className="t-wrap"><div>
            <h1 className="logo disp">もしも<span>政治</span></h1>
            <div className="sub">あなたが総理なら、この国を何年もたせられる？</div>
            <div className="t-menu">
              {saved && <button className="btn mint" onClick={resume}><i className="fa-solid fa-rotate-left" />続きから（{tenure(saved.turn)}）</button>}
              <button className="btn sun" onClick={start}><i className="fa-solid fa-play" />組閣する</button>
              <button className="btn" onClick={() => openBook('title')}><i className="fa-solid fa-book-open" />公約ブック</button>
              <button className="btn" onClick={howTo}><i className="fa-solid fa-circle-question" />遊び方</button>
            </div>
            <div className="t-rec">
              <div className="panel">最長在任<b className="num">{records.best ? tenure(records.best) : '—'}</b></div>
              <div className="panel">最高支持率<b className="num">{records.maxAppr ? `${records.maxAppr}%` : '—'}</b></div>
              <div className="panel">プレイ回数<b className="num">{records.plays}</b></div>
            </div>
          </div></div>
          <div className="fiction">フィクションのシミュレーションです。実在の政党・人物の評価を示すものではありません。</div>
        </section>
      )}

      {screen === 'book' && (
        <Book
          from={bookFrom}
          party={bookParty}
          cat={bookCat}
          setParty={(p) => { setBookParty(p); setBookCat('すべて'); }}
          setCat={setBookCat}
          back={() => setScreen(bookFrom)}
          pick={(title) => { setScreen('main'); setInput(`${title}を進めます`); setTimeout(() => chatRef.current?.focus(), 50); }}
        />
      )}

      {screen === 'news' && paper && (
        <section className="screen on" id="news">
          <div className="center"><div>
            <div className="np panel">
              <div className="np-top"><span className="mast disp">もしも新聞</span><span className="date">{paper.year}年 第{paper.quarter}四半期</span></div>
              <div className="np-body">
                <div><h1 className="disp">{paper.head}</h1><p>{paper.lead}</p></div>
                <Svg className="photo" html={sceneSVG(paper.scene)} />
              </div>
              <div className="np-foot">
                <div className="poll"><small>内閣支持率</small><b className="num">{paper.approval}%</b><small>{paper.delta == null ? '発足時' : `${paper.delta >= 0 ? '▲' : '▼'}${Math.abs(paper.delta)}`}</small></div>
                {paper.columns.map(([t, p]) => <div key={t}><h4>{t}</h4><p>{p}</p></div>)}
              </div>
            </div>
            <div className="go"><button className="btn sun" onClick={toOffice}>官邸へ <i className="fa-solid fa-arrow-right" /></button></div>
          </div></div>
        </section>
      )}

      {screen === 'main' && (
        <section className="screen on" id="main">
          <div className="world" ref={worldRef}>
            <div className="stage" ref={stageRef}>
              {layers.map((l, i) => (
                <Svg key={l.id} className={`layer ${i > 0 ? 'fadein' : ''}`} html={l.html} />
              ))}
              <div className="rain" style={{ opacity: scene && SCENES[scene].rain ? 1 : 0 }} />
              <div className={`flash ${scene && SCENES[scene].rain ? 'on' : ''}`} />
              <div>
                {SPEAKER_IDS.map((k) => (
                  <Marker key={k} k={k} v={facAvg(v, k)} bubble={bubbles[k]} fnum={fnums[k]} onPeek={(on) => peek(k, on)} onNext={advance} />
                ))}
              </div>
            </div>
          </div>

          <div className="hud">
            <div className="pm panel">
              <div className="av"><i className="fa-solid fa-user-tie" /></div>
              <div><small>在任 {tenure(game.turn)}</small><b>{quarterLabel(game.turn)[0]}年 Q{quarterLabel(game.turn)[1]}</b></div>
            </div>
            <div className="meters">
              <div
                className={`mt panel ${shake ? 'shake' : ''}`}
                key={shake}
                tabIndex={0}
                style={{ cursor: 'help' }}
                onMouseEnter={() => setApTip(true)}
                onMouseLeave={() => setApTip(false)}
                onClick={() => setApTip((x) => !x)}
                onBlur={() => setApTip(false)}
              >
                <div className="ic" style={{ background: 'var(--mint)' }}><i className="fa-solid fa-heart" /></div>
                <div><span className="lb">内閣支持率</span><div className="bar"><i style={{ background: 'var(--mint)', width: `${a}%` }} /><span className="th" style={{ left: '20%' }} /></div></div>
                <span className="v num">{a.toFixed(1)}%</span>
                <Delta a={a} prev={game.prevAppr} />
              </div>
            </div>
            <div className="res panel">
              <div><span className="lb">政治資本</span><div className="bolts">{Array.from({ length: GAME.quarter.capital.max }, (_, i) => <i key={i} className={`fa-solid fa-bolt ${i < game.capital ? 'on' : ''}`} />)}</div></div>
              <div><span className="lb">選挙まで</span><span className="v num">{game.elec}</span></div>
            </div>
          </div>
          <div className={`aptip panel ${apTip ? 'on' : ''}`}>{apTip && <ApTip v={v} game={game} />}</div>
          <div className="mode" title={mode === 'gemini' ? '公約に当たらない表明には Gemini が反応を作ります' : 'GEMINI_API_KEY がないので、公約データのキーワードだけで反応します'}>
            <i className="fa-solid fa-wand-magic-sparkles" /> {mode === 'gemini' ? '反応：Gemini' : '反応：モックモード'}
          </div>

          <div className="quests">
            {game.quests.map((q) => {
              const Q = QUEST[q.id];
              const pending = Q.kind === 'demand' && !q.promised;
              return (
                <div key={q.id} className={`qc panel ${Q.kind}`}>
                  <div className="qh">
                    <i className={`fa-solid ${Q.icon}`} /><b>{Q.title}</b>
                    {!pending && <span className="pips">{Array.from({ length: Q.ttl }, (_, i) => <i key={i} className={i < q.left ? '' : 'off'} />)}</span>}
                  </div>
                  <div className="qb">
                    {pending ? (
                      <>
                        <b>{role(Q.who)}</b>「{Q.say}」
                        <div className="qa">
                          <button className="btn mint" disabled={busy} onClick={() => answerQuest(q.id, true)}><i className="fa-solid fa-handshake" />約束する</button>
                          <button className="btn" disabled={busy} onClick={() => answerQuest(q.id, false)}>断る</button>
                        </div>
                      </>
                    ) : (
                      <>
                        {Q.desc}
                        {q.promised && <div className="ok"><i className="fa-solid fa-handshake" />約束済み・残り{q.left}ターン</div>}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className={`cap ${cap ? 'on' : ''}`}>{cap?.text}</div>
          <div className={`stmt panel ${stmt ? 'on' : ''}`}>
            <small><i className="fa-solid fa-microphone-lines" />総理会見</small><p>{stmt?.text}</p>
          </div>
          {thinking && <div className="thinking panel"><i className="fa-solid fa-spinner" />街の声を集めています…</div>}

          <div className="tools">
            <button className="btn" onClick={() => setLogOpen((x) => !x)}><i className="fa-solid fa-comments" />ログ</button>
            <button className="btn" disabled={busy} onClick={dissolve}><i className="fa-solid fa-check-to-slot" />解散</button>
          </div>
          <div className="dock panel">
            <div className="row">
              <button className="btn bookbtn" disabled={busy} onClick={() => openBook('main')}><i className="fa-solid fa-scroll" />政策</button>
              <textarea
                ref={chatRef}
                value={input}
                maxLength={200}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); say(); }
                }}
                placeholder="総理として、政策を自分の言葉で表明しよう"
              />
              <button className="btn sun say" disabled={busy} onClick={say}>表明<small><i className="fa-solid fa-bolt" />×1</small></button>
            </div>
          </div>
          <button className="endturn" disabled={busy} onClick={endTurn}><i className="fa-solid fa-forward" />ターン<br />終了</button>
          <div className={`log panel ${logOpen ? 'on' : ''}`}>
            <h3 className="disp">ログ<button onClick={() => setLogOpen(false)}><i className="fa-solid fa-xmark" /></button></h3>
            <LogList log={log} />
          </div>
        </section>
      )}

      {screen === 'election' && election && (
        <section className="screen on" id="election">
          <div className="el">
            <span className="tag disp">開票速報</span>
            <h2 className="disp">第{election.electionNo}回 衆議院選挙</h2>
            <Hemicycle seats={election.seats} />
            <div className="tally">
              <div className="panel" style={{ background: '#ffc93c' }}><small>与党（{game.coalBroken ? '自民' : '自民・維新'}）</small><b className="num">{election.ruling}</b></div>
              {election.seats.filter(([, n]) => n > 0).map(([id, n]) => (
                <div key={id} className="panel" style={{ background: PARTY[id].color }}><small>{PARTY[id].short}</small><b className="num">{n}</b></div>
              ))}
            </div>
            <div
              className={`res-banner disp ${elecShown ? 'on' : ''}`}
              style={{ background: election.win ? 'var(--sun)' : 'var(--coral)', color: election.win ? 'var(--navy)' : '#fff' }}
            >
              {election.win ? '与党 過半数確保！' : '与党 過半数割れ…'}
            </div>
            <div style={{ marginTop: 22, minHeight: 52 }}>
              {elecShown && (
                <button className="btn sun" onClick={afterElection}>
                  {election.win ? <>政権続投 <i className="fa-solid fa-arrow-right" /></> : '退陣する'}
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {screen === 'over' && <Over game={game} scene={overScene} retry={() => wipe('', 'タイトルへ', () => setScreen('title'), 800)} share={() => showToast('シェア機能は準備中です')} />}
    </>
  );
}

// ================= 部品 =================
function Delta({ a, prev }: { a: number; prev: number | null }) {
  const d = prev == null ? 0 : +(a - prev).toFixed(1);
  return <span className={`d num ${d > 0 ? 'up' : 'dn'}`}>{d ? `${d > 0 ? '▲' : '▼'}${Math.abs(d)}` : ''}</span>;
}

function Marker({ k, v, bubble, fnum, onPeek, onNext }: {
  k: SpeakerId; v: number | null; bubble?: Bubble; fnum?: { d: number; n: number }; onPeek: (on: boolean) => void; onNext: () => void;
}) {
  const p = SPK[k];
  const C = 2 * Math.PI * 30;
  const e = bubble?.emo && EMO[bubble.emo];
  return (
    <div
      className={`mk ${v === null ? 'sq' : ''} ${v !== null && v < 25 ? 'low' : ''} ${p.x < 220 ? 'edge-l' : p.x > 1380 ? 'edge-r' : ''} ${bubble && !bubble.peek ? 'talk' : ''}`}
      style={{ left: `${p.x / 16}%`, top: `${p.y / 9}%`, zIndex: bubble ? 15 : undefined }}
      onMouseEnter={() => onPeek(true)}
      onMouseLeave={() => onPeek(false)}
    >
      <div className={`bub ${bubble ? 'on' : ''} ${bubble?.peek ? 'peek' : ''} ${bubble?.step ? 'step' : ''}`}>
        {bubble && (
          <>
            <div className="who">{e && <i className={`fa-solid ${e[0]}`} style={{ color: e[1] }} />}<span className="n">{role(k)}</span></div>
            <p>{bubble.text}</p>
            {bubble.peek && bubble.sup != null && (
              <div className="sup"><span>支持率</span><div className="sb"><i style={{ width: `${bubble.sup}%`, background: moodCol(bubble.sup) }} /></div><b className="num">{bubble.sup}%</b></div>
            )}
            {bubble.step && (
              <button className="bub-next" onClick={onNext} autoFocus={false}>
                {bubble.step === 'next' ? <>次へ<i className="fa-solid fa-caret-right" /></> : 'OK'}
              </button>
            )}
          </>
        )}
      </div>
      {fnum && <span key={fnum.n} className={`fnum num show ${fnum.d > 0 ? 'p' : 'm'}`}>{fnum.d > 0 ? '+' : '−'}{Math.abs(fnum.d)}</span>}
      <div className="pin" style={{ background: p.c }}>
        {v !== null && (
          <svg className="ring" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="30" fill="none" stroke="#1f224455" strokeWidth="5" />
            <circle cx="32" cy="32" r="30" fill="none" stroke={moodCol(v)} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${(C * v) / 100} ${C}`} />
          </svg>
        )}
        <i className={`fa-solid ${p.ic}`} />
        {v !== null && <span className="face"><i className={`fa-solid ${moodIc(v)}`} style={{ color: moodCol(v) }} /></span>}
      </div>
      <div className="nm">{role(k)}</div>
    </div>
  );
}

function ApTip({ v, game }: { v: Record<FacId, number>; game: GameState }) {
  const Row = ({ nm, w, val }: { nm: string; w: string; val: number }) => (
    <div className="row"><span>{nm}</span><small>{w}</small><div className="bar"><i style={{ width: `${val}%`, background: moodCol(val) }} /></div><b>{Math.round(val)}</b></div>
  );
  return (
    <>
      <h4>属性別の支持率<small>国内は重み付きで内閣支持率に反映</small></h4>
      {[...DOMESTIC].sort((x, y) => v[x.id] - v[y.id]).map((f) => <Row key={f.id} nm={f.name} w={`${Math.round(f.weight * 100)}%`} val={v[f.id]} />)}
      <div className="sep">外国（内閣支持率には含まない）</div>
      {FOREIGN.map((f) => <Row key={f.id} nm={f.name} w="" val={v[f.id]} />)}
      <div className="sep">政権の状態</div>
      <div className="meta">
        <span>政権への信頼</span><b>{Math.round(game.trust)}</b>
        <span>連立（維新）との関係</span><b>{game.coalBroken ? '離脱' : Math.round(game.coal)}</b>
        <span>財政のツケ</span><b>{game.bill}/{GAME.quarter.bill.limit}</b>
      </div>
    </>
  );
}

function LogList({ log }: { log: LogItem[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = 1e9; }, [log]);
  return (
    <div className="tl" ref={ref}>
      {log.map((l) => {
        if (l.kind === 'sys') return <div key={l.id} className="ln sys">{l.text}</div>;
        const p = l.kind === 'me' ? ME : { ...SPK[l.who], role: role(l.who) };
        const fx = l.kind === 'spk' ? (Object.entries(l.fx) as [FacId, number][]).filter(([, d]) => d) : [];
        return (
          <div key={l.id} className={`ln ${l.kind === 'me' ? 'me' : ''}`}>
            <div className="a" style={{ background: p.c }}><i className={`fa-solid ${p.ic}`} /></div>
            <div className="t">
              <b>{p.role}</b>　<span>{l.text}</span>
              {fx.length > 0 && <div className="fx">{fx.map(([f, d]) => <span key={f} className={d > 0 ? 'up' : 'dn'}>{FN[f]}{d > 0 ? '+' : ''}{d}</span>)}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Hemicycle({ seats }: { seats: [string, number][] }) {
  const circles = useMemo(() => {
    const total = seats.reduce((x, [, n]) => x + n, 0);
    const pts: [number, number, number][] = [];
    const rows = 10, rad = [...Array(rows)].map((_, i) => 120 + i * 19), sum = rad.reduce((x, y) => x + y);
    let made = 0;
    rad.forEach((rr, ri) => {
      const n = ri === rows - 1 ? total - made : Math.round((total * rr) / sum);
      made += n;
      for (let i = 0; i < n; i++) { const t = Math.PI - (Math.PI * i) / (n - 1); pts.push([t, 320 + rr * Math.cos(t), 320 - rr * Math.sin(t)]); }
    });
    pts.sort((p, q) => q[0] - p[0]);
    const out: { x: number; y: number; c: string; k: number }[] = [];
    let k = 0;
    for (const [id, n] of seats) for (let i = 0; i < n; i++, k++) out.push({ x: pts[k][1], y: pts[k][2], c: PARTY[id].color, k });
    return out;
  }, [seats]);
  return (
    <svg className="hemi" viewBox="0 0 640 340">
      {circles.map((c) => (
        <circle key={c.k} cx={c.x.toFixed(1)} cy={c.y.toFixed(1)} r="6.5" fill={c.c} stroke="#1f2244" strokeWidth="1.5" opacity="0">
          <animate attributeName="opacity" from="0" to="1" dur=".2s" begin={`${(c.k * 5) / 1000}s`} fill="freeze" />
        </circle>
      ))}
      <line x1="320" y1="110" x2="320" y2="332" stroke="#fff5e1" strokeWidth="3" strokeDasharray="6 6" />
      <text x="320" y="100" textAnchor="middle" fill="#fff5e1" fontSize="13" fontFamily="M PLUS Rounded 1c" fontWeight="800">過半数 {GAME.election.majority}</text>
    </svg>
  );
}

function Over({ game, scene, retry, share }: { game: GameState; scene: string; retry: () => void; share: () => void }) {
  const s = summary(game);
  const list = [...GAME.rivals.map(([n, t]) => [n, t, false] as const), ['あなた', game.turn, true] as const].sort((p, q) => q[1] - p[1]);
  return (
    <section className="screen on" id="over">
      <Svg className="scn" html={scene} style={{ opacity: 0.35 }} />
      <div className="ov"><div>
        <h1 className="ov-t disp">失脚！</h1>
        <div><div className="ov-r panel">{s.reason}</div></div>
        <div className="badge panel"><i className="fa-solid fa-award" /><div><small>獲得称号</small><b className="disp">{s.title}</b></div></div>
        <div className="stats">
          <div className="panel"><small>在任期間</small><b className="num">{s.tenure}</b></div>
          <div className="panel"><small>スコア</small><b className="num">{s.score.toLocaleString()}</b></div>
          <div className="panel"><small>最高支持率</small><b className="num">{s.maxAppr}%</b></div>
        </div>
        <div className="rank panel">
          {list.map(([n, t, me], i) => (
            <div key={n} className={me ? 'me' : ''}>
              <span className="num">{i + 1}</span>
              <span>{n}{me && <> <span className="pill" style={{ borderColor: 'var(--coral2)' }}>NEW</span></>}</span>
              <b className="num">{tenure(t)}</b>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn sun" onClick={retry}><i className="fa-solid fa-rotate-right" />もう一度組閣する</button>
          <button className="btn" onClick={share}><i className="fa-solid fa-share-nodes" />結果をシェア</button>
        </div>
      </div></div>
    </section>
  );
}

// 公約ブック（公約データの閲覧と、ゲーム開始時点で1回表明した場合のシミュレーション）
const INIT_V = newGame(1).v;
function simulate(id: string) {
  const p = POLICIES.find((x) => x.id === id)!;
  const v = { ...INIT_V };
  const fx: Fx = {};
  for (const r of p.reactions) for (const [k, d] of Object.entries(transformFx(r.fx)) as [FacId, number][]) { fx[k] = (fx[k] ?? 0) + d; v[k] = clamp(v[k] + d); }
  return { dA: +(approvalOf(v) - approvalOf(INIT_V)).toFixed(1), fx, n: p.reactions.length };
}

function Book({ from, party, cat, setParty, setCat, back, pick }: {
  from: 'title' | 'main'; party: string; cat: string; setParty: (p: string) => void; setCat: (c: string) => void;
  back: () => void; pick: (title: string) => void;
}) {
  const P = PARTY[party];
  const pool = POLICY_DATA.filter((p) => party === 'all' || p.party === party);
  const cats = ['すべて', ...new Set(pool.map((p) => p.cat))];
  return (
    <section className="screen on" id="book">
      <div className="book">
        <div className="book-h">
          <h2 className="disp"><i className="fa-solid fa-book-open" /> 公約ブック</h2>
          <p>各政党の直近の公約（主に2026年2月の第51回衆院選）をもとにしたデータです。2026年9月時点で整理。支持率の変化は、ゲーム開始時点で1回表明した場合の<b>ゲーム内シミュレーション</b>で、実際の世論を示すものではありません。</p>
          <button className="btn sun" onClick={back}><i className="fa-solid fa-arrow-left" />{from === 'main' ? '官邸に戻る' : 'タイトルへ'}</button>
        </div>
        <div className="parties">
          {['all', ...PARTIES.map((p) => p.id)].map((id) => {
            const PP = PARTY[id];
            const n = POLICY_DATA.filter((x) => id === 'all' || x.party === id).length;
            return (
              <button key={id} className={id === party ? 'on' : ''} onClick={() => setParty(id)}>
                <PartyLogo id={id} />
                {PP ? <>{PP.short}<small>{PP.seats}議席</small></> : 'すべての政党'}<small>{n}件</small>
              </button>
            );
          })}
        </div>
        <div className="pinfo">
          <PartyLogo id={party} big />
          <div>
            {P ? <><b>{P.name}</b>　衆院 {P.seats}議席（2026年2月衆院選）・{P.bloc === 'ruling' ? '与党' : '野党'}<br />出典：{P.source}{P.note && <><br />※{P.note}</>}</> : <><b>すべての政党</b><br />全政党の公約を横断して表示中</>}
          </div>
        </div>
        <div className="cats">
          {cats.map((c) => <button key={c} className={c === cat ? 'on' : ''} onClick={() => setCat(c)}>{c}</button>)}
        </div>
        <div className="cards">
          {!pool.length && <p style={{ color: 'var(--cream)' }}>この政党の公約データはまだありません。</p>}
          {pool.filter((p) => cat === 'すべて' || p.cat === cat).map((p) => {
            const PP = PARTY[p.party];
            const s = simulate(p.id);
            const rows = (Object.entries(s.fx) as [FacId, number][]).filter(([, d]) => d).sort((x, y) => y[1] - x[1]);
            return (
              <div key={p.id} className="pc panel" style={{ ['--pc' as string]: PP.color }}>
                <div className="ph">
                  <div className="ic"><i className={`fa-solid ${p.icon}`} /></div>
                  <div><small><span className="pbadge" style={{ background: PP.color }}>{PP.short}</span>{p.cat}・{p.source ?? PP.source}</small><b>{p.title}</b></div>
                </div>
                <div className="pb">
                  <p className="sum">{p.summary}</p>
                  <div className="sim">
                    <div><small>支持率（即時の予測）</small><b className={`num ${s.dA >= 0 ? 'up' : 'dn'}`}>{s.dA >= 0 ? '+' : ''}{s.dA}</b></div>
                    <div><small>コスト</small><b className="num">{Array.from({ length: p.cost }, (_, i) => <i key={i} className="fa-solid fa-bolt" style={{ color: 'var(--sun2)' }} />)}</b></div>
                  </div>
                  <div className="fxl">
                    {rows.map(([k, d]) => (
                      <FxRow key={k} name={FN[k]} d={d} />
                    ))}
                  </div>
                </div>
                <div className="pf">
                  <span className="pill">{s.n}人が反応</span>
                  {from === 'main' && <button className="btn sun" onClick={() => pick(p.title)}><i className="fa-solid fa-bullhorn" />この政策を表明</button>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// 政党のロゴ。画像（PARTY[id].logo）がなければ、党の色と略称のエンブレムを出す
function PartyLogo({ id, big = false }: { id: string; big?: boolean }) {
  const P = PARTY[id];
  const cls = `plogo${big ? ' big' : ''}`;
  if (!P) return <span className={`${cls} all`}><i className="fa-solid fa-landmark" /></span>;
  if (P.logo) return <img className={`${cls} img`} src={`/logos/${P.logo}`} alt={`${P.name}のロゴ`} />;
  return <span className={cls} style={{ background: P.color }} aria-hidden>{P.short}</span>;
}

function FxRow({ name, d }: { name: string; d: number }) {
  return (
    <>
      <span>{name}</span>
      <div className="bar"><i style={d > 0 ? { left: '50%', width: `${d * 4}%`, background: 'var(--mint)' } : { right: '50%', width: `${-d * 4}%`, background: 'var(--coral)' }} /></div>
      <b className={d > 0 ? 'up' : 'dn'}>{d > 0 ? '+' : ''}{d}</b>
    </>
  );
}
