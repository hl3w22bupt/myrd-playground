# 资产清单黑板 — stack-tower（霓虹夜塔冲刺 r4 → B0 微信移植轮 → B1 上头循环 meta 资产 → **C 抖音移植轮平台素材**）

## C · 抖音小游戏移植轮（2026-09-30 开工 · 主策划）

> 更新时间：2026-09-30（C 轮开工首笔 · 主策划）
> 负责人：主策划（整合人）· 美术线维护产出登记 · QA 线维护查表核销
> 下一步：N2/N3 素材产出 **B-C-001 硬阻塞中**（见 blockers.md）；spec v1.5 已在 N1 定稿素材 id（见下表）

### C 轮风格卡（顶部，全轮唯一风格源，沿 B0/B1 红线不变）

- **风格派生纪律**：dy 平台素材全部从「霓虹夜塔」参考卡派生（`docs/style-card-neon-night-v1.md` + 基准四联图 + `src/render/theme.ts` NEON 色板唯一色值源），**风格四要素零漂移，仅规格裁切**；生成链沿用确定性 PNG 管线（pnglib.mjs），逐件 sha256 入 manifest；禁新编风格。
- **UI 接线纪律**：资产缺失走程序化 fallback，绝不抛错（沿 B1 判例）。

### C 轮 dy 平台素材预定 id（spec v1.5 条目内 assets 定稿，产出后逐件登记）

| # | spec id | 所属条目 | 落点（以 repo 根为基准） | 尺寸 | optional | 状态 |
|---|---|---|---|---|---|---|
| 1 | dy-share-card | dy-share-loop | `games/stack-tower/assets/tt/share-card.png` | 500×400 | **否（必选，主判据配图）** | ⏸ 待 N3 |
| 2 | dy-store-screenshot-01 | dy-submission-kit | `games/stack-tower/assets/tt/store-screenshot-01.png` | 1242×2208 | 否（必选） | ⏸ 待 N3 |
| 3 | dy-store-screenshot-02 | dy-submission-kit | `games/stack-tower/assets/tt/store-screenshot-02.png` | 1242×2208 | 否（必选） | ⏸ 待 N3 |
| 4 | dy-store-screenshot-03 | dy-submission-kit | `games/stack-tower/assets/tt/store-screenshot-03.png` | 1242×2208 | 否（必选） | ⏸ 待 N3 |
| 5 | dy-icon | dy-submission-kit | `games/stack-tower/assets/tt/icon.png` | 512×512 | 否（必选） | ⏸ 待 N3 |
| 6 | dy-record-highlight-cover | dy-share-loop（能力，非图片资产） | —（录屏帧派生，无独立素材文件） | — | **是（optional，缺失不构成打回项）** | ⏸ 待 N3（可选） |

- **QA 对抗互查口径（原文，N4 执行）**：上表 optional 列即 spec 标注真源——未标注 optional 而缺失，按 spec 缺陷打回；已标注 optional 者缺失不构成打回项。
- 录屏分享（能力，`tt.getGameRecorder` 系）与高光封面卡：能力级 optional，实现时素材从本局录屏帧派生，禁新编风格，不新增独立素材 id。



## B1 · 上头循环轮（2026-09-29 开工 · 主策划）

> 更新时间：2026-09-29（B1 开工首笔 · 主策划）
> 负责人：主策划（整合人）· 美术线维护产出登记 · QA 线维护查表核销
> 下一步：N2 参考卡 meta 扩展先行（两种范围通用）→ 四件套按 id 产出对照过检

### B1 风格卡（顶部，全轮唯一风格源）

- **风格派生纪律（沿用 B0 红线）**：meta 四件套全部从「霓虹夜塔」参考卡派生（`docs/style-card-neon-night-v1.md` + 基准四联图 + `src/render/theme.ts` NEON 色板唯一色值源），零新编风格；生成链沿用确定性 PNG 管线（pnglib.mjs），逐件 sha256 入 manifest。
- **meta 四件套预定 id（spec v1.4 落段后为准）**：`daily-challenge-card`（每日挑战面板卡）/ `mission-panel`（连击任务面板）/ `streak-badge`（连胜徽章）/ `icon-badge`（奖励角标图标）。尺寸与 9-slice/透明度交付规格在 N2 参考卡 meta 扩展中定稿。
- **UI 接线纪律**：N3 程序先以主题令牌（theme token）占位渲染，N2 资产就绪后即插即换；资产缺失走程序化 fallback，绝不抛错。

### B1 · meta 四件套交付登记（N2 美术线 · 2026-09-29，查表 34/34 PASS）

> 更新时间：2026-09-29（N2 完成 · 主策划）· 复现链 `tools/gen-meta-assets.mjs`（确定性重跑逐字节一致实证）· 查表 `tests/meta/assets-meta-check.mjs`
> 参考卡 §7 meta 扩展已登记（`docs/style-card-neon-night-v1.md`，两种 scope 通用）

