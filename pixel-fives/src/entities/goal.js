/**
 * 实体：球门（A05 槽位，落点规则 src/entities/goal.js）。
 * 32×24 素材左门朝右、右门 = 水平镜像（禁旋转）。
 * 进球判定：球心越过门线且处于门嘴高度带内 → 得分事件。
 * A08 触发：进球即按 goal_sfx_at_s（默认 0.0s，spec v1.2 pending-approved）排程音效。
 */
import { GOAL, GOAL_SFX_AT_S } from '../core/constants.js';

export class Goal {
  /**
   * @param {'left'|'right'} side 左门由蓝方（右侧队伍进攻方向）把守——见 levels/pitch.js 布局
   * @param {number} lineX 门线 x（球心越过该线判进）
   * @param {number} centerY 球门中心 y
   * @param {'red'|'blue'} defends 该门所属队伍（球进此门 = 对方得分）
   */
  constructor(side, lineX, centerY, defends) {
    this.side = side;
    this.lineX = lineX;
    this.centerX = side === 'left' ? lineX - GOAL.DEPTH / 2 : lineX + GOAL.DEPTH / 2;
    this.centerY = centerY;
    this.mouthTop = centerY - GOAL.MOUTH_H / 2;
    this.mouthBottom = centerY + GOAL.MOUTH_H / 2;
    this.depth = GOAL.DEPTH;
    this.defends = defends;
  }

  /** 球是否已进门（spec §3.1/el-03：球心越过门线 ∧ 球心处于门嘴高度带内，开区间）。 */
  containsBall(ball) {
    if (this.side === 'left') {
      if (ball.x >= this.lineX) return false; // 球心未越过门线
    } else {
      if (ball.x <= this.lineX) return false; // 球心未越过门线
    }
    return ball.y > this.mouthTop && ball.y < this.mouthBottom;
  }

  /** A08 触发参数（供 world 发事件用）。 */
  sfxSchedule() {
    return { id: 'a08-sfx-goal-hit', at_s: GOAL_SFX_AT_S };
  }
}
