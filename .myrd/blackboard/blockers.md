# 阻塞项黑板 — g2-blocks · **WX 移植提审轮（v1.1 基线 → 可提审微信小游戏包 + 材料清单回流）**

> 更新时间：2026-10-05 12:50（开工前置完成 · 主策划）
> 负责人：主策划（整合人）· 每次整合后更新；阻塞超一轮未解 → 升级主人，不空转
> 下一步：N1 入链 ∥ N2-P1 实测（并行开工）；v1.2 批复在途不阻塞任何节点

## 当前基线（开工即记 · 2026-10-05）

- **黑板路径**：`.myrd/blackboard/`（levels.md / assets.md / blockers.md + gate-logs/，本 run 目录）
- **spec 版本号**：
  - **契约共同输入 = v1.1 approved 导出件** `.myrd/spec/g2-blocks/design-spec.json`（projectId `cmto0g28j0002m9sqnvjdy8o7` · 平台 id `cmuqa2mu50023m9zr8mh60uph` · 链 v2 · status=approved · 锚 `302e63367f3dea63…`；导出件本 run 固化实查全等）
  - **链头 = v4 draft `cmut5fkyf00cbic7qudea13g6`**（V1.2 核心手感轮 · 锚 `1720df8e…`）· **待批复，本轮零接触**
  - **本轮新建 = spec v1.3-platform（链 v5，目标 draft）**：仅平台段增量，parent=v4 链头
- **源基线**：g2-blocks 仓库 `/Users/leo/.myrd/workspaces/cmto0g28j0002m9sqnvjdy8o7/g2-blocks` @ `fe5fd38`（v1.1 已发布）；wx 分支 `wx/port-v1.1`
- **上轮黑板**：`run-cmut4m9ww00bvic7qxd1wpl7y/.myrd/blackboard/g2-blocks/`（V1.2 手感轮收口 15/15 APPROVE-READY + 部署轮 r3 已上线；只读沿档，不覆写）
- **落点偏差披露（第三次沿 A/B 轮已接受口径）**：任务书写 `.myrd/spec/design-spec.json`，该路径为 routines.yaml 保留位（一游戏一文件）→ 沿用 `.myrd/spec/g2-blocks/design-spec.json`（`src/kernel/spec-source.ts` 兄弟目录自动发现即认此路径，换路径反破坏既有发现链）

## 阻塞项（本轮）

| id | 内容 | 归属 | 解除判据 | 状态 |
|---|---|---|---|---|
| W-1 | 微信开发者工具 CLI 未安装 → devtools 侧「双绿」无法本机机跑 | 程序+QA | ① 结构门禁取证（game.json/project.config.json/adapter 齐备 + Node 侧全绿）；② runbook 脚本化（`tools/verify-wx-devtools.mjs`，CLI 在位即一键跑）；③ N4 结论如实标注「devtools 侧待环境」→ **升级主人**（不造假、不装绿） | 🚨 已升级（不阻塞 Node 侧与打包件生产） |
| W-2 | wx 提审需 AppID + 类目/资质（正式） | 主人 | 主人下发后 project.config.json 换正式 appid（现占位 `touristappid` 测试号，沿一号仓 B0 判例） | 🚨 待主人（不影响包与材料生产） |
| W-3 | 上轮 QA 09:04 reject verdict 的缺口 A/B 原文检索 | 主策划 | 本轮以任务书重述为准（缺口 A=devtools 验证 runbook 缺失 → N1 补丁①；缺口 B=dy 条目验收口径不明 → N1 补丁②）；**如原文在档后续补挂链接，不阻塞**（补丁内容两源一致） | ⏳ 沿任务书重述执行 |

## 知会主人（在途 · 非阻塞 · 可否决）

| 项 | 口径 |
|---|---|
| v1.2 待批复 | 链 v4 `cmut5fkyf00cbic7qudea13g6` draft 在途待主人 approve；**本轮所有节点不依赖其批复**；若本轮执行中先获批 → spec v1.3-platform 按既定纪律 rebase 重出版，不做双版本线并行 |
| 地基前置界定 | 主策划 09:08 裁决（随纪要知会，可否决）：地基三件与 v1.2 冻结解耦，wx 分支允许 cherry-pick。**执行实况：地基三件已在 v1.1 基线 @ fe5fd38 在档（A 轮 N3 交付），cherry-pick 清单=∅**（levels.md §一 实查记录）；主人若否决 v1.2 → 地基独立重落、wx 线 rebase，v1.3 条款不失效 |
| 提审决策 | 团队只交 approve-ready 包 + 材料清单；**提审与否主人拍板** |

## 打回预公示转显式验收项（QA N4 逐条核）

1. 新测试文件存在性（`tests/wx/` 新代码自带测试）；
2. 对照 cherry-pick 清单核对玩法/数值/视觉零 diff（清单=∅，即 wx 分支 diff 面=platform 段新增件）；
3. 包体实测非估算（逐资产字节数 + gzip 实测档）。