| # | spec id | 落点 | 尺寸 | 9-slice | 查表 |
|---|---|---|---|---|---|
| 1 | daily-challenge-card | assets/meta/daily-challenge-card.png | 360×160 | 24px | PASS（sha256+尺寸+透明底四角+NEON 派生色命中） |
| 2 | mission-panel | assets/meta/mission-panel.png | 360×200 | 24px | PASS（missions-deferred 预留件，产出在档不接线） |
| 3 | streak-badge | assets/meta/streak-badge.png | 96×96 | — | PASS |
| 4 | icon-badge | assets/meta/icon-badge.png | 64×64 | — | PASS |

- manifest 逐件 sha256 在 `assets/meta/manifest.json`（derivedFrom = 参考卡 v1.0 + theme.ts NEON 表唯一色源，零新编风格）。

### B1 · meta 四件套接线登记（N2 美术线收口 · 2026-09-29，查表 48/48 PASS）

> 更新时间：2026-09-29（N2「即插即换」接线收口 · 游戏美术）· 证据 `gate-logs/b1-art-wiring-20260929/`（10 项门禁四要素齐）
> 窄口径落死（spec v1.4 scope_gate=narrow）：**3 件接线 + mission-panel 产出在档不接线**（查表有专项断言防误接）

| spec id | 资产落点 | 接线点（呈现层） | 接线形态 |
|---|---|---|---|
| streak-badge | assets/meta/streak-badge.png | `src/ui/meta-badge.ts applyBadgeSkin()` ← `src/app/main.ts` meta 段 | 装载成功 → 徽章背景即插即换 |
| daily-challenge-card | assets/meta/daily-challenge-card.png | `src/ui/meta-daily-card.ts applyCardSkin()`（新卡面呈现） | **9-slice slice 24 fill**（spec 四角 24px 安全区）；缺项回 theme 令牌底 |
| icon-badge | assets/meta/icon-badge.png | `src/ui/meta-daily-card.ts applyIconSkin()`（当日已领取角标） | 皮肤化 → 角标图；缺项 → NEON 令牌 ✓ 字形 |
| mission-panel | assets/meta/mission-panel.png | **无（missions-deferred 预留，下一轮接线）** | 查表断言「不接线」防误接 |

- **接线纪律自证（acc-t1 / assets.md 红线同规）**：新呈现面零色值字面量——`DAILY_CARD_TOKENS` 全量派生 `render/theme.ts` NEON 表（α 通道由 `UI_PANEL_HUD_ALPHA` 计算，查表断言「fallback 底色 = theme 令牌派生」逐字比对）。
- **三态语义复用**：`loadMetaAssets`（`src/render/assets.ts`，与 `loadGameAssets` 同源）——无加载器（headless）→ 空；单项 404/解码失败 → null → 令牌态；**绝不抛错**。404 负面用例实证：`assets:check` 资产全 404 下核心循环可玩、零代码错误。
- **既有契约零触碰**：核心 9 项 `ASSET_MANIFEST` 一字未动（`tests/assets-check.mjs` 硬断言 9 项契约原样 PASS (browser)）；meta 走独立 `META_ASSET_MANIFEST` 导出。
- **交付链**：`sw:generate` 目录扫描确定性产出 → precache 100→**101**（+`build/ui/meta-daily-card.js`，离线导入链完整——acc-d2 断网全链路 PASS）；`export/web/` 镜像 `diff -r` 逐字节全等。
- **门禁全绿（本轮美术侧取证）**：查表 48/48 / assets:check PASS (browser) / run-all 39/39 / 根 contract-check PASS / smoke PASS (browser) / acc-b8 4-4 / acc-d2 2-2；wx/numeric 目录 git diff **0 文件**。
- **挂账主策划（非阻塞）**：SW CACHE 维持 `st-precache-v2`（acc-b8 冻结断言字面）→ 已缓存 v2 的回头用户暂拿不到本轮 main.js 增量（新装即刻生效）；触达回头用户须 `META_CACHE_EPOCH` 1→2，牵动 acc-b8/spec 条款，不擅动。




## B0 · 微信小游戏移植轮（2026-09-28 开工 · 主策划）

> 更新时间：2026-09-28（B0 开工首笔 · 主策划）
> 负责人：主策划（整合人）· 美术线维护平台素材产线 · QA 线维护查表核销
> 下一步：N1 素材 id 一步定稿（spec v1.3 platform 段）→ N2 美术按 id 产出 → N3 查表入提审材料清单

