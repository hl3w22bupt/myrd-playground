// telemetry/telemetry.ts — 埋点单一判读出口（line4-unblock-jam · 中性脚手架）
//
// spec entities[e-telemetry-hub] + acc-07 写死面：
//   对外键集合 ≡ spec numeric.telemetry 三列键集合（严格全等）——键来自生成件
//   src/generated/spec-data.mjs（单源=契约件），本文件零手抄键名。
//   全游戏埋点只许经本 hub；旁路 platform.track 打 metric 键 = 契约违例。
import { TELEMETRY_COLUMNS, TELEMETRY_KEYS, SPEC_ANCHOR } from '../generated/spec-data.mjs';
import type { Platform } from '../platform/index.ts';

export interface TelemetryColumn { key: string; target: string; sampling: string; }

export const TELEMETRY_SPEC_KEYS: readonly string[] = TELEMETRY_KEYS;
export const TELEMETRY_SPEC_COLUMNS: readonly TelemetryColumn[] = TELEMETRY_COLUMNS;
export const TELEMETRY_SPEC_ANCHOR = SPEC_ANCHOR;

export interface TelemetrySample { key: string; value: number; }

/**
 * 单一判读出口：键必须 ∈ spec 三列键集合，否则抛错（fail-closed，不静默丢点）。
 * sink 传入 = 宿主平台 track；缺省缓冲在内存（headless 冒烟读缓冲判读）。
 */
export function createTelemetryHub(sink?: { track(eventId: string, payload: Record<string, unknown>): void }) {
  const buffer: TelemetrySample[] = [];
  return {
    specKeys: TELEMETRY_SPEC_KEYS,
    columns: TELEMETRY_SPEC_COLUMNS,
    record(key: string, value: number): void {
      if (!TELEMETRY_SPEC_KEYS.includes(key)) {
        throw new Error(`[telemetry] 非契约键被拒绝：${key}（键集合必须 ≡ numeric.telemetry 三列）`);
      }
      buffer.push({ key, value });
      sink?.track(`metric.${key}`, { value });
    },
    drain(): TelemetrySample[] { return buffer.splice(0, buffer.length); },
    size(): number { return buffer.length; },
  };
}

/** 键集合全等机判（acc-07 口径）：given ⊆ spec 且 spec ⊆ given → 全等 */
export function keySetParity(given: readonly string[]): { equal: boolean; missing: string[]; extra: string[] } {
  const g = new Set(given);
  const s = new Set(TELEMETRY_SPEC_KEYS);
  return {
    equal: g.size === s.size && [...s].every((k) => g.has(k)),
    missing: [...s].filter((k) => !g.has(k)),
    extra: [...g].filter((k) => !s.has(k)),
  };
}
