// e-kernel-loop — mulberry32 seededRng + fixed-step 累计推进（承 wheat-squad 判例平移）
// spec: entities/e-kernel-loop · 零 Math.random/Date.now（确定性战局的根）
export const FIXED_STEP_MS = 16; // 镜像 spec.numeric.FIXED_STEP_MS（实现轮以 loadSpecRow 单源对账）
export const DEFAULT_SEED = 20261016; // 镜像 spec.numeric.DEFAULT_SEED
export function seededRng(seed: number): () => number {
  // mulberry32 —— 实现轮落实现；本占位仅钉接口形状
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