- **风格派生纪律（本轮红线）**：全部平台素材从「霓虹夜塔」参考卡派生（`docs/style-card-neon-night-v1.md` + 基准四联图 @ `098e28b7…` + theme.ts NEON 色板唯一色值源），**零新编风格**；生成链沿用确定性 PNG 管线（pnglib.mjs），逐件 sha256 入 manifest。
- **平台素材 id 预定稿（spec v1.3 落段后为准）**：wx-share-card-5x4（会话分享卡 500×400）/ wx-share-timeline-1x1（朋友圈 500×500）/ wx-store-screenshot-01..03（商店截图）/ wx-friend-rank-ui（好友排行 UI）/ wx-icon（应用图标）。**计数注记**：任务书口径「8 项」与定稿 id 清单 7 项差 1——按「素材 id 一步定稿」原则以 id 清单为准执行，差额待主人指认增补 id，不擅自新编。

### B0 · 平台素材交付登记（N2 美术线 · 2026-09-28，查表 7/7 PASS）

| # | spec id | 落点 | 尺寸 | 查表 |
|---|---|---|---|---|
| 1 | wx-share-card-5x4 | assets/wx/share-card-5x4.png | 500×400 | PASS（主判据素材，sha256+尺寸+NEON 派生色命中） |
| 2 | wx-share-timeline-1x1 | assets/wx/share-timeline-1x1.png | 500×500 | PASS |
| 3–5 | wx-store-screenshot-01..03 | assets/wx/store-screenshot-0{1..3}.png | 1242×2208 | PASS ×3 |
| 6 | wx-friend-rank-ui | assets/wx/friend-rank-ui.png | 460×560 | PASS |
| 7 | wx-icon | assets/wx/icon.png | 120×120 | PASS |

### B0 · 美术线收口复核（2026-09-28 · 游戏美术 · 只检不新做，全部 PASS）

> 上轮复核（`f64657d`）仅登记程序线（levels.md）；本轮补美术面独立复核，证据 `gate-logs/b0-wx-port-20260928/recheck-20260928-art/`（5 日志四要素齐）。
- **零漂移**：重跑 `tools/gen-wx-assets.mjs` → 7/7 逐字节一致，`git diff` 空；`assets/wx/manifest.json` 逐件 sha256 独立复算 7/7 全等。
- **查表复跑**：`tests/wx/assets-wx-check.mjs` **7/7 PASS**（sha256 + PNG 头 + 尺寸 = 定稿 + 派生色 `#0b1026` 精确命中）；r4 P0 13 件查表 13/13（未被本轮触碰）。
- **门禁复跑**：wx-GATE **6/6 PASS**（含素材查表项）；根契约 `scripts/contract-check.mjs` **RESULT: PASS**（31/32 + acc-a7 not-runnable 具 spec 挂账背书，与 f64657d 基线口径逐字一致）。
- **风格派生纪律核验**：manifest `derivedFrom` = 霓虹夜塔参考卡 v1.0 + theme.ts NEON 表唯一色源；零新编风格 ✓。接线面：`src/platform/share.ts` 分享卡常量（真源 manifest）+ `tools/build-wx.mjs` 镜像 3 件入 `export/wx/assets/wx/` + icon 入组包配置。
- **计数口径维持**：spec 定稿 id 7 项为准；任务书「8 项」差额维持挂账主人指认，未擅自新编（风格统一 > 凑数）。
- **美术线 B0 收口态**：7 id 平台素材全过检零漂移，无新做项；后续唯一触发条件 = 主人指认增补 id 或对色板给方向（升卡 → 改 theme.ts → 重生成 → hash 留痕）。

- 生成链：`tools/gen-wx-assets.mjs`（解析 theme.ts NEON 表取值，解析失败即失败；无随机数，重跑逐字节一致）；manifest = `assets/wx/manifest.json`（逐件 sha256）。
- 查表执行器：`tests/wx/assets-wx-check.mjs`（sha256 + PNG 头 + 尺寸 = 定稿 + ≥1 像素精确命中 NEON 表），N3 证据 `gate-logs/b0-wx-port-20260928/wx-track/6-assets-wx-check.log`。
- 附：wx BGM 环素材 `assets/bgm/neon-loop.m4a`（`tools/gen-bgm.mjs`，f0 锁相无缝环 9600ms，与 `src/audio/bgm.ts` LOOP_MS 同值断言）——wx-runtime 实现件，非平台素材 id 清单项。

> 前轮纪要：2026-09-27（**r4 美术线复检轮 · T3 美术**：N2/N3 交付「只检不新做」独立复检——**风格卡/查表/hash 全部过检，捡出并修复 1 件物证缺陷 F1**（四联图塔吊剪影 2→3 道对齐风格卡 §3，详见 §r4 复检记录）；开工首笔环境复核：OD 守护进程仍不可达（本轮 MCP 通道第 3 次独立复现，维持升级主人）、cwd 非 repo root 异常未复现）
> 本轮前纪要：2026-09-27（**r4 开工 · 主策划**：换装「霓虹夜塔」+ P0 资产 13 项。开工首笔：①**风格卡冻结纪律生效**——A1「霓虹夜塔」参考卡冻结 v1.0 前，任何 r4 新资产不得进验收；②OD 守护进程 127.0.0.1:7456 不可达（两通道四次复现，留痕见 blockers.md §E0）——本冲刺资产产物一律落 repo 文件 + hash，不落 OD 画布，不降级为纸面件；③P0 13 项清单与拆分口径见 §r4-P0）
> 前轮纪要：2026-09-26（**正式发布轮 r3**：发布对象变更 → 当前分支 HEAD `436be68`，T3 美术线按「只检不新做」对 HEAD 发布面独立复检四项——**全 PASS**，资产面相对 9/25 基线/r1/r2 **逐字节零漂移**；终检记录落 `gate-logs/release-m21-20260926-r3/art-final-check.md`；资产核对状态 = **终检完成（r3 四项全 PASS）**，`sfx-<事件id>` 注册表**双签完成**（程序侧 healthcheck §5 + 美术侧 r3 §复签）；U6/U7 属壳/注册链路，非素材面，U7 美术面口径见 r3 记录 §已知未收口项）

