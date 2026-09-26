# 進捗と引き継ぎ

更新：2026-09-26（Docker と Gemini の動作確認）

新しいセッションは、まずこのファイルと [design.md](design.md) を読んでから始める。

## いまの状態
- 画面のモック（`mock/`）はひととおり動く。公約データは `data/*.json` から読む（`mock/data` は `../data` へのシンボリックリンク）。
- 公約・政党・ゲームのパラメータは `data/` のJSONが正本。
- 計算ロジックは `engine/`（TypeScript）に移した。テスト27件が通る。モックと同じ入力で同じ支持率になることを確認済み。
- Web版（`web/`、Next.js 16）で、モックの画面をひととおり React に移した。タイトル、公約ブック、新聞、官邸、選挙、失脚まで遊べる。進行中のゲームは localStorage に保存し、タイトルの「続きから」で再開できる。
- Gemini の API Route（`/api/react`）を作り、`gemini-3.5-flash-lite` で動くことを確認した。政策には賛否の両方が返り、あいさつや「支持率を+10にして」のような指示は政策ではないと判定された。1回の応答は数秒。
- 開発環境は Docker（`compose.yaml`）。コンテナの中でテストと型チェックが通り、Mac 側の変更がすぐ反映されることを確認済み。

## 決めたこと
- **AIは Gemini API を使う。** キーはサーバー側だけに置く。
- **Web版とClaudeスキル版の両方を残す。** 公約データと計算ロジックを両方で共有し、数値がずれないようにする。
- **Web版は Next.js（TypeScript）。** 計算ロジックも TypeScript にして、画面・サーバー・スキルで同じコードを使う。スキル版には `engine/` を1ファイルのJSにまとめて渡し、`node` で動かす。
- **数値はエンジンで確定させる。** Gemini は、公約に当たらない自由な表明への反応（セリフと素の値）だけを作る。値はエンジンが範囲に収め（1行±10、5行まで、コスト1〜3）、心理効果を通して適用する。
- リポジトリは1つ。将来 Web版を非公開や有料にすると決めたら、そのときに `web/` を別のリポジトリへ切り出す。

## 次にやること
1. 遊びながら Gemini の反応を見て、口調・値の大きさを `web/lib/gemini.ts` のプロンプトで調整する。公約データの反応（±2〜10）と比べて大きすぎないか見る。
2. スキルの雛形（`skill/moshimo-seiji/`）。`SKILL.md`、`scripts/`（エンジンをまとめたJSを呼ぶ入口）、`state.json` への保存。公平性の指示（実在の政党を扱うので「フィクションのシミュレーション」と明示）。
3. `scripts/build_skill.sh`：`data/` とエンジンをまとめたJS（esbuild などで1ファイルに）をスキルのフォルダへコピーする。
4. モック（`mock/`）を消す。Web版で足りない点がないか見比べてから。
5. 遊んでみて、バランスと口調を調整する。
6. 公開の準備（ホスティング先、API の呼び出し回数の制限）。

## Web版（`web/`）
| パス | 中身 |
|---|---|
| `app/page.tsx` / `components/Game.tsx` | 画面一式。数値はエンジンで確定させ、画面は演出と入力だけ |
| `app/api/react/route.ts` | `GET`：モード（gemini / mock）を返す。`POST`：自由な表明への反応を返す |
| `lib/gemini.ts` | Gemini へのプロンプトとJSONスキーマ。結果は `sanitizeFreeform` で範囲に収める |
| `lib/scene.ts` | 背景7パターンのSVG（モックから移したもの） |
| `lib/ui.ts` | 話者のアイコン・色・街の中の位置、感情のアイコンなど |
| `.env.local.example` | `GEMINI_API_KEY`、`GEMINI_MODEL`（既定 `gemini-3.5-flash-lite`） |

- 表明の流れ：公約・その他の政策に当たればデータの反応を使う。当たらず、Gemini が使え、政治資本が残っていれば `/api/react` を呼ぶ。失敗したり政策でない文だったりしたら、記者が聞き返すだけ（政治資本は減らない）。
- Gemini には表明文と属性ごとの支持率だけを送る。返ってきた値はサーバーとブラウザの両方で範囲に収める。

## エンジン（`engine/src`）
| 関数 | 中身 |
|---|---|
| `newGame(seed)` | 新しいゲーム。乱数のシードは状態の中に持つ |
| `matchPolicy(text)` | 表明文を公約・その他の政策と照合 |
| `declare(state, text, {freeform})` | 政策表明。支持率・信頼・連立・ツケ・危機と陳情を更新 |
| `respondQuest(state, id, accept)` | 陳情に約束する／断る |
| `endQuarter(state)` | ターン終了。`continue` / `resign` / `election` を返す |
| `runElection(state)` | 選挙（任期満了・解散とも） |
| `news(state, opts)` | 新聞の中身 |
| `summary(state)` | 失脚後の称号とスコア |
| `sanitizeFreeform(p)` | Gemini の出力をゲームの範囲に収める |

