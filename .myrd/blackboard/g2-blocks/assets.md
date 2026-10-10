# 资产清单黑板 — g2-blocks（**V1.3 首批「near-miss 反馈 + 结算页 IA」表现层资产**）

> 更新时间：2026-10-10（**对账收口轮：资产面零改动**——四件同包 merge 含 a08/a09/a10 存量资产原样入 main；部署面 30 文件 ≡ 源仓 `26ba1d9` 逐字节；第二线预置件（风格卡/反馈通道模板）在 `templates/next-line-scaffold/art/`，非本线资产）· 收口台账见 blockers.md 对账收口轮节
> 追记（同日 · 美术线）：**B2-② 预置件美术线 N3 亲审轮已行使**——风格卡模板 1 项缺陷修订（P-01 四要素对齐规范口径）+ 反馈通道规格模板只检 PASS；g2-blocks 源仓与部署面仍零触碰，见下节
> 上一轮：2026-10-09（N3 美术线对驳回修复轮亲审 + 复证 r2 · 三门禁全绿 27/27 @ `ded8e8f` · G-01..G-05 收口态维持 · rubric 留 approve 验收）
> 负责人：游戏美术（表现层资产面）/ 主策划（整合校对）
> 下一步：等主人 approve（approve 后美术面无在产项；观感/听感 rubric 随 approve 验收走）
> 红线：色值一律引用冻结色板 token 派生（生成器零裸 hex、零 rgba 字面量）；near-miss 视听参数一律取链 v8 `numeric.nearMiss` 冻结面（零手抄第二份）；零粒子、不震屏为 near-miss 硬约束

## 第二线预置件 · 美术线 N3 亲审轮（2026-10-10 · B2-② · 整合线初版 → 美术亲审修订）

> 口径 = `evidence-one-line-template.md`；性质 = **亲审而非重编**（B2-② 初版由整合线代执行，承 C 轮「N2 初版 → N3 美术亲审/覆写」判例行美术面认定）。
> 结论：**风格卡模板 1 项缺陷修订（P-01）+ 反馈通道规格模板只检 PASS · 改动后三门禁全绿（EXIT 0/0/0）· g2-blocks 源仓与部署面零触碰（sha 证据链 `26ba1d9` 不破）**。
> 证据原文 = `gate-logs/v13-preset-art-recheck-20261010/`（3 log + README）。

```
[PASS] | 线1 美术 | 01-gates-postchange.log | 2026-10-10 | node scripts/contract-check.mjs + bash games/game/verify.sh + node templates/next-line-scaffold/tools/smoke.mjs | RESULT: PASS（spec↔工程一致）· verify PASS（preflight+smoke）· SCAFFOLD-SMOKE PASS 4/4 · 三退出码 0/0/0 | 基线 HEAD 845d9ba（改动前树净）· 修订后复跑
[PASS] | 线1 美术 | （亲审 · P-01 修订） | 2026-10-10 | style-card-template.md 四要素「色板/字体/形状语言/动效」→「调色板/光照/线条/比例」 | 缺陷 = 缺光照/线条锚（规范口径机审判例：stack-tower C 轮 art-audit），新线照填即放行风格漂移；修订 = 对齐规范口径 + 字体/动效降扩展项 §5/§6 + 判例零删 + 门禁面补光照线条/比例安全区两条机判；README 一行同步 | templates/next-line-scaffold/
[PASS] | 线1 美术 | （只检 · 零改动） | 2026-10-10 | visual-feedback-channel-spec-template.md 五要素 + perception-note 通读 | trigger/form/duration/rate-limit/machine-check 齐备，判例承 ac-31/ac-32；「引用风格卡四要素 token」在 P-01 修订后引用面更完整（光照/线条 token 显式可引）——零改动 | templates/next-line-scaffold/
[PASS] | 线1 美术 | 03-consistency-scan.log | 2026-10-10 | 旧口径零残留扫描 + 新口径在场 + 反馈通道模板空 diff | 旧字面 1 处命中 = 修订注记自引（预期内）；反馈通道模板 DIFF=空 | templates/next-line-scaffold/
```

- **P-01 修订动机（美术纪律面）**：风格卡四要素是「派生而非重编」的锚面——缺**光照**锚则反馈光/氛围层无 token 可引（near-miss「不常亮」级硬条款无处落卡）；缺**线条**锚则描边/高光条 α 值退回隐性 rgba 字面量老路（R3-F3 判例正是此缺陷）。初版把「字体/动效」提为要素属口径漂移：字体属版式可选项、动效归反馈通道规格模板管辖（五要素已有 form/duration/rate-limit），不该占四要素席位。
- **填写时机不变**：简报落账 + 主人三轴选型后才复制填写（预置件纪律不因亲审改变）；本模板不构成新线风格锚定。
- **红线核销**：本轮改动面 = `templates/next-line-scaffold/art/style-card-template.md` + `README.md` 一行 + 本黑板登记 + 证据目录；g2-blocks 源仓零写入 · 部署面零触碰 · stack-tower 零接触 · spec/numeric/玩法数值零触碰。

## 顶部风格卡（沿用 A 轮定稿 · 本轮沿用零改版，详档见存档区「风格卡」节）

- **要素1 主色**：冻结色板 7 hex（`block-01..07`，真源 = spec `numeric.palette`）
- **要素2 形状语言**：方角圆角块 + 内描边（alpha 0.35）+ 顶部高光条（alpha 0.18）——near-miss 边行高亮与结算页槽位沿用同一形状语言派生
- **要素3 材质**：零贴图（textureSampling=none）；near-miss 硬约束 = 零粒子、不震屏、边行高亮不常亮
- **要素4 版式基色**：BACKDROP 三停靠渐变 + UI token 九键（bgDeep/bgPanel/textPrimary/textDim/accentWarm/dangerCool/hintBarBg/coolBannerBg/coolBannerText）；near-miss 冷色 = 既有冷 token 降饱和 ~30% 派生（派生式可机判，零新色）

## V1.3 表现层资产登记区（N3 · 美术线填报 · 编号 G-xx）

