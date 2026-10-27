# 部署轮证据 — g2-blocks（熔炉方块）首个可玩构建上 AppHost（2026-10-02）

> 执行线：游戏程序（部署轮）。游戏源仓 = `/Users/leo/.myrd/workspaces/cmto0g28j0002m9sqnvjdy8o7/g2-blocks`（独立 git 仓库，无远端）。
> 部署仓 = 本工作区一号仓（分支 `myrd/pixel-fives-m0-m1-cmtpb66pe000rm9e2ozdurf8d`）。

## 0. 硬前置（三过三）

| # | 项 | 结果 | 证据 |
|---|---|---|---|
| 1 | 分支非 main | ✅ | `git branch --show-current` → `myrd/pixel-fives-m0-m1-cmtpb66pe000rm9e2ozdurf8d` |
| 2 | 分支已推远端、无领先提交 | ✅ | `git ls-remote origin` → `10a24cd…` = 本地 HEAD；显式 fetch 后 `origin/<branch>..HEAD` = 0 行；部署提交 `8d40c39` 随后 `git push` 成功（`10a24cd..8d40c39`） |
| 3 | 本游戏专属部署清单 | ✅（本轮创建） | `games/g2-blocks/apphost.toml`（name=「g2-blocks（熔炉方块）」/ runtime=node20 / health=/health / assets_dir=games/g2-blocks/export/web）；仓库根 `apphost.toml`（糖果线）与 `games/stack-tower/apphost.toml` 零触碰 |

## 1. 部署前门禁复跑（游戏源仓 @ `0c3aa95`）

- `01-gate-seven.log`：`npm run gate` 七件套全 PASS · GATE_EXIT=0
- `02-contract-check.log`：`node scripts/contract-check.mjs` **18 PASS / 0 FAIL** · EXIT=0
  （spec v2 approved · numeric 锚 `302e63367f3dea63…`）
- 冒烟（本地）：`node tools/smoke.mjs` → **SMOKE: PASS**，可开+可玩（0→160→240）+ level-2 入口 +
  SW 激活 + manifest + 控制台零错误 + **J1=183.8ms ≤ 400ms**

## 2. 导出（产物 ≡ 代码）

- 源仓 `node tools/build.mjs` → `build/` 17 文件（index.html + manifest.webmanifest + sw.js + 14 模块）。
- `diff -rq build ../run-…/games/g2-blocks/export/web` → **BYTE-EQUAL**（逐字节相等，零手改）。
- 源仓配套提交：`ac47c4f`（守卫策略白名单 +`games/g2-blocks/`，ac-17 自检复跑 PASS）→ `0c3aa95`（重建产物 + J1 证据落档）。

## 3. 坑位与部署

- slug 精确检索 `GET /api/v1/apphost/apps?slug=g2-blocks` → **404**（无坑）→ 按规则新建专属坑。
- 首建 `cmuqekaip0044m9zrzod50hgf` 未带 projectId → 部署被拒 `DEPLOY_REJECTED（project.githubUrl 为空）`；
  接口无 PATCH/PUT 更新面 → 删除该空坑（零部署、status=creating）→ 带 `projectId=cmto0g28j0002m9sqnvjdy8o7` 重建 →
  **`cmuqelj2r0046m9zr4emgdgdg`**（slug 平台自动加后缀 = `g2-blocks-2`，sourceId 恒为游戏 slug `g2-blocks`）。
- 部署 `POST /api/v1/apphost/apps/cmuqelj2r0046m9zr4emgdgdg/deployments`：
  `{"mode":"bundle","deployedBy":"workflow","gitRef":"myrd/pixel-fives-m0-m1-cmtpb66pe000rm9e2ozdurf8d",
    "manifestPath":"games/g2-blocks/apphost.toml","sourceId":"g2-blocks"}`
  → deployment `cmuqemmzf004am9zr3s9yodkn`（version 2 · running · 零 errorMessage · finishedAt 03:32:14Z）。

## 4. 线上自测

- curl：`/health` 200 · `/` 308→`/apps/g2-blocks-2`（跟随终态 200，`<title>熔炉方块 g2-blocks</title>`）·
  `/gw` 200 text/html · `/gw/api/public/assets/{main.mjs,kernel/sim.mjs,manifest.webmanifest,sw.js}` 全 200。
- `03-live-smoke.log`（真浏览器 CDP 直连 liveUrl，脚本 `03-live-smoke.mjs`）：
  **LIVE-SMOKE: PASS** — `__G2_READY=true` · 64 格满员 · 真实 tap 一手得分 0→160（chain 1）·
  SW 激活（scope `…/api/public/assets/`）· 重开全复位 · 控制台零错误。

## 5. 登记

- 产物区「打开应用」：`POST /api/v1/agent-teams/<team>/artifacts` → artifactId `cmuqewt4u004jm9zreo1yw2ue`（kind=app · ready）。
- 黑板：`../../apphost-app.md`（appId/slug/liveUrl/gitRef，供下轮复用同一坑）+ `../../blockers.md`（挂账③销账）。
