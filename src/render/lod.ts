/**
 * render/lod —— 实体 LOD 分级（性能红线：60FPS；降 draw call / 降远处几何开销）。
 * 纯 TS、零 three 依赖，可在 Node 下直接断言（tests/lod.spec.ts）。
 *
 * 分级策略（与相机距离，阈值来自画质档位 QUALITY_PRESETS）：
 *   dist <  lodDetailFar  → full   （躯干 + 头 + 枪，近景细节全开）
 *   dist ∈ [lodDetailFar, lodCullFar) → simple（仅躯干低模，隐藏头/枪高频小件）
 *   dist >= lodCullFar    → off    （整体剔除，不产生 draw call）
 */

import type { QualityPreset } from './quality';

export type EntityLodLevel = 'full' | 'simple' | 'off';

export interface EntityLodSettings {
  /** 躯干（胶囊低模）是否可见 */
  body: boolean;
  /** 头部（球体高细节）是否可见 */
  head: boolean;
  /** 朝向指示枪（小长方体）是否可见 */
  gun: boolean;
}

/** 依相机距离与画质档位选择实体 LOD 等级。距离为负按 0 处理（同一实体/相机重叠）。 */
export function pickEntityLod(distM: number, preset: QualityPreset): EntityLodLevel {
  const d = Math.max(0, distM);
  if (d >= preset.lodCullFar) return 'off';
  if (d >= preset.lodDetailFar) return 'simple';
  return 'full';
}

/** LOD 等级 → 各部件显隐；'off' 全部不可见（由调用方同时隐藏整个 group）。 */
export function entityLodSettings(level: EntityLodLevel): EntityLodSettings {
  switch (level) {
    case 'full':
      return { body: true, head: true, gun: true };
    case 'simple':
      return { body: true, head: false, gun: false };
    case 'off':
      return { body: false, head: false, gun: false };
  }
}

/**
 * 同档位下 LOD 是否应当应用：仅当实体不是玩家本人（玩家相机始终近距跟随，不应被剔除），
 * 且实体处于可渲染状态（存活、非机内）。返回 true 表示「走 LOD 分级」。
 */
export function shouldApplyEntityLod(isPlayer: boolean): boolean {
  return !isPlayer;
}
