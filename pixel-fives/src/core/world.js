/**
 * 模拟核：World —— 确定性 60Hz 物理与进球判定（spec §3/§4.2）。
 *
 * 确定性红线（spec §4.2-determinism）：本文件及被调实体内禁止 Math.random / Date.now；
 * 一切随机走 src/core/rng.js。浮点只用 + - * / 与 Math.sqrt（IEEE 精确），不用 Math.hypot，
 * 保证同 seed 复跑逐字节一致（R-08 种子纪律）。
 *
 * 进球判定（spec §3.1 / el-03/el-04）：球心越过门线 ∧ 球心处于门嘴高度带内（开区间）。
 */
import { Player } from '../entities/player.js';
import { Ball } from '../entities/ball.js';
import { Goal } from '../entities/goal.js';
import { PITCH, PLAYER } from './constants.js';
import { PITCH_LEVEL } from '../levels/pitch.js';

export class World {
  /**
   * @param {object} level 关卡定义（默认 PITCH_LEVEL）
   * @param {number} seed 确定性种子（bot 派生用；纯物理不消费随机）
   */
  constructor(level = PITCH_LEVEL, seed = 0) {
    this.level = level;
    this.seed = seed >>> 0;
    const s = level.spawns;
    // 固定顺序 [red, blue]——迭代顺序是确定性的一部分
    this.players = [
      new Player('red', s.red.x, s.red.y, s.red.homeX),
      new Player('blue', s.blue.x, s.blue.y, s.blue.homeX),
    ];
    this.ball = new Ball(s.ball.x, s.ball.y);
    this.goals = level.goals.map((g) => new Goal(g.side, g.lineX, g.centerY, g.defends));
    /** 本步产生的事件（goal 等），由 Match 消费后清空。 */
    this.events = [];
  }

  /** 查询某队进攻的对方球门（red 攻左 el-03，blue 攻右 el-04）。 */
  targetGoalOf(team) {
    return this.goals.find((g) => g.defends !== team) || null;
  }

  /**
   * 单 tick 推进。intents 顺序与 this.players 一致（[red, blue]）。
   * @param {Array<{moveX:number,moveY:number,kick:boolean}>} intents
   * @param {number} dt 固定步长（TICK_DT_S）
   */
  step(intents, dt) {
    this.events.length = 0;
    this.ball.kickedThisTick = false;

    // 1) 球员：移动 + 射门即时判定（判定在输入所在 tick 内完成）
    for (let i = 0; i < this.players.length; i++) {
      this.players[i].tick(intents[i], this.ball, (ix, iy) => this.ball.impulse(ix, iy), dt);
      this.clampPlayer(this.players[i]);
    }

    // 2) 带球接触：推球出体 + 法向速度传递（玩家推着球走）
    for (let i = 0; i < this.players.length; i++) {
      this.resolveDribble(this.players[i]);
    }

    // 3) 球积分（摩擦 + 截断 + 位移）
    this.ball.integrate(dt);

    // 4) 进球判定（球心越线 ∧ 门嘴带内）——先于边界反弹，保证门内区域可进入
    for (let i = 0; i < this.goals.length; i++) {
      const goal = this.goals[i];
      if (goal.containsBall(this.ball)) {
        this.events.push({
          type: 'goal',
          scorer: goal.defends === 'red' ? 'blue' : 'red',
          conceder: goal.defends,
          goalElementId: goal.side === 'left' ? 'el-03' : 'el-04',
          sfx: goal.sfxSchedule(),
        });
      }
    }

    // 5) 边界：墙反弹（门嘴带内端墙让位于球网，允许球心越线）
    this.resolveBounds();
  }

  /** 球员不出场：中心 clamp 到边线内缩矩形（不进网，可用身体在门线前阻挡）。 */
  clampPlayer(p) {
    if (p.x < PITCH.INSET) { p.x = PITCH.INSET; p.vx = 0; }
    if (p.x > PITCH.W - PITCH.INSET) { p.x = PITCH.W - PITCH.INSET; p.vx = 0; }
    if (p.y < PITCH.INSET) { p.y = PITCH.INSET; p.vy = 0; }
    if (p.y > PITCH.H - PITCH.INSET) { p.y = PITCH.H - PITCH.INSET; p.vy = 0; }
  }

