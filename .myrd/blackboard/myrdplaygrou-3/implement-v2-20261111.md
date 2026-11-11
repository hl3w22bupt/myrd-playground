# 实现轮记录：《实况足球》v2 主通道重跑（2026-11-11）

- 分支：`myrd/myrdplaygrou-3-goal-cmwaqvrng002lm9m2nftdd20h`（本文件落档时 HEAD 见 git log）
- 上游：策划案 v2（产物 cmwbl64r10082m97atgikgm0o）为唯一事实源；缺陷单 sf-bug-controls（产物 cmwbl6h4h0085m97aimmadl04）
- 前情：上一工作流的游戏源码随旧工作区丢失（旧分支 myrd/game-3-goal-* @88b7469 不在本仓对象库），线上仍是 88b7469 旧构建 —— 本轮按任务口径以仓库模板重建 + 实现三项 + 部署交接

## ① 门禁资产就位（来源=origin/main，非自造）

- 本分支原只有 6 判定脚本（1612b5a 平移）；**origin/main 顶端 28620b1 正是平台预置的完整 threejs-game-dev 资产**（SKILL.md + references/ + schemas/ + templates/minimal-3d/ + routines.yaml 两条 threejs routine，gamePath=games/myrdplaygrou-3）。
- origin/main 是孤立单提交快照（与本分支 176 提交无共同祖先，git merge-base 为空）→ 不做整体 merge，精确 `git checkout origin/main -- std-skills/threejs-game-dev/ .myrd/routines.yaml`（diff 纯增量，无覆盖风险）。
- 任务书里的两个 blocked 触发条件（模板不存在 / references 不存在）由此解除：资产来自平台预置提交，非被检方自造。

## ② 三项实现（全部机判在链）

1. **方向键反向修复（sf-bug-controls）**：`src/render/keyboard.js` 为映射唯一真源（ArrowLeft/A→moveX=-1）+ `stickToIntent` 纯函数（摇杆同向）+ 内核位移符号断言 `tests/controls-direction.spec.mjs` + 线上构建机判 `smoke payload.inputProbe`（实测 leftDx=-1.8 / rightDx=+1.8，双视口 ok=true）。
2. **5v5 两队多球员实况**：内核 10 人（含双门将、号码 1-5、开球镜像）；队友接应（无球限深前推）、对方逼抢（最近上抢+全员盯人）、抢断泊松、远角射门、门将扑救/开球；契约 `tests/football-contract.spec.mjs`（接应 ≥2 人、2s 逼近 <60%、90s 传球 ≥5/抢断 ≥2/射门 ≥2/易手 ≥20）。
3. **程序化关节人形**：`src/render/player.js`（骨盆/躯干/头+双臂肩肘两段+双腿髋膝两段+球鞋，8 关节；跑动相位由内核 phase 驱动；队服主蓝/客橙/门将深绿+背号贴图）；机判=smoke payload `render.playerSegments=160`（10 人 ×16 段件）。

## ③ 门禁读数（本 run 收口时点）

| 门禁 | 结果 |
|---|---|
| preflight | PASS（0 WARN），exit 0 |
| run-all（GAME-GATES） | **7/7 PASS**（构建复现/controls-direction/football-contract/kernel-determinism/singlefile/smoke-payload/state-machine） |
| browser-smoke 双视口 | PASS（桌面 fps 16.4 / 移动 13.4-14.5，drawCalls≈201-217，量化色 35-46，零异常） |
| asset-triple-check | PASS exit 0（清单 6 项全 programmatic+reason，S2-S8 全过） |
| mobile-web-smoke（本地伺服） | PASS（含 __audioDebug 音频契约/触摸管线/视口/FPS≥8） |
| playtest-summary | rounds=3 / screenshots=5 / consoleErrors=0 / fps=13；**C4 FAIL（见 ⑤ 漂移取证）** |
| visual-ratchet | advisory：SUSPECTED_REGRESSION（t1→t3 为对局相位差非回归；本 run 为基线建立轮，不拦截） |

- 平衡基线（AI-vs-AI，10 种子 ×90s）：主 10 球 : 客 2 球，5 胜 5 平 0 负 —— 平缓大众（玩家 7.2 m/s > AI 6.4 是胜负手）；手感参数需人工试玩校准。
- SEED_DEFAULT=333（首局活力选型：11 射 2:1 主胜，常量入 spec.numeric 与 numeric.js）。

## ④ 部署交接（宿主代行，节点不碰部署接口）

- 产物已入库：`games/myrdplaygrou-3/dist/web/index.html`（589,387 字节，SRC_SHA 见产物注释；与根 index.html 逐字节一致，STAGE: PASS）。
- `games/myrdplaygrou-3/apphost.toml`：name=myrdplaygrou-3（实况足球）/ runtime=node20 / health=/health / assets_dir=games/myrdplaygrou-3/dist/web；manifestPath=games/myrdplaygrou-3/apphost.toml；勿改仓库根 apphost.toml。
- 依据知识《部署身份链 403》：workflow-node token 无 actFor，部署必 403 → **由宿主会话对 AppHost cmwaqvrnc002jm9m2nqwfsoie 执行 deploy_playable，显式 gitRef=本分支**；部署后线上验收复跑 browser-smoke 不适用（liveUrl 走 mobile-web-smoke），并核验线上 HTML 与 dist/web/index.html 逐字节一致。
- 部署后可玩锚点：`https://leomac-studio.tail49399e.ts.net/apps/myrdplaygrou-3/`（HostedApp id=cmwaqvrnc002jm9m2nqwfsoie）；回写 HostedApp/deployment/liveUrl 三项归宿主/编排侧。

## ⑤ 平台级漂移取证（不阻塞本 run，建议平台侧跟进）

1. **playtest-summary C4 schema 漂移**：`mobile-web-smoke.mjs` 写 checks 为 `{id,label,status,detail}`，`playtest-summary.mjs:219-220` 读 `c.name`/`c.pass` → touch 类检查全部过滤为空 → C4 必 FAIL。证据：games/myrdplaygrou-3/qa/mobile/report.json（checks[0]={id:"network",label:"关键资源网络全通…",status:"pass"}）。底层证据实际存在（触摸事件到达 DOM=pass、触摸后画面有响应=pass），属两判定器上游口径不一致；判定器改写被红线禁止，本轮如实标注。
2. **bug 核销 API 通道**：节点 shell 无平台 token（GET /api/v1/goals → UNAUTHORIZED，req_1794369677920）→ sf-bug-controls 的平台侧核销（PATCH /api/v1/bugs/status?id=<bugId>，id 在 query、body 只放 status）由宿主/编排侧执行；代码级修复+机判证据已在本仓（见 ②-1）。
