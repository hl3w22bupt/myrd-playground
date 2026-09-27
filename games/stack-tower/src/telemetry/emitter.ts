/**
 * 五钩子埋点发射器（实体 e-telemetry-emitter，spec v1.2 acc-e1 契约）。
 *
 * 契约：
 *  - 事件名枚举封闭：{session_start, session_end, block_place, perfect_hit, game_over, restart}
 *    （任务书口径「五钩子」，session_start/end 计一对）；
 *  - 每事件载荷必含：双时间戳（client_ts ISO8601 + mono_ms 单调毫秒）+ anon_id（本地随机 UUID v4，零 PII）
 *    + schema_version + client_version；
 *  - perfect_hit 额外携带 dispatch/play 毫秒（acc-j3 音画 ≤50ms 可测点）；
 *  - 异常隔离：emit 全程 catch，埋点故障不得影响游戏逻辑；
 *  - 零 PII：不采集 IP / 设备号 / 账号标识 / 精确位置。
 */

/** 事件名封闭枚举（acc-e1：枚举外事件名 = 违契约） */
export const TELEMETRY_EVENTS = [
  'session_start',
  'session_end',
  'block_place',
  'perfect_hit',
  'game_over',
  'restart',
] as const;

export type TelemetryEvent = (typeof TELEMETRY_EVENTS)[number];

/** 契约版本（载荷结构变更时 +1；与 spec v1.2 analytics.hooks 对齐） */
export const TELEMETRY_SCHEMA_VERSION = '1';
/** 客户端版本（与 games/stack-tower/package.json version 同步维护） */
export const TELEMETRY_CLIENT_VERSION = '0.1.0-r4';

/** 单条埋点载荷（acc-e1 三要素） */
export interface TelemetryPayload {
  event: TelemetryEvent;
  /** 双时间戳之一：UTC ISO8601 */
  client_ts: string;
  /** 双时间戳之二：单调毫秒（perf.now 系，由注入时钟提供） */
  mono_ms: number;
  /** 匿名会话级 UUID v4（本地随机，零 PII） */
  anon_id: string;
  schema_version: string;
  client_version: string;
  /** acc-j3 可测点：perfect_hit 专有——dispatch（内核事件进入翻译站）毫秒 */
  dispatch_ms?: number;
  /** acc-j3 可测点：perfect_hit 专有——AudioContext 播放调用毫秒 */
  play_ms?: number;
  /** 事件自由数据（level/combo/reason 等，仅计数与枚举，零 PII） */
  data?: Record<string, string | number | boolean>;
}

export interface TelemetryDeps {
  /** 单调毫秒时钟（表现时钟，非内核仿真时间） */
  now(): number;
  /** ISO8601 时钟 */
  isoNow(): string;
  /** UUID v4 提供者（默认 crypto.getRandomValues；无 crypto 环境由调用方注入替身） */
  uuid(): string;
  /** 匿名 id 持久化读写（默认 localStorage；null = 无持久化环境，退化为会话级随机） */
  loadAnonId(): string | null;
  saveAnonId(id: string): void;
  /** 埋点出口（可注入采集器；默认 no-op，绝不阻塞） */
  sink(payload: TelemetryPayload): void;
}

/** UUID v4（crypto 可用时）：零 PII，本地随机 */
function defaultUuid(): string {
  const c = typeof crypto !== 'undefined' ? crypto : undefined;
  if (c?.getRandomValues) {
    const b = new Uint8Array(16);
    c.getRandomValues(b);
    b[6] = (b[6]! & 0x0f) | 0x40;
    b[8] = (b[8]! & 0x3f) | 0x80;
    const hex = [...b].map((x) => x.toString(16).padStart(2, '0'));
    return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex
      .slice(8, 10)
      .join('')}-${hex.slice(10, 16).join('')}`;
  }
  return `anon-${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}

export interface TelemetryEmitter {
  /** 匿名 id（创建时解析/生成一次） */
  readonly anonId: string;
  /** 发射一条事件（事件名不在封闭枚举内则丢弃；异常全隔离） */
  emit(event: TelemetryEvent, extra?: { dispatch_ms?: number; play_ms?: number; data?: Record<string, string | number | boolean> }): void;
}

export function createTelemetryEmitter(deps: TelemetryDeps): TelemetryEmitter {
  let anonId: string;
  try {
    const stored = deps.loadAnonId();
    anonId = stored ?? defaultUuid();
    if (!stored) deps.saveAnonId(anonId);
  } catch {
    anonId = defaultUuid(); // 持久化不可用 → 会话级随机（仍零 PII）
  }

  return {
    anonId,
    emit(event, extra = {}) {
      try {
        if (!(TELEMETRY_EVENTS as readonly string[]).includes(event)) return; // 枚举封闭
        deps.sink({
          event,
          client_ts: deps.isoNow(),
          mono_ms: deps.now(),
          anon_id: anonId,
          schema_version: TELEMETRY_SCHEMA_VERSION,
          client_version: TELEMETRY_CLIENT_VERSION,
          ...(extra.dispatch_ms !== undefined ? { dispatch_ms: extra.dispatch_ms } : {}),
          ...(extra.play_ms !== undefined ? { play_ms: extra.play_ms } : {}),
          ...(extra.data ? { data: extra.data } : {}),
        });
      } catch {
        // 异常隔离：埋点故障不影响游戏逻辑
      }
    },
  };
}

/** localStorage 依赖组装（浏览器形态；无 localStorage 返回会话级替身） */
export function browserTelemetryDeps(now: () => number): TelemetryDeps {
  const isoNow = () => new Date().toISOString();
  let sessionAnon: string | null = null;
  const load = (): string | null => {
    try {
      return localStorage.getItem('st.telemetry.anonId');
    } catch {
      return sessionAnon;
    }
  };
  const save = (id: string): void => {
    try {
      localStorage.setItem('st.telemetry.anonId', id);
    } catch {
      sessionAnon = id; // 无持久化 → 会话级
    }
  };
  return { now, isoNow, uuid: defaultUuid, loadAnonId: load, saveAnonId: save, sink: () => {} };
}
