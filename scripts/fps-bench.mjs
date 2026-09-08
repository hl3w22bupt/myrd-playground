/**
 * scripts/fps-bench —— 本地帧率基准（60FPS 红线的可复测依据，docs/PERFORMANCE.md §五 的浏览器侧复核）。
 *
 * 用法：node scripts/fps-bench.mjs [--dist <dir>] [--gpu] [--window WxH] [--quality low|medium|high]
 *                                   [--sample-ms N] [--out f.json] [--query '?k=v']
 *                                   [--profile f.json] [--trace f.json --trace-ms N] [--probe] [--shot f.png]
 *   默认 SwiftShader（CPU 光栅）+ 1280x720；--gpu 走真 GPU（受 vsync 60 封顶）。
 *   --quality 设开始画面画质下拉；--probe 采样 renderer.info（依赖 app 的 ?probe=1 只读探针）；
 *   --shot 输出同 seed 落地截图（画面观感对比证据）。
 *
 * 协议：起静态服务 → headless Chrome + CDP → 点击「开始对局」（默认画质档，走产品内画质自适应）
 *      → 预热 3s → 独立 rAF 采样 N ms → 读取游戏内调试 HUD（FPS/1%低/p95/draw/画质）→ 输出 JSON。
 * 只读渲染表现，不注入任何游戏状态；同协议可在任意两次构建间做不回退对比。
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import os from 'node:os';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
let DIST = path.join(ROOT, 'dist');
const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];
let WIDTH = 1280;
let HEIGHT = 720;

const argv = process.argv.slice(2);
const argOf = (name, dflt) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : dflt;
};
const USE_GPU = argv.includes('--gpu');
const SAMPLE_MS = Number(argOf('--sample-ms', '12000'));
const WIN = argOf('--window', `${WIDTH}x${HEIGHT}`);
{
  const w = WIN.split('x');
  WIDTH = Number(w[0]) || WIDTH;
  HEIGHT = Number(w[1]) || HEIGHT;
}
const distArg = argOf('--dist', null);
if (distArg) DIST = path.resolve(distArg);
const OUT = argOf('--out', null);
const QUERY = argOf('--query', '');
const PROFILE_OUT = argOf('--profile', null);
const TRACE_OUT = argOf('--trace', null);
const TRACE_MS = Number(argOf('--trace-ms', '6000'));
const PROBE = argv.includes('--probe');
const QUALITY = argOf('--quality', null); // 设开始画面画质下拉（low|medium|high），不传用页面默认
const SHOT = argOf('--shot', null); // 截图输出路径（PNG，画面观感对比证据）
const CHROME = CHROME_CANDIDATES.find((p) => fs.existsSync(p));

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
};

function serve(port) {
  const server = http.createServer((req, res) => {
    const raw = (req.url ?? '/').split('?')[0];
    const rel = raw === '/' || raw === '' ? '/index.html' : raw;
    const file = path.join(DIST, rel);
    if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((ok) => server.listen(port, '127.0.0.1', () => ok(server)));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForFile(file, tries = 100) {
  for (let i = 0; i < tries; i++) {
    if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').split('\n')[0].trim();
    await sleep(100);
  }
  throw new Error('DevToolsActivePort 未出现（Chrome 启动失败？）');
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        this.pending.get(m.id)(m);
        this.pending.delete(m.id);
      }
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    const payload = JSON.stringify({ id, method, params });
    const flush = () => new Promise((ok, err) => {
      const t = setTimeout(() => err(new Error(`cdp timeout: ${method}`)), 60000);
      this.pending.set(id, (m) => {
        clearTimeout(t);
        if (m.error) err(new Error(JSON.stringify(m.error)));
        else ok(m.result);
      });
    });
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(payload);
      return flush();
    }
    return new Promise((ok) => {
      this.ws.addEventListener('open', () => {
        this.ws.send(payload);
        ok(flush());
      }, { once: true });
    }).then((r) => r);
  }

  async eval(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.text + JSON.stringify(r.exceptionDetails.exception?.description ?? ''));
    }
    return r.result.value;
  }
}

/** 独立 rAF 采样：与游戏内 PerfSampler 互为印证（帧数/均值/1%低/p95/中位） */
const RECORDER = `((ms) => new Promise((resolve) => {
  const deltas = [];
  let last = performance.now();
  const t0 = last;
  const tick = (t) => {
    deltas.push(t - last);
    last = t;
    if (t - t0 < ms) requestAnimationFrame(tick);
    else {
      const s = [...deltas].sort((a, b) => a - b);
      const sum = deltas.reduce((x, y) => x + y, 0);
      const p95 = s[Math.min(s.length - 1, Math.floor(s.length * 0.95))];
      const p99 = s[Math.min(s.length - 1, Math.floor(s.length * 0.99))];
      resolve({
        frames: deltas.length,
        avgFps: +(1000 / (sum / deltas.length)).toFixed(2),
        low1Fps: +(1000 / p99).toFixed(2),
        p95FrameMs: +p95.toFixed(2),
        medianFrameMs: +s[Math.floor(s.length / 2)].toFixed(2),
      });
    }
  };
  requestAnimationFrame(tick);
}))`;