| 编号 | 资产 | 实机位置 | 数值/色源 | 校样证据 | 状态 |
|---|---|---|---|---|---|
| G-01 ✅ | near-miss 音效变体（第二档变体参数：下行尾音 + 时长减半） | near-miss 弱反馈展示同帧发起 | a08 pack（`nearMissSfxSpec` 派生 880→440Hz · 80ms · 承值全符）| ac-31 契约 H 节逐字段机判 + 人工听感 rubric | ✅ |
| G-02 ✅ | near-miss 边行高亮（冷色降饱和 ~30% · 不常亮） | near-miss 命中行/列的边行块 | `NEARMISS_UI.edge = #dcbcb5`（desat(coolBannerText,0.3) 派生可机判）| ac-32 契约派生式断言 + 截图 nm-hit 态 | ✅ |
| G-03 ✅ | 结算页 P0–P3 槽位视觉（结果层/归因层/行动层版式） | 结算面三层 IA | a09 pack（六槽三方单源 · 触达 ≥48px · 时序 400/240ms）| ac-32 契约 + smoke ⑦b 三区块断言 + 目检 | ✅ |
| G-04 ✅ | 分享卡模板（v1.3 轻更新） | 分享面 | a09 pack shareCard 节（版式沿用 · 零新色）| 与 wx/dy 提审包零 diff 断言并存（ac-33）| ✅ |
| G-05 ✅ | 6 张实机截图证据包（三态×两机型档，命名挂稳定 id） | 三态 = nm-hit / settle-nm / settle-nomoves；两机型档 = 390×844 + 430×932 | 同批 `buildSha256 = e3481537…`（**驳回修复轮重摄 @ `ded8e8f`**：settle-nm 两张与原批逐字节全等 · settle-nomoves 构造真值化「先手得分→record 路径」保『无可消除』留证 · nm-hit 披露脉冲相位抖动面；前批 `00417238…` 原档留 N5 目录）| shot-manifest 同批机判（含 stateMapping+determinismNote）+ 每态渲染断言 + ac-32 契约 C 节归因矩阵 | ✅ |

## V1.3 N3 美术线独立复证台账（2026-10-09 · 复证不新做 · 源仓 @ `2738599` 树净）

> 口径 = `evidence-one-line-template.md`；性质 = **复证而非重做**（G-01..G-05 资产面零触碰，只独立实跑门禁证明绿可重现，
> 并补齐黑板 v13 证据链的 N3 美术线独立目录——前轮 n1/n2/n4/n5 各有其录、n3 缺录）。
> 结论：**三门禁全绿 EXIT=0 · ART-RECHECK-V13 27/27 · 六张实机截图目检 PASS · 复证后 v13 树仍净（零 delta）**。
> 证据原文 = `gate-logs/v13-nearmiss-n3-reverify-20261009/`（3 log + 复证器 `03-art-recheck-v13.mjs` + README + 首跑误报留档）。

```
[PASS] | 线1 美术 | 01-check-v13-three-state.log | 2026-10-09 | cd $V13 && node scripts/check-v13.mjs | 三态 18 / 25 / 29+1PEND 计数全符 · EXIT=0（美术面 ac-31 H 节 / ac-32 派生式 / ac-33 零 diff 全在内） | g2-blocks-v13 工作树 @ 2738599
[PASS] | 线1 美术 | 02-gates-eight.log | 2026-10-09 | cd $V13 && G2_SPEC_PATH=<run-ws approved v1.1> npm run gate | 门①–⑧ 全 PASS 74/0 · 色板 ALL-GREEN 21 对 minΔE=26.555 margin=+1.555 selftest=18/18（≡冻结记录）· EXIT=0 | g2-blocks-v13 工作树 @ 2738599
[PASS] | 线1 美术 | 03-art-recheck-v13.log | 2026-10-09 | node 03-art-recheck-v13.mjs $V13 | ART-RECHECK-V13: PASS 27/27（a08 视听包 6 · a09 结算包 6 · 运行时单源现算 4 · a10 六截图 5 · 生成器纪律 3 · 渲染面硬约束 3）· EXIT=0 | 本证据目录（复证器落目录不进源仓）
[PASS] | 线1 美术 | （目检 · 六张实机截图） | 2026-10-09 | 美术眼检 assets/release/v13-shots/*.png ×6 | 三态语义正确 · 两机型档同构自适应 · 无构图缺陷 · 色值全在冻结族（暖=block-02 主按钮 · 冷=NEARMISS_UI.edge 派生） | g2-blocks-v13 工作树 @ 2738599
```

- **复证器关键断言（美术面钉死项）**：下行尾音 880→440Hz · 时长减半 160→80ms（第二档承值派生，`nearMissSfxSpec()` 单源现算非手抄）· edge=`#dcbcb5` 由 `theme.desaturate('#E3B5BF',0.3)` 现算 ≡ pack · 六槽稳定 id `result-slot-*` 全枚举 · 触达 ≥48px · 零粒子/不震屏/不常亮三声明 + 渲染面 `drawNearMiss` 函数体零 particles/shake 写入、驻留窗外零绘制 · 两生成器确定性重跑零漂移（树净维持）。
- **披露两处（非源仓缺陷，登记制）**：① 门2 首跑 `G2_SPEC_PATH` 误钉 worktree 内路径（ENOENT）③④⑤⑥ 假红，绝对路径重跑全绿；② 复证器首版自带 desaturate 近似公式误报 A08/f（C/a 已证 theme 单源 ≡ pack，派生关系无缺陷），修正为 import 单源现算——首跑原文留档 `04-first-run-correction.log`（零手抄第二份纪律自查样本）。
- **红线核销**：stack-tower 零接触 · spec/numeric 冻结面零写入 · 玩法逻辑与数值零改动（源仓复证前后 `git status --porcelain` = 0 行）；本轮产出仅黑板证据目录 + 本台账登记。

## V1.3 N3 美术线复证 r2（2026-10-09 · 对 QA 驳回修复轮 `ded8e8f` 亲审 + 复证 · 复证不新做）

