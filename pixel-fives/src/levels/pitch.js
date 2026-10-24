/**
 * 关卡：pitch —— Fives Arena 主球场（M1 唯一关卡）。
 * 落点规则（spec v1.2 R-07）：src/levels/<id>.js，相对工程根 pixel-fives/。
 *
 * 元素编号 el-01..el-10 为稳定 id（spec §4.1；只增不改，改名/改号走 spec 新版本）。
 * 本文件只声明关卡结构与元素参数；玩法数值单源 = src/core/constants.js。
 * A01 tile 索引见 assets/manifest.json A01.tile_index（0 亮纹 / 1 暗纹 / 2 边线 / 3 中点）。
 */
import { PITCH, GOAL, PLAYER, BALL, MATCH_DURATION_S, GOAL_CELEBRATION_S, GOAL_SFX_AT_S, ONBOARDING } from '../core/constants.js';

/** 边线内缩矩形（el-01）：(6,6)-(250,154)。 */
export const TOUCHLINE = {
  left: PITCH.INSET,              // 6
  top: PITCH.INSET,               // 6
  right: PITCH.W - PITCH.INSET,   // 250
  bottom: PITCH.H - PITCH.INSET,  // 154
};

/** 中线（el-02）：x=128，y 6→154；中点 (128,80)。 */
export const MIDLINE = { x: PITCH.W / 2, yTop: PITCH.INSET, yBottom: PITCH.H - PITCH.INSET, spotX: PITCH.W / 2, spotY: PITCH.H / 2 };

export const PITCH_LEVEL = {
  id: 'pitch',
  name: 'Fives Arena 主球场（M1 唯一关卡）',
  /** 逻辑尺寸（SLOT: pitch.logical_size）：256x160，16px tile（16x10）。 */
  logicalSize: { w: PITCH.W, h: PITCH.H },
  tileSize: PITCH.TILE,
  coordinate: '原点左上，1x 世界单位；渲染整数倍缩放',

  /**
   * 关卡元素（稳定 id，spec §4.1 逐条对应）。
   * type ∈ static-decor | goal | spawn | ui | ui-flow（与 spec 一致）。
   */
  elements: [
    { id: 'el-01', name: '边线', type: 'static-decor', rect: { x: TOUCHLINE.left, y: TOUCHLINE.top, w: TOUCHLINE.right - TOUCHLINE.left, h: TOUCHLINE.bottom - TOUCHLINE.top }, style: '1px 暖白 w', asset: 'a01-pitch-tileset', assetTile: 2 },
    { id: 'el-02', name: '中线+中点', type: 'static-decor', line: { x: MIDLINE.x, y1: MIDLINE.yTop, y2: MIDLINE.yBottom }, spot: { x: MIDLINE.spotX, y: MIDLINE.spotY }, asset: 'a01-pitch-tileset', assetTile: 3 },
    { id: 'el-03', name: '左门', type: 'goal', side: 'left', lineX: TOUCHLINE.left, centerY: PITCH.H / 2, mouthH: GOAL.MOUTH_H, mouthBandY: [PITCH.H / 2 - GOAL.MOUTH_H / 2, PITCH.H / 2 + GOAL.MOUTH_H / 2], defends: 'blue', facing: 'right', asset: 'a05-goal-net' },
    { id: 'el-04', name: '右门', type: 'goal', side: 'right', lineX: TOUCHLINE.right, centerY: PITCH.H / 2, mouthH: GOAL.MOUTH_H, mouthBandY: [PITCH.H / 2 - GOAL.MOUTH_H / 2, PITCH.H / 2 + GOAL.MOUTH_H / 2], defends: 'red', facing: 'mirror', asset: 'a05-goal-net' },
    { id: 'el-05', name: '赤焰站位', type: 'spawn', team: 'red', x: 168, y: 80, homeX: 168 },
    { id: 'el-06', name: '霜蓝站位', type: 'spawn', team: 'blue', x: 88, y: 80, homeX: 88 },
    { id: 'el-07', name: '球位', type: 'spawn', target: 'ball', x: MIDLINE.spotX, y: MIDLINE.spotY, note: '开球/重开位，速度清零' },
    { id: 'el-08', name: 'HUD 记分牌', type: 'ui', rect: { x: 104, y: PITCH.INSET, w: 48, h: 16 }, asset: 'a07-ui-hud', note: 'A07 九宫格；比分 = 系统像素字体；显示双方比分 + 剩余时间' },
    { id: 'el-09', name: 'onboarding 提示', type: 'ui', text: ONBOARDING.TEXT, hideAfterFirstTouchS: ONBOARDING.HIDE_AFTER_FIRST_TOUCH_S, note: '底部居中提示条；开局显示，首次触球后 ≤3s 淡出；check 落点 = UI 集成测试（R-04）' },
    { id: 'el-10', name: '进球庆祝层', type: 'ui-flow', sfx: 'a08-sfx-goal-hit', sfxAtS: GOAL_SFX_AT_S, celebrationS: GOAL_CELEBRATION_S, note: '进球：冻结对局 → 播 A08 → 庆祝 1.2s → 中圈重开（el-05/06/07 复位、速度清零、无开球特权）→ 恢复运行' },
  ],

  /** 球门布局（el-03/el-04）：左门由蓝方把守、右门由红方把守（红攻左、蓝攻右）。 */
  goals: [
    { side: 'left', lineX: TOUCHLINE.left, centerY: PITCH.H / 2, defends: 'blue', elementId: 'el-03' },
    { side: 'right', lineX: TOUCHLINE.right, centerY: PITCH.H / 2, defends: 'red', elementId: 'el-04' },
  ],

  /** 出生点（el-05/el-06/el-07）：开球与中圈重开共用。 */
  spawns: {
    red: { x: 168, y: 80, homeX: 168, elementId: 'el-05' },
    blue: { x: 88, y: 80, homeX: 88, elementId: 'el-06' },
    ball: { x: MIDLINE.spotX, y: MIDLINE.spotY, elementId: 'el-07' },
  },

  /** 对局流程参数（spec §4.2）。 */
  matchFlow: {
    durationS: MATCH_DURATION_S,
    drawAllowed: true,           // 平局合法（M1 无加时）
    kickoffPrivilege: false,     // 无倒计时特权回合
    deterministic: true,         // core/sim 禁 Math.random/Date.now，随机走 core/rng.js
  },

  /** 实体-资产挂接（spec §3.2 对齐表，contract-check 断言依据）。 */
  assetHooks: {
    a01: 'src/levels/pitch.js',
    a02: 'src/entities/player.js',
    a03: 'src/entities/player.js',
    a04: 'src/entities/ball.js',
    a05: 'src/entities/goal.js',
    a06: 'src/entities/player.js',
    a07: 'el-08',
    a08: 'src/entities/goal.js',
  },

  /** 球员碰撞体尺寸（渲染/推球用；数值单源 constants）。 */
  playerSize: PLAYER.SIZE,
  ballRadius: BALL.RADIUS,
};

/** 按元素 id 查元素（稳定 id 检索入口）。 */
export function elementById(id) {
  return PITCH_LEVEL.elements.find((el) => el.id === id) || null;
}
