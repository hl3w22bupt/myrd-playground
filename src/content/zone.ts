/**
 * content/zone —— AC5 缩圈阶段基准（≥3 阶段、圈外按秒掉血且随阶段递增）
 * 数值取自架构文档 02 §4 初始建议值：总时长 405s（< 10 分钟，满足 AC1）。
 */

export interface ZonePhaseDef {
  /** 等待时间（秒） */
  waitSec: number;
  /** 收缩时间（秒） */
  shrinkSec: number;
  /** 本阶段圈外每秒掉血 */
  dps: number;
}

export interface ZoneConfig {
  /** 首圈半径（m） */
  initialRadius: number;
  /** 最小圈半径（m），收缩下限 */
  minRadius: number;
  /** 每阶段半径乘数 */
  shrinkFactor: number;
  /** 下一圈心相对当前圈的随机偏移比例 */
  centerDrift: number;
  phases: ZonePhaseDef[];
  /** 全部阶段收缩完毕后，经过 finalRampAfterSec 开始按比例放大 dps（保证对局自然终结） */
  finalRampAfterSec: number;
  /** 每秒 dps 增长比例 */
  finalRampPerSec: number;
  /** 终局圈坍缩速率（m/s）：done 模式下半径持续收缩至 0（终局规则，保证 AC1 ≤10min 自然结束） */
  finalCollapseRate: number;
}

export const ZONE: ZoneConfig = {
  initialRadius: 600,
  minRadius: 25,
  shrinkFactor: 0.65,
  centerDrift: 0.4,
  phases: [
    { waitSec: 60, shrinkSec: 40, dps: 0.4 },
    { waitSec: 50, shrinkSec: 35, dps: 0.8 },
    { waitSec: 40, shrinkSec: 30, dps: 1.5 },
    { waitSec: 35, shrinkSec: 25, dps: 2.5 },
    { waitSec: 30, shrinkSec: 20, dps: 4 },
    { waitSec: 25, shrinkSec: 15, dps: 6 },
  ],
  finalRampAfterSec: 20,
  finalRampPerSec: 0.1,
  finalCollapseRate: 1.2,
};

/** 圈外掉血按秒结算（AC5 语义）：每个 tick 累计时间，满 1s 结算一次 */
export const ZONE_DAMAGE_TICK_SEC = 1;
