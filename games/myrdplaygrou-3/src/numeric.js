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
export const KEEPER_SPEED = 0.45;        // 基准相位速度：横移峰值 = 4×R×S ≈ 5.4m/s，单程 ≈1.1s
export const KEEPER_Z = 14.6;            // 站位（门线前 1.4m）

// —— 难度梯度（平缓大众：成功驱动的缓爬坡，不惩罚挣扎玩家）——
export const KEEPER_RAMP_PER_GOAL = 0.15; // 每进 1 球守门员相位速度增幅：×(1 + 0.15·进球数)
export const KEEPER_RAMP_MAX = 1.4;       // 提速倍率封顶：峰值横移 ≈7.6m/s，仍低于玩家 9m/s（守门员永远追不上人）

// —— 收集与得分 ——
export const COIN_COUNT = 10;            // 场上恒持金币数量（收集当步即补位，休闲收集循环不枯竭）
export const COIN_RADIUS = 0.9;          // 收集判定半径（玩家中心到金币中心，另加 PLAYER_RADIUS）
export const COIN_SCORE = 5;             // 每枚金币得分
export const GOAL_SCORE = 100;           // 每球得分
export const GOALS_TO_WIN = 3;           // 进 3 球提前终局获胜

// —— 金币补位（收集即补：补位点确定性采样，同 seed 同输入 → 同补位序列）——
export const COIN_RESPAWN_MIN_PLAYER_DIST = 3; // 补位点与玩家最小距离（米）：不白给，要跑动拿
export const COIN_RESPAWN_GUARD = 600;         // 补位拒绝采样上限（次）：后 1/3 逐步放宽阈值，兜底确定性环带

// —— 相机（竖屏高机位跟随机位：手感类，需试玩校准；render 层只读消费）——
// 竖屏口径：俯仰 ≈70°（h/back+ahead 几何解）时 FOV72 的画幅纵向恰好被整场充满，
// 上缘落在门后环带（消死天空）、球员恒居画幅中部偏下 —— 手机优先构图。
export const CAM_HEIGHT = 24;            // 机位高度（米）
export const CAM_BACK = 6;               // 机位在玩家身后（-Z 方向）的偏移（米）
export const CAM_AHEAD = 2.7;            // 视线落点在玩家前方（+Z 方向）的偏移（米）：决定俯仰角
export const CAM_LATERAL = 0.5;          // 机位横向跟随系数（0=纯中轴，1=全跟随；机位与视线同 x → 零偏航）
export const CAM_FRONT_LIMIT = 12;       // 机位最前位：门线前 12m 处停止前压（门前构图锁定，门后环带不入画）

// —— 单局 ——
export const ROUND_SECONDS = 90;         // 单局时长（秒）：落在 1-3 分钟设计带
export const SEED_DEFAULT = 20261110;    // 默认随机种子（确定性内核：同 seed 同布局同结果）
