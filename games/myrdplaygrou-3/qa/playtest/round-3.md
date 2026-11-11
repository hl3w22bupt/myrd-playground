# round-3 · 性能预算收口 + 人形建模证据化（改 → 玩 → 看）

## 观察

- 62s 双视口冒烟：桌面 11-12fps 但移动视口在 8.5-10.2 间贴着 ≥10fps 地板抖动（判定风险）；drawCalls 310（阴影 pass 全量投影翻倍）。人形建模（关节人形）需要可机判的段件证据。

## 动作

- 性能四步：阴影投影面收口（躯干+大腿）→ Bloom 1/4 分辨率 → 渲染目标 HalfFloat→UnsignedByte + 点缀光收 1 盏 + MSAA 关闭 + 内部 0.75× 分辨率；号码贴图只留背面
- drawCalls 310→201，移动视口三连跑 12.5-14.5fps（余量 >2fps）
- 段件证据口径：buildPlayers traverse 关节树 mesh 计数（10 人 × 16 段件 =160），进 smoke payload + tests/smoke-payload.contract.mjs 断言 ≥120
- 三相位实局留证（15s/45s/85s）：2:0 终盘、12 射、103 次球权易手、fps 16-18

## 截图

- qa/playtest/steps/round3-late-match.png （85s 终盘：主 2:0 领先，比分牌+计时+受控环+双方阵型完整在画）
- qa/playtest/steps/round3-late-desktop.png

## 改动

- src/render/scene.js / src/render/player.js / src/main.js（payload 段件口径）

## 复玩对比

- 修复前：mobile 8.5-10.2fps（FAIL 风险）+ 段件证据缺失；修复后三连跑 BROWSER-SMOKE PASS 且人形段件 160 机判达标 —— 关节人形从「代码存在」升级为「证据在链」
