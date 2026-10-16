#!/usr/bin/env node
/**
 * 契约测试 acc-j5 — 首局无弹窗（spec v1.2）：安装态首访首局全程零非游戏内弹层
 * （无引导遮罩/权限弹窗/更新提示/评分邀请）；rotate-overlay 仅横屏触发，不属竖屏首局路径。
 * 复现：node games/stack-tower/tests/contract/juice-acc-j5-first-session-no-modal.spec.mjs
 * 浏览器口径：全新上下文（= 安装态首访），首局 = 载入 + 3 次落块输入 + 全程监听；
 * 弹层信号 = 原生 dialog 事件（alert/confirm/prompt/beforeunload）+ DOM 弹层选择器出现。
 */
import { runContract, assertEq, assert } from './_runner.mjs';
import { loadPlaywright, startServer, sleep } from './_browser.mjs';

const MODAL_SELECTORS = [
  'dialog[open]',
  '[role="dialog"]',
  '[role="alertdialog"]',
  '.st-modal',
  '.st-guide-overlay',
  '.st-update-toast',
  '.st-rate-prompt',
];

runContract({
  id: 'acc-j5',
  levelId: 'lvl-01-stack-tower',
  elementId: 'e03-drop-input',
  needs: [],
  checks: [
    {
      name: '首局全程零弹层：原生 dialog + DOM 弹层选择器 + 横屏遮罩（竖屏不激活）',
      fn: async (_mods, report) => {
        const pw = await loadPlaywright();
        if (!pw) {
          report.notRunnable = 'playwright 不可用（Chromium 环境缺失）';
          return;
        }
        const server = await startServer();
        let browser;
        try {
          browser = await pw.chromium.launch({ headless: true });
          const context = await browser.newContext({ viewport: { width: 390, height: 844 } }); // 全新 = 安装态首访
          const page = await context.newPage();
          const dialogs = [];
          page.on('dialog', (d) => {
            dialogs.push(d.type());
            void d.dismiss();
          });
          await page.goto(`${server.BASE}/`, { waitUntil: 'load' });
          await page.waitForSelector('#stack-tower-canvas', { timeout: 5000 });
          const box = await page.locator('#stack-tower-canvas').boundingBox();
          const tap = async () => {
            await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
            await sleep(320);
          };
          // 首局 3 次落块输入（首拍即 perfect；切损/整块掉落均在首局域内，不触发任何弹层）
          await tap();
          await tap();
          await tap();
          assertEq(dialogs.length, 0, `原生弹窗次数（alert/confirm/prompt）`);
          for (const sel of MODAL_SELECTORS) {
            assertEq(await page.locator(sel).count(), 0, `弹层选择器 ${sel}`);
          }
          // 竖屏（390x844）横屏遮罩不得激活：display:none 或无可见元素
          const rotateVisible = await page.evaluate(() => {
            const el = document.querySelector('.st-rotate-overlay');
            if (!el) return false;
            const cs = getComputedStyle(el);
            return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0;
          });
          assert(!rotateVisible, '竖屏首局横屏遮罩未激活');
          // 游戏本体存活：HUD 可见（无弹层 ≠ 白屏）
          assert((await page.locator('#hud').count()) === 1, 'HUD 正常挂载');
          await context.close();
        } finally {
          if (browser) await browser.close().catch(() => {});
          server.stop();
        }
      },
    },
  ],
});
