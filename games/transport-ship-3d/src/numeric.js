// numeric.js — 数值唯一来源（spec.numeric v3 的代码镜像，逐键对应；qa-audit 双向断言）
// 红线：改这里的数值 = 改策划案 → 必须先走 POST /api/v1/game-design-specs/:id/revisions 产生新版本。
// 禁止在其它文件散落玩法魔数；关卡布局坐标（甲板边界/出生点位）属关卡数据，见 levels/level-01-deck.js。

export const PLAYER_MAX_HP = 100;
export const PLAYER_MOVE_SPEED = 5.2;
export const PLAYER_SPRINT_MULT = 1.55;
export const PLAYER_RADIUS = 0.35;
export const PLAYER_HALF_HEIGHT = 0.9;
export const GRAVITY = 0;

export const MAG_SIZE = 30;
export const RESERVE_AMMO = 150;
export const FIRE_INTERVAL = 0.11;
export const RELOAD_TIME = 2.0;
export const BULLET_DAMAGE = 26;
export const HEADSHOT_MULT = 2.0;
export const BULLET_RANGE = 80;
export const SPREAD_BASE = 0.006;
export const SPREAD_MOVE_ADD = 0.02;

export const ENEMY_HP = 55;
export const ENEMY_SPEED = 2.7;
export const ENEMY_SPEED_GROWTH = 0.15;
export const ENEMY_DAMAGE = 7;
export const ENEMY_FIRE_INTERVAL = 1.6;
export const ENEMY_ENGAGE_DIST = 30;
export const ENEMY_ATTACK_DIST = 14;
export const ENEMY_HIT_CHANCE = 0.3;

export const WAVE_REST = 8;
export const WAVE_SIZE_BASE = 4;
export const WAVE_SIZE_GROWTH = 2;
export const WAVE_SIZE_CAP = 14;
export const SPAWN_DISTANCE = 24;
export const SPAWN_INTERVAL = 0.8;

export const HIT_SCORE = 10;
export const KILL_SCORE = 50;
export const HEADSHOT_BONUS = 25;
export const WAVE_CLEAR_BONUS = 200;
export const WAVE_CLEAR_HEAL = 35;

export const FIXED_STEP = 0.016666666666666666; // 1/60，固定步长累加器
export const MAX_DT = 0.1;
export const MINIMAP_RANGE = 40;

export const EYE_HEIGHT = 1.6;
export const ENEMY_HIT_RADIUS = 0.45;
export const HEAD_HEIGHT_MIN = 1.45;
export const HEAD_HEIGHT_MAX = 1.8;
