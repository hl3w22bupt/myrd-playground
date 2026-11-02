# 发布节点收口：部署成功 + 移动端门禁全绿（2026-11-02，run cmvz7bqja0039m9w9fjbzm7sn）

> 结论先行：**status = completed**。前置检查全绿 → 本地四门禁独立复跑全绿 → 壳契约复核在位 →
> 部署 HTTP 200（deploymentId=cmvz8witi003sm9w9vj313cws，version=18，gitRef=功能分支）→
> 线上 /health 200 + 移动端模拟门禁 11/11 PASS（带 --project 校准，零 WARN）→
> 线上 pck sha256 与本地 HEAD 导出产物一致。上一轮（r5）blocked 的部署鉴权链问题本轮已解除。

## 1. 前置检查（全部通过）

| 检查项 | 结果 |
|---|---|
| 分支 `git branch --show-current` | myrd/pvz-web-goal-cmvxjycvn001zm905jnwpyliv ✓ |
| 远端仓库 | github.com/hl3w22bupt/myrd-playground ✓；FETCH_HEAD..HEAD 为空（无领先提交）✓ |
| 门禁资产 std-skills/godot-game-dev/scripts/ | preflight.py / smoke.sh / input-fuzz.sh / playtest.sh / resolve-godot.sh / mobile-web-smoke.mjs 全在 ✓ |
| 门禁配置 .myrd/routines.yaml | id=godot-smoke 与 id=mobile-web-smoke routine 在位 ✓ |
| Godot | resolve-godot.sh → 4.3.stable.official.77dcf97d8，`--headless --version` 正常 ✓ |
| 导出产物 | export/web 与 HEAD 65660b2 同步（源码与产物同提交，工作树干净）✓ |
| 平台身份 | MYRD_TOKEN + PLATFORM_API_URL 在位；GET goals HTTP 200（上轮 403 已解除）✓ |

## 2. 本地门禁（HEAD 65660b2，独立复跑，证据在本目录）

- preflight.py → **PREFLIGHT: PASS**（15 类，2827 个工程文件）
- smoke.sh（240 帧）→ **GODOT_SMOKE: PASS**
- input-fuzz.sh → **GODOT_FUZZ: PASS**（seed=20260913 batches=6 total_frames=239）
- playtest.sh → **GODOT_PLAYTEST: PASS**（3 局 ×900 帧，fb=227/247/238，与基线持平）

## 3. 壳契约复核（server/src/index.ts + game-page.ts，全部在位）

- assets_dir = "games/myrdplaygrou/export/web"（apphost.toml，资产出 bundle）
- `GET /api/public/assets/:name{.+}`：gzip+b64 → base64 文本回传（M1 网关只透传文本）
- 落地页相对路径 `BASE_PATH + 'api/public/assets/*'`，无绝对路径、无 `?p=` 手拼
- 移动端音频手势解锁器：AudioContext 构造器包裹 + document 级手势同步 resume（幂等，
  覆盖 suspended/interrupted）+ `window.__audioDebug()` 取证出口
- 调参桥：`?tuning=<JSON>` → `window.__GAME_TUNING__`（引擎加载前解析）
- hint 条：引擎就绪后展示 6 秒自动淡出（CSS opacity + setTimeout 6000）

## 4. 部署（第 1 次尝试即成功，证据 deploy-attempt.json / deploy-attempt-http.txt）

```
POST /api/v1/apphost/apps/cmvxjyb8a001xm905cnip241e/deployments
body: {mode:bundle, deployedBy:workflow, triggeredById:cmvxjycvn001zm905jnwpyliv,
       gitRef:myrd/pvz-web-goal-cmvxjycvn001zm905jnwpyliv, sourceId:cmvxjycvn001zm905jnwpyliv}
→ HTTP 200 {"deploymentId":"cmvz8witi003sm9w9vj313cws","liveUrl":"https://leomac-studio.tail49399e.ts.net/apps/myrdplaygrou/","status":"running"}
```

- 应用状态：appStatus=ready、runtimeReady=true、version=18、durationMs=836、errorMessage=null
- 与上轮（r5）403「仅应用所有者或系统管理员可操作」对照：本轮同一 token 链路 200，
  上轮上报的鉴权链缺陷已被平台侧修复（同因不再复现，未烧任何重试）

## 5. 部署后自测（移动端门禁是硬门槛）

- 线上 /health → HTTP 200；线上 / → 308（网关尾斜杠规范化）→ 跟随 200（live-health.txt）
- **mobile-web-smoke（liveUrl，390×844 移动仿真）→ MOBILE_SMOKE: PASS**（退出码 0）
  - 第一次不带 --project：10 PASS + 1 WARN（脚本提示应带 --project 校准摇杆热区）
  - 复跑带 `--project games/myrdplaygrou`：**11/11 全 PASS、零 WARN**
    （网络全通 / console 零 error / canvas 挂载 / 首帧非纯色 / 画面在动 / 触摸到达 DOM /
    触摸后画面响应 / 摇杆断言按点按类玩法正确跳过——工程无 virtual_joystick.gd，SKILL.md §3A /
    音频手势解锁器在 / 无横向溢出 / FPS ≥ 8）
  - 证据：本目录 mobile-smoke.log、mobile-smoke-project.log、mobile/（report.json + 分阶段截图）；
    qa/mobile/report.json 为线上门禁最新落档
- 部署产物一致性：线上 `api/public/assets/index.pck.gz.b64` → base64 解码 → gunzip →
  sha256 = 82d6303e470dbbc7703afc8d2cedb9da8e8705653b63f061becb02a8dd1dd1f0，
  与本地 export/web/index.pck **完全一致**（8234432 字节）—— 线上就是本分支 65660b2 产物，
  无「把别的壳当本游戏部署出去」的漂移（live-pck-forensics.txt）

## 6. 交付清单

- liveUrl：https://leomac-studio.tail49399e.ts.net/apps/myrdplaygrou/
- deploymentId：cmvz8witi003sm9w9vj313cws（version=18，gitRef=myrd/pvz-web-goal-cmvxjycvn001zm905jnwpyliv）
- 冒烟结论：本地四门禁 + 线上 MOBILE_SMOKE 全绿；产物哈希比对一致
- 本目录全部证据文件随 git 提交留档

## 7. 产物回写（目标卡片）

- PATCH /api/v1/goals/cmvxjycvn001zm905jnwpyliv → HTTP 200（goal-patch-http.txt / goal-patch.json）
- 复验 GET → artifacts 37→38 条，新条目 op=run_workflow / artifactType=hosted_app /
  artifactId=cmvxjyb8a001xm905cnip241e / status=completed，已有 37 条零丢失
