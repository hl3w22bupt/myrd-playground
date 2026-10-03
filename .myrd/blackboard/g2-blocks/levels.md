# 关卡状态黑板 — g2-blocks（A 轮「发布收尾主线 + v1.2 写案并行」）

> 更新时间：2026-10-03（A 轮开工 · 主策划）
> 负责人：主策划（整合人）· 程序线维护实现状态列 · QA 线维护核销列
> 下一步：N2–N6 并行推进；N1/N7/N8/N9 条件触发（条件写死，见 blockers.md 待触发区）
> 红线：**v1.2 数值冻结前不写数值实现代码**（N8 三闸齐才派）；性能口径不进 spec acceptance

## A 轮节点链台账（N2–N6）

| 节点 | 线 | 交付与落点 | 验收信号 | 状态 |
|---|---|---|---|---|
| N2① 图注册表 | 程序 | code-review-graph 注册表新增 g2-blocks | 注册表条目可检索 | 🔄 |
| N2② 装配区只读入口 | 程序 | 只读入口文档 + 同批截图索引（QA/美术一把钥匙两用） | QA 确认可用 | 🔄 |
| N2③ B3 归档 | 程序 | 10/2 发布 commit 的 contract-check + 冒烟原始输出 → gate-logs | 原文含命令/退出码/J1 | 🔄 |
| N3-T1 | 程序 | storage/audio 门面 + 版本化迁移 | 既有契约+冒烟全绿不降 | 🔄 |
| N3-T2 | 程序 | 帧率/帧时间埋点 + P95 报告 | P95 ≤ 16.7ms 口径落发布就绪清单 | 🔄 |
| N3-T3 | 程序 | 确定性 PRNG + 可注入时钟 + 时区工具（零外部依赖） | 同 seed 同输出；时区纯函数 | 🔄 |
| N4 发布素材包 | 美术 | PWA 图标（含 maskable）/favicon/OG + wx/dy 分享卡 + ≥3 实机截图 | 色值只取冻结色板；尺寸对官方规格；美术四门禁全过 | 🔄 |
| N4 风格盘点 | 美术 | 差距清单 A-xx → assets.md | 四列齐（位置/条款/差距/文件） | 🔄 |
| N5 spec v1.2 | 策划 | 三提案 numeric（combo/daily/level-stars）+ 第四提案（首分钟引导）走 version+1 | 三 check 路径写死；零新增漂移；QA+主策划评审通过 | 🔄 |
| N6 对抗用例预研 | QA | 六维用例设计文档 → 黑板 | 逐条可执行，不依赖装配区 | 🔄 |

## v1.2 数值提案（策划线 · 冻结前仅供参考，冻结以链上 numeric 为准）

| 提案 | 数值 | 备注 |
|---|---|---|
| combo | max_multiplier=5 / step=20% / **rounding=floor** | 取整方向必须显式写进 numeric（契约测试读 numeric，不硬编码） |
| daily | star=1 / streak_track=30 / 种子=YYYYMMDD **本地时区** | 种子纯函数可测（N3-T3 时区工具支撑） |
| level-stars | [B, 1.5B, 2.2B] 派生式 | 派生式，禁在契约里硬编码三颗星的具体分数 |
| 第四提案 | 首分钟引导核查 | 核查 v1/v1.1 是否已含；无则补写（含可复现操作路径） |

## 待触发节点（条件写死）

| 节点 | 触发条件 |
|---|---|
| N1 approve 确认 | 主人回复落卷（不接受沉默推断） |
| N7 round-2 复检 | N1 落卷 + N2 三件到齐 → 门禁六条 + 美术四条逐条核 |
| N8 v1.2 实现 | v1 基线 approve + v1.2 数值冻结 + 主人拍板，**三闸齐** → 当轮即派，顺序 combo → level-stars → daily |
| N9 发布 + 提审 | N7 绿 + N4 素材就位，机器证据随包 |

---

# 上一轮（R2「spec v1 → 首个可玩构建」轮）存档

> 更新时间：2026-10-02（R3 驳回修复轮：QA round-1 打回 F1–F4 全部闭合，N4 复检 APPROVE-READY）
> 负责人：主策划（整合人）· 程序线维护实现状态列 · QA 线维护核销列
> 下一步：等主人拍板（approve-ready 包：spec v1.1 approve 追认 + 构建人工验收）

## R3 驳回修复轮实录（2026-10-02 · QA round-1 打回 F1–F4 → 修复 → 复检）

