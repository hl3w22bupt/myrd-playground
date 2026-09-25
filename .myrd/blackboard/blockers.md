# 阻塞项黑板 — stack-tower（M2 首卡 → M2.1「有声可装」）

> 更新时间：2026-09-25（**M2.1 复验轮**：五道门禁全量复跑取证——build 逐字节无漂移 / 契约 run-all 22/22 / contract-check A–E PASS（**基线漏切缺陷销账**，见缺陷台账）/ smoke PASS (browser) / assets PASS；补挂 daemon 未启动项）
> 负责人：主策划（整合人）· 每次整合后更新；阻塞超一轮未解 → 升级主人，不空转
> 下一步：主人人工拍板（试玩终裁「好不好玩」+ 指认 HTTPS 托管地址 + 真机三项排期）

## 当前基线
- 黑板路径：`.myrd/blackboard/`（levels.md / assets.md / blockers.md）
- **spec 版本号：v3 · approved（platformSpecId `cmugok2uz000xm9ilx42t8pnl`）**
  - 版本链：v1（T2 初稿）→ v2 `cmugal9ob0013gqlok6dstuyc`（M2 首卡，superseded）→ **v3（M2.1 增量：14 条新 acceptance，8 条冻结保留）**
  - 任务书所称「v1 冻结基线 / v1.1 / v1.2」与平台实查版本链不符 → 按红线以接口实查为准，本轮走 **v3**（POST revisions，version+1，未覆盖 v2）
  - 工作基线导出：`.myrd/spec/stack-tower-spec.json`（契约与 QA 共同输入；独立路径，见 B4）
- **总验收判据对账（M2.1）**
  - spec v3 含 14 条可测增量 acceptance 且标 approved ✅（另 8 条冻结 gameplay acceptance 原样保留）
  - `assets/sfx/` 12 文件（6 事件 × m4a+ogg，44.1kHz 单声道，A6=sfx-restart 198ms≤200）+ 3 图标（192/512 maskable + apple-touch-180）命名合规 ✅
  - 断网冒烟全链路通过 ✅（acc-d2：离线冷启动→一局→重开→静音持久 + sfx 404 负面用例）
  - 音频/输入/移动端契约测试全绿 ✅（14/14）；总盘 `PASS 22 / FAIL 0 / not-runnable 0`（含 8 条冻结回归）
  - 中端机基准自动化项：p95/jank 达标 ✅（acc-a5b 自动化口径；真机口径挂 §真机清单）
- QA 终审：`games/stack-tower/docs/qa-m21-verification.md`（22 条三件套 + 缺陷台账 + 真机清单）
- M1 状态：转维护（`games/game` 糖果粉碎 Godot 卡 + pubg-web-core 主干），本冲刺未改 M1 代码

## 开放阻塞项

### B5 · HTTPS 托管地址待主人指认（acc-d1 需要，不阻塞开发）
- PWA 可安装（install prompt / 添加到主屏）要求 HTTPS 托管；本地开发与自动化验收已在 `http://127.0.0.1` 口径全绿（localhost 属安全上下文）。
- 需要主人：一句话指认托管地址（如内网 nginx / 云端静态托管 / GitHub Pages 任一）。指认后执行 `acc-d1` 安装面真机核销（见 qa-m21 §3）。

### B6 · 真机三项 + 帧率/安装面挂日期（2026-09-26 待排期，不阻塞代码收口）
- acc-a2（iOS 首手势解锁）/ acc-m2（触控归一）/ acc-m3（遮罩暂停）真机核销 + acc-a5b 帧率面板录屏 + acc-d1 安装面。
- 证据形式：设备型号 + 录屏（清单见 `games/stack-tower/docs/qa-m21-verification.md` §3）。自动化面已全绿，真机未核销前不判「已完成」。

