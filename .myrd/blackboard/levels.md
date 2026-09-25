# 关卡状态黑板 — stack-tower（M2 首卡）

> 更新时间：2026-09-25（M2 冲刺开工）
> 负责人：主策划（整合人）· 全团队共用，改前先读，改后写更新时间
> 下一步：spec v1 终稿建版 → QA 预审 → approved 候选版 → T4 contract 骨架逐个转绿

## 状态图例
`spec-only`（仅策划案定义）→ `scaffold`（契约骨架已落盘，not-runnable）→ `implemented`（实现落盘，契约可跑）→ `green`（契约 pass）→ `accepted`（主人试玩拍板）

## 关卡状态表

| level_id | 状态 | 数值来源 | 契约测试 | 备注 |
|---|---|---|---|---|
| lvl-01-stack-tower | **scaffold**（spec v2 approved + 契约骨架 8/8 not-runnable） | spec v2 numeric（写死） | tests/contract/ 8 条（e01–e08），与 acceptance 逐字对齐 | 首关，element e01–e08 逐个编号；待实现冲刺转 green |
| lvl-02…lvl-12 | 未定义 | 难度曲线参数化生成（见 spec v2 content.formulas；总 228 层，单关 8~30 层，护栏 180s/关） | 复用 lvl-01 契约族 | M2 只交付首关 + 曲线，其余关卡按曲线解锁 |
| 糖果粉碎（games/game，M1 卡） | 已交付转维护 | — | games/game/verify.sh | 占位项挂账禁核销，见 blockers.md |
| transport-ship-3d（M1 卡） | 已交付转维护 | 平台 spec v3 approved | 平台契约 | 本冲刺不动 |

## 约定
- 关卡/元素 id 一旦进入 approved spec 即冻结，改名 = spec 升版。
- contract 文件名 = `<level_id>_<element_id>.spec.mjs`，与 acceptance[].check 逐字对齐。
