// README 用のスクショを撮る（Mac の Google Chrome を DevTools プロトコルで動かす。依存なし、Node 22 以上）
//   node scripts/readme_shots.mjs http://localhost:3000
// → docs/images/readme/*.png
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const URL_ = process.argv[2] ?? 'http://localhost:3000';
const OUT = fileURLToPath(new URL('../docs/images/readme/', import.meta.url));
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333;
const W = 1280, H = 800;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

mkdirSync(OUT, { recursive: true });
const profile = mkdtempSync(join(tmpdir(), 'moshimo-shots-'));
const chrome = spawn(CHROME, ['--headless=new', '--hide-scrollbars', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });

try {
  // Chrome の起動を待って、ページにつなぐ
  let page;
  for (let i = 0; i < 40 && !page; i++) {
    await sleep(250);
    page = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json()).then((l) => l.find((t) => t.type === 'page')).catch(() => null);
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });
  const cdp = (method, params = {}) => new Promise((r) => { pending.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
  const js = async (expr) => (await cdp('Runtime.evaluate', { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true })).result?.result?.value;
  // sel を渡すと、その要素（はみ出した吹き出しなどの子要素も含む）のまわり pad px だけを切り抜く
  const shot = async (name, sel, pad = 0) => {
    await sleep(600);
    // 開発サーバーの Next.js の表示（左下の N）は写さない
    await js(`document.querySelectorAll('nextjs-portal').forEach((e) => e.remove());`);
    const clip = sel && (await js(`
      const el = document.querySelector(${JSON.stringify(sel)});
      const rs = [el, ...el.querySelectorAll('*')].map((e) => e.getBoundingClientRect()).filter((r) => r.width && r.height);
      const x = Math.max(0, Math.min(...rs.map((r) => r.left)) - ${pad}), y = Math.max(0, Math.min(...rs.map((r) => r.top)) - ${pad});
      const x2 = Math.min(innerWidth, Math.max(...rs.map((r) => r.right)) + ${pad}), y2 = Math.min(innerHeight, Math.max(...rs.map((r) => r.bottom)) + ${pad});
      return { x, y, width: x2 - x, height: y2 - y, scale: 1 };`));
    const { result } = await cdp('Page.captureScreenshot', { format: 'png', ...(clip && { clip }) });
    writeFileSync(join(OUT, name), Buffer.from(result.data, 'base64'));
    console.log(join(OUT, name));
  };
  // 文字を含むボタンを押す（見つかれば true）
  const click = (text) => js(`const b = [...document.querySelectorAll('button')].find((b) => b.textContent.includes(${JSON.stringify(text)}) && !b.disabled); b?.click(); return !!b;`);
  const waitFor = async (text, ms = 30000) => {
    for (let t = 0; t < ms; t += 500) {
      if (await js(`return document.body.innerText.includes(${JSON.stringify(text)});`)) return;
      await sleep(500);
    }
    throw new Error(`「${text}」が出ない`);
  };
  // 自動で出る吹き出しやお知らせを、なくなるまで進める
  const advance = async () => {
    for (let i = 0; i < 20; i++) {
      const done = await js(`const b = document.querySelector('.bub-next') || [...document.querySelectorAll('.modal button')].find((b) => /OK|閉じる/.test(b.textContent)); b?.click(); return !b;`);
      if (done) return;
      await sleep(900);
    }
  };

  await cdp('Page.enable');
  await cdp('Runtime.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await cdp('Page.navigate', { url: URL_ });
  await waitFor('組閣する');
  await js(`localStorage.clear(); location.reload();`);
  await sleep(1500);
  await waitFor('組閣する');
  await sleep(1500);
  await shot('01_title.png');

  // 就任の新聞 → 官邸
  await click('組閣する');
  await sleep(2500);
  await shot('02_news.png');
  for (let i = 0; i < 5 && (await click('官邸へ')); i++) await sleep(1500);
  await sleep(2500);
  await advance();
  await sleep(800);
  await shot('03_town.png');

  // 政策を表明して、街の人の反応を見る
  await js(`const t = document.querySelector('textarea'); const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; set.call(t, '全国民に一人2万円を給付します'); t.dispatchEvent(new Event('input', { bubbles: true }));`);
  await shot('04_declare.png', '.dock', 16);
  await click('表明');
  await sleep(2500);
  // 反応の順番は毎回変わるので、年金暮らしの番まで進める
  for (let i = 0; i < 8; i++) {
    if (await js(`return document.querySelector('.mk.talk')?.innerText.includes('年金暮らし');`)) break;
    await js(`document.querySelector('.bub-next')?.click();`);
    await sleep(1200);
  }
  await shot('05_reaction.png', '.mk.talk', 24);
  await advance();

  // 公約ブック
  await click('政策');
  await sleep(1200);
  await shot('06_book.png');
  await click('官邸に戻る');
  await sleep(1500);

  // 解散総選挙の結果
  await click('解散');
  await sleep(800);
  await click('解散！');
  await waitFor('過半数');
  await sleep(6000); // 議席が埋まり、結果の帯が出るまで待つ
  await shot('07_election.png');
} finally {
  chrome.kill();
  await sleep(300);
  rmSync(profile, { recursive: true, force: true });
}
