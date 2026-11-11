// numeric.js — 数值唯一来源：spec.numeric 的代码镜像（目录语义见 webgame-prototype）。
// 禁止在其它文件写玩法魔数；调参 = 改这里（或改 spec 后同步此处），preflight P2 会查。
export const FIXED_STEP = 1 / 60;      // 固定物理步长（秒）：掉帧不改变游戏速度（E-06）
export const MAX_DT = 0.1;             // 单帧 dt 钳制上限：切后台回来不瞬移（E-06）
export const ROUND_SECONDS = 60;       // 单局时长（秒）
export const ARENA_HALF = 14;          // 场地半宽（米）：玩家/宝石都钳制在 [-ARENA_HALF, ARENA_HALF]
export const PLAYER_RADIUS = 0.6;      // 玩家碰撞半径（米）
export const PLAYER_SPEED = 8;         // 玩家移动速度（米/秒）
export const GEM_COUNT = 8;            // 场上宝石数量
export const GEM_RADIUS = 0.9;         // 收集判定半径（玩家中心到宝石中心，另加 PLAYER_RADIUS）
export const GEM_SCORE = 10;           // 每颗宝石得分
export const SEED_DEFAULT = 20260925;  // 默认随机种子（确定性内核：同 seed 同布局同结果）
