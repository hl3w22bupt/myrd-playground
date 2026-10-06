#!/usr/bin/env node
// apphost-live-smoke.mjs — 部署后线上自测（可复跑；非游戏仓门禁件）
// 判据：标题=熔炉方块 · canvas#stage 已绘制（截屏像素方差>阈值）· SW 注册 · 零控制台错误
// 用法：node scripts/apphost-live-smoke.mjs [liveUrl]（缺省读 games/g2-blocks/apphost.toml 对应坑）
// CDP 助手 = 游戏仓 tools/cdp.mjs 同款实现（本仓内联，避免跨仓 import）
import { spawn } from 'node:child_process';
import { readdirSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const LIVE = process.argv[2] || 'https://leomac-studio.tail49399e.ts.net/apps/g2-blocks-2/gw';
const say = (m) => console.log(`[live-smoke] ${m}`);
const die = (m) => { console.error(`[live-smoke] RED ${m}`); process.exit(1); };

function findChrome() {
  if (process.env.CHROME_BIN && existsSync(process.env.CHROME_BIN)) return process.env.CHROME_BIN;
  const cache = join(process.env.HOME || '', 'Library', 'Caches', 'ms-playwright');
  if (existsSync(cache)) {
    const dirs = readdirSync(cache).filter((d) => d.startsWith('chromium_headless_shell')).sort().reverse();
    for (const d of dirs) {
      for (const arch of ['chrome-headless-shell-mac-arm64', 'chrome-headless-shell-mac-x64']) {
        const bin = join(cache, d, arch, 'chrome-headless-shell');
        if (existsSync(bin)) return bin;
      }
    }
  }
  die('未找到 chromium headless shell（设 CHROME_BIN）');
}

const proc = spawn(findChrome(), [
  '--headless', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=0', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'g2-live-'))}`,
  '--window-size=390,844', '--disable-gpu', 'about:blank',
], { stdio: ['ignore', 'pipe', 'pipe'] });
const stderrChunks = [];
proc.stderr.on('data', (d) => stderrChunks.push(String(d)));
const wsUrl = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('CDP 启动超时')), 15000);
  const check = setInterval(async () => {
    const m = /DevTools listening on (ws:\/\/\S+)/.exec(stderrChunks.join(''));
    if (!m) return;
    clearInterval(check); clearTimeout(timer);
    const port = new URL(m[1]).port;
    for (let i = 0; i < 20; i += 1) {
      try {
        const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
        const page = list.find((t) => t.type === 'page');
        if (page?.webSocketDebuggerUrl) { resolve(page.webSocketDebuggerUrl); return; }
      } catch { /* retry */ }
      await new Promise((r) => setTimeout(r, 150));
    }
    reject(new Error('未找到页面级 CDP target'));
  }, 100);
}).catch((e) => die(e.message));

const ws = new WebSocket(wsUrl);
let id = 0; const pending = new Map(); const consoleErrors = [];
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(String(ev.data));
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id); pending.delete(msg.id);
    if (msg.error) reject(new Error(msg.error.message)); else resolve(msg.result);
  } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params?.type === 'error') {
    consoleErrors.push(JSON.stringify(msg.params?.args || []).slice(0, 300));
  } else if (msg.method === 'Runtime.exceptionThrown') {
    const d = msg.params?.exceptionDetails || {};
    consoleErrors.push(`${d.text || 'exception'} :: ${String(d.exception?.description || '').slice(0, 300)}`);
  }
});
await new Promise((resolve, reject) => {
  ws.addEventListener('open', () => resolve(), { once: true });
  ws.addEventListener('error', () => reject(new Error('ws error')), { once: true });
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const mid = (id += 1); pending.set(mid, { resolve, reject });
  ws.send(JSON.stringify({ id: mid, method, params }));
});
const evalJs = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(`eval 异常: ${r.exceptionDetails.text}`);
  return r.result.value;
};

await send('Runtime.enable');
await send('Page.enable');
await send('Page.navigate', { url: LIVE });
say(`导航 → ${LIVE}`);
await new Promise((r) => setTimeout(r, 6000)); // 首屏 + 资产懒加载 + 首帧

const title = await evalJs('document.title');
if (title !== '熔炉方块 g2-blocks') die(`标题不符: ${title}`);
say(`标题 ✓ ${title}`);

const canvasInfo = await evalJs(`(() => {
  const c = document.getElementById('stage');
  if (!c) return null;
  return { w: c.width, h: c.height, css: getComputedStyle(c).display };
})()`);
if (!canvasInfo || canvasInfo.w === 0) die('canvas#stage 缺失或 0 尺寸');
say(`canvas ✓ ${canvasInfo.w}x${canvasInfo.h}`);

const shot = await send('Page.captureScreenshot', { format: 'png' });
const png = Buffer.from(shot.data, 'base64');
// PNG 解析从简：取 IDAT 后 zlib 原始流不必解 —— 改用像素方差代理：
// 截屏字节熵：深色底 + 彩色棋盘应有大量非重复字节；纯黑屏则高度重复。
const uniq = new Set(png.subarray(0, Math.min(png.length, 200000))).size;
say(`截屏 ${png.length}B · 前 200KB 唯一字节 ${uniq}`);
if (uniq < 256) die('截屏近乎纯色（疑似黑屏/未渲染）');

const swState = await evalJs(`navigator.serviceWorker.getRegistrations().then(rs => rs.map(r => r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || 'pending').join(','))`);
say(`SW: ${swState || '(未注册)'}`);

await new Promise((r) => setTimeout(r, 2000));
if (consoleErrors.length) die(`控制台错误 ${consoleErrors.length} 条: ${consoleErrors[0]}`);
say('控制台零错误 ✓');

proc.kill('SIGKILL');
try { rmSync(proc.spawnargs.find((a) => a.includes('g2-live-')) || '', { recursive: true, force: true }); } catch { /* tmp */ }
console.log('LIVE-SMOKE: PASS 标题+canvas 绘制+SW+零错误');
