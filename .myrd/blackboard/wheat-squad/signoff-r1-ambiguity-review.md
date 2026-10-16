# R1 打磨轮 · 游戏策划口径二义自查 + 审签（2026-10-14）

> 署名：游戏策划（主策划工作室代行节点，产物独立落盘）· 输入：链 v4 approved（meta v1.2，`cmv60scie003hm9qqu91foe7v`，导出件零漂移）+ 程序批三件（`games/wheat-squad/docs/r1-program-batch.md`）+ 兄弟线驳回修复轮升级项③（ac-art-2 窄面裁决悬置）
> 红线声明：实测不达只打回实现、**不放宽好玩判据阈值**；本自查不触 numeric 数值面、不改任何 acceptance statement 字面。

## 一、任务书所列二义项逐项核查（对照链 v1.2 实况）

| 任务书二义项 | 链上实况 | 结论 |
|---|---|---|
| A1 计时起点 | `meta.telemetryFields.first_core_action_at` = 「首次核心操作（首次拖动队长）发生的局内毫秒时刻（tick×FIXED_STEP_MS）」+ ac-a1 statement 数值锚 + ac-02 机判 + ac-14 剥注释三方同名 | **已闭合（v1.2）**，无二义 |
| A2 按局样本口径 | ac-a2 statement = 「sampleSeeds(20) **种子局** run_duration_ms 的 P50/P90」+ e-telemetry `run_end{run_duration_ms:number, reason}` 单事件单局 | **已闭合（v1.2）**，样本单位=完整局无二义 |
| A4 通道判定逻辑 | ac-a4 statement（通道 ≥2）+ e-telemetry `feedback_latency_ms{latencyMs, channels[]}` 结构化 + ac-05 三面机判（延迟/逐操作通道集合/flash 口径） | **已闭合（v1.2）**，判定口径唯一（channels 数组逐操作计数） |
| A2 样本量 ≥20 进 numeric 段 | `numeric.runDuration.sampleSeeds = 20` **自 v1.1 起已冻结在 numeric，v1.2 零改动**（导出件实查） | **早已满足**，无需修订 |

**小结**：任务书「成立即出 spec v1.1（二义项 + A2 样本量门槛）」所指修订，**链上已由 v1.2 等价闭合且超集**（A1–A5 扩条 + e-telemetry 9 键 + checkNaming 定死）——按「以链上实况为准」判例**不重做、不重复修订**；本轮若再触发修订即为 **v1.3（链 v5）**，与任务书字面版本号的偏差已在黑板基线区披露。

## 二、新发现判定口径二义一项 → **成立**（非任务书预列项）

- **条款**：ac-art-2（`ac-art-2-naming-entity-ids`，auto）statement 双句 = 「资产/素材清单**逐件 id ∈ spec entities ids**；**清单外未登记资产 = 违例**」。
- **二义事实（兄弟线 QA 升级项③，本席复核属实）**：机判面（`tests/contract/ac-11-art-naming-ids.spec.mjs`）仅对 `category==='entity'` 类逐件对账；manifest 现实 10 件中 `ui-kit-01 / sub-icon / sub-sharecard-5x4 / sub-shots-3` 四件非 entity id、既不在 `spec.entities` 亦不在 `spec.assets`——**同一条款存在「statement 字面全量对账」与「机判窄面放行」两个判定口径**，且清单外未登记件现实在档。
- **危害**：本轮美术特效批新增视觉通道资产 id 无单源落点依据（程序批 ③ 已预警「特效批产出前须先落此裁决」）。

## 三、主策划裁决：**B 案**（登记进单源，不改判据字面）

- **裁决内容**：`spec.assets` 补登四件（ui-kit-01 / sub-icon / sub-sharecard-5x4 / sub-shots-3，kind/file/source/license 逐件如实）+ 本轮美术特效批 fx 件**同批登记**（整批替换不拆改）。
- **配套（实现侧，非 spec 面）**：`ac-11` 机判**扩严**至逐件对账（每件 id ∈ entities ids ∪ assets ids；category==='entity' 者仍须 ∈ entities）——检测规则**加强不缩水**（statement 字面零改动即达成一致，属对齐非放宽）。
- **否决 A 案理由**：A 案（改写 statement 为 entities∪assets）动 acceptance 字面——本轮红线「不放宽判据阈值」下不必要的 spec 面扩散；B 案零 statement/数值/条款面改动，登记事实即可闭合。
- **裁决时点**：先于美术特效批产出（程序批预警条件达成）。

## 四、spec v1.3（链 v5）修订计划（走 revisions 接口 version+1，禁本地伪造）

| 项 | 内容 |
|---|---|
| 载体 | `POST /api/v1/game-design-specs/cmv60scie003hm9qqu91foe7v/revisions`（body {spec, detail}，201 draft）→ QA 预审 → 主策划审签 → approve（200 approved，代行判例沿 v1.2：审签件在档 + 好玩终裁仍归主人） |
| 增量段 | **仅 assets**：+4 补登（B 案）+ fx 特效批逐件（美术批产出后定稿 id/source） |
| 零改动段 | numeric（逐字节冻结）· acceptance 16 条 statement 字面 · world · entities · levels |
| 顺序契约（先红后绿） | ① 美术批产出 manifest +fx 件 → ② 扩严 ac-11（对 v1.2 口径即红：4 件未登记）→ ③ v1.3 入链 + approve → ④ 重导出（--expect-version 5）+ 门禁适配视图再生成 → ⑤ verify.sh 五步复跑全绿 |
| 回退预案 | 入链后任一门禁红且 30 分钟内修不掉 → 链上留 draft 不 approve，升级主人（不空转） |

## 五、审签（流程性）

- 本席（游戏策划）**同意按上述裁决与计划执行 v1.3 单点修订**。
- 好玩终裁（A3 试玩结论面 / 四件套 manual 面）**仍归主人**，本审签不构成任何好玩判定。
