#!/usr/bin/env node
/**
 * 契约测试 lvl-01-stack-tower/e06-tower-ripple（spec: ac-lvl01-e06-ripple）
 * 复现：node games/stack-tower/tests/contract/lvl-01-stack-tower_e06-tower-ripple.spec.mjs
 * 断言（tower-ripple 事件契约，T1 必改②）：
 *   perfect 同 tick 上抛；载荷恰 {level_id, element_id, window_ms, duration_ms} 四字段；
 *   window_ms=140（本关实际窗口）；duration_ms∈[250,350]（默认 300）；
 *   不存在整屏 aha/闪屏通道（事件无 screen-flash 语义字段）。
 */
import { runContract, assertEq, assert, assertInRange } from './_runner.mjs';

/** 快进到首个命中 tick 并 drop，返回该 tick 的事件 */
function dropAtFirstHit(h, thresh) {
  for (let i = 0; i < 400; i++) {
    h.fastForward(1);
    const s = h.snapshot();
    if (Math.abs(s.moving.x - s.tower[s.tower.length - 1].x) <= thresh) break;
  }
  return h.tick({ type: 'drop' });
}

runContract({
  id: 'ac-lvl01-e06-ripple',
  levelId: 'lvl-01-stack-tower',
  elementId: 'e06-tower-ripple',
  needs: ['build/kernel/sim.js', 'build/kernel/numeric.js'],
  checks: [
    {
      name: 'perfect 同 tick 上抛恰 1 个 tower-ripple',
      fn: async ({ 'build/kernel/sim.js': sim, 'build/kernel/numeric.js': num }) => {
        const h = sim.createSim({ seed: 20260925 });
        const events = dropAtFirstHit(h, num.perfectDistance(1));
        const ripples = events.filter((e) => e.type === 'tower-ripple');
        assertEq(ripples.length, 1, 'drop tick 内 tower-ripple 事件数');
      },
    },
    {
      name: '载荷恰四字段且类型正确',
      fn: async ({ 'build/kernel/sim.js': sim, 'build/kernel/numeric.js': num }) => {
        const h = sim.createSim({ seed: 20260925 });
        const [e] = dropAtFirstHit(h, num.perfectDistance(1)).filter((x) => x.type === 'tower-ripple');
        assert(e, 'tower-ripple 缺失');
        assertEq(
          JSON.stringify(Object.keys(e).sort()),
          JSON.stringify(['duration_ms', 'element_id', 'level_id', 'type', 'window_ms'].sort()),
          '字段集合（type 为事件判别字段，业务载荷恰四字段，多一字段少一字段都不合格）',
        );
        for (const k of ['level_id', 'element_id']) assert(typeof e[k] === 'string' && e[k].length > 0, `${k} 应为非空 string`);
        for (const k of ['window_ms', 'duration_ms']) assert(typeof e[k] === 'number' && Number.isFinite(e[k]), `${k} 应为有限 number`);
        assertEq(e.level_id, 'lvl-01-stack-tower', 'level_id');
        assertEq(e.element_id, 'e06-tower-ripple', 'element_id');
      },
    },
    {
      name: 'window_ms=本关实际判定窗口(140)；duration_ms∈[250,350]（默认 300）',
      fn: async ({ 'build/kernel/sim.js': sim, 'build/kernel/numeric.js': num }) => {
        const h = sim.createSim({ seed: 20260925 });
        const [e] = dropAtFirstHit(h, num.perfectDistance(1)).filter((x) => x.type === 'tower-ripple');
        assertEq(e.window_ms, num.perfectWindowMs(1), 'window_ms 应=perfectWindowMs(1)');
        assertEq(e.window_ms, 140, 'window_ms 与 spec 数值');
        assertInRange(e.duration_ms, 250, 350, 'duration_ms 合法区间');
        assertEq(e.duration_ms, 300, 'duration_ms 名义值');
      },
    },
    {
      name: '必改②：无整屏 aha/闪屏通道（事件不含 screen-flash 语义字段）',
      fn: async ({ 'build/kernel/sim.js': sim, 'build/kernel/numeric.js': num }) => {
        const h = sim.createSim({ seed: 20260925 });
        for (const e of dropAtFirstHit(h, num.perfectDistance(1))) {
          const keys = Object.keys(e);
          for (const banned of ['screen_flash', 'screenFlash', 'flash', 'aha', 'fullscreen', 'overlay']) {
            assert(!keys.includes(banned), `事件携带被禁字段: ${banned}（违反 aha 降维）`);
          }
        }
        assert(true, '无闪屏语义字段');
      },
    },
  ],
});
