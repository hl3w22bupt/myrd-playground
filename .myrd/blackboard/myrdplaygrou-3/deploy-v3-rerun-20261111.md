# 部署轮记录：《实况足球》流水线重跑轮部署收口（deploy-v3-rerun，2026-11-11）

- 分支：`myrd/myrdplaygrou-3-goal-cmwaqvrng002lm9m2nftdd20h`，本轮 HEAD=c8ed7aad8bcc16a3cb133719b7d7135a93f2c3bd（与 origin 全等）
- 背景：上轮 stalled run 处置 + 策划案 v3（cmwburjse0011m9bb8t1mjuqn）与两条缺陷单（cmwbumwrj 闪烁卡顿 / cmwbumwtv 可发现性）链路的发布节点重跑；v3 实现面沿用 c906e96（游戏源码/产物零漂移：`git diff c906e96..HEAD -- games/myrdplaygrou-3/{src,dist,tools,apphost.toml}` = 空）

## ① 上轮 stalled run 处置（发起前纪律）

- GET /api/v1/workflows/runs/cmwbl6h6e008am97aetlijmmv → **status=completed**（completedAt=2026-11-11T08:16:52.513Z）→ **免 cancel**，无双 run 并飞风险；goal artifacts 里该 workflow 条目仍标 stalled（artifact 层标签未随 run 终态刷新，平台侧形态，如实记录）。

## ② 门禁复跑（全部本轮实跑，判定器均取仓库 std-skills 路径）

- preflight：PASS（21 项 0 WARN）
- asset-triple-check：PASS（清单 7 项 / 仓库文件 0 张 / 豁免 0 —— 程序化资产工程）
- build 复现：`npm install + node tools/build.mjs` 重建前后产物 sha256 全等（321171cd97bc65d8…，606,863B）
- browser-smoke（构建产物 ?smoke=，62s 快进，双视口）：**PASS**——desktop 1280×720 fps=12.8 / mobile 720×1280 fps=12（headless SwiftShader ≥10 达标），零未捕获异常，状态机推进 playing，截图非纯色，证据刷新 qa/smoke/

## ③ 部署链（v12/v13 串线事故 + v14 纠正 —— 同型判例第 3 次复发，必带 manifestPath）

- **事故**：首轮 POST {mode=bundle, gitRef=本分支, sourceId=cmwaqvrng002lm9m2nftdd20h} **漏传 manifestPath**（任务文本未列，凭 v11 记录形态臆断安全）→ v12=cmwc288hd0014m9bhbfz7gnjd / v13=cmwc293se0016m9bhyl1ciwk9 两笔均按**仓库根清单（PvZ）**构建：线上 / 回壳内置 GAME_PAGE_HTML 回退（16,325B「植物人大战僵尸-网页版」页）、资产通道 index.html=games/myrdplaygrou/export/web/index.html（12,821B 逐字节同 PvZ 导出）、landing.html.gz.b64=404。与 wheat-squad W-3'/stack-tower 轮同型判例一致——**manifestPath 缺省=仓库根清单，本仓多游戏共存下必串线**。
- **纠正**：v14 = `cmwc2lz7f001im9bhquvnkgv5` 带 `manifestPath=games/myrdplaygrou-3/apphost.toml` 重发 → **running** @ c8ed7aa（commitHash 与推送 HEAD 全等）。POST 仍 504 网关截断（已知异步受理形态），轮询列表以终态为准。
- 504 双受理注意：v12+v13 即一次漏参 + 一次 504 重复受理的叠加；每笔 POST 后必须轮询列表核对 version 序，不能以单次响应为准。

## ④ 部署后自测（v14 上全部本轮实跑）

- GET /health → 200；GET /（308 尾斜杠重定向，跟随=200）；GET /gw → 200
- 线上 / 与 /gw 均 **606,863B，与 dist/web/index.html sha256 全等（321171cd97bc65d8…）**
- experience-harness 双视口取证包归档 qa/experience/：
  - mobile=2026-11-11T12-05-40-deploy（8 截图 / 373 帧 0 丢帧 / fps n=26 / **console errors=0** / 8.66MB）
  - desktop=2026-11-11T12-07-12-deploy-desktop（8 截图 / 400 帧 / fps n=25 / **console errors=0** / 7.86MB）
  - 截图目检（移动+桌面）：v3 教学卡「怎么玩·30 秒上手」四卡（移动/传球/射门/切换）+ 开始比赛/跳过；实局 HUD 比分计时、**单环选中**（无全队闪烁）、**传球 X / 射门 空格·蓄力 / 移动 WASD·摇杆 常驻标签**——v3 三大特性线上可见
- BROWSER-SMOKE 判定：**PASS**（判定器=std-skills/threejs-game-dev/scripts/browser-smoke.mjs，未改写）

## ⑤ 产物回写

- PATCH /api/v1/goals/cmwaqvrng002lm9m2nftdd20h artifacts 合并新增 hosted_app 条目（op=run_workflow，artifactId=cmwaqvrnc002jm9m2nqwfsoie，deploymentId=cmwc2lz7f001im9bhquvnkgv5，浏览器冒烟=BROWSER-SMOKE PASS），GET 复核 EXISTS。
