#!/usr/bin/env node
/**
 * 契约测试 lvl-01-stack-tower/e07-score-hud（spec: ac-lvl01-e07-score）
 * 复现：node games/stack-tower/tests/contract/lvl-01-stack-tower_e07-score-hud.spec.mjs
 * 断言：place=+10；perfect 连击 1/2/3 次 bonus=25/30/35（step 5、cap 75）；
 *       HUD 格式化输出与内核状态一致；NUMERIC 与 spec 基线一一对应（数值总闸）。
 */
import { runContract, assertEq, assert, assertApproxEq, loadSpec, stableStringify } from './_runner.mjs';

function dropAtFirstHit(h, thresh) {
  for (let i = 0; i < 400; i++) {
    h.fastForward(1);
    const s = h.snapshot();
    if (Math.abs(s.moving.x - s.tower[s.tower.length - 1].x) <= thresh) break;
  }
  return h.tick({ type: 'drop' });
}

runContract({
  id: 'ac-lvl01-e07-score',
  levelId: 'lvl-01-stack-tower',
  elementId: 'e07-score-hud',
  needs: ['build/kernel/sim.js', 'build/kernel/numeric.js', 'build/ui/hud.js'],
  checks: [
    {
      name: '非 perfect 落块 +10',
      fn: async ({ 'build/kernel/sim.js': sim, 'build/kernel/numeric.js': num }) => {
        const h = sim.createSim({ seed: 20260925 });
        // 走到 |offset|∈(22.4, 120) 的非 perfect 但可保留时机
        let ok = false;
        for (let i = 0; i < 400; i++) {
          h.fastForward(1);
          const s = h.snapshot();
          const off = Math.abs(s.moving.x - s.tower[s.tower.length - 1].x);
          if (off > num.perfectDistance(1) + 2.6 && off < 100) {
            ok = true;
            break;
          }
        }
        assert(ok, '未找到非 perfect 可落时机');
        h.tick({ type: 'drop' });
        assertEq(h.snapshot().score, 10, '普通落块得分');
      },
    },
    {
      name: 'perfect 连击 1/2/3：累计分 = 35 / 75 / 120（bonus 25/30/35）',
      fn: async ({ 'build/kernel/sim.js': sim, 'build/kernel/numeric.js': num }) => {
        const h = sim.createSim({ seed: 20260925 });
        const expected = [35, 75, 120];
        const got = [];
        for (let n = 0; n < 3; n++) {
          dropAtFirstHit(h, num.perfectDistance(1));
          got.push(h.snapshot().score);
          assertEq(h.snapshot().combo, n + 1, `第 ${n + 1} 连击 combo`);
        }
        assertEq(JSON.stringify(got), JSON.stringify(expected), '三连 perfect 累计分');
      },
    },
    {
      name: 'HUD 格式化与内核状态一致（score/combo/level/进度）',
      fn: async ({ 'build/kernel/sim.js': sim, 'build/ui/hud.js': hud }) => {
        assert(typeof hud.formatHud === 'function', 'build/ui/hud.js 应导出 formatHud(snap)');
        const h = sim.createSim({ seed: 20260925 });
        h.fastForward(50);
        const snap = h.snapshot();
        const view = hud.formatHud(snap);
        assertEq(view.score, snap.score, 'HUD score');
        assertEq(view.combo, snap.combo, 'HUD combo');
        assertEq(view.level, snap.level, 'HUD level');
      },
    },
    {
      name: '数值总闸：NUMERIC 与 spec 基线 numeric 深度一致（键序无关）',
      fn: async ({ 'build/kernel/numeric.js': num }) => {
        // M2.1 起基线 = .myrd/spec/stack-tower-spec.json（v3 approved）；平台入库会归一化对象键序，
        // 故总闸语义 = 结构 + 数值等价（键序无关深比），锁死数值与结构，不锁书写顺序。
        const spec = loadSpec();
        const specNumeric = spec.spec.numeric;
        assertEq(stableStringify(num.NUMERIC), stableStringify(specNumeric), 'NUMERIC 与 spec.numeric 不一致——改数值必须先升策划案版本');
      },
    },
  ],
});
