# 资产清单黑板 — wheat-squad（二线孵化 · 可玩基线轮）

> 更新时间：2026-10-15（**R1 复测收口轮 N3 美术批 · 资产三态清单 + 视觉基线对账 + W-7 B 案落地**）· 负责人：游戏美术 · 主策划拍板：W-7 终局 = **B 案**（描述真实态化，A 案降级 R2 候选）
> 状态：manifest **v4 = 13 件 = 封顶**（件数零增减，仅 fx-hit-shock 通道真实态化）；run-all 复跑 **16/0/1PEND** 维持（机判面零影响留证 `gate-logs/r2-recheck-20261015/11`）
> 接手复核注记（2026-10-16 · 游戏程序 · R1 复测三态分流收口轮接手轮）：本轮零新增零改动资产——manifest v4 = 13 件口径经 ac-art-1..4 在 HEAD `0ff651f` 独立实跑再证（16/16 check 薄壳全过，`gate-logs/r1re-claims-recheck-20261016/00`），三态清单逐行维持原判
> 下一步：正式提审素材止步清单待主人拍板（W-6）；A3 结论面试玩采集进行中（v17 LIVE）；R2 若主人反馈指向无敌窗感知缺失 → A 案补环

## N3 · 资产三态清单（2026-10-15 · 任务书「已产出/缺失/占位，编号到资产」）

