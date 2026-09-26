// 画面だけで使う定義（アイコン・色・街の中の位置）。ゲームの数値は engine / data 側に置く
import { GAME, type Emotion, type FacId, type SpeakerId } from '@moshimo/engine';

// x, y は背景（1600×900）の中の位置
export const SPK: Record<SpeakerId, { ic: string; x: number; y: number; c: string }> = {
  cab: { ic: 'fa-clipboard-list', x: 612, y: 592, c: '#c7b8ff' },
  old: { ic: 'fa-person-cane', x: 268, y: 546, c: '#ffb3a7' },
  agr: { ic: 'fa-wheat-awn', x: 140, y: 660, c: '#9be3a4' },
  sme: { ic: 'fa-store', x: 660, y: 700, c: '#ffd98a' },
  mom: { ic: 'fa-baby-carriage', x: 820, y: 690, c: '#ffc2e0' },
  sala: { ic: 'fa-briefcase', x: 890, y: 598, c: '#a9d6ff' },
  big: { ic: 'fa-building', x: 1000, y: 462, c: '#b9bfd6' },
  uni: { ic: 'fa-helmet-safety', x: 1100, y: 690, c: '#ffcf9e' },
  young: { ic: 'fa-graduation-cap', x: 1324, y: 462, c: '#c9b8ff' },
  us: { ic: 'fa-flag-usa', x: 1470, y: 630, c: '#a9d6ff' },
  cn: { ic: 'fa-dragon', x: 1460, y: 760, c: '#ffb3a7' },
  world: { ic: 'fa-earth-asia', x: 1375, y: 705, c: '#9be3d0' },
  press: { ic: 'fa-microphone', x: 400, y: 690, c: '#e0e0e8' },
};
export const SPEAKER_IDS = Object.keys(SPK) as SpeakerId[];
export const role = (k: SpeakerId) => GAME.speakers[k].role;
export const ME = { ic: 'fa-user-tie', role: '総理大臣', c: '#ffc93c' };

export const EMO: Record<Emotion, [string, string]> = {
  喜: ['fa-face-laugh-beam', '#20a47d'],
  怒: ['fa-face-angry', '#d9493a'],
  哀: ['fa-face-sad-tear', '#5a8fd6'],
  焦: ['fa-face-grimace', '#e8a916'],
  疑: ['fa-face-meh', '#8c8aa6'],
  安: ['fa-face-smile', '#20a47d'],
};

// ログやカードに出す短い名前（労働組合は「労組」）
export const FN: Record<FacId, string> = {
  yM: '若年男性', yF: '若年女性', mM: '中年男性', mF: '中年女性', oM: '高齢男性', oF: '高齢女性',
  big: '大企業', sme: '中小企業', agr: '農林水産', uni: '労組', us: '米国', cn: '中国', as: '諸外国',
};

export const moodCol = (v: number) => (v < 25 ? '#ff6b57' : v < 40 ? '#ffc93c' : '#35cfa1');
export const moodIc = (v: number) => (v < 25 ? 'fa-face-angry' : v < 40 ? 'fa-face-meh' : v < 55 ? 'fa-face-smile' : 'fa-face-laugh-beam');

export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const store = {
  get<T>(k: string, d: T): T {
    try {
      const v = localStorage.getItem(k);
      return v == null ? d : (JSON.parse(v) as T);
    } catch {
      return d;
    }
  },
  set(k: string, v: unknown) {
    try {
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, JSON.stringify(v));
    } catch {}
  },
};
