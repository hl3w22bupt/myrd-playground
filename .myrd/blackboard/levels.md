# 关卡状态黑板 — g2-blocks（熔炉方块）· **DY 平台段校准入链 + approve-ready 包轮（v1.1 基线）**

> 更新时间：2026-10-06 11:0x（开工前置完成 · 主策划）
> 负责人：主策划（整合人）· 各节点署名回写 · QA 线维护核销列
> 下一步：N1 dy spec v6 校准入链（关键路径）∥ N2 dy 分支开线 + v1.1 锚点门禁（并行）
>
> 上轮黑板（WX 移植提审轮）：`/Users/leo/.myrd/workspaces/cmto0g28j0002m9sqnvjdy8o7/run-cmuuk3zvg002oicrykuhulees/.myrd/blackboard/`（只读沿档，不覆写）
> 上上轮黑板（V1.2 手感轮 + A 轮全档）：`run-cmut4m9ww00bvic7qxd1wpl7y/.myrd/blackboard/g2-blocks/`（只读沿档）

> 勘误声明：本 run 初版 levels.md 曾误记「g2-blocks 不存在」（初勘只扫了 run 子目录与平台 spec 列表）。
> 全盘搜索后实查：g2-blocks 仓库与上轮全部产物在位，本版以实查为准替换；误记不删除、以本声明留痕。

## 〇、本轮基线（开工实查 2026-10-06，非推断）

| 项 | 值 | 证据 |
|---|---|---|
| 源仓库 | `/Users/leo/.myrd/workspaces/cmto0g28j0002m9sqnvjdy8o7/g2-blocks`（独立仓库，main 末端 `6d3db6a`） | git rev-parse 实查 |
| v1.1 已发布基线 | `fe5fd38`（19bf249 的父提交，上轮同款锚点沿用） | 上轮 levels.md §〇 + `git log --format="%h %P" -1 19bf249` 复核 |
| wx 提审包（冻结只读） | 分支 `wx/port-v1.1`（末端 `2856d7c`）+ 镜像目录 `g2-blocks-wx/`（末端 `2856d7c` 同态） | git branch + 目录实查 |
| v1.2 冻结范围（零接触） | 手感 6 项 + daily-challenge + 视觉打磨包 + 全部 numeric（main 上 19bf249..6d3db6a 一段） | 上轮 blockers.md 红线① + git log 实查 |
| stack-tower 线（零接触） | 一号仓库，不在本工作区路径下；`ci/guard-repo-scope.mjs` 机判 | README 红线 + 守卫实跑（见 N2） |
| spec 链头 | **v5 draft `cmuusk0p60040icryguvlev9j`**（v1.3-platform · parent=v4）· 本轮 N1 在其上 version+1 出 **v6** | 平台接口实查 version=5 · status=draft |
| v1.2 手感轮 v4 | `cmut5fkyf00cbic7qudea13g6` draft **待批复，本轮零接触** | 上轮 blockers.md 知会区 |
| 契约共同输入（v1.1 approved 内容锚） | `302e63367f3dea63212ad689a33703d83886d145862db0d724df98e97fea2d89` | 上轮实查 + 本轮导出件复算（见 N1） |
| 上轮 dy 写案（校准对象） | `docs/platform/dy/dy-platform-copy.md`（wx/port-v1.1 @ 上轮 · draft · 双条目 dy-runtime / dy-share-kit · 零实现） | 文件实读 + checker `scripts/check-dy-copy.mjs` |
| 工具链实况 | 抖音开发者工具 CLI **未装**（沿上轮 W-1 同型披露：Node 侧机跑 + runbook 脚本化，不造假） | 本轮 N2 复查留档 |

## 一、本轮节点链台账

| 节点 | 负责 | 产物落点 | 验收信号 | 状态 |
|---|---|---|---|---|
| 开工前置 | 主策划 | 黑板三件（本目录）+ spec 输入固化（`.myrd/spec/g2-blocks/`） | 基线区写进 blockers.md | ✅ |
| N1 dy spec 校准入链 | 游戏策划 | `tools/build-spec-v14-dy.mjs`（守卫机判）→ `docs/spec/spec-v14-dy-payload.json` → POST revisions → **链 v6 draft**；导出件固化本 run | numeric 玩法面零 diff（逐字段对照报告）；新增平台参数逐个冻结无「待定」；tt↔wx 差异映射表（三栏）；合规文案双口径；引导路径显式；黑板四列表 | ⏳ 进行中 |
| N2 dy 工程适配 | 游戏程序 | 分支 `dy/port-v1.1`（自 `fe5fd38`）+ `src/platform/dy/*` + `tools/build-dy.mjs` + `tests/dy/*` + 包体审计 | v1.1 契约+冒烟锚点全绿先行；dy 新增段先红后绿；P95 对照不退化；门面外零 `tt.*` 直调 | ⏳ 待 N1 |
| N3 dy 素材包 | 游戏美术 | `assets/dy/`（与 wx 包物理隔离）+ 四列核对单 | 规格取自 N1 映射表；四要素零 diff 源自风格卡；实机截图 N2 绿后同批出图 | ⏳ 待 N1/N2 |
| N4 只读复检 | 游戏 QA | 复检器 verdict + 材料清单 dy 段 v2 | 三份输入齐才开检；四条判定无红才出 approve-ready | ⏳ 待 N1-N3 |
| N5 汇总提请 | 主策划 | blockers.md 提请区 + 回流主人 | 闭环三问过 + 决策归主人 | ⏳ 待 N4 |

## 二、硬约束（任务书原文，全程生效）

1. v1.2 冻结范围（手感 6 项 + daily-challenge + 视觉打磨包 + 全部 numeric）零接触；
2. 不开新产品线（dy 属 g2-blocks 平台扩展）；
3. wx 提审包冻结只读（分支 `wx/port-v1.1` + 目录 `g2-blocks-wx/`）；wx 提审 / v1.2 approve / dy 提审三项决策归主人；
4. stack-tower 线零接触（含其 spec/代码/黑板段）；
5. 黑板三件随派活建立，阻塞超一轮升级主人；spec 修订只走接口 version+1，禁止覆盖；不代拍 approve、不装绿。
