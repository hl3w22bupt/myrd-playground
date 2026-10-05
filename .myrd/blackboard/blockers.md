# 阻塞项黑板 — g2-blocks · **WX 移植提审轮（收口态 · APPROVE-READY 包已回流主人）**

> 更新时间：2026-10-05 13:4x（N4 15/15 APPROVE-READY · 主策划整合收口）
> 负责人：主策划（整合人）· 每次整合后更新；阻塞超一轮未解 → 升级主人，不空转
> 下一步：**等主人拍板**（是否提审 + 正式 AppID/类目资质 + 隐私指引填报）；v1.2 批复在途互不阻塞

## 提请主人拍板（本轮回流 · 团队只交包）

1. **是否提审**：approve-ready 包 + 材料清单已就绪（见当前基线）；提审动作 = 主人在微信开发者工具/公众平台执行（两步手册见 `docs/platform/wx/wx-submission-kit.md` §三）。
2. **正式 AppID + 类目/资质**（W-2）：下发后 `project.config.json` 替换 touristappid 即可提审。
3. **《用户隐私保护指引》后台填报**：口径已给全（收集项 = 本地 muted/anonId 两键、零网络上报；代码面证据 `src/persistence.ts`）。
4. **v1.2（链 v4）批复**：在途；批复与否不影响本包基线（v1.1 + 平台段）；若先批复 → spec v1.3-platform 按既定纪律 rebase 重出版。

## 当前基线（开工即记 · 2026-10-05）

- **黑板路径**：`.myrd/blackboard/`（levels.md / assets.md / blockers.md + gate-logs/，本 run 目录）
- **spec 版本号**：
  - **契约共同输入 = v1.1 approved 导出件** `.myrd/spec/g2-blocks/design-spec.json`（projectId `cmto0g28j0002m9sqnvjdy8o7` · 平台 id `cmuqa2mu50023m9zr8mh60uph` · 链 v2 · status=approved · 锚 `302e63367f3dea63…`；导出件本 run 固化实查全等）
  - **链头 = v5 draft `cmuusk0p60040icryguvlev9j`**（v1.3-platform · parent=v4 · 2026-10-05 N1 入链；QA 复核 11/11 PASS）
  - **v4 draft→superseded**（`cmut5fkyf00cbic7qudea13g6`，V1.2 手感轮）：v5 建版动作翻 superseded 属平台语义，**内容零覆盖**（QA 复核 Q7/Q8：手感锚 `1720df8e…` + 与本地 payload 深比全等）· **待批复，本轮零接触**
- **源基线**：g2-blocks 仓库 `/Users/leo/.myrd/workspaces/cmto0g28j0002m9sqnvjdy8o7/g2-blocks` @ `fe5fd38`（v1.1 已发布）；wx 分支 `wx/port-v1.1`
- **上轮黑板**：`run-cmut4m9ww00bvic7qxd1wpl7y/.myrd/blackboard/g2-blocks/`（V1.2 手感轮收口 15/15 APPROVE-READY + 部署轮 r3 已上线；只读沿档，不覆写）
- **落点偏差披露（第三次沿 A/B 轮已接受口径）**：任务书写 `.myrd/spec/design-spec.json`，该路径为 routines.yaml 保留位（一游戏一文件）→ 沿用 `.myrd/spec/g2-blocks/design-spec.json`（`src/kernel/spec-source.ts` 兄弟目录自动发现即认此路径，换路径反破坏既有发现链）；**2026-10-05 routine 驳回修复**：`game-contract` routine 以工作区根为 cwd 执行 `node scripts/contract-check.mjs` 曾 MODULE_NOT_FOUND（检查器单源在游戏仓库）→ 工作区根补 `scripts/contract-check.mjs` 薄壳入口（保留位→g2 落点映射 + 游戏仓库自动发现〔wx 交付线优先〕+ `G2_SPEC_PATH` 注入，逻辑零复制、exit 透传），routine 字面命令 18/18 绿（17 号日志）

## 阻塞项（本轮）

