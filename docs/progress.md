# 進捗と引き継ぎ

更新：2026-09-26（公開の準備）

新しいセッションは、まずこのファイルと [design.md](design.md) を読んでから始める。

## いまの状態
- 最初の画面モック（`mock/`）は Web版に移し終えたので削除した。Web版との違いは、陳情を片づけたときにカードがすべって消えるアニメーションがないことだけ。
- 公約・政党・ゲームのパラメータは `data/` のJSONが正本。
- 計算ロジックは `engine/`（TypeScript）に移した。テスト27件が通る。モックと同じ入力で同じ支持率になることを確認済み。
- Web版（`web/`、Next.js 16）で、モックの画面をひととおり React に移した。タイトル、公約ブック、新聞、官邸、選挙、失脚まで遊べる。進行中のゲームは localStorage に保存し、タイトルの「続きから」で再開できる。
- Gemini の API Route（`/api/react`）を作り、`gemini-3.5-flash-lite` で動くことを確認した。政策には賛否の両方が返り、あいさつや「支持率を+10にして」のような指示は政策ではないと判定された。1回の応答は数秒。
- 自動で出す発言は1人ずつ吹き出しに出し、吹き出しの中の「次へ」（最後は「OK」）かキーボード（Enter、入力欄の外ならスペース・→）で進める。発言中はターン終了・公約ブック・解散・陳情の返事を止める。
- スキル版の雛形を作った（`skill/`）。エンジンと `data/` を1ファイルのコマンド（`moshimo.mjs`）にまとめ、`SKILL.md` で Claude に進行役をさせる。公約に当たらない表明への反応は、Gemini の代わりに Claude が `guide` のルールで作る。コマンドのテスト13件が通る。ユーザーが Claude で遊んで、進め方は問題なしと確認済み（2026-09-26）。
- 公開の準備をした：ライセンスは MIT（`LICENSE`）。Web版は Vercel に置く（手順は `docs/deploy.md`）。`/api/react` に Vercel Firewall の回数制限（`@vercel/firewall`）と、ほかのサイトからの呼び出しを断る確認を入れた。スキル版は、このリポジトリを Claude Code のプラグインのマーケットプレイスにし（`.claude-plugin/marketplace.json`）、ビルド済みの `moshimo.mjs` をコミットする方針に変えた。claude.ai 用の zip は、タグを push すると GitHub Actions がリリースに置く。CI（テスト・型チェック・ビルド済みコマンドの一致）も入れた。
- `README.md`（遊び方・起動方法）と `CONTRIBUTING.md`（開発の決まりごと・公平性）を書いた。
- 開発環境は Docker（`compose.yaml`）。コンテナの中でテストと型チェックが通り、Mac 側の変更がすぐ反映されることを確認済み。

## 決めたこと
- **AIは Gemini API を使う。** キーはサーバー側だけに置く。
- **Web版とClaudeスキル版の両方を残す。** 公約データと計算ロジックを両方で共有し、数値がずれないようにする。
- **Web版は Next.js（TypeScript）。** 計算ロジックも TypeScript にして、画面・サーバー・スキルで同じコードを使う。スキル版には `engine/` を1ファイルのJSにまとめて渡し、`node` で動かす。
- **数値はエンジンで確定させる。** Gemini は、公約に当たらない自由な表明への反応（セリフと素の値）だけを作る。値はエンジンが範囲に収め（1行±10、5行まで、コスト1〜3）、心理効果を通して適用する。
- リポジトリは1つ。将来 Web版を非公開や有料にすると決めたら、そのときに `web/` を別のリポジトリへ切り出す。

## 次にやること
1. リポジトリを公開する。GitHub の Actions で CI が通るか確かめる。
2. Vercel にプロジェクトを作り、環境変数・Firewall の回数制限・Gemini の費用の上限を設定して公開する（`docs/deploy.md`）。
3. `v0.1.0` のタグを push して、claude.ai 用の zip がリリースに置かれるか確かめる。
4. 遊びながら Gemini の反応の口調・値の大きさと、ゲームのバランスを調整する。ルールは `engine/src/freeform.ts`（Web版とスキル版で共有）。
5. 陳情を片づけたときに、カードがすべって消えるアニメーション（モックにあったもの）を Web版に足すか決める。

## Web版（`web/`）
| パス | 中身 |
|---|---|
| `app/page.tsx` / `components/Game.tsx` | 画面一式。数値はエンジンで確定させ、画面は演出と入力だけ |
| `app/api/react/route.ts` | `GET`：モード（gemini / mock）を返す。`POST`：自由な表明への反応を返す |
| `lib/gemini.ts` | Gemini へのプロンプトとJSONスキーマ。結果は `sanitizeFreeform` で範囲に収める |
| `lib/scene.ts` | 背景7パターンの説明文と SVG（SVG はスキル版の view だけで使う） |
| `public/bg/*.webp` | 背景7パターンの絵（`docs/images/background` の画像を WebP にしたもの） |
| `lib/ui.ts` | 話者のアイコン・色・街の中の位置、感情のアイコンなど |
| `.env.local.example` | `GEMINI_API_KEY`、`GEMINI_MODEL`（既定 `gemini-3.5-flash-lite`） |

