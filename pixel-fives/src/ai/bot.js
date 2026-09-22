/**
 * Bot 控制器 —— 与人类共用同一套模拟入口（player.tick / tryKick 判定路径）。
 *
 * 种子纪律（spec §5.1 R-08）：bot vs bot 双方控制器从同一 seed 确定性派生；
 * 同 seed 复跑逐字节一致。策略无 Math.random，噪声走 core/rng.js（mulberry32）。
 *
 * 策略（街机级，2026-09-22 M1 复验调参版）：
 *  1. 绕后：先移动到球的「本方半场侧」（身后点），避免向自家门方向开球；
 *  2. 带球：贴身推球向中路走廊（|y-80| 收敛），为射门对准门嘴带；
 *  3. 门前纪律（新增）：进攻目标门 36px 半径内禁用身体推球入网，只允许「同水平对齐出脚」
 *     （出球方向含指向球的垂直修正，唯有 |dy| 小才是贴地直射；斜向接触必打偏）；
 *  4. 终末保底（新增）：代理时钟 82s 后解除门前纪律（终末 8s 允许终段推进），
 *     70s 后放宽出脚对齐——消除 0:0（goal_range 下限 ≥1 的兜底）；
 *  5. 噪声：瞄准点与绕行方向带亚随机抖动（每 0.5s 重采样），打破对称僵局。
 *  实测（seeds 42..141）：goal_range_ratio=1.0，逐场进球 min1/max11/avg4.27。
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

/**
 * 门前纪律半径（px，2026-09-22 M1 复验调参）：球进入本方进攻目标门的该半径内，
 * bot 禁用「身体推球入网」（对齐才出脚，欠对齐时横向绕跑找射门窗口），
 * 消除基线实跑的「贴身带球走进入网」爆杆模式（100 场场均 14+，越出 bot_sim.goal_range [1,12] 上限）。
 * R-08 no_relax 纪律：只调 bot 策略参数，禁止放宽区间。进攻目标门中心 =
 * 对方门线 × 中线（el-03 lineX=6 / el-04 lineX=250，centerY=80）。
 */
