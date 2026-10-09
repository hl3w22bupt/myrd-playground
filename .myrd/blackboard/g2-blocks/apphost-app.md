# AppHost 应用登记 — g2-blocks（熔炉方块）

> 更新时间：2026-10-09（部署轮 r4 · 复用同一坑 `cmuqelj2r0046m9zr4emgdgdg`，发布 **v1.3 首批**产物 · LIVE-SMOKE PASS）
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

## 本轮部署（2026-10-09 · 部署轮 r4 · 当前生效 · **v1.3 首批** near-miss + 结算页 IA）

| 项 | 值 |
|---|---|
| gitRef（分支） | `myrd/pixel-fives-m0-m1-cmtpb66pe000rm9e2ozdurf8d` |
| 部署提交 | `8b96402`（已推远端，`git ls-remote` 核对全等 `8b96402e…`；部署单回读 commitHash 全等） |
| manifestPath | `games/g2-blocks/apphost.toml`（sourceId=`g2-blocks` · mode=bundle · deployedBy=workflow） |
| 导出产物 | `games/g2-blocks/export/web/`（**30 文件**，= 源仓 `g2-blocks@feat/v1.3-nearmiss-settlement ded8e8f` `build/` **逐字节相等**（rsync 后 `diff -rq` 核对）；较 r3 的 25 文件新增 `render/nearmiss.mjs` / `render/settlement.mjs` / `telemetry/analytics.mjs` / `telemetry/nearmiss-telemetry.mjs` / `generated/ux-data.mjs`；`sw.js` 仅缓存版本时间戳变（既有失效机制，非漂移）；与已验证内测包 `web-v13-beta` 29/30 文件逐字节全等） |
| deployment id | `cmv0gc581000cm91im2nx4uip`（**version 14** · current · running · 零 errorMessage · 被上一版 v13 `cmuyzjydy004hm93ei1bxbgvt` 接管为历史） |
| 产物区 artifactId | `cmuqewt4u004jm9zreo1yw2ue`（kind=app · ready · 本轮 POST 201 幂等复用同一 id） |
| 线上自测 | LIVE-SMOKE: **PASS**（真浏览器 CDP：`/gw` 可开 + `__G2_READY=true` + 盘面 64 满员 + 真实 tap 得分 **0→160（chain 1）** + 控制台零错误 + `?internal=1` 观测口 `__G2_NM/__G2_SETTLEMENT/__G2_NM_LOG` 三件全在 = v1.3 near-miss/结算新面已上生命） |

- **部署前门禁（源仓 @ `ded8e8f`，v1.3 收口态）**：`node scripts/check-v13.mjs` 三态契约 **18/25/29+1PEND 全 PASS**（与 N5 封箱证据同数）+ `node tools/build.mjs` 两次重建仅 `sw.js` 时间戳异 + `node tools/smoke.mjs` **SMOKE: PASS**（J1=188.9ms ≤ 400ms · 结算页三区块 P0–P2 + 归因 + 行动层 · 触达 ≥48 · near-miss `__G2_NM` bannerActive=true 频控/超限计数在册）。
- **受理方式**：单次 POST（网关 504 但服务端受理一条 v14，GET 复查证实无重复单——沿 r3 判例）；轮询 4 次（40s）至 running。
- **产物一致性双验**：线上 `/api/public/assets/main.mjs` sha256 = `92d563b74904a6c3…` 与仓内提交件全等；v1.3 五个新增件线上全 200。
- **健康端点**：`/apps/g2-blocks-2/health` → 200 `{"ok":true,...}`（壳自标识 `app:"stack-tower"` 为既有形态，健康判定只看 200，游戏内容不受影响）。
- **跨线零接触**：本轮 git 变更 10 条路径全部落在 `games/g2-blocks/export/web` + 黑板内；`games/stack-tower` / `games/game` / 根 `apphost.toml` / 源仓各分支零触碰（源仓 dy/port-v1.1 工作区原样未动，构建在既有 worktree `g2-blocks-v13` @ `ded8e8f` 完成）。
- **披露**：线上包 = v1.3 内测包同源构建（含 `?internal=1` 内测观测口与 nm 遥测缓冲面；web 面只缓冲不外发、未配端点，提审包零 diff 契约 ac-33 已断言提审面不受影响——AppHost 非提审面）。PWA 发布动作依据本 run 任务书「每次都把当前成果发布上去」执行；SUBMISSION-STATUS-v13.md §四.5 的主人拍板条款针对提审动作，AppHost 预览面按工作流既有判例逐轮直发。

