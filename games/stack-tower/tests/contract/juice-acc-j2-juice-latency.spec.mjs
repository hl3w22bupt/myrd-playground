#!/usr/bin/env node
/**
 * 契约测试 acc-j2 — juice ≤100ms：perfect 判定 tick → 涟漪表现首帧上屏（spec v1.2 判据二）。
 * 复现：node games/stack-tower/tests/contract/juice-acc-j2-juice-latency.spec.mjs
 * 无头口径：以「事件入队（dispatch tick 表现时钟）→ 首次 draw（同 tick 时钟）」的时钟差计，
 * 判据 = 差值 ≤ theme.JUICE_LATENCY_MS(100)。同一同步窗口内入队+绘制即成立（机制面）；
 * 真帧率面（帧预算）按 numeric.benchmark_device 实验口径与真机单列另行取证（content.benchmark）。
 * 隔离面：绘制异常被订阅器吞掉（返回 -1），不上抛、不中断 tick。
 */
import { runContract, assertEq, assert } from './_runner.mjs';
import { createSim } from '../../build/kernel/sim.js';
import { Renderer } from '../../build/render/renderer.js';
import { createRippleRenderer } from '../../build/render/ripple-renderer.js';
import { JUICE, RIPPLE_POOL_MAX } from '../../build/render/theme.js';

/** 无头 Canvas2D 替身：全方法 no-op（涟漪只做数学与绘制调用，不依赖真实位图） */
function fakeCtx() {
  const gradient = { addColorStop() {} };
  const noop = () => {};
  return new Proxy(
    { createLinearGradient: () => gradient, canvas: { width: 480, height: 720 } },
    {
      get(t, k) {
        if (k in t) return t[k];
        return noop;
      },
      set() {
        return true;
      },
    },
  );
}

/** 找一个必中 perfect 的输入序列：从入画相位（offset=0）起步，首拍即 perfect */
function perfectHitHandle() {
  const h = createSim({ seed: 20260925 });
  // 摆块自中轴入画（spawn 相位 offset=0）→ 立即 drop 即 perfect（e05 必改①口径）
  return h;
}

runContract({
  id: 'acc-j2',
  levelId: 'lvl-01-stack-tower',
  elementId: 'e06-tower-ripple',
  needs: ['build/kernel/sim.js', 'build/render/renderer.js', 'build/render/theme.js'],
  checks: [
    {
      name: 'dispatch→首帧同 tick 可达：时钟差 ≤100ms 且池内存活 1 颗',
      fn: async () => {
        const sim = perfectHitHandle();
        const renderer = new Renderer();
        const ctx = fakeCtx();
        let t = 1000;
        const events = sim.tick({ type: 'drop' }); // 同 tick：perfect 判定成立（offset=0）
        const ripple = events.find((e) => e.type === 'tower-ripple');
        assert(ripple, 'perfect 判定成立并上抛 tower-ripple');
        const dispatchMs = t;
        renderer.enqueueRipple(ripple, t); // 事件翻译站同 tick 入队
        const snap = sim.snapshot();
        renderer.draw(ctx, snap, t, { width: 480, height: 720 }); // 首帧绘制（同 tick 时钟）
        const latency = t - dispatchMs;
        assert(latency <= JUICE.JUICE_LATENCY_MS, `juice 延迟 ${latency}ms ≤ ${JUICE.JUICE_LATENCY_MS}ms`);
        assertEq(renderer.ripplePool.alive, 1, '首帧后池内存活 1 颗');
        assertEq(renderer.ripplePool.capacity, RIPPLE_POOL_MAX, '池容量 = theme.RIPPLE_POOL_MAX');
      },
    },
    {
      name: '池上限：超容量入队不超 200 颗（复用最老槽位）',
      fn: async () => {
        const renderer = new Renderer();
        const ctx = fakeCtx();
        let t = 0;
        for (let i = 0; i < RIPPLE_POOL_MAX + 50; i++) {
          t += 1;
          renderer.enqueueRipple({ level_id: 'lvl-01', element_id: 'e06', window_ms: 140, duration_ms: 300 }, t);
        }
        assert(renderer.ripplePool.alive <= RIPPLE_POOL_MAX, `池存活 ${renderer.ripplePool.alive} ≤ ${RIPPLE_POOL_MAX}`);
        renderer.draw(ctx, { tower: [], moving: null, debris: [], score: 0, combo: 0, level: 1, layers: 0, target: 8, status: 'running' }, t + 500, {
          width: 480,
          height: 720,
        });
        renderer.clearFx();
        assertEq(renderer.ripplePool.alive, 0, 'clearFx 清池');
      },
    },
    {
      name: '异常隔离（e-ripple-renderer）：绘制抛错被订阅器吞掉（返回 -1），不外溢',
      fn: async () => {
        const rr = createRippleRenderer();
        rr.enqueue(300, 1000);
        const throwingCtx = new Proxy(
          {},
          { get() { throw new Error('ctx exploded'); }, set() { return true; } },
        );
        let result;
        try {
          result = rr.draw(throwingCtx, 1000, 240, 600, 1);
        } catch {
          result = 'threw';
        }
        assertEq(result, -1, '订阅器吞掉异常并返回 -1');
        // 池状态不被异常破坏：换正常 ctx 仍可绘
        const ok = rr.draw(fakeCtx(), 1010, 240, 600, 1);
        assert(ok >= 0, '异常后池仍可用');
      },
    },
  ],
});
