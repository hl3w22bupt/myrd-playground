#!/usr/bin/env node
/**
 * 契约测试 acc-j3 — 音画 ≤50ms（spec v1.2 判据三，采纳 QA 重定义）：
 *   perfect_hit dispatch（事件进入翻译站）→ AudioContext 播放调用（play 调用点，非实际出声）≤ 50ms。
 * 复现：node games/stack-tower/tests/contract/juice-acc-j3-audio-dispatch.spec.mjs
 * 无头口径：boot(platform 替身) 驱动固定步长帧回调；dispatch/play 取同一注入时钟；
 * spy audio 记录 play 调用时刻，telemetrySink 捕获 perfect_hit 双毫秒，判据 = 差值 ≤ theme 预算。
 * 闸门语义：play 调用发生在 dispatch 同步窗口内（闸门不得吞掉或延后首次出声，acc-a7 衔接）。
 */
import { runContract, assertEq, assert } from './_runner.mjs';
import { boot } from '../../build/app/main.js';
import { createSilentAudioManager } from '../../build/app/main.js';
import { JUICE } from '../../build/render/theme.js';

/** 最小 platform 替身：注入时钟 + 可手动驱动帧回调 + 可编程输入通道 */
function fakePlatform() {
  let t = 0;
  let frameCb = null;
  let intentCb = null;
  return {
    clock: { now: () => t },
    canvas: null, // 无头：跳过真实绘制
    audioManager: null, // boot 内替换
    input: { onIntent(cb) { intentCb = cb; return () => (intentCb = null); } },
    assets: null,
    /** 测试驱动：推时间 + 执行一帧 */
    step(deltaMs) {
      t += deltaMs;
      if (frameCb) frameCb(t);
    },
    drop() {
      if (intentCb) intentCb({ type: 'drop' });
    },
    set audio(m) {
      this.audioManager = m;
    },
    onNextFrame(cb) {
      frameCb = cb;
      return () => (frameCb = null);
    },
  };
}

/** spy 音频：包一层静音管理器，记录 play 调用（调用点毫秒 = 当前注入时钟） */
function spyAudio(inner, now) {
  const calls = [];
  return {
    inner,
    calls,
    play(name, semis) {
      calls.push({ name, at: now() });
      return inner.play(name, semis);
    },
    isMuted: () => inner.isMuted(),
    toggleMute: () => inner.toggleMute(),
    dispose: () => inner.dispose(),
  };
}

runContract({
  id: 'acc-j3',
  levelId: 'lvl-01-stack-tower',
  elementId: 'e06-tower-ripple',
  needs: ['build/app/main.js', 'build/render/theme.js'],
  checks: [
    {
      name: 'perfect_hit：dispatch→play ≤50ms（同同步窗口，闸门零吞延）',
      fn: async () => {
        const platform = fakePlatform();
        const inner = createSilentAudioManager();
        const audio = spyAudio(inner, platform.clock.now);
        platform.audio = audio;
        const payloads = [];
        const session = boot(platform, { seed: 20260925, telemetrySink: (p) => payloads.push(p) });
        platform.step(16); // 首帧：摆块自塔顶中轴入画（offset=0 相位）
        platform.drop(); // 首拍即 perfect（e05 必改①：开局第 1 次输入存在可命中窗口）
        platform.step(16); // 翻译站消费意图（tick 起点生效）
        const hit = payloads.find((p) => p.event === 'perfect_hit');
        assert(hit, 'perfect_hit 已入埋点');
        assert(typeof hit.dispatch_ms === 'number' && typeof hit.play_ms === 'number', '双毫秒齐备');
        const delta = hit.play_ms - hit.dispatch_ms;
        assert(delta >= 0, 'play 不早于 dispatch');
        assert(delta <= JUICE.AUDIO_DISPATCH_BUDGET_MS, `音画 ${delta}ms ≤ ${JUICE.AUDIO_DISPATCH_BUDGET_MS}ms`);
        const perfectPlay = audio.calls.find((c) => c.name === 'perfect');
        assert(perfectPlay, 'play 调用点真实发生（perfect）');
        session.dispose();
      },
    },
    {
      name: '闸门不吞音：play 调用次数 = perfect 事件数（零延后零丢弃）',
      fn: async () => {
        const platform = fakePlatform();
        const inner = createSilentAudioManager();
        const audio = spyAudio(inner, platform.clock.now);
        platform.audio = audio;
        const payloads = [];
        const session = boot(platform, { seed: 20260925, telemetrySink: (p) => payloads.push(p) });
        platform.step(16);
        platform.drop();
        platform.step(16);
        const hits = payloads.filter((p) => p.event === 'perfect_hit').length;
        const perfects = audio.calls.filter((c) => c.name === 'perfect').length;
        assertEq(perfects, hits, 'perfect play 调用数 = perfect_hit 事件数');
        assert(perfects >= 1, '至少一次 perfect 出声调用');
        session.dispose();
      },
    },
  ],
});
