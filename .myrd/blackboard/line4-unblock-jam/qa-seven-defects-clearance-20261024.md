# QA 七条缺陷核销表 — PL4 spec v0（2026-10-24 · 游戏 QA 署名件）

> 核销对象：链 v1 `cmvlpx0uf0019m94iyuroz578`（draft）· 契约件 `.myrd/spec/line4-unblock-jam/design-spec.json`
> 核销口径：任务书七条缺陷逐条对 spec 原文机核；**全核销才转正式审查，任一不核销打回执笔**
> 措辞红线：本表只核「可测性/可判定性」缺陷；「好不好玩」终裁归主人（a3 真人面单列）

| # | 缺陷（任务书原文摘要） | spec 核销锚点（原文定位） | 核销判定 |
|---|---|---|---|
| 1 | **F1**：核心动作与正反馈具体事件名写死 + 首 60s 引导判据（判据编号挂资产编号） | 核心动作=拖动沿朝向轴（world.sceneSpec + e-car）；事件名写死 `car.drag_start/car.drag_end/car.exit/level.complete/level.fail`（levels level-1/el-g01-guide + acc-02 statement）；正反馈通道名写死 `vf-car-exit-burst/vf-combo-pop/vf-level-clear`（acc-02 statement + assets.md §四 三通道规格〔原「五要素」，v0.2 勘误更正〕）；首 60s 判据=`g-01`（levels level-1/el-g01-guide：60s 窗口三步），**判据编号 g-01 挂资产编号 a04-guide-hand**（同 element + assets 段 a04 expect + acc-01/g-01 statement） | ✅ 核销 |
| 2 | **F3**：判读证据写死（dev HUD/冒烟自测 N 局，N 定死） | `numeric.measurement.sampling`=「冒烟自测 N=20 局（seeds 42..61）全量帧采样」+ `smokeN:20`；telemetry 三列 sampling 列逐键写死「冒烟 20 局/dev HUD first60s 读数」（numeric.telemetry[0].sampling 原文） | ✅ 核销（N=20 定死） |
| 3 | **F4**：测量口径定死（时钟源/设备档位/采样量） | 时钟源=`numeric.measurement.clockSource`（表现层 performance.now() · 内核零 Date.now）；设备档位=`numeric.perf.deviceTier`（中端 60fps 基准 · stepBudgetMs=16 · 首交互 ≤3000ms）；采样量=`measurement.sampling`（20 局全量帧 + a3 真人 5 名另列） | ✅ 核销（三要素全定死） |
| 4 | **三红轮边界写死** | levels level-2 三 element：`el-red-entry`（进入边界：前关步数 ≤ par 才入红轮）/ `el-red-clear`（完成边界：`numeric.redRoundStepBudget=12` 内驶出）/ `el-red-fail`（失败边界：超预算即 fail + `redRoundFailDowngrade=2` 连败降级）；断言面=acc-04 | ✅ 核销（三边界数值/谓词全写死） |
| 5 | **计数控名人写死 + pending 不计连击** | 控名人=e-session（`src/kernel/session.ts` 为 moveCount/comboCount **唯一所有权落点**，其余模块只读——entities[1] expect 原文）；pending 不计连击=e-combo（仅 `car.exit` 事件帧 comboCount+1，pending 零计数——entities[6]）+ 恒等式断言 acc-03（`combo_pending_violations=0`） | ✅ 核销 |
| 6 | **黑板登记块名写死 + entities/levels 落点文件路径写死** | 黑板登记块名=`.myrd/blackboard/line4-unblock-jam/`（子黑板三件套本轮实建；styleRef/assets 引用同路径）；entities 8 条逐条带落点文件路径（`games/line4-unblock-jam/src/{kernel,entities,levels,telemetry}/*.ts`）；levels 3 关 elements 全带判据/谓词落点 | ✅ 核销 |
| 7 | **双对标引简报条目号写死** | meta.lineage：「对标1《上个了车》《看谁先上车》＝简报 v2 §三候选②行 · 出处 D35；对标2《挪了下车》＝简报 v2 §三候选②行 · 出处 D40」；world.styleRef 同步引用 D35/D40 + 对照表落点（assets.md §三） | ✅ 核销 |

## 附加核验（QA 职责面）

- **六段结构完整性**：meta/world/numeric=对象，entities(8)/levels(3)/acceptance(9) 数组且 id 非空全等，assets(6) 带 kind/source/file 三字段——schema v0 校验通过（POST 201 原件 `spec-v0-create-response.json`）。✓
- **PEND 纪律**：谱系布局参数（密度带/par 带）显式 `PEND-待校准`，未编实测数；判读判据面（F1/F3/F4/三红轮）全冻结无 PEND。✓
- **check 路径口径**：acceptance 8 条 auto 的 check 均为「规划落点」标注（审查通过版落地转真后才生效，line3 v0.1 判例同型）；a3 为 manual 真人面单列。✓
- **链面**：链 v1 draft 唯一、无 superseded 旁支；未 approve（正式审查归主人）。✓

## 核销结论

**七条缺陷全部核销（7/7）→ spec v0 转正式审查**：提请主人对链 v1 `cmvlpx0uf0019m94iyuroz578` 行使 approve/驳回/修订指令。审查通过前：零玩法逻辑、零 contract-check 断言（任务书红线维持，脚手架空壳冒烟除外）。

——游戏 QA（七条缺陷核销签）· 2026-10-24

## 勘误同步（2026-10-24 · 主人驳回反馈② · 签名面不变）

主人正式审查驳回 1 件 P3 文字面缺陷：g-01 statement「20 局全部完成」与「≥0.90」同句二义（机判口径无法唯一确定）。已走链 v2 `cmvlrc0ma001tm94ialxeykjn`（v0.2，POST 201 实证）定死为**达成率口径 ≥0.90（≥18/20）**（驳回二选一之 Option A，冻结 target 不动），同批核销 L4-4/F-01（acc-02「五要素规格」→「三通道规格」）。本表 F1 行引用同步更正；**七条核销判定不受影响**（F1 锚=事件名写死+判据编号挂资产编号，两处勘误均为指代/口径消歧，未触碰锚点实质）；核销对象版本锚自本注记起 = 链 v2 draft。