| # | 资产 id | 类别 | 三态 | 说明 |
|---|---|---|---|---|
| 1 | e-captain | entity | ✅ 已产出 | 程序化绘制规格（renderer.ts#drawSquad · theme.ts token 单源），色值白名单机判绿 |
| 2 | e-squadmate | entity | ✅ 已产出 | 同上（drawSquad） |
| 3 | e-pest | entity | ✅ 已产出 | renderer.ts#drawPests |
| 4 | e-bullet | entity | ✅ 已产出 | renderer.ts#drawEffects |
| 5 | e-wheat-pickup | entity | ✅ 已产出 | renderer.ts#drawEffects |
| 6 | ui-kit-01 | ui-kit | ✅ 已产出 | renderer.ts#drawHud（HUD 带/三选一卡/结算面板/按钮态） |
| 7 | guidance-hint-banner | ui | ✅ 已产出 | renderer.ts#drawGuidance（文案三方同名逐字机判绿 ac-16） |
| 8 | sub-icon | submission | ⏳ 占位 | placeholder-template（qa/submission/*.template.svg 512×512）——正式件止步清单归主人拍板（W-6） |
| 9 | sub-sharecard-5x4 | submission | ⏳ 占位 | 同上（1000×800 · 5:4 主判据卡） |
| 10 | sub-shots-3 | submission | ⏳ 占位 | 同上（3×1170×2080） |
| 11 | fx-kill-burst | fx | ✅ 已产出 | 通道 flash/particles/pickup-spawn 绑定在册，ac-05 面4 机判绿 |
| 12 | fx-hit-shock | fx | ⚠️ 部分（claimed 面缺失） | **W-7**：声称的「invuln 外圈呼吸」从未构建（渲染层零读 invulnUntilTick）——本轮 B 案勘误落改 manifest v4（channels → `['knockback']`）+ 风格卡 §R2.0 勘误；knockback 通道真实在档。**A 案补环 = R2 候选**（主人反馈触发） |
| 13 | fx-hud-channels | fx | ✅ 已产出 | 通道 hud-kills/hud-hp 绑定在册，机判绿 |

- **缺失件计数：0 整件缺失；1 件声称面缺失（fx-hit-shock invuln 环，W-7 已裁决处置）；3 件占位（提审正式件，止步清单归主人 W-6）**。

## N3 · 视觉基线对账声明（资产版本 ↔ HEAD sha 一致性）

- **声明**：截至本轮发布 commit **`813fa38bf1240e1ec261806ccbc248fdbb5346f5`**（v17 LIVE），视觉面基线 = **manifest v4（13 件）+ 风格卡 v1（含 §R2.0 勘误附注）+ theme.ts token 单源**；资产相关源面（renderer.ts/theme.ts/manifest.json/style-card）与该 commit 树一致，无未提交视觉变更。
- **机判佐证**：ac-art-1（12 文件扫描 · 色值 ⊆ palette 8 色白名单 · 零违例）/ ac-art-2（13 件 ⊆ 封顶 · 零清单外资产）/ ac-art-3（体积逐件达标 · 首包 0.09MB ≤ 4MB）/ ac-art-4（机制面+互查回执在档）——四条全绿复现于 `gate-logs/r2-recheck-20261015/08·11`（绑 sha `7b45b44` 采样 + `813fa38` 发布树，采样断言面两 commit 零差异已 diff 实证）。
- **零外部贴图纪律**：tex-1 绿（零位图文件 + 零贴图构造），全部视觉 = 程序化绘制规格（零资产文件落盘）。

## R1 特效批 + 登记闭合（2026-10-14）

| 件 | 状态 | 说明 |
|---|---|---|
| fx-kill-burst / fx-hit-shock / fx-hud-channels | ✅ 新产（程序化绘制规格·零位图） | feedbackChannels 绑 A4 视觉通道全集 **7 条**（击杀4+受击3；ac-05 面4 机判；「六通道」系代行笔误，r10 亲审更正——实现面 sim.ts:149/241）；色值 ⊆ palette（ac-art-1 绿）；manifest v3 + spec.assets v1.3 双登记 |
| ui-kit-01 / sub-icon / sub-sharecard-5x4 / sub-shots-3 | ✅ B 案补登 | spec.assets 追溯登记（statement 字面零改动）——ac-art-2 判定口径二义闭合 |
| 风格卡 v1 §R1 | ✅ 复核 | palette 三方机判全等 + 陈旧锚更正（链锚 v4→v5 · 件数 9→13）；§R1.2 特效批规格 + §R1.3 复算接口 |
| guidance-hint-banner / style-card-v0 | ✅ 零漂移 | 既有登记零改动（v1.3 既有件逐字节 EQUAL 机判） |

## 本轮新增（2026-10-12 · 可玩基线轮）

| 资产 | 状态 | 说明 |
|---|---|---|
| style-card-v1（四要素冻结版） | ✅ 主策划拍板 ✅ | `.myrd/blackboard/wheat-squad/style-card-v1.md`（调色板白名单/光照/线条/比例 + 资产清单规范 + 提审素材规格）；world.styleRef 派生源；v0 退役归档 |
| 资产清单机读件 | ✅ | `games/wheat-squad/assets/manifest.json` v1：9 件 ≤ 封顶 13（entities 数）——实体资产 5（e-captain/e-squadmate/e-pest/e-bullet/e-wheat-pickup，id ∈ entities ids）+ ui-kit-01 + 提审占位 3 |
| 提审素材占位模板 | ✅ 止步清单 | `games/wheat-squad/qa/submission/`（sub-icon 512² / sub-sharecard-5x4 1000×800 / sub-shots-3 1170×2080 三连模板 + 尺寸与红线 README；正式件待主人拍板） |
| game.ts 裸 hex ×5 | 🔧 N6 收口 | 上轮挂账「单源链 v0.2 机判门禁」本轮兑现：裸 hex 换 THEME token + ac-10 白名单机判入契约 |

## 复证轮登记（2026-10-12 · 游戏美术 · HEAD `aa448e5`）

任务书（双轨冲刺）重发，按 redispatch-survey-first 勘验定性为**复证而非重做**（可玩基线轮美术交付面 N4–N9 已收口 + N9 后两笔提交零触及代码/spec 面，`git diff 03cf8d7..HEAD -- games/wheat-squad .myrd/spec` = 空）。当前 HEAD 六项重证全绿：① 自有契约 13/0（含 ac-10..13 美术四条款）EXIT=0；② 统一契约门禁 CONTRACT: PASS；③ 三方色值机判升版（style-card-v1 ↔ theme.ts ↔ approved spec）8 色全等；④ 裸 hex 扫描 theme.ts 之外 0 命中——**上轮挂账 game.ts ×5 裸 hex 确认 N6 已兑现清零，单源链零违例**；⑤ 提审占位模板三件尺寸逐件命中 + manifest/模板 4 件完整 sha256 基线留证；⑥ scope-guard 双模式 49 文件零越界。诚实口径：本轮不重跑 WS-SMOKE（程序线运行面，代码面零字节漂移故 N9 结论输入全等）；A3 结论面维持 ⏳ 待真人回填；正式提审素材维持止步清单。台账与原文证据：`gate-logs/art-reverify-20261012/`（README + 01..06 log + check-palette-consistency-v1.mjs）。结论仅对 `aa448e5` 有效。

**r2（同日 · HEAD `9974553` 重锚）**：N10（程序线 routine 参数修复）零触及美术交付件，但改 `ci/scope-policy.json`/`routines.yaml`（本线门禁输入）→ 七项重证全绿（含 **4 件 sha256 逐字节零漂移**对照上轮基线 + scope-guard 双模式复证无回归）；N10 跨线改动经本线复核美术口径零冲突，认领登记。证据：`gate-logs/art-reverify-20261012-n10/`。结论仅对 `9974553` 有效。

**r3（同日 · HEAD `9035207` 重锚）**：N11（字面 specPath 薄壳入口=相对符号链接→approved 单源）零触及美术交付件，再改 scope-policy → 八项重证全绿，新增 ⑦ 薄壳入口可达性抽核（旧 specPath 亦达 approved spec，8 色 palette 全可读，色源单链对任意调用方不断）；N11「数值只认 spec 不造副本」处置与本线单源链纪律同构，认领零保留。证据：`gate-logs/art-reverify-20261012-n11/`。结论仅对 `9035207` 有效。

**r4（同日 · HEAD `32dc491` 重锚）**：N12（root `tests/contract` 薄壳链接→wheat 契约镜像，thin-proxy 第二件，W-4 闭环降知情项）零触及美术交付件，再改 scope-policy → 九项重证全绿，新增 ⑦b 契约薄壳入口抽核（**经 root 符号链直跑美术契约套件 13/0**，两入口同源同果）；弱面超集插桩实证非假绿、守卫豁免走显式声明，认领零保留。证据：`gate-logs/art-reverify-20261012-n12/`。结论仅对 `32dc491` 有效。

**r5（同日 · HEAD `5360846` 重锚 · 口径升级）**：N13（新建 **`games/wheat-squad/verify.sh`** 五步真门禁薄壳 + slug 命名薄壳 + gamePath 纠正）零触及美术交付件 → 按任务书「有 verify.sh 则跑全量」**门禁升级为 verify.sh 全量实跑**（统一契约/自有契约/**WS-SMOKE**/守卫双模式五步逐条 PASS · VERIFY-EXIT=0）——r1–r4「冒烟转引程序线」口径就此退役；美术专项四检（色值三方/裸 hex/零漂移/三薄壳入口 8 色 palette 全可读）全绿。认领零保留。证据：`gate-logs/art-reverify-20261012-n13/`。结论仅对 `5360846` 有效。

