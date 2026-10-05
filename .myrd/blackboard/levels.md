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
| N3 平台合规视觉包 | 游戏美术 | privacy-popup-visual.md（一稿三态+触发时机+首启路径示意）+ compliance-visual-checklist.md（A–D 18 条，逐条条款编号+证据）+ wx-submission-kit.md（材料逐 id）+ 图标/截图规格官方锚点核对（直连被网络策略拦 → 锚点路径+后台勾对口径如实落档）；**补做轮（2026-10-05 · commit `0485004`）：官方原文全文拉取成功（§三A）+ wx-icon 交付件落盘** | 自查表 12 条机判 ✅ · 4 条待后台/环境 · 2 条主人侧 · **无团队面红项**；补做轮后 14 条可核 ✅ + 4 条 🟡 + 3 条主人侧，仍无红 | ✅（并入 e39c0a1 + 补做 0485004） |
| N4 复检与打包 | 游戏 QA | 复检器 `tools/qa-wx-port-recheck.mjs` → **15/15 · VERDICT: APPROVE-READY**（verdict JSON `docs/platform/wx/qa-wx-port-verdict.json`）；首启可玩代理证据 = headless 冒烟 PASS；提审包 `export/wx/` + 材料清单回流主人 | 三口径（双绿原件/合规逐条/numeric 逐字段 11/11）+ 三条显式验收项全过；治理面两处最小修正（守卫白名单前缀条目）随件披露 | ✅（commit cabef9e） |

## 三、程序线独立复跑台账（2026-10-05 · 游戏程序 · 不装绿纪律）

> 上轮 N2-P1/N2-P2 收口后，程序线对 g2-blocks-wx @ `cabef9e`（wx/port-v1.1）做独立复跑，全部机器输出原件落 `gate-logs/wx-port-20261005/12..16` 号日志。

| # | 复跑项 | 命令 | 结果 | 证据 |
|---|---|---|---|---|
| R1 | wx 三条目查（runtime/share/submission） | `node tests/wx/run-all-wx.mjs` | **3/3 绿 · exit 0**（22 断言全 PASS） | `12-wx-green-rerun.log` |
| R2 | 基线八门禁 | `node tests/run-all.mjs` | **8/8 PASS · exit 0** | `13-gate-rerun.log` |
| R3 | 契约检查（approved v1.1 导出件驱动 18 条） | `node scripts/contract-check.mjs` | **18/18 PASS · exit 0**（`CONTRACT: PASS 契约全绿`） | `14-contract-check-rerun.log` |
| R4 | devtools 侧验证 | `node tools/verify-wx-devtools.mjs` | **BLOCKED-ENV exit 2**（CLI 仍缺席，如实披露=W-1 不变） | `15-devtools-rerun.log` |
| R5 | 组包器确定性 | `node tools/build-wx.mjs` 后 `git status` | **exit 0 · 零 diff**（包面=生成链当前态） | `16-build-wx-rerun.log` |
| R6 | 包体独立审计 | `node tools/audit-wx-bundle.mjs` | **132,607B（129.5KB）· gzip 73,148B · PASS**（与在档 10 号审计逐字节同值） | 本机输出（复跑） |
| R7 | 红线复核：`git diff fe5fd38..wx/port-v1.1` | 变更 29 件全落谱系目录（ci2/dy1/wx6/spec2/scripts1/platform-wx5/tests-wx4/tools8）；kernel/feel/theme/numeric/daily/render **零接触 ✓**；4 行删除全在 ci 治理面（N4 已披露的白名单前缀修正） | PASS | 机判 `git diff --name-only` |
| R8 | routine 驳回修复：工作区根补 `scripts/contract-check.mjs` 薄壳入口（保留位 spec→g2 落点映射 · 游戏仓库自动发现 wx 交付线优先 · `G2_SPEC_PATH` 注入 · 检查逻辑零复制 exit 透传）；按 game-contract routine **字面命令** `node scripts/contract-check.mjs --spec .myrd/spec/design-spec.json --project .` 实跑 | **18/18 PASS · exit 0**；`--only` 透传形态 1/1 PASS · exit 0；游戏仓库 git 零变更 | `17-contract-check-workspace-entry.log` |

