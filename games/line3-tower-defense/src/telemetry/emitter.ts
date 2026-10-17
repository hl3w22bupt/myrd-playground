// e-telemetry — 埋点发射器：键名常量逐字符=fnd-1 机判锚；默认只缓冲零外发零落盘（wheat-squad 判例）
// spec: entities/e-telemetry · meta.telemetryFields（八键，含四件定名）
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
export interface TelemetrySink { (event: { name: EventName; [k: string]: unknown }): void; }
const buffer: Array<{ name: EventName; [k: string]: unknown }> = [];
export const telemetrySink: TelemetrySink = (event) => { buffer.push(event); }; // QA 接缝：默认缓冲，零网络零落盘
export function telemetryEntries(): Array<{ name: EventName; [k: string]: unknown }> { return buffer.slice(); }