**r6（同日 · HEAD `729ef41` 重锚 · 他线首触代码面）**：N14（QA 对抗审查 D1/D2 修复：埋点键 `run_duration_ms` 三方同名真达成 + `endedReason` 枚举按 spec 单源对齐 + 新增 ac-14）改动 game.ts/sim.ts/settlement.ts，经 render/theme/manifest/style 过滤**零触及美术呈现面**、spec 零改动 → verify.sh 全量五步逐条 PASS（自有契约 **14/0** · 统一门禁 53/0 · **冒烟在埋点键名变更后仍全绿**）；裸 hex 触码后重点复扫仍仅 theme.ts，4 件资产 sha256 零漂移。AC-A4 人判面引用的机器输出自此经剥注释机判背书，可信度升级。认领零保留。证据：`gate-logs/art-reverify-20261012-n14/`。结论仅对 `729ef41` 有效。

**r7（同日 · HEAD `ed3b99b` 重锚）**：N15（`.myrd/spec/design-spec.json` 升格为确定性派生 gate-adapter 视图：内容原样+注入 id/slug 两键 + ac-15 漂移守卫）零触及美术源件 → verify.sh 全量五步逐条 PASS（自有契约 **15/0** · 统一门禁 53/0）；⑦ 抽核升级为**亲核**：单源/适配视图/slug 三入口 8 色 palette 逐值全等 + 注入键核实——适配视图定性为派生镜像非第二真源，与本线 theme.ts 派生镜像范式同构，认领零保留。证据：`gate-logs/art-reverify-20261012-n15/`。结论仅对 `ed3b99b` 有效。