## r4 · 美术线复检轮（2026-09-27 · T3 美术 · N2/N3 只检不新做）

- **开工首笔环境复核**：①OD 守护进程 `127.0.0.1:7456` **仍不可达**——本轮经 open-design MCP `get_active_context` 独立复现（报错原文同 §E0），累计第 3 次跨轮复现，**维持升级主人待修**；本轮产物继续以 repo 文件 + hash 为准，风格卡回流 OD 复核项继续挂起。②cwd 非 repo root：**未复现**（本轮 shell 初始 `pwd` = `git rev-parse --show-toplevel` = run 工作区根；执行中差异系美术自查主动切目录所致，非环境异常，不冒领）。
- **N2 复检 = PASS（含 1 件物证缺陷 F1，已修复）**：风格卡 v1.0 三要素齐全（版本+日期+生效范围）✓；基准四联图 manifest sha256 与磁盘逐字节一致 ✓；**确定性复现再证**——重生成 13 件 P0 + 四联图，`git diff` 全空（零漂移）✓；四面板与卡 §3 逐条目视+像素双验 ✓。**F1**：四联图生成器塔吊剪影画 2 道，与卡 §3「3 道」及 runtime backdrop（×3）不符 → `tools/gen-neon-reference.mjs` 修正 2→3 道（几何比例 0.18/0.52/0.84 对齐 backdrop），重生成后 **sha256 `01ea413e…` → `098e28b7f1a29479…`**（manifest 同步）；卡条款零变更、版本维持 v1.0，勘误留痕见卡 §5。像素抽验：四面板立柱列簇 x=43/125/202（相对位 0.18/0.52/0.84）全部命中。
- **N3 复检 = PASS（13/13）**：`node tests/assets-neon-check.mjs` 本轮复跑 **13/13 PASS**；`assets/neon/manifest.json` 13 件 sha256 与磁盘逐件比对全等；spec v1.2 assets a08..a20 落点（theme.ts 单源）与登记一致。
- **机器门禁复跑（本轮美术侧取证，证据条款见 `gate-logs/r4-neon-juice-20260927-art-recheck/`）**：`node scripts/contract-check.mjs` 全量 —— 首跑 B 段 acc-d2 瞬时 FAIL（浏览器并发负载抖动，与 E0b 记录的 acc-j1 同源，判据零放松），**独立复跑 PASS（31/32 + acc-a7 not-runnable 具 spec 挂账背书）**；A 段 spec 基线 approved / C 段双向映射 / D 段 entities 20/20 / E 段 assets 20/20 全 generated。
- **N6 首图物证就绪**：`assets/reference/neon-night-quad-v1.png` @ `098e28b7…` 即主人首图定稿对象（四联图 = 风格卡 §3 四面板），随 N6 拍板；机器不替人判断，定稿权在主人。
- **复检增记（同日第二轮开工首笔，E3 后重证）**：程序线 §E3 驳回处置（acc-j1 spec 口径修复 / N6 备忘 hash 更正 / 证据补正）落树后，美术面三件套重证——①确定性复现：重生成 13 件 P0 + 四联图 hash 仍 `098e28b7…`，零漂移；②查表 13/13 PASS；③`node scripts/contract-check.mjs` 全量 PASS（31/32 + acc-a7 挂账背书，A–E 段同前）。**hash 链四方一致复核**（资产归属方）：manifest.json = 磁盘实算 = 风格卡 §5 = N6 备忘 §二.1，历史 `01ea413e` 引用均带作废标注。资产面自 F1 修复后零改动（`git diff 66852b4..HEAD -- assets/ src/render/ gen-neon-*` 全空）。素材路径与接线点状态不变：P0 13 件落 `assets/neon/`（对照件，查表入 contract acc-a8）；运行时换装走 theme.ts 单源程序化绘制（spec a08..a20 具名落点，fallback=程序化恒在）；M2.1 实体贴图 9 件接线点沿用（`src/render/assets.ts` ASSET_MANIFEST，404 降级不破坏运行）。
- **复检增记（同日第三轮开工首笔）**：`8a0bdb5`（备忘 §一证据表述对齐）落树后重证同轮结论——重生成 hash 仍 `098e28b7…` 零漂移 / 查表 13/13 / contract-check 全量 PASS；资产面相对 `95fa549` 零触碰。**美术线 r4 交付面维持收口态**：卡 v1.0 冻结 + 四联图 @ `098e28b7…` + P0 13 件全过检，无新做项（主人未给新方向前不擅动卡——风格统一纪律）；后续唯一美术动作 = 主人对首图/色板给方向后 30 分钟升卡 v1.1 → 改 theme.ts → 重生成 → hash 留痕。
- **deploy 节点发布面镜像增记（2026-09-27，程序/deploy）**：`games/stack-tower/export/web/` 按导出纪律重镜像——`assets/neon/`（P0 13 件）与 `assets/reference/`（四联图 @ `098e28b7…` + manifest）**首次进入部署发布面**；`sw.js` precache 清单 55→**74 项**（+theme/ripple-renderer/telemetry 三模块 + neon/reference 资产），`REVISION=1` 不变。素材文件零改动（hash 链不触碰，仅镜像与 SW 清单刷新）；构建链 `npm run build` + `tools/gen-sw.mjs` 双 PASS，门禁 `contract-check 74/74 PASS` + `smoke PASS (browser)` 同轮取证。

