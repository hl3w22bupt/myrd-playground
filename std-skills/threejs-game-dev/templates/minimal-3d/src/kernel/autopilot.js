// autopilot.js — 内核级贪心自动驾驶：永远朝最近的存活宝石走。
// 纯函数（零 three/零 DOM/零随机/零时钟）：冒烟协议与确定性测试共用 ——
// 有了它，快进不再是「直冲角落」的死路径，而是真的会收集、会终局的完整对局。
export function greedyIntent(world) {
  let best = null;
  let bestD = Infinity;
  for (const g of world.gems) {
    if (!g.alive) continue;
    const d = Math.hypot(g.x - world.player.x, g.z - world.player.z);
    if (d < bestD) { bestD = d; best = g; }
  }
  if (!best || bestD < 0.01) return { moveX: 0, moveZ: 0 };
  return { moveX: (best.x - world.player.x) / bestD, moveZ: (best.z - world.player.z) / bestD };
}
