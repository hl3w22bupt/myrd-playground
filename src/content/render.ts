/**
 * content/render —— 渲染性能配置表（性能红线数值唯一来源，禁止在 render/app 层硬编码同类数值）。
 * 仅约束表现层（render/app/ui），不影响仿真核心：改数值不改变玩法逻辑与确定性。
 */

/**
 * 同屏可见实体上限（表现层裁剪）。
 * 取值 > 标准场景实体数（玩家 1 + AI 12 = 13），标准场景下所有实体可见、画面不变；
 * 仅当存活实体数超过该上限时按「与玩家距离就近优先」隐藏最远的实体，防止远处实体拖垮填充率。
 */
export const MAX_VISIBLE_ENTITIES = 16;

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