## r4 · 风格卡 A1「霓虹夜塔」冻结登记（N2 · 2026-09-27 冻结当日写回）

- **风格卡 v1.0 已冻结**：`games/stack-tower/docs/style-card-neon-night-v1.md`（版本号+日期+生效资产范围见卡头）。生效范围 = spec v1.2 assets a08..a20（P0 13 件）+ 渲染换装（backdrop/palette/textures/HUD style）。**冻结前零资产进验收，冻结后改色先升卡再动 theme.ts。**
- **基准四联图已带 hash 提交**：`games/stack-tower/assets/reference/neon-night-quad-v1.png`（484×724，**sha256 `098e28b7f1a29479…`**〔复检轮 F1 修正后，原 `01ea413e15e4c6ed…` 作废〕，全值见同目录 `.manifest.json`）+ 复现链 `tools/gen-neon-reference.mjs`（真源 theme.ts，确定性复现已验：重生成 hash 不变——本复检轮再证）。四面板 = 开局首屏（e09 初始摆位）/ 游戏中 / perfect 时刻 / 失败与重开（风格卡 §3）。
- 色值唯一真源 = `src/render/theme.ts` NEON 表（acc-t1 契约锚点）；本卡 §2 与 theme 逐字对应。

## r4 · P0 资产 13 项（N3 · 已落盘，查表 13/13 PASS）

**计数口径**：bg(1) + block-skin(6) + cut-face fx 三件套(3) + UI(3) = **13**。生成链 `tools/gen-neon-assets.mjs` → `assets/neon/`（13 PNG + manifest.json 逐件 sha256）。

| # | spec id | 落点 | 状态 | 查表（acc-a8） |
|---|---|---|---|---|
| 1 | a08-bg-night-gradient | assets/neon/bg-night-gradient.png | generated | PASS（垂直单向 + hex±5） |
| 2–7 | a09..a14-block-skin-base-01..06 | assets/neon/block-skin-base-0{1..6}.png | generated | PASS（三带 hex±5 / 禁描边 / 120×28） |
| 8 | a15-fx-cut-face | assets/neon/fx-cut-face.png | generated | PASS（发光填充禁描边） |
| 9 | a16-fx-ripple-ring | assets/neon/fx-ripple-ring.png | generated | PASS（中心对称） |
| 10 | a17-fx-perfect-glow | assets/neon/fx-perfect-glow.png | generated | PASS（additive 形态） |
| 11 | a18-ui-btn-primary | assets/neon/ui-btn-primary.png | generated | PASS（圆角 ±10% / 边框+内芯双色） |
| 12 | a19-ui-panel-hud | assets/neon/ui-panel-hud.png | generated | PASS（α0.72 / 禁描边） |
| 13 | a20-ui-icon-sound | assets/neon/ui-icon-sound.png | generated | PASS（字形锚点 ±10%） |

- 查表执行器：`tests/assets-neon-check.mjs`（**13/13 PASS**，2026-09-27），并经 contract `acc-a8` 并入 run-all 同门运行。
- 程序线复跑（2026-09-27 11:07–11:14）：**本轮零资产改动**，13 件 P0 + M2.1 运行时链两项门禁复验均 PASS（查表 13/13 / 9 项资产请求全 200 + 404 fallback 可玩），登记与磁盘一致；证据 `gate-logs/r4-neon-juice-20260927-prog-recheck/`（3、5 号日志）。
- **验收门开闭状态：风格卡冻结（2026-09-27）先于本表落盘 → 全部 13 件合法进入验收。**