> 口径 = `evidence-one-line-template.md`；背景 = 上轮 r1（对象 `2738599`）后发生 QA 驳回修复轮（程序线，spec 为 SSOT），
> 修复面中 **a10 六张截图重摄（新批 `e3481537…`）属美术交付物 G-05 连带变更** → 按「N2 初版 → N3 亲审」判例行美术面认定 + 三门禁对新 HEAD 复证。
> 结论：**新批六张亲审 PASS · 三门禁全绿 EXIT=0 · ART-RECHECK-V13 27/27（复证器 r1 同件拷贝，判据零改动）· 复证后 v13 树仍净**。
> 证据原文 = `gate-logs/v13-nearmiss-n3-reverify-20261009-r2/`（3 log + 复证器 + README）。

```
[PASS] | 线1 美术 | 01-check-v13-three-state.log | 2026-10-09 | cd $V13 && node scripts/check-v13.mjs | 三态 18 / 25 / 29+1PEND 全符 · EXIT=0（修补③ ac-32 C 节归因矩阵在内全绿） | g2-blocks-v13 工作树 @ ded8e8f
[PASS] | 线1 美术 | 02-gates-eight.log | 2026-10-09 | cd $V13 && G2_SPEC_PATH=<run-ws approved v1.1> npm run gate | 门①–⑧ 全 PASS 74/0 · 色板 ALL-GREEN 21 对 minΔE=26.555（≡冻结记录）· EXIT=0 | g2-blocks-v13 工作树 @ ded8e8f
[PASS] | 线1 美术 | 03-art-recheck-v13.log | 2026-10-09 | node 03-art-recheck-v13.mjs $V13 | ART-RECHECK-V13: PASS 27/27 · 新批 e3481537… 全符 · 生成器确定性重跑零漂移 · EXIT=0 | 本证据目录（判据零改动）
[PASS] | 线1 美术 | （亲审 · 涉变四张实机截图） | 2026-10-09 | 美术眼检 settle-nomoves ×2 + nm-hit ×2 | settle-nomoves 新构造真值化成立（160 分 record 路径通用归因行 · PB=0 edge 文案改由契约机判不再混淆）；nm-hit 构图读感与原批一致（抖动面=脉冲相位不损读感）；settle-nm ×2 逐字节全等免检 | g2-blocks-v13 工作树 @ ded8e8f
```

- **亲审认定**：程序线重摄的 a10 新批**美术面认可**（G-05 交付态维持 ✅，buildSha256 = `e3481537…` 以本批为准）；manifest 新增 `stateMapping`/`determinismNote` 两字段与美术留证口径自洽。
- **观察项（1 条 · 非阻塞）**：HUD 分数标签-数值间距随位数压缩（三位数「分数160」vs 一位数「分数 0」），两档一致、无 spec 条款约束；下轮打磨落点 = `renderer.ts` HUD 分数区 min-gap（呈现层单点，零数值面）。本轮不动（驳回修复面之外零触碰）。
- **红线核销**：源仓零写入（复证前后树净）· stack-tower 零接触 · spec/numeric/玩法数值零触碰；本轮产出仅黑板证据目录 + 本台账。

---

# 存档：V1.2「核心手感 6 项 + daily-challenge」轮 · 视觉打磨包（2026-10-04 收口）

> 更新时间：2026-10-04（N3 收口 · 七件全落 · ART-RECHECK 12/12 不降 · 美术线独立复验六项全绿零 delta）
> 负责人：游戏美术（打磨包面）/ 主策划（整合校对）
> 下一步：等主人 approve；观感/听感 rubric 人工校样随 approve 验收走（契约面只测时序+查表）
> 红线：色值一律引用冻结色板 token（生成器零裸 hex、零 rgba 字面量）；形变/粒子/震屏数值一律取链上 `numeric.feel`（零手抄第二份）

## 顶部风格卡（沿用 A 轮定稿，本轮零改动 · 详档见下方存档区「风格卡」节）

- **要素1 主色**：冻结色板 7 hex（`block-01..07`，真源 = spec `numeric.palette`；暖区第 6/7 色 #4B2B25 / #E3B5BF）
- **要素2 形状语言**：方角圆角块 + 内描边（alpha 0.35）+ 顶部高光条（alpha 0.18）——本轮新增「落地挤压形变」「三档粒子」须沿用同一形状语言派生
- **要素3 材质**：零贴图（textureSampling=none）· brightness-pulse 命中反馈 · inner-dark-overlay 阴影
- **要素4 版式基色**：BACKDROP 三停靠渐变 + heatGlow 连击热感 + vignette；UI token 九键（bgDeep/bgPanel/textPrimary/textDim/accentWarm/dangerCool/hintBarBg/coolBannerBg/coolBannerText）

## V1.2 视觉打磨包登记区（N3 · 美术线填报 · 编号 F-xx）

> 填报口径：每条编号 `F-xx`，四要素校样逐项留证（**实机位置 → 参考卡条款 → 数值来源 → 校样证据**）。
> 数值来源只认链上 `numeric.feel`（链 v4）；色值只认冻结 token。校样证据落 `gate-logs/v12-feel-n3-20261004/`。

| 编号 | 资产 | 实机位置 | 数值来源 | 校样证据 | 状态 |
|---|---|---|---|---|---|
| F-01 ✅ | 落地挤压形变帧表 | 重力落定的块（渲染层 squash 变换） | numeric.feel.landSquash | ac-22 + motion-pack.json | ✅ |
| F-02 ✅ | 硬降震屏参数曲线 | 消除后大落差（≥thresholdCells）镜头偏移 | numeric.feel.hardDrop | ac-23 + motion-pack.json | ✅ |
| F-03 ✅ | 三档独立粒子资产 + 合图集说明 | 消除命中点爆发粒子（**D1 后实际接线**：renderer.drawParticles 几何圆 · accentWarm token · 上屏冒烟断言 drawn=8/命中 8/8/复采 0） | numeric.feel.particles（色源不在 spec 冻结面 = 美术域） | ac-24 + particle-pack.json + FEEL-PROBE（数据面）+ smoke 上屏差分（视觉面机判）· **✅ 美术线已认领更正（2026-10-04）+ 连带收口色源描述件漂移（accentWarm 单色定稿，pack 已重出同源）· 详见 gate-logs/v12-feel-n3-20261004/README §F-03 认领注** | ✅ |
| F-04 ✅ | 三档音效资源表（三组独立 + 变参微调） | 消除/连击音（theme SFX 表经 a03 资产再生） | numeric.feel.sfx.tiers + assets/a03-sfx-plan.json | ac-25 + a03 三档资源 | ✅ |
| F-05 ✅ | 连击三档视觉态 | HUD 连击计数区 | numeric.feel.combo.tiers | ac-26 + ui-feel-pack.json | ✅ |
| F-06 ✅ | 重开按钮三态 + 转场帧 | 炉冷横幅 / 常驻重开入口 | numeric.feel.restart | ac-27 + ui-feel-pack.json + cool-frame | ✅ |
| F-07 ✅ | daily 入口与角标 + 分享卡轻更新 | HUD daily 入口 / share og+wx 卡轻刷新 | numeric.daily（dailyBadge 未单列，角标=UI 映射面） | ac-28 + daily-entry-pack.json + 分享卡重出 | ✅ |

