# 资产清单黑板 — wheat-squad（二线孵化 · 可玩基线轮）

> 更新时间：2026-10-12（可玩基线轮 · N4 美术开产）· 负责人：游戏美术 · 主策划拍板：风格卡 v1 ✅ 开产授权
> 状态：AC-A1..A3 机判三件（ac-10..12）已随 N6 入契约（本轮复证 13/0 全绿）；AC-A4 人判互查已随 N7 执行（ac-art-4 PASS，回执在档）
> 下一步：正式提审素材止步清单待主人拍板产出正式件；A3 结论面（0/5 真人回填）待主人试玩

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
