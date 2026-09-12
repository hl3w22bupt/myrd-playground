/**
 * Bot 控制器 —— 与人类共用同一套模拟入口（player.tick / tryKick 判定路径）。
 *
 * 种子纪律（spec §5.1 R-08）：bot vs bot 双方控制器从同一 seed 确定性派生；
 * 同 seed 复跑逐字节一致。策略无 Math.random，噪声走 core/rng.js（mulberry32）。
 *
 * 策略（街机级）：
 *  1. 绕后：先移动到球的「本方半场侧」（身后点），避免向自家门方向开球；
 *  2. 带球：贴身推球向中路走廊（|y-80| 收敛），为射门对准门嘴带；
 *  3. 射门：处于触球距离、球在身前、球已进中路走廊时按下射门（冷却 0.3s 由 player 管束）；
 *  4. 噪声：瞄准点与绕行方向带亚随机抖动（每 0.5s 重采样），打破对称僵局。
 */
import { Rng } from '../core/rng.js';
import { PLAYER } from '../core/constants.js';
import { PITCH_LEVEL } from '../levels/pitch.js';

/** 由对局 seed 确定性派生单队控制器种子（双方同一套 seed ⇒ 同一双眼）。 */
export function deriveBotSeed(seed, team) {
  const s = seed >>> 0;
  return team === 'red' ? (s ^ 0x9e3779b9) >>> 0 : (s + 0x85ebca6b) >>> 0;
}

/** 进攻方向：red 攻左（dirX=-1），blue 攻右（dirX=+1）。 */
export function attackDirOf(team) {
  return team === 'red' ? -1 : 1;
}

export class BotController {
  /**
   * @param {'red'|'blue'} team
   * @param {number} seed 对局种子（双方同 seed）
   * @param {object} level 关卡（取出生点与球场几何）
   */
  constructor(team, seed, level = PITCH_LEVEL) {
    this.team = team;
    this.rng = new Rng(deriveBotSeed(seed, team));
    this.aimNoiseY = 0;      // 射门瞄准纵向噪声（±10px，门嘴带内）
    this.detourSide = 1;     // 绕行侧（±1）
    this.noiseTick = 0;
    /** 中路走廊半宽：|ball.y - 80| ≤ LANE 才射门，否则先带球回廊。 */
    this.laneHalf = 30;
  }

  /** 每 0.5s（30 tick）重采样一次噪声，重采样本身确定性。 */
  resampleNoise() {
    this.aimNoiseY = (this.rng.next() * 2 - 1) * 10;
    this.detourSide = this.rng.next() < 0.5 ? -1 : 1;
  }

  /**
   * 决策本 tick 意图。
   * @param {import('../core/world.js').World} world 只读视图（决策不改世界状态）
   * @returns {{moveX:number,moveY:number,kick:boolean}}
   */
  decide(world) {
    if (this.noiseTick === 0) this.resampleNoise();
    this.noiseTick = (this.noiseTick + 1) % 30;

    const p = world.players[0].team === this.team ? world.players[0] : world.players[1];
    const ball = world.ball;
    const dir = attackDirOf(this.team);         // 进攻方向

    // 身后点：球的本方半场侧 8px（red 在球右侧、blue 在球左侧）
    const behindX = ball.x - dir * 8;
    // 带球回廊：从球的远廊侧轻推（站位比球更偏离中路 6px，推球法向含回廊分量）；
    // 叠加种子噪声（±3px）打破镜像对称，避免双 bot 完全镜像死锁
    const laneOffY = ball.y > 80 ? 6 : ball.y < 80 ? -6 : 0;
    const stageY = ball.y + laneOffY + this.aimNoiseY * 0.3;

    // 位置选择：若已在本方侧（本方门一侧）→ 走身后点对齐球；否则先绕行到本方侧
    // 本方侧判定：玩家在 behindX 的本方门一侧（red: p.x >= behindX；blue: p.x <= behindX）
    const onOwnSide = (p.x - behindX) * dir <= 0;
    let tx;
    let ty;
    if (onOwnSide) {
      tx = behindX;
      ty = stageY;
    } else {
      // 绕行：先退到球的本方侧更深处（behindX 再往本方方向 14px），避免把球撞向自家门
      tx = behindX - dir * 14;
      ty = ball.y + this.detourSide * 22;
    }

    // 意图移动（player.tick 内部归一化）
    const mx = tx - p.x;
    const my = ty - p.y;
    const mlen = Math.sqrt(mx * mx + my * my);
    const moveX = mlen > 0.5 ? mx / mlen : 0;
    const moveY = mlen > 0.5 ? my / mlen : 0;

    // 射门条件：触球距离内 ∧ 球在身前（对方门方向）∧ 朝向与进攻方向一致 ∧ 球已在中路走廊
    const dx = ball.x - p.x;
    const dy = ball.y - p.y;
    const inReach = Math.sqrt(dx * dx + dy * dy) <= PLAYER.REACH;
    // 球在玩家的对方门一侧：red（dir=-1）时即 p.x > ball.x；blue（dir=+1）时即 p.x < ball.x
    const ballAhead = (ball.x - p.x) * dir > 0;
    const facingOk = p.facing === dir; // 退防中朝向翻转时禁止出球（防自摆乌龙）
    const inLane = Math.abs(ball.y - 80) <= this.laneHalf;
    const kick = inReach && ballAhead && facingOk && inLane;

    return { moveX, moveY, kick };
  }
}