> **提交前复跑（2026-10-04 · 程序线封箱自检）**：资产面**零新增、零改动**（F-01..F-07 与 a03/a04..a07 均维持 N3 收口态）；
> 仅随复跑刷新证据件（`docs/evidence/perf-p95-report.*` 基准 p95=16.7ms / `tests/contract/.j1-evidence.json` J1=174.9ms，
> 源仓 `01c2f06`）。原文 `gate-logs/v12-feel-n4-rerecheck-20261004/`。

## 美术线独立复验台账（V1.2 · 2026-10-04 美术线 · 复验不新做 · 源仓 @ `01c2f06` 树净）

> 口径 = `evidence-one-line-template.md`；性质 = **复证而非重做**（F-01..F-07 资产面零触碰，只独立实跑门禁证明绿可重现）。
> 结论：**六项全绿 EXIT=0 · ART-RECHECK 12/12 · 资产面零 delta 成立**。证据原文 = `gate-logs/v12-feel-n3-reverify-20261004/`。

```
[PASS] | 线1 美术 | 01-palette-gate.log | 2026-10-04 | cd $G2 && npm run gate:palette | ALL-GREEN 0红/21对 minΔE=26.555 阈值=25 margin=+1.555 selftest=18/18（≡冻结记录逐字一致） | g2-blocks 仓库根 @ 01c2f06
[PASS] | 线1 美术 | 02-contract-mode-a.log | 2026-10-04 | cd $G2 && node scripts/contract-check.mjs | 18 PASS / 0 FAIL · anchor=302e6336… · EXIT=0 | g2-blocks 仓库根 @ 01c2f06
[PASS] | 线1 美术 | 03-contract-mode-b.log | 2026-10-04 | cd $G2 && G2_SPEC_PATH=<draft> node scripts/contract-check.mjs | 25 PASS / 0 FAIL · anchor=1720df8e… · 美术面 ac-22..28（F-01..F-07 契约面）全 PASS | g2-blocks 仓库根 @ 01c2f06
[PASS] | 线1 美术 | 04-gates-eight.log | 2026-10-04 | cd $G2 && G2_REPO_ONE_PATH=<run-ws> node tests/run-all.mjs | 门①–⑧ 全 PASS · EXIT=0 · ③ theme 单源 7 键 ≡ 冻结色板 | g2-blocks 仓库根 @ 01c2f06
[PASS] | 线1 美术 | 06-art-recheck.log | 2026-10-04 | cd <证据目录> && node 05-art-recheck.mjs | ART-RECHECK: PASS 12/12（四门禁 + A-09 认领 + A-13/A-14 文案红线 · 生成器零裸 hex/零 rgba 字面量 · 9 件 IHDR+sha256 · maskable 越界 0） | 证据目录内（复跑器 = a4 档同件拷贝，判据零改动）
[PASS] | 线1 美术 | 07-asset-determinism.log | 2026-10-04 | cd $G2 && 四生成器重跑（gen-release-assets / gen-theme / gen-feel-pack / palette-design）&& git status --porcelain | 9 件资产 sha256/尺寸零变化 · palette sha256=7bc2ca03…（≡numeric.palette.sourceSha256 锚）· 残留仅 manifest gitRef+generatedAt 两行（良性，已复位树净） | g2-blocks 仓库根 @ 01c2f06
```

- **披露两处（非缺陷）**：① 门③ approved 导出件解析落前轮 run 工作区，与本 run spec `shasum` **逐字节全等**（`ad5d5534…`）→ 同内容命中非漂移（同「env 钉值登记」挂账族，程序线下轮处理）；
  ② `release-assets.json` 重跑残留仅 `gitRef`/`generatedAt` 两行（9 件资产条目零变化）→ 资产像素零改动成立，树已复位。
- **红线核销**：stack-tower 零接触 · spec/numeric 零写入 · 玩法代码零改动（源仓维持 `01c2f06` 树净）。

---

# 存档：A 轮「发布素材包 + 风格盘点」（2026-10-03 收口）

> 更新时间：2026-10-03（**美术线复核收口 + R4 后复证**：A-01..A-08 复核 + 3 缺陷修复重出 + A-09 认领（源仓 `c425e1f`）；R4 重拍帧后于 HEAD `fe5fd38` 复证 ART-RECHECK 12/12，只检不新做）
> 负责人：游戏美术（资产面 + 风格盘点）/ 主策划（整合校对 · 前轮代执行已复核认领）
> 下一步：A-10（棋盘纵向定位）/ A-11（炉冷终局帧）挂账维持；intent 更正案继续挂「approve 后首轮 spec 修订」；
> 色板沿用 N1 定稿零改动；**色值只取冻结色板（生成器零裸 hex、零 rgba 字面量），尺寸逐张 IHDR 机判，美术四门禁复核机判 PASS（12/12）**

## A 轮发布素材包登记区（N4 · 美术线填报）

> 填报口径：每条编号 `A-xx`，四列缺一不可 —— **实机位置 → 参考卡条款 → 差什么 → 改哪个文件**。
> 色值一律引用冻结色板 token（`block-01..07` / MATERIAL / BACKDROP），**禁止裸 hex**（ac-11 扫描会咬）。

