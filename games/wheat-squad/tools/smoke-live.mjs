#!/usr/bin/env node
// tools/smoke-live.mjs — wheat-squad 线上冒烟（对已部署 LIVE 入口跑与 tools/smoke.mjs 同断言面：
// 打开→拖动操作→看到结算 + console 零错误）。零 npm 依赖，复用本地冒烟判例（CDP chromium）。
// 用法：node tools/smoke-live.mjs [liveUrl]（缺省 = blackboard 登记试玩入口）。
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFile } from 'node:child_process';

const LIVE = process.argv[2] || 'https://leomac-studio.tail49399e.ts.net/apps/wheat-squad-2/gw';
const say = (m) => console.log('[ws-live-smoke] ' + m);
const die = (m) => { console.error('[ws-live-smoke] DIE ' + m); process.exit(1); };
say('目标 ' + LIVE);

const CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
];
const chromeBin = CANDIDATES.find((c) => existsSync(c));
if (!chromeBin) die('chrome 未找到');
const userDir = join('/tmp', `ws-live-smoke-${Date.now()}`);
const proc = execFile(chromeBin, [
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
await send('Page.navigate', { url: LIVE });
await new Promise((r) => setTimeout(r, 3500));

const evalJs = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  return r.result?.result?.value;
};

// ① 可开：READY 置位（线上壳 boot-script 自愈跳转后加载 build/）
let ready = false;
for (let i = 0; i < 48 && !ready; i += 1) { await new Promise((r) => setTimeout(r, 250)); ready = await evalJs('globalThis.__G2WS_READY === true'); }
if (!ready) die('READY 超时（线上 boot 断链）\n' + consoleErrors.join('\n'));
say('ready ✓ __G2WS_READY=true（线上）');

// ② 操作：拖动 → 战局推进 + 击杀
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
if (!moved) die('线上战局未推进（tick 恒 0）\n' + consoleErrors.join('\n'));
if (kills0 < 0) die('线上 20+ 次拖动后仍零击杀\n' + consoleErrors.join('\n'));
say(`操作 ✓ tick 推进 + 击杀 ${kills0}（线上拖动→作战链通）`);

// ③ 结算：真实 stepSim 快进
const fastForward = await evalJs(`(async () => {
  const g = globalThis.__G2WS_GAME;
  let guard = 0;
  while (g.state.phase === 'running' && guard < 400000) {
    guard += 1;
    g.step(16);
    if (g.state.choices) globalThis.__G2WS_PICK(0);
  }
  return JSON.stringify({ phase: g.state.phase, reason: g.state.endedReason, elapsedSec: Math.floor((g.state.tick * g.state.cfg.stepMs) / 1000) });
})()`);
if (!fastForward) die('快进无返回');
const ff = JSON.parse(fastForward);
if (ff.phase !== 'ended') die(`快进后未结算: ${fastForward}`);
say(`结算 ✓ phase=${ff.phase} reason=${ff.reason} elapsed=${ff.elapsedSec}s`);

// ④ console 零错误
if (consoleErrors.length > 0) die(`console 错误 ${consoleErrors.length} 条:\n` + consoleErrors.slice(0, 5).join('\n'));
say('console/页面 零错误 ✓');

ws.close(); proc.kill();
console.log('WS-LIVE-SMOKE: PASS 线上打开→操作→结算 + console 零错误');
