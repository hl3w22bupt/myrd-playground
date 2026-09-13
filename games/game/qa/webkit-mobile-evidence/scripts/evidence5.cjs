/* WebKit 移动端取证 v5：双相位（线上 AppHost 部署 + 本地静态导出页）。
 * 断言① 线上页面源码含音频手势解锁器 + 新 deployment；
 * 断言② 触摸后 __audioDebug().state==='running'（audio worklet 加载 >0）；
 * 断言③ 无效交换抖动/回弹动画 → recordVideo 全程留证（后处理抽帧定量）；
 * 断言④ 静态导出页（export/web/index.html，自定义壳内嵌解锁器）本地伺服后
 *        同样通过源码标记 + 引擎启动 + 触摸解锁 running 三重断言。 */
const { webkit, devices } = require('playwright');
const fs = require('fs');
const path = require('path');

const LIVE_URL = process.env.LIVE_URL || 'https://leomac-studio.tail49399e.ts.net/apps/game/';
const STATIC_URL = process.env.STATIC_URL || 'http://127.0.0.1:8123/index.html';
const OUT = '/tmp/candy-webkit/v5';
const CX = 70.4, CY = 238.6, STEP = 49.8;
const cellCss = (x, y) => ({ x: CX + STEP * x, y: CY + STEP * y });
const MARKERS = ['__audioDebug', 'unlockAudio', 'WrappedAudioContext', 'touchstart', 'pointerdown',
  'webkitAudioContext', 'statechange', 'visibilitychange', 'audioAddModules'];
const ev = { liveUrl: LIVE_URL, staticUrl: STATIC_URL, startedAtMs: Date.now(),
  viewportNote: 'iPhone13 descriptor 390x664 @3x' };