| 编号 | 资产 | 规格（平台官方口径） | 色值来源 | 状态 |
|---|---|---|---|---|
| A-01 | PWA icon 512×512 | PNG 512 | theme PALETTE | ✅ `icons/icon-512.png` · **美术复核 PASS**（面心像素 ≡ 冻结色板 ±3） |
| A-02 | PWA icon maskable 512×512（安全区 80%） | PNG 512，purpose maskable | theme PALETTE | ✅ `icons/icon-maskable-512.png` · **美术复核 PASS**（像素机判越界 0，r≤210px） |
| A-03 | PWA icon 192×192 | PNG 192 | theme PALETTE | ✅ `icons/icon-192.png` · **美术复核 PASS** |
| A-04 | favicon 32/16 + apple-touch 180 | PNG | theme PALETTE | ✅ `favicon/{favicon-32,favicon-16,apple-touch-icon-180}.png` · **美术复核 PASS**（apple-touch 按 maskable 口径越界 0） |
| A-05 | OG 图 1200×630 | PNG 1200×630 | theme PALETTE + BACKDROP + UI | ✅ `share/og-1200x630.png` · **美术复核 PASS**（A-13 文案修正已随） |
| A-06 | wx 分享卡 5:4（500×400） | PNG | theme PALETTE | ✅ `share/wx-share-500x400.png` · **美术复核 PASS**（A-13 修正 + 版式无重叠目检） |
| A-07 | dy 分享卡 9:16（720×1280） | PNG | theme PALETTE | ✅ `share/dy-share-720x1280.png` · **美术复核 PASS**（A-13/A-14 修正已随） |
| A-08 | 实机截图 ×3（开局/消除连击/炉冷推进） | 真机 390×844 @2x | 实机帧 + 内核现读 | ✅ 4 张 `shots/` · **美术复核 PASS（零触碰）**（同批 `be310288cff10563` 门四机判继续有效） |

> **美术线复核（2026-10-03，G-A09 解除动作）**：主策划代执行版经独立复核发现 3 处美术面缺陷
> **A-12/A-13/A-14**（见下表），已修并重出 9 件（manifest sha256 随动；实机帧零触碰）。复核后源仓 = `c425e1f`。
> 机判证据 = `gate-logs/a4-art-recheck-20261003/`（ART-RECHECK 12/12 PASS）。

- **生成器**：`tools/gen-release-assets.mjs`（色值只读 theme 单源，**生成器零裸 hex**；尺寸逐张 IHDR 机判）
- **机判清单**：`assets/release/release-assets.json`（9 件 + sha256 + 用到的 palette token 清单）
- **ac-13 不降披露**：PNG 只落 `assets/release/`（ac-13 扫描范围 = `src/` + `build/` + 根 `index.html`，实测仍 PASS）；
  **PWA 内图标维持内联 data:URL SVG（零位图）**，PNG 包用于渠道提审随包，不接进 manifest。

## A 轮风格差距盘点（N4 · 编号 A-xx · 实机位置 → 参考卡条款 → 差什么 → 改哪个文件）

| 编号 | 实机位置 | 参考卡条款 | 差什么 | 改哪个文件 |
|---|---|---|---|---|
| **A-09** | level-1/level-2 HUD（分数/连击/手数区） | 要素4 版式/UI「分数/连击区置顶」+ 尺寸合规 | `typeScale` 以**整屏高**为基（scoreRatio 0.3 → 253px），390px 宽视口巨字溢出压棋盘，真机同型复现（同批截图实锤） | `assets/e-renderer-ui-tokens.json` `typeScale`（**已代改** 0.3/0.16/0.24 → 0.036/0.016/0.043 → `tools/gen-theme.mjs` 重生成 → `src/render/theme.ts`）· **✅ 美术线已认领（2026-10-03，机判 4 条，见 gate-logs/a4-art-recheck-20261003/README §三）** |
| A-10 | level-1 棋盘纵向定位（提示条隐没后） | 要素4「提示条底部」 | 棋盘垂直居中导致下方留白 ≈ 25% 屏高，版面下坠感（复核目检复证实测 ≈20%） | `src/render/renderer.ts` `computeLayout`（boardY/hintH 权重）· **挂账下一轮，美术拍板** |
| A-11 | 炉冷终局可视面 | spec 炉冷判定表现 | 素材四帧未含炉冷终局帧（需耗尽手数构造，非常驻路径） | `tools/screenshot.mjs`（加终局构造路径）· **挂账 QA round-2** |
| **A-12** | 发布素材 9 件全部块面（高光条/内描边） | 要素2「顶部高光条」+ R3 已认领的 material 显式化 token | 生成器硬编码 `rgba(255,255,255,0.16)`/带高 0.16/偏移 0.07；美术规格（style-card → theme MATERIAL/SHAPE，renderer 同源）= **α0.18/带高 0.18/内缩=内描边宽** → 素材与实机漂移 | `tools/gen-release-assets.mjs` block() 接线 theme 单源 + style-card↔theme 漂移守卫 · **✅ 已修重出（`c425e1f`）** |
| **A-13** | OG/wx/dy 卡 accent 文案 | 红线①同源（数值纪律） | 「连击 ×5 上限」= **v1.2 draft 未冻结数值**（approved v1.1 `numeric.combo` 无 maxMultiplier 键，机判留痕）→ 主人改值/否决则渠道素材即错 | 同上（改「连击加成 · 炉冷判定」）· **✅ 已修重出（`c425e1f`）** |
| **A-14** | dy 卡底部副文案 | 渠道素材对外口径 | 印「spec v2 · approved」内部流程元数据，玩家不可读且暴露内部状态 | 同上（改「离线可玩 · 零贴图渲染」）· **✅ 已修重出（`c425e1f`）** |

## 美术四门禁（A 轮口径 · 美术线复核机判 2026-10-03，`gate-logs/a4-art-recheck-20261003/01-art-recheck.log`）

- [x] 门一 色值溯源：生成器零裸 hex、**零 rgba/rgb 数字字面量**（复核加严），色值全取 theme 单源（PALETTE 7 + UI + BACKDROP + SHAPE/MATERIAL）；theme.PALETTE 7 键 ≡ spec 冻结色板机判 + icon 面心像素 4/4 命中 ±3；style-card↔theme 漂移守卫入生成器
- [x] 门二 尺寸合规：9 件逐张 IHDR 机判（512/192/180/32/16/1200×630/500×400/720×1280）+ 4 帧实机 780×1688，sha256 ≡ manifest 在档
- [x] 门三 maskable 安全区：`icon-maskable-512.png`（内容 51512px 越界 0，r≤210px）/ `apple-touch-icon-180.png`（越界 0）——**像素级机判**（前轮为目检，本轮升级）
- [x] 门四 同批可证：`shot-manifest.buildSha256 == assembly-manifest.buildSha256` = `be310288cff10563` 机判；实机帧本轮零触碰，证据链不作废

