# release/deploy 节点 r5：v6 三 Bug 修复态发布收口 —— 工程面全绿复验；部署仍被平台身份链 403 阻塞

> 本 run：`cmvypf21o0076m9y0zcjjpol1`（workflow `cmvqa20q30006m9s3b6w5hgmp`）。
> 受测基线：分支 `myrd/pvz-web-goal-cmvxjycvn001zm905jnwpyliv` HEAD `f0b3dd3`
> （本地 == origin 同名分支，0 领先 0 落后，工作树干净）。
> 判定脚本一律来自仓库 `std-skills/godot-game-dev/scripts/`（零自造零改写）。

## 0. 结论

- **工程面：v6 三 Bug 修复在本 run 独立复验全绿（六项证据全部本 run 新鲜产出，未沿用前轮日志）。**
  三条 Bug 的机判证据行与本 run `smoke-evidence.log` 逐字在案（§2）；移动端模拟门禁 11/11、
  能量探针 9/9（绑定当前导出哈希）均 PASS（§1）。
- **部署面：仍被平台身份链 403 阻塞（与 r4/release 轮同根因，本 run 新鲜证据 + 属主实锚）。**
  本 run 身份下 POST deployments → 403（req_1793602423611）；goals GET/PATCH 回写通道同样 403。
  **线上仍为 v14**（2026-11-02 本轮实测 live pck sha256 `32d79ee2…` = v14 锚定值 ≠ 修复版
  `76b09d9b…`）—— **v6 三 Bug 修复未上线**。
- **根因已钉到用户与记录级**（§4）：本 run 触发人 = 目标大师（`cmvtaqy0h000sm9sfukbpdks5`），
  而 HostedApp `cmvxjyb8a001xm905cnip241e` 与目标 `cmvxjycvn001zm905jnwpyliv` 的属主均为
  **Admin**（`cmvqczjbd0000m9a5ledaxbs6`）；workflow-node token 无 `actFor`，授权按触发人本人
  计算 → `assertAppAccess` 必然 403。历史上全部成功部署（v10~v14）都来自 **Admin 触发的 run**
  （2026-11-01 01:31~10:57）；18:54 起 run 改由目标大师触发 → 通道即断。

## 1. 前置检查与门禁复跑（HEAD `f0b3dd3`）

前置硬检查全部通过：

| 检查 | 结果 |
|---|---|
| `git branch --show-current` | `myrd/pvz-web-goal-cmvxjycvn001zm905jnwpyliv` ✓ |
| `git remote -v` | github.com/hl3w22bupt/myrd-playground ✓；分支已推送（HEAD == origin 同名分支）✓ |
| 门禁资产 `std-skills/godot-game-dev/scripts/` | preflight.py / smoke.sh / input-fuzz.sh / playtest.sh / resolve-godot.sh / mobile-web-smoke.mjs 齐全 ✓ |
| `.myrd/routines.yaml` | 含 godot-smoke / mobile-web-smoke routine ✓（references 模板齐全） |
| Godot | `resolve-godot.sh` → 4.3.stable.official.77dcf97d8，`--headless --version` 通过 ✓ |

门禁复跑（证据全在本目录）：

| 门禁 | 判定 | 实测 | 证据 |
|---|---|---|---|
| preflight.py | PREFLIGHT: PASS | 15 类（2726 个工程文件） | `preflight.log` |
| smoke.sh（**600 帧**） | GODOT_SMOKE: PASS | exit 0，日志无脚本错误 | `smoke.log`；全量断言行 `smoke-evidence.log` |
| input-fuzz.sh | GODOT_FUZZ: PASS | seed=20260913，6 批次 239 帧 | `fuzz.log` |
| playtest.sh | GODOT_PLAYTEST: PASS | 3 局 ×900 帧，fb=226/247/238，max_gap ≤0.383s | `playtest.log`（METRICS 行） |
| mobile-web-smoke（--project，本地导出 :8123） | MOBILE_SMOKE: PASS **11/11** | 网络/console/canvas/render/animate/touch×2/摇杆跳过/audio-unlock/viewport/fps | `mobile/report.json` |
| 能量探针 audio_energy_probe.mjs | AUDIO_PROBE: PASS **9/9** | 绑定 `--expect-pck-sha 76b09d9b…` / `--expect-js-sha 8b649683…`；首手势前静音→手势解锁→BGM 持续能量→音效尖峰→静音归零→恢复→18 资产在包→console 零错误 | `audio-probe/report.json` |

