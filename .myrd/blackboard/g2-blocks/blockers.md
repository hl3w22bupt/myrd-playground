# 阻塞项黑板 — g2-blocks（**V1.2「核心手感 6 项 + daily-challenge」轮 · 收口提审**）

> 更新时间：2026-10-04（N1–N5 全链走完 · N4 APPROVE-READY · 主策划）
> 负责人：主策划（整合人）· 每次整合后更新；阻塞超一轮未解 → 升级主人，不空转
> 下一步：**等主人拍板**（链 v4 approve + 实现人工验收 + A-10 取向确认）；PWA 发布归 workflow deploy 节点；渠道提审归主人

## 当前基线（V1.2 核心手感轮收口 · 2026-10-04）

- **黑板路径**：`.myrd/blackboard/g2-blocks/`（levels.md / assets.md / blockers.md + gate-logs/）
- **spec 版本号**：
  - **契约共同输入 = v1.1 approved 导出件** `.myrd/spec/g2-blocks/design-spec.json`（平台 id `cmuqa2mu50023m9zr8mh60uph` · 链 v2 · 锚 `302e63367f3dea63…`；**实查披露**：链上因 v3 draft 建版动作，v2 行 status 已翻 superseded——approved 快照以导出件 `_platform` 为准，契约输入本轮不换）
  - **链头 = v3 draft** `cmurqo70l001uiccx7hjjr37e`（combo 倍率 / level-stars 派生式 / 第一分钟引导提案，**本轮顺延**，保留在链不覆盖）
  - **本轮新建 = 链 v4 draft**（V1.2 核心手感校准版）：numeric 增 `feel`+`daily` 两组、acceptance 增 7 条（ac-22..28）、v3 提案中 daily 段并入、combo 倍率/level-stars/第一分钟引导顺延零实体零验收
- **开工前置两项快照（已冻结，N2 开工前置）**：
  - ① v1.1 P95 基线报告快照 → `gate-logs/v12-feel-n1-20261004/01-p95-baseline-snapshot.json`（源仓 `docs/evidence/perf-p95-report.json` @ `fe5fd38`：基准跑 P95=16.7ms / fps=60 / 卡顿 0）
  - ② v1.1 契约清单快照 → `gate-logs/v12-feel-n1-20261004/02-v11-contract-snapshot.json`（18 条 id+check+statement 逐字 + 锚）
- **本轮基线自证（2026-10-04 实跑）**：契约 18/18 EXIT=0 · 八门禁 ①–⑧ 全 PASS（钉 `G2_REPO_ONE_ROOT=`本 run）
- **g2-blocks 仓库**：`/Users/leo/.myrd/workspaces/cmto0g28j0002m9sqnvjdy8o7/g2-blocks` @ `fe5fd38`（树有 2 处 benign 运行残留：`build/sw.js` 缓存版本号 + `tests/contract/.j1-evidence.json` J1 实测值，N2 首个提交一并归位）
- **一号仓库**：分支 `myrd/pixel-fives-m0-m1-cmtpb66pe000rm9e2ozdurf8d`（沿用 A 轮工作分支；线上发布 commit `852a13c` 不动）
- **落点偏差披露（沿用 A 轮已接受口径）**：任务书要求 spec 导出到 `.myrd/spec/design-spec.json`，该路径为 stack-tower 专属件（`routines.yaml` B4「一游戏一文件」）→ 本轮沿用 `.myrd/spec/g2-blocks/design-spec.json`
- **护栏**：① stack-tower 线上零接触（本轮零触碰其 spec/代码/黑板段）；② numeric 冻结零漂移，v1.1 既有 12 组 numeric 逐字节不动，契约+冒烟全绿为提交前置，numeric 与 P95 冲突 → 程序上报 → 主策划回 N1 version+1，禁止静默改 spec；③ 阻塞超一轮 → 升级主人

## 阻塞项（V1.2 核心手感轮 · 全部闭合 ✅）

| id | 内容 | 归属线 | 解除判据 | 状态 |
|---|---|---|---|---|
| C1 | 本轮 numeric（feel/daily 两组）未冻结 → 实现不得开工 | 策划+程序 | 链 v4 draft 入链 + 回读全等 + 守卫全绿 | ✅ POST `cmut5fkyf00cbic7qudea13g6` v4 draft · READBACK EQUAL · 九守卫全绿 · 锚 `1720df8e…`（gate-logs/v12-feel-n1-20261004/03·04） |
| C2 | 视觉打磨包未开产 | 美术 | 按 N1 冻结值产出 + 四要素校样 + open 差距=0 | ✅ F-01..F-07 全落（校样表 gate-logs/v12-feel-n3-20261004/README）· ART-RECHECK 12/12 · A-10/A-11 收口零 open |
| C3 | 五切片实现未开工 | 程序 | 每片先红后绿；合入前 T2 采样 P95 不退化 | ✅ 五片全落（红证据 6 件在档）· Mode A 18/18 + Mode B 25/25 · P95 持平（16.7→16.8ms 量化带宽内 · jank 双跑皆零） |

