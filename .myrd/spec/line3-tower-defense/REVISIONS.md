# 版本链记账 — line3-tower-defense（spec 版本链唯一台账）

> 负责人：主策划（版本链唯一看护）· 红线：任何内容修订必须经平台接口 version+1，禁止覆盖旧版、禁止本地伪造版本号

| 平台 version | 记录 id | 状态 | 语义版本 | 内容 | 动作留痕 |
|---|---|---|---|---|---|
| 1 | `cmvabm4kh001jm92c4qtjy9a7` | **approved**（2026-10-16T02:34:48Z） | 0.1 | T+0 骨架版：六段完整 + acceptance 7 条（check=规划落点）+ 数值面结构冻结待校准 | 创建 `POST /api/v1/game-design-specs` 2026-10-16T02:00:32Z HTTP=201（`research/line3-spec-create-post.log`）；创建时 status=draft（memo v1 口径「不 approve」），**同日 02:34:48Z 链上状态变为 approved（非本会话动作，主人侧批准，如实登记以链上实况为准）** |
| 2 | `cmvbqgzbl0029m9ax64foxd37` | **superseded**（2026-10-23 起被 v4 链取代；2026-10-17T01:44:41Z–2026-10-23 期间为唯一 approved） | 1.0 | **六件套完整版**：acceptance 15 条（四件套 a1/a2/a3/a4 + det-1/tex-1/perf-1 承 v0.1 id + 新增 a5 四事件/a6 操作路径/ac-art-1..4/inv-1/fnd-1）+ world 段差异点三列+品类声明+首屏文案 12 条逐字+操作路径 5 条带 path id + entities 12 条带 script/scene 落点 + numeric 初始锚定值（waveBand P50∈[240,420]/P90≤600/20 种子等，标「初始锚定值、实测后 revision 校准」）+ palette 8 色冻结（B4 风格卡 v1）+ meta.telemetryFields 四件定名 | 复现：`POST /api/v1/game-design-specs/cmvabm4kh001jm92c4qtjy9a7/revisions` body={spec,detail}（载荷 `spec-v1-payload.json`）→ 201 draft（`gate-logs/b6-revision-post.log`）→ B5 QA 预审 PASS（`qa-preaudit-v1.log` QA-L3-SPECV1-PREAUDIT-20261017-01）→ B6 六判据核签（`gate-logs/b6-six-criteria.md`）→ `POST /cmvbqgzbl0029m9ax64foxd37/approve` → 200 approved · 父版 v1 回查 superseded ✓ · 导出件 `design-spec.json` 与链上锚键序无关深比零漂移 PASS |
| 3 | `cmvkb0818001dm968tzdoh0mk` | **superseded**（**未 approve 即被 v4 取代**——自建载荷 `meta.version` 漏自增仍 1.0，为保台账语义版本次序不出脏 approved，v3 不 approve，出 v4 修正后随链 superseded） | 1.0（漏自增，如实留痕） | 内容 = v1.1 可测性补强本体（a1/a2 追加真人面对应面表述），仅 `meta.version` 字段错为 1.0 | P0-3 组合推进轮：`POST …/cmvbqgzbl0029m9ax64foxd37/revisions` → 201 draft（`line3-tower-defense/gate-logs/p0-3-rerun-20261023/12-revision-post.log`）→ QA 预审改动面 PASS（`13-qa-preaudit-v11.log`：冻结四段深等 + 仅 a1/a2 追加句 + id/check 零改动）→ 发现 meta.version 漏自增 → 不 approve，改出 v4 |
| **4（当前·唯一 approved）** | `cmvkb2d8y001fm968778whydc` | **approved**（2026-10-23T01:43:57Z） | **1.1** | **可测性补强版（P0-3 组合推进轮）**：a1 追加真人面「首 30 秒流失」判据表述（流失=run_start 后 30000ms 内无 first_placement_at 且无 run_end 含中途离开；测量方法=本地埋点方案 v1 `line3-tower-defense/telemetry-plan-v1.md`，零平台 API；阈值=观测型初始锚定，样本回流后 revision 校准）；a2 追加真人口径单局时长测量表述（run_end.run_duration_ms，与模拟局分开统计）；唯一其余改动=meta.revision_note 追加。**numeric/world/entities/levels 逐段冻结深等 · acceptance 15 条 id 与 check 命令零改动 · a1/a2 既有阈值一字不动** | `POST …/cmvkb0818001dm968tzdoh0mk/revisions` → 201 draft（`14-revision-post-v4.log`）→ QA 预审唯一差异 PASS（`15-qa-preaudit-v4.log`）→ 主策划六判据核签（`16-six-criteria-v4.log`；禁词扫描唯一命中=a3 既有判据名标签「（好玩判据主条·真人局口径）」与 approved v2 同位逐字相同，裁决=回归性命中非新增模糊词）→ `POST …/cmvkb2d8y001fm968778whydc/approve` → 200 approved → 链上回查 v1–v3 全 superseded + v4 唯一 approved（`18-chain-readback.log`）→ 导出件换基线零漂移 DEEP-EQUAL（`19-export-rebase.log`）→ 新基线双门禁复跑 EXIT=0（统一契约门禁识别「平台登记 v4」+ run-all 14/14+1PEND，`20-post-revision-gates.log`）。**修订不计打磨轮 R1、不受「等反馈」约束（主策划裁定口径）；好玩终裁红线不失效** |

## approve 六判据（B6 · 本轮任务书口径）

1. 六件套齐全（六段完整且数组元素非空 id）
2. acceptance 四要素完备无禁词（稳定 id + auto/manual + check 文件名 + 可判定数值；样本量具体数值；零「流畅/有趣」类模糊词）
3. world 段红线落点（差异点三列 + 不同品类声明 + 首屏文案逐字 + 操作路径带 path id）
4. 与 10/16 拍板一致（memo v1 四字段 + 视觉基调 + 品类查重结论零漂移）
5. 埋点逐字符一致（first_tap/first_loop_complete/restart_clicked/hint_shown；telemetryFields ↔ 源码常量 fnd-1 机判）
6. 未判定项全带负责人+采样计划（a3 真人面 / 数值校准条款各带 owner+计划）
