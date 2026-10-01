# 公開の手順

Web版は Vercel、スキル版は GitHub（Claude Code のプラグイン、claude.ai 用の zip）で配布する。

## Web版（Vercel）

### 1. プロジェクトを作る
1. Vercel で **Add New → Project** を選び、GitHub の `Syogo-Suganoya/moshimo-seiji` を取り込む。
2. 設定を次のようにする。
   - **Framework Preset**：Next.js
   - **Root Directory**：`web`
   - **Include files outside the root directory in the Build Step**：有効のまま（`engine/` と `data/` を読むため）
   - Install / Build Command は既定のまま。`web` で `npm install` すると、npm のワークスペースとしてリポジトリ全体の依存が入る。
   - Node.js のバージョンは `web/package.json` の `engines`（24.x）で決まる。
3. **Environment Variables** に次を入れる（Production と Preview）。

   | 名前 | 値 |
   |---|---|
   | `GEMINI_API_KEY` | Gemini の API キー（必須。ないとモックモードで動く） |
   | `GEMINI_MODEL` | 省略可。既定は `gemini-3.5-flash-lite` |
   | `RATE_LIMIT_ID` | 省略可。既定は `moshimo-react`（下の Firewall のルールと同じにする） |

4. **Deploy** を押す。以後は `main` に push するたびに本番へ、プルリクエストごとにプレビューへ公開される（Vercel の Git 連携による CD。GitHub Actions 側の設定はいらない）。本番は https://moshimo-seiji.vercel.app/ 。

### 2. 呼び出し回数を制限する（必須）
`/api/react` は Gemini を呼ぶので、制限がないと誰でもキーを使えてしまう。コードは `@vercel/firewall` の `checkRateLimit` で、Firewall のルールを確かめている（`web/app/api/react/route.ts`）。

1. プロジェクトの **Firewall** を開き、**Configure → + New Rule** を選ぶ。
2. 次のように設定する。
   - Name：`moshimo-react`
   - If：`@vercel/firewall`、Rate limit ID：`moshimo-react`
   - Rate Limit：たとえば **1分に10回**（1人が普通に遊ぶなら十分）
   - Then：Too Many Requests（429）
3. **Save Rule → Review Changes → Publish** で反映する。

ルールがないときは、制限をかけずに通し、Vercel のログに `rate limit ルール moshimo-react が Vercel の Firewall にありません` と出る。

- 制限を超えると、画面に「街の声が混み合っています」と出て、記者が聞き返すだけになる（政治資本は減らない）。
- ほかのサイトのページからの呼び出しは 403 で断る。

### 3. Gemini の費用に上限を付ける（必須）
Firewall の制限は IP ごとなので、多くの人が同時に遊ぶと呼び出しは増える。費用の上限は Gemini 側で守る。

- 無料枠の範囲で使うなら、請求先を設定していないプロジェクトのキーを使う（無料枠を超えると呼び出しが失敗するだけで、請求はされない）。
- 請求先を設定したプロジェクトのキーを使うなら、Google Cloud Console の **割り当て（Quotas）** で Generative Language API の1日あたりのリクエスト数に上限を付け、**予算とアラート** も設定する。

Gemini の呼び出しが失敗しても、ゲームは公約データのキーワード照合だけで続けられる。

### 4. 公開後に確かめること
- タイトル右上に「反応：Gemini」と出る。
- 公約に当たらない表明（例：「全国の公園に無料Wi-Fiを整備します」）で、街の人が反応する。
- 短い時間に何度も表明すると、「街の声が混み合っています」と出る。

## スキル版

### Claude Code（プラグイン）
このリポジトリがそのままプラグインのマーケットプレイスになっている（`.claude-plugin/marketplace.json`）。リポジトリを公開すれば、利用者は次の2行で入れられる。

```text
/plugin marketplace add Syogo-Suganoya/moshimo-seiji
/plugin install moshimo-seiji@moshimo-seiji
```

プラグインの中身は `skill/moshimo-seiji/`（`SKILL.md`、`.claude-plugin/plugin.json`、ビルド済みの `scripts/moshimo.mjs`）。`scripts/moshimo.mjs` はコミットしておく。CI が、ソースと一致しているかを確かめる。

### claude.ai（zip）
`v0.1.0` のようなタグを push すると、GitHub Actions（`.github/workflows/release.yml`）が `moshimo-seiji.zip` を作り、GitHub のリリースに置く。利用者はその zip を、claude.ai の設定にあるスキルの画面からアップロードする。

### リリースの手順
1. `skill/moshimo-seiji/.claude-plugin/plugin.json` の `version` を上げる（例：`0.2.0`）。Claude Code の利用者は、この番号が変わると更新を受け取る。
2. `./scripts/build_skill.sh` でコマンドを作り直し、変更と一緒にコミットして `main` に push する。
3. 同じ番号のタグを付けて push する。

   ```bash
   git tag v0.2.0
   git push origin v0.2.0
   ```

   タグと `plugin.json` の `version` が一致しないと、リリースのワークフローは止まる。