### B4 · spec 导出件路径撞车复发（糖果线导出件丢失，本轮起分路径治理）
- 现象：`.myrd/spec/design-spec.json` 当前内容 = stack-tower v2（M2 冲刺写入），糖果线（`games/game`，代号 Pixel Fives）的 approved v1 导出件被覆盖，且本分支 git 历史无可回滚版本（该路径首现于 c73e390 即 stack-tower 版）。
- 处置：stack-tower 基线迁 `.myrd/spec/stack-tower-spec.json`（契约 runner + e07 数值总闸同批改指）；`design-spec.json` 冻结现状不再写入；`.myrd/spec/README.md` 同步改口径。
- 需要主人：糖果线导出件从平台或原分支找回后归位（找回前糖果线 contract-check 不得作为验收依据）。

### B1 · T1 终裁记录原文平台不可达（已升级主人，冲刺内按任务锚点执行完毕）
- 现象：知识库（global 23/project 1）、决策记录、项目频道、goals/loopHistory、本地 workspaces 定点 grep 均无 2026-09-25 T1 终裁原文。
- 处置：以任务描述转述的四项锚点执行（首卡=stack-tower / world 段文本已固化进 spec v2 / tower-ripple 契约 / acceptance 两条必改）；QA 反例清单 8 项重建并固化为 QNC-01~08（见 `games/stack-tower/docs/qa-precheck.md` §0）。
- 需要主人：回传或指认 T1 终裁原文落点；若与任务转述有出入，以原文为准触发 spec 升版（v2 保留 superseded）。

### B2 · M1 占位项挂账（禁核销）
- `games/game`（糖果粉碎）与 pubg-web-core 的占位实现/未闭环项：本冲刺只挂账、不核销、不投入。
- 需要主人：维护期排期时逐项裁决。

### B3 · spec v3 为「approved 候选版」（代持台账，待主人终拍；沿 v2 同一依据）
- 代持依据：主人显式指令「不要进入 plan mode 或等待人工审批，直接实现需求并提交代码」；主策划据此代记 approved（沿 v2 / transport-ship-3d 先例）。
- 版本链完整性：v1/v2 均保留 superseded 未覆盖；v3 approve 前程序以 draft 走完全部契约（22/22 在 approved 后复跑全绿）。
- 红线不失效：好不好玩的最终裁决归主人试玩；一句否决 → 新修订置 draft，v3 superseded，契约随最新 approved 版重定基准。

## 已解决
- [x] QNC-05（sessionSeconds 口径不自洽）→ v2 修复（单关会话护栏口径 + 228 层推导显式化），QA 复审清零（2026-09-25）
- [x] 契约 runner 对齐检查取错文件名 bug → `process.argv[1]` 修复，8/8 对齐校验通过

## 收口区（M2 冲刺产物台账）
| 交付线 | 产物 | 落点 | 状态 |
|---|---|---|---|
| T2 策划 | spec v2 终稿（numeric 四组写死 / 首关 e01–e08 编号 / acceptance 8 条全命令化 / tower-ripple 契约） | 平台 spec + `.myrd/spec/design-spec.json` | approved 候选版 |
| T3 美术 | 风格卡 v0（四要素 + 留槽 S1–S5 + §6 实体素材命名映射）+ 文字情绪板（12 关键词 + 8 色 + 构图脚本 + 落选卡归档）+ **assets/ 实体贴图 9 件（29.19KB，按 e01–e08 命名，程序化生成器产出，接线三态降级）** | `games/stack-tower/docs/style-card-v0.md` `moodboard-stack-tower.md` `assets/`（sprites/tileset/ui）`tools/gen-assets.mjs` | v0 落盘 + 实体化已接线（门禁 `npm run assets:check` PASS (browser)，含 404 负面用例） |
| T4 程序 | 技术方案 v2 + 五件脚手架 + 三态契约 runner + 8 条契约（全部转绿）+ 内核/表现/平台实现 + 冒烟门禁 | `games/stack-tower/`（docs/src/tests/index.html/serve.mjs/build）+ 仓库根 `scripts/contract-check.mjs` | **implemented → green**：run-all 8/8 PASS；contract-check [A]–[E] 全 PASS；smoke PASS (browser) |
| T5 QA | 预审记录（逐条三态 + QNC-01~08 + 打回复审闭环） | `games/stack-tower/docs/qa-precheck.md` | CERTIFIED（骨架态）→ 实现态复跑证据已回填（见 qa-precheck §6，仅补证据不改三态结论） |

