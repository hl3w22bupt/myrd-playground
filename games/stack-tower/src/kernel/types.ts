/**
 * 内核类型 — 确定性内核与表现层之间唯一的形状约定。
 * 内核零 DOM / 零 Canvas；表现层只读快照。
 */

/** 玩家意图（唯一输入通道）：platform/ 适配层把点击/空格/触摸归一成 drop */
export interface PlayerIntent {
  type: 'drop';
}

/** 已落块 */
export interface PlacedBlock {
  /** 块中心 x（逻辑像素，画布逻辑宽中点=0 轴可自定，快照统一用绝对坐标） */
  x: number;
  width: number;
  /** 层号：0=塔基 */
  yIndex: number;
}

/** 摆动中的待落块 */
export interface MovingBlock {
  x: number;
  width: number;
  /** 摆动方向：+1 向右 / −1 向左 */
  dir: 1 | -1;
  /** px/s，来自 swingSpeed(level) */
  speed: number;
}

/** 游戏状态机 */
export type GameStatus = 'ready' | 'running' | 'level-clear' | 'game-over';

/** 掉落碎块（仅表现层动画消费，内核只记录初始姿态） */
export interface DebrisSpec {
  x: number;
  width: number;
  yIndex: number;
  dir: 1 | -1;
}

/** 内核事件（单向流：内核 → main → 表现层）。
 *  tower-ripple 契约（spec.content.towerRipple，T1 必改②）：
 *  载荷恰为四字段；duration_ms 名义 300、容差 ±50；禁止携带 screen-flash/整屏 aha 语义。
 */
export type KernelEvent =
  | {
      type: 'tower-ripple';
      level_id: string;
      element_id: string;
      /** 本关实际判定窗口（ms） */
      window_ms: number;
      /** 波纹表现时长（ms），∈[250,350]，默认 300 */
      duration_ms: number;
    }
  | { type: 'block-placed'; level_id: string; perfect: boolean }
  | { type: 'game-over'; level_id: string; reason: 'width-floor' | 'total-miss' }
  /** M2.1（spec v3 content.towerRipple.restart）：重开事件，载荷恰一字段 source */
  | { type: 'restart'; source: 'button' | 'keyboard' };

/** 内核只读快照（表现层输入） */
export interface Snapshot {
  tower: PlacedBlock[];
  moving: MovingBlock | null;
  debris: DebrisSpec[];
  score: number;
  combo: number;
  level: number;
  layers: number;
  target: number;
  status: GameStatus;
}

/** 确定性仿真句柄 */
export interface SimHandle {
  /** 推进一个 fixed step（NUMERIC.FIXED_STEP_MS）；intent 在该 tick 起点生效 */
  tick(intent?: PlayerIntent): KernelEvent[];
  /** 无头快进 n 个 tick（契约测试用），逐 tick 产出事件 */
  fastForward(n: number): KernelEvent[];
  /** 只读快照 */
  snapshot(): Snapshot;
  /** 全量复位（重开）：塔回单块、分数/连击清零、关卡回 1（seed 保留）；
   *  传 source 时上抛契约级 restart 事件（spec v3 content.towerRipple.restart） */
  restart(source?: 'button' | 'keyboard'): KernelEvent[];
}
