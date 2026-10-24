// kernel/loop.ts — 单局制确定性内核骨架（line4-unblock-jam · 中性脚手架）
//
// 纪律（三线判例）：零 Math.random / 零 Date.now / 零平台 import——随机走注入 seeded Rng，
// 时间走 fixed-step 累计；同 seed 同输入 → 逐字节一致。
// 单局制（spec world.sceneSpec）：一局 = 一关，ready → running → ended 终局即止（重开=新局新 seed）。
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
  elapsedMs: number;
  seed: number;
}

export interface StepInput { advance: boolean; }

/** fixed-step 步进（FIXED_STEP_MS=16，spec numeric 冻结值）：advance=false 只累计不推进 */
export function step(state: KernelState, stepMs: number, input: StepInput): KernelState {
  if (state.phase !== 'running' || !input.advance) return state;
  return { ...state, tick: state.tick + 1, elapsedMs: state.elapsedMs + stepMs };
}

export function createSession(seed: number): KernelState {
  return { phase: 'ready', tick: 0, elapsedMs: 0, seed };
}

export function start(state: KernelState): KernelState {
  return { ...state, phase: 'running' };
}

export function end(state: KernelState): KernelState {
  return { ...state, phase: 'ended' };
}