导出产物零漂移（部署输入就绪）：
`export/web/index.pck` sha256 = `76b09d9b94f369547180df1b8908f089e2c35ff57eaa5d9523aa481fcb0095bc`，
`index.js` sha256 = `8b649683883a8be172e229a0479503d50cd5245ebf87aa71fda70bf720824075`
—— 与 r4 合流轮留档逐字节一致；`git status --porcelain games/myrdplaygrou/export/` 为空。

## 2. 三 Bug 核销（机判证据行 = 本 run `smoke-evidence.log` 逐字）

| Bug | 机判断言（tests/smoke.gd） | 本 run 实测证据行 |
|---|---|---|
| ① cmvyowgsh006sm9y05qblbd70（P1 顶栏按钮重复） | SWEEP level==1（过关进第 2 关）→ `debug_control_counts()`：常驻 7 类各 ==1、卡槽 ==关卡数 | `[smoke] 顶栏单实例守卫通过（第 2 关常驻控件 sun/next_wave/wave/lives/back/restart/mute 各 1，卡槽 5 张）` |
| ② cmvyowgtj006um9y0lxb19hyt（P1 按钮与字体过大重叠） | 360/768/1280/1920/2560 五档 SubViewport 逐档实例化：12 元素在画布内 + 两两无重叠 + 钳制带（按钮高 44~56）+ 行距 ≥8 + 单行顶栏 ≤ 草坪首行 + 战场让位 | `[smoke] HUD 布局 360×740：两行 12 元素在界无重叠（按钮高 44 css，行距 8，战场让位 50 px）` … `[smoke] HUD 布局 2560×1440：单行 … 顶栏高 68 ≤ 草坪首行 72`（5 档 5 行全过） |
| ③ cmvyowguf006wm9y0cf7fbxk3（P2 音效紧张刺激与代入感） | 静态：18 资产在盘在册 + 紧张版循环 + 切换真值表 9 组 + 配方分层；行为：groan/chomp/danger 触发 + 双版切换与回落 + 末波急促号角 | `[smoke] 音频紧张感探针通过（groan/chomp/danger 触发、双版 BGM 切换与回落、末波急促号角在册）`；真实出声由 AUDIO_PROBE 9/9 兜底（哈希绑定） |

冒烟断言 ↔ 策划案 v6 验收条目一一对应关系维持镜像文档结论
（`games/myrdplaygrou/docs/spec-acceptance-mirror-v6.md`）：
`acc-hud-layout` ↔ smoke 第 26/27 项（五档布局 + 单实例守卫）、`acc-audio-tension` ↔ 第 20/28 项。
本 run 复验未发现镜像文档与代码/断言任何漂移。

## 3. 线上实锚（2026-11-02 本轮实测）

- `GET /apps/myrdplaygrou/health` → 200；`GET /apps/myrdplaygrou/` → 308 → 跟随 200（服务在跑）。
- 资产通道 `api/public/assets/index.pck` → base64 文本 6,951,952 B → decode+gunzip = 5,605,248 B，
  sha256 = **`32d79ee289bd5184cb6cc57264ffa20df7ac32bbe159b42bfd11ba1153f3562a`**
  —— 与 v14 部署轮线上锚定哈希逐字一致 = **线上确为 v14 @ `26c7b62`**。
  本地修复版 `76b09d9b…`（8,210,496 B 裸 pck，含 18 音频资产 + HUD 单实例/五档布局 + 紧张感实现）未上线。

