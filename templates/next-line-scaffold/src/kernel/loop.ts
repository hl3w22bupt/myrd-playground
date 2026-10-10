// kernel/loop.ts — 确定性内核骨架（新线脚手架空壳 · 预置件①）
//
// 纪律：零 Math.random / 零 Date.now / 零平台 import——一切随机走注入的 seeded Rng，
// 一切时间走 fixed step 累计。同 seed 同输入 → 逐字节一致（契约模板 ac-template 断言此性）。
export interface Rng { next(): number; }

export function seededRng(seed: number): Rng {
  // mulberry32（判例承自 g2-blocks ac-14）
  let a = seed >>> 0;
  return {
    next() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

export type Phase = 'ready' | 'running' | 'ended';

export interface KernelState {
  phase: Phase;
  tick: number;
  score: number;
  seed: number;
}

export interface StepInput { advance: boolean; gain: number; }

/** fixed-step 内核：advance=false 只累计不推进（表现层暂停语义）；gain 为本步得分增量 */
export function step(state: KernelState, input: StepInput): KernelState {
  if (state.phase !== 'running' || !input.advance) return state;
  const tick = state.tick + 1;
  return { ...state, tick, score: state.score + input.gain };
}

export function createKernel(seed: number): KernelState & { steps: number } {
  return { phase: 'ready', tick: 0, score: 0, seed, steps: 0 };
}

export function start(state: KernelState): KernelState {
  return { ...state, phase: 'running' };
}
