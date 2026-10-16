# gate-logs/deploy-20261003 — 部署轮 r2 机器证据（原始输出）

- 日期：2026-10-03
- 目的：把 A 轮收口后的最新产物发布到 AppHost 专属坑（一坞一游戏，复用 `cmuqelj2r0046m9zr4emgdgdg`）
- 一号仓库分支：`myrd/pixel-fives-m0-m1-cmtpb66pe000rm9e2ozdurf8d`；部署提交 `852a13c`（= 远端同名分支 HEAD）
- 游戏源仓：`/Users/leo/.myrd/workspaces/cmto0g28j0002m9sqnvjdy8o7/g2-blocks` @ `fe5fd38`（黑板登记 A 轮最终态，树净）
- 导出：`node tools/build.mjs` 重建 `build/`（19 modules · spec v2 approved）→ rsync 镜像到
  `games/g2-blocks/export/web/`（22 文件，`diff -rq` 与 build/ 逐字节相等）
- 部署：`POST /api/v1/apphost/apps/cmuqelj2r0046m9zr4emgdgdg/deployments`
  `{mode:bundle, gitRef:<当前分支>, manifestPath:games/g2-blocks/apphost.toml, sourceId:g2-blocks}`
  → deployment `cmush9a7r0015ic7qljin3aqi`（v3 · running · commitHash `852a13c1` · 零 errorMessage）
  · 披露：网关 504 但服务端两次受理，多出同内容 v4（`cmusha3hg0017ic7qyf7xjpax`），冗余无害

| 文件 | 命令 | 结论 |
|---|---|---|
| `01-contract-check.log` | `node scripts/contract-check.mjs`（源仓 `fe5fd38`） | 18 PASS / 0 FAIL · EXIT=0 |
| `02-smoke.log` | `node tools/smoke.mjs`（重建后 build/） | SMOKE: PASS · J1=167.1ms ≤ 400ms · 控制台零错误 |
| `03-live-smoke.log` | CDP 直连 liveUrl `/gw`（一次性探针，未改源仓被钉档脚本） | LIVE-SMOKE: PASS · 0→160（chain 1）· 重开复位 · 控制台零错误 |

线上 curl：`/health` 200 `{"ok":true,...}` · `/` 308→`/apps/g2-blocks-2`（200，
`<title>熔炉方块 g2-blocks</title>`）· 8/8 资产 200，含旧包没有的
`platform/{storage,audio,clock}.mjs`、`kernel/datetime.mjs`、`telemetry/fps.mjs`（新包特征核验）。
