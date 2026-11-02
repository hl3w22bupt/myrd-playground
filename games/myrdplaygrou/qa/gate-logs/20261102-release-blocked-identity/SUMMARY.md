# 发布节点 blocked 收口：部署鉴权链断裂（2026-11-02，run cmvyp0n86006zm9y0ysizzt2t）

> 结论先行：**status = blocked（环境/身份链缺陷，非工程缺陷）**。工程侧全部前置与门禁绿灯，
> 导出产物已重导出并推送（aa326d2）；部署请求被平台 403 拒绝，根因是「目标大师代触发的
> workflow run 的节点 token 无属主代行授权（actFor）」，按「部署被环境问题拒绝 → 停下上报，
> 不烧重试」纪律停止，未发起第 2 次部署。

## 1. 前置检查（全部通过）

| 检查项 | 结果 |
|---|---|
| 分支 `git branch --show-current` | myrd/pvz-web-goal-cmvxjycvn001zm905jnwpyliv ✓ |
| 远端仓库 | github.com/hl3w22bupt/myrd-playground ✓，分支已推送（df378c9 = origin 同名分支）✓ |
| 门禁资产 std-skills/godot-game-dev/scripts/ | preflight.py / smoke.sh / input-fuzz.sh / playtest.sh / resolve-godot.sh / mobile-web-smoke.mjs 全在 ✓ |
| 门禁配置 .myrd/routines.yaml | id=godot-smoke 与 id=mobile-web-smoke routine 在位 ✓ |
| Godot | resolve-godot.sh → 4.3.stable.official.77dcf97d8，`--headless --version` 正常 ✓ |
| 本地四门禁（HEAD aa326d2） | preflight PASS / GODOT_SMOKE: PASS / GODOT_FUZZ: PASS / GODOT_PLAYTEST: PASS（fb=227/245/236 与基线持平）✓ |

## 2. 发布节点完成的工作（已落库）

- 发现并修复「导出产物滞后」：上一实现节点 df378c9（HUD 挂件重建分离 + 结算误触窗覆盖按钮
  点按）改了游戏源码但未重导出，export/web 停在 26c7b62。本节点四门禁先复跑全绿，再
  `godot --headless --export-release "Web"` 重导出：index.pck 5605248→5607360 字节、
  index.html 同步更新 → 提交 **aa326d2** 已推送远端功能分支。
- 壳契约复核（server/src/index.ts + game-page.ts）：assets_dir 出 bundle、
  `api/public/assets/:name{.+}` base64 文本通道、相对路径、移动端音频手势解锁器、调参桥、
  hint 条自动淡出 —— 全部在位（上一轮 MOBILE_SMOKE: PASS 基线 qa/mobile/report.json）。

## 3. 部署被拒与根因（证据：同目录 deploy-attempt.log）

- POST /api/v1/apphost/apps/cmvxjyb8a001xm905cnip241e/deployments → HTTP 403
  `FORBIDDEN「仅应用所有者或系统管理员可操作」`（requestId=req_1793592513587）。
- 连带：应用详情/状态读、目标读、项目读全部 403 —— 同一根因的不同切面。

### 根因链（平台仓库 /Users/leo/workspace/myrd @ 42c00c07，判据文件近期无改动）

1. 资源属主全是 Admin（读数：`select id,slug,owner_id from hosted_apps where slug='myrdplaygrou'`
   → owner_id=cmvqczjbd0000m9a5ledaxbs6=admin@myrd.dev；`select user_id from goals where
   id='cmvxjycvn001zm905jnwpyliv'` → 同为 Admin；project_members 仅 Admin 一条 owner）。
2. 本 run 的 MYRD_TOKEN 由引擎按 workflowNodeTokenPayload（platform-identity.ts:82-89）签发：
   userId=触发人（本 run = 目标大师 cmvtaqy0h000sm9sfukbpdks5）、role 固定 developer、
   via=workflow-node、**无 actFor** —— effectiveAuthUserId（auth.ts:97-99）回落到 userId 本人。
3. 部署路由 assertAppAccess（apphost-access.ts:16-19）要求「应用 owner 或系统 admin」，
   目标大师 ≠ Admin → 403。goals 全部路由（goals.ts:595 等逐条 `goal.userId !==
   effectiveAuthUserId(user) && role!=='admin'`）同样 403 —— **产物回写通道同样被封**。
4. 对照组：线上现行 v14（deploymentId=cmvy6zxdg001qm9y0b3sgs5f6，commit 26c7b62，status=running，
   liveUrl /health 200）由 **Admin 本人触发**的 run（workflow_runs cmvy3dy4b0018m9y00g1wweuw，
   triggered_by_user_id=Admin，2026-11-02 01:16 +0800 起）部署成功 —— 触发人=属主时链路通。
   而平台设计注释（engine.ts getPlatformIdentityEnv：「目标委派时 = 目标 owner」）本意就是
   目标委派的 run 应以目标 owner 身份触发，实际落库 triggered_by_user_id=目标大师 ——
   委派链路把触发人写成了编排 bot 本人，与设计注释不符。

### 为什么是 blocked 而不是重试

- 节点 token 携带 app:deploy 能力（scopes 通过 requireCapability），但**资源属主校验**在
  路由层无条件先行 —— 重试必然再次 403，只会白烧打回预算。
- 修复点在平台侧（二选一，非本节点可动）：① 目标委派 run 的 triggeredByUserId 落成目标
  owner（与 engine.ts 注释的设计口径对齐）；② workflowNodeTokenPayload 为目标委派 run 增发
  actFor=目标 owner（授权按 owner 计算，署名仍用 bot 本人）。

## 4. 对交付面的影响（如实声明）

- 线上 myrdplaygrou 仍是 **v14 = commit 26c7b62**，**不含** df378c9 的两处修复：
  ① HUD 挂件重复挂载/失联文案冻结（首局开局双套挂件、顶栏溢出）；② 结算窗 400ms 防连点
  只拦键盘不拦触屏按钮点按。这两处是 r3 用户反馈缺陷的修复，未上线 = 用户仍会撞到。
- 本地 aa326d2 已就绪：门禁全绿 + 导出产物已推送。**解除阻塞后只需以有属主权限的身份
  重新触发本部署（gitRef=myrd/pvz-web-goal-cmvxjycvn001zm905jnwpyliv，勿用 main），然后
  重跑 mobile-web-smoke 门禁即可交付。**
