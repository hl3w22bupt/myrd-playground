/**
 * meta 埋点三类（实体 e-telemetry-meta，spec v1.4 acc-b6 + 附录 B）。
 *
 * 契约：
 *  - 事件族枚举封闭（附录 B 五事件；missions 族登记即封，本轮不发）；
 *  - dedupe_id 必填（UUID，缺失/重复即拒）；断网持久队列 + 恢复按序补报；
 *  - 白名单双向断言：白名单外可选字段发送前丢弃；白名单内类型不符 → 整条拒发；
 *    required 缺失 → 拒发；
 *  - acc-e1 六核心事件枚举封闭不扩，双枚举并存互不越界（本模块零触碰 emitter.ts）；
 *  - 上报端点未建（N0 实证）：sender 注入式，默认 no-op 发送器，队列照常工作。
 */
import type { StorageLike } from '../meta/save.js';

/** meta 事件族（附录 B 封闭枚举） */
export const META_EVENTS = [
  'daily_challenge_start',
  'daily_challenge_result',
  'streak_update',
  'mission_progress',
  'mission_reward',
] as const;

export type MetaEvent = (typeof META_EVENTS)[number];

/** 可选字段白名单（附录 B 定稿；dedupe_id 为 required 单列） */
export const META_FIELD_WHITELIST: Record<MetaEvent, Record<string, 'string' | 'number' | 'boolean'>> = {
  daily_challenge_start: { challengeDate: 'string' },
  daily_challenge_result: { challengeDate: 'string', layers: 'number', claimed: 'boolean' },
  streak_update: { streak: 'number', reason: 'string' },
  mission_progress: { missionId: 'string', progress: 'number' },
  mission_reward: { missionId: 'string', rewardKind: 'string', rewardAmount: 'number' },
};

/** 队列容量（满则丢最旧，丢旧不丢新） */
export const META_QUEUE_CAP = 200;
const QUEUE_KEY = 'st.meta.telemetry.queue';
const SENT_KEY = 'st.meta.telemetry.sent';

/** 单条 meta 埋点载荷 */
export interface MetaPayload {
  event: MetaEvent;
  /** 去重 id（必填；同 id 重复补报不产生重复计数） */
  dedupe_id: string;
  client_ts: string;
  mono_ms: number;
  anon_id: string;
  schema_version: string;
  client_version: string;
  data?: Record<string, string | number | boolean>;
}

export interface MetaTelemetryDeps {
  now(): number;
  isoNow(): string;
  /** dedupe_id 提供者（UUID v4；由调用方注入） */
  uuid(): string;
  anonId(): string;
  storage: StorageLike;
  /** 在线标志（断网 true→false 入队，恢复 false→true 补报） */
  online(): boolean;
  /** 发送器（注入式；默认 no-op；返回 false = 发送失败，条目留队） */
  sender(payload: MetaPayload): boolean;
}

export interface MetaTelemetry {
  /** 发射一条 meta 事件（枚举外/白名单违规/dedupe 缺失 → 静默丢弃，异常全隔离） */
  emit(event: MetaEvent, fields?: Record<string, string | number | boolean>): void;
  /** 补报队列（online=true 时按序发送；返回实际发送条数） */
  flush(): number;
  /** 当前队列长度 */
  queued(): number;
}

/** 白名单校验：返回丢弃白名单外字段后的 data；类型不符返回 null（整条拒发） */
function validateFields(event: MetaEvent, fields: Record<string, string | number | boolean> | undefined): Record<string, string | number | boolean> | null {
  const wl = META_FIELD_WHITELIST[event];
  const out: Record<string, string | number | boolean> = {};
  if (!fields) return out;
  for (const [k, v] of Object.entries(fields)) {
    const expect = wl[k];
    if (expect === undefined) continue; // 白名单外 → 丢弃（不拒发）
    const t = typeof v;
    if (t !== expect) return null; // 白名单内类型不符 → 整条拒发
    out[k] = v;
  }
  return out;
}