## 4. 部署通道 403 根因（本 run 实测 + 记录级实锚）

本 run 单次部署尝试（与平台 deploy 节点同构请求，未重试）：

```
POST /api/v1/apphost/apps/cmvxjyb8a001xm905cnip241e/deployments
  body: {mode:bundle, deployedBy:workflow, triggeredById:cmvxjycvn001zm905jnwpyliv,
         gitRef:myrd/pvz-web-goal-cmvxjycvn001zm905jnwpyliv, sourceId:cmvxjycvn001zm905jnwpyliv}
→ HTTP 403 {"code":"FORBIDDEN","message":"仅应用所有者或系统管理员可操作","requestId":"req_1793602423611"}
```

连带同因被堵：`GET /api/v1/goals/cmvxjycvn001zm905jnwpyliv` → 403（req_1793602435291）、
`PATCH /api/v1/goals/...` → 403（req_1793602435312）—— **产物回写通道同断**，blocked 状态无法
经 API 写回目标卡片，本目录与 git 留档即上报载体。

记录级实锚（平台库只读查询，仅为取证）：

| 记录 | 值 |
|---|---|
| `hosted_apps` 行 `cmvxjyb8a001xm905cnip241e`.owner_id | `cmvqczjbd0000m9a5ledaxbs6` = **Admin**（role=admin）；source_id = 本目标 id（绑定正确，无挤占） |
| `goals.cmvxjycvn001zm905jnwpyliv`.user_id | `cmvqczjbd0000m9a5ledaxbs6` = **Admin** |
| 本 run `workflow_runs.cmvypf21o0076m9y0zcjjpol1`.triggered_by_user_id | `cmvtaqy0h000sm9sfukbpdks5` = **目标大师**（role=developer） |
| 成功部署 v10~v14（11-01 01:31~10:57）所在 run 的触发人 | 全部 = **Admin** |
| 18:54 起的 run（`cmvyo0q8d…`/`cmvyp0n86…`/本 run）触发人 | 全部 = **目标大师** → 全部 403 |

机制（平台仓 `routes/apphost-access.ts` + `services/workflow/platform-identity.ts` 自证）：
workflow-node token 固定 `role=developer`、无 `actFor`（防 admin 角色入 env 的有意收窄），
`effectiveAuthUserId = userId = 触发人`；`assertAppAccess` 要求「应用属主本人或系统 admin」。
触发人（目标大师）≠ 应用属主（Admin）→ 403，非重试可解。

## 5. 解除阻塞的路径（平台侧，任一即可）

1. **换触发身份重跑**：由 Admin 重新触发本工坊工作流（与 11-01 成功部署 v10~v14 同模式，已实证可行）。
2. **补 actFor**：平台为本目标委派的 run 签发 workflow-node token 时带 `actFor = 应用属主`，
   授权沿属主链计算（`auth.ts::effectiveAuthUserId` 已支持该语义，签发侧接上即可）。
3. **属主迁移**：把 HostedApp `cmvxjyb8a001xm905cnip241e`（与目标）属主迁到目标大师。
4. **人工代发**：Admin 在应用详情页对 gitRef `myrd/pvz-web-goal-cmvxjycvn001zm905jnwpyliv`
   手动发起一次部署（产物已在分支上，构建输入零缺口）。

## 6. 交付边界声明

- **已交付**：HEAD `f0b3dd3`（六项门禁/探针全绿 + 三 Bug 机判证据 + 零漂移导出产物，全部已推送）；
  本目录全部证据文件。
- **未交付（blocked，非工程缺陷）**：AppHost 新 deployment、liveUrl/deployment id 回写、
  线上 mobile-web-smoke + 线上能量探针复验、目标卡片产物条目 —— 全部随 §5 任一解锁路径执行
  （部署成功后按 mobile-web-smoke / audio_energy_probe 对 liveUrl 复跑，锚定新 pck 哈希即可）。
