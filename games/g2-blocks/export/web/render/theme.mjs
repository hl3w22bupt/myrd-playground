// theme.ts — 运行时单源（GENERATED · 勿手改）
// 真源: spec 导出件 numeric.palette（冻结块）+ assets/{e-board-block-tiles,style-card,e-renderer-ui-tokens,e-renderer-backdrop,a03-sfx-plan}.json
// 生成器: tools/gen-theme.mjs · spec v2 (approved) · 再生成命令: node tools/gen-theme.mjs

/** spec numeric.palette 冻结块（ac-11：键名与值逐字等于 spec） */
export const PALETTE                         = {
  'block-01': '#21458C', // 深海蓝
  'block-03': '#38B279', // 翡翠绿
  'block-04': '#DB6B43', // 赤陶红
  'block-05': '#A472CA', // 紫水晶
  'block-02': '#C89C19', // 余烬金
  'block-06': '#4B2B25', // 深余烬褐
  'block-07': '#E3B5BF', // 绯玫瑰
};

/** UI/HUD token（美术批二 · e-renderer-ui-tokens.json） */
export const UI                         = {
  bgDeep: '#171A21',
  bgPanel: '#222733',
  textPrimary: '#E8E4DC',
  textDim: '#8B93A3',
  accentWarm: '#C89C19',
  dangerCool: '#DB6B43',
  hintBarBg: '#2A2F3D',
  coolBannerBg: '#4B2B25',
  coolBannerText: '#E3B5BF',
};

/** HUD 文案（美术批二） */
export const HUD_TEXT = {
  scoreLabel: '分数',
  chainLabel: '连击',
  movesLabel: '手数',
  coolTitle: '炉冷',
  coolSubtitle: '火熄了——再来一炉',
  restartLabel: '重开',
  goalLabel: '目标',
};

/** 字号比例（美术批二） */
export const TYPE_SCALE = {
  scoreRatio: 0.036,
  labelRatio: 0.016,
  bannerRatio: 0.043,
};

/** 形状语言（风格卡 · assets/style-card.json） */
export const SHAPE = {
  language: '方角圆角块 + 内描边 + 顶部高光条',
  cornerRadiusRatio: 0.12,
  innerStrokeRatio: 0.02,
  topHighlightRatio: 0.18,
};

/** 材质/光效 token（风格卡 material 段 · 内描边/顶部高光/版式基色的唯一色源） */
export const MATERIAL = {
  textureSampling: 'none',
  hitFeedback: 'brightness-pulse',
  shadow: 'inner-dark-overlay',
  tint: {
    ink: '#000000',
    paper: '#FFFFFF',
  },
  innerStroke: {
    hex: '#000000',
    alpha: 0.35,
  },
  topHighlight: {
    hex: '#FFFFFF',
    alpha: 0.18,
  },
};

/** 块 tile 规格（美术批一 · e-board-block-tiles.json；色一律经 PALETTE token） */
export const TILES = [
  {
    id: 'block-01',
    name: '深海蓝',
    paletteToken: 'block-01',
    shape: 'rounded-rect',
    innerStroke: true,
    topHighlight: true,
  },
  {
    id: 'block-02',
    name: '余烬金',
    paletteToken: 'block-02',
    shape: 'rounded-rect',
    innerStroke: true,
    topHighlight: true,
  },
  {
    id: 'block-03',
    name: '翡翠绿',
    paletteToken: 'block-03',
    shape: 'rounded-rect',
    innerStroke: true,
    topHighlight: true,
  },
  {
    id: 'block-04',
    name: '赤陶红',
    paletteToken: 'block-04',
    shape: 'rounded-rect',
    innerStroke: true,
    topHighlight: true,
  },
  {
    id: 'block-05',
    name: '紫水晶',
    paletteToken: 'block-05',
    shape: 'rounded-rect',
    innerStroke: true,
    topHighlight: true,
  },
  {
    id: 'block-06',
    name: '深余烬褐',
    paletteToken: 'block-06',
    shape: 'rounded-rect',
    innerStroke: true,
    topHighlight: true,
  },
  {
    id: 'block-07',
    name: '绯玫瑰',
    paletteToken: 'block-07',
    shape: 'rounded-rect',
    innerStroke: true,
    topHighlight: true,
  },
];

/** 背景/氛围（美术批三 · e-renderer-backdrop.json） */
export const BACKDROP = {
  mode: 'vertical-gradient',
  stops: [
    {
      at: 0,
      hex: '#1B1E26',
    },
    {
      at: 0.6,
      hex: '#151720',
    },
    {
      at: 1,
      hex: '#241A16',
    },
  ],
  heatGlow: {
    enabled: true,
    anchorYRatio: 1,
    hex: '#C89C19',
    alphaCool: 0.04,
    alphaWarm: 0.12,
  },
  vignette: {
    enabled: true,
    hex: '#0C0E13',
    alpha: 0.5,
  },
  coolScrim: {
    hex: '#000000',
    alpha: 0.55,
  },
};

/** 表现时长（美术批三 · ms） */
export const MOTION = {
  clearPopMs: 140,
  fallMsPerCell: 40,
  hintPulseMs: 600,
  coolFadeMs: 400,
};

