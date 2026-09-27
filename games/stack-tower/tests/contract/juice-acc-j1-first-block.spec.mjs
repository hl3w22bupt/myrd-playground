#!/usr/bin/env node
/**
 * 契约测试 acc-j1 — 首块 ≤3s（spec v1.2 判据一）：冷启动（serve 起、无缓存首访）到
 * 首块可见（开局初始摆位 + 首个摆动块渲染上屏）≤ theme.FIRST_BLOCK_BUDGET_MS(3000)。
 * 复现：node games/stack-tower/tests/contract/juice-acc-j1-first-block.spec.mjs
 * 浏览器口径：playwright chromium（numeric.benchmark_device.LAB_RUNNER），视口 390x844；
 * 首块可见 = 塔底区块带出现非背景亮色像素（画布回读，同源无污染）；时刻取 performance.now()。
 * 真机单列按 content.benchmark 口径另行取证（不与本口径混算）。
 */
import { runContract, assert } from './_runner.mjs';
import { loadPlaywright, startServer } from './_browser.mjs';
import { JUICE } from '../../build/render/theme.js';

runContract({
  id: 'acc-j1',
  levelId: 'lvl-01-stack-tower',
  elementId: 'e09-opening-stack',
  needs: ['build/render/theme.js'],
  checks: [
    {
      name: '冷启动 → 首块可见 ≤3000ms（chromium 390x844）',
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
          const context = await browser.newContext({ viewport: { width: 390, height: 844 } }); // 全新上下文 = 无缓存首访
          const page = await context.newPage();
          const t0 = Date.now();
          await page.goto(`${server.BASE}/`, { waitUntil: 'load' });
          // 轮询画布塔底区块带（y ∈ [720-3*28-4, 720-28] 逻辑带 → 缩放后按比例采样）出现亮色像素
          const visibleAt = await page.evaluate(
            ({ budgetMs }) =>
              new Promise((resolve, reject) => {
                const started = performance.now();
                const timer = setInterval(() => {
                  const canvas = document.querySelector('#stack-tower-canvas');
                  if (!canvas) return;
                  try {
                    const ctx = canvas.getContext('2d');
                    const h = canvas.height;
                    const w = canvas.width;
                    // 塔底块带：底部 1~3 层，水平中段 1/3（开局摆位 + 摆动块都在此带内出现）
                    const img = ctx.getImageData(Math.floor(w / 3), h - Math.floor(h * 0.12), Math.floor(w / 3), Math.floor(h * 0.1));
                    let bright = 0;
                    for (let i = 0; i < img.data.length; i += 4) {
                      const r = img.data[i];
                      const g = img.data[i + 1];
                      const b = img.data[i + 2];
                      if (r + g + b > 210) bright++; // 夜空底 <90/通道；霓虹块与切面显著更亮
                    }
                    if (bright > 40) {
                      clearInterval(timer);
                      resolve(performance.now());
                    }
                  } catch (e) {
                    clearInterval(timer);
                    reject(e);
                  }
                  if (performance.now() - started > budgetMs + 1500) {
                    clearInterval(timer);
                    resolve(performance.now()); // 超时返回实测值，由外层判 FAIL
                  }
                }, 60);
              }),
            { budgetMs: JUICE.FIRST_BLOCK_BUDGET_MS },
          );
          const elapsed = visibleAt; // page 内时钟：导航提交后计
          assert(elapsed <= JUICE.FIRST_BLOCK_BUDGET_MS, `首块可见 ${Math.round(elapsed)}ms ≤ ${JUICE.FIRST_BLOCK_BUDGET_MS}ms（墙钟辅助 ${Date.now() - t0}ms）`);
          await context.close();
        } finally {
          if (browser) await browser.close().catch(() => {});
          server.stop();
        }
      },
    },
  ],
});