> **ART-RECHECK: PASS 12/12（EXIT=0）**——四门禁 + A-09 认领 + A-13/A-14 文案红线同门机判；
> 复核器 `01-art-recheck.mjs` 随证据目录在档可重跑（剥注释扫未冻结数值/内部元数据/色值字面量）。
> 仓库门禁复跑全绿不降：八门禁 PASS（骨架态口径）· 色板 ALL-GREEN 21 对 minΔE 26.555 · 契约 18/18。
> **R4 后复证（同日）**：R4 轮重拍 4 实机帧并重锚清单 → HEAD `fe5fd38` 复证 ART-RECHECK 12/12 + 契约 18/18 +
> 色板 ALL-GREEN + 八门禁全 PASS（`02-art-reverify-fe5fd38.log`）；素材 9 件 + 帧像素零改动，**只检不新做，收口态维持**。

---

# 上一轮（R2「spec v1 → 首个可玩构建」轮）存档

> 更新时间：2026-10-02（R3 驳回修复轮 · 美术线复核认领 F3 token 补录 + 复跑全绿落账）
> 负责人：游戏美术（资产面）/ 主策划（整合校对）；下一步：等主人拍板（approve-ready 包）；色板沿用 N1 定稿零改动

## R2 轮三批交付（N3 · 已全部落账，映射表 = g2-blocks/assets/MAPPING.md）

| 批 | 交付件（kebab-case） | spec 绑定 | 运行时单源接线 | 状态 |
|---|---|---|---|---|
| 批一 · 块 tile | `e-board-block-tiles.json` + `style-card.json`（随批） | entities.e-board；方块 id ↔ numeric.palette 七枚全等 | `tools/gen-theme.mjs` → `src/render/theme.ts`（PALETTE/SHAPE/TILES）→ renderer | ✅ 已交付已接线 |
| 批二 · UI/HUD | `e-renderer-ui-tokens.json` | entities.e-renderer | theme.ts（UI/HUD_TEXT/TYPE_SCALE）→ renderer + main | ✅ 已交付已接线 |
| 批三 · 背景/表现件 | `e-renderer-backdrop.json` + `a03-sfx-plan.json` | entities.e-renderer + assets.a03-sfx-pack | theme.ts（BACKDROP/MOTION/SFX）→ renderer + audio（WebAudio 合成，零音频文件） | ✅ 已交付已接线 |

- **总表口径**：id / 尺寸比例（style-card 比例值）/ hex（全部经 paletteToken 引用或 theme 生成件）/ 状态，逐件见仓库 `assets/MAPPING.md`（QA G5/a–d 机判双向一致通过）。
- **零改动件**：`assets/palette/palette-n1-final.json`（sha256 `7bc2ca03…` = numeric.palette.sourceSha256 锚，R2 零触碰）。
- **intent 更正案继续挂账**（本轮「仅动 acceptance 段 + numeric 零 diff」约束不可随版）；触发条件改为「下一轮 spec 修订」。
- 机器证据：`g2-blocks/docs/evidence/qa-round3-run.log`（G5 三批映射断言）+ `g2-blocks/assets/MAPPING.md`。


## 风格卡（四要素 · 其余三要素本轮不动，仅色板一要素进入本轮修订）

| # | 要素 | 定稿口径 | 本轮是否修订 |
|---|---|---|---|
| 1 | 色板（block-01..07） | 见下节（本轮唯一修订面） | ✅ 修订中 |
| 2 | 形状语言 | 方角圆角块（8px 圆角）+ 1px 内描边 + 顶部高光条，零外部贴图依赖（极简几何） | ❌ 不动 |
| 3 | 材质/光效 | 无贴图采样，纯色块 + 内阴影；命中反馈用亮度脉冲（不用粒子贴图） | ❌ 不动 |
| 4 | 版式/UI | 深底（#171A21 系）浅块，分数/连击区置顶，提示条底部 | ❌ 不动 |

> **OD 依赖披露**：open-design 守护进程 `127.0.0.1:7456` 在本工作区历史多轮不可达；本轮沿用既有处置裁定
> ——风格卡/色板产物一律落 repo 文件 + 哈希为真源，不依赖 OD 画布承载验收物；OD 恢复后同步参考卡（不构成新门禁）。

## 色板（线1 定稿区 · 本轮唯一修订面）— **✅ 定稿（2026-10-01）**

- 状态：**定稿**。美术交付件 = `g2-blocks/assets/palette/palette-n1-final.json`
  （sha256 `7bc2ca033ee8d7f7a20e63810b174e8cbdabcb92560a0db8dc72a10d553cd2ff`，确定性工具重跑逐字节一致）
- 门禁：门 A HSL 三选二（ΔH≥25°/ΔL≥0.10/ΔS≥0.08）+ 门 B ΔE(CIEDE2000)≥**25**（冻结 6 对校准 floor(min/5)*5）
  → **21 对 ALL-GREEN**（minΔE 26.555，margin +1.555）
- 证据：`.myrd/blackboard/g2-blocks/gate-logs/n1-palette-20261001/`（5 log + README，四要素齐）

| id | 名称 | hex | HSL | L* | 冻结态 |
|---|---|---|---|---|---|
| block-01 | 深海蓝 | `#21458C` | 220,0.62,0.34 | 30.6 | 已冻结（本轮登记） |
| block-02 | 余烬金 | `#C89C19` | 45,0.78,0.44 | 66.6 | **本轮终值（弃 #FFC94A）** |
| block-03 | 翡翠绿 | `#38B279` | 152,0.52,0.46 | 65.0 | 已冻结（本轮登记） |
| block-04 | 赤陶红 | `#DB6B43` | 16,0.68,0.56 | 58.0 | 已冻结（本轮登记） |
| block-05 | 紫水晶 | `#A472CA` | 274,0.45,0.62 | 56.3 | 已冻结（本轮登记） |
| block-06 | 深余烬褐 | `#4B2B25` | 10,0.34,0.22 | 21.4 | **本轮新增（暖区第 6 色·暗锚）** |
| block-07 | 绯玫瑰 | `#E3B5BF` | 346,0.46,0.80 | 78.0 | **本轮新增（暖区第 7 色·亮暖）** |

