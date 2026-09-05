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

// ———————————————————— LOD / 后处理 / 降频（本次叠加：画质光照后处理 + LOD 合批对象池优化） ————————————————————

/** 植被分块边长（m）：地形 1600m / 160 = 10×10 = 100 块；分块是距离 LOD 剔除的最小单位 */
export const VEG_CHUNK_SIZE = 160;

/** 草丛可见距离（m）：超过即整块隐藏（远草无视觉贡献，纯粹省 GPU） */
export const GRASS_LOD_DISTANCE = 170;

/** 树可见距离（m）：超过即整块隐藏（树冠在雾中已不可辨） */
export const TREE_LOD_DISTANCE = 560;

/** 植被块可见性刷新频率（Hz）：块开关无需逐帧决策，降频消除每帧距离计算 */
export const VEG_LOD_UPDATE_HZ = 10;

/** 物资浮动动画与矩阵上传频率（Hz）：60→20Hz，消除每帧 256 实例矩阵全量 GPU 上传 */
export const LOOT_ANIM_HZ = 20;

/** 阴影贴图更新频率（Hz）：静态场景 + 少量动态实体，60→20Hz 重绘阴影不可感知，省 2/3 阴影 pass */
export const SHADOW_UPDATE_HZ = 20;

/** 后处理渲染目标分辨率缩放（medium 档降采样，high 档 1.0 全分辨率） */
export const POSTFX_SCALE_MEDIUM = 0.75;

/** 后处理 MSAA 采样数（high 档 4x；medium/low 0=关闭，由后处理 shader 的轻量 AA 兜底） */
export const POSTFX_MSAA_HIGH = 4;

/** 后处理暗角强度 0..1（画面质感：边缘压暗聚焦视线） */
export const POSTFX_VIGNETTE = 0.32;

/** 后处理饱和度增益（1 = 原样；>1 轻微提饱和，画面更通透） */
export const POSTFX_SATURATION = 1.08;

/** 后处理对比度增益（1 = 原样；>1 轻微提对比，明暗层次更强） */
export const POSTFX_CONTRAST = 1.05;
