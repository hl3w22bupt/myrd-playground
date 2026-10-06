# 关卡状态黑板 — g2-blocks（熔炉方块）· **DY 平台段校准入链 + approve-ready 包轮（v1.1 基线）**

> 更新时间：2026-10-06 12:0x（复检可复现性修正轮 · 游戏程序回写）
> 负责人：主策划（整合人）· 各节点署名回写 · QA 线维护核销列
> 下一步：等主人拍板（不变）；本轮新增：N4 复检器自指残留修复 + HEAD 态重跑取证全绿（见 §〇·五）
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

## 一、本轮节点链台账（收口态 2026-10-06 · N5）

| 节点 | 负责 | 产物落点 | 验收信号 | 状态 |
|---|---|---|---|---|
| 开工前置 | 主策划 | 黑板五件（本目录）+ spec 输入三件固化（`.myrd/spec/g2-blocks/`，run 仓已提交固化） | 基线区写进 blockers.md | ✅ |
| N1 dy spec 校准入链 | 游戏策划 | 链 **v6 `cmuw3gcgm01a9icryraii5dzp`** draft（parent=v5）+ 映射表 `docs/platform/dy/tt-wx-diff-mapping.md` + 守卫器/入链器/复核器三件 + 逐字段对照报告；g2 仓 `15d7340` | 守卫 11/11 + QA 独立复核 12/12（链上回读）；玩法 numeric 12 组逐字段全等（锚 `302e6336…`）；新增 5 参数逐个冻结；wx 三条目零覆盖；v4 手感锚 `1720df8e…` 保留 | ✅ |
| N2 dy 工程适配 | 游戏程序 | 分支 `dy/port-v1.1`（自 `fe5fd38`）；`src/platform/dy/` 五件 + `tools/build-dy.mjs`（export/dy/ 30 件 174.3KB ≤4MB 实测）+ `tests/dy/` 三条目查+冒烟；g2 仓 `0feac16` | v1.1 锚点先行三绿（01/02/03 号）；先红 0/3（05 号）→ 后绿 3/3（06 号）；dy 冒烟：引导路径 228ms/17 帧 ≤400/240 + 613 手自然炉冷（与离线推演逐位一致）；P95 配对 A/B Δ=0.0ms；门面外零 `tt.*` 直调（机判） | ✅ |
| N3 dy 素材包 | 游戏美术 | `assets/dy/`（icon/分享卡/同批截图×3/四列核对单）+ `docs/platform/dy/dy-submission-kit.md`（材料清单 dy 段 v2）+ 合规自查表；g2 仓 `a303ccf` | 四列核对单全绿（资产 id↔规格↔平台条款↔参考卡条款可追溯）；派生件 sha256 全等零漂移机判；装配区与 wx 通道零触碰；规格全取 N1 映射表 | ✅ |
| N4 只读复检 | 游戏 QA | `tools/qa-dy-port-recheck.mjs` + `docs/platform/dy/qa-dy-port-verdict.json`；证据 15/15a 号；g2 仓 `51d84f8` → **复检可复现性修正轮 `566e650`（复检器白名单补自身）/ `cfb733c`（verdict 刷新）** | 三份输入齐才开检 ✓；**14/14 无红 VERDICT: APPROVE-READY**；首跑自曝 4 缺陷全修（15a 原件在档）；REJECT 双锚点协议在器；**HEAD 态重跑复现绿（17 号，见 §〇·五）** | ✅ |
| N5 汇总提请 | 主策划 | blockers.md 提请主人拍板区 + 本板收口态 | 闭环三问过；决策归主人 | ✅ |

### 收口快照（一屏查两线）

| 线 | 状态 | 位置 |
|---|---|---|
| **dy（本轮）** | approve-ready 包 + 材料清单 dy 段 v2 已回流，等主人拍板提审 | g2 仓 `dy/port-v1.1` @ `cfb733c` · 包 `export/dy/`（30 件 174.3KB）· 清单 `docs/platform/dy/dy-submission-kit.md` · verdict `docs/platform/dy/qa-dy-port-verdict.json`（17 号重跑取证） |
| **wx（冻结只读）** | 上轮 approve-ready 包已回流，等主人拍板提审（本轮零触碰） | 分支 `wx/port-v1.1` @ `2856d7c` + 镜像 `g2-blocks-wx/` |
| **v1.2（冻结待批复）** | 链 v4 draft 在途，本轮零接触 | 链 `cmut5fkyf00cbic7qudea13g6` |
| **spec 链头** | v6 draft（本链 version+1 产物，未 approve） | `cmuw3gcgm01a9icryraii5dzp` |
| **stack-tower** | 全程零接触（守卫机判 151 文件零越界） | — |

### 〇·五 复检可复现性修正轮（2026-10-06 12:0x · 游戏程序 · 证据链 15b→18 全在档）

> 触发：按「重跑取证不认转抄」口径在 HEAD 态重跑 N4 复检器 → **REJECT（13/14）**。上轮 15 号的 14/14 系预提交态测量（复检器自身尚未入 HEAD，diff 少算自身），属「自指陷阱」修复不完整残留，非产品代码缺陷。留痕如下，原件不删除：