**r8（2026-10-13 · HEAD `c33a816` 重锚 · spec v1.2 轮美术面复证）**：任务书重发，勘验定性**复证而非重做**——本轮（N2/N3 @`c4348e1`）美术交付面已收口：style-card-v1 §v1.2 增量（引导元素视觉权重规则定稿 + G-1 排版核对）+ manifest v2（新增 `guidance-hint-banner`：id→source→文案逐字，供 a5 存在性 check 机判）+ 三合一包两项索求面全回件零缺口。`304dacf..c33a816` 增量为纯黑板文档（git diff 路径零触及双证），主人无新美术方向 → **冻结件零触碰、零新产资产**（wx/dy 分享图维持不出）。当前 HEAD 八项重证全绿：① 基线 sha256 留证 7 件；② **verify.sh 五步全量 VERIFY_EXIT=0**（自有契约 16/0 含 ac-art-1..4 + ac-16）；③a 三方色值机判 8 色全等；③b 裸色值单源链两规则面零违例（代码面除 theme.ts 0 hex/rgba · SVG 模板 ⊆ 白名单）；③c 7 件交付件对 N8 锚 `304dacf` **逐字节零漂移**；③d 三入口 palette 亲核全等；⑦ §v1.2 引导横幅实现逐项符合性**目检亲审**七项全符合（层级序 drawHud→drawGuidance→scrim→panel 实证）。诚实口径：A3 结论面 ⏳ 待真人回填；正式提审素材止步清单维持；③c/③b 首跑瑕疵如实披露（zsh 词切分 / 口径过宽误报，均修正重跑且初版留档）。程序线 N8 登记中「美术线复证仍归游戏美术」之挂点由本条闭合。证据：`gate-logs/art-reverify-20261013/`。结论仅对 `c33a816` 有效。

**r9（同日 · HEAD `7c570ec` 重锚 · N9 驳回修复轮跨线认领）**：任务书再重发，勘验见 N9 两笔新提交（`a0929c2` 契约断言层 + `7c570ec` 证据收口）——**他线触及测试/契约层且断言直指美术交付件**（ac-16 文案三方同名逐字机判绑定本线 manifest copy 字段；ac-11 窄面披露涉本线机判件 ac-art-2），美术交付件本体零字节变更（vs r8 基线 `e99a4d2` 7 件逐字节零漂移复证）。当前 HEAD 重证全绿：verify.sh 五步 **VERIFY_EXIT=0**（ac-art-1..4 + ac-16 新断言绿）+ 三方色值 8 色全等 + 裸色值面 0 命中 + 文案三方同名独立复算 PASS。逐项认领：①② ac-16 加强（窗值 statement 单源 fail-closed / 文案面自人工目核升逐字机判）与本线 G-1 逐字单源同向，认领零保留；③ ac-art-2 窄面披露属实，**美术线立场登记**：裁决选项 A（statement 改「id ∈ entities∪assets 登记集」）更契合 manifest 类别学，选项 B（spec.assets 补登四件）致双登记增漂移面——两选项下 manifest 10 件均零字节变更，冻结面不动，裁决归主策划。自身瑕疵两项如实披露：00-git-status 取样自污染（修正留档）+ PALETTE_EXIT 隔管道取码（N9-④ 同型违例，即刻按新口径重取）。证据：`gate-logs/art-reverify-20261013-n9/`。结论仅对 `7c570ec` 有效。

