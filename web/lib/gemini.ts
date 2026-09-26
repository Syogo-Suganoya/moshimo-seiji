// 公約に当たらない自由な表明への反応を Gemini に作らせる（サーバー側だけで使う）
// 反応の作り方（ルールと出力の形）はエンジンの freeform.ts にあり、スキル版と共有している
import 'server-only';
import { GoogleGenAI } from '@google/genai';
import {
  FREEFORM_RULES, FREEFORM_SCHEMA, freeformContext, sanitizeFreeform,
  type FacId, type Policy,
} from '@moshimo/engine';

export const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
export const hasKey = () => !!process.env.GEMINI_API_KEY;

const SYSTEM = `あなたは日本を舞台にした政治シミュレーションゲーム「もしも政治」の世論エンジンです。
これはフィクションのゲームです。プレイヤーは総理大臣として、政策を自分の言葉で表明します。
あなたは、その表明に対する街の人・団体・外国の反応を作ります。

${FREEFORM_RULES}`;

export interface ReactContext {
  text: string;
  v: Record<FacId, number>;
}

// 反応を作れなかったとき（政策でない、キーがない、失敗した）は null
export async function generateFreeform(ctx: ReactContext): Promise<Policy | null> {
  if (!hasKey()) return null;
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const res = await ai.models.generateContent({
    model: MODEL,
    contents: freeformContext({ v: ctx.v }, ctx.text),
    config: {
      systemInstruction: SYSTEM,
      responseMimeType: 'application/json',
      responseJsonSchema: FREEFORM_SCHEMA,
      temperature: 0.8,
      abortSignal: AbortSignal.timeout(15000),
    },
  });
  const out = JSON.parse(res.text ?? '{}');
  if (!out.isPolicy || !Array.isArray(out.reactions) || !out.reactions.length) return null;
  const policy = sanitizeFreeform(out);
  return policy.reactions.length ? policy : null;
}
