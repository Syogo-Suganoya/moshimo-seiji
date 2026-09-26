# もしも政治

**あなたが総理なら、この国を何年もたせられる？**

日本の総理大臣になって、政策を自分の言葉で表明する政治シミュレーションゲームです。表明すると、街の人・業界団体・外国がその場で反応し、支持率が動きます。危機や陳情に応えながら、できるだけ長く政権を保つことを目指します。

> これはフィクションのシミュレーションです。公約データは実在の政党の公約の要旨をもとにしていますが、反応や支持率の変化はゲーム用の仮定で、実際の世論や政策の効果を示すものではありません。

## 特徴

- **自由文で政策を表明**：各党の公約データ（11政党・60件）とキーワードで照合し、当たった政策の反応を出します。どの公約にも当たらない表明には、Gemini が街の人の反応を作ります。
- **行動経済学・ゲーム理論にもとづく支持率**：損失回避、組織された団体の声の大きさ、言い回しの効果、慣れ、財政のツケ、バンドワゴン、約束と信頼、連立相手との関係、関税の報復合戦などを計算に入れています。
- **数値はエンジンで確定**：Gemini が作るのはセリフと「素の値」だけです。値の範囲を収め、支持率を計算するのはエンジン（TypeScript）です。
- **1ターンは四半期**：2026年Q4から始まり、支持率が2ターン続けて20%を切るか、選挙で過半数を割ると失脚です。

## はじめかた

必要なもの：Docker（Docker Desktop など）

```bash
git clone https://github.com/Syogo-Suganoya/moshimo-seiji.git
cd moshimo-seiji
docker compose up
```

http://localhost:3000 を開くと遊べます。

### Gemini を使う（任意）

キーがなくても、公約データのキーワード照合だけで遊べます（モックモード）。公約に当たらない自由な表明にも反応させたいときは、Gemini の API キーを設定します。

```bash
cp web/.env.local.example web/.env.local
```

`web/.env.local` の `GEMINI_API_KEY` にキーを入れ、`docker compose up` し直します。モデルは `GEMINI_MODEL` で変えられます（既定は `gemini-3.5-flash-lite`）。

キーはサーバー側（Next.js の API Route）だけで使い、ブラウザには渡しません。Docker のイメージにも入れません。

## Claude のスキルとして遊ぶ

Claude に進行役をしてもらう版もあります。数値はスキルに入っているコマンド（エンジンを1ファイルにまとめたもの）で計算し、公約に当たらない表明には Claude が反応を作ります。

```bash
docker compose run --rm web ./scripts/build_skill.sh
```

`dist/moshimo-seiji.zip` ができるので、claude.ai のスキルとしてアップロードします。Claude Code で使うときは、`skill/moshimo-seiji` フォルダをスキルのフォルダ（例：`~/.claude/skills/`）に置きます。そのあと「もしも政治で遊びたい」と話しかけてください。

## よく使うコマンド

| やりたいこと | コマンド |
|---|---|
| 起動 | `docker compose up` |
| テスト | `docker compose exec web npm test` |
| 型チェック | `docker compose exec web npm run typecheck` |
| スキル版のビルド | `docker compose exec web ./scripts/build_skill.sh` |
| 止める | `docker compose down` |
| 依存やキャッシュを作り直す | `docker compose down -v` のあと `docker compose up --build` |

Docker を使わない場合は、Node.js 24 以上でルートの `npm install` のあと `npm run dev` を実行します。

## 構成

```
moshimo-seiji/
  data/        公約・政党・ゲームのパラメータ（JSON）。正本はここだけ
  engine/      計算ロジック（TypeScript）とテスト
  web/         Web版（Next.js）。画面と、Gemini を呼ぶ API Route
  skill/       Claude スキル版。SKILL.md と、エンジンを1ファイルにまとめるビルド
  mock/        最初の画面モック（Web版に移し終えたら消す予定）
  docs/        設計書・進捗・画像生成プロンプトなど
```

- 公約データと計算ロジックは、Web版と Claude スキル版で共有します。
- 設計の詳しい説明は [docs/design.md](docs/design.md)、進み具合と次にやることは [docs/progress.md](docs/progress.md) にあります。

## 公約データについて

- 2026年9月26日時点の情報で整理しています。議席は第51回衆院選（2026年2月8日投開票）の結果です。
- 出典は `data/parties.json` と `data/policies.json` の `sources` にまとめています。
- タイトルと概要は各党の公約の要旨です。`fx`（属性ごとの支持率の変化）、`cost`、反応のセリフはゲーム用の仮定です。

## 開発に参加する

[CONTRIBUTING.md](CONTRIBUTING.md) を読んでください。
