#!/usr/bin/env node
/**
 * 契约测试 lvl-01-stack-tower/e08-fail-recover（spec: ac-lvl01-e08-recover）
 * 复现：node games/stack-tower/tests/contract/lvl-01-stack-tower_e08-fail-recover.spec.mjs
 * 断言：keepWidth<36（=120×0.30）→ game-over；重开后塔回单块、分数/连击清零、摆速与窗口回 L1 值，无状态残留。
 */
import { runContract, assertEq, assert } from './_runner.mjs';

/** 快进到 |offset| ≈ target 的 tick（量化步进 2.56px） */
function seekOffset(h, target, maxTicks = 400) {
  for (let i = 0; i < maxTicks; i++) {
    h.fastForward(1);
    const s = h.snapshot();
    if (!s.moving) return null;
    const off = s.moving.x - s.tower[s.tower.length - 1].x;
    if (Math.abs(Math.abs(off) - target) <= 2.6) return off;
  }
  return null;
}

runContract({
  id: 'ac-lvl01-e08-recover',
  levelId: 'lvl-01-stack-tower',
  elementId: 'e08-fail-recover',
  needs: ['build/kernel/sim.js', 'build/kernel/numeric.js'],
  checks: [
    {
      name: 'keepWidth 跌破 36 → status=game-over（两刀：120→60→0 触发 floor）',
      fn: async ({ 'build/kernel/sim.js': sim, 'build/kernel/numeric.js': num }) => {
        const h = sim.createSim({ seed: 20260925 });
        // 第一刀：offset≈60 → 保留 60
        const off1 = seekOffset(h, 60);
        assert(off1 !== null, '未找到 |offset|≈60 时机');
        h.tick({ type: 'drop' });
        assertEq(h.snapshot().status, 'running', '第一刀后应仍在进行');
        // 第二刀：对 60 宽块再切 60 → keepWidth=0 < 36
        const off2 = seekOffset(h, 60);
        assert(off2 !== null, '未找到第二刀时机');
        const events = h.tick({ type: 'drop' });
        assertEq(h.snapshot().status, 'game-over', 'keepWidth<36 应 game-over');
        assert(events.some((e) => e.type === 'game-over' && e.reason === 'width-floor'), '应有 width-floor 归因的 game-over 事件');
        void num;
      },
    },
    {
      name: 'game-over 后塔身冻结（tick 不再改变快照）',
      fn: async ({ 'build/kernel/sim.js': sim }) => {
        const h = sim.createSim({ seed: 20260925 });
        seekOffset(h, 60);
        h.tick({ type: 'drop' });
        seekOffset(h, 60);
        h.tick({ type: 'drop' });
        const frozen = JSON.stringify(h.snapshot());
        h.fastForward(30);
        assertEq(JSON.stringify(h.snapshot()), frozen, 'game-over 后快照应冻结');
      },
    },
    {
      name: '重开全量复位：塔回单块、分数/连击清零、status=running',
      fn: async ({ 'build/kernel/sim.js': sim }) => {
        const h = sim.createSim({ seed: 20260925 });
        seekOffset(h, 60);
        h.tick({ type: 'drop' });
        seekOffset(h, 60);
        h.tick({ type: 'drop' });
        assertEq(h.snapshot().status, 'game-over', '前置：已 game-over');
        h.restart();
        const s = h.snapshot();
        assertEq(s.tower.length, 1, '塔回单块');
        assertEq(s.score, 0, '分数清零');
        assertEq(s.combo, 0, '连击清零');
        assertEq(s.status, 'running', '状态回 running');
      },
    },
    {
      name: '复位后摆速/窗口回 L1 值（160px/s / 140ms），无状态残留',
      fn: async ({ 'build/kernel/sim.js': sim, 'build/kernel/numeric.js': num }) => {
        const h = sim.createSim({ seed: 20260925 });
        seekOffset(h, 60);
        h.tick({ type: 'drop' });
        h.restart();
        const s = h.snapshot();
        assertEq(s.level, 1, '关卡回 1');
        assert(s.moving, '重开应有摆动块');
        assertEq(s.moving.speed, num.swingSpeed(1), '摆速回 L1');
        assertEq(s.moving.speed, 160, '摆速与 spec 数值');
        assertEq(num.perfectWindowMs(s.level), 140, '窗口回 L1');
        assertEq(s.debris.length, 0, '碎块清空（无残留）');
      },
    },
  ],
});
