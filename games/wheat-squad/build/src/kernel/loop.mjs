// kernel/loop.ts — 确定性内核骨架（wheat-squad · 承预置件 templates/next-line-scaffold 判例）
//
// 纪律（spec e-kernel-loop）：零 Math.random / 零 Date.now / 零平台 import——
// 一切随机走注入的 seeded Rng（mulberry32），一切时间走 fixed step 累计。
// 同 seed 同输入 → 逐字节一致（ac det-1 断言此性）。
                                        

export function seededRng(seed        )      {
  // mulberry32（判例承自 g2-blocks ac-14 / 预置件 kernel/loop.ts）
  let a = seed >>> 0;
  return {
    next() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/** fixed-step 累计器：可变帧间隔 → 恒定步长推进（上限防螺旋，判例承 g2-blocks MAX_DT_MS） */
export function accumulate(acc                        , dtMs        , stepMs        , maxDtMs        )         {
  const clamped = Math.min(dtMs, maxDtMs);
  acc.residualMs += clamped;
  let steps = 0;
  while (acc.residualMs >= stepMs) {
    acc.residualMs -= stepMs;
    steps += 1;
  }
  return steps;
}
