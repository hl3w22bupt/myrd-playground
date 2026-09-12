/**
 * 实体：球员（A02/A03 槽位，落点规则 src/entities/player.js）。
 * 16×16 侧视朝右，反向 = 水平镜像（禁旋转，风格卡§4）。
 *
 * 射门链路（红线 input_to_shot_latency_ms ≤ 50，终裁已锁）：
 *  - kick() 在被调用的同一 tick 内即时判定出球（≤1 tick ≈ 16.7ms ≤ 50ms）；
 *  - A06 射门动画（9帧@12fps=0.75s，contact_frame=3）为纯视觉反馈：
 *    kickT 计时不参与任何判定，动画播不完不影响下一次判定（仅受冷却约束）。
 */
import { PLAYER, BALL, A06 } from '../core/constants.js';

export class Player {
  /**
   * @param {'red'|'blue'} team
   * @param {number} x 出生点
   * @param {number} y
   * @param {number} homeX 中圈重开时的本方站位 x
   */
  constructor(team, x, y, homeX) {
    this.team = team;
    this.x = x;
    this.y = y;
    this.homeX = homeX;
    this.vx = 0;
    this.vy = 0;
    /** 朝向：1 右 / -1 左（水平镜像，禁旋转）。 */
    this.facing = 1;
    /** 射门冷却剩余（s）。 */
    this.kickCooldown = 0;
    /** A06 动画剩余时长（s），>0 表示正在播放射门动画（纯视觉）。 */
    this.kickAnimT = 0;
    /** 累计射门次数（QA per_game 指标）。 */
    this.shotCount = 0;
  }

  /**
   * 尝试射门。判定即时：球在触球距离内且冷却完毕 ⇒ 立即出球并返回 true。
   * @param {import('./ball.js').Ball} ball
   * @param {(ix:number, iy:number) => void} impulse 向球施加冲量
   */
  tryKick(ball, impulse) {
    if (this.kickCooldown > 0) return false;
    const dx = ball.x - this.x;
    const dy = ball.y - this.y;
    // sqrt 而非 hypot：IEEE 精确，跨环境复跑一致（R-08 种子纪律）
    if (Math.sqrt(dx * dx + dy * dy) > PLAYER.REACH) return false;
    // 出球方向 = 球员朝向的水平分量 + 指向球的垂直修正（保持街机手感，避免垂直死区）
    const dirX = this.facing;
    const dirY = dy === 0 ? 0 : Math.sign(dy) * Math.min(1, Math.abs(dy) / 16);
    const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
    impulse((dirX / len) * BALL.KICK_IMPULSE, (dirY / len) * BALL.KICK_IMPULSE);
    this.kickCooldown = PLAYER.KICK_COOLDOWN_S;
    this.kickAnimT = A06.duration_s; // 视觉层计时，不阻塞判定
    this.shotCount += 1;
    return true;
  }

  /**
   * 单 tick 更新。intent 来自控制器（人类键盘 / bot）。
   * @param {{moveX:number, moveY:number, kick:boolean}} intent
   * @param {import('./ball.js').Ball} ball
   * @param {(ix:number,iy:number)=>void} impulse
   */
  tick(intent, ball, impulse, dt) {
    // 移动：意图归一化 × 速度（SLOT: player.speed_px_s）
    const ml = Math.sqrt(intent.moveX * intent.moveX + intent.moveY * intent.moveY);
    if (ml > 0) {
      this.vx = (intent.moveX / ml) * PLAYER.SPEED;
      this.vy = (intent.moveY / ml) * PLAYER.SPEED;
      if (intent.moveX !== 0) this.facing = Math.sign(intent.moveX);
    } else {
      this.vx = 0;
      this.vy = 0;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (this.kickCooldown > 0) this.kickCooldown -= dt;
    if (this.kickAnimT > 0) this.kickAnimT -= dt;

    // 射门判定（即时，同 tick 生效）
    this.kickRequested = false;
    if (intent.kick) {
      this.kickRequested = true;
      this.tryKick(ball, impulse);
    }
  }

  place(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.kickCooldown = 0;
    this.kickAnimT = 0;
    this.kickRequested = false;
  }
}
