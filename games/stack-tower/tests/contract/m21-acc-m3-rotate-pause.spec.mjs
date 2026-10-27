#!/usr/bin/env node
/**
 * 契约测试 m21/acc-m3 — 横屏遮罩激活即暂停（自动化面；真机项挂日期）。
 * 复现：node games/stack-tower/tests/contract/m21-acc-m3-rotate-pause.spec.mjs
 * 断言（Chromium 实测）：横屏视口 → 遮罩显示且点击不计分（tick 不推进/输入被忽略）；
 * 恢复竖屏 → 遮罩隐藏、点击照常计分。浏览器不可用 → not-runnable（显式）。
 */
import { runContract, assertEq, assert } from './_runner.mjs';
import { loadPlaywright, startServer, sleep } from './_browser.mjs';

async function score(page) {
  const t = await page.locator('.st-hud-score').innerText();
  return Number(t.replace(/\D+/g, '')) || 0;
}

runContract({
  id: 'acc-m3',
  levelId: 'lvl-01-stack-tower',
  elementId: 'e-rotate-overlay',
  needs: ['build/ui/rotate-overlay.js'],
  checks: [
    {
      name: '横屏视口：遮罩显示 + 点击不计分（激活即暂停）；回竖屏恢复',
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
          await page.goto(`${server.BASE}/`, { waitUntil: 'load' });
          await page.waitForSelector('#stack-tower-canvas', { timeout: 5000 });
          const box = await page.locator('#stack-tower-canvas').boundingBox();
          const tap = async () => {
            await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
            await sleep(420);
          };

          await tap(); // 竖屏基线：开局必中，计分 > 0
          const portraitScore = await score(page);
          assert(portraitScore > 0, `竖屏点击应计分（实际 ${portraitScore}）`);
          assertEq(await page.locator('#st-rotate-overlay').isVisible(), false, '竖屏遮罩隐藏');

          await page.setViewportSize({ width: 800, height: 400 }); // 转横屏
          await sleep(150);
          assertEq(await page.locator('#st-rotate-overlay').isVisible(), true, '横屏遮罩显示');
          await tap();
          await tap();
          assertEq(await score(page), portraitScore, '横屏期间点击不计分（暂停）');

          await page.setViewportSize({ width: 480, height: 720 }); // 回竖屏
          await sleep(150);
          assertEq(await page.locator('#st-rotate-overlay').isVisible(), false, '回竖屏遮罩解除');
          // 确定性恢复口径：R 重开（清掉横屏期冻结相位）→ 开局面块自中轴入画，首点必中
          await page.keyboard.press('r');
          await sleep(120);
          await sleep(350); // 越过输入去抖窗口（300ms）
          await tap();
          const resumed = await score(page);
          assert(resumed > 0, `回竖屏后恢复计分（0 → ${resumed}）`);
          report.evidence = `portrait ${portraitScore} → landscape 冻结 → portrait 重开恢复 ${resumed}`;
        } finally {
          if (browser) await browser.close();
          server.stop();
        }
      },
    },
  ],
});