const log = (m) => { console.log('[v5] ' + m); ev.steps = (ev.steps || []).concat(m);
  fs.writeFileSync(path.join(OUT, 'evidence5.json'), JSON.stringify(ev, null, 2)); };

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const launchOpts = process.env.WEBKIT_EXEC ? { executablePath: process.env.WEBKIT_EXEC } : {};
  const browser = await webkit.launch(launchOpts);

  // ================= 相位 A：线上 AppHost 部署 =================
  {
    const ctx = await browser.newContext({
      ...devices['iPhone 13'],
      recordVideo: { dir: OUT, size: { width: 390, height: 664 } },
    });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => { ev.pageErrors = (ev.pageErrors || []).concat(String(e).slice(0, 200)); });

    const resp = await page.goto(LIVE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const html = await page.content();
    const found = {}; MARKERS.forEach((m) => { found[m] = html.includes(m); });
    ev.assertA1_live_unlocker_source = { httpStatus: resp.status(), viewport: page.viewportSize(),
      userAgent: await page.evaluate(() => navigator.userAgent),
      maxTouchPoints: await page.evaluate(() => navigator.maxTouchPoints),
      markersFound: found,
      passed: Object.values(found).every(Boolean) && resp.status() === 200 };
    fs.writeFileSync(path.join(OUT, 'page-source-live.html'), html);
    log('A1 live unlocker source passed=' + ev.assertA1_live_unlocker_source.passed);

    await page.waitForFunction(() => {
      const b = document.getElementById('boot');
      return b && b.classList.contains('hidden');
    }, null, { timeout: 120000 });
    await page.waitForTimeout(800);

    await page.evaluate(() => {
      window.__cnt = { ts: 0, te: 0, pd: 0 };
      ['touchstart', 'touchend', 'pointerdown'].forEach((t) => {
        document.addEventListener(t, () => { window.__cnt[t === 'touchstart' ? 'ts' : t === 'touchend' ? 'te' : 'pd']++; },
          { capture: true, passive: true });
      });
    });

    const t0 = Date.now() - ev.startedAtMs;
    await page.touchscreen.tap(195, 370); // START：首个用户手势 = 音频解锁 + 开局
    await page.waitForTimeout(1600);
    const dbg1 = await page.evaluate(() => window.__audioDebug());
    const cnt1 = await page.evaluate(() => window.__cnt);
    ev.assertA2_audio_running = { afterStartTap: dbg1, domTouchCount: cnt1,
      passed: !!dbg1 && dbg1.state === 'running' && dbg1.addModules > 0 };
    log('A2 after START tap __audioDebug=' + JSON.stringify(dbg1) + ' cnt=' + JSON.stringify(cnt1));

    // 无效交换 ×2（HUD 出现 Invalid 提示 + 抖动回弹进视频）
    const swaps = [[2, 2, 3, 2], [1, 3, 1, 4]];
    const attemptLog = [];
    for (const [ax, ay, bx, by] of swaps) {
      const A = cellCss(ax, ay), B = cellCss(bx, by);
      const ts = Date.now() - ev.startedAtMs;
      await page.touchscreen.tap(A.x, A.y);
      await page.waitForTimeout(220);
      await page.touchscreen.tap(B.x, B.y);
      attemptLog.push({ cells: { a: [ax, ay], b: [bx, by] }, css: { A, B }, msFromStart: ts });
      ev.swapAttempts = attemptLog;
      await page.waitForTimeout(3400); // FX 0.5s + 提示停留 2.5s + 归位，视频完整记录（含 settle）
      log(`A3 swap (${ax},${ay})->(${bx},${by}) at video t≈${(ts / 1000).toFixed(1)}s`);
    }
    ev.domTouchCountFinal = await page.evaluate(() => window.__cnt);
    ev.audioDebugFinal = await page.evaluate(() => window.__audioDebug());
    log('A final audioDebug=' + JSON.stringify(ev.audioDebugFinal) +
      ' cnt=' + JSON.stringify(ev.domTouchCountFinal));

    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, 'live_end.png') }).catch(() => {});
    const video = await page.video().path();
    await ctx.close();
    ev.videoPath = video;
    log('A video saved: ' + video);
  }

  // ================= 相位 B：静态导出页（export/web/index.html 自定义壳）=================
  {
    const ctx = await browser.newContext({
      ...devices['iPhone 13'],
      deviceScaleFactor: 3,
    });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => { ev.staticPageErrors = (ev.staticPageErrors || []).concat(String(e).slice(0, 200)); });

    const resp = await page.goto(STATIC_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const html = await page.content();
    const found = {}; MARKERS.forEach((m) => { found[m] = html.includes(m); });
    ev.assertB1_static_unlocker_source = { httpStatus: resp.status(),
      markersFound: found,
      passed: Object.values(found).every(Boolean) && resp.status() === 200 };
    fs.writeFileSync(path.join(OUT, 'page-source-static.html'), html);
    log('B1 static unlocker source passed=' + ev.assertB1_static_unlocker_source.passed);

    // 等引擎创建 AudioContext（state 变为 suspended/running 之一 = 引擎音频驱动已起）
    await page.waitForFunction(() => window.__audioDebug
      && window.__audioDebug().state !== 'no-ctx', null, { timeout: 120000 });
    const before = await page.evaluate(() => window.__audioDebug());
    await page.waitForTimeout(1500); // 等棋盘渲染完成
    await page.screenshot({ path: path.join(OUT, 'static_boot_board.png') });

    const c = cellCss(3, 3);
    await page.touchscreen.tap(c.x, c.y); // 首个用户手势：解锁音频 + 选中格
    await page.waitForTimeout(1200);
    const after = await page.evaluate(() => window.__audioDebug());
    await page.screenshot({ path: path.join(OUT, 'static_after_tap.png'), fullPage: false });
    ev.assertB2_static_audio_running = { beforeTap: before, afterTap: after,
      passed: !!after && after.state === 'running' };
    log('B2 static before=' + JSON.stringify(before) + ' after=' + JSON.stringify(after));

    await ctx.close();
  }

  await browser.close();
  ev.finishedAtMs = Date.now();
  ev.allPassed = ev.assertA1_live_unlocker_source.passed && ev.assertA2_audio_running.passed
    && ev.assertB1_static_unlocker_source.passed && ev.assertB2_static_audio_running.passed;
  fs.writeFileSync(path.join(OUT, 'evidence5.json'), JSON.stringify(ev, null, 2));
  log('DONE allPassed=' + ev.allPassed);
  if (!ev.allPassed) process.exit(1);
})().catch((e) => { log('FATAL ' + (e && e.message)); console.error(e); process.exit(1); });
