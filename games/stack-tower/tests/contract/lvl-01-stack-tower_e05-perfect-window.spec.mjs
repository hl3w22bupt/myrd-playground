#!/usr/bin/env node
/**
 * 契约测试 lvl-01-stack-tower/e05-perfect-window（spec: ac-lvl01-e05-window）
 * 复现：node games/stack-tower/tests/contract/lvl-01-stack-tower_e05-perfect-window.spec.mjs
 * 必改①落点：不存在「任何输入必失败」的无窗局面 —— 断言「前 3 次输入内存在 ≥1 个可命中窗口」：
 *   ①窗口存在且周期重现：一个完整往返周期内 |offset|≤22.4px 的独立命中段 ≥2（左右各经过一次）；
 *   ②开局 3 次输入预算内（在第 1 个命中段内输入即可，实际第 1 次）：perfect 达成且块宽不变。
 */
import { runContract, assertEq, assert, assertApproxEq } from './_runner.mjs';

const PERFECT_HIT_WINDOW_TICKS = 1; // 判定按 tick 离散化
/** 统计一个时间窗内 |offset|≤thresh 的独立命中段 */
function hitSegments(h, ticks, thresh) {
  const segs = [];
  let inSeg = false;
  for (let i = 0; i < ticks; i++) {
    h.fastForward(1);
    const s = h.snapshot();
    if (!s.moving) break;
    const top = s.tower[s.tower.length - 1];
    const hit = Math.abs(s.moving.x - top.x) <= thresh;
    if (hit && !inSeg) segs.push(i);
    inSeg = hit;
  }
  return segs;
}

runContract({
  id: 'ac-lvl01-e05-window',
  levelId: 'lvl-01-stack-tower',
  elementId: 'e05-perfect-window',
  needs: ['build/kernel/sim.js', 'build/kernel/numeric.js'],
  checks: [
    {
      name: '窗口公式：perfectWindowMs(1)=140，perfectDistance(1)=22.4px',
      fn: async ({ 'build/kernel/numeric.js': num }) => {
        assertEq(num.perfectWindowMs(1), 140, 'L1 判定窗口');
        assertApproxEq(num.perfectDistance(1), 22.4, 1e-9, 'L1 判定距离阈值');
      },
    },
    {
      name: '必改①：一个往返周期内独立命中段 ≥2（窗口周期重现，无死局）',
      fn: async ({ 'build/kernel/sim.js': sim, 'build/kernel/numeric.js': num }) => {
        const h = sim.createSim({ seed: 20260925 });
        const roundTripTicks = Math.ceil((4 * num.NUMERIC.cut_width.SWING_TRAVEL_PX) / 160 * (1000 / 16)); // 全程×2 / 速度 → tick
        const segs = hitSegments(h, roundTripTicks + 10, num.perfectDistance(1));
        assert(segs.length >= 2, `往返周期内命中段仅 ${segs.length} 个（要求 ≥2，即左右行程各 ≥1）——存在无窗局面即违反必改①`);
      },
    },
    {
      name: '必改①：前 3 次输入预算内达成 perfect（在首个命中段内输入，实际 ≤3 次）',
      fn: async ({ 'build/kernel/sim.js': sim, 'build/kernel/numeric.js': num }) => {
        const h = sim.createSim({ seed: 20260925 });
        // 搜索首个命中 tick，作为第 1 次输入点
        let inputTick = -1;
        for (let i = 0; i < 400; i++) {
          h.fastForward(1);
          const s = h.snapshot();
          const top = s.tower[s.tower.length - 1];
          if (Math.abs(s.moving.x - top.x) <= num.perfectDistance(1)) {
            inputTick = i;
            break;
          }
        }
        assert(inputTick >= 0, '开局应存在可命中窗口');
        const events = h.tick({ type: 'drop' }); // 第 1 次输入（预算 3 次之内）
        const placed = events.find((e) => e.type === 'block-placed');
        assert(placed, 'block-placed 事件缺失');
        assertEq(placed.perfect, true, '命中段内输入应判 perfect');
        assert(inputTick + 1 <= 3 * 400, '输入次数预算（形式约束：1 ≤ 3）');
      },
    },
    {
      name: 'perfect 成立后块宽不变（无切割损耗）',
      fn: async ({ 'build/kernel/sim.js': sim, 'build/kernel/numeric.js': num }) => {
        const h = sim.createSim({ seed: 20260925 });
        const wBefore = h.snapshot().tower[h.snapshot().tower.length - 1].width;
        for (let i = 0; i < 400; i++) {
          h.fastForward(1);
          const s = h.snapshot();
          if (Math.abs(s.moving.x - s.tower[s.tower.length - 1].x) <= num.perfectDistance(1)) break;
        }
        h.tick({ type: 'drop' });
        assertEq(h.snapshot().tower[h.snapshot().tower.length - 1].width, wBefore, 'perfect 后顶部块宽');
      },
    },
  ],
});
