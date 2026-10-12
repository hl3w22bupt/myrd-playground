#!/usr/bin/env node
// tools/smoke.mjs — wheat-squad 浏览器冒烟（spec loop-1：打开→拖动操作→看到结算 + console 零错误）
//
// 架构：静态服务 build/ + CDP chromium（g2-blocks tools/smoke.mjs 判例同构，零 npm 依赖）。
// 前置：node tools/build.mjs。
import { readFileSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const BUILD = join(ROOT, 'build');
const say = (m) => console.log('[ws-smoke] ' + m);
const die = (m) => { console.error('[ws-smoke] DIE ' + m); process.exit(1); };

if (!existsSync(join(BUILD, 'main.mjs'))) die('build/ 缺位——先 node tools/build.mjs');

const MIME = { '.html': 'text/html', '.mjs': 'text/javascript', '.json': 'application/json', '.js': 'text/javascript' };
const server = createServer((req, res) => {
  const url = (req.url || '/').split('?')[0];
  const p = join(BUILD, url === '/' ? 'index.html' : url.slice(1));
  if (!p.startsWith(BUILD) || !existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
  res.end(readFileSync(p));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
say(`静态服务 http://127.0.0.1:${port}/（build/ 载面）`);

// chromium 就绪（CDP 直连，复用系统 chrome；判例承 g2-blocks tools/cdp.mjs 的 find 逻辑）
const CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
];
const chromeBin = CANDIDATES.find((c) => existsSync(c));
if (!chromeBin) die('chrome 未找到（装 Chrome 或 Chromium）');
const userDir = join('/tmp', `ws-smoke-${Date.now()}`);
const proc = execFile(chromeBin, [
  '--headless=new', '--no-first-run', '--no-default-browser-check',
  `--user-data-dir=${userDir}`, '--remote-debugging-port=0', 'about:blank',
], () => {});
await new Promise((r) => setTimeout(r, 1200));
// 拿 wsUrl：读 stderr 或 DevToolsActivePort
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
// page target 定位（browser 端点无 Page 域）：/json/list 取首张 page 的 webSocketDebuggerUrl
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

// 最小 CDP 客户端（零依赖 WebSocket——node 26 内置 WebSocket）
const ws = new WebSocket(pageWs);
ws.addEventListener('error', (e) => { console.error('[ws-smoke] WS error:', String(e.message || e)); });
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
await new Promise((r) => setTimeout(r, 2500));

const evalJs = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  return r.result?.result?.value;
};

// ① 可开：READY 置位
let ready = false;
for (let i = 0; i < 40 && !ready; i += 1) { await new Promise((r) => setTimeout(r, 250)); ready = await evalJs('globalThis.__G2WS_READY === true'); }
if (!ready) die('READY 超时（boot 断链）\n' + consoleErrors.join('\n'));
say('ready ✓ __G2WS_READY=true');

// ② 操作：拖动（pointer 事件注入）→ 战局推进 + 击杀发生
const drag = async () => {
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 200, y: 400, button: 'left', clickCount: 1, pointerType: 'mouse' });
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 120, y: 300, button: 'left', pointerType: 'mouse' });
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 260, y: 480, button: 'left', pointerType: 'mouse' });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 260, y: 480, button: 'left', pointerType: 'mouse' });
};
let kills0 = -1, moved = false;
for (let i = 0; i < 24; i += 1) {
  await drag();
  await new Promise((r) => setTimeout(r, 500));
  const s = await evalJs('globalThis.__G2WS_STATE ? JSON.stringify(globalThis.__G2WS_STATE()) : null');
  if (!s) continue;
  const st = JSON.parse(s);
  if (st.tick > 0) moved = true;
  if (st.kills > 0) { kills0 = st.kills; break; }
}
if (!moved) die('战局未推进（tick 恒 0——输入链或循环断）\n' + consoleErrors.join('\n'));
if (kills0 < 0) die('20+ 次拖动后仍零击杀（作战链断）\n' + consoleErrors.join('\n'));
say(`操作 ✓ tick 推进 + 击杀 ${kills0}（拖动→作战链通）`);

// ③ 快进到结算：机读面直调重开循环太慢 → 用 __G2WS_GAME 快进（step 大步）不造假：仍走真实 stepSim
const fastForward = await evalJs(`(async () => {
  const g = globalThis.__G2WS_GAME;
  let guard = 0;
  while (g.state.phase === 'running' && guard < 400000) {
    guard += 1;
    g.step(16);
    if (g.state.choices) globalThis.__G2WS_PICK(0); // 真实选择路径（同源 pickUpgrade 面）
  }
  return JSON.stringify({ phase: g.state.phase, reason: g.state.endedReason, elapsedSec: Math.floor((g.state.tick * g.state.cfg.stepMs) / 1000) });
})()`);
// 上面的快进若 choices 悬停会卡住——改用重开+固定驱动已经由契约覆盖；smoke 的结算面用三选一点选路径：
if (!fastForward) die('快进无返回（页面执行断）');
const ff = JSON.parse(fastForward);
if (ff.phase !== 'ended') die(`快进后未结算: ${fastForward}`);
say(`结算 ✓ phase=${ff.phase} reason=${ff.reason} elapsed=${ff.elapsedSec}s`);

// ④ console 零错误
if (consoleErrors.length > 0) die(`console 错误 ${consoleErrors.length} 条:\n` + consoleErrors.slice(0, 5).join('\n'));
say('console/页面 零错误 ✓');

ws.close(); server.close(); proc.kill();
console.log('WS-SMOKE: PASS 打开→操作→结算 + console 零错误');
