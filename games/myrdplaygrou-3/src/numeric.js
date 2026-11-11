// numeric.js — 数值唯一来源：spec.numeric 的代码镜像（策划案 v2 = 唯一事实源，目录语义见 webgame-prototype）。
// 禁止在其它文件写玩法魔数；调参 = 改 .myrd/spec/design-spec.json 再同步此处（preflight P2 机判内核引用）。
// 镜像锚点：本文件每个数值都能在 spec.numeric 找到同键字段；改两头必须同步。

// —— 步长与全局 ——
export const FIXED_STEP = 1 / 60;        // 固定物理步长（秒）：掉帧不改变游戏速度（E-06）
export const MAX_DT = 0.1;               // 单帧 dt 钳制上限：切后台回来不瞬移（E-06）
export const SEED_DEFAULT = 333;         // 默认随机种子（确定性内核：同 seed 同对局；选型=首局活力：11 射 2:1 主胜）

// —— 单局 ——
export const ROUND_SECONDS = 90;         // 单局时长（秒）：创作决策「1-3 分钟一局」取 90s

// —— 场地（笼式小场：边界挡板反弹，无出界死球） ——
export const PITCH_HALF_X = 13;          // 边线半宽（米，x 轴 = 屏幕左右）
export const PITCH_HALF_Z = 20;          // 底线半长（米，z 轴 = 进攻方向；主队攻 -Z / 客队攻 +Z）
export const GOAL_HALF_WIDTH = 3.2;      // 球门半宽（米）
export const BALL_RADIUS = 0.32;         // 球半径（米）

// —— 球员 ——
export const PLAYER_RADIUS = 0.45;       // 球员碰撞半径（米）
export const PLAYER_SPEED = 7.2;         // 受控球员移动速度（米/秒）
export const AI_SPEED = 6.4;             // AI 球员移动速度（米/秒，平缓难度：比受控慢）
export const GK_SPEED = 5.2;             // 门将横移速度（米/秒）
export const ANIM_PHASE_PER_M = 2.4;     // 跑动动画相位增速（弧度/米，kernel phase 驱动表现层）

// —— 持球 / 传球 / 射门 ——
export const CONTROL_RADIUS = 0.95;      // 持球判定半径（球心到球员中心）
export const DRIBBLE_LEAD = 0.8;         // 持球时球在球员面朝方向前方的距离（米）
export const PASS_SPEED = 12.5;          // 传球初速（米/秒）
export const SHOT_SPEED = 17;            // 射门初速（米/秒）
export const SHOT_SCATTER = 0.06;        // 射门角度散射（弧度，平缓难度：主队小散射）
export const SHOT_SCATTER_AWAY = 0.11;   // 客队射门散射（弧度，平缓难度：客队打得更歪）
export const KICK_COOLDOWN = 0.4;        // 踢/传后该球员再次触球冷却（秒，防二次触球）
export const GK_HOLD_SECONDS = 0.6;      // 门将持球自动开大脚时限（秒）
export const GK_TRACK = 0.65;             // 门将横移对球位的跟随系数
export const AIM_CORNER_INSET = 0.9;     // 远角瞄准内收（米，从门柱往内）

// —— 对抗（平缓大众曲线） ——
export const TACKLE_RADIUS = 0.95;       // 抢断触发距离（防守人中心-持球人中心）
export const TACKLE_RATE = 0.8;          // 抢断泊松率（次/秒，贴身时；1-exp(-rate*dt) 逐步积分）
export const DRIBBLE_PENALTY = 0.9;      // 持球带球速度惩罚系数（守方追得上、攻方仍略快）
export const SHOT_RANGE_Z = 9;           // 主队/AI 起脚距离（距对方底线米数）
export const AWAY_SHOT_RANGE_Z = 8;      // 客队 AI 起脚距离（更靠近才打，平缓难度）

// —— 队友接应 / 对方逼抢（v2 多球员实况机制） ——
export const SUPPORT_OFFSET = 4.5;       // 接应点相对球位的前推距离（米，向前锋权重更高）
export const SUPPORT_FW_WEIGHT = 0.8;    // 前锋接应前推权重（系数 × SUPPORT_OFFSET）
export const SUPPORT_OTHER_WEIGHT = 0.3; // 后场球员接应前推权重
export const PRESS_MARGIN = 0.4;         // 逼抢目标点距持球人的余量（米）
export const COVER_LANE_MIX = 0.5;       // 协防点 = 球位与本方第二近接应点连线的插值系数

// —— 阵型 / 队伍 ——
export const TEAM_SIZE = 5;              // 每队人数（5v5 量级：含门将 GK + DF + MF + FW + FW）
export const FORMATION_SPREAD_X = 8;     // 阵型横向散布（米）
