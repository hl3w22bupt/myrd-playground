/**
 * core/rng —— seeded RNG（mulberry32）+ 子流 fork。
 * 确定性红线：core 内一切随机必须来自本模块，禁止 Math.random / Date.now。
 */

export class Rng {
  private s: number;
  readonly label: string;

  constructor(seed: number, label = 'root') {
    this.s = seed >>> 0;
    this.label = label;
  }

  /** mulberry32：[0, 1) */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** [min, max) 浮点 */
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** [min, max] 整数 */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1 - 1e-9));
  }

  /** 单位圆内均匀方向，返回单位向量 (dx, dz) */
  unitDir(): { x: number; z: number } {
    const a = this.range(0, Math.PI * 2);
    return { x: Math.cos(a), z: Math.sin(a) };
  }

  /** Box-Muller 高斯（σ=1，μ=0） */
  gaussian(): number {
    let u = 0;
    let v = 0;
    while (u <= 1e-9) u = this.next();
    while (v <= 1e-9) v = this.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /** 按权重抽取一项 */
  weighted<T>(entries: Array<{ item: T; weight: number }>): T {
    let total = 0;
    for (const e of entries) total += e.weight;
    let r = this.next() * total;
    for (const e of entries) {
      r -= e.weight;
      if (r <= 0) return e.item;
    }
    return entries[entries.length - 1].item;
  }

  /** 派生子流：同种子下子流序列确定，且与父流互不影响 */
  fork(label: string): Rng {
    const child = new Rng((this.s ^ hashLabel(label)) >>> 0, `${this.label}.${label}`);
    // 消耗一次父流，保证不同 fork 点得到不同子流
    this.next();
    return child;
  }

  /** 快照（回放/调试用） */
  state(): number {
    return this.s;
  }

  restore(s: number): void {
    this.s = s >>> 0;
  }
}

function hashLabel(label: string): number {
  let h = 2166136261;
  for (let i = 0; i < label.length; i++) {
    h ^= label.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createRng(seed: number): Rng {
  return new Rng(seed, 'root');
}
