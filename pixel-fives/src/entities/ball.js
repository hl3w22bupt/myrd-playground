/**
 * 实体：足球（A04 槽位，落点规则 src/entities/ball.js）。
 * 8×8 精灵（半径 4），滚动 4 帧 @12fps 由渲染层按速度采样。
 * 运动模型：位置积分 + 指数摩擦（半衰期），边界由 world 裁决。
 */
import { BALL } from '../core/constants.js';

export class Ball {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = BALL.RADIUS;
    /** 累计滚动距离，用于渲染层滚动帧采样。 */
    this.rollDist = 0;
    /** 本 tick 是否被踢（渲染/统计用，每 tick 由 world 重置）。 */
    this.kickedThisTick = false;
    /** 累计触球次数（QA per_game 指标）。 */
    this.touchCount = 0;
  }

  /** 施加冲量（射门/带球触碰共用）。 */
  impulse(ix, iy) {
    this.vx += ix;
    this.vy += iy;
    this.clampSpeed();
    this.kickedThisTick = true;
    this.touchCount += 1;
  }

  clampSpeed() {
    // sqrt 而非 hypot：IEEE 精确运算，保证跨环境复跑逐字节一致（R-08 种子纪律）
    const sp = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (sp > BALL.MAX_SPEED) {
      const k = BALL.MAX_SPEED / sp;
      this.vx *= k;
      this.vy *= k;
    }
  }

  /**
   * 单 tick 积分。返回与边界碰撞信息（由 world 处理反弹，这里只报越界）。
   * @returns {{x:number,y:number}} 积分后的新位置
   */
  integrate(dt) {
    // 指数摩擦：v *= 0.5^(dt/半衰期)
    const f = Math.pow(0.5, dt / BALL.FRICTION_HALF_LIFE_S);
    this.vx *= f;
    this.vy *= f;
    // 低速截断（SLOT: ball.low_speed_cutoff_px_s），避免无限蠕动
    const sp = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (sp < BALL.LOW_SPEED_CUTOFF) {
      this.vx = 0;
      this.vy = 0;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rollDist += sp * dt;
    return { x: this.x, y: this.y };
  }

  place(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
  }
}
