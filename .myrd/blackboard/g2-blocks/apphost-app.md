# AppHost 应用登记 — g2-blocks（熔炉方块）

> 更新时间：2026-10-02（部署轮 · 首次建坑并发布）
> 用途：一坞一游戏，下一轮**复用同一坑**（不要新建、不要挤占别的游戏的应用）

## 专属坑（2026-10-02 建档）

| 项 | 值 |
|---|---|
| appId | `cmuqelj2r0046m9zr4emgdgdg` |
| name | `g2-blocks（熔炉方块）` |
| slug | `g2-blocks-2`（首建 `cmuqekaip0044m9zrzod50hgf` 未绑项目已删，slug 被软删记录占位 → 平台自动加后缀；sourceId 仍 = 游戏 slug `g2-blocks`） |
| sourceType / sourceId | `game-studio` / `g2-blocks` |
| projectId | `cmto0g28j0002m9sqnvjdy8o7`（GameAppStore → `github.com/hl3w22bupt/myrd-playground`，与既线 stack-tower-3 同仓库） |
| status | `ready` |
| liveUrl | https://leomac-studio.tail49399e.ts.net/apps/g2-blocks-2/ |
| 玩法入口 | `/apps/g2-blocks-2/gw`（壳注入 `<base href="api/public/assets/">`，裸根 308 归一自愈到 /gw） |
| health | `/apps/g2-blocks-2/health` → 200 `{"ok":true,...}` |

## 本轮部署

| 项 | 值 |
|---|---|
| gitRef（分支） | `myrd/pixel-fives-m0-m1-cmtpb66pe000rm9e2ozdurf8d` |
| 部署提交 | `8d40c39`（工作区仓 HEAD） |
| manifestPath | `games/g2-blocks/apphost.toml` |
| 导出产物 | `games/g2-blocks/export/web/`（17 文件，= 游戏源仓 `g2-blocks@0c3aa95` `build/` **逐字节相等**，`diff -rq` 留证） |
| deployment id | `cmuqemmzf004am9zr3s9yodkn`（version 2 · running · 零 errorMessage） |
| 产物区 artifactId | `cmuqewt4u004jm9zreo1yw2ue`（kind=app · ready · runId `cmuq9pz86001vm9zrmqyfm59c`） |

## 部署前门禁（游戏源仓 @ `0c3aa95`，QA 锚 `46a85b0` 之上两个 chore 提交）

- `node scripts/contract-check.mjs` → **18 PASS / 0 FAIL · EXIT=0**（spec v2 approved，numeric 锚 `302e6336…`）
- `npm run gate` → 七件套全 PASS · **EXIT=0**（①范围守卫 ②色板 21 对 ③theme ④零冻结值面 ⑤内核确定性 ⑥check 落点 ⑦关卡面）
- `node tools/smoke.mjs` → **SMOKE: PASS**（可开+可玩 0→160→240+SW 激活+manifest+控制台零错误 · J1=183.8ms ≤ 400ms）
- 证据原文：`gate-logs/deploy-20261002/01-gate-seven.log` · `02-contract-check.log` · `03-live-smoke.log`

## 线上自测（真浏览器 CDP，直连 liveUrl）

- `LIVE-SMOKE: PASS`：`/gw` 可开（`__G2_READY=true`）· 64 格满员 · 真实 tap 一手得分 `0 → 160（chain 1）`
  · SW 激活（scope `…/apps/g2-blocks-2/api/public/assets/`）· 重开全复位 · 控制台零错误
- curl：`/health` 200 · `/` 308→`/apps/g2-blocks-2`（终态 200 `<title>熔炉方块 g2-blocks</title>`）
  · `/gw/api/public/assets/{main.mjs,kernel/sim.mjs,manifest.webmanifest,sw.js}` 全 200

## 下一轮注意事项

1. **复用坑 `cmuqelj2r0046m9zr4emgdgdg`**：部署前 `git branch --show-current` 非 main + 已推远端，`manifestPath` 固定 `games/g2-blocks/apphost.toml`，`sourceId` 固定 `g2-blocks`。
2. 共享壳 `server/` 的 `/health` 自标识写死 `app:"stack-tower"`（壳属糖果/叠塔线遗产，健康判定只看 200，游戏内容不受影响）；如需壳侧文案按游戏区分，走壳改造轮，不在游戏轮内顺手改。
3. 平台公网代理会剥 `Service-Worker-Allowed` 头 → SW 实际 scope 落在 `…/api/public/assets/`（与 stack-tower-3 同一既有形态，离线缓存覆盖资产面可用，页面导航回退不受影响）。
