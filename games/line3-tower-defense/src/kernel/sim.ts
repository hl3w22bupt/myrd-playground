// e-kernel-sim — stepSim 纯函数步进（敌军推进×索敌开火×命中×经济×漏怪，全可机判）
// spec: entities/e-kernel-sim · 占位：接口形状钉死，实现轮填充；禁 Math.random/Date.now
export interface SimState { tick: number; gold: number; coreLives: number; waveIndex: number; status: "running" | "victory" | "defeat"; }
export const VICTORY_WAVES = 8; // 镜像 spec.numeric.victoryWaves
export function stepSim(state: SimState): SimState {
  throw new Error("NOT-IMPLEMENTED: spec v1.0 approved 后实现轮交付（占位不写玩法）");
}
