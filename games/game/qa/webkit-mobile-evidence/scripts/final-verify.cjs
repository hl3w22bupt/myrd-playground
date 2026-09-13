/* 终验②④：线上落地页 真 WebKit 行为取证。
 * ② 真 WebKit 构建 + iPhone UA + maxTouchPoints，加载后「真实触摸」触发
 *    window.__audioDebug().state === 'running'；
 *    因果链补充相位：同一解锁器在本地静态导出页 suspended →（真实触摸）→ running 实录。
 * ④ 进入对局后截取 HUD 中文（标题/分数/剩余步数）3x 截图，供 final-tofu-check.py 机械判定缺字方块。
 * 输出：final-verify.json / final3x_hud-chinese.png / final-page-source-live.html
 *
 * 环境备注（如实披露）：
 * - Playwright WebKit 1.58（webkit-2359）已知 quirk：context hasTouch:true 不会映射到
 *   navigator.maxTouchPoints（恒 0，platform 仍 MacIntel）。本脚本用 addInitScript 按
 *   iPhone 13 描述符把 maxTouchPoints 补齐为 5——仅恢复「页面可见的设备仿真相位」，
 *   触摸输入仍是真实 touchscreen.tap 管线（DOM capture 计数器可验证事件到达）。
 * - 自动化 WebKit 不强制自动播放手势策略：线上页 AudioContext 可能在加载期即 running。
 *   故因果链（suspended → 真实触摸 → running）以静态导出页相位实证（解锁器同源，
 *   由 87b7398 内嵌进 export/web/index.html）。 */
const { webkit, devices } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');

const LIVE_URL = process.env.LIVE_URL || 'https://leomac-studio.tail49399e.ts.net/apps/game/';
const STATIC_ROOT = process.env.STATIC_ROOT
  || require('path').resolve(__dirname, '..', '..', '..', 'export', 'web');
const STATIC_URL = 'http://127.0.0.1:8123/index.html';
const OUT = __dirname + '/..';
const MARKERS = ['__audioDebug', 'unlockAudio', 'WrappedAudioContext', 'touchstart', 'pointerdown',
  'webkitAudioContext', 'statechange', 'visibilitychange', 'audioAddModules'];

const MTP_SHIM = `Object.defineProperty(Navigator.prototype, 'maxTouchPoints', {
  get: () => 5, configurable: true }); // iPhone 13 描述符补齐（WebKit-Playwright quirk 披露）`;

