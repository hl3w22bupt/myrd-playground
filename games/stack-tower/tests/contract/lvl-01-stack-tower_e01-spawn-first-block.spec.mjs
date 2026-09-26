#!/usr/bin/env node
/**
 * 契约测试 lvl-01-stack-tower/e01-spawn-first-block（spec: ac-lvl01-e01-spawn）
 * 复现：node games/stack-tower/tests/contract/lvl-01-stack-tower_e01-spawn-first-block.spec.mjs
 * 断言：seed=20260925 启动后塔基块存在，宽度=120（BLOCK_BASE_WIDTH），中心 x=画布逻辑宽中点（240），静止。
 */
import { runContract, assertEq } from './_runner.mjs';

const LOGICAL_WIDTH = 480; // 平台约定（tech-plan §2）：内核坐标即逻辑坐标

runContract({
  id: 'ac-lvl01-e01-spawn',
  levelId: 'lvl-01-stack-tower',
  elementId: 'e01-spawn-first-block',
  needs: ['build/kernel/sim.js', 'build/kernel/numeric.js'],
  checks: [
    {
      name: '启动即有塔基块：tower.length===1',
      fn: async ({ 'build/kernel/sim.js': sim }) => {
        const s = sim.createSim({ seed: 20260925 }).snapshot();
        assertEq(s.tower.length, 1, '塔基块数量');
      },
    },
    {
      name: '塔基块宽度=BLOCK_BASE_WIDTH(120)',
      fn: async ({ 'build/kernel/sim.js': sim, 'build/kernel/numeric.js': num }) => {
        const s = sim.createSim({ seed: 20260925 }).snapshot();
        assertEq(s.tower[0].width, num.NUMERIC.cut_width.BLOCK_BASE_WIDTH, '塔基宽度');
        assertEq(s.tower[0].width, 120, '塔基宽度与 spec 数值');
      },
    },
    {
      name: '塔基块中心 x=画布逻辑宽中点(240)',
      fn: async ({ 'build/kernel/sim.js': sim }) => {
        const s = sim.createSim({ seed: 20260925 }).snapshot();
        assertEq(s.tower[0].x, LOGICAL_WIDTH / 2, '塔基中心 x');
      },
    },
    {
      name: '塔基块静止：fastForward(60) 后塔基快照不变',
      fn: async ({ 'build/kernel/sim.js': sim }) => {
        const h = sim.createSim({ seed: 20260925 });
        const before = JSON.stringify(h.snapshot().tower[0]);
        h.fastForward(60); // ≈1s
        const after = JSON.stringify(h.snapshot().tower[0]);
        assertEq(after, before, '塔基块应静止不变');
      },
    },
  ],
});