- 弃用值 `#FFC94A`（如实留痕）：数值门禁**不构成否决**（同门禁复跑不红）；否决依据 = 语义 + 量化三条
  （S=1.00 R 通道裁切 / L*83.7 全板最亮 / 柠檬观感），详见证据目录 `04-rejected-ffc94a.log`。
- **前轮记录缺口披露**：本工作区无前轮色值记录，冻结 4 色基线值由本轮一次性登记冻结（检索留痕见 blockers.md）。
- 移交：① 策划线并入 spec `numeric.palette`（含 gate 判据 + thresholdDeltaE=25）；② 程序线注意
  block-06 暗块必须接线 1px 内描边 + 顶部高光条（风格卡要素 2/3），不得省略。
- **R2 纠偏注记（2026-10-01 · 交付件 intent 与实测值）**：交付件 block-02 intent 内写「L\*≈64」，
  **实测 L\*=66.6**（本表上方色板表 / `05-lstar-table.log` / `04-rejected-ffc94a.log` 三处一致）。
  因 `tools/build-spec-v1.mjs` 强制校验 spec `sourceSha256` == 该文件哈希且链上 v1 已锚定
  `7bc2ca03…`，**不在本交付件上静默改注记**（会破坏链上锚）→ 已在呈批件披露项 §五.6 登记，
  待下轮 spec 修订由美术线随 `sourceSha256` 一并更正；色值 `#C89C19` 与门禁结论不受影响。
- **【美术线更正案 · 已备妥待触发（2026-10-01 美术线）】** 上项的执行面落定如下，触发条件 =
  **approve 后首轮 spec 修订**（或主人改稿轮顺带）；触发前本交付件与链上锚**零改动**。
  - **改动面（已实查，仅此两处）**：① 交付件 `block-02.intent` 一处子串
    `（L\*≈64，读作「烧过的金」）` → `（L\*66.6，读作「烧过的金」）`（其余字符零改动，改法 =
    改 `tools/palette-design.mjs` EMBER.intent 后重跑，**不手改 JSON**，保确定性单源）；
    ② spec 随动字段仅 `numeric.palette.sourceSha256`（已实查链上 palette 块不嵌 intent 文本，
    colors/gate/calibration/rejectedHex 均不变 → **色值、门禁判据、21 对结论零影响**）。
  - **触发后顺序（6 步，不可倒序）**：
    1. 改 `tools/palette-design.mjs` EMBER.intent 子串（≈64 → 66.6）；
    2. `node tools/palette-design.mjs` 重出交付件，记录新 sha256（`shasum -a 256 assets/palette/palette-n1-final.json`）；
    3. `npm run gate:palette` 复跑，必须仍 `ALL-GREEN 0红/21对 minΔE=26.555 阈值=25`（色值未动，结论若变即停手上报）；
    4. 策划线重跑 `npm run spec:build` → `numeric.palette.sourceSha256` 随动为新哈希；
    5. 修订件走主人既定通道入链（**非 draft 原位改**；平台 PUT/PATCH 405 已实测）；
    6. QA `node tools/qa-round2.mjs` R4/a–R4/d 复跑全绿 + 本文件 a02 行哈希同步 → 更正案销账。
- **R2 命名口径（执行面）**：运行时单源件统一按 **`theme.ts`**（= `assets.a01`、`entities.e-renderer.script`
  与 `tests/theme.spec.mjs` 断言）；链上 `ac-11` statement 的「theme.js」为措辞二义，已呈批件披露 §五.5
  交主人裁定，approve 前执行面不按其行事。

## 资产清单（登记制，spec assets 段派生 · 2026-10-01 与链上 v1 assets 段对齐；2026-10-02 复证轮状态刷新）

| id | 落点 | 来源 | 说明 |
|---|---|---|---|
| a01-block-palette | `g2-blocks/src/render/theme.ts`（真源=spec numeric.palette） | generated:constant-table（`tools/gen-theme.mjs`） | 7 色常量表，运行时单源；**已产出已接线**（ac-11 契约机判 7 键逐字等于冻结块 + 全仓 16 处 hex 溯源 theme 单源） |
| a02-palette-artifact | `g2-blocks/assets/palette/palette-n1-final.json` | g2-blocks/tools/palette-design.mjs | 美术交付件，sha256 `7bc2ca03…`（= numeric.palette.sourceSha256）；**已产出**（复证轮零触碰） |
| a03-sfx-pack | `g2-blocks/assets/audio/` → 执行面 = `src/audio.ts`（WebAudio 合成） | procedural | 消除/连击/炉冷/重开四类；**已产出**（零音频文件与 ac-13 零贴图同红线一致；ac-15 契约机判同帧发起 + 缺失零阻塞） |