### 收口复跑基线（源仓 @ `eab0df0` 树净 · 2026-10-04，全部原文在档）

- 契约双态：**Mode A 18/18（approved v1.1）+ Mode B 25/25（链 v4 draft）** · 均 EXIT=0
- 八门禁：**①–⑧ 全 PASS**（`gate-logs/v12-feel-n4-20261004/03-gates-eight-final.log`）
- 冒烟：**SMOKE PASS** · 判据面 `git diff fe5fd38..HEAD -- tools/smoke.mjs` = 0 行（零变化）
- T2 采样：基准跑 **fps=60 · 卡顿 0 · P95=16.8ms**（基线快照① 16.7ms，Δ=0.1ms = rAF 帧时间量化带宽；jank 0↔0 → 不退化成立）
- N4 对抗复检：**15/15 · VERDICT: APPROVE-READY**（`gate-logs/v12-feel-n4-20261004/01`；复检器首跑自曝五缺陷全修，02 同档互证）
- 源仓提交链（本轮 9 commit）：`19bf249`(N1 入链)→`a19e132`(切片0)→`50efa9f`(切片1)→`684f42a`(切片2)→`ced4497`(切片3)→`6fc09c2`(切片4)→`cf57708`(切片5)→`6fec4a6`(N3 收口)→`b66aa0b`(N4)→`eab0df0`(N5 清单)

## 挂账（非本轮动作，防丢失）

| id | 内容 | 归属 | 触发/解除条件 |
|---|---|---|---|
| G-Q1 | daily 时钟倒拨语义（backdatePolicy）仍不在 numeric（A 轮升级条款 Q1 沿挂：反作弊口径 = 主人裁决项） | 主人 | approve 时或 v1.3 提案 |
| G-Q2 | 渠道分享链路业务参数（wx/dy 落地页等）不在 spec 冻结面（A 轮 Q2 沿挂；本轮分享卡仅版式轻更新） | 主人 | 渠道开辟决策时 |
| G-perf | 60fps / P95 / 重开真机层终判未做（headless 代理证据，本轮与 A 轮同口径；真机层口径 = 同机同条件多次中位数，落 release-readiness §G） | QA | 真机实测后回填 |
| G-cdp | smoke/screenshot 并入共享件 tools/cdp.mjs（A 轮沿挂） | 程序 | 下一轮 QA 在场时并 |
| G-approv | 链 v4 为 **draft**：approve 前 spec-data 契约输入维持 v1.1；「实现先于 approve」系本任务书显式授权（N5 打包提审 = 主人终裁位） | 主人 | approve 动作本身 |

## 升级条款（本轮回主人裁决）

| id | 问题 | 为什么不能机器定 |
|---|---|---|
| Q1 | 沿挂（见 G-Q1） | 设计决策 |
| Q2 | 沿挂（见 G-Q2） | 业务拍板 |
| Q3 | **链 v4 approve + 实现产物「好不好玩」人工验收** | approve 是人的动作（红线）；人工验收 rubric = 六项手感体验 + daily 入口，本地 `npx serve g2-blocks/build` |
| Q4 | A-10 残余留白取向（本轮拍板 = 下区功能化 + 节奏留白） | 布局审美取向，主人可另定 → 回 N1 spec 修订面 |

## 待触发节点（条件写死）

| 节点 | 触发条件 | 门禁 |
|---|---|---|
| 主人 approve | 主人回复（不接受沉默推断） | approve 落卷后才算落卷；approve 后可在平台对链 v4 调 approve 接口落 approved |
| workflow deploy 节点 | N5 包就绪（✅）且主人拍板发布 | PWA 发布仅发生于此节点；发布后复跑冒烟 LIVE 口径 |
| 渠道提审（wx/dy/Steam/Roblox） | 主人开辟决策 | 与团队无关的材料 = 渠道业务参数（G-Q2） |

## 红线核销（任务书原文 · 全程生效）

