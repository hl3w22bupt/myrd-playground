#!/usr/bin/env node
/**
 * 契约测试 m21/acc-m1 — 安全区（证据形式 = env(safe-area-inset-*) 计算样式）。
 * 复现：node games/stack-tower/tests/contract/m21-acc-m1-safe-area.spec.mjs
 * 断言（计算样式快照）：#hud padding = calc(基础 + var(--st-safe-*))，注入模拟 inset 后逐边随动
 * （top 12+20=32px / right 14+8=22px / bottom 12+16=28px / left 14+0=14px）；
 * 真机清单（iPhone 刘海 / Android 手势条）挂日期另行核销。
 * 浏览器不可用 → RESULT: not-runnable（显式，不静默计绿）。
 */
import { runContract, assertEq, assert } from './_runner.mjs';
import { loadPlaywright, startServer } from './_browser.mjs';

runContract({
  id: 'acc-m1',
  levelId: 'lvl-01-stack-tower',
  elementId: 'e-pwa-shell',
  needs: ['build/ui/style.js'],
  checks: [
    {
      name: '样式真源：padding 由 env(safe-area-inset-*) 经 CSS 变量换算',
      fn: async ({ 'build/ui/style.js': style }) => {
        const css = style.STAGE_STYLE;
        for (const side of ['top', 'right', 'bottom', 'left']) {
          assert(css.includes(`--st-safe-${side}:env(safe-area-inset-${side}`), `CSS 变量绑定 safe-area-inset-${side}`);
        }
        assert(css.includes('padding:calc(12px + var(--st-safe-top))'), 'hud padding-top 换算');
      },
    },
    {
      name: '计算样式快照：注入模拟 inset 后 #hud padding 逐边随动（Chromium 实测）',
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
          const page = await browser.newPage({ viewport: { width: 560, height: 800 } });
          await page.goto(`${server.BASE}/`, { waitUntil: 'load' });
          await page.waitForSelector('#hud', { timeout: 5000 });
          // 注入模拟安全区（等价真机 env() 值）
          await page.addStyleTag({
            content: ':root{--st-safe-top:20px !important;--st-safe-right:8px !important;--st-safe-bottom:16px !important;--st-safe-left:0px !important}',
          });
          const pad = await page.evaluate(() => {
            const cs = getComputedStyle(document.getElementById('hud'));
            return { top: cs.paddingTop, right: cs.paddingRight, bottom: cs.paddingBottom, left: cs.paddingLeft };
          });
          assertEq(pad.top, '32px', `padding-top = 12+20（实测 ${pad.top}）`);
          assertEq(pad.right, '22px', `padding-right = 14+8（实测 ${pad.right}）`);
          assertEq(pad.bottom, '28px', `padding-bottom = 12+16（实测 ${pad.bottom}）`);
          assertEq(pad.left, '14px', `padding-left = 14+0（实测 ${pad.left}）`);
          report.evidence = `计算样式快照: ${JSON.stringify(pad)}`;
        } finally {
          if (browser) await browser.close();
          server.stop();
        }
      },
    },
  ],
});
