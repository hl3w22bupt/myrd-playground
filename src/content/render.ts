/**
 * content/render —— 渲染性能配置表（性能红线数值唯一来源，禁止在 render/app 层硬编码同类数值）。
 * 仅约束表现层（render/app/ui），不影响仿真核心：改数值不改变玩法逻辑与确定性。
 */

/**
 * 同屏可见实体上限（表现层裁剪）。
 * 取值 = 实体上限 ENTITY_CAP（= 20 = 玩家 1 + aiCount 最大可选 19）：
 * 开始画面允许 aiCount ∈ [10, 19]，上限必须覆盖整个可选区间——任何 aiCount 下都不隐藏实体，
 * 画面表现与裁剪前完全一致（裁剪机制保留，仅当未来实体上限扩大时自动生效，按与玩家距离就近优先）。
 */
export const MAX_VISIBLE_ENTITIES = 20;

/** 实体视图对象池容量（= 实体上限 ENTITY_CAP；池满即封顶，运行期不再创建/销毁视图对象） */
export const ENTITY_VIEW_POOL_SIZE = 20;

/**
 * 小地图刷新频率（Hz）：低频 UI 层，画布内容（安全区/下一圈/航线/玩家方位）不变，
 * 仅降低 Canvas2D 重绘频率（60 → 20Hz，人眼不可感知差异），消除每帧全量重绘。
 */
export const MINIMAP_UPDATE_HZ = 20;

/** 调试 HUD 文案刷新频率（Hz）：字符串拼接与 DOM 写入降频 */
export const DEBUG_TEXT_HZ = 4;

/** 性能采样统计窗口（帧数）：环形缓冲，约 5s @60FPS */
export const PERF_WINDOW_FRAMES = 300;

/** 性能采样计算频率（Hz）：帧统计（排序/均值）降频计算，避免每帧 [...frames].sort() */
export const PERF_SAMPLE_HZ = 4;

/** 弹道拖尾对象池容量（子弹可视化走池，封顶后零分配） */
export const TRACER_POOL_SIZE = 24;

/** 枪口火焰对象池容量 */
export const FLASH_POOL_SIZE = 8;

/** 命中粒子固定缓冲容量（Float32Array 预分配，循环覆写） */
export const HIT_PARTICLE_COUNT = 240;

/** 缩圈脉冲冲击波对象池容量 */
export const PULSE_POOL_SIZE = 4;

/** 毒圈边缘粒子带固定缓冲容量（Float32Array 预分配，循环覆写） */
export const ZONE_PARTICLE_COUNT = 200;

/**
 * 画质档 → 画面细节档位（AC2 观感与 60FPS 红线的平衡点，数值唯一来源）。
 * 背景：本地帧率基准复测发现，天空穹顶/云层/太阳光晕/植被/毒圈粒子带是
 * 「按档位无关」的固定 draw call，在低档（软光栅/低端集显）上每 draw 开销被放大，
 * 且与已有场景叠加后超出 60FPS 预算 → 必须按档位门控：
 * - low：只保留 AC2 必需项（地形/建筑纹理、方向光+雾、战斗/缩圈粒子、HUD），
 *   天空用地平线纯色背景 + 雾过渡（不损失 AC2②距离层次）。
 * - medium/high：完整天空穹顶 + 云层 + 太阳光晕 + 植被点缀。
 * 本表只影响表现层，不触碰仿真核心（确定性不受影响）。
 */
export interface VisualDetailPreset {
  /** 天空穹顶（渐变 + 太阳方位层次） */
  skyDome: boolean;
  /** 云层 sprite */
  clouds: boolean;
  /** 太阳光晕 sprite */
  sunGlow: boolean;
  /** 树木实例数 */
  trees: number;
  /** 草丛实例数 */
  grass: number;
  /** 毒圈边缘粒子带预算（0 = 关闭；上限 ZONE_PARTICLE_COUNT） */
  zoneParticles: number;
}

export const VISUAL_DETAIL: Record<'low' | 'medium' | 'high', VisualDetailPreset> = {
  low: { skyDome: false, clouds: false, sunGlow: false, trees: 80, grass: 140, zoneParticles: 0 },
  medium: { skyDome: true, clouds: true, sunGlow: true, trees: 220, grass: 620, zoneParticles: ZONE_PARTICLE_COUNT },
  high: { skyDome: true, clouds: true, sunGlow: true, trees: 300, grass: 900, zoneParticles: ZONE_PARTICLE_COUNT },
};