| 打回 | 修法（可核对） | 修复后证据 |
|---|---|---|
| F1 双判退化单点 | `sim.ts` 判点一「落定结算后」真实前移至**重力落定后/补手前**（盘面含消除空洞），判点二维持补手后；`SwapResult.probes[]` 记录 phase/boardHash/filled/idx | ac-07 机判：判点一 `filled=61/64`（含 3 格空洞）· boardHash ≠ 判点二 · 序号 0/1（`a8a0c90`） |
| F1 披露失真 | blockers.md 旧挂账注记①所述语义（判点一在补手前含空洞盘）现已按代码落地 → 披露与实现一致，无需缺口通道改 spec | 本行 + blockers.md B7 闭合记录 |
| F2 trace 重排无效机判 | 删除 `CANONICAL` 重排与 `record` 去重；trace = 真实执行序（尾部 `match` = 级联稳态确认，如实记录） | ac-08 机判真实流水 `swap→match→score→gravity→deadlock-check→refill→match→deadlock-check` + probes 交叉验证（`a8a0c90`） |
| F3 rgba 盲区 | renderer 7 处 rgba 全接线 theme 单源（辉光弃漂移值 rgb(210,160,40) 改 `heatGlow.hex`=#C89C19；vignette 接线既有 token；描边/高光/遮罩/透明端点走 MATERIAL/BACKDROP+withAlpha）；美术规格补录 tint/innerStroke/topHighlight/coolScrim；ac-11 扫描扩展 rgba(/rgb( 三元组 | ac-11 全仓 17 色溯源 PASS；红验实测 rgba(1,2,3) 必红（`b819be1`） |
| F4 level-2 不可达 | `?level=` URL + 键盘 1/2 + `__G2_SET_LEVEL` 三入口；HUD 显示 spec 关卡名+goal 现读；`tests/levels.spec.mjs`（run-all ⑦）补 parseGoals/goalEval/el-hint 覆盖；smoke ⑦b 补 level-2 面；顺带修 `game.ts` hintElement undefined≠null 误判 | smoke：`level-2 入口可达 ✓（HUD「升温局 · 20 手内打出 3 连击」= spec 现读）`+ 可玩 + 切换回路 ✓（`b819be1`） |
| 附带加固 | `tests/contract/repo-one.mjs` 共享定位件（多候选取 spec 导出件 updatedAt 最新）根治 ac-17/framework 字母序误锚旧 run（N4 已披露坑） | ac-17 自动发现即锚本 run：`root=run-cmuq9pz86001vm9zrmqyfm59c`（不设 env 同样正确） |

## R3 修后门禁原文摘要（g2-blocks @ `46a85b0`，树净）

- 契约：`node scripts/contract-check.mjs` → **18 PASS / 0 FAIL · EXIT=0**
- 工程门禁：`npm run gate` → **七件全 PASS**（①守卫 ②色板 21 对 ③theme ④零冻结值面 ⑤内核确定性 ⑥check 落点 ⑦关卡面）
- 冒烟：**SMOKE: PASS**——可开+可玩（level-1 双手 0→160→240）+ **level-2 入口可达可玩** + SW 激活 + manifest + **控制台零错误**
- J1：**177.3ms ≤ 400ms**（QA 复检器现场复跑 G3/b；冒烟直跑 177.7ms）
- QA N4 复检：**VERDICT: APPROVE-READY · gates 24/24 · R1–R7 零打回**（G1–G6 含反审查污染探针），证据 `g2-blocks/docs/evidence/qa-round3-run.log`（commit `46a85b0`）

## 关卡面（spec v1.1 = 链 v2 approved；levels 段与 v1 零 diff）

| 关卡 | 目标 | 元素 | 实现状态（R3 修后） |
|---|---|---|---|
| level-1 | 教学局：3 步内完成首次三消 + 提示教学 | `el-board` / `el-spawn` / `el-hint` / `el-deadlock` | ✅ 可玩（el-hint 行为有测试：首消或 3 手后隐没，`tests/levels.spec.mjs`） |
| level-2 | 升温局：20 手内 ≥3 连击并存活到炉冷 | `el-board` / `el-combo` / `el-deadlock` | ✅ 可玩且**玩家可达**（键盘 1 / `?level=level-2` / `__G2_SET_LEVEL`；冒烟双关全通；goal 文案 spec 现读） |
| level-3+ | content.levelCount=2 预算外 | — | ⏸ 不做（spec 红线：零新增） |

## 关卡面（spec v1.1 = 链 v2 approved；levels 段与 v1 零 diff）

