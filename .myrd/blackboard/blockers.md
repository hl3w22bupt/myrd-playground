# 阻塞项黑板 — g2-blocks · **DY 平台段轮（开工态）**

> 更新时间：2026-10-06 11:0x（开工前置完成 · 主策划）
> 负责人：主策划（整合人）· 每次整合后更新；阻塞超一轮未解 → 升级主人，不空转
> 下一步：N1 出 v6 draft → QA 复核 → N2 开线（v1.1 锚点门禁先行）

## 当前基线（执行要求指定区 · 开工即记）

- **黑板路径**：`/Users/leo/.myrd/workspaces/cmto0g28j0002m9sqnvjdy8o7/run-cmuvzeu0a0167icrywu8c0k10/.myrd/blackboard/`（levels.md / assets.md / blockers.md + gate-logs/）
- **spec 版本号**：
  - **链头 = v5 draft `cmuusk0p60040icryguvlev9j`**（v1.3-platform · parent=v4）· 本轮 N1 在其上 version+1 出 **v6 dy 段**（POST revisions，零覆盖）
  - **v1.2 手感轮 v4 draft `cmut5fkyf00cbic7qudea13g6` 待批复（本轮零接触）**
  - **契约共同输入 = v1.1 approved 内容**（导出件 `.myrd/spec/g2-blocks/design-spec.json` · 平台 id `cmuqa2mu50023m9zr8mh60uph` · 链 v2 · numeric 冻结锚 `302e63367f3dea63…`）
  - 本轮 v6 入链前导出件态：v1.1 approved 导出件 + v5 draft 导出件双固化于本 run `.myrd/spec/g2-blocks/`（sha256 见固化记录）
- **源基线**：g2-blocks @ `fe5fd38`（v1.1 已发布）；wx 冻结线 `wx/port-v1.1` @ `2856d7c` + 镜像 `g2-blocks-wx/`
- **上轮 dy 写案**：`docs/platform/dy/dy-platform-copy.md`（draft · 双条目 · checker `scripts/check-dy-copy.mjs`）
- **落点偏差披露（沿 A/B/wx 三轮已接受口径）**：spec 导出件落 `.myrd/spec/g2-blocks/design-spec.json`（`G2_SPEC_PATH`/兄弟 run 自动发现链即认此路径），`.myrd/spec/design-spec.json` 保留位不动

## 阻塞项（本轮）

| id | 内容 | 归属 | 解除判据 | 状态 |
|---|---|---|---|---|
| D-1 | 抖音开发者工具 CLI 未装（沿上轮 W-1 同型缺口）→ devtools 侧验证无法本机机跑 | 程序+QA | Node 侧机跑全绿 + runbook 脚本化（`tools/verify-dy-devtools.mjs` 同型）+ N4 显式披露 BLOCKED-ENV；真机/工具侧终判待主人侧环境 | 🚨 挂主人侧环境（不构成包面缺陷；不造假不装绿） |
| D-2 | dy 提审需正式 AppID/资质 + 提审日最新规范人工核对（合规文案位双口径中的「当日规范」半边） | 主人 | 主人下发后填占位；提审前人工核对当日规范 | 🚨 待主人（不影响包与材料生产） |
| D-3 | dy 条目现为 **draft**（上轮写案明文：实现启动须先经 spec revisions 把两条目转定稿） | 主策划+游戏策划 | N1 v6 入链即解除（draft→按 N1 口径定稿/冻结参数） | ⏳ 本轮 N1 处理 |
| W-4（沿挂） | v1.3 acceptance ac-10 scopeNote 文面与 content.platform 五条目冲突（「移植端 deferred」vs 平台段已落地） | 主策划 | 本轮 N1 v6 revision_note 一并澄清（非码面动作） | ⏳ 随 N1 |

## 在途知会（非阻塞 · 主人可否决）

| 项 | 口径 |
|---|---|
| v1.2（链 v4）待批复 | 与本轮互不阻塞；若本轮执行中先获批 → dy 线 spec/分支按既定纪律 rebase 重出版，不做双版本线并行 |
| wx 提审 | 上轮 approve-ready 包已回流，等主人拍板；本轮 wx 件冻结只读 |
| dy 提审 | 本轮只交 approve-ready 包 + 材料清单 dy 段 v2；**提审与否主人拍板** |

## 升级条款（沿上轮格式预登记）

| id | 触发条件 | 升级动作 |
|---|---|---|
| Q-D4' | dy 验收谓词如遇「更强口径 vs 最小实现」分歧（沿上轮 daily D4 判例） | 随 N5 提请，主人裁决 |
| Q-DY-1 | tt↔wx 差异若出现「tt 缺位 API 且无 fallback 口径可写」 | 该条目整条打回 N1 重写，缺位清零才许入链 |