// —— 队列持久化（损坏 JSON 安全降级为空队）——
function readQueue(storage: StorageLike): MetaPayload[] {
  try {
    const raw = storage.getItem(QUEUE_KEY);
    const arr = raw ? (JSON.parse(raw) as MetaPayload[]) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function writeQueue(storage: StorageLike, q: MetaPayload[]): void {
  storage.setItem(QUEUE_KEY, JSON.stringify(q));
}
function readSent(storage: StorageLike): string[] {
  try {
    const arr = JSON.parse(storage.getItem(SENT_KEY) ?? '[]') as string[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** 工厂：装配根（browser）与契约（注入替身）共用 */
export function createMetaTelemetry(deps: MetaTelemetryDeps): MetaTelemetry {
  const q = readQueue(deps.storage);
  const sent = readSent(deps.storage);
  const sentSet = new Set(sent);

  const persist = (): void => {
    try {
      writeQueue(deps.storage, q);
    } catch {
      /* 持久化失败不阻断（内存队列仍在本会话工作） */
    }
  };

  return {
    emit(event, fields = {}) {
      try {
        if (!(META_EVENTS as readonly string[]).includes(event)) return; // 枚举封闭
        const data = validateFields(event, fields);
        if (data === null) return; // 白名单内类型不符 → 整条拒发
        const payload: MetaPayload = {
          event,
          dedupe_id: deps.uuid(), // required：工厂保证在场（契约双向断言含缺失路径）
          client_ts: deps.isoNow(),
          mono_ms: deps.now(),
          anon_id: deps.anonId(),
          schema_version: '1',
          client_version: '0.1.0-b1',
          ...(Object.keys(data).length > 0 ? { data } : {}),
        };
        if (sentSet.has(payload.dedupe_id)) return; // 去重：同 dedupe_id 不重发
        q.push(payload);
        if (q.length > META_QUEUE_CAP) q.shift(); // 满丢最旧
        persist();
        if (deps.online()) this.flush();
      } catch {
        /* 异常隔离：埋点故障不影响游戏逻辑 */
      }
    },
    flush(): number {
      if (!deps.online()) return 0;
      let sentCount = 0;
      while (q.length > 0) {
        const p = q[0]!;
        if (sentSet.has(p.dedupe_id)) {
          // 去重：同 dedupe_id 已送达过（崩溃后重复入队等）→ 直接出队，不重复计数
          q.shift();
          continue;
        }
        let ok = false;
        try {
          ok = deps.sender(p); // false = 发送失败（断网/端点不可达）→ 条目留队
        } catch {
          ok = false;
        }
        if (!ok) break; // 按序补报：队首失败即停，保留顺序
        sentSet.add(p.dedupe_id);
        q.shift();
        sentCount += 1;
      }
      try {
        deps.storage.setItem(SENT_KEY, JSON.stringify([...sentSet].slice(-500))); // 去重集合封顶 500
      } catch {
        /* 忽略 */
      }
      persist();
      return sentCount;
    },
    queued(): number {
      return q.length;
    },
  };
}

/** localStorage 依赖组装（browser 形态；online 取 navigator.onLine；sender 默认 no-op 成功） */
export function browserMetaTelemetryDeps(anonId: string, now: () => number): MetaTelemetryDeps {
  const isoNow = () => new Date().toISOString();
  const uuid = (): string => {
    const c = typeof crypto !== 'undefined' ? crypto : undefined;
    if (c?.getRandomValues) {
      const b = new Uint8Array(16);
      c.getRandomValues(b);
      b[6] = (b[6]! & 0x0f) | 0x40;
      b[8] = (b[8]! & 0x3f) | 0x80;
      const hex = [...b].map((x) => x.toString(16).padStart(2, '0'));
      return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
    }
    return `m-${now().toString(16)}-${(hexOf(anonId) % 0xffff).toString(16)}`; // 确定性兜底（禁 Math.random）
  };
  const storage: StorageLike = {
    getItem: (k) => {
      try {
        return localStorage.getItem(k);
      } catch {
        return null;
      }
    },
    setItem: (k, v) => {
      try {
        localStorage.setItem(k, v);
      } catch {
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

function hexOf(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0;
  return h;
}