- ① stack-tower 线上零接触 → ✅ 本轮源仓 diff 零 stack-tower 路径（N4 R2.e 路径白名单机判）；ac-17 一号零接触 PASS；平台侧仅对 g2-blocks spec 走 revisions，stack-tower spec 零触碰
- ② numeric 冻结零漂移 + 契约冒烟全绿为提交前置 + 冲突上报回 N1 → ✅ 九守卫复跑（R2.e2）+ 每片提交前契约+冒烟双绿；「P95 不退化」在场约束成立（numeric 全取零分配/查表形态，未触发冲突上报路径）
- ③ 顺延项零实体零验收 → ✅ N4 R3.b/b2 双面机判（spec 无 combo 倍率/level-stars/第一分钟引导/daily.star；src 零命中）
- ④ 性能口径不进 spec acceptance → ✅ P95 口径在快照/报告/release-readiness，acceptance 零性能条款
- ⑤ 阻塞超一轮升级 → ✅ C1..C3 轮内闭合，未触发

## 提请主人拍板

1. **链 v4（V1.2 核心手感轮）approve** —— 策划案版本链 `cmut5fkyf00cbic7qudea13g6` draft 待裁；approve 即 approved 唯一。
2. **实现产物人工验收**（终裁「好不好玩」）：六项手感逐项体验清单见 release-readiness §F；本地 `npx serve g2-blocks/build` 或装配区只读入口。
3. **A-10 留白取向**（Q4）与沿挂 G-Q1/G-Q2 裁决。
4. PWA 发布 = workflow deploy 节点动作；渠道提审/开辟 = 主人动作。团队包已就绪（证据三件套：gate-logs + 快照 + 报告）。

# 以下为 A 轮存档（「发布收尾主线 + v1.2 写案并行」· 收口 · 2026-10-03）

> 更新时间：2026-10-03（N2–N6 全链核销 · 主策划）
> 负责人：主策划（整合人）· 每次整合后更新；阻塞超一轮未解 → 升级主人，不空转
> 下一步：**等主人拍板**（N1 approve 落卷 + v1.2 追认）；N7/N8/N9 条件触发（条件写死，见下）

## 当前基线（A 轮收口 · 2026-10-03）

- **黑板路径**：`.myrd/blackboard/g2-blocks/`（levels.md / assets.md / blockers.md + n6-adversarial-cases.md + gate-logs/ + apphost-app.md）
- **spec 版本号**：
  - **approved 基线 = v1.1（链 v2）唯一**，平台 id `cmuqa2mu50023m9zr8mh60uph`（契约测试与 QA 共同输入，本轮未换）
  - **v1.2 = 链 v3 · draft（新增，待主人 approve）**，平台 id `cmurqo70l001uiccx7hjjr37e`，parent=v1.1；
    走 `POST /revisions` version+1 入链，**零覆盖**（v1 superseded / v1.1 approved 均原样保留，实调核销）
- **numeric 冻结锚**：
  - v1.1（approved 基线）= `302e63367f3dea63212ad689a33703d83886d145862db0d724df98e97fea2d89`（开工 + 收口两次重算全等，零漂移）
  - v1.2（draft）= `00ca798c544cc8eec644d51b056cfb1139b8f7ca472033a2939c574d44acb33f`（post 回读独立重算一致）
- **导出件**：
  - approved：`.myrd/spec/g2-blocks/design-spec.json`（回读 = 链 v2 全等；**落点偏差披露见下**）
  - v1.2 draft：`.myrd/spec/g2-blocks/design-spec-v1.2-draft.json`（与 approved 基线分离，契约共同输入不换）
- **g2-blocks 仓库**：`/Users/leo/.myrd/workspaces/cmto0g28j0002m9sqnvjdy8o7/g2-blocks` @ `c425e1f`（树净）
  本轮提交链：`a6eef71`（冒烟器竞态修正）→ `49402b5`（A-09 代改 + 同批截图）→ `8410986`（装配区入口）
  → `d564b5c`（N3 三件）→ `4f7470d`（N4 素材包）→ `bb4c836`（N5 v1.2）→ `aa929e3`/`2a5d480`（程序线复检）
  → `c425e1f`（**美术线复核收口**：A-12/A-13/A-14 修复 + A-09 认领）
