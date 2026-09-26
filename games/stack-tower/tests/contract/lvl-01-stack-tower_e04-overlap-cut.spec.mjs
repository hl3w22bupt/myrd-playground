#!/usr/bin/env node
/**
 * 契约测试 lvl-01-stack-tower/e04-overlap-cut（spec: ac-lvl01-e04-cut）
 * 复现：node games/stack-tower/tests/contract/lvl-01-stack-tower_e04-overlap-cut.spec.mjs
 * 断言：offset=30 → 保留 90 并产生掉落碎块；|offset|≥width → 整块掉落不加分不升层。
 * 边界说明：整块掉落时 keepWidth=0 < 36，必然同时触发 e08 的 game-over 判定；
 *          本契约只断言「计分/塔身不变」，game-over 归 e08 专测，两契约不重叠。
 */
import { runContract, assertEq, assertApproxEq, assert } from './_runner.mjs';

/** 快进到摆块与塔顶偏差 ≈ targetOffset 的 tick（摆动连续扫过全行程，必然存在） */
function seekOffset(h, targetOffset, maxTicks = 400) {
  for (let i = 0; i < maxTicks; i++) {
    h.fastForward(1);
    const m = h.snapshot().moving;
    const top = h.snapshot().tower[h.snapshot().tower.length - 1];
    if (!m || !top) return null;
    const offset = m.x - top.x;
    if (Math.abs(Math.abs(offset) - targetOffset) <= 2.6) return offset; // 单 tick 步进 2.56px
  }
  return null;
}

runContract({
  id: 'ac-lvl01-e04-cut',
  levelId: 'lvl-01-stack-tower',
  elementId: 'e04-overlap-cut',
  needs: ['build/kernel/sim.js'],
  checks: [
    {
      name: 'offset≈30 → 保留宽度 ≈90',
      fn: async ({ 'build/kernel/sim.js': sim }) => {
        const h = sim.createSim({ seed: 20260925 });
        const off = seekOffset(h, 30);
        assert(off !== null, '行程内应存在 |offset|≈30 的时机');
        const events = h.tick({ type: 'drop' });
        const top = h.snapshot().tower[1];
        assertApproxEq(top.width, 120 - Math.abs(off), 2.6, '切割后保留宽度');
        assert(!events.some((e) => e.type === 'tower-ripple'), '非 perfect 不发 ripple');
      },
    },
    {
      name: 'offset≈30 → 产生掉落碎块（debris ≥1）',
      fn: async ({ 'build/kernel/sim.js': sim }) => {
        const h = sim.createSim({ seed: 20260925 });
        seekOffset(h, 30);
        h.tick({ type: 'drop' });
        assert(h.snapshot().debris.length >= 1, '切割应产生掉落碎块');
      },
    },
    {
      name: '|offset|≥width → 整块掉落：塔身不增加、不加分',
      fn: async ({ 'build/kernel/sim.js': sim }) => {
        const h = sim.createSim({ seed: 20260925 });
        const off = seekOffset(h, 130); // > 120（块宽）
        if (off === null) {
          // 行程 ±240 内 130 可达；若实现行程不同，显式失败而非跳过
          throw new Error('行程内未找到 |offset|≥width 的时机（130px）');
        }
        const before = { len: h.snapshot().tower.length, score: h.snapshot().score };
        h.tick({ type: 'drop' });
        assertEq(h.snapshot().tower.length, before.len, '整块掉落不得增加塔身');
        assertEq(h.snapshot().score, before.score, '整块掉落不得加分');
      },
    },
  ],
});