| 号 | 内容 | 结论 |
|---|---|---|
| 15b | HEAD 态重跑原件：⑦a 红（谱系外 7 ≠ build 镜像 6，第 7 件=复检器自身路径）+ ①a/①b 红（15b 日志未提交→ac-17 白名单外） | REJECT 原件 |
| 16 | 取证程序自污染对照件（日志先落 run 仓未提交 → ac-17 红），证明 ①a/①b 红为程序顺序问题、非交付物缺陷 | 程序性红 |
| 17 | 修复后干净取证（g2 HEAD=`566e650` + run 仓零脏文件，stdout 落盘后归档）：**14/14 无红 VERDICT: APPROVE-READY，exit=0** | **HEAD 态可复现绿** |
| 18 | dy 冒烟同日复跑：guide 293ms/23 帧 ≤400/240 · 613 手自然炉冷 · 零错误（N2 证据 JSON 未动，以此日志为今日绿证） | 冒烟绿 |

修复内容（g2 仓 `566e650`，单点窄修 + 根因注释在器）：`tools/qa-dy-port-recheck.mjs` 谱系白名单 tools 组补 `qa-dy-port-recheck`（本件即 N4 dy 交付物，黑板 N4 行已列名）；判定语义不变——谱系外仍须全为 build 镜像窄断言才放行（17 号详情=谱系外 6 全 build）。副作用修复：verdict JSON 曾被红跑覆写为 REJECT，已随 `cfb733c` 以 17 号取证刷新回 APPROVE-READY。

### 〇·六 HEAD 态全链复核轮（2026-10-06 · 19 号轮 · 只读复核 · 游戏美术执行）

> 任务书再次派发，链已收口；按「重跑取证不认转抄」口径在 HEAD（g2 `cfb733c` + run 仓零脏文件）重跑全部机器门禁，
> **零重做交付物、零触碰冻结面**，取证归档 `gate-logs/dy-port-20261006/19a–19e + 19-round-index.md`：

- 契约 18/18（锚 `302e6336…` 不降）· 门禁八组全 PASS · dy 条目查 3/3（26 行 RED=0）· 冒烟绿（guide 293ms/23 帧 ≤400/240 · 613 手炉冷 · 零错误）；
- N4 复检器 HEAD 态重跑 **14/14 无红 APPROVE-READY（exit=0）**——继 15 号 / 17 号后第三次独立复现绿；
- N3 素材四项机判全绿：icon/share 派生三面 sha256 全等零漂移 · 变更面隔离（`assets/release|wx|palette` 零触碰）· 规格全中（780×1688@2x / 512² / 720×1280）· 截图 manifest 对账 3/3；
- 证据 JSON（smoke-report / verdict）按 18 号口径还原未提交（仅时间戳与运行间抖动），今日绿证以 19d/19e 日志为准。
- **收口态维持：等主人拍板（不变）。**

### 〇·六 例行程序入口桥接（2026-10-06 12:xx · 游戏程序 · 平台驳回修复）

> 驳回：routine「游戏契约测试」在 run 工作区根执行 `node scripts/contract-check.mjs --spec … --project .` → `MODULE_NOT_FOUND`（契约入口实际在同级独立仓 `../g2-blocks/scripts/contract-check.mjs`）。

| 项 | 处置 | 证据 |
|---|---|---|
| 派发壳 | run 根新增 `scripts/contract-check.mjs`：定位 g2 仓（env `G2_REPO_ROOT` → 同级 `../g2-blocks`）+ `--spec`→`G2_SPEC_PATH` 翻译 + 其余参数逐字透传 + 退出码传播；零逻辑复制，替换显式打 `[dispatch]` 日志 | run 仓提交（见 git log） |
| specPath 错配根因 | `.myrd/routines.yaml` 旧值 `.myrd/spec/design-spec.json` 在本工作区不存在 → 校正为固化导出件实际落点 `.myrd/spec/g2-blocks/design-spec.json`（v1.1 approved · 锚 `302e6336…`） | 同上 + 19 号日志首行 |
| 终验 | 干净树上以例行确切命令实跑：**exit=0 · 18/18 PASS**（含 ac-17/18 双守卫）；壳三形态（原始命令/无参/`--only` 透传）实测全绿 | `gate-logs/dy-port-20261006/19-routine-dispatch-green.log` |

## 二、硬约束（任务书原文，全程生效）

1. v1.2 冻结范围（手感 6 项 + daily-challenge + 视觉打磨包 + 全部 numeric）零接触；
2. 不开新产品线（dy 属 g2-blocks 平台扩展）；
3. wx 提审包冻结只读（分支 `wx/port-v1.1` + 目录 `g2-blocks-wx/`）；wx 提审 / v1.2 approve / dy 提审三项决策归主人；
4. stack-tower 线零接触（含其 spec/代码/黑板段）；
5. 黑板三件随派活建立，阻塞超一轮升级主人；spec 修订只走接口 version+1，禁止覆盖；不代拍 approve、不装绿。