- **一号仓库**：分支 `myrd/pixel-fives-m0-m1-cmtpb66pe000rm9e2ozdurf8d`；线上发布 commit = `852a13c`（**部署轮 r2 · 2026-10-03**：A 轮收口后最新产物上 AppHost，坑 `cmuqelj2r0046m9zr4emgdgdg` v3 running · LIVE-SMOKE PASS，见 `apphost-app.md`）；历史 `8d40c39`（v2 部署面）+ `c389982`（落账）
- **收口复跑基线**：契约 18/18 EXIT=0 · 八门禁全 PASS · SMOKE PASS · v1.2 三 check 3/3 PASS
  ——**原文在档**（驳回修复 R4②）：`c425e1f` 态 = `gate-logs/c425e1f-closeout-recheck-20261003/`（**J1=172ms**，
  旧写 171.3ms 为跨 run 转抄无档，作废）；最终态 `fe5fd38` = `gate-logs/prog-r4-docfix-recheck-20261003/`
  （**J1=174.6ms** · P95=16.7ms · ASSEMBLY 同批 `be310288cff10563`）。J1 为墙钟实测，以归档原文为准。
- **落点偏差披露**：任务书要求 spec 导出到 `.myrd/spec/design-spec.json`，该路径为糖果线撞车冻结件
  （`routines.yaml` B4「一游戏一文件」，README 明令不可作契约依据）→ 沿用 `.myrd/spec/g2-blocks/design-spec.json`

## 阻塞项（A 轮登记 · 全部闭合 ✅）

| id | 内容 | 归属线 | 解除判据 | 状态 |
|---|---|---|---|---|
| B1 | g2-blocks 未注册进图注册表 | 程序 | 注册表含 g2-blocks 且可被图工具检索 | ✅ `list_repos` 返回 alias=g2-blocks（N2①） |
| B2 | 装配区只读入口缺失（QA/美术无同一把钥匙） | 程序 | 只读入口 + 同批截图索引，机判同批 | ✅ ASSEMBLY: PASS · 同批 `be310288cff10563`（N2②；10/3 复检重建导出后同批重拍） |
| B3 | 10/2 发布 commit 原始输出未归档 | 程序 | 原文落 gate-logs（含命令/钉值/退出码/J1） | ✅ `gate-logs/deploy-20261002/` 三件（N2③） |

### 程序线复检修复记录（2026-10-03 · 新 run 工作区实跑发现，判据零放宽）

#### R4（第二次驳回 · 4 处文档/证据链缺陷 · 机器面与玩法面零改动 · `4f67806` + `fe5fd38`）

| id | 缺陷 | 修法 | 证据 |
|---|---|---|---|
| R4① | `assembly-entry.md` 钥匙手抄 batchId 陈旧值 | 改为引用 `assembly-manifest.json` 字段，文档零手抄批次值 | `docs/assembly-entry.md` |
| R4② | 收口态复跑数字无原文归档（违「归档 = 复跑 stdout 原文」） | worktree 干净 `c425e1f` 实跑归档 + 最终态 `fe5fd38` 全量归档；J1 更正为有档值 | `gate-logs/c425e1f-closeout-recheck-20261003/` · `gate-logs/prog-r4-docfix-recheck-20261003/` |
| R4③ | `release-readiness.md` §C/§E 滞后 assets.md 收口态 | §C 同步（素材复核 PASS / A-09 已认领 / ART-RECHECK 12/12）+ §E.1/E.2 划账给证 | `docs/release-readiness.md` |
| R4④ | 双 manifest gitRef 异锚 → QA 必核第三条歧义（根因：必核项自带「gitRef 一致」） | 双生成器落 `sameBatchCriterion` 随件字段 + 必核项更正 + 双清单重出同锚 `4f67806`；同批判据唯 `buildSha256` | `docs/assembly-manifest.json` · `assets/release/shot-manifest.json` · `assembly-entry.md`「同批判据」表 |
| R4⑤（连带） | levels.md N6 计数 38 与实数不符 | 更正 **42 条**（6+6+7+8+7+8） | `levels.md` N6 行 · `n6-adversarial-cases.md` |

| id | 缺陷 | 修法 | 证据 |
|---|---|---|---|
| R2 | `scripts/contract-check.mjs --only <id>` 指向不在当前装载 spec 的 id 时**零断言仍报全绿**（违本脚本反审查约束②；裸跑 ac-19/20/21 必假绿） | 零断言显式 RED + EXIT=1 + 恢复路径提示（`G2_SPEC_PATH=<draft>`） | 裸跑 ac-19 实测 RED/EXIT=1；带钉 3/3 PASS |
| R3 | tracked `build/` 导出与 src 漂移（src 禁 API 字面量注释措辞改动后未重建，违「确定性导出」） | 重建 `build/` + 同批重拍 4 张实机帧 + P95 报告重出 | 重建 diff 仅 2 文件注释 + sw 版本号；ASSEMBLY 同批 `be310288cff10563`；SMOKE PASS J1=171.5ms |

## 挂账（非本轮动作，防丢失）

