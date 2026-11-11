# round-1 · 内核平衡迭代（改 → 玩 → 看）

## 观察

- 自动跑 90s 对局（kernel footballIntent）：客队 AI 单场 15-19 球血洗、主队 0 射门 —— 「平缓大众」创作决策被打破；插桩定位三个根因：①抢断后攻方无减速惩罚（守方永远追不上）②客队无球人可贴门线等饼（tap-in 位）③门将开大脚传给被盯防的人（中场白送）。跑测试门禁与多种子对局全程零异常、确定性 PASS。

## 动作

- node 仿真：10 种子 × 90s AI-vs-AI 对局，统计球权分布/射门/进球（insert 插桩脚本直跑内核）
- 修复：TACKLE_RATE 1.1→0.8、带球减速惩罚 DRIBBLE_PENALTY=0.9、无球接应限深 ≤PZ-9、全员盯人（markSpot 攻守对称）、门将开球先找开阔点否则大脚、远角瞄准（aimFarCorner）
- 复跑 10 种子基线：主 10 : 客 2，5 胜 5 平 0 负，锁定数值入 spec.numeric

## 截图

- qa/playtest/steps/round1-early-match.png （开局 15s：双方中场缠斗，球权易手 12 次）
- qa/playtest/steps/round1-early-desktop.png

## 改动

- src/numeric.js / src/kernel/world.js / src/kernel/autopilot.js（平衡参数与盯人/限深/开球逻辑）

## 复玩对比

- 修复前：0:15（单向碾压）；修复后 10 种子基线 10:2 且主队 13 射/场 —— 5v5 争抢真实发生，客队保有有限反击通道