| 关卡 | 目标 | 元素 | 实现状态（R2 轮） |
|---|---|---|---|
| level-1 | 教学局：3 步内完成首次三消 + 提示教学 | `el-board` / `el-spawn` / `el-hint` / `el-deadlock` | ✅ 可玩（目标文本 spec 直读，提示条首消/N 手后隐没） |
| level-2 | 升温局：20 手内 ≥3 连击并存活到炉冷 | `el-board` / `el-combo` / `el-deadlock` | ✅ 已实现（createGame({levelId:'level-2'}) 可入；本轮冒烟主走 level-1，level-2 共享同核无独立门禁面） |
| level-3+ | content.levelCount=2 预算外 | — | ⏸ 本轮不做（spec 红线：零新增） |

## R2 轮节点链台账（N1–N5 全核销）

| 节点 | 线 | 产物 | 验收信号 | 状态 |
|---|---|---|---|---|
| N1 基线确认 | 主策划+策划 | 基线记录（blockers.md 当前基线区：v1 approved + 锚 + approve 动作披露） | 版本号/哈希/批复状态三全 | ✅ |
| N1 spec v1.1 | 策划 | `tools/build-spec-v11.mjs`（八道守卫）+ `tools/post-spec-v11.mjs` → 链 v2 `cmuqa2mu50023m9zr8mh60uph` | numeric 零 diff + 回读全等 + 唯一 approved | ✅ |
| N2 M0 契约先行 | 程序 | `tests/contract/` 18 件 + `scripts/contract-check.mjs` spec 驱动入口 | 红证据 `m0-red-first-run.log`（15R）→ 绿 `r2-contract-green.log`（18 PASS/0 FAIL · EXIT=0） | ✅ |
| N2 M1 spec 直读 | 程序 | `tools/gen-spec-data.mjs` → `src/generated/spec-data.ts` + 发现器防污染（version 最高） | acmap/g+h 锚守卫绿；内核零冻结值硬编码（G4/d） | ✅ |
| N2 M2 核心循环 | 程序 | kernel board/match(L·T 去重)/combo/deadlock(全穷举 224 探针)/sim(结算唯一序+双判) | ac-01..09,14 全绿 | ✅ |
| N2 M3 表现层 | 程序 | theme.ts 单源生成 + renderer/main/audio/persistence/perf | ac-11/13/15/16 绿；全仓 hex 溯源 theme | ✅ |
| N2 M4 PWA | 程序 | build/{index,manifest,sw,14 modules} + 零依赖 CDP 冒烟器 | 冒烟 PASS：可开+可玩+SW 激活+J1=179~196ms≤400ms | ✅ |
| N3 资产三批 | 美术 | 三批 JSON + MAPPING.md + 黑板总表 | G5/a–d 双向一致机判绿 | ✅ |
| N4 对抗复检 | QA | `tools/qa-round3.mjs` + verdict JSON + 全量输出原文 | VERDICT: APPROVE-READY（24/24 gates · R1–R7 零打回 · 反审查污染探针实测会红） | ✅ |
| N5 整合打包 | 主策划 | blockers 清零 + 黑板核销 + approve-ready-r2 提请包 | 本包 | ✅ |

## 提交链（g2-blocks 仓库 · R2/R3 轮）

`19ed02c` N1 spec v1.1 → `e6ba6fb` M0 契约红态 → `4e510b6` N2+N3 实现 → QA 修正系列 → `743fb77` N4 复检器 → `4a9cadb` N4 收口 → `c07ac4e`+`8249249` 复证轮 → `a8a0c90` R3 F1+F2 内核 → `b819be1` R3 F3+F4+加固 → `46a85b0` R3 N4 复检归档（HEAD，树净）。

---

# 上一轮（N1 修复轮 · 2026-10-01）关卡台账存档

| 关卡 | 目标 | 元素 | 状态 |
|---|---|---|---|
| level-1 | 教学局 | `el-board`/`el-spawn`/`el-hint`（reason 132 字）/`el-deadlock` | ✅ 在链 v1 |
| level-2 | 升温局 | `el-board`/`el-combo`/`el-deadlock` | ✅ 在链 v1 |

## N1 轮节点链核销（存档，全部 ✅）

线1 色板定稿（d401cab）→ 线2 spec v1 入链（19abac4）→ 线3 N3 前置（1a47805）→ 线3 契约收口（05a644e + edc414f）→ 线4 round-2（ff7d34c）→ 主人拍板（R2 轮开工时以任务书授权 + approve 接口实调闭合）