## 终局整合小结（M2 首卡生产就绪冲刺 · 2026-09-25）

### ① 预审三态闭环核对（QA 预审 ↔ 契约实跑，无遗漏）
- acceptance 8 条全部落「可执行」列：`node scripts/contract-check.mjs` B 段逐条实跑 = 8/8 PASS（含每条 RESULT: PASS 校验）。
- 三态无第四种静默：run-all 汇总 `PASS 8 / FAIL 0 / not-runnable 0`（not-runnable 通道保留、本轮为零）。
- 「人工」列保留 2 项不越权：开局不劝退体感（e05）、HUD 真实呈现（e07 的 DOM 呈现面）——机器只断言 formatHud 代理 + 冒烟点击后 HUD 文本变化，好玩与否归主人试玩。
- 「打回」列清零：QNC-05 已在 v2 修复并复审清零；实现冲刺未新增打回项。

### ② tower-ripple 事件契约闭环核对
- spec 双落点：content.towerRipple（payload/trigger/forbidden）+ world.architecture_rules。
- 内核：kernel/ripple.ts 载荷恰四业务字段（+type 判别），window_ms=perfectWindowMs(level)、duration_ms=300∈[250,350]；perfect 同 tick 上抛。
- 表现：消费点恰两个（renderer 波纹按 duration_ms 播放；sfx 完美叮一次性），无 screen-flash/整屏 aha 通道（契约 e06 第 4 条机判通过）。

### ③ numeric 齐备性闭环核对（四组全为写死数值，无「调优决定」）
- 完美判定窗口：140 −(l−1)×8，60 封底（L1=140）
- 切面宽度：BLOCK 120 / 行程 ±240 / 下限 36（=120×0.30）
- 计分：place +10；perfect 25+min(5×(combo−1),75)（连击 1/2/3 → 35/75/120 机判通过）
- 难度曲线：速度 160+24(l−1) 封顶 420；层目标 8+2(l−1)；12 关累计 228 层
- 防漂移双闸：kernel/numeric.ts 键序对齐 spec 导出序 + 契约 e07「数值总闸」序列化深比；契约检查 D 段另扫 kernel 违禁引用（Math.random/Date.now/performance.now/DOM）零命中。

### ④ 挂账与移交
- spec v2 维持「approved 候选版」代持（B3）；唯一未闭环 = 主人试玩终裁「好不好玩」。
- B1（T1 终裁原文回传）/B2（M1 占位项禁核销）维持开放，不因本冲刺收口而核销。


---

# M2.1「有声可装」收口台账（2026-09-25）

## 交付线产物

