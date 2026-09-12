/**
 * Pixel Fives · M1 数值单源（唯一来源，禁止在其它模块硬编码玩法数值）
 *
 * 依据链：
 *  - 已裁决（可直接实现）：2026-09-12 例会主策划终裁 + GameDesignSpec v1.2 终裁修订条目
 *    （A06=9帧@12fps=0.75s、新增 A08 与 goal_sfx_at_s、红线 input_to_shot_latency_ms≤50、
 *     队色 赤焰 #D93A2B / 霜蓝 #2B6BD9、落点规则 src/entities/<id>.js / src/levels/<id>.js、
 *     QA 冻结接口：goal_range_ratio / duration_in_range_ratio 拆分、errors⇒exit≠0、
 *     per_game[]+meta、seeds=42..141）
 *  - 待批（PENDING 槽位）：GameDesignSpec v1.2 approved 文本当前不可达
 *    （平台 game-design-specs/approved 接口与 .myrd/spec/design-spec.json 均未落位），
 *    下列带 SLOT 标注的默认值为程序线占位提案，contract-check 以 `pending-approved`
 *    状态跟踪；spec approved 落位后由策划案数值覆盖，本文件是唯一改动点。
 */

/** 契约槽位登记：{ 槽位id: 默认值 }。approved spec 落位后逐条翻转状态。 */
export const PENDING_APPROVED_SLOTS = {
  'pitch.logical_size': '256x160 (16px 公度 16x10 tile)',
  'match.duration_s': 90,
  'goal.mouth_h_px': 44,
  'goal.depth_px': 12,
  'player.speed_px_s': 92,
  'ball.max_speed_px_s': 230,
  'ball.kick_impulse_px_s': 240,
  'ball.friction_half_life_s': 0.45,
  'ball.low_speed_cutoff_px_s': 2,
  'goal_celebration_s': 1.2,
  'bot.goal_range': [1, 12],
  'bot.duration_in_range_s': [80, 100],
};

/** 确定性步频：60Hz 固定步长（单 tick ≈16.67ms ⇒ 射门判定延迟 ≤1 tick，满足 ≤50ms 红线）。 */
export const TICK_HZ = 60;
export const TICK_DT_S = 1 / TICK_HZ;

/** 红线（终裁已锁）：输入到射门判定延迟上限（ms）。v1.3 将以实测定标。 */
export const RED_LINE_INPUT_TO_SHOT_MS = 50;

/** 队色（终裁已锁；暗/亮阶 = spec §2.2 world.teams）。 */
export const TEAMS = {
  red: { id: 'red', name: '赤焰 Fives', hex: '#D93A2B', dark: '#A8281C', light: '#F06A50' },
  blue: { id: 'blue', name: '霜蓝 Fives', hex: '#2B6BD9', dark: '#1E4DA8', light: '#5C8FF0' },
};

/** A06（终裁已锁）：射门动画 9 帧 @12fps = 0.75s；f3 为视觉触球帧，不阻塞判定。 */
export const A06 = { frames: 9, fps: 12, duration_s: 0.75, contact_frame: 3 };

/** A08（终裁已锁，参数取 assets/a08-sfx-goal-hit.spec.json）。 */
export const A08 = {
  id: 'a08-sfx-goal-hit',
  duration_s: 0.6,
  sample_rate_hz: 44100,
  seed: 20260912,
  layers: {
    netSwish: { center_hz: 2400, q: 1.2, attack_s: 0.002, decay_s: 0.16, gain_db: -6 },
    thump: { freq_hz: 90, end_freq_hz: 60, attack_s: 0.001, decay_s: 0.12, gain_db: -4 },
    crowdRise: { cutoff_hz: 900, attack_s: 0.25, release_s: 0.25, gain_db: -14 },
  },
};

/** goal_sfx_at_s：spec v1.2 字段（pending-approved），默认偏移 0.0s（进球判定即触发）。 */
export const GOAL_SFX_AT_S = 0.0;

/** QA 冻结接口（终裁已锁）：bot 对局种子 42..141（含端点）= 100 场，双方同一套。 */
export const BOT_SIM_SEEDS = { start: 42, end: 141 };

/** 球场逻辑尺寸（SLOT: pitch.logical_size）。世界坐标单位 = 逻辑像素（1x），渲染整数倍缩放。 */
export const PITCH = {
  W: 256,
  H: 160,
  TILE: 16,
  /** 边线内缩（白线画在此矩形上）。 */
  INSET: 6,
};

/** 球门（SLOT: goal.*）。左门朝右、右门为水平镜像；球进门判定 = 球心越过门线且处于门嘴高度带。 */
export const GOAL = {
  MOUTH_H: 44,
  DEPTH: 12,
};

/** 球员/球（SLOT: player.* / ball.*）。 */
export const PLAYER = {
  SIZE: 16,
  SPEED: 92,
  /** 射门冷却（s）：防止按键长按连踢；0.3s 为占位提案。 */
  KICK_COOLDOWN_S: 0.3,
  /** 触球距离：球员中心到球心小于该值方可触球/带球（px）。 */
  REACH: 13,
};

export const BALL = {
  SIZE: 8,
  RADIUS: 4,
  MAX_SPEED: 230,
  KICK_IMPULSE: 240,
  FRICTION_HALF_LIFE_S: 0.45,
  /** 低速截断（SLOT: ball.low_speed_cutoff_px_s，px/s）：避免无限蠕动。 */
  LOW_SPEED_CUTOFF: 2,
};

/** 进球庆祝时长（s）：期间冻结对局、播 A08，随后中圈重开（SLOT: goal_celebration_s）。 */
export const GOAL_CELEBRATION_S = 1.2;

/** M1 对局时长（s，SLOT: match.duration_s）。 */
export const MATCH_DURATION_S = 90;

/** QA 指标区间（SLOT: bot.goal_range / bot.duration_in_range_s）。 */
export const BOT_SIM_RANGES = {
  GOALS: [1, 12],
  DURATION_S: [80, 100],
};

/** onboarding 提示：开局展示，首次触球后 3s 内淡出（check 落点 = UI 集成测试）。 */
export const ONBOARDING = {
  HIDE_AFTER_FIRST_TOUCH_S: 3,
  TEXT: '移动 WASD/方向键 · 射门 空格/J',
};
