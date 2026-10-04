#!/usr/bin/env node
/**
 * 契约测试 m21/acc-d2 — 断网冒烟全链路（SW precache 后离线）。
 * 复现：node games/stack-tower/tests/contract/m21-acc-d2-offline-smoke.spec.mjs
 * 链路：冷启动 → SW 就绪 → 离线 reload（冷启动可玩）→ 一局（tap 落块计分）→ 结算（重开）
 *       → 静音持久（离线 reload 后保持）；含无音频 404 负面用例（sfx 全 404 不抛错、核心循环可玩）。
 * 浏览器不可用 → not-runnable（显式）。
 */
import { runContract, assertEq, assert } from './_runner.mjs';
import { loadPlaywright, startServer, sleep } from './_browser.mjs';

async function score(page) {
  const t = await page.locator('.st-hud-score').innerText();
  return Number(t.replace(/\D+/g, '')) || 0;
}

runContract({
  id: 'acc-d2',
  levelId: 'lvl-01-stack-tower',
  elementId: 'e-pwa-shell',
  needs: [],
  checks: [
    {
      name: '断网全链路：冷启动→一局→重开→静音持久（SW 离线供源）',
      fn: async (mods, report) => {
        const pw = await loadPlaywright();
        if (!pw) {
          report.notRunnable = 'playwright 不可用（Chromium 环境缺失）';
          return;
        }
        const server = await startServer();
        let browser;
        try {
          browser = await pw.chromium.launch({ headless: true });
          const context = await browser.newContext({ viewport: { width: 480, height: 720 } });
          const page = await context.newPage();
          const errors = [];
          page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
          page.on('console', (m) => {
            if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(`console.error: ${m.text()}`);
          });

          // 冷启动（在线）：SW 注册并接管
          await page.goto(`${server.BASE}/`, { waitUntil: 'load' });
          await page.waitForSelector('#stack-tower-canvas', { timeout: 5000 });
          await page.evaluate(() => navigator.serviceWorker.ready);
          const swState = await page.evaluate(async () => {
            const reg = await navigator.serviceWorker.getRegistration();
            const keys = await caches.keys();
            return { controlled: !!reg?.active, caches: keys };
          });
          assert(swState.controlled, 'SW 未激活');
          assert(swState.caches.some((k) => k.startsWith('st-precache-')), `precache 缓存缺失: ${swState.caches}`);
          report.evidence = `caches=[${swState.caches.join(', ')}]`;

          // 离线：冷启动 reload（SW 离线供源）→ 一局（tap 计分）
          await context.setOffline(true);
          await page.reload({ waitUntil: 'load' });
          await page.waitForSelector('#stack-tower-canvas', { timeout: 5000 });
          const box = await page.locator('#stack-tower-canvas').boundingBox();
          await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
          await sleep(420);
          const offlineScore = await score(page);
          assert(offlineScore > 0, `离线冷启动后一局不可玩（score=${offlineScore}）`);

          // 结算（重开）：R 全量复位
          await page.keyboard.press('r');
          await sleep(120);
          assertEq(await score(page), 0, '离线重开复位');

          // 静音持久：切静音 → 离线 reload → 保持
          await page.locator('.st-hud-mute').click();
          await sleep(100);
          const mutedStored = await page.evaluate(() => localStorage.getItem('st.settings.muted'));
          assertEq(mutedStored, '1', '静音落盘（离线环境）');
          await page.reload({ waitUntil: 'load' });
          await page.waitForSelector('#stack-tower-canvas', { timeout: 5000 });
          const muteText = await page.locator('.st-hud-mute').innerText();
          assert(muteText.includes('静音'), `reload 后静音态保持（按钮文案 "${muteText}"）`);
          assertEq(errors.length, 0, `断网链路出现代码错误: ${errors.join(' | ')}`);
        } finally {
          if (browser) await browser.close();
          server.stop();
        }
      },
    },
    {
      name: '无音频 404 负面用例：sfx 全 404 不抛错、核心循环可玩（404 子句承接自 acc-a1）',
      fn: async (mods, report) => {
        const pw = await loadPlaywright();
        if (!pw) {
          report.notRunnable = 'playwright 不可用（Chromium 环境缺失）';
          return;
        }
        const server = await startServer();
        let browser;
        try {
          browser = await pw.chromium.launch({ headless: true });
          const page = await browser.newPage({ viewport: { width: 480, height: 720 } });
          const errors = [];
          page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
          page.on('console', (m) => {
            if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(`console.error: ${m.text()}`);
          });
          await page.route('**/assets/sfx/**', (route) => route.fulfill({ status: 404, body: 'not found' }));
          await page.goto(`${server.BASE}/`, { waitUntil: 'load' });
          await page.waitForSelector('#stack-tower-canvas', { timeout: 5000 });
          const box = await page.locator('#stack-tower-canvas').boundingBox();
          await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
          await sleep(420);
          assert((await score(page)) > 0, '音频 404 下核心循环不可玩');
          assertEq(errors.length, 0, `音频 404 下出现代码错误: ${errors.join(' | ')}`);
        } finally {
          if (browser) await browser.close();
          server.stop();
        }
      },
    },
  ],
});
