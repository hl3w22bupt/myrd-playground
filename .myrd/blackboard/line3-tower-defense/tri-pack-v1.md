# 三合一包 v1 — line3-tower-defense（world 草稿 + entities id + 首屏文案 · 一次发齐美术）

> 更新时间：2026-10-17 · 发包：游戏策划 → 收包：游戏美术（B4 已按本包锁定风格卡 v1，本包为对账底稿）
> 机读真源：`.myrd/spec/line3-tower-defense/spec-v1-payload.json`（六段定稿 · B5/B6 依据）；本包=美术工作面摘录，冲突时以 payload 为准

## ① world 草稿（摘录）

- 主题：极简高对比色块战场 × 治愈系微调（暖沙路径+治愈绿炮塔）
- 场景：20×12 格（640×384 逻辑面）· 1 条敌军路径（第 6 行横穿，暖沙色+虚线箭头常显）· 网格化布防位（路径格+核心 2×2 禁建）· 核心据点 2×2 格·生命 10
- 风格卡 v1：`.myrd/blackboard/line3-tower-defense/assets.md`（四要素已锁定；palette 8 色已冻结进 payload.numeric.palette）
- 方向稿 3 张：`games/line3-tower-defense/assets/style-sketch/direction-{1,2,3}.svg`（确定性生成，重跑逐字节一致）

## ② entities id 清单（12 条 · script/scene 落点）

| id | kind | 落点 |
|---|---|---|
| e-kernel-loop | kernel | src/kernel/loop.ts |
| e-kernel-sim | kernel | src/kernel/sim.ts |
| e-grid | world | src/world/grid.ts |
| e-core | world | src/world/core.ts |
| e-turret | player-side | src/entities/turret.ts |
| e-enemy | hostile | src/entities/enemy.ts |
| e-projectile | hostile | src/entities/projectile.ts |
| e-wave-director | system | src/systems/waveDirector.ts |
| e-economy | system | src/systems/economy.ts |
| e-telemetry | system | src/telemetry/emitter.ts |
| e-render | presentation | src/render/renderer.ts |
| e-input | presentation | src/input/touch.ts |

## ③ 首屏文案（12 条 · 逐字枚举，含标点，实现轮不得改一字）

| id | 文案（逐字） | 落点 |
|---|---|---|
| copy-title | 敌潮将至 | 首屏标题 |
| copy-subtitle | 布防 · 升级 · 守住核心 | 首屏副题 |
| copy-start | 开始布防 | 开始按钮 |
| copy-hint-place | 点击空地，放置第一座炮塔 | 引导浮层正文（≡hint_shown.text 三方同名锚） |
| copy-hint-upgrade | 选中炮塔，升级火力 | 二段引导 |
| copy-core-label | 核心 | HUD 标签 |
| copy-gold-label | 军费 | HUD 标签 |
| copy-wave-label | 波次 | HUD 标签 |
| copy-speed-label | 加速 | 加速按钮 |
| copy-result-win | 守住啦 | 胜利结算标题 |
| copy-result-lose | 核心失守 | 败局结算标题 |
| copy-restart | 再来一局 | 结算页重开按钮（restart_clicked 锚） |

## 附：操作路径 5 条（美术视角视觉锚）

path-place-turret-01（落位弹跳 200ms+射程圈）· path-upgrade-turret-01（星标+1+射程圈扩大）· path-speed-toggle-01（按钮态色块切换）· path-restart-01（结算面板淡出+复位帧）· path-guidance-dismiss-01（浮层淡出 200ms）——逐条视觉签名见 assets.md 映射表（ac-art-4 机判输入）。

> 美术回执（B4 已核）：「需视觉可观察=是」各条 vs 视觉签名映射——对得上，无打回项；palette 8 色已冻结并随 payload 走 B5/B6。
