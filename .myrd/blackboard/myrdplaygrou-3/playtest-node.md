# playtest 节点留痕（2026-11-11）

- run：cmwar74im003km9m2cwb92xkq ｜ 分支：myrd/game-3-goal-cmwaqvrng002lm9m2nftdd20h ｜ 本节点起笔 HEAD：b59a429
- 前置核对（preHook threejs-browser-smoke 证据链，全部亲读、非转述）：
  - 门禁判定脚本 6 件在仓库内 std-skills/threejs-game-dev/scripts/（preflight/browser-smoke/asset-triple-check/playtest-summary/visual-ratchet/lib-png）——非注入副本、未改写；
  - .myrd/routines.yaml 含 id=threejs-preflight 与 id=threejs-browser-smoke，与 references/{threejs-preflight-routine.md,threejs-browser-smoke-routine.md} 参数化模板一致（gamePath=games/myrdplaygrou-3）；
  - qa/smoke/report.json：62s 正式档双视口 desktop fps16.4 / mobile fps14.2、exceptions=0、consoleErrors=0/视口、非纯色 15/19 色 → PASS；
  - 部署取证包 qa/experience/2026-11-10T16-52-47-deploy/：8 步全响应、console/errors.json 空、322 张图（steps 8 + frames 314）、fps-series 29 样本（headless SwiftShader 软渲染 avg 10.3，仅证据非门禁）；
  - 部署锚：deploymentId=cmwax345r002km97avs9jgvxa（gitRef=@88b7469）running，liveUrl=/apps/myrdplaygrou-3/。
- 动作：
  1. playtest_kit 产物已 PATCH 合并回写（GET→客户端拼接→整体 PATCH；原 5 条 detail 回读逐字节一致，无覆盖丢失——沿用 deploy 节点踩坑后的安全姿势）；
  2. 打分卡已发：POST /goals/cmwaqvrng002lm9m2nftdd20h/ask-user，template=mini_game_playtest，requestKey=playtest_cmwaqvrng002lm9m2nftdd20h → 201 created=true，messageId=cmwaxyy11002ym97agrrhqrn9；
  3. playtest_summary 产物已回写（ADVISORY 第一阶段）：autoPassSuggested=true（冒烟 PASS + 部署 running + qa 证据齐全），rounds=0，screenshots=322，consoleErrors=0，versionSha=b59a42903c282043783330ad4c4384894710601a，evidence=games/myrdplaygrou-3/qa/experience/。
- 如实披露：构建产物未搭 ?tuning=1 调参桥（src/main.js 仅实现 ?smoke= 协议），kit 内已注明；调参只认 numeric.js / spec.numeric 声明键（PLAYER_SPEED/AIM_GAIN/AIM_MAX/KEEPER_SPEED/KEEPER_RAMP_PER_GOAL/KEEPER_RAMP_MAX/SHOOT_COOLDOWN/GOALS_TO_WIN/ROUND_SECONDS/COIN_COUNT/COIN_SCORE/CAM_*），URL 未声明键一律忽略。
- 状态：**待用户试玩**（打分卡已发出、未收到回填；不轮询空等，人机回环到点收尾）。收到的回填再走：解析结论与调参 URL → POST /api/v1/game-design-specs/cmwarhr9y000zm9ri2yf159t2/revisions 写 spec.numeric（带 sourceTrajectoryId 溯源）→ approve → 回写 op=tuning_applied；下一轮按新 spec 重部署。
- 试玩结论纪律：本节点全程零「好玩」类结论——量表四问（目标可读性 / 重开意愿 1-5 / 手感观感 1-5 对照 .myrd/style-card.md / 节奏断档秒数区间）只能来自用户回填，未回填前 ac-human-playtest 记「待回填」。
