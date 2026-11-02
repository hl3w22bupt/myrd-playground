# implement 节点 r4 复跑收口：v6 三 Bug 修复独立复验（不信任声称、全量重跑取证）

> 本节点：对分支 `myrd/pvz-web-goal-cmvxjycvn001zm905jnwpyliv` HEAD `3c06d3c`（v6 三 Bug 修复
> 合流态）做**独立复验**——门禁/断言/导出产物/资产管线全部重跑取证，不沿用上一轮日志；
> 并对本 run 身份下的部署通道做一次实测（结果见 §4，按纪律单次不重试）。
> 判定脚本一律来自仓库 `std-skills/godot-game-dev/scripts/`（零自造零改写）。
> Bug→修复→机判逐条镜像：`games/myrdplaygrou/docs/spec-acceptance-mirror-v6.md`（零改动，
> 本轮复验未发现镜像文档与代码/断言有任何漂移）。

## 0. 结论

- **工程面（本节点职责）：3/3 Bug 修复在 HEAD 复验通过，六项门禁全绿，零代码改动。**
  三条 Bug 的修复代码与冒烟断言已由前序轮合流入库（599407e + 71b4e5f → merge d3313bb），
  本轮全部独立重跑证实其真实有效——没有发现任何「声称已修实际未修」或「断言放水」。
- **部署面：仍被平台身份链 403 阻塞（与前序 release 轮同根因，本 run 新鲜证据 §4）。**
  线上仍为 v14（deploymentId `cmvy6zxdg001qm9y0b3sgs5f6` @ `26c7b62`，2026-11-02 实测
  线上 pck = `d5a96327…` ≠ 本地修复版 `76b09d9b…`），**v6 三 Bug 修复未上线**。
  解除方式与前序轮一致：由有属主权限的身份（或补 actFor 的平台修复）重新触发部署
  （gitRef = 本分支），随后重跑线上 mobile-web-smoke + 能量探针即可交付。

## 1. 门禁复跑（HEAD `3c06d3c`，工作树干净，本地 == origin 同名分支）

| 门禁 | 判定 | 实测 | 证据 |
|---|---|---|---|
| resolve-godot.sh | 可用 | Godot 4.3.stable.official.77dcf97d8 | `godot-version.txt` |
| preflight.py | PREFLIGHT: PASS | 15 类（2706 个工程文件） | `verify-full.log` |
| smoke.sh（**600 帧**） | GODOT_SMOKE: PASS | exit 0，断言标记齐全、日志无脚本错误 | `smoke-evidence.log`（全量断言行） |
| input-fuzz.sh | GODOT_FUZZ: PASS | seed=20260913，6 批次 239 帧 | `verify-full.log` |
| playtest.sh | GODOT_PLAYTEST: PASS | 3 局 ×900 帧，fb=228/247/238，max_gap ≤0.383s | `verify-full.log`（METRICS 行） |
| mobile-web-smoke（--project，本地导出） | MOBILE_SMOKE: PASS **11/11** | 网络/console/canvas/render/animate/touch-pipeline/touch-response/摇杆跳过/audio-unlock/viewport/fps | `mobile/report.json` |
| 能量探针 audio_energy_probe.mjs | AUDIO_PROBE: PASS **9/9** | **绑定当前导出哈希**（--expect-pck-sha/js）：BGM 持续能量、confirm/place/wave 尖峰、静音端到端归零、恢复、18 资产在包、console 零错误 | `audio-probe/report.json` |

## 2. 三 Bug 核销复验（机判证据行 = 本轮 `smoke-evidence.log` 原文）

| Bug | 机判断言（smoke.gd） | 本轮实测证据行（逐字） |
|---|---|---|
| ① cmvyowgsh006sm9y05qblbd70（P1 顶栏按钮重复） | SWEEP level==1 → `debug_control_counts()`：常驻 7 类各 ==1、卡槽 ==关卡数 | `[smoke] 顶栏单实例守卫通过（第 2 关常驻控件 sun/next_wave/wave/lives/back/restart/mute 各 1，卡槽 5 张）` |
| ② cmvyowgtj006um9y0lxb19hyt（P1 按钮与字体过大重叠） | 五档 SubViewport 逐档实例化：12 元素在画布内 + 两两无重叠 + 钳制带 + 行距 ≥8 + 顶栏 ≤72 + 战场让位 | `[smoke] HUD 布局 360×740：两行 12 元素在界无重叠（按钮高 44 css，行距 8，战场让位 50 px）` … `[smoke] HUD 布局 2560×1440：单行 … 顶栏高 68 ≤ 草坪首行 72`（5 档 5 行全过） |
| ③ cmvyowguf006wm9y0cf7fbxk3（P2 音效紧张刺激与代入感） | 静态：18 资产在盘在册 + 循环 + 真值表 9 组 + 配方分层；行为：groan/chomp/danger 触发 + 双版切换与回落 + 末波急促号角 | `[smoke] 音频紧张感探针通过（groan/chomp/danger 触发、双版 BGM 切换与回落、末波急促号角在册）`；能量面由 AUDIO_PROBE 9/9 兜底（真实出声，哈希绑定） |

