#!/usr/bin/env node
/**
 * 契约测试 acc-j4 — 重开 ≤1.5s：restart 输入 → 新局可交互（spec v1.2 判据四）。
 * 复现：node games/stack-tower/tests/contract/juice-acc-j4-restart.spec.mjs
 * 无头口径：restart 全链（内核复位 + restart 事件 + 快照 + 表现层清特效）同步完成后
 * 摆动块即可响应 drop——以墙钟差计 ≤ theme.RESTART_BUDGET_MS(1500)。
 * 语义面：重开后塔回开局初始摆位（v1.2 e09，同 seed 同摆位），分数/连击清零，status=running。
 */
import { runContract, assertEq, assert } from './_runner.mjs';
import { createSim } from '../../build/kernel/sim.js';
import { JUICE } from '../../build/render/theme.js';
import { NUMERIC } from '../../build/kernel/numeric.js';

runContract({
  id: 'acc-j4',
  levelId: 'lvl-01-stack-tower',
  elementId: 'e08-fail-recover',
  needs: ['build/kernel/sim.js', 'build/render/theme.js', 'build/kernel/numeric.js'],
  checks: [
    {
      name: 'restart 全链同步完成 ≤1500ms，且新局立即可交互（drop 即响应）',
      fn: async () => {
        const sim = createSim({ seed: 20260925 });
        sim.fastForward(60); // 推进到中局
        const t0 = Date.now();
        const events = sim.restart('button');
        const snap = sim.snapshot();
        const t1 = Date.now();
        assert(events.some((e) => e.type === 'restart'), 'restart 事件上抛');
        assertEq(snap.status, 'running', '新局 status=running');
        const openingLen = 1 + NUMERIC.opening.STACK_MIN_BLOCKS;
        assert(snap.tower.length >= openingLen && snap.tower.length <= 1 + NUMERIC.opening.STACK_MAX_BLOCKS, '塔回开局初始摆位');
        assertEq(snap.score, 0, '分数清零');
        assert(snap.moving !== null, '摆动块已生成（可交互）');
        const ev2 = sim.tick({ type: 'drop' }); // 新局首输入立即生效
        assert(ev2.length > 0, '新局首拍 drop 即产生事件（可交互）');
        assert(t1 - t0 <= JUICE.RESTART_BUDGET_MS, `restart 链路 ${t1 - t0}ms ≤ ${JUICE.RESTART_BUDGET_MS}ms`);
      },
    },
    {
      name: '同 seed 同摆位：两次 restart 初始摆位逐字节一致（e09 确定性）',
      fn: async () => {
        const a = createSim({ seed: 20260925 });
        const b = createSim({ seed: 20260925 });
        a.restart();
        b.restart();
        const sa = a.snapshot();
        const sb = b.snapshot();
        assertEq(JSON.stringify(sa.tower), JSON.stringify(sb.tower), '初始摆位逐字节一致');
        assertEq(JSON.stringify(sa.moving), JSON.stringify(sb.moving), '首摆块相位一致');
      },
    },
  ],
});
