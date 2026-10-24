"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TELEMETRY_CLIENT_VERSION = exports.TELEMETRY_SCHEMA_VERSION = exports.TELEMETRY_EVENTS = void 0;
exports.createTelemetryEmitter = createTelemetryEmitter;
exports.browserTelemetryDeps = browserTelemetryDeps;
/** 事件名封闭枚举（acc-e1：枚举外事件名 = 违契约） */
exports.TELEMETRY_EVENTS = [
    'session_start',
    'session_end',
    'block_place',
    'perfect_hit',
    'game_over',
    'restart',
];
/** 契约版本（载荷结构变更时 +1；与 spec v1.2 analytics.hooks 对齐） */
exports.TELEMETRY_SCHEMA_VERSION = '1';
/** 客户端版本（与 games/stack-tower/package.json version 同步维护） */
exports.TELEMETRY_CLIENT_VERSION = '0.1.0-r4';
/** UUID v4（crypto 可用时）：零 PII，本地随机 */
function defaultUuid() {
    const c = typeof crypto !== 'undefined' ? crypto : undefined;
    if (c?.getRandomValues) {
        const b = new Uint8Array(16);
        c.getRandomValues(b);
        b[6] = (b[6] & 0x0f) | 0x40;
        b[8] = (b[8] & 0x3f) | 0x80;
        const hex = [...b].map((x) => x.toString(16).padStart(2, '0'));
        return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex
            .slice(8, 10)
            .join('')}-${hex.slice(10, 16).join('')}`;
    }
    return `anon-${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}
function createTelemetryEmitter(deps) {
    let anonId;
    try {
        const stored = deps.loadAnonId();
        anonId = stored ?? defaultUuid();
        if (!stored)
            deps.saveAnonId(anonId);
    }
    catch {
        anonId = defaultUuid(); // 持久化不可用 → 会话级随机（仍零 PII）
    }
    return {
        anonId,
        emit(event, extra = {}) {
            try {
                if (!exports.TELEMETRY_EVENTS.includes(event))
                    return; // 枚举封闭
                deps.sink({
                    event,
                    client_ts: deps.isoNow(),
                    mono_ms: deps.now(),
                    anon_id: anonId,
                    schema_version: exports.TELEMETRY_SCHEMA_VERSION,
                    client_version: exports.TELEMETRY_CLIENT_VERSION,
                    ...(extra.dispatch_ms !== undefined ? { dispatch_ms: extra.dispatch_ms } : {}),
                    ...(extra.play_ms !== undefined ? { play_ms: extra.play_ms } : {}),
                    ...(extra.data ? { data: extra.data } : {}),
                });
            }
            catch {
                // 异常隔离：埋点故障不影响游戏逻辑
            }
        },
    };
}
/** localStorage 依赖组装（浏览器形态；无 localStorage 返回会话级替身） */
function browserTelemetryDeps(now) {
    const isoNow = () => new Date().toISOString();
    let sessionAnon = null;
    const load = () => {
        try {
            return localStorage.getItem('st.telemetry.anonId');
        }
        catch {
            return sessionAnon;
        }
    };
    const save = (id) => {
        try {
            localStorage.setItem('st.telemetry.anonId', id);
        }
        catch {
            sessionAnon = id; // 无持久化 → 会话级
        }
    };
    return { now, isoNow, uuid: defaultUuid, loadAnonId: load, saveAnonId: save, sink: () => { } };
}
