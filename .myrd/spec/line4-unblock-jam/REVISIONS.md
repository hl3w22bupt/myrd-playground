# REVISIONS — line4-unblock-jam 版本链记账（禁覆盖 · 只追加）

> 链根：`cmvlpx0uf0019m94iyuroz578`（projectId `cmto0g28j0002m9sqnvjdy8o7`）· schemaVersion v0
> 纪律：新版本只走 `POST /api/v1/game-design-specs/:id/revisions`（version+1，旧版自动 superseded）；approve 只走 `POST /:id/approve`（同 scope 唯一 approved）；禁止本地手改伪造版本号。

| # | 链版本 | spec 版本 | 链 id | 状态 | 动作与依据 | 时间（UTC） |
|---|---|---|---|---|---|---|
| 1 | v1 | v0.1（T+0 骨架版） | `cmvlpx0uf0019m94iyuroz578` | **draft** | `POST /api/v1/game-design-specs` 201 创建（body=projectId+schemaVersion v0+六段 spec+assets）；拍板 B 生效凭 `../blackboard/next-line/decision-record-v1-20261024.md`；QA 七条缺陷已在 v0 内逐条写死锚点（核销表另件）；**不 approve——正式审查归主人**（红线） | 2026-10-24T01:26:23.367Z |

## 链上回查留痕

- 创建响应原件：`spec-v0-create-response.json`（HTTP 201）。
- 创建后回查：`cmvlpx0uf0019m94iyuroz578` v1 draft · parentSpecId=null（链根）· entities 8 / levels 3 / acceptance 9 / assets 6 —— 与 payload 逐段全等。
- 机读契约件导出：`design-spec.json`（整行含 `_platform` 锚 v1 draft）——**draft 态不作契约测试强制输入**（契约面待 approved 才生效，红线路径 fail-closed）。
- 前两次 POST 422（assets 缺 file/source、缺 kind）如实留痕于本轮轨迹，未产生任何链上版本（禁覆盖红线未触碰）。