/** 音效合成参数（美术批三 · a03-sfx-plan.json · procedural） */
export const SFX_MASTER = {
  gain: 0.22,
  mutedDefault: false,
};
export const SFX = [
  {
    id: 'clear-hit-t1',
    kind: 'clear',
    wave: 'triangle',
    freqFromHz: 520,
    freqToHz: 780,
    durationMs: 120,
    envelope: 'fast-attack-quick-decay',
    gainMul: 1,
    detuneCents: 0,
  },
  {
    id: 'combo-rise-t2',
    kind: 'combo',
    wave: 'square',
    freqFromHz: 440,
    freqToHz: 880,
    durationMs: 160,
    envelope: 'step-up',
    gainMul: 1.15,
    detuneCents: 35,
  },
  {
    id: 'blaze-burst-t3',
    kind: 'blaze',
    wave: 'sawtooth',
    freqFromHz: 330,
    freqToHz: 1240,
    durationMs: 220,
    envelope: 'fast-attack-long-decay',
    gainMul: 1.3,
    detuneCents: 70,
  },
  {
    id: 'cool-down',
    kind: 'cool',
    wave: 'sine',
    freqFromHz: 220,
    freqToHz: 90,
    durationMs: 700,
    envelope: 'slow-decay',
    gainMul: 1,
    detuneCents: 0,
  },
  {
    id: 'restart-stoke',
    kind: 'restart',
    wave: 'sine',
    freqFromHz: 330,
    freqToHz: 660,
    durationMs: 200,
    envelope: 'soft-attack',
    gainMul: 1,
    detuneCents: 0,
  },
];

/** V1.2 核心手感 UI 映射（美术打磨包 · a06/a07 · GENERATED；色一律 token 名引用） */
export const FEEL_UI = {
  comboTokenMap: [
    {
      tier: 1,
      valueToken: 'UI.textPrimary',
      accent: 'none',
      valueScale: 1,
    },
    {
      tier: 2,
      valueToken: 'UI.accentWarm',
      accent: 'alpha-pulse',
      valueScale: 1.12,
    },
    {
      tier: 3,
      valueToken: 'UI.dangerCool',
      accent: 'alpha-pulse+scale',
      valueScale: 1.22,
    },
  ],
  restart: {
    entry: 'button+keyboard-same-source',
    states: [
      'idle',
      'armed',
      'transition',
    ],
    transitionFrames: 9,
    tokenMap: {
      idle: 'UI.textPrimary',
      armed: 'UI.accentWarm',
      transition: 'UI.textDim',
    },
  },
  daily: {
    states: [
      'undone',
      'done',
    ],
    tokenMap: {
      undone: 'UI.accentWarm',
      done: 'UI.textDim',
    },
    position: 'HUD 右上角标入口',
    badge: '未完成日显示角标；完成当日角标收敛为对勾态',
  },
};

/** 派生：hex → 提亮/压暗（amt 正提亮负压暗） */
export function shade(hex        , amt        )         {
  const v = hex.replace('#', '');
  const num = parseInt(v, 16);
  const r = Math.min(255, Math.max(0, ((num >> 16) & 255) + amt));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 255) + amt));
  const b = Math.min(255, Math.max(0, (num & 255) + amt));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** 派生：token hex + alpha → rgba() 串（表现层唯一 rgba 入口；杜绝散落 rgba 硬抄） */
export function withAlpha(hex        , alpha        )         {
  const v = hex.replace('#', '');
  const num = parseInt(v, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

/** 派生：hex → 降饱和（amt ∈ [0,1]，HSL 纯数学；派生式可机判，零新裸色 —— 链 v8 G-02 色源） */
export function desaturate(hex        , amt        )         {
  const v = hex.replace('#', '');
  const num = parseInt(v, 16);
  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s0 = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  const s = Math.max(0, s0 * (1 - amt));
  const h = d === 0 ? 0 : max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h % 2) - 1));
  const m = l - c / 2;
  const seg = Math.floor(((h % 6) + 6) % 6);
  const rgb = seg === 0 ? [c, x, 0] : seg === 1 ? [x, c, 0] : seg === 2 ? [0, c, x] : seg === 3 ? [0, x, c] : seg === 4 ? [x, 0, c] : [c, 0, x];
  const to = (f        ) => Math.round((f + m) * 255).toString(16).padStart(2, '0');
  return `#${to(rgb[0])}${to(rgb[1])}${to(rgb[2])}`;
}

/** near-miss 边行高亮 token（链 v8 G-02）：冻结冷 token 派生（降饱和 ~30%），不常亮（transient-not-latched 由渲染态控制） */
export const NEARMISS_UI = {
  edge: desaturate(UI.coolBannerText, 0.3),
}         ;

/** 结算页文案表（链 v8 ac-32.copy 枚举的代码面单源；措辞观感归人工 rubric，存在性/挂载点契约机判） */
export const SETTLEMENT_TEXT = {
  scoreLabel: '分数',
  chainLabel: '最高连击',
  movesLabel: '用步数',
  attributionNone: '棋盘无可消除，炉冷收场',
  actionRestart: '再来一局',
  actionDaily: '每日挑战',
  /** copy id ↔ 文案（ac-32.copy auto-present 条目逐字一致；契约机判面） */
  byCopyId: {
    'sl-copy-result-score': '分数',
    'sl-copy-result-chain': '最高连击',
    'sl-copy-result-moves': '用步数',
    'sl-copy-attribution-none': '棋盘无可消除，炉冷收场',
    'sl-copy-action-restart': '再来一局',
    'sl-copy-action-daily': '每日挑战',
  }                          ,
};

/** near-miss 文案表（链 v8 ac-31.copy 枚举的代码面单源；{chain}/{chainTarget}/{best}/{gap} 为模板位） */
export const NEARMISS_TEXT                         = {
  'nm-copy-inplay-oneaway': '这一行差一步就能消',
  'nm-copy-settle-chain': '距离 {chainTarget} 连只差 1 连',
  'nm-copy-settle-firstclear': '首消只差 1 步',
  'nm-copy-settle-hands': '{chain} 连收尾，就差 1 手',
  'nm-copy-personal-best-gap': '个人最佳 {best}，就差 {gap} 分',
  'nm-copy-personal-best-edge': '继续热身，稳住节奏',
};


//# sourceURL=render/theme.ts