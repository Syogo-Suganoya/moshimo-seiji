// Gemini を呼ぶ API ルートの共通の守り（ほかのサイトからの呼び出しと、回数の制限）
import 'server-only';
import { checkRateLimit } from '@vercel/firewall';

// Vercel の Firewall に作る rate limit ルールの ID
const RATE_LIMIT_ID = process.env.RATE_LIMIT_ID || 'moshimo-react';

// ほかのサイトのページから呼ばれたら断る（ブラウザは POST に Origin を付ける）。
// 比べる相手はブラウザが送った Host（Docker でポートを付け替えると req.url はコンテナ内のポートになるため）
export function fromOtherSite(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return false;
  try {
    const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? new URL(req.url).host;
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

// Vercel 上だけ回数を制限する。ルールがまだないときは通し、ログに残す（費用の上限は Gemini 側のクォータで守る）
export async function rateLimited(req: Request): Promise<boolean> {
  if (!process.env.VERCEL) return false;
  try {
    const { rateLimited, error } = await checkRateLimit(RATE_LIMIT_ID, { request: req });
    if (error === 'not-found') console.warn(`[api] rate limit ルール ${RATE_LIMIT_ID} が Vercel の Firewall にありません`);
    return rateLimited;
  } catch (e) {
    console.error('[api] rate limit の確認に失敗', e);
    return false;
  }
}
