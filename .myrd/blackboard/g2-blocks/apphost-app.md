# AppHost 应用登记 — g2-blocks（熔炉方块）

> 更新时间：2026-10-03（部署轮 r2 · 复用同一坑，发布 A 轮收口后的最新产物）
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

## 本轮部署（2026-10-03 · 部署轮 r2 · 当前生效）

| 项 | 值 |
|---|---|
| gitRef（分支） | `myrd/pixel-fives-m0-m1-cmtpb66pe000rm9e2ozdurf8d` |
| 部署提交 | `852a13c`（工作区仓 HEAD，= 远端同名分支 HEAD，`git ls-remote` 核对全等） |
| manifestPath | `games/g2-blocks/apphost.toml` |
| 导出产物 | `games/g2-blocks/export/web/`（22 文件，= 源仓 `g2-blocks@fe5fd38` `build/` **逐字节相等**，`diff -rq` 核对；新增 `platform/{storage,audio,clock}.mjs` + `kernel/datetime.mjs` + `telemetry/fps.mjs`，即 A 轮 N3 三件） |
| deployment id | `cmush9a7r0015ic7qljin3aqi`（version 3 · running · commitHash `852a13c1` · 零 errorMessage） |
| 产物区 artifactId | `cmuqewt4u004jm9zreo1yw2ue`（kind=app · ready · 本轮 POST 201 幂等复用同一 id） |

- **重复部署披露**：平台网关对 POST 返回 504（超时），但服务端两次受理 → 产生 version 3 + version 4 两条
  内容完全相同（同 gitRef / 同 manifestPath）的部署。v3 先成 current；v4（`cmusha3hg0017ic7qyf7xjpax`）
  排队重跑同一产物，属冗余无害，无回滚需要（线上一包一坑，不受影响）。

## 部署前门禁（游戏源仓 @ `fe5fd38` = 黑板登记 A 轮最终态，树净）

- `node scripts/contract-check.mjs` → **18 PASS / 0 FAIL · CONTRACT: PASS**
- `node tools/build.mjs` → **BUILD 19 modules · spec v2 approved**（重建两次树哈希全等，确定性核验）
- `node tools/smoke.mjs` → **SMOKE: PASS**（可开+可玩 0→160→240 + SW 激活 + manifest + 控制台零错误 · J1=167.1ms ≤ 400ms）

## 线上自测（2026-10-03 · curl + 真浏览器 CDP 直连 liveUrl）

- curl：`/health` 200 `{"ok":true,...}` · `/` 308→`/apps/g2-blocks-2`（终态 200 `<title>熔炉方块 g2-blocks</title>`）
- **新包特征核验**：`/gw/api/public/assets/{main.mjs,platform/storage.mjs,platform/audio.mjs,platform/clock.mjs,kernel/datetime.mjs,telemetry/fps.mjs,manifest.webmanifest,sw.js}` 全 200
  （`platform/*`、`datetime.mjs`、`fps.mjs` 为旧包没有的文件 → 可证线上就是本轮新包，非旧部署缓存）
- `LIVE-SMOKE: PASS`（CDP headless）：`/gw` 可开 · `__G2_READY=true` · 64 格满员（level-1）
  · 真实 tap 得分 `0 → 160（chain 1）` · 重开全复位 · 控制台零错误

## 上一轮部署（2026-10-02 · 首次发布，存档）

| 项 | 值 |
|---|---|
| gitRef（分支） | `myrd/pixel-fives-m0-m1-cmtpb66pe000rm9e2ozdurf8d` |
| 部署提交 | `8d40c39` |
| 导出产物 | `games/g2-blocks/export/web/`（17 文件，= 源仓 `g2-blocks@0c3aa95` build/） |
| deployment id | `cmuqemmzf004am9zr3s9yodkn`（version 2 · 已被 v3 接管为历史） |
| 门禁 | contract 18/18 · 七件套全 PASS · SMOKE PASS J1=183.8ms；证据 `gate-logs/deploy-20261002/` |
| 线上自测 | LIVE-SMOKE: PASS（0→160 chain1 + SW 激活 + 控制台零错误） |

## 下一轮注意事项

1. **复用坑 `cmuqelj2r0046m9zr4emgdgdg`**：部署前 `git branch --show-current` 非 main + 已推远端，`manifestPath` 固定 `games/g2-blocks/apphost.toml`，`sourceId` 固定 `g2-blocks`。
2. 共享壳 `server/` 的 `/health` 自标识写死 `app:"stack-tower"`（壳属糖果/叠塔线遗产，健康判定只看 200，游戏内容不受影响）；如需壳侧文案按游戏区分，走壳改造轮，不在游戏轮内顺手改。
3. 平台公网代理会剥 `Service-Worker-Allowed` 头 → SW 实际 scope 落在 `…/api/public/assets/`（与 stack-tower-3 同一既有形态，离线缓存覆盖资产面可用，页面导航回退不受影响）。