**r10（2026-10-14 · HEAD `5921189` 重锚 · R1 打磨轮美术批亲审认领）**：任务书（打磨轮 R1）重发，勘验定性**复证而非重做**——R1 美术并行轨三件（风格卡 §R1 复核 / fx 特效批三件 / 引导+结算打包声明）已随 `f0fca52` 入库且系**主策划工作室代行节点**产出，按 cross-line-art-deliverable-review 逐项亲审美术口径而非默认正确。亲审结论：① **绑定面完备认领**——manifest v3 三件 fx feedbackChannels 并集 = 实现面 7 通道全集（击杀 4 `sim.ts:149` + 受击 3 `sim.ts:241`），ac-05 面4 机判绿，零映射缺口；② **fx 视觉规格 ↔ 实现逐要素符合认领**——flash 环 accentRed 2px r12→22 α 线性单峰 / 粒子 4×4 wheatGold / pickup 6×8 / HP 点 accentRed r5 / 计数 inkBrown（对比 ≥7:1）逐项对渲染码核真（`renderer.ts` drawEffects/drawHud）；③ **散文计数漂移一处、美术线直接更正**——§R1.2「3 件覆盖 6 视觉通道」与黑板头部「六通道全集」系代行笔误（正确 = 7），已就地更正并原文留档（ac-13 锚面安全预核：仅断言四要素标题+palette 声明，本更正不触）；④ **真实漂移一处升级（W-7）**——flash-invuln 通道无视觉实现（卡要素二/manifest spec 声称的无敌呼吸圈从未构建，`flashes.push` 全仓仅击杀点 `sim.ts:140`，渲染层零读 `invulnUntilTick`），spec A4 判据未破（受击仍有 knockback+HUD-HP 两可见通道 ≥2），属美术规格实现符合性缺口，按红线不改 src、登记 blockers 升主策划裁决（A=程序线补环随下次重部署 / B=更正卡+描述）；⑤ **操作路径「待美术映射」挂点收口**——OP-01 选中态 = e-captain 锚圈已承载（drawSquad r18 wheatDeep α0.5 ✓）、OP-04 = ui-kit-01 卡框+「点选 N」可供性已承载 ✓（独立高亮态缺，同型并入 W-7 A 案顺带；封顶 13 零余量不开新件）。当前 HEAD 重证全绿：verify.sh 五步 **VERIFY_EXIT=0**（ac-art-1..4 + ac-05 面4/面5 + SMOKE + 守卫双模式）+ 三方色值独立复跑 8 色全等 + 裸色值三面全零 + 美术件对 `f0fca52` 零字节漂移（本笔散文更正除外，源内）。诚实口径：00 git-status「1 项未提交」系自建证据目录（取样自污染，沿 r9 判例留档披露）；A3 结论面 ⏳ 待真人回填维持；正式提审素材止步清单维持。证据：`gate-logs/art-reverify-20261014-r1b/`（README + 00..05）。结论仅对 `5921189`+本笔更正 有效。