| id | 内容 | 归属 | 触发/解除条件 |
|---|---|---|---|
| G-A09 | ~~`typeScale` 代改待美术线认领~~ **✅ 10/3 美术线认领**：机判 4 条（三处数值逐字相等 / 基准=layout.h 源码命中 / 390×844 实测 30.4/13.5/36.3px / 门禁全绿不降）；复核同时立案并修复 A-12/A-13/A-14 三缺陷（素材 token 漂移 + 未冻结数值文案 + 内部元数据外泄，源仓 `c425e1f`），证据 `gate-logs/a4-art-recheck-20261003/`（ART-RECHECK 12/12） | 美术 | 已解除 |
| G-locator | ~~发现器 tie-break 不确定~~ **✅ 10/3 程序线修复**：`repo-one.mjs` tie-break 改「spec updatedAt → git HEAD 提交时刻最新（活跃工作区）」，字母序根源消除；env 双钉仍最优先（已归档证据按原钉值可复跑，证据链不作废）。复跑：不设 env 时 ac-17 detail `root=run-cmurp7sf…`（本 run）· 契约 18/18 · 门禁 ①–⑧ 全绿 | 程序 | 已解除（levels.md「程序线独立复检」R1） |
| G-A10 | 棋盘纵向定位（提示条隐没后下方留白 ≈25% 屏高） | 美术 | 下一轮 spec 修订 / 美术拍板 `computeLayout` 权重 |
| G-A11 | 炉冷终局实机帧缺失（需耗尽手数构造） | QA | round-2 用 `__G2_SET_LEVEL` + 长链路构造补帧 |
| G-cdp | `tools/smoke.mjs` / `screenshot.mjs` 未并入共享件 `tools/cdp.mjs` | 程序 | 两件被 QA 复检器钉档，本轮不代改；下一轮 QA 在场时并 |
| G-perf | 60fps / P95≤16.7ms 真机终判未做（本轮为 headless 代理证据） | QA | 真机实测后回填 `docs/release-readiness.md` |

## 升级条款（本轮回主人裁决，已超「待确认」级）

| id | 问题 | 为什么不能机器定 |
|---|---|---|
| Q1 | daily 时钟倒拨语义（`allowBackdate`）未在 numeric 声明 | 反作弊口径 = 设计决策；建议 v1.3 补 `daily.backdatePolicy=ignore` |
| Q2 | wx/dy 分享链路（标题/缩略图/落地页）不在 spec 冻结面 | 渠道发布参数属业务拍板；建议归发布就绪清单或 v1.3 补 `share` 段 |
| Q3 | v1.2 是否 approve（三提案 numeric + 第一分钟引导） | approve 是人的动作，机器不替人判断（红线） |

## 待触发节点（本轮不执行，条件写死）

| 节点 | 触发条件 | 门禁 |
|---|---|---|
| N1 approve 确认 | 主人回复（**不接受沉默推断**） | 回复落卷后才算落卷 |
| N7 round-2 复检 | N1 落卷 **且** N2 三件到齐（✅ 已到齐） | 门禁六条 + 美术四条逐条核，全绿才放行 |
| N8 v1.2 实现 | **三闸齐**：v1 基线 approve（✅ 已 approved）+ v1.2 数值冻结（✅ 链 v3 draft）+ 主人拍板（⏳） | 顺序 combo → level-stars → daily；实现后 21 条全 PASS 需 spec-data 重生成 |
| N9 发布 + 提审 | N7 绿 **且** N4 素材就位（✅ 9 件 + 4 截图） | 机器证据随包（gate-logs + release-assets.json + shot-manifest.json） |

## 红线核销（任务书原文 · 全程生效）

- ① v1.2 数值冻结前不写数值实现代码 → ✅ **机判**：`ac-19/20/21` 双态裁决，draft 态下 `src/`+`build/` 零 v1.2 键名（实测零命中）
- ② 契约测试禁止硬编码派生值，一律读 numeric → ✅ 三 check 全部读 `numeric.combo/daily/levelStars`，零手抄
- ③ stack-tower 线上零接触 → ✅ ac-17 白名单机判 PASS（root=本 run）；一号仓库 `games/` 禁区零触碰
- ④ 性能口径落发布就绪清单、不进 spec acceptance → ✅ `docs/release-readiness.md`；素材文案已撤未终判口径
- ⑤ B1/B2/B3 超一轮不解决 → 升级 → ✅ 本轮内全部闭合，未触发升级

## 提请主人拍板

