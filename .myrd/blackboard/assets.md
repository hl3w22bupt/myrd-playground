# 黑板 · 资产清单（assets.md）

> 主策划整合时初始化（2026-09-12）。真源 = `pixel-fives/assets/manifest.json`（APPROVED）+ `pixel-fives/docs/art/style-card-v1.md`（v1-APPROVED）。

## 状态总览

| 项 | 状态 |
|---|---|
| 风格参考卡 v1 | **APPROVED**（主策划 2026-09-12 盖章，五问全 yes）→ 量产解锁 |
| A01–A08 首批资产 | **APPROVED**（8/8 条目 status=approved，含 A06 9帧@12fps=0.75s/contact_frame=3、A08 0.6s/44.1kHz/seed=20260912） |
| 预算红线 | 资产总量 ≤1,572,864B；微信主包 ≤4,194,304B；`assets_total_bytes` 待 `gen-assets.mjs` 实跑回填 |

## 资产-接线对齐（spec v1.2 §3.2，approved）

A01→`levels/pitch.js` · A02/A03→`entities/player.js`（A03=A02 换色 r/R/x→b/B/y 派生）· A04→`entities/ball.js` · A05+A08→`entities/goal.js` · A06→`entities/player.js`（纯视觉）· A07→HUD（el-08 槽位）。

## 量产序列（获批后，每批过预算闸门）

A02 方向扩展（上下朝向）→ A06 镜像校验帧 → A01 tile 扩展（角旗/禁区）→（如策划改判）A07 数字位图。
