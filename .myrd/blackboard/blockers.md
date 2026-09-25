# 阻塞项黑板 — M2 首卡 stack-tower

> 更新时间：2026-09-25（M2 冲刺收口）
> 负责人：主策划（整合人）· 每次整合后更新；阻塞超一轮未解 → 升级主人，不空转
> 下一步：主人试玩终裁「好不好玩」；实现冲刺按契约 8 条转绿

## 当前基线
- 黑板路径：`.myrd/blackboard/`（levels.md / assets.md / blockers.md）
- **spec 版本号：v2 · approved（候选版）· platformSpecId `cmugal9ob0013gqlok6dstuyc`**
  - 版本链：v1 `cmuga6tq90011gqlo3wkh9k7a`（draft→superseded，QA 打回 QNC-05）→ v2（approved）
  - 工作基线导出：`.myrd/spec/design-spec.json`（契约测试与 QA 共同输入）
- M1 状态：转维护（`games/game` 糖果粉碎 Godot 卡 + pubg-web-core 主干），本冲刺未改 M1 代码

## 开放阻塞项

### B1 · T1 终裁记录原文平台不可达（已升级主人，冲刺内按任务锚点执行完毕）
- 现象：知识库（global 23/project 1）、决策记录、项目频道、goals/loopHistory、本地 workspaces 定点 grep 均无 2026-09-25 T1 终裁原文。
- 处置：以任务描述转述的四项锚点执行（首卡=stack-tower / world 段文本已固化进 spec v2 / tower-ripple 契约 / acceptance 两条必改）；QA 反例清单 8 项重建并固化为 QNC-01~08（见 `games/stack-tower/docs/qa-precheck.md` §0）。
- 需要主人：回传或指认 T1 终裁原文落点；若与任务转述有出入，以原文为准触发 spec 升版（v2 保留 superseded）。

### B2 · M1 占位项挂账（禁核销）
- `games/game`（糖果粉碎）与 pubg-web-core 的占位实现/未闭环项：本冲刺只挂账、不核销、不投入。
- 需要主人：维护期排期时逐项裁决。

### B3 · spec v2 为「approved 候选版」（代持台账，待主人终拍）
- 代持依据：主人显式指令「不要进入 plan mode 或等待人工审批，直接实现需求并提交代码」；主策划据此代记 approved（沿 transport-ship-3d v2 先例）。
- 红线不失效：好不好玩的最终裁决归主人试玩；一句否决 → 新修订置 draft，v2 superseded，契约随最新 approved 版重定基准。

## 已解决
- [x] QNC-05（sessionSeconds 口径不自洽）→ v2 修复（单关会话护栏口径 + 228 层推导显式化），QA 复审清零（2026-09-25）
- [x] 契约 runner 对齐检查取错文件名 bug → `process.argv[1]` 修复，8/8 对齐校验通过

## 收口区（M2 冲刺产物台账）
| 交付线 | 产物 | 落点 | 状态 |
|---|---|---|---|
| T2 策划 | spec v2 终稿（numeric 四组写死 / 首关 e01–e08 编号 / acceptance 8 条全命令化 / tower-ripple 契约） | 平台 spec + `.myrd/spec/design-spec.json` | approved 候选版 |
| T3 美术 | 风格卡 v0（四要素 + 留槽 S1–S5）+ 文字情绪板（12 关键词 + 8 色 + 构图脚本 + 落选卡归档） | `games/stack-tower/docs/style-card-v0.md` `moodboard-stack-tower.md` | v0 落盘 |
| T4 程序 | 技术方案 + 五件脚手架 + 三态契约 runner + 8 条契约骨架 | `games/stack-tower/`（docs/src/tests） | 骨架态 8/8 not-runnable（显式缺因） |
| T5 QA | 预审记录（逐条三态 + QNC-01~08 + 打回复审闭环） | `games/stack-tower/docs/qa-precheck.md` | CERTIFIED（骨架态） |
