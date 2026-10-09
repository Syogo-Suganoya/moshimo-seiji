// POST /api/interview：深掘りモードの質問（phase: 'ask'）と、答え方の判定（phase: 'judge'）を返す。
// 返すのは質問・セリフ・判定の区分だけで、支持率と信頼の計算はブラウザ側のエンジン（applyInterview）が行う
import { GAME, type SpeakerId } from '@moshimo/engine';
import { generateAsk, generateJudge, hasKey } from '@/lib/gemini';
import { fromOtherSite, rateLimited } from '@/lib/guard';

const MAX_TEXT = 200;
const I = GAME.interview;
const str = (x: unknown, n: number) => (typeof x === 'string' ? x.trim().slice(0, n) : '');
const isSpeaker = (x: unknown): x is SpeakerId => typeof x === 'string' && Object.hasOwn(GAME.speakers, x);

export async function POST(req: Request) {
  if (!hasKey()) return Response.json({ error: 'Gemini のキーがありません' }, { status: 503 });
  if (fromOtherSite(req)) return Response.json({ error: 'このサイトの外からは使えません' }, { status: 403 });
  if (await rateLimited(req)) return Response.json({ error: 'rate-limited' }, { status: 429 });
  let body: { phase?: unknown; text?: unknown; lines?: unknown; who?: unknown; qa?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'JSONが不正です' }, { status: 400 });
  }
  const text = str(body.text, MAX_TEXT);
  if (!text) return Response.json({ error: '表明文がありません' }, { status: 400 });
  const arr = (x: unknown) => (Array.isArray(x) ? x : []) as Record<string, unknown>[];
  try {
    if (body.phase === 'ask') {
      const who = [...new Set((Array.isArray(body.who) ? body.who : []).filter(isSpeaker))].slice(0, I.maxAsk);
      const lines = arr(body.lines).filter((l) => isSpeaker(l?.who)).slice(0, 20)
        .map((l) => ({ who: l.who as SpeakerId, text: str(l.text, 120) }));
      if (!who.length) return Response.json({ questions: [] });
      return Response.json({ questions: await generateAsk(text, lines, who) });
    }
    if (body.phase === 'judge') {
      const qa = arr(body.qa).filter((x) => isSpeaker(x?.who)).slice(0, I.maxAsk)
        .map((x) => ({ who: x.who as SpeakerId, q: str(x.q, I.maxQuestion), a: str(x.a, I.maxAnswer) }));
      if (!qa.length) return Response.json({ judgements: [] });
      return Response.json({ judgements: await generateJudge(text, qa) });
    }
    return Response.json({ error: 'phase が不正です' }, { status: 400 });
  } catch (e) {
    console.error('[api/interview] Gemini の呼び出しに失敗', e);
    return Response.json({ error: '質問を作れませんでした' }, { status: 502 });
  }
}
