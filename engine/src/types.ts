// 勢力（支持率を持つ属性）。国内10＋外国3
export type DomesticId = 'yM' | 'yF' | 'mM' | 'mF' | 'oM' | 'oF' | 'big' | 'sme' | 'agr' | 'uni';
export type ForeignId = 'us' | 'cn' | 'as';
export type FacId = DomesticId | ForeignId;

// 話者（街の人・外国・官邸）
export type SpeakerId =
  | 'cab' | 'old' | 'agr' | 'sme' | 'mom' | 'sala' | 'big' | 'uni' | 'young' | 'us' | 'cn' | 'world' | 'press';
export type Emotion = '喜' | '怒' | '哀' | '焦' | '疑' | '安';
export type SceneKind = 'good' | 'stall' | 'ruin' | 'urban' | 'rural' | 'disaster' | 'tension';

export type Fx = Partial<Record<FacId, number>>;

export interface Reaction {
  who: SpeakerId;
  emo: Emotion;
  text: string;
  fx: Fx;
}

export interface Party {
  id: string;
  name: string;
  short: string;
  color: string;
  seats: number;
  bloc: 'ruling' | 'opp';
  source: string;
  note?: string;
}

// 公約データ（data/policies.json）。reactions がなければ fx からセリフを作る
export interface PolicyData {
  id: string;
  party: string;
  cat: string;
  icon: string;
  source?: string;
  title: string;
  summary: string;
  keywords: string;
  cost: number;
  reactions?: Reaction[];
  fx?: Fx;
}

// エンジンの中で使う政策（公約・その他の政策・Geminiが作った自由な政策をまとめた形）
export interface Policy {
  id: string;
  party?: string;
  cat?: string;
  title: string;
  cost: number;
  reactions: Reaction[];
  setsTaxUp?: boolean;
}

export interface QuestData {
  id: string;
  kind: 'crisis' | 'demand';
  scene?: SceneKind;
  icon: string;
  title: string;
  who: SpeakerId;
  ttl: number;
  hidden?: boolean;
  say: string;
  desc: string;
  pattern: string;
  thanks: string;
  ok: Fx;
  ng: Fx;
}

export interface ActiveQuest {
  id: string;
  left: number;
  promised: boolean;
  // このターンに出たばかり（新聞と官邸での紹介に使う）
  fresh: boolean;
}

export interface GameState {
  version: 1;
  rng: number;
  turn: number;
  v: Record<FacId, number>;
  // 政治資本（1ターンに打てる政策の量）
  capital: number;
  // 任期満了の選挙までの残りターン
  elec: number;
  elecNo: number;
  // 支持率20%未満が続いたターン数
  low: number;
  trust: number;
  coal: number;
  coalBroken: boolean;
  // 財政のツケ（重い政策のコストが積み上がる）
  bill: number;
  // 慣れで抜けていく一時的な上げ幅
  fade: Fx;
  urban: number;
  forceQuest: string | null;
  events: string[];
  lastNews: string | null;
  quests: ActiveQuest[];
  seen: string[];
  used: string[];
  taxUp: boolean;
  maxAppr: number;
  prevAppr: number | null;
  // 前のターンで期限切れになった危機・陳情（次のターンの冒頭で文句を言う）
  expired: { id: string; fx: Fx }[];
  over: null | 'resign' | 'election';
}

export interface Line {
  who: SpeakerId;
  emo: Emotion;
  text: string;
  // 実際に動いた値（心理効果を通したあと）
  fx: Fx;
}

export interface DeclareResult {
  lines: Line[];
  // 信頼の増減や公約の一致など、システムからのお知らせ
  notes: string[];
  policy: { id: string; title: string; supporters: string[] } | null;
  // 政治資本が足りず、何も起きなかった
  rejected: boolean;
}
