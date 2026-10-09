// POST /api/react：公約に当たらない表明への反応を返す。
// 返すのは素の値だけで、支持率の計算はブラウザ側のエンジンが行う
import { FAC_IDS, type FacId } from '@moshimo/engine';
import { generateFreeform, hasKey, MODEL } from '@/lib/gemini';
import { fromOtherSite, rateLimited } from '@/lib/guard';

const MAX_TEXT = 200;

export async function GET() {
  return Response.json({ mode: hasKey() ? 'gemini' : 'mock', model: hasKey() ? MODEL : null });
}

export async function POST(req: Request) {
  if (!hasKey()) return Response.json({ mode: 'mock', policy: null });
  if (fromOtherSite(req)) return Response.json({ error: 'このサイトの外からは使えません' }, { status: 403 });
  if (await rateLimited(req)) {
    return Response.json({ mode: 'gemini', policy: null, error: 'rate-limited' }, { status: 429 });
  }
  let body: { text?: unknown; v?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'JSONが不正です' }, { status: 400 });
  }
  const text = typeof body.text === 'string' ? body.text.trim().slice(0, MAX_TEXT) : '';
  if (!text) return Response.json({ error: '表明文がありません' }, { status: 400 });
  const num = (x: unknown, d: number) => (typeof x === 'number' && Number.isFinite(x) ? Math.max(0, Math.min(100, x)) : d);
  const v = Object.fromEntries(FAC_IDS.map((id) => [id, num(body.v?.[id], 50)])) as Record<FacId, number>;
  try {
    const policy = await generateFreeform({ text, v });
    return Response.json({ mode: 'gemini', policy });
  } catch (e) {
    console.error('[api/react] Gemini の呼び出しに失敗', e);
    return Response.json({ mode: 'gemini', policy: null, error: '反応を作れませんでした' }, { status: 502 });
  }
}
