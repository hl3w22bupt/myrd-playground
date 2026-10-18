// game — 装配入口（kernel×scene×input×telemetry 接线；wheat-squad game.ts 判例形制）
// spec: 埋点四件+八键（hint_shown@0ms → first_tap → first_loop_complete → restart_clicked）
// QA 接缝：sink 可注入（telemetrySink 判例），默认进程缓冲零外发零落盘。

import { configFromSpec, type GameConfig } from "./kernel/config.ts";
import { createRun, type SimState } from "./kernel/state.ts";
import { stepSim, placeTurret, upgradeTurret, toggleSpeed, restartRun } from "./kernel/sim.ts";
import { makeEmitter, telemetrySink, type Emitter, type TelemetrySink } from "./telemetry/emitter.ts";
import { titleHit, settlementHit, resolvePointer } from "./input/touch.ts";
import { HINT_TEXT } from "./render/guidance.ts";
import type { UiState } from "./render/renderer.ts";

export const GAME_ID = "line3-tower-defense";

export type GamePhase = "title" | "running" | "settled";

export interface GameOptions {
  seed?: number;
  cfg?: GameConfig;
  specRow?: unknown;        // approved 导出件（cfg 缺省时装配）
  sink?: TelemetrySink;     // QA 接缝
  recordHashes?: boolean;   // det-1 对拍开关
}

export class Game {
  readonly id = GAME_ID;
  readonly cfg: GameConfig;
  phase: GamePhase = "title";
  sim!: SimState;
  ui: UiState = { pendingTile: null, selectedTurretId: null, showHud: true };
  readonly telemetry: Emitter;
  private readonly seed: number;
  private sessionMs = 0;      // 标题屏会话毫秒（first_tap 5s 窗锚）
  hintShown = false;          // 首帧 hint_shown 出账标志（public：boot 面读取）
  private runStartEmitted = false;
  private lastLatency = 0;

  constructor(opts: GameOptions = {}) {
    this.cfg = opts.cfg ?? configFromSpec(opts.specRow ?? {});
    this.seed = opts.seed ?? this.cfg.defaultSeed;
    this.telemetry = makeEmitter(opts.sink ?? telemetrySink);
    this.sim = createRun(this.cfg, this.seed, opts.recordHashes ?? false);
  }

  /** 标题屏推进（真实时间面：first_tap 5000ms 窗与渲染帧解耦） */
  advanceTitle(ms: number): void {
    if (this.phase !== "title") return;
    this.sessionMs += ms;
    if (!this.hintShown) {
      this.hintShown = true;
      this.telemetry.emit("hint_shown", 0, { text: HINT_TEXT }); // hint_shown@0ms（a5 锚）
    }
  }

  /** 单 tick 步进 + 事件→埋点出账（事件消费面唯一入口） */
  tick(n = 1): void {
    if (this.phase !== "running") return;
    for (let i = 0; i < n; i += 1) {
      stepSim(this.sim, this.cfg);
      this.drainEvents();
      if (this.sim.status !== "running") { this.phase = "settled"; break; }
    }
  }

  /** 指针按下（逻辑坐标）——操作路径 5 条统一入口；返回本动作是否有效 */
  pointerDown(x: number, y: number): boolean {
    if (this.phase === "title") {
      const a = titleHit(x, y);
      if (a.kind === "start") {
        this.phase = "running";
        this.emitRunStart();
        this.telemetry.emit("first_tap", this.sessionMs); // 会话首点按（once）
        return true;
      }
      return false;
    }
    if (this.phase === "settled") {
      const a = settlementHit(x, y);
      if (a.kind === "restart") {
        const count = this.sim.restartCount + 1;
        const { state } = restartRun(this.sim, this.cfg);
        this.sim = state;
        this.phase = "running";
        this.ui = { pendingTile: null, selectedTurretId: null, showHud: true };
        this.telemetry.emit("restart_clicked", this.sim.tick * this.cfg.fixedStepMs, { count });
        this.emitRunStart();
        return true;
      }
      return false;
    }
    // running
    const a = resolvePointer(this.sim, this.cfg, x, y, this.ui);
    switch (a.kind) {
      case "tile":
        this.ui.pendingTile = `${a.col},${a.row}`;
        this.ui.selectedTurretId = null;
        return true;
      case "select-turret":
        this.ui.selectedTurretId = a.turretId;
        this.ui.pendingTile = null;
        return true;
      case "confirm-place": {
        const [c, r] = (this.ui.pendingTile as string).split(",").map(Number);
        const res = placeTurret(this.sim, this.cfg, c, r);
        this.lastLatency = res.latencyMs;
        this.telemetry.emit("feedback_latency_ms", this.sim.tick * this.cfg.fixedStepMs, { value: res.latencyMs, action: "place" });
        if (res.ok && this.sim.firstPlacementTick === this.sim.tick) {
          this.telemetry.emit("first_placement_at", this.sim.tick * this.cfg.fixedStepMs); // once（a1 锚）
        }
        if (res.ok) this.ui.pendingTile = null;
        return res.ok;
      }
      case "confirm-upgrade": {
        const res = upgradeTurret(this.sim, this.cfg, this.ui.selectedTurretId as number);
        this.lastLatency = res.latencyMs;
        this.telemetry.emit("feedback_latency_ms", this.sim.tick * this.cfg.fixedStepMs, { value: res.latencyMs, action: "upgrade" });
        if (res.ok) this.ui.selectedTurretId = null;
        return res.ok;
      }
      case "speed-toggle": {
        const res = toggleSpeed(this.sim);
        this.lastLatency = res.latencyMs;
        this.telemetry.emit("feedback_latency_ms", this.sim.tick * this.cfg.fixedStepMs, { value: res.latencyMs, action: "speed" });
        return res.ok;
      }
      default:
        return false;
    }
  }

  /** ×1/×2 步频（loop 装配层按倍率取 tick；步长恒 16ms） */
  stepFrame(elapsedMs: number): void {
    if (this.phase !== "running") return;
    const per = this.cfg.fixedStepMs;
    const want = Math.floor(elapsedMs / per) * this.sim.speed;
    if (want > 0) this.tick(Math.min(want, 16));
  }

  private emitRunStart(): void {
    if (this.runStartEmitted && this.sim.restartCount === 0) return;
    this.telemetry.emit("run_start", this.sim.tick * this.cfg.fixedStepMs, { seed: this.sim.seed });
    this.runStartEmitted = true;
  }

  private drainEvents(): void {
    for (const ev of this.sim.events) {
      if (ev.type === "run-end") {
        this.telemetry.emit("run_end", this.sim.tick * this.cfg.fixedStepMs, {
          run_duration_ms: (this.sim.endTick || this.sim.tick) * this.cfg.fixedStepMs,
          reason: ev.reason,
        });
      }
      if (ev.type === "wave-clear" && ev.wave === 1 && this.sim.firstLoopTick === this.sim.tick) {
        this.telemetry.emit("first_loop_complete", this.sim.firstLoopTick * this.cfg.fixedStepMs); // once（a5 锚）
      }
    }
    this.sim.events.length = 0;
  }

  entries() { return this.telemetry.entries(); }
  lastFeedbackLatencyMs(): number { return this.lastLatency; }
}