## r4 之前的资产状态（r3 及更早，保持不变）
> 前轮纪要：2026-09-26（r1 正式发布轮开工）：资产面只检不新做，终检记录 `gate-logs/release-m21-20260926/art-final-check.md`（四项全 PASS，检对象 tag `stack-tower-m2.1-release` @ `5a3284f`）；2026-09-25（M2.1 复验轮·终证）：资产面五道门禁干净 shell 全量复跑——assets:check **PASS (browser)**（9/9 运行时 200 + 404 负面用例可玩）/ contract A–E 22/22 / run-all 22/0/0 / smoke PASS (browser)；gen-audio 确定性口径：PNG 逐字节确定 ✓，音频内容稳定但容器元数据非字节稳定
> 前轮纪要：2026-09-25（M2.1 复验轮·终证）：资产面五道门禁干净 shell 全量复跑——assets:check **PASS (browser)**（9/9 运行时 200 + 404 负面用例可玩）/ contract A–E 22/22 / run-all 22/0/0 / smoke PASS (browser)；gen-audio 确定性口径：PNG 逐字节确定 ✓，音频内容稳定但容器元数据非字节稳定
> 负责人：主策划（整合人）· T3 美术线维护资产段，T4 程序线维护实现段
> 下一步：N3 素材终检 → N1 sfx 注册表双签；B6 真机三项仍挂主人排期；主人试玩后如对色板/构图给方向性意见 → 风格卡 30 分钟升 v1

## M2.1 新增资产段（D2 交付）

| 资产 | 落点 | 规格 | 生成复现 | 核对 |
|---|---|---|---|---|
| a06-sfx-restart | assets/sfx/sfx-restart.{m4a,ogg} | 198ms（≤200 红线 ✓）440/587Hz triangle，critical=true | `node games/stack-tower/tools/gen-audio.mjs` | manifest.json events.restart.durationMs=198 |
| （声道实测口径） | 同上 6 个 .ogg | Vorbis ID 头实测 channels=1 / sampleRate=44100（6/6，python3 解析 `\x01vorbis` 包头） | 复验轮 2026-09-25 抽证 | m4a 侧 afconvert 写 stsd channelcount=2 元数据（流实为 1ch），机判以 ogg 头为准（qa-m21 §语义裁决留档） |
| sfx-pack-v1（12 文件） | assets/sfx/sfx-{place,perfect,miss,game-over,restart,level-clear}.{m4a,ogg} | 6 事件 × 双格式，44.1kHz 单声道 16-bit；事件 ≤400ms（最大 level-clear 398ms ✓）；共 66.74KB | 同上（音色表唯一真源 = src/audio/voices.ts，运行时降级同表合成） | `assets/sfx/manifest.json` = acc-a1 注册表断言点 |
| a07-pwa-icons（3 件） | assets/icons/{icon-192-maskable,icon-512-maskable,apple-touch-icon-180}.png | maskable 安全区内构图（塔块三层意象同风格卡）；共 4.68KB | `node games/stack-tower/tools/gen-assets.mjs`（新增 drawIcon 三 job） | PNG 签名 + 色值抽样已验（琥珀块/冷蓝天天空） |

### M2.1 缺陷修复记录（美术线，随 D2 一并落盘）
- **pnglib.mjs `blend()` 通道缺陷**：三通道循环误写 `r`（g/b 解构未用）→ 此前所有生成 PNG 的 R=G=B（全图灰度），琥珀塔块/冷蓝天空全部失色。M2 门禁只查 PNG 签名与可达性，未抽色值——盲区已记入 QA 台账；本轮修复 + 12 件全量重生成 + 色值抽样核对（e01 块面 = amber 0.78 阶 (154,84,43)）。
- 工具链备忘：本机 ffmpeg 无 libvorbis（原生 vorbis 编码器拒单声道）→ .ogg 用 `oggenc`（vorbis-tools 1.4.3，已 brew 安装）；.m4a 用 `afconvert`（系统自带）。生成器已固化该路径。

## 顶部：风格卡（v0 摘要）
- 主题锚点：stack-tower（叠塔 · 落块），主题项零编造，全部派生自 T1 锚定的「叠塔/塔/切面」意象与 spec world 段文本
- 光照逻辑：单顶光（正午顶光 + 底部冷色反弹），塔层自上而下明度 −2%/层（下限 0.55，`LAYER_SHADE_STEP/LAYER_SHADE_MIN`），制造「越叠越高」的读数感
- 对比度策略：塔块高饱和（暖色系）vs 天空低饱和（冷灰蓝），HUD 白字 + 深色描边，切面高亮描边 1px
- 构图脚本模板：见 `games/stack-tower/docs/style-card-v0.md` §3（首屏构图脚本）；实体素材命名映射见同文 §6.1
- 资产重量预算：单卡总预算 <300KB，程序化优先（Canvas2D 生成贴图 + WebAudio 合成音效），零外部下载；实体化实测 9 件共 29.19KB
- 归档不投入：snake-ghost / merge-td 情绪板（T1 终裁落选卡，不再投入工时）

