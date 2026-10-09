// 公約に当たらない自由な表明への反応を Gemini に作らせる（サーバー側だけで使う）
// 反応の作り方（ルールと出力の形）はエンジンの freeform.ts にあり、スキル版と共有している
import 'server-only';
import { GoogleGenAI } from '@google/genai';
import {
  ASK_RULES, ASK_SCHEMA, askContext, FREEFORM_RULES, FREEFORM_SCHEMA, freeformContext, JUDGE_RULES, JUDGE_SCHEMA,
  judgeContext, sanitizeFreeform, sanitizeJudgements, sanitizeQuestions,
  type FacId, type InterviewJudgement, type InterviewQuestion, type Policy, type SpeakerId,
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
  const out = await generateJson(SYSTEM, freeformContext({ v: ctx.v }, ctx.text), FREEFORM_SCHEMA);
  if (!out.isPolicy || !Array.isArray(out.reactions) || !out.reactions.length) return null;
  const policy = sanitizeFreeform(out);
  return policy.reactions.length ? policy : null;
}

// JSON で答えさせる共通の呼び出し
async function generateJson(systemInstruction: string, contents: string, schema: object, temperature = 0.8) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const res = await ai.models.generateContent({
    model: MODEL,
    contents,
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      responseJsonSchema: schema,
      temperature,
      abortSignal: AbortSignal.timeout(15000),
    },
  });
  return JSON.parse(res.text ?? '{}');
}

// 深掘りモード：反応した国民の質問を作る
export async function generateAsk(text: string, lines: { who: SpeakerId; text: string }[], who: SpeakerId[]): Promise<InterviewQuestion[]> {
  if (!hasKey()) return [];
  const out = await generateJson(ASK_RULES, askContext(text, lines, who), ASK_SCHEMA);
  return sanitizeQuestions(out.questions, who);
}

// 深掘りモード：総理の答え方を判定する（判定は揺れないよう温度を下げる）
export async function generateJudge(text: string, qa: { who: SpeakerId; q: string; a: string }[]): Promise<InterviewJudgement[]> {
  if (!hasKey()) return [];
  const out = await generateJson(JUDGE_RULES, judgeContext(text, qa), JUDGE_SCHEMA, 0.3);
  return sanitizeJudgements(out.judgements, qa.map((x) => x.who));
}