- 表明の流れ：公約・その他の政策に当たればデータの反応を使う。当たらず、Gemini が使え、政治資本が残っていれば `/api/react` を呼ぶ。失敗したり政策でない文だったりしたら、記者が聞き返すだけ（政治資本は減らない）。
- Gemini には表明文と属性ごとの支持率だけを送る。返ってきた値はサーバーとブラウザの両方で範囲に収める。

## スキル版（`skill/`）
| パス | 中身 |
|---|---|
| `moshimo-seiji/SKILL.md` | 進行役の手順・見せ方・話者の口調・守ること |
| `moshimo-seiji/scripts/moshimo.mjs` | ビルドで作るコマンド（プラグインが直接読むのでコミットする）。`new` `status` `match` `guide` `declare` `promise` `decline` `end` `dissolve` `policies` `view` |
| `src/cli.ts` | コマンドの本体。結果は JSON で返し、状態は `moshimo_state.json` に保存する |
| `src/view.ts` | 街と支持率の HTML（背景は `web/lib/scene.ts` を使う） |
| `test/cli.test.ts` | コマンドのテスト |

- ビルド：`docker compose exec web ./scripts/build_skill.sh`。`skill/moshimo-seiji/scripts/moshimo.mjs` と `dist/moshimo-seiji.zip`（claude.ai 用。プラグインの定義は除く）ができる。
- プラグイン：`skill/moshimo-seiji/.claude-plugin/plugin.json`。リポジトリのルートの `.claude-plugin/marketplace.json` がこれを指す。`claude plugin validate` と、一時的な HOME でのインストールまで確認済み。
- 計画では `data/` をスキルのフォルダへコピーする予定だったが、JSON はコマンドに埋め込んだので、コピーは要らなくなった。

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
- 背景は7パターン（順調、停滞、荒廃、都市化、地方化、災害、緊張）を状況で差し替える。Web版は画像生成した絵（`docs/images/background`）を使う。プロンプトは [background_prompts.md](background_prompts.md)。
- 公約データは2026-09-26時点。第51回衆院選（2026/2/8）の議席数と、中道改革連合の分裂（公明党と民主改革の会）を反映済み。

## ファイル
| パス | 中身 |
|---|---|
| `data/policies.json` | 公約60件（自民党15件は反応のセリフ付き、他の10政党45件は fx からセリフを作る） |
| `data/parties.json` | 11政党の情報と出典 |
| `data/game.json` | 属性、初期値、補正の係数、選挙、話者、危機・陳情、その他の政策などのパラメータ |
| `engine/` | 計算ロジック（TypeScript）とテスト。`freeform.ts` は自由な表明への反応の作り方（Web版とスキル版で共有） |
| `skill/` | スキル版。上の表を参照 |
| `scripts/build_skill.sh` | スキル版のビルドと zip 作成 |
| `.claude-plugin/marketplace.json` | Claude Code のプラグインのマーケットプレイス |
| `.github/workflows/` | CI（`ci.yml`）とリリース（`release.yml`） |
| `docs/deploy.md` | 公開の手順（Vercel、回数制限、Gemini の費用の上限、スキル版のリリース） |
| `LICENSE` | MIT |
| `docs/architecture/` | アーキテクチャ図。`architecture.py`（diagrams）から `architecture.png` を作る。`docker compose run --rm diagrams` |
| `web/` | Web版（Next.js）。上の表を参照 |
| `Dockerfile` / `compose.yaml` | 開発環境（Node 24）。ソースはマウントし、依存はイメージとボリュームに置く |
| `docs/design.md` | 設計書（類似ゲームの調査、属性、補正のモデル、選挙、失脚） |
| `docs/background_prompts.md` | 背景7パターンの画像生成プロンプト |
| `docs/promo_x_4koma.md` | Xの予告プロモーション（各党の「公約と結末」4コマと画像生成プロンプト） |

## 動かし方
Web版（Docker）：ルートで `docker compose up`（http://localhost:3000）。Claudeのプレビューからは `.claude/launch.json` の `moshimo-web`（同じく `docker compose up web`）。Gemini を使うときは `web/.env.local.example` を `web/.env.local` にコピーしてキーを入れる（キーはイメージに入れず、マウントしたファイルから読む）。
- テスト・型チェック：`docker compose exec web npm test`、`docker compose exec web npm run typecheck`（止まっているときは `exec` を `run --rm` に）。
- `node_modules` と `web/.next` は Docker のボリュームに置き、Mac 側のものは使わない。依存を足したら `docker compose up` の起動時に `npm install` が走る。おかしくなったら `docker compose down -v` でボリュームごと作り直す。
- Docker を使わずに Mac で直接動かすなら、ルートで `npm install` のあと `npm run dev`。

## 注意
- 古いリポジトリ（`2605_hackathon`）の `.claude/launch.json` に、このフォルダの `mock` を指す `moshimo-mock` が仮で入っている。モックは消したので、古いほうも消してよい。
- 背景を差し替えるときは `cwebp -q 80 docs/images/background/<名前>.jpeg -o web/public/bg/<名前>.webp`。話者のピンの位置（`web/lib/ui.ts` の `SPK`）は絵の建物に合わせてあるので、構図を変えたら見直す。
