// e-kernel-loop — mulberry32 seededRng + fixed-step 累计推进（承 wheat-squad 判例平移）
// spec: entities/e-kernel-loop · 零 Math.random/Date.now（确定性战局的根，det-1 源扫描面）
// 状态内嵌 RNG：rngState 存进 SimState → 序列化即覆盖随机面，同 seed 全 tick 哈希逐字节稳定。

export const FIXED_STEP_MS = 16; // 镜像 spec.numeric.FIXED_STEP_MS（运行时经 config 注入，常量供门禁常量区扫描）
export const DEFAULT_SEED = 20261016; // 镜像 spec.numeric.DEFAULT_SEED

/** mulberry32 独立生成器（harness/非状态面用途；内核随机面走 rngDraw(state)） */
export function seededRng(seed        )               {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 状态内嵌 RNG 单步（mulberry32 同构；读写 state.rngState） */
export function rngDraw(state                      )         {
  let a = (state.rngState + 0x6d2b79f5) | 0;
  state.rngState = a;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** FNV-1a 32bit 字节哈希（确定性；零依赖零随机） */
export function fnv1a(text        )         {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** 规范化键排序序列化（与 config.canonicalize 同构——内核侧零依赖版，供状态哈希） */
export function canonical(v         )         {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  const o = v                           ;
  return "{" + Object.keys(o).sort().map((k) => JSON.stringify(k) + ":" + canonical(o[k])).join(",") + "}";
}

/** 状态哈希（det-1 全 tick 对拍面：双局同 tick 哈希序列逐字节相等） */
export function stateHash(state         )         {
  return fnv1a(canonical(state));
}

/** fixed-step 累计推进（渲染帧毫秒 → 应步进 tick 数；节流上限防死亡螺旋） */
export function ticksForElapsed(accMs        , stepMs        , maxTicks = 8)         {
  const n = Math.floor(accMs / stepMs);
  return Math.min(Math.max(0, n), maxTicks);
}
