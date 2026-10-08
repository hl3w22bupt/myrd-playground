# 部署轮 r4 证据（2026-10-08 · 封版冲刺产物上坞）

- 源：g2-blocks 源仓 `main @ 1e3eff4`（web v1.2 主线 + N4 埋点 a70d194）
- 工作区部署提交：`9fe1a23`（= 远端分支 `myrd/g2-blocks-v13-n1-spec-cmuyupvw30035m93eu5gdynv0` HEAD）
  - `787a52c` 导出封版冲刺产物（22→23 modules，新增 telemetry/analytics.mjs；源仓 build/ 逐字节镜像）
  - `9fe1a23` 壳标识拾取（cherry-pick 57b3d67：health 自识别 app:"g2-blocks" + fallback 页标题，与线上 v12 已验证壳一致）
- 部署：appId `cmuqelj2r0046m9zr4emgdgdg`（slug g2-blocks-2 · sourceId g2-blocks）· deploymentId `cmuyzjydy004hm93ei1bxbgvt` · commitHash `9fe1a23dd…` 全等 · errorMessage 空 · app status ready
- 门禁（源仓 main）：
  - `node scripts/contract-check.mjs` → 18 PASS / 0 FAIL / 0 PEND · CONTRACT: PASS
  - `node tools/build.mjs` → BUILD 23 modules → build/
  - `node tools/smoke.mjs` → SMOKE: PASS（J1=177.9ms ≤ 400ms）
- 线上自测：
  - curl：/health 200 `{"ok":true,"app":"g2-blocks",...}` · 裸根 308 → /apps/g2-blocks-2 · /gw 200
  - 新包特征：`telemetry/analytics.mjs` / `render/feel.mjs` / `daily.mjs` 全 200（v12 dy 包没有的文件）
  - 字节一致性：线上 `main.mjs` sha256 `0659545…`、`telemetry/analytics.mjs` sha256 `5dea790…` 与仓内提交件全等
    （index.html 差异属壳 base/boot 注入，伺服页头 `<base href="api/public/assets/">` 实证）
  - LIVE-SMOKE: PASS（CDP headless，live-smoke.json）：__G2_READY · 64 满员 · 真实 tap 0→160 chain1 · J1=147.3ms
    · 埋点 sink=web · sent=[run_start, session_start, evt_first_screen, evt_first_drag, evt_first_place, restart_clicked, run_start]
    · 重开复位 · 控制台零错误
- 部署前线上态披露：v12（2026-10-06 run-cmuvzeu 轮）= v1.1 dy 移植包 + g2 专属壳，黑板零登记；
  本轮把线上从「v1.1 dy 包」推进为「v1.2 + N4 埋点 web 包」，壳标识面经拾取保持 g2-blocks 身份不回退。