## 上一轮（2026-10-04 · 部署轮 r3 · v1.2 手感轮 · 存档）

| 项 | 值 |
|---|---|
| gitRef（分支） | `myrd/pixel-fives-m0-m1-cmtpb66pe000rm9e2ozdurf8d` |
| 部署提交 | `caaaba2`（= 远端同名分支 HEAD，`git ls-remote` 核对全等 `caaaba23…`） |
| manifestPath | `games/g2-blocks/apphost.toml` |
| 导出产物 | `games/g2-blocks/export/web/`（**25 文件**，= 源仓 `g2-blocks@6d3db6a` `build/` **逐字节相等**，`diff -rq` 核对；较 r2 的 22 文件新增 `daily.mjs` / `render/feel.mjs` / `generated/feel-data.mjs`，即 v1.2 六项手感 + daily 钩子；`sw.js` precache 列表已含三新模块） |
| deployment id | `cmuta82oz001cics1ppn9syak`（version 5 · current · running · 零 errorMessage） |
| 产物区 artifactId | `cmuqewt4u004jm9zreo1yw2ue`（kind=app · ready · 本轮 POST 201 幂等复用同一 id） |
| 线上自测 | LIVE-SMOKE: **PASS**（真浏览器 CDP：可开 + 盘面 64 满员 + 核心循环 0→160 chain=1 + **消除粒子上屏 drawn=8** + 重开复位 + 零控制台错误 · J1 实测 **153.6ms** ≤ 400ms） |

- **受理方式**：单次 POST（吸取 r2 重复受理教训），网关仍返 504 但服务端**仅受理一条**（version 5，无重复）；轮询至 `currentDeploymentId` 切到 v5 后再做线上自测。
- **产物一致性双验**：线上 `/api/public/assets/sw.js` 与仓内提交件 `diff` 逐字节全等；`main.mjs` sha256 全等（`3ef61025…`）。
- **stack-tower 线上零接触**：本轮 git 变更 10 条路径全部落在 `games/g2-blocks/export/web` 内（7 改 + 3 新增），`games/stack-tower` / `games/game` / 根 `apphost.toml` 零触碰。
- slug 精确检索提示：`?slug=g2-blocks` 命中的是首建已删坑 `cmuqekaip0044m9zrzod50hgf`（status=suspended，软删占位）；**不要用那个**，本游戏专属坑 = `cmuqelj2r0046m9zr4emgdgdg`（slug `g2-blocks-2`）。

## 部署前门禁（游戏源仓 @ `6d3db6a` = v1.2 D1–D6 驳回修复轮收口态，树净）

- `node scripts/contract-check.mjs` → **18 PASS / 0 FAIL · CONTRACT: PASS**（Mode A · approved v1.1 · EXIT=0）
- `node tools/build.mjs` → **BUILD 22 modules → build/ · spec v2 approved**（重建两次：`index.html`/`theme.mjs` 哈希全等，仅 `sw.js` 缓存版本时间戳变——属缓存失效机制，非漂移）
- `node tools/smoke.mjs` → **SMOKE: PASS**（可开 + 可玩 0→160→240 + 消除粒子上屏 drawn=8 + 重开 + level-1/2 切换 + SW 激活 + manifest + 控制台零错误 · J1=173.8ms ≤ 400ms）
- N4 复检基线（同源仓 `eab0df0`→`6d3db6a` 谱系）：契约双态 18/18 + 25/25 · 八门禁 ①–⑧ 全 PASS · P95=16.7ms 与 v1.1 基线全等，见 `gate-logs/v12-feel-n4-rerecheck-20261004/`

## 上一轮（2026-10-03 · 部署轮 r2 · 存档）

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
