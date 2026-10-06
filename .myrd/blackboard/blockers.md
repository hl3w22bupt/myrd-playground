# 阻塞项黑板 — g2-blocks · **DY 平台段轮（收口态 · APPROVE-READY 包已回流主人）**

> 更新时间：2026-10-06 13:xx（N4 14/14 无红 · 主策划整合收口）
> 负责人：主策划（整合人）· 每次整合后更新；阻塞超一轮未解 → 升级主人，不空转
> 下一步：**等主人拍板**（dy 提审与否 + AppID/资质 + 提审日规范人工核对）；v1.2 批复在途互不阻塞

## 当前基线（收口态）

- **黑板路径**：`/Users/leo/.myrd/workspaces/cmto0g28j0002m9sqnvjdy8o7/run-cmuvzeu0a0167icrywu8c0k10/.myrd/blackboard/`（levels.md / assets.md / blockers.md / dy-acceptance-map.md + gate-logs/，run 仓已提交固化）
- **spec 版本号**：
  - **链头 = v6 draft `cmuw3gcgm01a9icryraii5dzp`**（v1.4-dy · parent=v5 `cmuusk0p60040icryguvlev9j`）· 本轮 N1 入链产物 · **未 approve，决策归主人**
  - v1.2 手感轮 v4 draft `cmut5fkyf00cbic7qudea13g6` 待批复（本轮零接触，锚 `1720df8e…` 复核保留）
  - 契约共同输入 = v1.1 approved 导出件（锚 `302e63367f3dea63…`，玩法 numeric 与 v6 逐字段全等）
- **代码**：g2 仓 `dy/port-v1.1` @ `023e583`（N1 `15d7340` → N2 `0feac16` → N3 `a303ccf` → N4 `51d84f8` → 复检可复现性修正 `566e650`/`cfb733c` → QA 驳回修复 `9b646df`/`023e583`，基线 `fe5fd38`）
- **包**：`export/dy/` 30 件实测 178,444B ≤ 4,194,304B（余量 95.7%，分包=不分包，先实测后定）
- **材料清单 dy 段 v2**：`docs/platform/dy/dy-submission-kit.md`（逐 id 对照 + 提审两步手册 + 双口径核对表）
- **在线部署坞（本轮 · AppHost）**：appId `cmuqelj2r0046m9zr4emgdgdg`（slug `g2-blocks-2`，唯一合法坑，谱系与下一轮操作提示见 `apphost-app.md`）· liveUrl `https://leomac-studio.tail49399e.ts.net/apps/g2-blocks-2/` · gitRef `myrd/run-cmuvzeu0a0167icrywu8c0k10` @ `57b3d67` · 部署 v12 running · 产物=游戏仓 `023e583` build/ 逐位（线上 main.mjs/sw.js md5 全等）· 线上自测 LIVE-SMOKE PASS + 截图目验炉板/HUD/引导条在屏

## 修正声明（复检可复现性 · 2026-10-06 12:0x · 游戏程序回写）

上轮 N4 的 14/14 系**预提交态测量**（复检器自身未入 HEAD → diff 少算自身）。HEAD 态重跑揭出「自指陷阱」残留：谱系白名单漏列复检器自身路径（15b 号 REJECT 原件在档）。已单点窄修（g2 `566e650`，判定语义不变）并干净取证 **17 号 14/14 无红 APPROVE-READY（HEAD 态可复现）**；今日冒烟复跑绿（18 号，guide 293ms/23 帧）。全程零触碰 v1.2 冻结面 / wx 冻结包 / stack-tower。

**追加（例行驳回修复 · 20 号）**：routine「游戏契约测试」MODULE_NOT_FOUND 已修——run 根新增派发壳 `scripts/contract-check.mjs`（定位 g2 仓 + `--spec`→`G2_SPEC_PATH` + 透传/退出码传播）+ `routines.yaml` specPath 校正；干净树终验 exit=0 · 18/18（20 号日志；19 号轮=美术并行只读复核 19a–19f 全绿，与本修互相独立、互为印证）。g2 仓零改动（壳在 run 仓），dy 包/门禁证据链不受影响。

