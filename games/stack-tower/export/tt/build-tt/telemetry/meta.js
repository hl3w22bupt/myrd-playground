"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.META_QUEUE_CAP = exports.META_FIELD_WHITELIST = exports.META_EVENTS = void 0;
exports.createMetaTelemetry = createMetaTelemetry;
exports.browserMetaTelemetryDeps = browserMetaTelemetryDeps;
/** meta 事件族（附录 B 封闭枚举） */
exports.META_EVENTS = [
    'daily_challenge_start',
    'daily_challenge_result',
    'streak_update',
    'mission_progress',
    'mission_reward',
];
/** 可选字段白名单（附录 B 定稿；dedupe_id 为 required 单列） */
exports.META_FIELD_WHITELIST = {
    daily_challenge_start: { challengeDate: 'string' },
    daily_challenge_result: { challengeDate: 'string', layers: 'number', claimed: 'boolean' },
    streak_update: { streak: 'number', reason: 'string' },
    mission_progress: { missionId: 'string', progress: 'number' },
    mission_reward: { missionId: 'string', rewardKind: 'string', rewardAmount: 'number' },
};
/** 队列容量（满则丢最旧，丢旧不丢新） */
exports.META_QUEUE_CAP = 200;
const QUEUE_KEY = 'st.meta.telemetry.queue';
const SENT_KEY = 'st.meta.telemetry.sent';
/** 白名单校验：返回丢弃白名单外字段后的 data；类型不符返回 null（整条拒发） */
function validateFields(event, fields) {
    const wl = exports.META_FIELD_WHITELIST[event];
    const out = {};
    if (!fields)
        return out;
    for (const [k, v] of Object.entries(fields)) {
        const expect = wl[k];
        if (expect === undefined)
            continue; // 白名单外 → 丢弃（不拒发）
        const t = typeof v;
        if (t !== expect)
            return null; // 白名单内类型不符 → 整条拒发
        out[k] = v;
    }
    return out;
}
// —— 队列持久化（损坏 JSON 安全降级为空队）——
function readQueue(storage) {
    try {
        const raw = storage.getItem(QUEUE_KEY);
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
    }
    catch {
        return [];
    }
}
function writeQueue(storage, q) {
    storage.setItem(QUEUE_KEY, JSON.stringify(q));
}
function readSent(storage) {
    try {
        const arr = JSON.parse(storage.getItem(SENT_KEY) ?? '[]');
        return Array.isArray(arr) ? arr : [];
    }
    catch {
        return [];
    }
}
/** 工厂：装配根（browser）与契约（注入替身）共用 */
function createMetaTelemetry(deps) {
    const q = readQueue(deps.storage);
    const sent = readSent(deps.storage);
    const sentSet = new Set(sent);
    const persist = () => {
        try {
            writeQueue(deps.storage, q);
        }
        catch {
            /* 持久化失败不阻断（内存队列仍在本会话工作） */
        }
    };
    return {
        emit(event, fields = {}) {
            try {
                if (!exports.META_EVENTS.includes(event))
                    return; // 枚举封闭
                const data = validateFields(event, fields);
                if (data === null)
                    return; // 白名单内类型不符 → 整条拒发
                const payload = {
                    event,
                    dedupe_id: deps.uuid(), // required：工厂保证在场（契约双向断言含缺失路径）
                    client_ts: deps.isoNow(),
                    mono_ms: deps.now(),
                    anon_id: deps.anonId(),
                    schema_version: '1',
                    client_version: '0.1.0-b1',
                    ...(Object.keys(data).length > 0 ? { data } : {}),
                };
                if (sentSet.has(payload.dedupe_id))
                    return; // 去重：同 dedupe_id 不重发
                q.push(payload);
                if (q.length > exports.META_QUEUE_CAP)
                    q.shift(); // 满丢最旧
                persist();
                if (deps.online())
                    this.flush();
            }
            catch {
                /* 异常隔离：埋点故障不影响游戏逻辑 */
            }
        },
        flush() {
            if (!deps.online())
                return 0;
            let sentCount = 0;
            while (q.length > 0) {
                const p = q[0];
                if (sentSet.has(p.dedupe_id)) {
                    // 去重：同 dedupe_id 已送达过（崩溃后重复入队等）→ 直接出队，不重复计数
                    q.shift();
                    continue;
                }
                let ok = false;
                try {
                    ok = deps.sender(p); // false = 发送失败（断网/端点不可达）→ 条目留队
                }
                catch {
                    ok = false;
                }
                if (!ok)
                    break; // 按序补报：队首失败即停，保留顺序
                sentSet.add(p.dedupe_id);
                q.shift();
                sentCount += 1;
            }
            try {
                deps.storage.setItem(SENT_KEY, JSON.stringify([...sentSet].slice(-500))); // 去重集合封顶 500
            }
            catch {
                /* 忽略 */
            }
            persist();
            return sentCount;
        },
        queued() {
            return q.length;
        },
    };
}
/** localStorage 依赖组装（browser 形态；online 取 navigator.onLine；sender 默认 no-op 成功） */
function browserMetaTelemetryDeps(anonId, now) {
    const isoNow = () => new Date().toISOString();
    const uuid = () => {
        const c = typeof crypto !== 'undefined' ? crypto : undefined;
        if (c?.getRandomValues) {
            const b = new Uint8Array(16);
            c.getRandomValues(b);
            b[6] = (b[6] & 0x0f) | 0x40;
            b[8] = (b[8] & 0x3f) | 0x80;
            const hex = [...b].map((x) => x.toString(16).padStart(2, '0'));
            return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
        }
        return `m-${now().toString(16)}-${(hexOf(anonId) % 0xffff).toString(16)}`; // 确定性兜底（禁 Math.random）
    };
    const storage = {
        getItem: (k) => {
            try {
                return localStorage.getItem(k);
            }
            catch {
                return null;
            }
        },
        setItem: (k, v) => {
            try {
                localStorage.setItem(k, v);
            }
            catch {
                /* 无持久化环境 → 队列退化为会话内存 */
            }
        },
    };
    return {
        now,
        isoNow,
        uuid,
        anonId: () => anonId,
        storage,
        online: () => (typeof navigator !== 'undefined' ? navigator.onLine !== false : false),
        sender: () => true, // 端点未建（N0 实证）：默认发送即成功出队，队列机制照常运转
    };
}
function hexOf(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++)
        h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0;
    return h;
}