**r11（2026-10-15 · HEAD `fa43539` 重锚 · R1 复测收口轮任务书重发 · 复证收口）**：任务书（R1 复测收口 P0 + 线 3 备忘 v0 P1 双轨）重发，勘验定性**复证而非重做**——本轨交付（N3 资产三态清单 13 件 + 视觉基线对账声明 + W-7 B 案 manifest v4/风格卡 §R2.0 勘误）已随 `147f1bc` 入黑板，轮收口随 `4f424e5`，QA 唯一结论=证据型·样本不足（R1 维持未判定·挂起·不烧冻结余量）；本笔起因 = `fa43539`（程序线收口后复核）**扩 `ci/scope-policy.json` 白名单——本线门禁输入件**，按 reverify-gates-after-cross-line-changes 须当前树全量重证。复证结果：① 资产源面 `147f1bc..HEAD` git diff 空 + manifest.json 独立实算（`git show 147f1bc:` blob sha256 ≡ 磁盘 `000d8908…` 全等）零漂移；② 快速门禁 ac-art-1..4 EXIT=0 ×4；③ 三方色值机判 8 色逐值全等 EXIT=0（首跑误取 20261011 老版脚本内嵌旧工作区路径 → gate-failure-triage 定性失配非违例，v1 版重跑 PASS，复现留档 `02a`）；④ 裸色值两规则面 EXIT=0（代码面零裸 hex/`rgba(数字` · manifest 零 hex · SVG 28 处 ⊆ 白名单）；⑤ 6 关键件 sha256 基线落档；⑥ 目检：manifest v4 fx-hit-shock ↔ 风格卡 §R2.0 同源同口径，三态清单 13 id 与 manifest 同序全等；⑦ **verify.sh 全量五步 VERIFY_EXIT=0**（自有契约 16/0/1PEND——PEND=ac-a3 结论面 0/5 真人回填，与 QA 证据型裁决同向维持；SCOPE-GUARD 双模式 PASS 含扩围后 policy）。诚实口径：A3 结论面 ⏳ 维持；正式提审素材止步清单维持（W-6 归主人）；工作树唯一未跟踪 = 本轮证据目录（取样自污染沿判例披露）。轨道 B：0 图维持，`line3-memo-v0.md` §五挂起件凭证已随 `4f424e5` 在档，本轮零触碰。证据：`gate-logs/art-reverify-20261015/`（README + 00..05 + 02a + check-naked-color-v1.mjs）。结论仅对 `fa43539` 有效。

**r12（2026-10-16 · HEAD `c73dd31` 重锚 · 双轨收口轮任务书重发 · 复证收口）**：任务书（轨道 A 线 2「R1 复测三态分流收口」P0 + 轨道 B 线 3「新鲜调研+选型拍板」P1）再重发，勘验定性**复证而非重做**——双轨交付面已随 `0ff651f`（A7 整合）+ `15f51b3`（接手复核，程序线 verify-claims @ `0ff651f` 全部声称复核成立）收口，其后唯一增量 `c73dd31` = `.myrd-platform` 技能文档 + 黑板证据归档，`git diff 0ff651f..HEAD -- games/ src/ tests/ scripts/ server/ templates/ package.json` = **空**（游戏源/测试/契约/美术面零触碰，原文 `02` 号证据）。当前 HEAD 重证全绿：① 自有契约 16/0/1PEND EXIT=0（ac-art-1..4 绿 · PEND=ac-a3 结论面 0/5 真人回填维持）；② **verify.sh 全量五步 VERIFY_EXIT=0**（含 WS-SMOKE headless 全链路 PASS 打开→首次核心操作→单局结束→重开+零 console 错误 + SCOPE-GUARD 双模式 PASS）；③ 美术冻结面目检零漂移维持（manifest v4 13 件=W-7 B 案真实态化口径 · 风格卡 v1 8 色白名单主策划拍板件 · N3 三态清单逐行维持）。轨道 B 美术面亲核（本线交付物在档且被下游正确引用）：调研简报 §三 B3 美术成本档位五候选 ↔ memo v1 §一.④ 排除法引用一致（轻经营 18-25 件档位成为排除依据之一）· §⑤ 视觉基调带出处 D25 · 风格卡 v0 四要素 0 图止步 T+0 与拍板边界一致——零触碰零新产。诚实口径：A3 结论面 ⏳ 维持（主人圈定 5 名真人，机器不代采）；正式提审素材止步清单维持（W-6 归主人）；线 3 spec v1 draft 审签 + 视觉方向三问归主人（未 approve 前线 3 零实现动作）；本轮**零新素材零接线变更**，任务书「素材落盘/接线」要求以「冻结维持+零漂移复证」口径闭合（冻结件零触碰纪律 > 产出数量）；工作树唯一未跟踪 = 本轮证据目录（取样自污染沿 r9/r10 判例披露）。证据：`gate-logs/art-reverify-20261016-r1re2/`（README + 00·01 各带 exit 码 + 02 diff-scope）。结论仅对 `c73dd31` 有效。