## 资产清单

| 资产 id | 类型 | 落点 | 生成方式 | 状态 | 核对 |
|---|---|---|---|---|---|
| a01-block-palette | 色板 | games/stack-tower/src/render/palette.ts | 程序化常量表（8 色，与情绪板 §二逐条同源） | **implemented** | renderer/palette 同源，无散落色值；assets/ 生成器解析本文件取值（私设色值即拒生成） |
| a02-block-face | 贴图 | games/stack-tower/src/render/textures.ts | procedural:canvas2d（三面明度 100:78:55 + 切面白描边，缓存复用） | **implemented（fallback 态）** | 无 document 时返回 null，渲染层降级纯色；tileset 就绪时切片优先 |
| a03-bg-sky | 背景层 | games/stack-tower/src/render/backdrop.ts | procedural:canvas2d（冷灰蓝渐变 + 3 道塔吊剪影 α0.18 + 暮色线） | **implemented** | 构图脚本 L0/L1 对号 |
| a04-sfx-place | 音效 | games/stack-tower/src/audio/sfx.ts | procedural:webaudio（120Hz 短闷响 90ms） | **implemented** | 无 AudioContext 环境静音不抛错 |
| a05-sfx-perfect | 音效 | games/stack-tower/src/audio/sfx.ts | procedural:webaudio（880/1320Hz 双音叮 180ms，一次性） | **implemented** | 与 tower-ripple 呼应、不随 duration 循环 |
| a06-e01-block-base | 贴图 | games/stack-tower/assets/sprites/e01-spawn-first-block.png | tools/gen-assets.mjs（120×28，塔基块三面光照） | **implemented（已接线）** | renderer.drawBlock 塔基块分支；缺图回 a02 程序化 |
| a07-e02-block-move | 贴图 | games/stack-tower/assets/sprites/e02-swing-motion.png | tools/gen-assets.mjs（120×28，提亮 + 下缘反弹光烘焙） | **implemented（已接线）** | renderer.drawBlock 摆块分支（反弹光随图烘焙）；缺图回程序化 + drawBounceLight |
| a08-e03-guide-line | 贴图 | games/stack-tower/assets/sprites/e03-drop-input.png | tools/gen-assets.mjs（2×48 落点虚线，α0.3，L4 引导层） | **implemented（已接线）** | renderer.drawGuide（layers<2 显示）；缺图回 setLineDash 虚线 |
| a09-e04-cut-debris | 贴图 | games/stack-tower/assets/sprites/e04-overlap-cut.png | tools/gen-assets.mjs（120×28 错口碎块，失败黑 α0.25） | **implemented（已接线）** | renderer.drawDebris；缺图回 DEBRIS 纯色矩形 |
| a10-e05-perfect-pulse | 贴图 | games/stack-tower/assets/sprites/e05-perfect-window.png | tools/gen-assets.mjs（120×28 切面白脉冲框，§1 特殊时刻光） | **implemented（已接线）** | renderer 波纹期切面脉冲；缺图不加脉冲（保持「完美=克制」） |
| a11-e06-ripple-ring | 贴图 | games/stack-tower/assets/sprites/e06-tower-ripple.png | tools/gen-assets.mjs（240×96 三圈椭圆环） | **implemented（已接线）** | renderer 波纹分支（α (1−t)·0.9）；缺图回 ctx.ellipse 描边 |
| a12-e07-hud-scrim | 贴图 | games/stack-tower/assets/ui/e07-score-hud.png | tools/gen-assets.mjs（480×56 顶部渐隐衬底，无底板） | **implemented（已接线）** | renderer 帧末绘制；缺图不绘衬底 |
| a13-e08-restart-skin | 贴图 | games/stack-tower/assets/ui/e08-fail-recover.png | tools/gen-assets.mjs（96×32 圆角按钮皮肤） | **implemented（已接线）** | hud.applyRestartSkin（app/main 预载回调）；缺图保持 CSS 底 |
| a14-block-tileset | tileset | games/stack-tower/assets/tileset/blocks-tower.png | tools/gen-assets.mjs（360×28，暖色三循环 A/B/C cell） | **implemented（已接线）** | textures.sliceTileset（blockFace 切片优先）；缺图回程序化画布 |

