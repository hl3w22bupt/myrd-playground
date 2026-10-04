/**
 * 确定性种子随机（mulberry32）。
 * 红线：core/sim 内禁止 Math.random / Date.now —— 一切随机走本类，同 seed 必同序列。
 */
export class Rng {
  /** @param {number} seed 任意 32 位非负整数 */
  constructor(seed) {
    this.seed = seed >>> 0;
    this.state = this.seed;
  }

  /** [0, 1) 均匀分布。 */
  next() {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** [min, max) 均匀浮点。 */
  range(min, max) {
    return min + this.next() * (max - min);
  }

  /** [min, max] 均匀整数。 */
  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  /** 重新播种（用于同 seed 复现校验）。 */
  reset() {
    this.state = this.seed;
  }
}
