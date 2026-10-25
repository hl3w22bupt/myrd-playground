# REVISIONS — line4-unblock-jam 版本链记账（禁覆盖 · 只追加）

> 链根：`cmvlpx0uf0019m94iyuroz578`（projectId `cmto0g28j0002m9sqnvjdy8o7`）· schemaVersion v0
> 纪律：新版本只走 `POST /api/v1/game-design-specs/:id/revisions`（version+1，旧版自动 superseded）；approve 只走 `POST /:id/approve`（同 scope 唯一 approved）；禁止本地手改伪造版本号。

| # | 链版本 | spec 版本 | 链 id | 状态 | 动作与依据 | 时间（UTC） |
|---|---|---|---|---|---|---|
| 1 | v1 | v0.1（T+0 骨架版） | `cmvlpx0uf0019m94iyuroz578` | superseded（原 draft） | `POST /api/v1/game-design-specs` 201 创建（body=projectId+schemaVersion v0+六段 spec+assets）；拍板 B 生效凭 `../blackboard/next-line/decision-record-v1-20261024.md`；QA 七条缺陷已在 v0 内逐条写死锚点（核销表另件）；**不 approve——正式审查归主人**（红线） | 2026-10-24T01:26:23.367Z |
| 2 | v2 | v0.2（P3 勘误版） | `cmvlrc0ma001tm94ialxeykjn` | **draft（唯一现行）** | `POST /api/v1/game-design-specs/cmvlpx0uf0019m94iyuroz578/revisions` **201**（parent=v1 自动 superseded，回查实测）；主人驳回反馈②：g-01 statement 二义消解——「20 局全部完成」与「≥0.90」定死为**达成率口径 ≥0.90（≥18/20）**，冻结 target 不动（驳回二选一之 Option A）+ acc-02 指代「五要素规格」→「三通道规格（通道/预算/硬顶）」（L4-4/F-01 同批核销）；纯文字面消歧——entities/levels/numeric/world/assets 五段 POST 后回查**逐字节零变更**（机判 True）+ meta 仅 version/revision_note 变；**approve 仍归主人** | 2026-10-24T02:06:02.530Z |

## 链上回查留痕

- 创建响应原件：`spec-v0-create-response.json`（HTTP 201）。
- 创建后回查：`cmvlpx0uf0019m94iyuroz578` v1 draft · parentSpecId=null（链根）· entities 8 / levels 3 / acceptance 9 / assets 6 —— 与 payload 逐段全等。
- 机读契约件导出：`design-spec.json`（整行含 `_platform` 锚 v1 draft）——**draft 态不作契约测试强制输入**（契约面待 approved 才生效，红线路径 fail-closed）。
- 前两次 POST 422（assets 缺 file/source、缺 kind）如实留痕于本轮轨迹，未产生任何链上版本（禁覆盖红线未触碰）。
- **v2 修订（2026-10-24）**：请求体原件 `spec-v0.2-revision-payload.json` · 响应原件 `spec-v0.2-revision-response.json`（HTTP 201）· 回查后机读契约件导出 `design-spec.json`（`_platform` 锚 v2 draft，parentSpecId=`cmvlpx0uf0019m94iyuroz578`）；v1 回查实测 status=superseded。
- v2 变更面（机判）：仅 acceptance[g-01-first-60s-guide].statement 与 acceptance[acc-02-exit-feedback-latency].statement 两处 + meta.version（0.1→0.2）+ meta.revision_note（str→array 追加）；entities/levels/numeric/world/assets 五段逐字节零变更。

| 3 | v2（同版） | v0.2 | `cmvlrc0ma001tm94ialxeykjn` | **approved（唯一现行）** | **主人平台侧拍板 approve**（`POST /:id/approve`，version 不变·approve 不产新版本）：平台 GET 200 实测 `updatedAt=2026-10-24T08:43:25.904Z`（北京时间 16:43，上轮 run 收口后）；同 scope 仅 v1(superseded)+v2(approved)，**approved 唯一性成立**。spec 六段本体零变更（本地件与链上 7/7 段逐字节 MATCH 机判）——本行为**链面实测回写记账**（非新版本）；本地导出件 status 锚 draft→approved 同步（2026-10-25） | 2026-10-25（实测回写） |

## approve 后转真记录（2026-10-25 · 10/25 交付包 P0-1）

- 契约门禁两态实证：draft 锚 `SPEC_NOT_APPROVED exit 1`（红线）→ approved 锚 **`29 PASS / 0 FAIL exit 0`**（`gate-logs/line4-gate-20261025/01→07`）。
- acceptance 8 条 auto check 转真（`tests/contract/checks/`）实跑 **46 断言全 PASS**；a3 真人面单列（0/5 待采，终裁归主人）。
- deploy 冒烟：scaffold smoke 4/4 + port-gate web/wx 硬检 0 FAIL + **P-02 转 ✓**（两态对照 draft=GATE-NOTE → approved=✓）。
- 玩法灌实（过审解锁）：四实体落地 `src/entities/{lot,car,exit}.ts` + `src/levels/director.ts`（谱系 20 局全可解 · BFS 解序列稳定 · 红轮三边界执行者）。
