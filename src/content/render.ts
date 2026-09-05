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

// ———————————————————— 画面升级步：后处理 / LOD / 合批 / 地形段数 ————————————————————

/** 画质档位（与 render/quality 的 QualityLevel 字面量保持一致；content 不依赖 render，故在此重复字面量） */
export type RenderQualityLevel = 'low' | 'medium' | 'high';

/**
 * Bloom 后处理参数（按画质档位）。
 * low 档关闭：最低档以帧预算优先（稳定 60FPS 红线），后处理 pass 不进入渲染循环。
 * strength：泛光强度；radius：泛光扩散半径；threshold：亮度提取阈值（0..1，越高越只有高光泛光）。
 */
export const BLOOM_BY_QUALITY: Record<RenderQualityLevel, { enabled: boolean; strength: number; radius: number; threshold: number }> = {
  low: { enabled: false, strength: 0, radius: 0, threshold: 1 },
  medium: { enabled: true, strength: 0.42, radius: 0.55, threshold: 0.8 },
  high: { enabled: true, strength: 0.68, radius: 0.7, threshold: 0.72 },
};

/**
 * 实体 LOD 距离阈值（按画质档位，单位 m，与玩家距离）。
 * 距离 < nearDist → 完整模型（躯干+头+枪）；< midDist → 中等（躯干+头）；≥ midDist → 极简（仅躯干）。
 * low 档阈值更激进（更早降级），把顶点预算留给帧时间。
 */
export const ENTITY_LOD_BY_QUALITY: Record<RenderQualityLevel, { enabled: boolean; nearDist: number; midDist: number }> = {
  low: { enabled: true, nearDist: 46, midDist: 120 },
  medium: { enabled: true, nearDist: 70, midDist: 180 },
  high: { enabled: true, nearDist: 92, midDist: 240 },
};

/**
 * 实体合批后的部件 mesh 数（躯干 / 头 / 枪 各 1 个 InstancedMesh）。
 * 合批不变量：同屏全部实体的绘制固定为该数量 draw call，与实体数无关（池容量 ≤ ENTITY_CAP）。
 */
export const ENTITY_BATCH_MESH_COUNT = 3;

/** 地形网格段数（按画质档位）：段数越大越贴合高度场，三角形数 ≈ 段数² × 2 */
export const TERRAIN_SEGMENTS_BY_QUALITY: Record<RenderQualityLevel, number> = {
  low: 84,
  medium: 112,
  high: 140,
};
