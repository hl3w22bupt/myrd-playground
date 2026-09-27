/**
 * theme.js 单一常量源（实体 e-theme-constants，spec v1.2 acc-t1 契约锚点）。
 *
 * 纪律（spec world 规则 v1.2 追加条）：
 *  - render/audio/ui 全部视觉/音画/juice 常量只从本文件具名 import，另设字面量即违契约；
 *  - 内核数值唯一来源仍为 src/kernel/numeric.ts，两源互不越界；
 *  - 风格卡 A1「霓虹夜塔」v1.0（docs/style-card-neon-night-v1.md）为色值与光照唯一真源，改色先改卡。
 *
 * 导入形态：./theme.js（TS 源经 tsc 编译为同名 js；任务书口径「theme.js」即本模块）。
 */
/** 霓虹夜塔色板（风格卡 v1.0 §2；生成器解析本表取值，私设色值即拒生成） */
export const NEON = {
    /** 夜空渐变顶：深靛（a08-bg-night-gradient 上界） */
    NIGHT_SKY_TOP: '#0b1026',
    /** 夜空渐变底：暗青（a08 下界；垂直单向渐变） */
    NIGHT_SKY_BOTTOM: '#0d2b33',
    /** 塔块霓虹 6 色循环（a09..a14-block-skin-base-01..06） */
    BLOCK_NEON_01: '#00e5ff',
    BLOCK_NEON_02: '#ff2d95',
    BLOCK_NEON_03: '#ffb300',
    BLOCK_NEON_04: '#76ff03',
    BLOCK_NEON_05: '#b388ff',
    BLOCK_NEON_06: '#ff6d3a',
    /** 切面高亮：霓虹白（a15-fx-cut-face；发光填充，无描边） */
    CUT_FACE: '#ffffff',
    /** 塔身涟漪环（a16-fx-ripple-ring） */
    RIPPLE_RING: '#00e5ff',
    /** 完美命中辉光（a17-fx-perfect-glow） */
    PERFECT_GLOW: '#ffe57f',
    /** 主按钮（a18-ui-btn-primary） */
    UI_BTN_PRIMARY: '#00e5ff',
    /** HUD 面板底（a19-ui-panel-hud，半透明夜色） */
    UI_PANEL_HUD: '#060c1c',
    /** HUD 面板不透明度（alpha 通道，独立于色值便于查表） */
    UI_PANEL_HUD_ALPHA: 0.72,
    /** 声音开关图标（a20-ui-icon-sound） */
    UI_ICON_SOUND: '#9be7ff',
    /** 掉落碎块承载色（霓虹熄灭态：低明度蓝黑） */
    DEBRIS: '#141c26',
    /** 地平线（夜色线） */
    HORIZON: '#1b3a4a',
};
/** juice 时限（四判据预算，spec v1.2 acc-j1/j2/j3/j4；表现层常量，非内核数值） */
export const JUICE = {
    /** acc-j1 冷启动 → 首块可见 ≤3000ms */
    FIRST_BLOCK_BUDGET_MS: 3000,
    /** acc-j2 perfect 判定 tick → 涟漪首帧上屏 ≤100ms */
    JUICE_LATENCY_MS: 100,
    /** acc-j3 perfect_hit dispatch → AudioContext 播放调用 ≤50ms（QA 重定义口径） */
    AUDIO_DISPATCH_BUDGET_MS: 50,
    /** acc-j4 restart 输入 → 新局可交互 ≤1500ms */
    RESTART_BUDGET_MS: 1500,
};
/** 涟漪表现池（实体 e-ripple-renderer）：对象池上限，超龄/超额复用禁新建 */
export const RIPPLE_POOL_MAX = 200;
/** 涟漪合成与发光参数（Canvas2D additive；e-ripple-renderer 契约） */
export const RIPPLE_RENDER = {
    /** 合成模式：Canvas2D additive（lighter） */
    COMPOSITE: 'lighter',
    /** 环最大半径（逻辑像素，相对块宽的倍数） */
    MAX_RADIUS_SCALE: 2.2,
    /** 起始透明度（随生命周期线性衰减） */
    START_ALPHA: 0.55,
    /** 环线宽（逻辑像素；发光填充形态，非描边语义） */
    RING_WIDTH: 6,
};
/** 光照（风格卡 v1.0 §3：霓虹自发光体，无环境顶光——三面明度差收窄为 100:88:76） */
export const LIGHT = {
    TOP: 1,
    MID: 0.88,
    BOTTOM: 0.76,
};
/** 块皮循环：渲染按 yIndex 取 NEON 六色（a09..a14 同源） */
export const BLOCK_NEON_CYCLE = [
    NEON.BLOCK_NEON_01,
    NEON.BLOCK_NEON_02,
    NEON.BLOCK_NEON_03,
    NEON.BLOCK_NEON_04,
    NEON.BLOCK_NEON_05,
    NEON.BLOCK_NEON_06,
];