1. **N1 approve 确认**（上一轮 approve-ready-r2 包：spec v1.1 追认 + 首个可玩构建人工验收 + 部署坑位）——
   「好不好玩」终裁归主人；本地试玩 `npx serve g2-blocks/build`，线上 `…/apps/g2-blocks-2/`。
2. **spec v1.2（链 v3 draft）approve**：三提案 numeric（combo 倍率 / daily 周期 / level-stars 派生式）+ 第四提案第一分钟引导。
   approve 后触发 N8（combo → level-stars → daily 顺序实现）。
3. **Q1 / Q2 裁决**（见升级条款）。

---

# 上一轮（R2「spec v1 → 首个可玩构建」轮 · 收口）存档

> 更新时间：2026-10-02（N1–N5 全链核销 · 主策划）；下一步：等主人拍板（approve-ready-r2 包）

## 当前基线（R2 轮收口 · 2026-10-02 · 部署轮追加）

- **部署轮追加（2026-10-02 · 程序线）**：首个可玩构建已上 AppHost——专属坑
  `cmuqelj2r0046m9zr4emgdgdg` / slug `g2-blocks-2` / liveUrl
  `https://leomac-studio.tail49399e.ts.net/apps/g2-blocks-2/` / gitRef
  `myrd/pixel-fives-m0-m1-cmtpb66pe000rm9e2ozdurf8d` @ `8d40c39`；
  导出产物 `games/g2-blocks/export/web/`（17 文件，= 源仓 `g2-blocks@0c3aa95` build/ 逐字节相等）；
  部署前门禁复跑全绿（contract-check 18/18 EXIT=0 · 七件套 EXIT=0 · 冒烟 PASS J1=183.8ms），
  线上真浏览器自测 **LIVE-SMOKE: PASS**。全文见 `apphost-app.md` + `gate-logs/deploy-20261002/`。
  numeric 锚零改动（`302e6336…`），spec 链零改动，一号工程面（games/stack-tower、games/game、根 apphost.toml）零触碰；
  源仓守卫策略 `ci/scope-policy.json` 白名单新增 `games/g2-blocks/`（部署面新路径，ac-17 自检复跑 PASS，commit `ac47c4f`）。

- **黑板路径**：`.myrd/blackboard/g2-blocks/`（levels.md / assets.md / blockers.md 三件套 + approve-ready-r2.md + gate-logs/）
- **spec 版本号**：**v1.1 = 链 v2 · approved（唯一）**，平台 id `cmuqa2mu50023m9zr8mh60uph`；v1 `cmuovwra0004gm97tinha15zq` superseded 未覆盖
  - 链上流转披露（N1 时点）：开工时 v1 为 draft（上轮收口态）→ 主策划按本轮任务书授权实调 approve → v1 approved → v1.1 经 `POST /revisions` version+1 入链（draft）→ 实调 approve → **v2 approved（唯一）**、v1 自动转 superseded。两步 approve 均已在提请包中显式披露供主人追认/否决。
- **numeric 冻结锚**：sha256(sortKeys) = `302e63367f3dea63212ad689a33703d83886d145862db0d724df98e97fea2d89`（v1 ≡ v1.1 逐字节全等，QA G1/c 机判）
- **导出件**：`.myrd/spec/g2-blocks/design-spec.json`（= 链上 v2 回读全等，QA G1/g 机判）
- **g2-blocks 仓库**：`/Users/leo/.myrd/workspaces/cmto0g28j0002m9sqnvjdy8o7/g2-blocks`
  R2 轮提交链：`19ed02c`（N1 v1.1）→ `e6ba6fb`（M0 红态）→ `4e510b6`（N2+N3）→ `743fb77`（N4 复检器）→ `4a9cadb`（N4 收口）→ `c07ac4e` + `8249249`（复证轮）→ `a8a0c90`（R3 F1+F2）→ `b819be1`（R3 F3+F4+加固）→ `46a85b0`（R3 N4 复检归档，HEAD 树净）
- **复证轮实录（2026-10-02 · 程序线）**：契约 18/18 EXIT=0 + 冒烟 SMOKE: PASS（J1=179.1ms）+ QA round-3 重跑 VERDICT: APPROVE-READY（24/24 gates · R1–R7 零打回）+ numeric 锚独立重算 ANCHOR MATCH——全部显式钉本 run（`G2_SPEC_PATH`/`G2_REPO_ONE_ROOT` = `run-cmuq9pz86001vm9zrmqyfm59c`），原文见 levels.md 复证轮实录与 `g2-blocks/docs/evidence/qa-round3-run.log`
- **一号仓库**：零接触（R3 修后守卫 self-check 对本 run `git status` 机判 PASS：tracked 工程面 diff 空，黑板更新走 `allowedNewPaths` 白名单路径，不触 `games/` 等禁区；ac-17/framework 定位已根治误锚，不设 env 自动锚本 run）

