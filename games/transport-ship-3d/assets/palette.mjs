// palette.mjs — 风格卡（.myrd/blackboard/assets.md）的代码镜像：调色板 / 光照 / 线条 / 比例 四要素唯一真源。
//
// 纪律（美术红线）：
//   · 所有资产（贴图 / 材质 / 天空 / HUD / 特效）只准从这里取色取比例；
//   · 逐资产另编色值 = 风格漂移，按缺陷处理（同一游戏里混风格不可接受）；
//   · 依据 = 复刻样本《运输船 · 穿越火线 3D》渲染层拆解 + qa-crosscheck Q7（曝光 0.95 / 逆光补光）口径。
//   · 本文件是纯数据（零 import），坏了也不该拖垮游戏 —— 消费方一律走 assets/index.mjs 的 safe() 包裹。

export const PALETTE = {
  // ─────────────── ① 调色板 ───────────────
  // 冷灰金属舰体（主基调）+ 军绿/土黄集装箱 + 暖橙警示件。
  hull: {
    base: 0x6b7480,     // 舰体主色（风格卡基准色）
    plate: 0x69737f,    // 金属板面
    shadow: 0x59616b,   // 甲板 / 暗面
    deep: 0x4a525b,     // 斜筋 / 阴刻
    rivet: 0x6c757f,    // 铆钉高光
    rust: 0x7a5434,     // 锈渍（低透明度叠加）
    wing: 0x707a86,     // 舰桥附舱
    glass: 0x1d2b33,        // 舰桥窗带玻璃
    glassEmissive: 0x35505c, // 舰桥窗带自发光（黄昏室内灯）
    steel: 0x5f6870,        // 栏杆/构架钢件
  },
  container: {
    green: 0x5a6b4a,    // 军绿集装箱（风格卡）
    tan: 0x7a6a4a,      // 土黄集装箱（风格卡）
  },
  warning: {
    orange: 0xc9762e,   // 暖橙警示件（风格卡）：吊臂 / 消焰器环 / 警示条
    deep: 0xb0622a,     // 吊臂钢构暗面
  },
  soldier: {
    camoBase: 0x5c6247, camoDark: 0x454b36, camoLight: 0x6d6a4e, camoShadow: 0x33382a,
    skin: 0x8a6a52,
    gear: 0x2f3328,     // 战术背心 / 头盔 / 枪
  },
  rifle: { dark: 0x2a2d31, mid: 0x3c4147, grip: 0x24262a },
  sky: {
    top: 0x2e4a63,      // 天顶（黄昏蓝）
    horizon: 0xe2b58a,  // 地平线暖霞
    bottom: 0x0d1c26,   // 天底（海面以下）
    sun: 0xffe6c2,      // 太阳盘/光晕叠色
    fog: 0x8fa4ae,      // 海雾
  },
  sea: {
    base: 0x17303a,     // 深蓝绿水体
    glitz: "150,200,210", // 波光横纹（rgb 串，配透明度用）
    tint: 0x9fb6bd,     // 材质 tint
  },
  fx: {
    muzzle: 0xffc46a,   // 枪口火光
    impact: 0xffb277,   // 命中火花
    hitFlash: 0xff5a3c, // 受击闪白（与 HUD danger 同源）
  },
  hud: {
    // HUD 与世界同一张色卡（main 渲染 ACESFilmic，HUD 不走色调映射，故用独立的屏幕色值）
    panel: "rgba(8,16,20,0.62)",
    line: "rgba(96,202,224,0.55)",   // 青蓝描边
    text: "#e8f4f6",
    accent: "#ffb057",
    danger: "#ff5a3c",
    hpGood: "#59d6a0", hpGoodEnd: "#a8e6b8",
    hpLow: "#c8342a",
    radarEnemy: "#ff5a3c",
    radarSelf: "#e8f4f6",
    // 屏幕后处理（对标复刻样本胶片 shader 的 uLowHP / uDeath；uDamage 已由 #ts-damage 红闪承担）
    lowVignette: "rgba(160,24,16,0.6)",  // 低血量暗角（屏边出血，血量 ≤30% 常驻 + 脉动）
    deathFilter: "grayscale(0.85) brightness(0.75) contrast(1.05)", // 阵亡灰度（结算屏背后）
  },

  // ─────────────── ② 光照 ───────────────
  // 单方向暖白主光（PCFSoft 阴影）+ 半球环境 + 相机同侧补光（Q7 逆光死黑修正；
  // 美术复验：背光集装箱侧面仍死黑 → 补光再抬一档 + 甲板暖反弹，保证可读性）。
  light: {
    exposure: 0.95,                 // ACESFilmic 曝光（QA Q7 上调后口径）
    sun: { color: 0xffe6c2, intensity: 2.1, pos: [60, 46, -120] },
    hemi: { sky: 0xaad2e6, ground: 0x514a38, intensity: 1.7 },
    fill: { color: 0xa9bfd2, intensity: 0.62, pos: [-50, 34, 90] },
    bounce: { color: 0x8a7a5e, intensity: 0.35, pos: [20, -30, 40] },  // 甲板暖反弹（自下而上，压暗部死黑）
    shadow: { mapSize: 2048, bias: -0.0006, box: { left: -46, right: 46, top: 60, bottom: -60, far: 300 } },
    vm: { key: 1.6, hemi: 0.9 },    // 武器视图模型独立灯光
    fogRange: [90, 380],
  },

  // ── ②-b 材质兜底 ──
  // 无光面兜底：给贴图材质一层「同色自发光底」，背光/掠射角的面永不读成纯黑剪影。
  // （美术复验记录：集装箱朝 -x 的面在光照/阴影/各向过滤全部排除后仍输出 0，
  //   贴图本体经全图像素采样确认 0 黑像素 —— 疑引擎层问题，已记录黑板 blockers.md，
  //   此兜底保证画面可读，不依赖根因修复。）
  material: {
    ambientFloor: 0.13,
  },

  // ─────────────── ③ 线条 ───────────────
  // Canvas 贴图的笔触口径：焊缝 / 竖波筋 / 防滑斜筋 / 铆钉 / 描边 / 警示斜纹 / 喷字 / 颗粒。
  line: {
    weld: { width: 3, color: "#57606b", pitch: 42 },                      // 舰体横向焊缝
    tread: { width: 6, color: "#4a525b", pitch: 32, rivetPitch: 48, rivetR: 3, rivetColor: "#6c757f" }, // 甲板防滑斜筋
    rib: { pitch: 24, width: 9, hiWidth: 3, shadow: "rgba(0,0,0,0.16)", hi: "rgba(255,255,255,0.10)" }, // 集装箱竖波筋
    outline: { width: 10, alpha: 0.35 },                                  // 资产边缘压暗描边
    label: { px: 34, alpha: 0.55, font: "'DIN Alternate','Arial Narrow',sans-serif" }, // 箱号喷字
    noise: { alpha: 0.14, step: 4 },                                      // 全资产通用颗粒
    hazard: { pitch: 22, color: "#c9762e", base: "#2a2d31" },             // 警示斜纹（围栏/舷边）
    pad: { ring: 12, glyph: 16, color: "#d8d2c4" },                       // 停机坪 H 标线
  },

  // ─────────────── ④ 比例 ───────────────
  // 体块比例口径（美术比例，非玩法数值 —— 玩法数值唯一来源是 src/numeric.js，禁止在此复述）。
  scale: {
    cornerRadius: 0.04,   // 全游戏圆角盒统一圆角（风格卡「圆角盒拼装」）
    cornerSeg: 2,
    // 枪模（视图模型，单位米；q7 修正后整体 0.8x 由 player.js 施加）
    rifle: {
      length: 1.14,       // 机匣前缘到枪口
      caliber: 0.035,     // 枪管直径
      magDrop: 0.18,      // 弹匣下探深度
      kick: { posZ: 0.06, posY: 0.03, rotX: 0.12, decay: 0.12 },  // 后坐表现幅度（纯表现）
    },
    // 士兵（原型刚体分段；头身比 ≈ 1:6，读 spec numeric 之外的纯造型量）
    soldier: {
      headW: 0.26, torsoW: 0.52, torsoH: 0.62, vestW: 0.56, vestH: 0.34,
      legH: 0.72, legW: 0.18, armW: 0.14, armH: 0.52, shoulder: 0.34,
      helmet: { w: 0.30, h: 0.12 },
      walkSwing: 0.5, aimPose: -0.9, idleSway: 0.06,   // 摆动/举枪姿态
    },
    railing: { postPitch: 2.2, postW: 0.09, height: 1.08, railW: 0.07, toeH: 0.16 },
    muzzle: { size: 0.34, life: 0.055 },   // 枪口火光面片
    spark: { count: 7, size: 0.09, life: 0.26, speed: 2.6 },  // 命中火花
  },
};

/** 数值色 → CSS 十六进制串（Canvas 贴图用）*/
export const cssHex = (n) => "#" + Number(n).toString(16).padStart(6, "0");

/** HUD 色卡 → CSS 自定义属性（模板 :root 里的静态值是 fallback，运行时被本表覆盖） */
export const HUD_CSS_VARS = {
  "--panel": PALETTE.hud.panel,
  "--line": PALETTE.hud.line,
  "--text": PALETTE.hud.text,
  "--accent": PALETTE.hud.accent,
  "--danger": PALETTE.hud.danger,
  "--hp-good": PALETTE.hud.hpGood,
  "--hp-good-end": PALETTE.hud.hpGoodEnd,
  "--hp-low": PALETTE.hud.hpLow,
  "--low-vignette": PALETTE.hud.lowVignette,
  "--death-filter": PALETTE.hud.deathFilter,
};