环境核验：spec 发现链双候选（本 run + 前 run）导出件 **sha256 全等 `ad5d5534…`**（v1.1 approved，锚 `302e6336…`）——前 run 目录被清理不影响复跑。仓库零 npm 依赖（`deps={}`），Node v26.7.0 原生 type-stripping 直跑。

**复跑结论：N2 交付双绿在当前 HEAD 真实成立（Node 侧）；devtools 侧维持 W-1 如实披露，不构成包面缺陷。**

## 三A、美术线 N3 缺口补做台账（2026-10-05 · 游戏美术 · 全部机器输出原件落 gate-logs 17..21 号）

> 缺口来源：上轮 N3 收口时官方文档被本机网络策略拦截（自查表 A-1 停「🟡 待后台勾对」、submission-kit wx-icon 行「待产」）。本补做轮换 web-reader 通道**全文拉取官方《小程序/小游戏审核规则》成功**，并补齐 wx-icon 交付件。落点 `g2-blocks-wx` @ `wx/port-v1.1` commit **`0485004`**（6 件：assets/wx/×2 + tools/×1 + docs/platform/wx/×3）。

| # | 补做项 | 做法 | 结果 | 证据 |
|---|---|---|---|---|
| G1 | 官方条款原文钉死 | web-reader 拉取 `developers.weixin.qq.com/minigame/product/reject.html` 全文 | 成功；钉死 1.2.2(1)(2)(3) 头像 logo 三禁令 · 3.6.5 有色背景 · 3.6.2 弹窗可关闭 · 3.2.9 素材图无广告网址 · 3.6.6 版号+健告 · 3.4.1/3.2.1 判据锚（逐字摘录进自查表 §E） | 自查表 `compliance-visual-checklist.md` §E |
| G2 | wx-icon 交付件补产 | `tools/gen-wx-icon.mjs`（源链 sha256 校验 + PNG IHDR 机判 512×512 + clauses 逐条记录；**精确复制派生**，装配区 assets/release/ 零触碰只读） | **5 pass + 1 残余 🟡（像素后台勾对）**；派生器重跑两遍逐字节一致（幂等实测） | `assets/wx/wx-icon-512.png` + `wx-icon-manifest.json`；sha256 `8a971534…` 与源件全等 |
| G3 | wx 三条目查复跑 | `node tests/wx/run-all-wx.mjs` | **3/3 绿 · exit 0** | `17-wx-green-n3redone.log` |
| G4 | 契约 + 守卫复跑 | `node scripts/contract-check.mjs` / `node ci/guard-repo-scope.mjs` | **契约 18/18 PASS · 守卫 146 文件零越界 · 双 exit 0** | `18-contract-check-n3redone.log` / `19-scope-guard-n3redone.log` |
| G5 | 组包器重跑（新素材防混包） | 重包前后逐件 sha256 指纹对比 | **零 diff**（仅 assets-manifest.json 时间戳字段异）；**wx-icon 不在包内** ✓（提审材料通道不占主包）；wx-k4 ≤4MB 断言随跑过 | `20-build-wx-n3redone.log` |
| G6 | 基线八门禁全量 | `node tests/run-all.mjs` | **8/8 · exit 0** | `21-runall-n3redone.log` |
| G7 | 红线复核：`git diff cabef9e..0485004` | 变更 6 件全落 `assets/wx/`+`tools/`+`docs/platform/wx/`；src/ 零接触 → **玩法/数值/运行时视觉面 diff=0**；v1.2 冻结面零接触 ✓ | PASS | 机判 `git diff --name-only`（本表记录时点实查） |