## 阻塞项（R2 轮 · 全部闭合 ✅）

| id | 内容 | 归属线 | 解除判据 | 状态 |
|---|---|---|---|---|
| B3 | spec v1.1 未入链 | 策划 | revisions version+1 入链 + numeric 零 diff + 六段零 diff | ✅ 闭合（QA G1/c–g） |
| B4 | 可玩构建未产出 | 程序 | contract-check 绿（18/18 EXIT=0）+ 冒烟绿（可开+可玩+SW+J1 达标）+ 原文落档 + 提交 | ✅ 闭合（QA G2/G3） |
| B5 | 资产三批未交付 | 美术 | 三批 kebab-case + 映射表 + assets.md 总表 | ✅ 闭合（QA G5/a–d） |
| B6 | QA round-3 未跑 | QA | 单一 verdict JSON | ✅ 闭合（VERDICT: APPROVE-READY，24/24 gates · R1–R7 零打回） |

## R3 驳回轮（QA round-1 打回 F1–F4 · 全部闭合 ✅ 2026-10-02）

| id | 内容 | 归属线 | 解除判据 | 状态 |
|---|---|---|---|---|
| B7 | F1+F2 炉冷双判退化单点 + trace 重排无效机判 + 披露与代码相反（拍板依据失真） | 程序 | sim.ts 判点一真实前移（重力落定后/补手前，含空洞盘）；trace 如实记录；ac-07/ac-08 改真实时点机判 | ✅ 闭合（`a8a0c90`；机判 filled=61/64 · QA G2/a 现场复跑绿） |
| B8 | F3 renderer 7 处 rgba 盲区（辉光值漂移 rgb(210,160,40)≠token #C89C19） | 程序 | 全部接线 theme 单源；美术规格补录 tint/innerStroke/topHighlight/coolScrim；ac-11 扫描扩展 rgba/rgb 形态（红验必咬） | ✅ 闭合（`b819be1`；ac-11 17 色溯源 PASS） |
| B9 | F4 level-2 玩家不可达 + parseGoals/goalEval/el-hint 零测试覆盖 | 程序 | level-2 三入口（键盘 1/`?level=`/`__G2_SET_LEVEL`）+ HUD spec 现读；levels.spec.mjs 入 run-all ⑦；smoke 补 level-2 面 | ✅ 闭合（`b819be1`；冒烟 level-2 入口可达可玩+切换回路） |
| B10 | 附带：ac-17/framework 一号仓库定位字母序误锚旧 run（上轮已披露坑） | 程序 | 共享定位件 repo-one.mjs（spec 导出件 updatedAt 最新优先），两处统一接入 | ✅ 闭合（`b819be1`；不设 env 自动锚本 run） |

- **R3 修后 N4 复检：VERDICT: APPROVE-READY（gates 24/24 · R1–R7 零打回 · J1=177.3ms）**，证据 `g2-blocks/docs/evidence/qa-round3-run.log`（commit `46a85b0`）。
- 挂账注记①（炉冷判点一含空洞盘）随 B7 修复**与代码一致**，原披露不再失真；缺口通道未动用（spec 零改动，numeric 锚 `302e6336…` 全程不变）。

### 挂账（非本轮动作，防丢失）

- **美术线 intent 更正案**：继续挂账顺延下一轮 spec 修订（本轮「仅动 acceptance 段 + numeric 零 diff」硬约束不可随版；6 步执行序见 assets.md）。
- ~~**美术线门禁 env 钉值登记建议**~~（✅ 2026-10-02 销账）：F4 修复轮 `tests/contract/repo-one.mjs`
  共享定位件根治（多候选取 spec 导出件 updatedAt 最新，ac-17 与 framework.spec 统一接入）；
  美术线复跑实证 ac-17 无钉值自动正锚本 run（`gate-logs/r3-art-ratify-20261002/03-contract-check.log` 原文）。
- **美术线跨线认领流程提醒**（2026-10-02 复核轮新增，非阻塞）：F3 修复对美术交付件（style-card/backdrop）
  的代改走 QA 打回通道合规且黑板有补录登记，但作者线（美术）事后认领当时缺位、本轮已补
  （见 assets.md「美术线认领」）；建议后续打回项显式 @ 作者线复核。
