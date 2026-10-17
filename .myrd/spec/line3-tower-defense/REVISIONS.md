# 版本链记账 — line3-tower-defense（spec 版本链唯一台账）

> 负责人：主策划（版本链唯一看护）· 红线：任何内容修订必须经平台接口 version+1，禁止覆盖旧版、禁止本地伪造版本号

| 平台 version | 记录 id | 状态 | 语义版本 | 内容 | 动作留痕 |
|---|---|---|---|---|---|
| 1 | `cmvabm4kh001jm92c4qtjy9a7` | **approved**（2026-10-16T02:34:48Z） | 0.1 | T+0 骨架版：六段完整 + acceptance 7 条（check=规划落点）+ 数值面结构冻结待校准 | 创建 `POST /api/v1/game-design-specs` 2026-10-16T02:00:32Z HTTP=201（`research/line3-spec-create-post.log`）；创建时 status=draft（memo v1 口径「不 approve」），**同日 02:34:48Z 链上状态变为 approved（非本会话动作，主人侧批准，如实登记以链上实况为准）** |
| 2（本轮） | `cmvbqgzbl0029m9ax64foxd37` | **approved**（2026-10-17T01:44:41Z，唯一 approved） | 1.0 | **六件套完整版**：acceptance 15 条（四件套 a1/a2/a3/a4 + det-1/tex-1/perf-1 承 v0.1 id + 新增 a5 四事件/a6 操作路径/ac-art-1..4/inv-1/fnd-1）+ world 段差异点三列+品类声明+首屏文案 12 条逐字+操作路径 5 条带 path id + entities 12 条带 script/scene 落点 + numeric 初始锚定值（waveBand P50∈[240,420]/P90≤600/20 种子等，标「初始锚定值、实测后 revision 校准」）+ palette 8 色冻结（B4 风格卡 v1）+ meta.telemetryFields 四件定名 | 复现：`POST /api/v1/game-design-specs/cmvabm4kh001jm92c4qtjy9a7/revisions` body={spec,detail}（载荷 `spec-v1-payload.json`）→ 201 draft（`gate-logs/b6-revision-post.log`）→ B5 QA 预审 PASS（`qa-preaudit-v1.log` QA-L3-SPECV1-PREAUDIT-20261017-01）→ B6 六判据核签（`gate-logs/b6-six-criteria.md`）→ `POST /cmvbqgzbl0029m9ax64foxd37/approve` → 200 approved · 父版 v1 回查 superseded ✓ · 导出件 `design-spec.json` 与链上锚键序无关深比零漂移 PASS |

## approve 六判据（B6 · 本轮任务书口径）

1. 六件套齐全（六段完整且数组元素非空 id）
2. acceptance 四要素完备无禁词（稳定 id + auto/manual + check 文件名 + 可判定数值；样本量具体数值；零「流畅/有趣」类模糊词）
3. world 段红线落点（差异点三列 + 不同品类声明 + 首屏文案逐字 + 操作路径带 path id）
4. 与 10/16 拍板一致（memo v1 四字段 + 视觉基调 + 品类查重结论零漂移）
5. 埋点逐字符一致（first_tap/first_loop_complete/restart_clicked/hint_shown；telemetryFields ↔ 源码常量 fnd-1 机判）
6. 未判定项全带负责人+采样计划（a3 真人面 / 数值校准条款各带 owner+计划）
