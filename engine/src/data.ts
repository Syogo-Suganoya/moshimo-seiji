import gameJson from '../../data/game.json';
import partiesJson from '../../data/parties.json';
import policiesJson from '../../data/policies.json';
import type { DomesticId, Emotion, FacId, ForeignId, Fx, Party, Policy, PolicyData, QuestData, Reaction, SpeakerId, Verdict } from './types';

export const GAME = gameJson as unknown as {
  start: { year: number; quarter: number; firstElectionNo: number; cabinetNo: number };
  factions: {
    domestic: { id: DomesticId; name: string; weight: number; init: number; turnout: number }[];
    foreign: { id: ForeignId; name: string; init: number }[];
  };
  psy: {
    lossAversion: number;
    organized: Fx;
    fadeShare: number;
    framing: { pattern: string; mult: number }[];
    trust: { init: number; credBase: number; credDiv: number };
  };
  quarter: {
    drift: number;
    noise: number;
    extraDrift: Fx;
    bandwagon: { high: number; low: number; step: number };
    bill: { limit: number; fx: Fx; trust: number; news: string };
    coalition: { init: number; recoverBelow: number; recover: number; breakBelow: number; trust: number; news: string };
    capital: { init: number; max: number; gainHigh: number; gainLow: number; highAbove: number };
    questChance: number;
    resign: { below: number; turns: number };
  };
  declare: {
    coalitionShift: { ishin: number; ldp: number; other: number };
    repeatTrust: number;
    crisisTrust: number;
    promiseTrust: number;
    brokenCrisisTrust: number;
    brokenPromiseTrust: number;
    declineTrust: number;
    promiseBonus: number;
    urban: { min: number; max: number; cats: Record<string, number>; patterns: { pattern: string; shift: number }[] };
    retaliation: { pattern: string; quests: string[]; next: string; trust: number; reactions: Reaction[] };
  };
  interview: {
    maxAsk: number;
    maxQuestion: number;
    maxAnswer: number;
    maxReply: number;
    maxReact: number;
    verdicts: Record<Verdict, { fx: number; emo: Emotion }>;
    trust: { allGood: number; anyEvasive: number };
    skipped: string;
  };
  election: {
    seats: number; majority: number; termTurns: number; firstTermTurns: number;
    base: number; perPoint: number; noise: number; min: number; max: number; coalitionBrokenMult: number;
  };
  speakers: Record<SpeakerId, { role: string; fac: FacId[] }>;
  facToSpeaker: Record<FacId, SpeakerId>;
  emotions: Emotion[];
  mood: Partial<Record<SpeakerId, [string, string, string]>>;
  reactionTemplates: Partial<Record<SpeakerId, [Emotion, string][]>>;
  otherPolicies: (Omit<Policy, 'cat'> & { pattern: string })[];
  lines: {
    fallback: Reaction[];
    noCapital: Reaction;
    repeat: Reaction;
    costly: Reaction;
    coalitionUnhappy: Reaction;
    opposition: Reaction;
    promised: string;
    declined: string;
    crisisIgnored: string;
    promiseBroken: string;
  };
  quests: QuestData[];
  fillerNews: [string, string][];
  rivals: [string, number][];
};

export const PARTIES = partiesJson.parties as Party[];
export const PARTY: Record<string, Party> = Object.fromEntries(PARTIES.map((p) => [p.id, p]));
export const POLICY_DATA = policiesJson.policies as unknown as PolicyData[];

export const DOMESTIC = GAME.factions.domestic;
export const FOREIGN = GAME.factions.foreign;
export const FAC_IDS: FacId[] = [...DOMESTIC.map((f) => f.id), ...FOREIGN.map((f) => f.id)];
export const FAC_NAME: Record<FacId, string> = Object.fromEntries(
  [...DOMESTIC, ...FOREIGN].map((f) => [f.id, f.name]),
) as Record<FacId, string>;

// 公約データの fx から住民の反応セリフを組み立てる（自民党以外。自民党は個別のセリフあり）
export function genReactions(p: PolicyData): Reaction[] {
  const by: Partial<Record<SpeakerId, Fx>> = {};
  for (const [f, d] of Object.entries(p.fx ?? {}) as [FacId, number][]) {
    const k = GAME.facToSpeaker[f];
    if (!k) continue;
    (by[k] ??= {})[f] = d;
  }
  const rs = (Object.entries(by) as [SpeakerId, Fx][])
    .map(([k, fx]) => {
      const sum = Object.values(fx).reduce((a, b) => a + (b ?? 0), 0);
      const tpl = GAME.reactionTemplates[k]!;
      const [emo, t] = tpl[sum >= 5 ? 0 : sum > 0 ? 1 : sum <= -5 ? 2 : 3];
      return { r: { who: k, emo, text: t.replace('{t}', p.title), fx }, w: Math.abs(sum) };
    })
    .sort((a, b) => b.w - a.w)
    .slice(0, 4)
    .map((x) => x.r);
  if (p.cost >= 2) rs.push(GAME.lines.costly);
  return rs;
}

export interface CompiledPolicy extends Policy {
  party: string;
  cat: string;
  re: RegExp;
  // キーワードの正規表現を記号で切った語（具体性のスコアに使う）
  terms: string[];
}

export const POLICIES: CompiledPolicy[] = POLICY_DATA.map((p) => ({
  id: p.id,
  party: p.party,
  cat: p.cat,
  title: p.title,
  cost: p.cost,
  reactions: p.reactions ?? genReactions(p),
  re: new RegExp(p.keywords),
  terms: [...new Set(p.keywords.split(/[|()*.?+[\]]+/).filter(Boolean))],
}));

export const OTHER_POLICIES = GAME.otherPolicies.map((p) => ({ ...p, re: new RegExp(p.pattern) }));
export const QUESTS = GAME.quests.map((q) => ({ ...q, re: new RegExp(q.pattern) }));
export const QUEST: Record<string, (typeof QUESTS)[number]> = Object.fromEntries(QUESTS.map((q) => [q.id, q]));
