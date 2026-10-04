/**
 * 对局：Match —— 关卡 pitch 的对局流程状态机（spec §4.2 + el-10）。
 *
 * 阶段：playing →（进球）→ celebration（冻结 1.2s，el-10）→ playing → … → fulltime（90s）。
 * 确定性红线：本文件禁止 Math.random / Date.now；时间只由固定 dt 累加。
 */
import { World } from './world.js';
import { MATCH_DURATION_S, GOAL_CELEBRATION_S, TICK_DT_S } from './constants.js';
import { PITCH_LEVEL } from '../levels/pitch.js';

export class Match {
  /**
   * @param {{level?:object, seed?:number}} opts
   */
  constructor({ level = PITCH_LEVEL, seed = 0 } = {}) {
    this.level = level;
    this.world = new World(level, seed);
    this.scores = { red: 0, blue: 0 };
    this.timeS = 0;
    this.phase = 'playing'; // playing | celebration | fulltime
    /** el-10 庆祝层剩余时长（s）。 */
    this.celebrationT = 0;
    /** 最近一次进球事件（供庆祝层渲染）。 */
    this.lastGoal = null;
    /** 首次触球时刻（s，el-09 onboarding 淡出依据；null = 尚未触球）。 */
    this.firstTouchS = null;
    /** 本步排程的音效事件 [{id, at_s, t}]（web 层消费；headless 仅记录）。 */
    this.sfxEvents = [];
  }

  /** 双方 intent 一步推进。dt 建议恒为 TICK_DT_S。 */
  step(dt, intentRed, intentBlue) {
    if (this.phase === 'fulltime') return;

    if (this.phase === 'celebration') {
      // el-10：冻结对局（world 不步进），只走庆祝计时
      this.celebrationT -= dt;
      if (this.celebrationT <= 0) {
        this.celebrationT = 0;
        this.resetForKickoff();
      }
      return;
    }

    // playing：推进模拟
    this.world.step([intentRed, intentBlue], dt);
    this.timeS += dt;

    // el-09：首次触球时刻（onboarding 淡出起点，UI 集成测试断言用）
    if (this.firstTouchS === null && this.world.ball.touchCount > 0) {
      this.firstTouchS = this.timeS;
    }

    // 进球链路（el-10）：比分 +1 → 排程 A08（goal_sfx_at_s=0.0）→ 庆祝冻结
    for (const ev of this.world.events) {
      if (ev.type === 'goal') {
        this.scores[ev.scorer] += 1;
        this.lastGoal = ev;
        this.sfxEvents.push({ id: ev.sfx.id, at_s: ev.sfx.at_s, t: this.timeS });
        this.phase = 'celebration';
        this.celebrationT = GOAL_CELEBRATION_S;
        this.world.events.length = 0;
        return; // 进球当步冻结，不再继续处理
      }
    }

    // 终局：计时归零冻结（平局合法，M1 无加时）；1e-9 容差吸收浮点累加尾差
    if (this.timeS >= MATCH_DURATION_S - 1e-9) {
      this.timeS = MATCH_DURATION_S;
      this.phase = 'fulltime';
    }
  }

  /** 中圈重开（el-05/06/07 复位、速度清零、无开球特权），恢复 running。 */
  resetForKickoff() {
    this.world.resetToKickoff();
    this.phase = 'playing';
  }

  /** 「再来一局」：比分清零、计时归零、回到开球。 */
  restart() {
    this.scores = { red: 0, blue: 0 };
    this.timeS = 0;
    this.phase = 'playing';
    this.celebrationT = 0;
    this.lastGoal = null;
    this.firstTouchS = null;
    this.sfxEvents.length = 0;
    this.world.resetToKickoff();
  }

  /** el-09 onboarding 提示当前不透明度（1 可见 → 0 淡出完毕）。 */
  onboardingAlpha() {
    if (this.firstTouchS === null) return 1;
    // 首次触球即开始 0.6s 淡出（完成时刻 ≤ 首触后 3s，满足 onboarding.hide_after_first_touch_s）
    const fade = 0.6;
    const a = 1 - (this.timeS - this.firstTouchS) / fade;
    return a <= 0 ? 0 : a;
  }

  /** 剩余时间（s，HUD 显示用，clamp ≥0）。 */
  timeLeftS() {
    const left = MATCH_DURATION_S - this.timeS;
    return left < 0 ? 0 : left;
  }
}

/** M1 固定步长（60Hz）——对局一律以该步长推进。 */
export const MATCH_TICK_DT = TICK_DT_S;
