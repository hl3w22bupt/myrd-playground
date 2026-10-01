# 关卡状态黑板 — g2-blocks（N1 修复轮）

> 更新时间：2026-10-01（N1 修复轮收口 · 主策划：四条线闭环，等主人 approve）
> 负责人：主策划（整合人）· 程序线维护实现状态列 · QA 线维护核销列
> 下一步：approve 后进入实现轮（codegen theme.ts → kernel 实现 → 契约测试 → round-3 → 可玩原型）

## 关卡面（spec v1 已入链，以下由 levels 段派生）

| 关卡 | 目标 | 元素 | 状态 |
|---|---|---|---|
| level-1 | 教学局：3 步内完成首次三消 + 提示教学 | `el-board` / `el-spawn` / `el-hint`（本轮新增，reason 132 字） | ✅ 在链 v1 |
| level-2 | 升温局：20 手内 ≥3 连击并存活到炉冷 | `el-board` / `el-combo` / `el-deadlock`（el-hint 仅 level-1） | ✅ 在链 v1 |
| level-3+ | 待实现轮按 content.levelCount 预算扩展 | — | ⏸ 未产 |

## 节点链台账

| 节点 | 线 | 产物 | 验收 | 状态 |
|---|---|---|---|---|
| 线1 色板定稿 | 美术 | 余烬金 `#C89C19` + 暖区 06/07 + 门禁工具 + 21 对证据 | 21 对双门禁 ALL-GREEN（minΔE 26.555 / 阈值 25）；commit d401cab | ✅ |
| 线2 spec v1 | 策划 | 八道守卫 + 平台 v1 `cmuovwra0004gm97tinha15zq` + 导出件 | 一次成链；回读全等；5+1 逐字在链；commit 19abac4 | ✅ |
| 线3 N3 前置 | 程序 | 守卫+CI + harness + seededRng 骨架 + theme.spec 框架 | run-all 绿；PENDING-APPROVE 显式非装绿；commit 1a47805 | ✅ |
| 线4 round-2 | QA | qa-round2 27 断言 + 回执 QA-G2-N1-R2-20261001-01 + 证据模板 | 无红 → approve-ready；commit ff7d34c | ✅ |
| 主人拍板 | 主人 | approve | 人工验收最终裁决 | ⏸ 团队不代拍 |