### 三A·二（2026-10-05 第二次补做 · commit `eb9ddab` · 分享环生产接线 + 截图选批）

> 缺口来源：勘验发现 `createWxShare` 无生产调用点——包内 5:4 分享卡为死重、菜单转发落宿主默认截图（ws-acc-1/4 纸面成立）。归因：上轮路径字面量只存在于 tests/（ac-13 扫 src/ 故未红），接线层缺位未被任何门禁覆盖。本轮以「组包器模板注入」架构补线，门禁零放宽。

| # | 补做项 | 做法 | 结果 | 证据 |
|---|---|---|---|---|
| G8 | 分享环生产接线 | `boot-wx` 改显式 `bootWx(opts)` 入口；路径字面量单源迁至 `tools/build-wx.mjs` game.js 模板（`shareImageUrl` 注入）→ `share.wireSharePassive(wx, clock, imageUrl)` 被动通道同卡同参；sid 走注入时钟（零 PII 可复现） | 先红（wx-s7/s8/s9 RED 在档）→ 后绿 **9/9**；注入缺失降级路径显式披露（纪律⑤，不破坏运行） | `gate-logs` 22 号；`src/platform/wx/{boot-wx,share}.ts` |
| G9 | ac-13 红转绿 | 首版接线把 `.png` 字面量写进 src → 契约 `ac-13-no-external-texture` **RED（17/18）**；改模板注入架构后 src 零图片扩展名字面量 | **18/18 PASS**；断言零放宽；红原件 `24a` 号在档（不装绿） | `gate-logs` 24a（红）/24（绿） |
| G10 | 商店截图选批定稿 | 亲验 4 张候选 → 选 01/03/04（首启引导 / 连击 ×7 / 关卡目标差异），落选 02 理由随件；逐张 3.2.9/清晰度/实机性 pass | kit §四 选批表（逐张 sha256，同批判 `be310288…`）；checklist A-3 升级 | `docs/platform/wx/wx-submission-kit.md` §四 |
| G11 | 门禁终态 8 组 | share 9/9 · wx 三条目 3/3 · 契约 18/18（仓内 + 工作区根薄壳 routine 字面命令）· 八门禁 · scope 守卫 146 文件零越界 · 组包 ≤4MB 断言 · 包内镜像断言（share.mjs 零 png / game.js 注入调用）· devtools BLOCKED-ENV exit 2 如实披露 | **8 组全绿**（devtools 沿 W-1 披露）；主包实测 **135,283B（132.1KB）**，较接线前 +2,676B（接线代码+模板），红线用量 3.2% | `gate-logs` 22..30 号 |
| G12 | 红线复核：`git diff 0485004..eb9ddab` | 变更 6 件全落 `src/platform/wx/`+`tests/wx/`+`tools/`+`docs/platform/wx/`；kernel/feel/theme/numeric/daily 零接触 ✓；v1.2 冻结面零接触 ✓；玩法/数值面 diff=0（diff 面=呈现层接线+组包模板+测试+文档） | PASS | 机判 `git diff --name-only`（本表记录时点实查） |

**谱系延伸**：`fe5fd38` → … → `cabef9e`（N4 收口）→ `0485004`（美术补做一）→ **`eb9ddab`（补做二：分享环接线）**——仍属「platform 段 + 提审材料通道追加」；G8 接线为呈现层装配（spec wx-share-loop summary「会话分享闭环」的落地完成），零玩法/数值 diff 口径不变。

## 四、驳回修复轮（2026-10-05 · wk-acc-3 隐私弹窗运行时 · 游戏程序 · QA 修法 (a)）

> 打回缺陷一（实现+spec 同修）按修法 (a) 执行：spec 行为条款（wk-acc-3 四谓词）+ N3 视觉稿（三态/触发时机）已定稿，属实现缺口非设计决策；修法 (b)（revisions 顺延）不动。缺陷二（devtools CLI）按 QA 口径维持披露不改码。随件注记（ac-10 scopeNote 文面冲突）归主策划定稿时以 revisions 注记澄清，非码面动作（本板 blockers.md 知会）。

