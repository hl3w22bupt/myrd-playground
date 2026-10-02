# 资产清单黑板 — g2-blocks（R2「spec v1 → 首个可玩构建」轮）

> 更新时间：2026-10-02（R3 驳回修复轮 · 美术线复核认领 F3 token 补录 + 复跑全绿落账）
> 负责人：游戏美术（资产面）/ 主策划（整合校对）
> 下一步：等主人拍板（approve-ready 包）；色板沿用 N1 定稿零改动

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
