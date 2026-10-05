# 关卡状态黑板 — g2-blocks（熔炉方块）· **WX 移植提审轮（v1.1 基线 → 可提审微信小游戏包）**

> 更新时间：2026-10-05 12:50（开工前置完成 · 主策划）
> 负责人：主策划（整合人）· 各节点署名回写 · QA 线维护核销列
> 下一步：N1 spec v1.3-platform 入链（关键路径）∥ N2-P1 工程 Phase 1 包体实测（并行）
>
> 上轮黑板（V1.2 手感轮 + A 轮全档）：`/Users/leo/.myrd/workspaces/cmto0g28j0002m9sqnvjdy8o7/run-cmut4m9ww00bvic7qxd1wpl7y/.myrd/blackboard/g2-blocks/`（本文件只记本轮，不覆写历史轮）

## 〇、本轮基线（开工实查 2026-10-05，非推断）

| 项 | 值 | 证据 |
|---|---|---|
| 源基线 | g2-blocks @ `fe5fd38`（v1.1 已发布基线 = 19bf249 的父提交） | `git log --format="%h %P" -1 19bf249` 实查 |
| 契约共同输入 | v1.1 approved 导出件 `.myrd/spec/g2-blocks/design-spec.json`（平台 id `cmuqa2mu50023m9zr8mh60uph` · 链 v2 · **status=approved**） | 本 run 导出固化实查，锚 `302e63367f3dea63…` 全等 |
| 链头 | v4 `cmut5fkyf00cbic7qudea13g6` **draft**（V1.2 核心手感轮 · 锚 `1720df8e…`）· **待批复，本轮零接触** | 平台 DB + `design-spec-v1.3-feel-draft.json` 实查 |
| v1.1 冻结锚 | `302e63367f3dea63212ad689a33703d83886d145862db0d724df98e97fea2d89` | node 同款算法实算全等 |
| 工具链实况 | 微信开发者工具 CLI **未安装**（`/Applications/wechatwebdevtools.app` 不存在）→ devtools 侧验证 = runbook 脚本化 + 结构门禁取证 + 显式披露，不造假 | ls 实查 2026-10-05 |

## 一、wx 工作分支谱系（前置裁决项 · 主策划 09:08 裁决执行）

**前置裁决原文**：工程地基三件（T1 storage/audio 门面、T3 确定性 PRNG/注入时钟/时区工具）与 v1.2 冻结内容解耦——wx 工作分支允许 cherry-pick 地基三件（零玩法/数值/视觉 diff，逐文件清单进本文件）；若主人否决 v1.2，地基独立重落、wx 线 rebase，v1.3 条款不失效。

**执行实况（N2-P1 程序线 · 2026-10-05）**：

| 项 | 结论 |
|---|---|
| 地基三件在 v1.1 基线的在位核实 | `git ls-tree fe5fd38` 实查：`src/platform/storage.ts`、`src/platform/audio.ts`、`src/platform/clock.ts`、`src/kernel/datetime.ts`（T3 时区纯函数）**四件全部已在 v1.1 基线在档**（A 轮 N3 工程前置交付，fe5fd38 已包含） |
| cherry-pick 清单 | **∅（空集）**——无需任何 cherry-pick。v1.1 基线天然满足「地基解耦」：三件与 v1.2 冻结内容（feel/daily numeric + feel 实现）零耦合，wx 分支从 fe5fd38 直接开线即得 |
| 分支 | `wx/port-v1.1`（自 `fe5fd38` 开线，main 不动 → v1.2 冻结范围物理零接触） |
| 谱系 | `fe5fd38`（v1.1 发布基线）→ `wx/port-v1.1` 仅追加 platform 段实现件（`src/platform/wx/*`、`tools/build-wx.mjs`、`tests/wx/*`、`docs/platform/wx/*`），零玩法/数值/视觉 diff（N4 逐件核对） |
| rebase 纪律（写死） | 若 v1.2（链 v4）先获主人批复：wx 线 rebase 到批复后基线重出版，spec 走 revisions 重出 v1.3-platform；不做双版本线并行 |

## 二、本轮节点链台账

| 节点 | 负责 | 产物落点 | 验收信号 | 状态 |
|---|---|---|---|---|
| 开工前置 | 主策划 | 黑板三件 + spec 导出件固化 | 基线区写进 blockers.md | ✅ |
| N1 spec v1.3-platform 校准入链 | 主策划+游戏策划 | `tools/build-spec-v13-platform.mjs`（守卫）→ `docs/spec/spec-v13-platform-payload.json` → POST `/api/v1/game-design-specs/cmut5fkyf00cbic7qudea13g6/revisions` → **链 v5 draft**；draft 导出件 `.myrd/spec/g2-blocks/design-spec-v1.3-platform-draft.json` | 入链成功（version=5 · parent=v4 · draft · 零覆盖）+ QA 复核 numeric 零 diff + acceptance 逐条可核对 | ⏳ |
| N2-P1 工程 Phase 1 | 游戏程序 | `docs/platform/wx/bundle-size-audit-v11.md`（逐资产实测）+ devtools/组包/验证脚本脚手架 + `tests/wx/` 测试脚手架 | 实测数据非估算；脚手架在位 | ⏳ |
| N2-P2 工程 Phase 2 | 游戏程序 | `src/platform/wx/runtime.ts` + `src/platform/wx/share.ts` + `tools/build-wx.mjs` → `export/wx/`；构建谱系记录 | Node 侧绿；devtools 侧按披露口径取证 | ⏳ |
| N3 平台合规视觉包 | 游戏美术 | `docs/platform/wx/privacy-popup-visual.md` + `docs/platform/wx/compliance-visual-checklist.md` + 图标规格核对回写 assets.md + 入包清单 | 自查表逐条有条款编号与证据，无红 | ⏳ |
| N4 复检与打包 | 游戏 QA | 复检报告 + JSON verdict + 提审包 + `docs/platform/wx/wx-submission-kit.md` 材料清单 | 结论 JSON；reject 逐条指文件与 spec 条目 | ⏳ |

## 三、红线（任务书原文，全程生效）

1. v1.2 冻结范围（手感 6 项 + daily-challenge + 视觉打磨包 + 全部 numeric）零接触，触碰即越界打回；
2. 本轮不开新产品线；
3. 提审决策归主人，团队只交包；
4. stack-tower 线全程零接触（含其 spec/代码/黑板段）；
5. g2 仓库红线沿 A 轮：不代拍 approve（v5 落 draft）；不装绿（缺位 → 显式披露）；内核纯净（零 Math.random/Date.now 直调面）。