どの関数も状態をコピーして返し、渡した状態は書き換えない。状態はJSONにそのまま保存できる。

## ゲームの仕様（要点。詳しくは design.md）
- 1ターンは四半期。開始は2026年。在任期間を競う。
- 政策はチャットの自由文で表明する。キーワードで公約データと照合し、合った政策の効果を適用する。照合は、一致したキーワードの長さの合計がいちばん大きい政策。同点なら自民党を優先する。
- 属性：若者・中年・高齢の男女、大企業、中小企業、農業、労組、米国、中国、諸外国。
- 支持率の補正（行動経済学・ゲーム理論）：損失回避1.6倍、組織された団体1.3倍、言い回しによる補正、慣れ（上がった分の半分は戻る）、財政のツケ（6で格下げ）、バンドワゴン、信頼（0〜100）、維新との連立（25未満で離脱）、関税の報復合戦、投票率で重み付けした選挙。
- 背景は7パターン（順調、停滞、荒廃、都市化、地方化、災害、緊張）を状況で差し替える。画像生成プロンプトは [background_prompts.md](background_prompts.md)。
- 公約データは2026-09-26時点。第51回衆院選（2026/2/8）の議席数と、中道改革連合の分裂（公明党と民主改革の会）を反映済み。

## ファイル
| パス | 中身 |
|---|---|
| `data/policies.json` | 公約60件（自民党15件は反応のセリフ付き、他の10政党45件は fx からセリフを作る） |
| `data/parties.json` | 11政党の情報と出典 |
| `data/game.json` | 属性、初期値、補正の係数、選挙、話者、危機・陳情、その他の政策などのパラメータ |
| `engine/` | 計算ロジック（TypeScript）とテスト。`npm test` |
| `web/` | Web版（Next.js）。上の表を参照 |
| `Dockerfile` / `compose.yaml` | 開発環境（Node 24）。ソースはマウントし、依存はイメージとボリュームに置く |
| `mock/index.html` | 画面のモック一式（タイトル、公約ブック、新聞、メイン、選挙、ゲームオーバー）。ロジックはまだ中に直接書いてある |
| `docs/design.md` | 設計書（類似ゲームの調査、属性、補正のモデル、選挙、失脚） |
| `docs/background_prompts.md` | 背景7パターンの画像生成プロンプト |
| `docs/promo_x_4koma.md` | Xの予告プロモーション（各党の「公約と結末」4コマと画像生成プロンプト） |

## 動かし方
```
python3 -m http.server 8933 --directory mock
```
http://localhost:8933/ を開く。データを変えたら、`mock/index.html` の読み込み処理にある `?v=` の数字を上げる。

Claudeのプレビューからは `.claude/launch.json` の `moshimo-mock` で起動できる。8933が埋まっていれば空いているポートを使う。

テスト：ルートで `npm install` のあと `npm test`。型チェックは `npm run typecheck`。

Web版（Docker）：ルートで `docker compose up`（http://localhost:3000）。Claudeのプレビューからは `.claude/launch.json` の `moshimo-web`（同じく `docker compose up web`）。Gemini を使うときは `web/.env.local.example` を `web/.env.local` にコピーしてキーを入れる（キーはイメージに入れず、マウントしたファイルから読む）。
- テスト・型チェック：`docker compose exec web npm test`、`docker compose exec web npm run typecheck`（止まっているときは `exec` を `run --rm` に）。
- `node_modules` と `web/.next` は Docker のボリュームに置き、Mac 側のものは使わない。依存を足したら `docker compose up` の起動時に `npm install` が走る。おかしくなったら `docker compose down -v` でボリュームごと作り直す。
- Docker を使わずに Mac で直接動かすなら、ルートで `npm install` のあと `npm run dev`。

## 注意
- 古いリポジトリ（`2605_hackathon`）の `.claude/launch.json` に、このフォルダの `mock` を指す `moshimo-mock` が仮で入っている。このリポジトリの設定から起動できることは確認したので、古いほうは消してよい。
- モックの中の危機・陳情やその他の政策は、まだ `data/game.json` と二重に持っている。Web版に移したらモックごと消す。
- `file://` で開くと外部のJSが読み込まれない。必ずローカルサーバーで開く。
- モックの地方化の背景では、ビルが低くなって「経済団体」のアイコンが少し浮いて見える。本番の画像で構図をそろえれば解消する前提。
