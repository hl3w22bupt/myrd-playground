// numeric.js — 数值唯一来源：spec.numeric 的代码镜像（目录语义见 webgame-prototype）。
// 禁止在其它文件写玩法魔数；调参 = 改这里（或改 spec 后同步此处），preflight P2 会查。
export const FIXED_STEP = 1 / 60;        // 固定物理步长（秒）：掉帧不改变游戏速度（E-06）
export const MAX_DT = 0.1;               // 单帧 dt 钳制上限：切后台回来不瞬移（E-06）

// —— 球场（竖屏：长边沿 Z，玩家在 -Z 端，对方球门在 +Z 端）——
export const FIELD_HALF_W = 10;          // 场地半宽（X，米）：边线 x = ±10
export const FIELD_HALF_L = 16;          // 场地半长（Z，米）：底线 z = ±16
export const GOAL_WIDTH = 6;             // 球门宽（米，X 方向）：门柱 x = ±3
export const GOAL_LINE = FIELD_HALF_L;   // 门线 z = +16

// —— 玩家 ——
export const PLAYER_RADIUS = 0.7;        // 玩家碰撞半径（米）
export const PLAYER_SPEED = 9;           // 带球跑动速度（米/秒）
export const KICKOFF_X = 0;              // 开球/进球后重开：玩家落点（中圈附近）
export const KICKOFF_Z = -4;

// —— 球 ——
export const BALL_RADIUS = 0.45;
export const BALL_LEAD = 1.3;            // 带球时球在玩家朝向前方的距离（米）
export const BALL_FRICTION = 2.2;        // 射出后指数摩擦：v *= exp(-k*dt)（帧率无关，配方 §4）
export const SHOT_SPEED = 22;            // 射门初速（米/秒）
export const AIM_GAIN = 0.8;             // 自动瞄准增益：vx 朝门中心收敛（射门散布，保留玩家角度操作价值）
export const AIM_MAX = 5;                // 自动瞄准横向速度上限（米/秒）
export const SHOOT_MIN_Z = 8;            // 手动射门允许的最近触发线（z ≥ 8）
export const AUTO_SHOOT_Z = 13.5;        // 拖到这条线仍带球 → 自动射门（防带球出底线）
export const SHOOT_COOLDOWN = 0.9;       // 射门冷却（秒）：起脚后短冷却，防失速回位瞬间连射抖振
export const SHOT_LIVE_SECONDS = 2.5;    // 射出后最长存活（秒），超时/失速回位

// —— 守门员（三角波巡逻，平缓）——
export const KEEPER_RADIUS = 0.8;
export const KEEPER_RANGE = 3.0;         // 横移半幅（米）：覆盖 ±3 = 门宽
export const KEEPER_SPEED = 0.45;        // 相位速度：横移峰值 = 4×R×S ≈ 5.4m/s，单程 ≈1.2s（平缓但有扑救）
export const KEEPER_Z = 14.6;            // 站位（门线前 1.4m）

// —— 收集与得分 ——
export const COIN_COUNT = 10;            // 场上金币数量
export const COIN_RADIUS = 0.9;          // 收集判定半径（玩家中心到金币中心，另加 PLAYER_RADIUS）
export const COIN_SCORE = 5;             // 每枚金币得分
export const GOAL_SCORE = 100;           // 每球得分
export const GOALS_TO_WIN = 3;           // 进 3 球提前终局获胜

// —— 单局 ——
export const ROUND_SECONDS = 90;         // 单局时长（秒）：落在 1-3 分钟设计带
export const SEED_DEFAULT = 20261110;    // 默认随机种子（确定性内核：同 seed 同布局同结果）
