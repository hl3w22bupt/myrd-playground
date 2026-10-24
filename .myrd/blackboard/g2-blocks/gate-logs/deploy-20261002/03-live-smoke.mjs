#!/usr/bin/env node
// live-smoke.mjs — 部署轮线上自测（CDP over 原生 WebSocket，零 npm 依赖）
// 目标 = AppHost liveUrl（壳形态 /apps/<slug>/gw，<base> 钉公开资产路由）
// 判据：可开 + __G2_READY + 64 格满员 + 真实 tap 一手得分 + SW 激活 + 控制台零错误
// 用法：node 03-live-smoke.mjs <liveUrl>
import { spawn } from 'node:child_process';
import { readdirSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = (process.argv[2] || '').replace(/\/+$/, '');
if (!BASE) { console.error('usage: live-smoke.mjs <liveUrl>'); process.exit(2); }
const URL_TO_OPEN = `${BASE}/gw`;
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
  return null;
}
const chrome = findChrome();
if (!chrome) die('未找到 chrome-headless-shell（冒烟器同款缓存探测为空）');

const tmp = mkdtempSync(join(tmpdir(), 'g2-live-smoke-'));
const proc = spawn(chrome, ['--headless', '--no-sandbox', '--disable-gpu', '--remote-debugging-port=0',
  `--user-data-dir=${tmp}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
// 端口未知 → 从 stderr 抓取（headless shell 打印 DevTools listening on ws://127.0.0.1:PORT/…）
const browserWs = await new Promise((resolve, reject) => {
  let buf = '';
  proc.stderr?.on('data', (d) => { buf += String(d); });
  const t0 = Date.now();
  const t = setInterval(() => {
    const hit = buf.match(/ws:\/\/127\.0\.0\.1:(\d+)\//);
    if (hit) { clearInterval(t); resolve(hit[1]); }
    else if (Date.now() - t0 > 15000) { clearInterval(t); reject(new Error('未捕获 DevTools 端口')); }
  }, 100);
});
// 页面级 target（支持 Page 域）：/json/list
const wsUrl = await new Promise((resolve, reject) => {
  const t0 = Date.now();
  const tick = async () => {
    try {
      const list = await (await fetch(`http://127.0.0.1:${browserWs}/json/list`)).json();
      const page = list.find((x) => x.type === 'page');
      if (page?.webSocketDebuggerUrl) { resolve(page.webSocketDebuggerUrl); return; }
    } catch { /* retry */ }
    if (Date.now() - t0 > 15000) { reject(new Error('未找到页面级 CDP target')); return; }
    setTimeout(tick, 150);
  };
  tick();
});

class Cdp {
  constructor(u) { this.ws = new WebSocket(u); this.id = 0; this.pending = new Map(); this.errors = [];
    this.ws.addEventListener('message', (ev) => { const msg = JSON.parse(String(ev.data));
      if (msg.id && this.pending.has(msg.id)) { const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id); msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result); }
      else if (msg.method === 'Runtime.consoleAPICalled' && msg.params?.type === 'error')
        this.errors.push(JSON.stringify(msg.params?.args || []).slice(0, 300));
      else if (msg.method === 'Runtime.exceptionThrown') { const d = msg.params?.exceptionDetails || {};
        this.errors.push(`${d.text || 'exception'} :: ${String(d.exception?.description || '').slice(0, 300)}`); } }); }
  open() { return new Promise((res, rej) => { this.ws.addEventListener('open', () => res(), { once: true });
    this.ws.addEventListener('error', () => rej(new Error('ws error')), { once: true }); }); }
  send(method, params = {}) { const id = (this.id += 1);
    return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params })); }); }
  async eval(expr) { const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(`eval 异常: ${r.exceptionDetails.text}`);
    return r.result.value; }
}

const cdp = new Cdp(wsUrl);
await cdp.open();
await cdp.send('Page.enable');
await cdp.send('Runtime.enable');
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
say(`打开 ${URL_TO_OPEN}`);
await cdp.send('Page.navigate', { url: URL_TO_OPEN });
await cdp.eval('new Promise((r) => { const t = setInterval(() => { if (window.__G2_READY === true) { clearInterval(t); r(true); } }, 50); })');
say('浏览器可开：__G2_READY=true');
const loc = await cdp.eval('location.pathname');
say(`location.pathname = ${loc}`);
const st = await cdp.eval('window.__G2_STATE()');
if (st.boardLen !== 64) die(`盘面 ${st.boardLen} ≠ 64`);
say(`盘面 ${st.boardLen} 格满员（score=${st.score} status=${st.status}）`);

const move = await cdp.eval('window.__G2_FIND_MOVE_ANY()');
if (!move) die('找不到可行手');
const before = await cdp.eval('window.__G2_STATE()');
await cdp.eval(`window.__G2_TAP(${move[0]})`);
await cdp.eval(`window.__G2_TAP(${move[1]})`);
await cdp.eval('new Promise((r) => setTimeout(r, 900))');
const after = await cdp.eval('window.__G2_STATE()');
if (!(after.score > before.score)) die(`交换后未得分（${before.score} → ${after.score}）`);
say(`核心循环可玩：score ${before.score} → ${after.score}（chain ${after.chain}）`);

const sw = await cdp.eval(`new Promise((r) => { try { navigator.serviceWorker.getRegistrations().then((rs) => r({ n: rs.length, scopes: rs.map((x) => x.scope) })); } catch (e) { r({ n: -1, err: String(e) }); } })`);
say(`SW registrations = ${JSON.stringify(sw)}`);

await cdp.eval('window.__G2_RESTART()');
await cdp.eval('new Promise((r) => setTimeout(r, 250))');
const st3 = await cdp.eval('window.__G2_STATE()');
if (st3.score !== 0 || st3.status !== 'playing') die(`重开未复位: ${JSON.stringify(st3)}`);
say(`重开全复位 ✓（score=${st3.score} status=${st3.status}）`);

if (cdp.errors.length) die(`控制台错误 ${cdp.errors.length} 条: ${cdp.errors[0]}`);
say('控制台零错误 ✓');
say(`LIVE-SMOKE: PASS ${BASE}/gw`);
rmSync(tmp, { recursive: true, force: true });
proc.kill('SIGKILL');
process.exit(0);
