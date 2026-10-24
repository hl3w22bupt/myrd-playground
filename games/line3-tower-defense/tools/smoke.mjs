#!/usr/bin/env node
// tools/smoke.mjs — line3-tower-defense 浏览器冒烟（L3-SMOKE：打开→开始布防→放置→加速→重开 + 零 console 错误）
// 架构：静态服务 build/ + CDP chromium（wheat-squad tools/smoke.mjs 判例同构，零 npm 依赖）。
// 前置：node tools/build.mjs。
import { readFileSync, existsSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const BUILD = join(ROOT, 'build');
const say = (m) => console.log('[l3-smoke] ' + m);
const die = (m) => { console.error('[l3-smoke] DIE ' + m); process.exit(1); };

// 泄漏防护（wheat 判例）：exit 钩子回收 chrome 进程树 + /tmp profile
let proc = null;
let server = null;
let userDir = null;
process.on('exit', () => {
  if (proc && proc.exitCode === null) { try { proc.kill('SIGKILL'); } catch { /* 已退出 */ } }
  try { server?.close(); } catch { /* 已关 */ }
  if (userDir) { try { rmSync(userDir, { recursive: true, force: true }); } catch { /* 尽力 */ } }
});

if (!existsSync(join(BUILD, 'src', 'main.mjs'))) die('build/ 缺位——先 node tools/build.mjs');

const MIME = { '.html': 'text/html', '.mjs': 'text/javascript', '.json': 'application/json', '.js': 'text/javascript', '.svg': 'image/svg+xml' };
server = createServer((req, res) => {
  const url = (req.url || '/').split('?')[0];
  const p = join(BUILD, url === '/' ? 'index.html' : url.slice(1));
  if (!p.startsWith(BUILD) || !existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
  res.end(readFileSync(p));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
say(`静态服务 http://127.0.0.1:${port}/（build/ 载面）`);

const CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
];
const chromeBin = CANDIDATES.find((c) => existsSync(c));
if (!chromeBin) die('chrome 未找到（装 Chrome 或 Chromium）');
userDir = join('/tmp', `l3-smoke-${process.pid}`);
proc = execFile(chromeBin, [
  '--headless=new', '--no-first-run', '--no-default-browser-check',
  `--user-data-dir=${userDir}`, '--remote-debugging-port=0', 'about:blank',
], () => {});
await new Promise((r) => setTimeout(r, 1200));
let wsUrl = null;
const stderrChunks = [];
proc.stderr.on('data', (d) => stderrChunks.push(String(d)));
for (let i = 0; i < 20 && !wsUrl; i += 1) {
  await new Promise((r) => setTimeout(r, 250));
  const portFile = join(userDir, 'DevToolsActivePort');
  if (existsSync(portFile)) {
    const [p] = readFileSync(portFile, 'utf8').split('\n');
    wsUrl = `ws://127.0.0.1:${p}/devtools/browser`;
  } else {
    const m = /ws:\/\/[^\s]+/.exec(stderrChunks.join(''));
    if (m) wsUrl = m[0];
  }
}
if (!wsUrl) die('chrome DevTools 端口未就绪');
const httpPort = new URL(wsUrl).port;
let pageWs = null;
for (let i = 0; i < 20 && !pageWs; i += 1) {
  await new Promise((r) => setTimeout(r, 250));
  try {
    const list = await fetch(`http://127.0.0.1:${httpPort}/json/list`).then((r) => r.json());
    const page = list.find((t) => t.type === 'page');
    if (page?.webSocketDebuggerUrl) pageWs = page.webSocketDebuggerUrl;
  } catch { /* 重试 */ }
}
if (!pageWs) die('page target 未就绪');
say('chromium 就绪（CDP page target）');

const ws = new WebSocket(pageWs);
ws.addEventListener('error', (e) => { console.error('[l3-smoke] WS error:', String(e.message || e)); });
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let msgId = 0;
const pending = new Map();
const consoleErrors = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.consoleAPICalled' && m.params?.type === 'error') {
    consoleErrors.push(m.params.args?.map((a) => a.value || a.description || '').join(' '));
  }
  if (m.method === 'Runtime.exceptionThrown') {
    consoleErrors.push(m.params?.exceptionDetails?.exception?.description || 'exceptionThrown');
  }
};
const send = (method, params = {}) => new Promise((res) => {
  const id = ++msgId;
  pending.set(id, res);
  ws.send(JSON.stringify({ id, method, params }));
});
await send('Runtime.enable');
await send('Page.enable');
await send('Page.navigate', { url: `http://127.0.0.1:${port}/` });
await new Promise((r) => setTimeout(r, 2000));

const evalJs = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  return r.result?.result?.value;
};

