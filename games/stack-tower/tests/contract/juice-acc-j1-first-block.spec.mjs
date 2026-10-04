#!/usr/bin/env node
/**
 * 契约测试 acc-j1 — 首块 ≤3s（spec v1.2 判据一）：冷启动（serve 起、无缓存首访）到
 * 首块可见（开局初始摆位 + 首个摆动块渲染上屏）≤ theme.FIRST_BLOCK_BUDGET_MS(3000)。
 * 复现：node games/stack-tower/tests/contract/juice-acc-j1-first-block.spec.mjs
 *
 * 实验口径 = spec acc-j1 语句 + numeric.benchmark_device（冻结条款见 content.benchmark：
 * 换节流档位/换视口必须先升策划案版本，再改本测试）：
 *   playwright chromium（LAB_RUNNER）+ CPU throttle 4x（LAB_CPU_THROTTLE_X，CDP
 *   Emulation.setCPUThrottlingRate 注入）+ LAB_VIEWPORTS_PX 两档（390x844 / 360x640）
 *   逐档测量、逐档断言，两档全过才计绿。
 * 真机单列按 content.benchmark 口径另行取证（不与本口径混算）。
 * 首块可见 = 塔底区块带出现非背景亮色像素（画布回读，同源无污染）；时刻取页内 performance.now()
 * （墙钟，不受节流影响 → 测得节流下的用户体感冷启动时长）。
 */
import { runContract, loadSpec, assert } from './_runner.mjs';
import { loadPlaywright, startServer, newBenchmarkPage } from './_browser.mjs';
import { JUICE } from '../../build/render/theme.js';

// 实验口径唯一真源 = spec numeric.benchmark_device（禁止本地重定义，防口径漂移）
const benchmark = loadSpec().spec.numeric.benchmark_device;
const THROTTLE_X = benchmark.LAB_CPU_THROTTLE_X;
const VIEWPORTS = benchmark.LAB_VIEWPORTS_PX.map(([w, h]) => ({ width: w, height: h }));
const viewportLabel = VIEWPORTS.map((v) => `${v.width}x${v.height}`).join(' / ');

runContract({
  id: 'acc-j1',
  levelId: 'lvl-01-stack-tower',
  elementId: 'e09-opening-stack',
  needs: ['build/render/theme.js'],
  checks: [
    {
      name: `冷启动 → 首块可见 ≤3000ms（chromium + ${THROTTLE_X}x CPU throttle · ${viewportLabel}）`,
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
          // 两档视口各测一次（每档全新 context = 各自无缓存冷启动），先全测后断言，失败信息一次带全
          const measured = [];
          for (const vp of VIEWPORTS) {
            const { context, page } = await newBenchmarkPage(browser, {
              width: vp.width,
              height: vp.height,
              throttleX: THROTTLE_X,
            });
            try {
              await page.goto(`${server.BASE}/`, { waitUntil: 'load' });
              // 轮询画布塔底区块带（开局摆位 + 摆动块都在此带内出现）出现亮色像素
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
                        // 塔底块带：底部 1~3 层，水平中段 1/3
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
              measured.push({ vp: `${vp.width}x${vp.height}`, elapsed: Math.round(visibleAt) });
            } finally {
              await context.close();
            }
          }
          for (const m of measured) {
            assert(
              m.elapsed <= JUICE.FIRST_BLOCK_BUDGET_MS,
              `视口 ${m.vp}：首块可见 ${m.elapsed}ms > ${JUICE.FIRST_BLOCK_BUDGET_MS}ms（throttle ${THROTTLE_X}x，冷启动超预算）`,
            );
          }
          report.evidence = measured.map((m) => `${m.vp}=${m.elapsed}ms`).join(' · ') + `（throttle ${THROTTLE_X}x）`;
        } finally {
          if (browser) await browser.close().catch(() => {});
          server.stop();
        }
      },
    },
  ],
});
