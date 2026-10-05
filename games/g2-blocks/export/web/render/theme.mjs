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

/** 隐私弹窗 token（wx 提审轮 · e-renderer-ui-tokens.json privacy 段 · 来源 privacy-popup-visual.md 中性面定稿） */
export const PRIVACY_UI                         = {
  mask: '#0A0806',
  cardBg: '#241C16',
  border: '#C89C19',
  title: '#F2E8D8',
  body: '#D8C8B0',
  btnOutline: '#8A7A64',
  btnSolid: '#C89C19',
  btnSolidText: '#1A1512',
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
    id: 'clear-hit',
    kind: 'clear',
    wave: 'triangle',
    freqFromHz: 520,
    freqToHz: 780,
    durationMs: 120,
    envelope: 'fast-attack-quick-decay',
  },
  {
    id: 'combo-rise',
    kind: 'combo',
    wave: 'square',
    freqFromHz: 440,
    freqToHz: 880,
    durationMs: 160,
    envelope: 'step-up',
  },
  {
    id: 'cool-down',
    kind: 'cool',
    wave: 'sawtooth',
    freqFromHz: 220,
    freqToHz: 90,
    durationMs: 700,
    envelope: 'slow-decay',
  },
  {
    id: 'restart-stoke',
    kind: 'restart',
    wave: 'sine',
    freqFromHz: 330,
    freqToHz: 660,
    durationMs: 200,
    envelope: 'soft-attack',
  },
];

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


//# sourceURL=render/theme.ts