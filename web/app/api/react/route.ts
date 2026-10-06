// POST /api/react：公約に当たらない表明への反応を返す。
// 返すのは素の値だけで、支持率の計算はブラウザ側のエンジンが行う
import { checkRateLimit } from '@vercel/firewall';
import { FAC_IDS, type FacId } from '@moshimo/engine';
import { generateFreeform, hasKey, MODEL } from '@/lib/gemini';

const MAX_TEXT = 200;
// Vercel の Firewall に作る rate limit ルールの ID
const RATE_LIMIT_ID = process.env.RATE_LIMIT_ID || 'moshimo-react';

export async function GET() {
  return Response.json({ mode: hasKey() ? 'gemini' : 'mock', model: hasKey() ? MODEL : null });
}

// ほかのサイトのページから呼ばれたら断る（ブラウザは POST に Origin を付ける）
function fromOtherSite(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).host !== new URL(req.url).host;
  } catch {
    return true;
  }
}

// Vercel 上だけ回数を制限する。ルールがまだないときは通し、ログに残す（費用の上限は Gemini 側のクォータで守る）
async function rateLimited(req: Request): Promise<boolean> {
  if (!process.env.VERCEL) return false;
  try {
    const { rateLimited, error } = await checkRateLimit(RATE_LIMIT_ID, { request: req });
    if (error === 'not-found') console.warn(`[api/react] rate limit ルール ${RATE_LIMIT_ID} が Vercel の Firewall にありません`);
    return rateLimited;
  } catch (e) {
    console.error('[api/react] rate limit の確認に失敗', e);
    return false;
  }
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