function serveStatic(root, port) {
  return new Promise((resolve, reject) => {
    const srv = http.createServer((req, res) => {
      const p = require('path').join(root, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
      fs.readFile(p, (err, data) => {
        if (err) { res.writeHead(404); res.end('nf'); return; }
        const type = p.endsWith('.html') ? 'text/html' : p.endsWith('.js') ? 'text/javascript'
          : p.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': type });
        res.end(data);
      });
    });
    srv.on('error', reject);
    srv.listen(port, '127.0.0.1', () => resolve(srv));
  });
}

async function readAudio(page) {
  return page.evaluate(() => (window.__audioDebug ? window.__audioDebug() : { absent: true }));
}

async function touchPhase(browser, url, label, R, { tapToStart }) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 3 });
  await ctx.addInitScript(MTP_SHIM);
  const page = await ctx.newPage();
  const P = { label, url };
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

  P.env = await page.evaluate(() => ({
    ua: navigator.userAgent, maxTouchPoints: navigator.maxTouchPoints,
    hasTouchstart: 'ontouchstart' in window, platform: navigator.platform,
  }));
  P.env.engine = /AppleWebKit/.test(P.env.ua) && !/Chrome/.test(P.env.ua) ? 'WebKit' : 'NOT-WEBKIT';
  P.env.isIPhoneUA = /iPhone/.test(P.env.ua);
  P.env.pass = P.env.engine === 'WebKit' && P.env.isIPhoneUA && P.env.maxTouchPoints >= 1 && P.env.hasTouchstart;

  // AudioContext 诞生首态采样：60ms 高频轮询，捕获 'no-ctx' 之后的第一态
  //（v5 实证：创建初期为 suspended，若等引擎启动完成再采样会被自动恢复错过）
  P.firstAudio = null;
  const poll = (async () => {
    for (let i = 0; i < 2000; i++) {
      const a = await readAudio(page);
      if (a && !a.absent && a.state !== 'no-ctx' && a.state !== undefined) { P.firstAudio = a; return; }
      await page.waitForTimeout(60);
    }
  })();

  if (tapToStart) {
    // 等引擎启动完成（遮罩隐藏）；期间不做任何截图（构建怪癖：tap 前截图破坏触摸管线）
    await page.waitForFunction(() => {
      const b = document.getElementById('boot');
      return b && b.classList.contains('hidden');
    }, null, { timeout: 120000 });
    await page.waitForTimeout(800);
  } else {
    await page.waitForTimeout(1200); // 静态页：等壳初始化 + 首态采样落定
  }
  await Promise.race([poll, page.waitForTimeout(5000)]);
  P.beforeTap = P.firstAudio || (await readAudio(page));

  const t0 = Date.now();
  await page.touchscreen.tap(195, 370); // 「开始游戏 START」中心（触摸管线）
  let after = null;
  while (Date.now() - t0 < 15000) {
    await page.waitForTimeout(250);
    after = await readAudio(page);
    if (after && after.state === 'running') break;
  }
  P.afterTap = after;
  P.latencyMs = Date.now() - t0;
  P.running = !!(after && after.state === 'running');
  P.causal = P.running && P.beforeTap && P.beforeTap.state === 'suspended';
  R.phases.push(P);
  console.log(`[final] ${label}: first=${JSON.stringify(P.beforeTap)} after=${JSON.stringify(P.afterTap)} running=${P.running} causal=${P.causal}`);
  P.page = page;
  return P;
}

(async () => {
  const R = { liveUrl: LIVE_URL, staticUrl: STATIC_URL, phases: [] };
  const browser = await webkit.launch({ executablePath: process.env.WEBKIT_EXEC });

  // ---- 相位 1：线上落地页（标记 + 行为 + HUD 中文截图素材）----
  const live = await touchPhase(browser, LIVE_URL, 'live', R, { tapToStart: true });

  // 落地页源码断言：9 个音频解锁器标记
  const html = await live.page.content();
  fs.writeFileSync(OUT + '/final-page-source-live.html', html);
  R.markers = {};
  for (const m of MARKERS) R.markers[m] = (html.match(new RegExp(m, 'g')) || []).length;
  R.markers.pass = MARKERS.every((m) => R.markers[m] >= 1);
  console.log(`[final] markers: ${JSON.stringify(R.markers)}`);

  // ④ 素材：对局内 HUD 中文 3x 截图（tap 之后截图安全）
  await live.page.waitForTimeout(1200);
  await live.page.screenshot({ path: OUT + '/final3x_hud-chinese.png' });
  R.hudScreenshot = 'final3x_hud-chinese.png';
  console.log(`[final] hud screenshot saved`);

  // DOM capture 层触摸到达计数（旁证触摸管线真实）
  R.touchPipeline = await live.page.evaluate(() => window.__touchDebug || { note: 'shell 未暴露 __touchDebug，以引擎响应与 __audioDebug 变化为准' });

  // ---- 相位 2：本地静态导出页（因果链 suspended→running 实证）----
  const srv = await serveStatic(STATIC_ROOT, 8123);
  const stat = await touchPhase(browser, STATIC_URL, 'static-export', R, { tapToStart: false });
  srv.close();

  for (const p of R.phases) delete p.page;

  R.ok = !!(live.env.pass && R.markers.pass && live.running && stat.running && stat.causal);
  fs.writeFileSync(OUT + '/final-verify.json', JSON.stringify(R, null, 2));
  console.log(`[final] RESULT ok=${R.ok}`);
  await browser.close();
  process.exit(R.ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