落盘核对：
- `node scripts/contract-check.mjs` E 段 → spec 登记 assets **7/7**（spec v3：a01–a05 + a06-sfx-restart + a07-pwa-icons，全部 source=generated，零外部资源；M2.1 复验轮终证 2026-09-25 复跑 PASS，取证 `gate-logs/m21-reverify-20260925-art-final/`）。
- 实体贴图 a06–a14 登记于本表（spec assets 段不动，属 T3 资产段管辖）：
  - 生成复现：`cd games/stack-tower && npm run assets:generate`（PNG **逐字节确定**，复验零漂移；单资产 >50KB 或总量 >300KB 即非零退出）。音频 `npm run audio:generate` 为**内容稳定、字节不稳定**（容器时间戳/序列号），复验 12 文件零内容漂移；无内容变化不重生成入库。
  - 接线复现：`cd games/stack-tower && npm run assets:check` → 三态门禁：浏览器级（运行时 9/9 请求 200 + 「贴图就绪 9/9」+ 零页面错误 + **资产全 404 负面用例核心循环仍可玩**）/ 降级（静态可达 + PNG 签名）/ FAIL。复验轮终证 **PASS (browser)**（playwright 装载器已统一自动发现，无需手工注入环境变量）。
  - 降级纪律：`src/render/assets.ts` 无加载器（Node 契约测试）→ 空清单走程序化；加载失败 → 单项 null → 程序化绘制；任何情况不抛错、不刷 console.error。

## 红线
- 零外部资源（不引入 http(s) 外链、不下载素材包）；assets/ 全部由仓库内生成器产出并入库。
- 任一资产超预算 → 先砍表现层细节，不动玩法数值。

## r2 复验轮增记（2026-09-26）

- 资产面**零改动**：`git diff stack-tower-m2.1-release..stack-tower-m2.1-release-r2 -- games/stack-tower/assets/` 为空（r1 美术终检与 sfx 双签结论**原样沿用**，不重复终检）。
- 资产核对状态 = 终检完成（r1 四项全 PASS）+ r2 可达性复验（线上 manifest/3 图标/12 sfx 资产通道 200，live-smoke L7 PASS）。
- 新立案 **U7**（非素材面缺陷，壳交付链路）：boot 补丁 Image 加载 base64→文本 blob → 贴图在线降级程序化绘制（素材本体在库且字节正确，属「素材已到位、壳未还原」）；修复点 `server/src/boot-script.ts` 约 3 行，待主人排期。**素材面无需重做。**

## r3 正式发布轮增记（2026-09-26 · 检对象 = 当前分支 HEAD `436be68`）

- **零漂移证明**：`git diff 75debf9..HEAD -- assets/ src/render/ tools/gen-assets.mjs tools/gen-audio.mjs` 全空；`stack-tower-m2.1-release-r2..HEAD` 仅 8 个文档/黑板文件（无码无机）；源面 ≡ 发布面 25/25 字节全等，sw.js / manifest.webmanifest 字节全等。
- **四项终检全 PASS**（本轮独立复检，证据 `gate-logs/release-m21-20260926-r3/`）：① maskable 安全区 3/3（contentPx 5565/39592 与 r1 逐位一致，检查器本轮入库可复现）；② 首屏对齐风格卡（内容色 = 色板基色 × 0.78 / × 0.55 逐位吻合三面明度链，bgBottom = `SKY_BOTTOM` 逐位一致）；③ 资产零缺失（precache 55 = 壳 30 + assets 25 全覆盖零重复，`REVISION=1` 冻结未动）+ sfx 注册表 **ART-SFX-REGISTRY-PASS 6/6**（critical 旗标与 spec 一致、restart 198ms ≤ 200 红线）；④ 体积（发布面 174.6KB < 300KB 预算，最大单件 16.7KB，零 >50KB PNG）。
- **机器门禁**：`npm run assets:check` → **PASS (browser)**（9/9 运行时 200 + 404 负面用例可玩）；`node scripts/contract-check.mjs` → **PASS**（acceptance 22/22 · E 段资产登记 7/7 全 generated 零外部资源）。
- 素材核对状态 = **终检完成（r3 四项全 PASS）+ 注册表双签完成**；接线面零改动（a06–a14 接线点沿用，无需重检——渲染代码相对基线零漂移）。
- **发布对象绑定闭合（美术线独立复验，2026-09-26 追加）**：r3 终检记录已绑定 tag `stack-tower-m2.1-release-r3` @ `26a53d7fe4460f2dedb55729f21399474159ac2e`——`git diff 436be68..tag`（assets/src/render/生成器）为空、工作树发布面 ≡ tag 树发布面、maskable 在 tag 树面重跑 3/3 同值；复核全文 `gate-logs/release-m21-20260926-r3/12-tag-tree-binding.log`（art-final-check §⑤）。此后发布面再变更须重开终检。
- U7 美术面口径：线上贴图呈程序化绘制形态属壳链路缺陷，素材本体与风格卡符合性不受影响，素材面无需重做（详见 r3 记录 §已知未收口项）。

### r3 对象对齐增记（程序侧，2026-09-26）

- r3 素材终检原检对象 = `436be68`；发布对象已对齐至 run 分支快进后 HEAD（tag `stack-tower-m2.1-release-r3` @ `26a53d7`）。**证据效力转移成立**：`git diff 436be68..4bfb875 -- games/stack-tower/assets/`（及全部发布面）为空 → 终检结论与 sfx 复签原样有效，无需重检（美术只检不新做）。