- 冒烟断言 ↔ 策划案 v6 验收条目一一对应关系维持前轮镜像结论：
  `acc-hud-layout` ↔ smoke 第 19 项（含单实例守卫子句）、`acc-audio-tension` ↔ smoke 第 20 项。
- 资产管线纪律复验：`assets/sfx/` 18 个 .wav + 18 个 .import 元数据齐全
  （含紧张版 BGM / wave_urgent / zombie_groan / chomp / danger）。

## 3. 导出产物一致性（部署输入）

- `export/web/index.pck` sha256 = `76b09d9b94f369547180df1b8908f089e2c35ff57eaa5d9523aa481fcb0095bc`
- `export/web/index.js` sha256 = `8b649683883a8be172e229a0479503d50cd5245ebf87aa71fda70bf720824075`
- 与前序合流轮留档**逐字节一致**；HEAD 自合流后仅追加 QA 留档（3c06d3c 只动 smoke 留证日志），
  `git status --porcelain games/myrdplaygrou/export/` 为空 = 产物与 HEAD 零漂移，无需重导出。
- **线上实锚**（2026-11-02 本轮实测，字节级）：liveUrl 资产通道返回 base64+gzip 文本
  （6,951,952 B）→ decode+gunzip = **5,605,248 B，sha256 `32d79ee289bd5184cb6cc57264ffa20df7ac32bbe159b42bfd11ba1153f3562a`**
  —— 与 deploy-v14 轮留档的线上锚定哈希**逐字一致** = 线上确为 v14 @ `26c7b62`。
  本地修复版 `76b09d9b…`（8,210,496 B 裸 pck，含 18 音频资产与 HUD/紧张感实现）未上线；
  `index.js` 两侧同哈希（引擎层未变，差异全在 pck 内的游戏代码/资产）。

## 4. 部署通道实测（本 run 身份，单次取证不重试）

- `GET  /api/v1/apphost/apps/cmvxjyb8a001xm905cnip241e/deployments` → **403**
  「仅应用所有者或系统管理员可操作」（req_1793601056070）
- `POST /api/v1/apphost/apps/cmvxjyb8a001xm905cnip241e/deployments`
  （body 与平台 deploy 节点同构：mode=bundle，gitRef=本分支）→ **403**（req_1793601389015）
- 连带同因：`GET /api/v1/goals/cmvxjycvn001zm905jnwpyliv` 403「无权访问」；
  `GET /api/v1/apphost/apps?slug=myrdplaygrou` 403 —— **产物回写通道同被堵**。
- 根因（平台仓 `platform-identity.ts` 注释自证 + 前序 release 轮 `qa/gate-logs/20261102-release-blocked-identity/` 判例）：
  workflow-node 代行 token 无 `actFor`、userId=触发人（目标大师）；apphost 路由
  `assertAppAccess` 按「owner（Admin）或系统 admin」无条件先行 → 必然 403，非重试可解。
  修复点在平台侧（triggeredByUserId 落目标 owner，或为委派 run 增发 actFor=owner）。
- env 无 `MYRD_GOAL_ID` / `MYRD_TEAM_ID`，agent-teams 产物登记通道同样不可用。

## 5. 交付边界声明

- 本节点交付：HEAD `3c06d3c`（六门禁全绿 + 三 Bug 机判证据 + 零漂移导出产物，均已推送），
  本目录全部证据文件。
- 未交付（blocked，非工程缺陷）：AppHost 新 deployment 与 liveUrl/HostedApp/deployment id
  回写——待平台身份链修复后有属主身份重触发；线上复验（线上 mobile-web-smoke + 线上
  能量探针）随该次部署执行。
