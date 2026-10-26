# 续接核实轮取证清单 — line4-unblock-jam（2026-10-26 · 游戏程序署名）

> 性质：10/26 交付包轮（前序 @ `0d40be6`）的**续接轮独立复证**——不采信任何黑板文字，只认本机实跑与平台 GET 实测。取证时点 HEAD=`0d40be68b2aca84ea055fb6390aa6cdcc5a89967`（工作树除 `.myrd-platform/` 平台注入面外净）。
> 四要素口径：每件=命令原文 + 时刻 + exit/HTTP 码 + 输出摘要。

## 证据清单

| # | 文件 | 取证内容 | 方法与结果 |
|---|---|---|---|
| 01 | `01-platform-spec-get.json` | N0① spec 锁定版本对应 | `GET /api/v1/game-design-specs/cmvlrc0ma001tm94ialxeykjn`（Bearer）→ **HTTP 200**：`v2 · approved · updatedAt=2026-10-24T08:43:25.904Z · parentSpecId=cmvlpx0uf0019m94iyuroz578`，与本地导出件 `_platform` 逐值同 → 非本地伪记 |
| 02 | `02-contract.log` | N0③ 落点一致性 | `node scripts/contract-check.mjs --spec .myrd/spec/line4-unblock-jam/design-spec.json --project games/line4-unblock-jam` → **29 PASS / 0 FAIL，EXIT=0** |
| 03 | `03-verify-fullrun.log` + `verify/`（17 件 + manifest.txt） | N4 门禁全量复现 | `WX=1 GATE_LOG_DIR=<本目录>/verify bash games/line4-unblock-jam/verify.sh` → **17 步全 PASS · VERIFY_EXIT=0**（01 契约 + 02×9 套件 + 03 冒烟 + 04/05 移植门禁 + 06 资产 + 07 构建 + 08 壳契约 + 09 可玩冒烟） |
| 04 | `04-deploy-get.json` | 部署终态（单次查询，不长轮询） | `GET /api/v1/apphost/apps/cmvollw2z001dm91k4ptf30aw/deployments` → HTTP 200：`cmvolm4s7001fm91knv2x7mci · running · createdAt=2026-10-26T01:49:15.320Z · errorMessage=null` |
| 05 | `05-app-get.json` | 坑位归属三锚 | `GET /api/v1/apphost/apps/cmvollw2z001dm91k4ptf30aw` → HTTP 200：`slug=line4-unblock-jam · sourceId=line4-unblock-jam · projectId=cmto0g28j0002m9sqnvjdy8o7 · status=ready`（归属正确，无同名坑挤占） |
| 06 | `06-crossline-approved-scan.json` | 跨线链面扫描（52 条全量） | `GET /api/v1/game-design-specs?projectId=…&pageSize=200` → HTTP 200：全链 **approved=1（仅 line4 v2）**；平台 approve 语义实测=同 projectId 全局唯一 approved（详见下） |

## 线上可玩面探针（curl 实测）

| 探针 | 结果 |
|---|---|
| `http://localhost:3111/apps/line4-unblock-jam/gw` | **HTTP 200**，`<title>挪出一条路 · line4-unblock-jam</title>`，壳引用走 `api/public/assets/src/main.mjs`（公开资产路由，零串壳） |
| `http://localhost:3111/apps/line4-unblock-jam/` | HTTP 200 |
| 资产直读两类路径（`/apps/<slug>/api/public/assets/...`、`/api/public/assets/<slug>/...`） | 均 404——与 line3 同型，判本地网关面限制非部署缺陷（维持前轮「不冒领」口径；主人浏览器经 tailscale 域可达即真实试玩面） |

## 09 号可玩冒烟实测摘要（本机复跑）

```
[smoke-playable] 42:WIN(1步) 43:WIN(1步) … 61:WIN(1步)   ← seeds 42..61 共 20 局全 WIN
[smoke-playable] PASS=68 FAIL=0
== exit=0 ==
```

## 跨线发现（本轮新增 · 已登记共板 blockers.md）

**平台链「同 projectId 全局唯一 approved」语义**：approve 新 spec 会把同项目其它 spec（跨游戏）连带顶成 superseded。实测锚点：

- line3 v4 `cmvkb2d8y001fm968778whydc`：superseded @ `2026-10-24T08:43:25.902Z`（line4 v2 approve 前 2ms 同事务窗）；
- wheat-squad v6：superseded @ `2026-10-16T02:34:48.408Z`；stack-tower v6：superseded @ `2026-09-30T01:21:51.440Z`；
- 当前链 52 条中 **approved 仅 1 条 = line4 v2**（本轮主线恰为链上唯一 approved，N0 复证不受影响）。

影响面：各线「链上 approved 唯一」类**口径主张**（各线黑板/文档的时点表述）与未来平台 GET 复证场景；**工程契约面零影响**（各线契约单源=本地导出件快照，本轮 line4 契约 29/0 实跑佐证）。处置：共板登记升级主人（平台语义确认 / 是否需平台侧恢复），PL3 提案证据底座一行补程序署名勘误注记——不动 approved spec 一个字，不越平台权。

## 结论

10/26 交付包四线（PL2/PL3/PL4/PL5）产物**逐包复证成立，零缺口需补做**；PL4 完成定义三件齐（N5 过审 + 可玩基线部署 running + 试玩入口 200）。本轮仅新增：本证据目录 + 共板登记 + PL3 勘误注记 + 子黑板续接行。结论仅对取证时点 HEAD 有效。