- 复证轮补核（2026-10-02）：`node tools/qa-round3.mjs` G5/a–d 现场复跑全 PASS（映射表 6 件全在盘 · 块 tile id ↔ 色板七枚全等 · 三向绑定齐 · 黑板总表可达），证据 `g2-blocks/docs/evidence/qa-round3-run.log`（commit `8249249` 归档）。
- **R3 驳回修复轮 token 补录（2026-10-02 · F3 打回 · 交付件内容变更，映射关系零变化）**：
  - `assets/style-card.json` material 段新增 `tint`（墨 `#000000`/纸 `#FFFFFF` 版式基色）+ `innerStroke`（`#000000`@0.35）+ `topHighlight`（`#FFFFFF`@0.18）——renderer 原硬抄的 rgba 隐性值显式化入美术规格（QA F3：色值漂移+未接线打回）
  - `assets/e-renderer-backdrop.json` backdrop 段新增 `coolScrim`（`#000000`@0.55，炉冷遮罩）
  - 运行时面：`gen-theme.mjs` 增发 `MATERIAL` 组 + `withAlpha()` helper（唯一 rgba 入口）；`renderer.ts` 7 处 rgba 字面量清零，辉光漂移值 rgb(210,160,40) 修正为 token `#C89C19`；ac-11 扫描扩展 rgba(/rgb( 形态（红验必咬），全仓 17 色溯源单源
  - `palette-n1-final.json` 零触碰（sha256 `7bc2ca03…` 锚不变）；spec numeric 冻结块零触碰（锚 `302e6336…` 不变，QA G6/b PASS）
- **美术线认领（2026-10-02 · 线1 对 F3 补录的复核，正式生效）**：tint 墨/纸与风格卡要素 4 自洽、
  `topHighlight` alpha 0.18 与要素 2 `topHighlightRatio 0.18` 数值自洽、`innerStroke`/`coolScrim` 为隐性值
  显式化且零贴图红线不破、heatGlow 漂移值→`#C89C19` 修正方向正确——**五项全部认领为美术规格一部分**；
  跨线代改流程提醒（QA 打回修复通道内改动应显式 @ 作者线复核）已记录证据目录 README。
- **美术线复跑与新增自检（2026-10-02 · F3 补录后）**：palette 双门禁 ALL-GREEN（21 对 minΔE=26.555）+
  七门禁 7/7 + 契约 18/18（ac-17 经 `repo-one.mjs` 根治后**无钉值自动正锚本 run**，前轮 env 钉值挂账销账）；
  新增美术自检门 = **描述件↔theme 漂移检查**（五件描述件 hex=19/alpha=6 全接线 theme.ts · theme 零
  rgba/rgb 数值字面量 · spec 冻结 hex 7/7；改描述件不重跑 codegen 必红）。证据 =
  `gate-logs/r3-art-ratify-20261002/`（3 log + 漂移检查脚本/原文 + README 美术复核表）。

> **资产面本轮变动（线3 契约收口，2026-10-01）：无新增/无修改资产**。本轮只动测试与门禁面
> （`tests/kernel-purity.spec.mjs` / `tests/acceptance-map.spec.mjs` / run-all / CI），三件资产落点与
> 产出状态不变；AC-11 单源断言机已在 /tmp 合成树上实测会咬（证据
> `gate-logs/n1-prog-contract-20261001/README.md` §2），approve 后 codegen 生成 theme.ts 即被门禁覆盖。

## 美术线复验台账（R2 驳回修复后 · 2026-10-01 美术线独立复跑）

> 口径 = `evidence-one-line-template.md`；结论：**R2 修复未伤及资产面，交付件锚定关系完好，全绿**。

```
[PASS] | 线1 美术 | （复验·双门禁） | 2026-10-01 | npm run gate:palette | ALL-GREEN 0红/21对 minΔE=26.555 阈值=25 margin=+1.555 selftest=18/18 | g2-blocks 仓库根
[PASS] | 线1 美术 | （复验·确定性） | 2026-10-01 | node tools/palette-design.mjs && git status --porcelain | 零 diff，交付件 sha256=7bc2ca033ee8d7f7…（=链上 sourceSha256 锚） | g2-blocks 仓库根
[PASS] | 线1 美术 | （复验·六件门禁） | 2026-10-01 | npm run gate | ①②④⑤⑥ PASS + ③ PENDING-APPROVE（非装绿）；kernel-purity 8/8（含新增 ac-14/h 零硬编码自证） | g2-blocks 仓库根
[PENDING-APPROVE] | 线1 美术 | （挂账·intent 更正案） | 2026-10-01 | 见上「美术线更正案」6 步（触发前零改动） | 触发条件=approve 后首轮 spec 修订；随动字段仅 numeric.palette.sourceSha256；色值/门禁结论零影响 | 本文件色板节
```

## 美术线复证台账（R2 复证轮 · 2026-10-02 美术线独立复跑，锚本 run `run-cmuq9pz86001vm9zrmqyfm59c`）

> 口径 = `evidence-one-line-template.md`；性质 = **复证而非重做**（三批交付件 + MAPPING.md 零触碰）；
> 结论：**复证全绿，交付态与 QA round-3 verdict 锚（g2-blocks 仓库 `8249249`）一致**。证据原文 =
> `gate-logs/r2-art-reverify-20261002/`（3 log + README）。

```
[PASS] | 线1 美术 | 01-gate-palette.log | 2026-10-02 | cd $G2 && npm run gate:palette | ALL-GREEN 0红/21对 minΔE=26.555 阈值=25 margin=+1.555 selftest=18/18（≡冻结记录逐字一致） | g2-blocks 仓库根
[PASS] | 线1 美术 | 02-gate-six-pinned.log | 2026-10-02 | cd $G2 && G2_REPO_ONE_PATH=$RUN_WS npm run gate | 六门禁全绿：①②④⑤⑥ PASS；③ theme 单源 ac-11/a–c = PASS=3 RED=0 PENDING-APPROVE=0（theme.ts 已生成接线，骨架态转绿）；ac-17 一号零接触自检 PASS（钉本 run） | g2-blocks 仓库根
[PASS] | 线1 美术 | 03-mapping-g5-and-wiring.log | 2026-10-02 | cd <证据目录> && node 03-mapping-g5-and-wiring.mjs | ALL-GREEN 7/7：G5/a–d + 接线 theme.ts 含 7/7 冻结 hex + 交付件 sha256=7bc2ca03… ≡ spec sourceSha256 锚（链 v2 approved） | 证据目录内（脚本自定位 RUN_WS）
```

- **口径披露（非缺陷，登记制）**：门 ④ 不显式钉 `G2_REPO_ONE_PATH` 时，`tests/framework.spec.mjs`
  兄弟目录扫描会取到首个 `run-*`（本轮实测取到他线 `run-channel-cmulajp5g002km9lf73o99y95`，
  其白名单外改动致自检红）。按既定复证口径显式钉本 run 后 5/5 PASS；建议下轮 spec 修订时由程序线
  把 env 钉值写进门禁 README（挂账顺延，非本轮动作）。

> **美术线状态**：无阻塞性待办；在册挂账两项均顺延（intent 更正案 + 上项 env 钉值登记建议），
> 触发条件均为 approve 后首轮 spec 修订。approve 后美术侧首件 = `a01-block-palette` codegen
> 真源=spec numeric.palette（block-06 暗块 1px 内描边 + 顶部高光条接线要求随件）。
