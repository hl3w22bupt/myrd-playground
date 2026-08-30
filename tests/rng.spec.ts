import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';

describe('seeded RNG（确定性红线）', () => {
  it('同种子序列完全一致', () => {
    const a = new Rng(12345);
    const b = new Rng(12345);
    for (let i = 0; i < 1000; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it('不同种子序列不同', () => {
    const a = new Rng(1);
    const b = new Rng(2);
    let diff = false;
    for (let i = 0; i < 100; i++) {
      if (a.next() !== b.next()) {
        diff = true;
        break;
      }
    }
    expect(diff).toBe(true);
  });

  it('fork 子流隔离：消耗一个子流不影响其他子流', () => {
    const a = new Rng(777);
    const lootA = a.fork('loot');
    const aiA = a.fork('ai');

    const b = new Rng(777);
    b.fork('loot');
    const aiB = b.fork('ai');

    // 未消耗时两局 ai 流一致
    for (let i = 0; i < 100; i++) {
      expect(aiA.next()).toBe(aiB.next());
    }
    // 大量消耗 loot 流后，ai 流输出不受影响
    for (let i = 0; i < 500; i++) lootA.next();
    for (let i = 0; i < 100; i++) {
      expect(aiA.next()).toBe(aiB.next());
    }
  });

  it('gaussian 均值≈0、weighted 命中权重区间', () => {
    const r = new Rng(42);
    let sum = 0;
    for (let i = 0; i < 5000; i++) sum += r.gaussian();
    expect(Math.abs(sum / 5000)).toBeLessThan(0.05);

    const pick = r.weighted([
      { item: 'a', weight: 0 },
      { item: 'b', weight: 1 },
    ]);
    expect(pick).toBe('b');
  });
});