| 交付线 | 产物 | 落点 | 状态 |
|---|---|---|---|
| T2 策划（D1） | spec v3（14 条增量 acceptance + numeric audio/mobile/deploy 三组 + entities 五个 + sfxPack/mobile/pwa 段 + towerRipple.restart 事件契约；冻结四组与 world/levels 零改动） | 平台 v3 `cmugok2uz000xm9ilx42t8pnl` approved + `.myrd/spec/stack-tower-spec.json` | approved 候选版（B3 代持） |
| T3 美术（D2） | sfx-pack-v1 12 文件（place/perfect/miss/game-over/restart/level-clear × m4a+ogg，44.1kHz 单声道，66.74KB）+ 3 PWA 图标（4.68KB）；**附 pnglib 灰度缺陷修复与 12 件贴图重生成** | `games/stack-tower/assets/sfx/`（+manifest.json）`assets/icons/`；生成器 `tools/gen-audio.mjs` / `tools/gen-assets.mjs` | 落盘 + 合规（restart 198ms≤200） |
| T4 程序（D3 三波） | W1 AudioManager（解锁/预解码/8 音池/gain 0.9/静音持久/占位 buffer）+ TouchInput 守卫 + RotateOverlay + style 真源；W2 sfx-pack 接入（连击升调 cap+12、miss 重置、critical 不挤占）+ restart(source) 事件；W3 PWA 壳（manifest+sw.js 版本化 precache）+ ?fps=1 面板 | `src/audio/audio-manager.ts` `src/audio/voices.ts` `src/platform/*` `src/ui/{style,rotate-overlay,fps-overlay,hud}.ts` `src/kernel/{types,sim}.ts` `src/app/main.ts` `manifest.webmanifest` `sw.js` | implemented → green（22/22） |
| T4 契约 | 14 条 M2.1 契约（a1–a6 / m1–m4 / d1–d2）+ runner not-runnable 显式通道 + e07 总闸键序无关化 | `games/stack-tower/tests/contract/m21-*.spec.mjs` + `_runner.mjs` + `run-all.mjs` | 14/14 PASS |
| T5 QA（D4） | 22 条三件套核销 + QA 4 项修正落条核对 + 真机清单挂日期 + 缺陷台账（5 项）+ 机器口径边界声明 | `games/stack-tower/docs/qa-m21-verification.md` | 自动化面全绿；真机挂账 B6 |

## 缺陷销账（本轮发现即修，回归证据在 qa-m21 §4）
- [x] pnglib blend 通道缺陷（M2 遗留，全图灰度）→ 修复 + 12 件重生成 + 色值抽样
- [x] 遮罩激活未冻结内核（tick 继续推进摆块）→ main 帧循环 paused 整段跳过
- [x] unlock 补放早于预解码（降级语义倒挂）→ await preload 后补放
- [x] gen-audio manifest 键名覆盖 → m4aKb/oggKb
- [x] e07 数值总闸键序敏感 vs 平台键序归一化 → stableStringify 键序无关深比
- [x] **contract-check A–E 提交前置门禁 spec 基线漏切**（B4 迁移漏网：run-all/e07 已切 v3，但 `scripts/contract-check-stack-tower.mjs` 仍读已冻结的 `design-spec.json`，实跑仍对 v2 断言 8 条 acceptance / 12 实体 / 5 资产）→ 修复于 `scripts/contract-check-stack-tower.mjs`：① 基线解析改「一游戏一文件」优先（`stack-tower-spec.json`，缺失才回退 design-spec.json）；② `_platform` 元数据形状兼容（platformSpecId/status/version）；③ C 段两族映射（id 前缀 `ac-lvl*` ↔ levels[].elements 8↔8；横切 `acc-*` ↔ m21 契约文件 14↔14 双向防孤儿）；④ D 段实体落点花括号多路径展开（e-pwa-shell 四落点）。**复跑取证：RESULT: PASS**——[A] v3 基线 acceptance=22/entities=17/assets=7 · [B] 22/22 实跑 PASS · [C] 8↔8 + 14↔14 · [D] 17/17 + kernel 纯净性 10 文件 · [E] 7/7（2026-09-25，随 M2.1 复验轮）

## 挂账（不阻塞代码收口）
- B5：HTTPS 托管地址待主人指认（acc-d1 安装面需要）。
- B6：真机三项 + 帧率/安装面（acc-a2/m2/m3/a5b 真机口径/d1 安装）挂 2026-09-26 排期，证据=设备型号+录屏。
- B7：daemon 未启动（本轮无视觉依赖）——Open Design/pencil 视觉协作物未启用，本轮资产与呈现全部走仓库内程序化生成器（gen-assets/gen-audio），自动化门禁不依赖 daemon；主人如需视觉走查再启动。
- sfx_mapping 文案与 miss 绑定出入（spec v3 content.sfxPack）→ 下一版修订（文案级，不涉数值/acceptance）。
- 玩法落点裁决记录：主人已裁 **PWA 可安装**；微信/抖音小游戏进下期 backlog，主人可一句话改判。