// ① 可开：READY 置位 + 构建锚在位
let ready = false;
for (let i = 0; i < 40 && !ready; i += 1) { await new Promise((r) => setTimeout(r, 250)); ready = await evalJs('globalThis.__L3_READY === true'); }
if (!ready) die('READY 超时（boot 断链）\n' + consoleErrors.join('\n'));
say('ready ✓ __L3_READY=true');
const anchor = await evalJs('JSON.stringify(globalThis.__L3_BUILD__)');
if (!anchor) die('构建锚缺失（__L3_BUILD__）');
say(`构建锚 ✓ ${anchor}`);
const specLoaded = await evalJs('!!(globalThis.__L3_GAME && globalThis.__L3_GAME.cfg && globalThis.__L3_GAME.cfg.victoryWaves)');
if (!specLoaded) die('spec.json 装配失败（cfg 缺失）');
say('spec 装配 ✓（cfg.victoryWaves 可读）');

// ② 操作链：开始布防 → 放置（点选+确认）→ 加速 ×2 → 全速推进至结算 → 再来一局
// 坐标从 canvas rect 换算（letterbox 缩放面；wheat 判例：盲打坐标会落到 canvas 外）
const rectRaw = await evalJs(`(() => { const r = document.getElementById('stage').getBoundingClientRect(); return JSON.stringify({ x: r.x, y: r.y, w: r.width, h: r.height }); })()`);
const rect = JSON.parse(rectRaw || '{"x":0,"y":0,"w":640,"h":384}');
const scale = Math.min(rect.w / 640, rect.h / 384);
const offX = rect.x + (rect.w - 640 * scale) / 2, offY = rect.y + (rect.h - 384 * scale) / 2;
const at = (lx, ly) => ({ x: Math.round(offX + lx * scale), y: Math.round(offY + ly * scale) });
const click = async (lx, ly) => {
  const p = at(lx, ly);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1, pointerType: 'mouse' });
  await new Promise((r) => setTimeout(r, 60));
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1, pointerType: 'mouse' });
  await new Promise((r) => setTimeout(r, 120));
};

await click(320, 252); // 开始布防
let phase = await evalJs('globalThis.__L3_GAME.phase');
if (phase !== 'running') die(`开始布防失败（phase=${phase}）`);
say('开始布防 ✓（title→running）');
await click(496, 208); // 点选空格
await click(320, 344); // 放置菜单确认
const placed = await evalJs('globalThis.__L3_GAME.sim.turrets.length');
if (placed !== 1) die(`放置失败（turrets=${placed}）`);
say('首次放置 ✓（turrets=1，含二步菜单确认）');
const fp = await evalJs(`JSON.stringify(globalThis.__L3_GAME.entries().find(function(e){return e.name==='first_placement_at'}) || null)`);
say(`first_placement_at ✓ ${fp}`);
await click(588, 22);  // 加速 ×2
const speed = await evalJs('globalThis.__L3_GAME.sim.speed');
if (speed !== 2) die(`加速失败（speed=${speed}）`);
say('加速 ×2 ✓（path-speed-toggle-01）');

// ③ 战局推进至结算（加速态下真实渲染循环推进；8 波全程墙钟较长 → 上限 90s 监督）
let settled = false;
for (let i = 0; i < 300 && !settled; i += 1) {
  await new Promise((r) => setTimeout(r, 300));
  settled = (await evalJs('globalThis.__L3_GAME.phase')) === 'settled';
}
const status = await evalJs('globalThis.__L3_GAME.sim.status');
if (!settled) die('90s 内未到结算（推进断链）');
say(`战局到结算 ✓（status=${status}）`);
await click(320, 236); // 再来一局
const rc = await evalJs(`JSON.stringify(globalThis.__L3_GAME.entries().filter(function(e){return e.name==='restart_clicked'}))`);
if (!rc || rc === '[]') die('restart_clicked 未出账');
say(`再来一局 ✓ restart_clicked=${rc}`);

// ④ 零 console 错误
if (consoleErrors.length > 0) die(`console 错误 ${consoleErrors.length} 条:\n` + consoleErrors.join('\n'));
console.log(`L3-SMOKE: PASS 打开→开始→放置→加速→结算→重开 全链路 · 零 console 错误 · 锚=${anchor}`);
process.exit(0);