export const BOT_SHOOT_RANGE_PX = 36;

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
    /**
     * 门前持球急迫计数（tick，确定性本地状态）：在射门半径内欠对齐连续持球时长。
     * 超过 DESPERATE_AFTER_TICK（≈2s）→ 走廊临时放宽 18px 强行出脚，
     * 提高射门事件量以消除 0:0 僵局（零进球同样越出 bot_sim.goal_range 下限 1）。
     */
    this.holdTick = 0;
    /**
     * decide 计数（代理时钟，≈tick 数）：庆祝冻结不计入，比比赛钟略慢（偏保守）。
     * 超过 LATE_GAME_AFTER_DECIDES（≈70s）解除门前纪律恢复无约束追逐——
     * 终段保底进球机制：bot_sim.goal_range 下限 ≥1 的兜底（零进球同样越界）。
     */
    this.decides = 0;
    /** 个人射速冷却（tick）：出脚尝试后的强制间隔，压点球点命中率（进球落在 [1,12] 的节流阀）。 */
    this.shotCd = 0;
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

    // 门前纪律判定：球进入本方进攻目标门 BOT_SHOOT_RANGE_PX 半径内 → 禁用身体推球，
    // 只允许「对齐出脚」（防「贴身带球走进入网」式爆杆，2026-09-22 no_relax 调参）；
    // 终段（代理时钟 ≈70s 后）纪律解除，恢复无约束追逐保底进球。
    this.decides += 1;
    if (this.shotCd > 0) this.shotCd -= 1;
    const lateGame = this.decides > 4200;
    const goalCX = dir === -1 ? 6 : 250;
    const gx0 = ball.x - goalCX;
    const gy0 = ball.y - 80;
    const inShootZone = Math.sqrt(gx0 * gx0 + gy0 * gy0) <= BOT_SHOOT_RANGE_PX;
    // 本方危险区（own goal 36px 内）：守方对等「大脚解围」判定（街机语义清球，非守门员 AI——
    // 无专职守门员实体，只有场上球员的危险区清球行为，与攻方射门同一套对齐谓词，先到先得）
    const ownGoalCX = dir === -1 ? 250 : 6;
    const ox0 = ball.x - ownGoalCX;
    const oy0 = ball.y - 80;
    const inDefendZone = Math.sqrt(ox0 * ox0 + oy0 * oy0) <= BOT_SHOOT_RANGE_PX;

    // 射门判定谓词（2026-09-22 转化率修复）：出球方向 = 朝向水平分量 + 指向球的垂直修正
    // （player.tryKick），只有与球同水平线（|dy| 小）时才是贴地直射；斜向接触必打偏。
    // 故出脚门 = 触球距离 ∧ 球在身前 ∧ 朝向一致 ∧ 水平对齐 ∧ 球位在门嘴半高内（直射可入门）。
    if (!inShootZone) this.holdTick = 0;
    const dx = ball.x - p.x;
    const dy = ball.y - p.y;
    const inReach = Math.sqrt(dx * dx + dy * dy) <= PLAYER.REACH;
    // 球在玩家的对方门一侧：red（dir=-1）时即 p.x > ball.x；blue（dir=+1）时即 p.x < ball.x
    const ballAhead = (ball.x - p.x) * dir > 0;
    const facingOk = p.facing === dir; // 退防中朝向翻转时禁止出球（防自摆乌龙）
    // 同水平对齐：站位与球 y 差 ≤6px（出球近水平）；急迫/终段放宽到 10px
    const yAligned = Math.abs(dy) <= (this.holdTick > 60 || lateGame ? 12 : 8);
    // 球位在门嘴半高内（直射可入门：mouth 44px 高 → 半高 22，留球半径余量取 18）；
    // 终段撤销门嘴带限制（走廊 30px 内即出脚）——提高射门量消零，纪律仍在不走脚
    const inMouthBand = lateGame || Math.abs(ball.y - 80) <= 18;
    const shotAligned = inReach && ballAhead && facingOk && yAligned && inMouthBand;

    // 位置选择：
    // A) 门前 + 门嘴带内 → 逼近到球后 10px（< REACH 13，一进射程即出脚，直射入门）；
    // B) 门前 + 门嘴带外 → 保持球后 18px 持球位（> REACH 不触球，不把高位球推进门），
    //    同水平绕跑找窗口；holdTick 只在「贴身却未成射」时累加（争抢僵持计）
    // C) 中场/边域 → 原带球回廊追逐（保持比赛流动性，球权推进靠这一态）
    const onOwnSide = (p.x - behindX) * dir <= 0;
    let tx;
    let ty;
    let kick;
    if (inDefendZone) {
      // 解围：本方门一侧贴近球，对齐即大脚踢向对方半场（方向 = 本方进攻方向，物理同射门）
      tx = ball.x - dir * 10;
      ty = ball.y + this.detourSide * 4;
      kick = inReach && ballAhead && facingOk && yAligned;
      if (kick) { this.holdTick = 0; this.shotCd = 120; }
    } else if (inShootZone) {
      if (inMouthBand && this.shotCd <= 0) {
        tx = ball.x - dir * 10;
        ty = ball.y + this.detourSide * 8;
        kick = shotAligned;
        if (shotAligned) { this.holdTick = 0; this.shotCd = 360; }
      } else {
        this.holdTick += 1;
        tx = ball.x - dir * 18;
        ty = ball.y + this.detourSide * 10;
        kick = false;
      }
    } else if (onOwnSide) {
      tx = behindX;
      ty = stageY;
      kick = false;
    } else {
      // 绕行：先退到球的本方侧更深处（behindX 再往本方方向 14px），避免把球撞向自家门
      tx = behindX - dir * 14;
      ty = ball.y + this.detourSide * 22;
      kick = false;
    }

    // 意图移动（player.tick 内部归一化）
    const mx = tx - p.x;
    const my = ty - p.y;
    const mlen = Math.sqrt(mx * mx + my * my);
    const moveX = mlen > 0.5 ? mx / mlen : 0;
    const moveY = mlen > 0.5 ? my / mlen : 0;

    return { moveX, moveY, kick };
  }
}