**r13（2026-10-16 · HEAD `9681546` 重锚 · 程序线 QA 驳回修正轮跨线认领）**：任务书第三次重发，勘验见 r12 收口后两笔新提交（`b086c6f` auto-commit + `9681546` 程序线 F1/F2/F3 修正）→ 按 reverify-gates-after-cross-line-changes 在当前树全量重证。触达面亲核：25 文件增量全为黑板/证据/程序文档（recheck-report·triage-table）/证据工具（`tools/r1re-a2-chain-count.mjs`）/**spec README 索引**，**美术交付件+门禁契约输入面（assets/manifest v4 · src/ · ci/scope-policy · spec 导出件 · style-card-v1）空 diff 零触碰**（`02` 号证据）。跨线认领（cross-line-art-deliverable-review）：F1 证据工具 seed 装配修复=A2 证据面（判定值不变 P50=168.096s·链 20/20）非美术面；F2 loadSpecRow 绑定=契约 helpers 面；F3 spec README 补登两行亲核=「wheat-squad 单源件 + 顶层适配视图=非契约单源」与 r7 三入口 palette 亲核同构，纯索引记账认领零保留；分流表 v2 追加三件待 QA 复签归 QA 界面美术零涉。当前 HEAD 重证全绿：① 自有契约 16/0/1PEND EXIT=0；② **verify.sh 全量五步 VERIFY_EXIT=0**（SMOKE headless 全链路 PASS + 守卫双模式 PASS）。诚实口径：A3 结论面 ⏳ 维持（0/5 真人）；提审素材止步清单维持（W-6）；线 3 零实现维持；零新素材零接线变更。证据：`gate-logs/art-reverify-20261016-r1re3/`（README + 00·01 各带 exit 码 + 02 diff-scope）。结论仅对 `9681546` 有效。

## 既有登记（2026-10-11 复证轮 · 原文保留）

| 资产 | 状态 | 说明 |
|---|---|---|
| style-card-v0（参考卡三件套） | 🗄️ v1 起退役归档 | `.myrd/blackboard/wheat-squad/style-card-v0.md`（palette 8 色带色值 + 角色几何 + 氛围；对标反向差异化）——四要素经 N5 打回补齐后由 v1 冻结承接 |
| 渲染 token（theme.ts） | ✅ 与卡逐值一致 | `src/render/theme.ts` 8 色 = spec numeric.palette（零贴图，几何派生） |
| 位图资产 | 🚫 纪律性为零 | tex-1 契约机判零位图文件 + 零贴图构造（ac-07 PASS） |


| 资产 | 状态 | 说明 |
|---|---|---|
| style-card-v0（参考卡三件套） | ✅ N4 入黑板 | `.myrd/blackboard/wheat-squad/style-card-v0.md`（palette 8 色带色值 + 角色几何 + 氛围；对标《向僵尸开炮》/《超能下蛋鸭》色板取样反向差异化）= spec assets[0] 落点 |
| 渲染 token（theme.ts） | ✅ 与卡逐值一致 | `src/render/theme.ts` 8 色 = spec numeric.palette（零贴图，几何派生） |
| 位图资产 | 🚫 纪律性为零 | tex-1 契约机判零位图文件 + 零贴图构造（ac-07 PASS） |

## 复证轮登记（2026-10-11 · 游戏美术 · HEAD `d4eeea2`）

任务书重发按 redispatch-survey-first 勘验定性为**复证而非重做**（D 轮六节点同日已收口 + 程序线复跑轮成立）。当前 HEAD 重证三项全绿：① 契约 9/0 EXIT=0；② 色值三方机判全等（参考卡↔theme.ts↔spec 8 色，上轮手核本轮升机判）；③ 参考卡四要素逐项核对 PASS（调色板机判 / 光照 flash=accentRed·90ms 契约 / 线条描边 token 化 / 比例 390×640）。如实登记偏差一项：`game.ts` 5 处裸 hex（色值与卡全等=零风格漂移；单源链收口沿 N5 回执 :20 挂账排期 v0.2 机判门禁，本轮不扩范围）。台账与原文证据：`gate-logs/art-reverify-20261011/`（README + 01-contract.log + 02-palette-consistency.log + check 脚本）。g2-blocks 美术面（四要素归零 @`1fdd787` · 双档留证 · 材料清单 dy v3 提审就绪 · 真机档挂账维持）只读核对一致，零触碰。

## 程序线复证登记（2026-10-13 · spec v1.2 增量轮 · 游戏程序 · HEAD `304dacf`）

> N8 verify-claims 独立复核时对资产面的顺带核验（程序线口径，美术线复证仍归游戏美术）。

- **manifest v2 在盘**：`games/wheat-squad/assets/manifest.json` 10 件 ≤ 封顶 13——实体资产 5 + ui-kit-01 + **guidance-hint-banner（v1.2 轮新增引导横幅，文案单源 `GUIDANCE_TEXT`）** + 提审占位 3；ac-art-2 实测 id 对账全过（entity 类 id ∈ entities ids）。
- **美术机判三件随 verify.sh 复证全绿**：ac-art-1（12 文件色值 ⊆ palette 8 色白名单零违例）/ ac-art-2（清单对账）/ ac-art-3（尺寸 + build 首包 0.08MB ≤ 4MB）；ac-art-4 互查回执在档 PASS。
- **style-card-v1 §v1.2 回执 + tri-pack-v1.2 在黑板**（`.myrd/blackboard/wheat-squad/style-card-v1.md` · `tri-pack-v1.2.md`）；正式提审素材维持止步清单（待主人拍板）。
- 证据：`gate-logs/n8-reverify-20261013/01`（verify.sh 五步全量实跑）。结论仅对 `304dacf` 有效。

## 部署轮复证登记（2026-10-15 · deploy 节点 · 游戏程序 · 发布 commit `0031d31`）

> R1 收口后部署轮：**资产源面零变更零触碰**——自 v17 发布 commit `bcaa8f5` 起 manifest 相关变更仅有美术批 `assets/manifest.json` v4（147f1bc 已随批收口入账），本部署轮零新增零改写。

- **部署物构成机判**：build/ 面 = index.html + landing.html + main.mjs（spec 内联）+ spec.json + src 镜像 7 件，零位图零贴图（tex-1 PASS）；首包 0.08MB ≤ 4MB（ac-art-3 PASS，随 verify.sh 五步复跑）。
- **美术四检随门禁复跑全绿**：ac-art-1/2/3 auto PASS · ac-art-4 机制面在档（`gate-logs/deploy-v18-20261015/01`）。
- **LIVE 字节对账**：线上 main.mjs md5 `ae62534dd4cbb7626f8175906882915b` ≡ 发布 build 逐字节（manifest v4 元文档不进运行时字节，线上即 v4 登记态对应的渲染实现）。
- 证据：`gate-logs/deploy-v18-20261015/01、05`。结论仅对 `0031d31` 有效。