  /** 玩家-球接触：重叠推出 + 法向速度不低于玩家法向速度（带球手感）。 */
  resolveDribble(p) {
    const minD = PLAYER.SIZE / 2 + this.ball.radius; // 8 + 4 = 12
    const dx = this.ball.x - p.x;
    const dy = this.ball.y - p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 >= minD * minD || d2 === 0) return;
    const d = Math.sqrt(d2);
    const nx = dx / d;
    const ny = dy / d;
    // 位置推出（只动球，不动玩家）
    this.ball.x = p.x + nx * minD;
    this.ball.y = p.y + ny * minD;
    // 法向速度补齐到玩家速度（推球）；已更快则不打扰
    const vn = this.ball.vx * nx + this.ball.vy * ny;
    const pv = p.vx * nx + p.vy * ny;
    if (pv > vn) {
      this.ball.impulse((pv - vn) * nx, (pv - vn) * ny);
    }
  }

  /** 边界反弹：四墙 + 球网内的深度/侧壁约束。全部用球心坐标判定。 */
  resolveBounds() {
    const b = this.ball;
    const r = b.radius;
    const inLeftMouth = b.y > this.goals[0].mouthTop && b.y < this.goals[0].mouthBottom;
    const inRightMouth = b.y > this.goals[1].mouthTop && b.y < this.goals[1].mouthBottom;
    const leftLine = this.goals[0].lineX;
    const rightLine = this.goals[1].lineX;
    const netDepth = this.goals[0].depth;

    // 上下边墙（全场恒定）
    const top = PITCH.INSET + r;
    const bottom = PITCH.H - PITCH.INSET - r;
    if (b.y < top) { b.y = top; b.vy = -b.vy; }
    if (b.y > bottom) { b.y = bottom; b.vy = -b.vy; }

    // 左端：门嘴带外 = 端墙反弹；带内 = 球网（可越线，网底/网侧约束）
    if (!inLeftMouth) {
      const wallX = leftLine + r;
      if (b.x < wallX && b.x > leftLine - netDepth) { b.x = wallX; b.vx = -b.vx; }
    } else if (b.x < leftLine) {
      const backX = leftLine - netDepth + r; // 网底
      if (b.x < backX) { b.x = backX; b.vx = -b.vx; }
      const netTop = this.goals[0].mouthTop + r;
      const netBottom = this.goals[0].mouthBottom - r;
      if (b.y < netTop) { b.y = netTop; b.vy = -b.vy; }
      if (b.y > netBottom) { b.y = netBottom; b.vy = -b.vy; }
    }

    // 右端（对称）
    if (!inRightMouth) {
      const wallX = rightLine - r;
      if (b.x > wallX && b.x < rightLine + netDepth) { b.x = wallX; b.vx = -b.vx; }
    } else if (b.x > rightLine) {
      const backX = rightLine + netDepth - r;
      if (b.x > backX) { b.x = backX; b.vx = -b.vx; }
      const netTop = this.goals[1].mouthTop + r;
      const netBottom = this.goals[1].mouthBottom - r;
      if (b.y < netTop) { b.y = netTop; b.vy = -b.vy; }
      if (b.y > netBottom) { b.y = netBottom; b.vy = -b.vy; }
    }
  }

  /** 重置到开球位（el-05/06/07：复位、速度清零）。 */
  resetToKickoff() {
    const s = this.level.spawns;
    this.players[0].place(s.red.x, s.red.y);
    this.players[1].place(s.blue.x, s.blue.y);
    this.ball.place(s.ball.x, s.ball.y);
    this.events.length = 0;
  }

  /** per_game 统计：射门数（双方 player.shotCount 之和）。 */
  totalShots() {
    return this.players[0].shotCount + this.players[1].shotCount;
  }

  /** per_game 统计：触球数（球侧累计，含射门与带球触碰）。 */
  totalTouches() {
    return this.ball.touchCount;
  }
}
