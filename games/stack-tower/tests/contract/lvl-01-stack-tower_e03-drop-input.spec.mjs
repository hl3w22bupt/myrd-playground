#!/usr/bin/env node
/**
 * 契约测试 lvl-01-stack-tower/e03-drop-input（spec: ac-lvl01-e03-input）
 * 复现：node games/stack-tower/tests/contract/lvl-01-stack-tower_e03-drop-input.spec.mjs
 * 断言：注入 {type:'drop'} 后同一 tick 摆动块转已落块、速度归零，下一摆动块同 tick 序内生成。
 */
import { runContract, assertEq, assert } from './_runner.mjs';

runContract({
  id: 'ac-lvl01-e03-input',
  levelId: 'lvl-01-stack-tower',
  elementId: 'e03-drop-input',
  needs: ['build/kernel/sim.js'],
  checks: [
    {
      name: 'drop 后塔身 +1（tower.length===2）',
      fn: async ({ 'build/kernel/sim.js': sim }) => {
        const h = sim.createSim({ seed: 20260925 });
        h.tick({ type: 'drop' });
        assertEq(h.snapshot().tower.length, 2, '落块后塔身层数');
      },
    },
    {
      name: '同一 tick 生效：drop 的 tick 返回 block-placed 事件',
      fn: async ({ 'build/kernel/sim.js': sim }) => {
        const h = sim.createSim({ seed: 20260925 });
        const events = h.tick({ type: 'drop' });
        const placed = events.filter((e) => e.type === 'block-placed');
        assertEq(placed.length, 1, 'drop tick 内 block-placed 事件数');
      },
    },
    {
      name: '落块速度归零：已落块不再有 dir/speed 摆动语义（快照位置稳定）',
      fn: async ({ 'build/kernel/sim.js': sim }) => {
        const h = sim.createSim({ seed: 20260925 });
        h.tick({ type: 'drop' });
        const top = JSON.stringify(h.snapshot().tower[1]);
        h.fastForward(30);
        assertEq(JSON.stringify(h.snapshot().tower[1]), top, '已落块位置应稳定');
      },
    },
    {
      name: '下一摆动块同 tick 序内生成：drop 后 moving 非空',
      fn: async ({ 'build/kernel/sim.js': sim }) => {
        const h = sim.createSim({ seed: 20260925 });
        h.tick({ type: 'drop' });
        assert(h.snapshot().moving, 'drop 后应立即有新摆动块');
        assertEq(h.snapshot().moving.width, h.snapshot().tower[1].width, '新摆块宽度继承上一已落块');
      },
    },
  ],
});
