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
| N1 spec v1.3-platform 校准入链 | 主策划+游戏策划 | `tools/build-spec-v13-platform.mjs`（十道守卫 10/10）→ `docs/spec/spec-v13-platform-payload.json` → POST revisions → **链 v5 `cmuusk0p60040icryguvlev9j` draft**（parent=v4）；draft 导出件本 run `.myrd/spec/g2-blocks/design-spec-v1.3-platform-draft.json` | 入链成功 + QA 复核 **11/11 PASS**（Q1..Q11：numeric 零 diff 机判 + acceptance 逐条可核对 + 前版 v1..v4 零覆盖 + diff 面恰三点）· 日志 gate-logs 05/06 | ✅（commit 7111e49） |
| N2-P1 工程 Phase 1 | 游戏程序 | `docs/platform/wx/bundle-size-audit-v11.md`（22 件实测 raw 87,213B / gzip 35,749B）+ `tests/wx/` 三条目查 22 断言（先红：0/3 绿 RED 在档 02 日志）+ `tools/verify-wx-devtools.mjs`（BLOCKED-ENV exit 2 在档 03 日志）+ dy 写案件 checker PASS | 实测非估算 ✓；脚手架在位 ✓ | ✅（commit 5761b3a） |
| N2-P2 工程 Phase 2 | 游戏程序 | wx 五件（wx-env/runtime/share/adapter/boot-wx · 复用 T1/T3 门面）+ `tools/build-wx.mjs` → `export/wx/` 30 件 132,607B（≤4MB 实测断言）+ 谱系件 build-lineage.md | **Node 侧双绿**：wx 三条目查 3/3（22/22 断言）+ 基线八门禁 exit 0 零回归；devtools 侧 BLOCKED-ENV exit 2 如实披露（W-1） | ✅（commit e39c0a1） |
| N3 平台合规视觉包 | 游戏美术 | privacy-popup-visual.md（一稿三态+触发时机+首启路径示意）+ compliance-visual-checklist.md（A–D 18 条，逐条条款编号+证据）+ wx-submission-kit.md（材料逐 id）+ 图标/截图规格官方锚点核对（直连被网络策略拦 → 锚点路径+后台勾对口径如实落档） | 自查表 12 条机判 ✅ · 4 条待后台/环境 · 2 条主人侧 · **无团队面红项** | ✅（并入 e39c0a1） |
| N4 复检与打包 | 游戏 QA | 复检器 `tools/qa-wx-port-recheck.mjs` → **15/15 · VERDICT: APPROVE-READY**（verdict JSON `docs/platform/wx/qa-wx-port-verdict.json`）；首启可玩代理证据 = headless 冒烟 PASS；提审包 `export/wx/` + 材料清单回流主人 | 三口径（双绿原件/合规逐条/numeric 逐字段 11/11）+ 三条显式验收项全过；治理面两处最小修正（守卫白名单前缀条目）随件披露 | ✅（commit cabef9e） |

## 三、红线（任务书原文，全程生效）

1. v1.2 冻结范围（手感 6 项 + daily-challenge + 视觉打磨包 + 全部 numeric）零接触，触碰即越界打回；
2. 本轮不开新产品线；
3. 提审决策归主人，团队只交包；
4. stack-tower 线全程零接触（含其 spec/代码/黑板段）；
5. g2 仓库红线沿 A 轮：不代拍 approve（v5 落 draft）；不装绿（缺位 → 显式披露）；内核纯净（零 Math.random/Date.now 直调面）。