| 项 | 落点 | 证据 |
|---|---|---|
| 先红 | wx-k5b..k5g 六条行为断言落 `tests/wx/wx-submission.spec.mjs`（wk-acc-3 四谓词 + 二次启动 + 叠绘契约），对无实现状态跑出 **PASS=8/RED=6**（红因=privacy.ts 不存在） | `24a-wx-submission-red-privacy.log` |
| 运行时件 | `src/platform/wx/privacy.ts`（新 · 290 行）：P1 requestShow+applyProbe 双条件才弹（顺序无关）；P2 卡片外 handleTap=false 透传玩法入口；P3 经 T1 门面 registerKey('privacy-consent') 读写 granted/denied（未注册键仍拒）；P4 装配零阻塞；× 关闭不落盘保留再询 | `24b-wx-green-privacy.log` 14/14 |
| 装配接线 | `boot-wx.ts`：registerPrivacyConsentKey 显式注册 + createWxPrivacyPopup + wx.onTouchEnd 并行监听 + rAF 包装（首帧回调完成后 requestShow · 每帧渲染后叠绘，零内核/main 改动）；`wx-k5e` 结构断言钉装配面 | g2 仓 `ed172e1` |
| 随件补线披露 | `adapter.ts` canvas.addEventListener 接入 canvasHandlers——原 fire 目标为空 Map（main.ts 的 pointerdown 在 wx 面静默丢失 = 触摸不可玩，runbook G2 会暴露）；属垫片自洽性修复，非设计变更 | g2 仓 `ed172e1` diff |
| theme 单源回归 | 首跑契约 ac-11 红（弹窗 6 色成裸 hex）→ 中性面收编生成链：`e-renderer-ui-tokens.json` privacy 段（标注来源=视觉稿定稿）→ gen-theme 输出 PRIVACY_UI → privacy.ts 单源引用（遮罩改 hexToRgba 动态拼，零字面量）。**色值逐字节同值=视觉零漂移；PALETTE 7 色零接触；theme sha `bb6ba8b3…`** | `24d`(红)→复跑绿 |
| 核对路径 | runbook 判定标准增 **G5 隐私项**（首帧后弹/拒绝不阻玩法/二次启动不重弹/× 保留再询）；`compliance-visual-checklist.md` B-1/B-2/B-5 证据补运行时锚 + 新增 **B-5a** 显式条件行（「隐私指引填报收集项→弹窗实现为提审硬前置」当前已满足，隐性前提消除） | `24f-devtools-final.log` |
| 终态回归 | 契约 **18/18** · 八门禁 **exit 0** · 三条目查 **3/3（14 断言）** · 冒烟 **PASS** · 组包 31 件 **150,530B（147.0KB）≤4MB** · devtools **BLOCKED-ENV exit 2**（W-1 维持） | `24b/24c/24d/24e/24f/24g` |
| 红线复核 | `git diff eb9ddab..ed172e1` 11 件全白名单（platform-wx/tools/tests-wx/docs-wx/theme 生成链/j1 证据）；numeric sha256 `302e6336…` 与 spec 冻结锚**全等**（零接触）；kernel/feel/daily 零 diff | 机判 |

## 五、红线（任务书原文，全程生效）

1. v1.2 冻结范围（手感 6 项 + daily-challenge + 视觉打磨包 + 全部 numeric）零接触，触碰即越界打回；
2. 本轮不开新产品线；
3. 提审决策归主人，团队只交包；
4. stack-tower 线全程零接触（含其 spec/代码/黑板段）；
5. g2 仓库红线沿 A 轮：不代拍 approve（v5 落 draft）；不装绿（缺位 → 显式披露）；内核纯净（零 Math.random/Date.now 直调面）。
