// e-telemetry — 埋点发射器：键名常量逐字符=fnd-1 机判锚；默认只缓冲零外发零落盘（wheat-squad 判例）
// spec: entities/e-telemetry · meta.telemetryFields（八键，含四件定名 first_tap/hint_shown/
//       first_loop_complete/restart_clicked 逐字符）· QA 接缝 = sink 注入（不触平台代码）

export const EVENT_NAMES = [
  "run_start",
  "run_end",
  "first_tap",
  "hint_shown",
  "first_loop_complete",
  "restart_clicked",
  "first_placement_at",
  "feedback_latency_ms",
] as const;
export type EventName = (typeof EVENT_NAMES)[number];

export interface TelemetryEvent { name: EventName; atMs: number; [k: string]: unknown }
export type TelemetrySink = (event: TelemetryEvent) => void;

/** 默认 sink：进程级缓冲（零网络零落盘）；resetTelemetry() 供多局连跑清账 */
const buffer: TelemetryEvent[] = [];
export const telemetrySink: TelemetrySink = (event) => { buffer.push(event); };
export function telemetryEntries(): TelemetryEvent[] { return buffer.slice(); }
export function resetTelemetry(): void { buffer.length = 0; }

/** 实例化发射器（Game 每局持有；sink 可注入 → QA 抓取面） */
export interface Emitter {
  emit(name: EventName, atMs: number, fields?: Record<string, unknown>): void;
  entries(): TelemetryEvent[];
}
export function makeEmitter(sink: TelemetrySink = telemetrySink): Emitter {
  const local: TelemetryEvent[] = [];
  const emit = (name: EventName, atMs: number, fields: Record<string, unknown> = {}) => {
    const ev: TelemetryEvent = { name, atMs, ...fields };
    local.push(ev);
    sink(ev);
  };
  return { emit, entries: () => local.slice() };
}
