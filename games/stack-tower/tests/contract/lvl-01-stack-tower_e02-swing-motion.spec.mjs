#!/usr/bin/env node
/**
 * 契约测试 lvl-01-stack-tower/e02-swing-motion（spec: ac-lvl01-e02-swing）
 * 复现：node games/stack-tower/tests/contract/lvl-01-stack-tower_e02-swing-motion.spec.mjs
 * 断言：L1 摆速=160px/s、线性往返行程 ±240px；同 seed fastForward 逐 tick 全等；位移与解析解一致。
 */
import { runContract, assertEq, assertApproxEq, assert } from './_runner.mjs';

const TICKS_PER_SEC = 1000 / 16; // FIXED_STEP_MS=16

runContract({
  id: 'ac-lvl01-e02-swing',
  levelId: 'lvl-01-stack-tower',
  elementId: 'e02-swing-motion',
  needs: ['build/kernel/sim.js', 'build/kernel/numeric.js'],
  checks: [
    {
      name: 'L1 摆速 = swingSpeed(1) = 160px/s',
      fn: async ({ 'build/kernel/sim.js': sim, 'build/kernel/numeric.js': num }) => {
        const s = sim.createSim({ seed: 20260925 }).snapshot();
        assert(s.moving, '应有摆动块');
        assertEq(s.moving.speed, num.NUMERIC.difficulty.SWING_SPEED_BASE_PXS, '摆速');
        assertEq(s.moving.speed, 160, '摆速与 spec 数值');
      },
    },
    {
      name: '同 seed fastForward 两次：摆块 x 逐 tick 全等（确定性）',
      fn: async ({ 'build/kernel/sim.js': sim }) => {
        const trace = (h) => {
          const xs = [];
          for (let i = 0; i < 120; i++) {
            h.fastForward(1);
            xs.push(h.snapshot().moving ? h.snapshot().moving.x : NaN);
          }
          return xs;
        };
        const a = trace(sim.createSim({ seed: 20260925 }));
        const b = trace(sim.createSim({ seed: 20260925 }));
        assertEq(JSON.stringify(a), JSON.stringify(b), '两次 fastForward 轨迹');
      },
    },
    {
      name: '单 tick 位移 = speed×FIXED_STEP/1000（解析解，L1=2.56px）',
      fn: async ({ 'build/kernel/sim.js': sim }) => {
        const h = sim.createSim({ seed: 20260925 });
        const x0 = h.snapshot().moving.x;
        h.fastForward(1);
        const dx = Math.abs(h.snapshot().moving.x - x0);
        assertApproxEq(dx, (160 * 16) / 1000, 1e-6, '单 tick 位移');
      },
    },
    {
      name: '行程钳制 ±240：fastForward(240) 内 |x| ≤ 240 且方向发生反转',
      fn: async ({ 'build/kernel/sim.js': sim, 'build/kernel/numeric.js': num }) => {
        const h = sim.createSim({ seed: 20260925 });
        let sawReverse = false;
        let lastDir = h.snapshot().moving.dir;
        let maxX = 0;
        for (let i = 0; i < 240; i++) {
          h.fastForward(1);
          const m = h.snapshot().moving;
          assert(m, '摆动块全程存在（未落块）');
          maxX = Math.max(maxX, Math.abs(m.x - 240)); // 相对中点行程
          assert(
            Math.abs(m.x - 240) <= num.NUMERIC.cut_width.SWING_TRAVEL_PX + 1e-6,
            `行程越界: ${(m.x - 240).toFixed(2)}`,
          );
          if (m.dir !== lastDir) sawReverse = true;
          lastDir = m.dir;
        }
        assert(sawReverse, '240 tick≈3.84s 内应完成往返（L1 半程 1.5s）');
        assert(maxX <= 240 + 1e-6, `最大行程 ${maxX} 越界`);
      },
    },
  ],
});
