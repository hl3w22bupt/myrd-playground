# 证据目录 — R3 驳回修复轮 · 美术线复核/认领（2026-10-02）

> 线1 美术 · 口径 = `evidence-one-line-template.md`
> 背景：QA round-1 打回 F1–F4，其中 **F3 落在美术真源面**——程序线修复时代改美术交付件
> （`style-card.json` material 补 tint/innerStroke/topHighlight；`e-renderer-backdrop.json` 补 coolScrim；
> `gen-theme.mjs` 增发 MATERIAL 组 + withAlpha helper）。本目录 = 美术线对补录内容的**美术口径复核 +
> 机器复跑 + 正式认领**，并新增「描述件 ↔ theme 漂移」美术自检门。
> 路径变量：`G2` = g2-blocks 仓库根；`RUN_WS` = 本 run 工作区根（`run-cmuq9pz86001vm9zrmqyfm59c`）。

## 美术口径复核结论（F3 补录内容）

| 补录 token | 值 | 美术复核 |
|---|---|---|
| `material.tint.ink/paper` | `#000000` / `#FFFFFF` | ✅ 与风格卡要素 4（深底浅块版式）自洽，作为内描边/高光/透明端点派生唯一色源成立 |
| `material.innerStroke` | `#000000`@0.35 | ✅ 显式化要素 2「1px 内描边」（此前 renderer 硬抄隐性值） |
| `material.topHighlight` | `#FFFFFF`@0.18 | ✅ alpha 与要素 2 `topHighlightRatio 0.18` 数值自洽 |
| `backdrop.coolScrim` | `#000000`@0.55 | ✅ 炉冷终局遮罩，属表现件范畴，零贴图红线不破 |
| heatGlow 漂移修正 | `rgb(210,160,40)` → `#C89C19` | ✅ QA 抓到的**真实色漂**（漂移金 ≠ 冻结余烬金），修正方向正确 |

- **认领**：以上补录美术线复核通过，正式认领为美术规格一部分；`palette-n1-final.json` 与 spec numeric
  冻结面零触碰（锚 `7bc2ca03…` / `302e6336…` 不变，本轮复跑实证）。
- **挂账核销**：上一轮美术线登记的「ac-17 自检 env 钉值会误锚他线 run-*」已由 F4 修复轮根治
  （`tests/contract/repo-one.mjs` 共享定位件按 spec 导出件 updatedAt 最新取候选），本轮 ac-17
  无钉值自动正锚本 run（`03-contract-check.log` 原文 `root=run-cmuq9pz86001vm9zrmqyfm59c`），挂账销账。

## 一行式台账

```
[PASS] | 线1 美术 | 01-gate-palette.log | 2026-10-02 | cd $G2 && npm run gate:palette | ALL-GREEN 0红/21对 minΔE=26.555 阈值=25 margin=+1.555 selftest=18/18（F3 补录后色板面零漂移） | g2-blocks 仓库根
[PASS] | 线1 美术 | 02-gate-seven.log | 2026-10-02 | cd $G2 && npm run gate | 七门禁 7/7 PASS（①范围 ②色板21对 ③theme单源ac-11 ④零冻结依赖 ⑤内核确定性 ⑥acmap ⑦关卡面F4新增） | g2-blocks 仓库根
[PASS] | 线1 美术 | 03-contract-check.log | 2026-10-02 | cd $G2 && node scripts/contract-check.mjs | 18 PASS / 0 FAIL · CONTRACT: PASS；ac-17 原文 root=run-cmuq9pz86001vm9zrmqyfm59c（repo-one 根治后自动正锚）；ac-13 零位图 + ac-11 全仓 17 色溯源单源 | g2-blocks 仓库根
[PASS] | 线1 美术 | 04-descriptor-theme-drift.log | 2026-10-02 | cd <本目录> && node 04-descriptor-theme-drift.mjs | ALL-GREEN：五件描述件 hex=19 alpha=6 全接线 theme.ts + theme 零 rgba/rgb 数值字面量（仅 withAlpha 入口）+ spec 冻结 hex 7/7 | 本证据目录（新增美术自检门：改描述件不重跑 codegen 必红）
```

## 备注

- 冒烟面本轮不重复跑：QA N4 复检（g2-blocks 仓库 commit `46a85b0`）当日新鲜归档 SMOKE PASS
  （J1=177.3ms≤400 · 控制台零错误 · 含 F4 新增 level-2 入口/切换回路），美术线静态门 + 接线门已覆盖表现层接线面。
- **流程提醒（呈主策划）**：F3 对美术交付件的代改发生在 QA 打回修复通道内、黑板有补录登记且
  numeric 面零触碰——按缺口通道口径合规；但交付件作者线（美术）的事后认领此前缺位，本轮补上。
  后续同类跨线改动建议在 blockers.md 打回项里显式 @ 作者线复核。