**追加（QA 驳回修复 · 21/22 号 · g2 `9b646df`/`023e583`）**：打回面 2 条零码窄修全闭合——①P95 A 侧原始档已补（12 号位：worktree@`fe5fd38` 二次配对，26.1ms/71.06ms 与原始对同量级同结论，断链引用文在 13 号/复检器/verdict 三面统一勘误）；②材料清单 dy-icon/截图×3 状态列 ⏳→✅（引 manifest + 19 号轮取证）。修复后复检 14/14 APPROVE-READY + 契约 18/18 + dy 3/3 + 冒烟 286ms/23 帧全绿零回归。g2 锚 `dy/port-v1.1` @ `023e583`。

## 提请主人拍板（本轮回流 · 团队只交包）

1. **dy 提审与否**：approve-ready 包 + 材料清单 dy 段 v2 + N4 verdict（14/14 无红 APPROVE-READY）已就绪；提审动作 = 主人在抖音开发者工具/平台后台执行（两步手册见 `docs/platform/dy/dy-submission-kit.md` §二）。
2. **spec 链 v6 draft 是否 approve**（v1.4-dy 段）——approve 是主人拍板位，团队不代拍。
3. **正式 AppID + 类目/资质**（D-2）：下发后 `export/dy/project.config.json` 替换占位即可提审。
4. **提审日合规人工核对**（dk-acc-4 口径②）：以抖音官方当日生效规范逐条核对包内文案位，记录回填材料清单 §三。
5. **v1.2（链 v4）批复**：在途；若先批复 → dy 线 spec/分支按既定纪律 rebase 重出版（见债务台账）。

## 债务台账（防丢失 · 不阻塞本轮）

| 项 | 口径 |
|---|---|
| v1.2 rebase 计划 | v1.2（链 v4 `cmut5fkyf00cbic7qudea13g6`）若获主人批复 → dy 线（链 v6 + `dy/port-v1.1` 分支）按 revisions version+1 rebase 重出版，不做双版本线并行；若被否决 → 地基独立重落，v1.4-dy 条款不失效（revision_note 已写死） |
| wx 提审状态（一句话） | 上轮 approve-ready 包已回流（`wx/port-v1.1` @ `2856d7c` + `g2-blocks-wx/`），等主人拍板提审；本轮零触碰 |
| D-1 抖音开发者工具 CLI | 未安装 → 工具侧/真机档（G1–G4）待主人侧装 CLI 后一键复跑 `node tools/verify-dy-devtools.mjs`；**真机核对完成前包不得实际提审**（与 wx 轮 W-1 同口径维持披露） |
| D-2 AppID/资质 | 占位 `touristappid` 仅限工具内预览；正式号主人下发后替换 |
| D-3/D-4 闭环 | dy 条目 draft→final 已随 v6 入链落定（D-3 解除）；W-4 ac-10 scopeNote 文面冲突已随 v6 revision_note 注记澄清（顶层 18 条零改动） |
| build/ 镜像随件刷新 | `build/platform/dy/*.mjs` ×5 + `sw.js` 时间戳随 N3 构建刷新（A 轮 `0c3aa95` 先例），N4 窄断言机判在案 |

## 闭环三问（N5 提请前自检 · 全过）

1. **契约测试过了吗？** 过——v1.1 锚 18/18（复检重跑原件）+ v6 守卫 11/11 + 玩法 numeric 十二组逐字段全等。
2. **QA 打回修完了吗？** 修完——N4 首跑自曝 4 缺陷（ac-17 自检面/配表面语义/build 镜像断言/自指陷阱）全部修复，15a 原件在档。
3. **复检过了吗？** 过——N4 对抗复检 14/14 无红 VERDICT: APPROVE-READY；且经 15b→17 号修正轮，**在 HEAD 提交态重跑可复现绿**（不依赖预提交态测量）。

## 在途知会（非阻塞 · 主人可否决）

| 项 | 口径 |
|---|---|
| 地基前置 | 沿 wx 轮裁决：地基三件已在 v1.1 基线在档，cherry-pick 清单=∅（levels.md 实查记录） |
| 本轮不开新产品线 | dy 属 g2-blocks 平台扩展（映射表驱动，同构改面）；Steam/Roblox 仍 deferred |
| 黑板勘误留痕 | 本 run 初版 levels.md 曾误记「g2-blocks 不存在」（初勘面不全），全盘搜索后纠正，勘误声明在 levels.md 顶部留痕不删除 |