| id | 内容 | 归属 | 解除判据 | 状态 |
|---|---|---|---|---|
| W-1 | 微信开发者工具 CLI 未安装 → devtools 侧「双绿」无法本机机跑 | 程序+QA | ✅ 本轮可做面全做：结构门禁取证（wx 三条目查 3/3 + 八门禁 exit 0）+ runbook 脚本化（`tools/verify-wx-devtools.mjs`）+ N4 E2 如实披露（BLOCKED-ENV exit 2 原件 09/11 档）；**devtools 侧真跑待环境**（CLI 在位后一键复跑）；程序线收口复跑二次取证 BLOCKED-ENV（15 号日志），Node 侧复跑全绿（12..14 号）；**QA 驳回缺陷二复述确认：wr-acc-2 G1–G4 未机跑属执行资源缺口，升级动作=主人侧安装微信开发者工具（稳定版）+ 开服务端口后一键复跑 `node tools/verify-wx-devtools.mjs`；G1 机跑通过前 approve-ready 包不得实际提审（维持披露，无需改码）**；24f 三次取证 BLOCKED-ENV 在档（runbook 已含 G5 隐私项） | 🚨 挂主人侧环境（不构成包面缺陷；不造假不装绿） |
| W-4 | （随件注记 · 知会主策划）v1.3 acceptance ac-10 scopeNote 逐字节沿 v1.1 仍写「移植端（wx/dy/Steam/Roblox）deferred 顺延下轮」，与 v1.3 content.platform 五条目文面冲突 | 主策划 | 定稿/rebase 时以 revisions 注记澄清（revision_note 已披露零 diff 面政策）；非码面动作，不阻塞任何节点 | ⏳ 归 spec 定稿轮 |
| W-2 | wx 提审需 AppID + 类目/资质（正式） | 主人 | 主人下发后 project.config.json 换正式 appid（现占位 `touristappid` 测试号，沿一号仓 B0 判例） | 🚨 待主人（不影响包与材料生产） |
| W-3 | 上轮 QA 09:04 reject verdict 的缺口 A/B 原文检索 | 主策划 | 本轮以任务书重述为准（缺口 A=devtools 验证 runbook 缺失 → N1 补丁①；缺口 B=dy 条目验收口径不明 → N1 补丁②）；**如原文在档后续补挂链接，不阻塞**（补丁内容两源一致） | ⏳ 沿任务书重述执行 |

## 知会主人（在途 · 非阻塞 · 可否决）

| 项 | 口径 |
|---|---|
| v1.2 待批复 | 链 v4 `cmut5fkyf00cbic7qudea13g6` draft 在途待主人 approve；**本轮所有节点不依赖其批复**；若本轮执行中先获批 → spec v1.3-platform 按既定纪律 rebase 重出版，不做双版本线并行 |
| 地基前置界定 | 主策划 09:08 裁决（随纪要知会，可否决）：地基三件与 v1.2 冻结解耦，wx 分支允许 cherry-pick。**执行实况：地基三件已在 v1.1 基线 @ fe5fd38 在档（A 轮 N3 交付），cherry-pick 清单=∅**（levels.md §一 实查记录）；主人若否决 v1.2 → 地基独立重落、wx 线 rebase，v1.3 条款不失效 |
| 提审决策 | 团队只交 approve-ready 包 + 材料清单；**提审与否主人拍板** |

## 打回预公示转显式验收项（QA N4 逐条核 · 终态）

1. ✅ 新测试文件存在性——`tests/wx/` 4 件在盘，先红（02 日志 0/3）后绿（07 日志 3/3）对照在档；
2. ✅ 对照 cherry-pick 清单核对零 diff——清单=∅；N4-D2/D2b 机判：变更 26 件全部落在谱系声明白名单，玩法/数值/视觉面 diff=0；
3. ✅ 包体实测非估算——N4-D3 独立重跑 132,607B（≤4MB），逐件档 `10-wx-bundle-audit.json`。

## 收口台账（2026-10-05 · 全链闭环）

| 节点 | 终态 | 证据 |
|---|---|---|
| 开工前置 | ✅ | 黑板三件 + 导出件固化（commit 273a11a / 161d455） |
| N1 链 v5 入链 | ✅ draft | `cmuusk0p60040icryguvlev9j` · QA 复核 11/11（06 日志）· commit 7111e49 |
| N2-P1 | ✅ | 实测 22 件 + 先红 22 断言（01/02/03 日志）· commit 5761b3a |
| N2-P2 + N3 | ✅ | wx 五件 + 组包 129.5KB + 合规三件 · 双绿（07/08 日志）· commit e39c0a1 |
| N4 | ✅ 15/15 APPROVE-READY | verdict JSON + 11 日志 · commit cabef9e |
| 驳回修复轮 | ✅ 缺陷一修法 (a) 全落 | wk-acc-3 弹窗运行时件 + 装配接线 + wx-k5b..k5g 先红(24a RED=6)后绿(24b 14/14) + runbook G5 + compliance B-5a 显式化 + ac-11 theme 单源收编复绿 · 契约 18/18 · 八门禁 0 · 冒烟 PASS · 包 31 件 150,530B · numeric 锚 `302e6336` 全等零接触 · g2 仓 commit `ed172e1` |
| 回流主人 | ✅ 包 + 材料清单 | `g2-blocks-wx/export/wx/` + `docs/platform/wx/wx-submission-kit.md` |