async function main() {
  if (!CHROME) { console.error('[fps-bench] 未找到 Chrome，请安装或用 CHROME 环境变量指定'); process.exit(1); }
  if (!fs.existsSync(DIST) || !fs.existsSync(path.join(DIST, 'index.html'))) {
    console.error(`[fps-bench] 缺少构建产物 ${DIST}/index.html，请先 npm run build（或用 --dist 指定）`);
    process.exit(1);
  }
  const server = await serve(0);
  const port = server.address().port;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'fps-bench-'));
  const flags = USE_GPU ? [] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
  const chrome = spawn(CHROME, [
    '--headless=new', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars',
    `--window-size=${WIDTH},${HEIGHT}`, '--force-device-scale-factor=1', `--user-data-dir=${profile}`,
    '--remote-debugging-port=0', ...flags, 'about:blank',
  ], { stdio: 'ignore' });
  try {
    const debugPort = await waitForFile(path.join(profile, 'DevToolsActivePort'));
    const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
    const page = targets.find((t) => t.type === 'page');
    const cdp = new Cdp(new WebSocket(page.webSocketDebuggerUrl));
    if (TRACE_OUT) {
      const events = [];
      cdp.ws.addEventListener('message', (ev) => {
        const m = JSON.parse(ev.data);
        if (m.method === 'Tracing.dataCollected') events.push(...(m.params.value ?? []));
      });
      await cdp.send('Tracing.start', { traceConfig: { recordMode: 'recordAsMuchAsPossible', includedCategories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'gpu', 'toplevel'] } });
      cdp.traceStop = async () => {
        const done = new Promise((ok) => cdp.ws.addEventListener('message', function h(ev) { const m = JSON.parse(ev.data); if (m.method === 'Tracing.tracingComplete') { cdp.ws.removeEventListener('message', h); ok(); } }));
        await cdp.send('Tracing.end');
        await done;
        fs.writeFileSync(TRACE_OUT, JSON.stringify({ traceEvents: events }));
      };
    }
    await cdp.send('Runtime.enable');
    if (PROFILE_OUT) await cdp.send('Profiler.enable');
    await cdp.send('Page.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false });
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${port}/${QUERY}` });
    await sleep(2500);
    if (QUALITY) {
      await cdp.eval(`(() => { const s = document.querySelector('[data-ref="quality"]'); if (s) s.value = '${QUALITY}'; return s ? s.value : 'n/a'; })()`);
    }
    if (SHOT) {
      // 固定 seed 开始对局并等待落地（跳伞→地面），保证两次截图内容可比
      await cdp.eval(`(() => { const i = document.querySelector('[data-ref="seed"]'); if (i) i.value = '20260831'; return 1; })()`);
    }
    const started = await cdp.eval(`(() => { const b = document.querySelector('[data-ref="start"]'); if (!b) return 'no-start-button'; b.click(); return 'started'; })()`);
    if (started !== 'started') throw new Error('开始对局按钮未找到：' + started);
    if (PROBE) {
      const samples = [];
      for (let k = 0; k < 10; k++) {
        await sleep(1500);
        samples.push(await cdp.eval(`(() => { const v = window.__view; if (!v) return null; const i = v.renderer.info; return { programs: i.programs.length, calls: i.render.calls, tris: i.render.triangles, geoms: i.memory.geometries, textures: i.memory.textures, q: v.qualityLevel }; })()`));
      }
      const ratio = await cdp.eval(`(async () => {
        const v = window.__view; if (!v) return null;
        const r = v.renderer.info.render;
        let rafs = 0; const f0 = r.frame; const t0 = performance.now();
        await new Promise((res) => { const tick = () => { rafs++; if (performance.now() - t0 < 1500) requestAnimationFrame(tick); else res(); }; requestAnimationFrame(tick); });
        return { rafs, renders: r.frame - f0, calls: r.calls, tris: r.triangles };
      })()`);
      samples.push({ ratio });
      fs.writeFileSync('/tmp/probe-samples.json', JSON.stringify(samples, null, 1));
    }
    await sleep(3000); // 预热：纹理/着色器编译 + 画质自适应稳定
    if (PROFILE_OUT) await cdp.send('Profiler.start');
    if (TRACE_OUT && SAMPLE_MS > TRACE_MS) {
      setTimeout(() => cdp.traceStop(), TRACE_MS);
    }
    if (SHOT) {
      // 统一剧本：F 跳伞 → Shift 俯冲 → 落地后截图（两次截图内容可比）
      const key = (type, code) => cdp.eval(`window.dispatchEvent(new KeyboardEvent('${type}', { code: '${code}', bubbles: true })); 1`);
      await sleep(1200);
      await key('keydown', 'KeyF');
      await key('keyup', 'KeyF');
      await sleep(2500);
      await key('keydown', 'ShiftLeft');
      await sleep(4000);
      await key('keyup', 'ShiftLeft');
      // 轮询等待落地（状态横幅清空 = ground 态），上限 60s
      for (let k = 0; k < 60; k++) {
        const st = await cdp.eval(`document.querySelector('[data-ref="state"]')?.textContent?.trim() ?? ''`);
        if (st === '') break;
        await sleep(1000);
      }
      await sleep(1500);
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(SHOT, Buffer.from(shot.data, 'base64'));
    }
    const raf = await cdp.eval(`${RECORDER}(${SAMPLE_MS})`);
    if (TRACE_OUT && !cdp.traceStopped) { try { await cdp.traceStop(); } catch { /* 已停止 */ } }
    let cpuProfile = null;
    if (PROFILE_OUT) {
      const r = await cdp.send('Profiler.stop');
      cpuProfile = r.profile;
      fs.writeFileSync(PROFILE_OUT, JSON.stringify(cpuProfile));
    }
    const game = (await cdp.eval(`document.querySelector('.hud-debug')?.textContent ?? ''`)).trim();
    const visible = await cdp.eval(`({
      minimap: !!document.querySelector('.minimap'),
      hud: !!document.querySelector('.hud'),
      webgl: !!document.querySelector('#app canvas'),
      canvasW: (() => { const c = document.querySelector('#app canvas'); return c ? c.width : 0; })(),
      canvasH: (() => { const c = document.querySelector('#app canvas'); return c ? c.height : 0; })(),
      cssW: (() => { const c = document.querySelector('#app canvas'); return c ? c.clientWidth : 0; })(),
      dpr: window.devicePixelRatio,
      tris: (window.__view && window.__view.renderer) ? window.__view.renderer.info.render.triangles : 0,
      programs: (window.__view && window.__view.renderer) ? window.__view.renderer.info.programs.length : 0,
      textures: (window.__view && window.__view.renderer) ? window.__view.renderer.info.memory.textures : 0,
    })`);
    const result = {
      dist: path.relative(ROOT, DIST) || DIST,
      query: QUERY || '(none)',
      mode: USE_GPU ? 'gpu' : 'swiftshader',
      width: WIDTH,
      height: HEIGHT,
      sampleMs: SAMPLE_MS,
      raf,
      game,
      profileOut: PROFILE_OUT,
      visible,
    };
    console.log(JSON.stringify(result, null, 2));
    if (OUT) fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
  } finally {
    chrome.kill('SIGKILL');
    server.close();
    try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3 }); } catch { /* Chrome 退出中，忽略 */ }
  }
}

main().catch((e) => { console.error('[fps-bench] 失败：', e.message); process.exit(1); });