- **缺口通道 A 档口径注记（本轮实现判读，随包披露）**：
  ① 炉冷判点一（落定结算后）在补手前的盘面上执行（含消除空洞），spec「落定结算后+补手后各判一次」的字面实现（ac-07 机判双探针在档）；
  ② 初始盘面为 uniform_random 字面填充，不附加「开局无三连」约束（spec 未声明；若需约束走缺口通道 B/C）；
  ③ 连击加成按 `(chain − appliesFromChain + 1) × chainBonus` 单调递增（冻结四手向量只锚 chain≤2，外推一致）。
  三条均零新增数值、零 spec 改动；如主人裁定不同口径 → 下一轮 spec 修订闭合。

## 升级条款

- B3–B6 全部本轮闭合，未触发升级。主人侧待拍板见 approve-ready-r2 包。

## 红线（任务书原文，全程有效）

- numeric 零漂移 ✅（锚全等机判）；代码零裸 hex ✅（全仓 hex 逐一溯源 theme 单源，G4/d+ac-11）；不动 stack-tower 一号仓库 ✅（G6/a）；不开新品选型 ✅；不做 wx/dy/Steam/Roblox 移植 ✅（G6/c 无移植面 + ac-10 deferred 注记）；missions 不激活 ✅（G6/d）；scope_gate 挂起 ✅。

## 提请主人拍板

1. **spec v1.1（链 v2）approve 追认** + 链上 approve 动作披露的追认/否决。
2. **首个可玩构建人工验收**（「好不好玩」终裁归主人）：本地构建 `build/`，冒烟已机判可玩；人工试玩路径 = `npx serve g2-blocks/build`（或任意静态服务器）→ 浏览器打开 → 点选相邻两块交换。
3. ~~部署坑位（是否为 g2-blocks 建 apphost 坑并发布）~~：✅ **已建坑并发布（2026-10-02 部署轮）**——
   专属坑 `cmuqelj2r0046m9zr4emgdgdg`（slug `g2-blocks-2` · sourceId `g2-blocks` · projectId GameAppStore），
   liveUrl `https://leomac-studio.tail49399e.ts.net/apps/g2-blocks-2/`（玩法入口 `/gw`），
   gitRef `myrd/pixel-fives-m0-m1-cmtpb66pe000rm9e2ozdurf8d` @ `8d40c39`；线上真浏览器自测 LIVE-SMOKE: PASS。
   登记全文见 `apphost-app.md`，证据 `gate-logs/deploy-20261002/`。**人工「好不好玩」终裁仍归主人。**

---

# 上一轮（N1 修复轮 · 2026-10-01）台账存档

## 当前基线（N1 修复轮 · 2026-10-01 收口态）

- **黑板路径**：`.myrd/blackboard/g2-blocks/`（levels.md / assets.md / blockers.md / approve-ready-n1.md
  / evidence-one-line-template.md + gate-logs/{n1-palette-20261001, n1-round2-20261001}）
- **spec 版本号**：**v1 · draft（当时待主人 approve）**，平台 id `cmuovwra0004gm97tinha15zq`
- **导出件**：`.myrd/spec/g2-blocks/design-spec.json`（wrapped 形状，回读与链上 sortKeys 全等）
- **numeric 冻结锚**：sha256(sortKeys) = `302e63367f3dea63212ad689a33703d83886d145862db0d724df98e97fea2d89`
- **g2-blocks 新仓库**：`/Users/leo/.myrd/workspaces/cmto0g28j0002m9sqnvjdy8o7/g2-blocks`（独立 git 仓库）
- **一号仓库**：开工至收口 `git status --porcelain` 仅 3 行且全部白名单内

## N1 轮 B1/B2（✅ 已闭合，存档）

| id | 内容 | 解除判据 | 状态 |
|---|---|---|---|
| **B1** | 色板未定稿：余烬金占位 hex `#FFC94A` 非真值；暖区缺第 6/7 色 | 7 色齐 + 21 对双门禁全绿 + 证据四要素落档 + assets.md 定稿 | ✅ 解除（`#C89C19` + `#4B2B25`/`#E3B5BF`；ALL-GREEN minΔE 26.555 / 阈值 25） |
| **B2** | spec 未入链：五处修法 + 色板未落成 version 1 | v1 经接口入链（一次成链）+ round-2 无新红 + approve-ready 提请主人 | ✅ 解除（v1 `cmuovwra0004gm97tinha15zq`；round-2 27 断言无红） |

## N1 轮遗留移交（存档）

- 【移交一号线·非本轮产物】stack-tower 聚合门禁存量低频 flaky（2 项）：`m21-acc-m3-rotate-pause`、`acc-j1`——本线不代修（红线：不改一号任何文件），已留痕移交。
