# round-5 · v2 重跑试玩验收收口：证据链核对 + v2 口径验收包重发 + 打分卡状态核验（看 → 等人）

## 观察

- 本轮为试玩验收会话，游戏源码零改动（SRC_SHA=bfd6df248a4846bb 与已部署 v7/c2109af 构建全等，线上 GET / 200 = 589,387B 与 dist/web/index.html 逐字节一致 cmp，/health 200）。
- preHook 双视口冒烟复跑（qa/smoke/report.json checkedAt=2026-11-11T05:43:38Z）：desktop/mobile 双视口 payload.ok=true、exceptions=0、consoleErrors=0、fps 19.1/16.4；任务书双断言在链 —— inputProbe.ok=true（leftDx=-1.8/rightDx=+1.8/upDz<0/downDz>0，方向键语义钉死）+ playersOnField=10、teams=2、playerSegments=160（关节人形段件）。
- 线上移动门禁（qa/mobile/report.json verdict=PASS，05:39Z）：metrics.fps=14、colorCount=23（≥2）、idleDiff=392>0、tapDiff=399、consoleErrors=0、networkFailures=0、触摸管线/响应 pass、1 WARN=摇杆热区校准读 project.godot（Godot 工程字段，three.js 工程按设计无此文件 → 合法降级）。注意：report 中 render/animate 两 check 的 detail 字段是判定器失败分支模板无条件写入（mobile-web-smoke.mjs:384-385 实证），真实读数以 metrics 为准，不据此误判「黑屏/挂死」。
- 旧 playtest_kit（v1 期产物）指引已过时：金币收集/进 3 球获胜/守门员三角波均为 v1 语义，与 v2 的 5v5 两队实况不符 → 本轮重发 v2 口径验收包。
- 打分卡状态：requestKey=playtest_cmwaqvrng002lm9m2nftdd20h 已于 2026-11-10T17:06:04Z 发出（目标会话卡片「玩一局，给游戏打个分（4 题）」），目标会话 38 条消息全扫无任何 inputAnswers —— 按「同 requestKey 未回答不重复发」纪律，本轮不重发，答题入口仍在原卡片。
- 调参桥缺口：本构建无 ?tuning=1 消费桥（src/ 零匹配，仅 ?smoke= 冒烟协议 src/main.js:15），验收包如实声明，URL 未声明键按纪律忽略并说明。
- spec 覆盖缺口（如实透出）：平台 spec v2（cmwbl64r10082m97atgikgm0o）levels 2~5（友谊赛/联赛/杯赛半决赛/决赛的难度乘数递进、净胜球目标、夜场灯光）未在本轮构建实现；本轮可玩面 = 90 秒 5v5 单局（对应 level-1「训练赛 · 首秀开球」语义），仓内契约 spec（games/myrdplaygrou-3/.myrd/spec/design-spec.json）已如实声明「唯一关卡」。

## 动作

- 核对门禁资产：std-skills/threejs-game-dev/scripts/ 6 件判定脚本全在仓（preflight/browser-smoke/asset-triple-check/playtest-summary/visual-ratchet/lib-png）、references 两模板在仓、.myrd/routines.yaml 含 id=threejs-preflight 与 id=threejs-browser-smoke —— 不触发 blocked。
- 线上构建一致性复证：curl -L liveUrl → 589,387B，cmp 与 dist/web/index.html 逐字节一致；GET /health 200。
- qa 证据清单核对：qa/experience/ 4 包（2×v5 部署 + 2×v7 部署，双视口各 8 步 + 帧序列）共 1630 图、qa/mobile/report.json PASS、qa/smoke/ 双视口报告与截图、qa/playtest-summary.json（C4 唯一缺口已如实归因）。
- 重写 op=playtest_kit（v2 口径：5v5 两队/受控人切换/关节人形/方向键钉死/平缓数值/音频解锁）+ 回写 op=playtest_summary（ADVISORY 第一阶段单行 JSON，autoPassSuggested=true 三条件全证）。
- 打分卡状态核验（GET 会话消息全扫）→ 已发未答，不重发，不伪造任何试玩结论。

## 截图

- qa/experience/2026-11-11T05-36-47-deploy/steps/02-初始画面.png （v7 线上移动视口初始画面）
- qa/experience/2026-11-11T05-36-47-deploy/steps/04-摇杆区滑动.png （v7 线上移动视口摇杆输入到达）
- qa/experience/2026-11-11T05-37-31-deploy-desktop/steps/04-摇杆区滑动.png （v7 线上桌面视口输入到达）
- qa/smoke/smoke-desktop.png （preHook 复跑桌面视口）
- qa/smoke/smoke-mobile.png （preHook 复跑移动视口）

## 改动

- 游戏源码零改动（src/、index.html、tools/ 均未触碰）。本文件 + qa/smoke/report.json（preHook 复跑留痕）+ qa/playtest-summary.json（判定器重跑重锚本轮 HEAD）+ 本验收包文本（平台 artifacts 侧）。

## 复玩对比

- 部署链闭环维持：线上 = 589,387B 游戏本体（不再是 16KB 植物人壳页），双视口 8 步输入全到达、console 零错误；v2 三项（方向键语义钉死 / 5v5 两队实况 / 程序化关节人形）在线上真实可玩可验。「好不好玩」四问量表仍待用户在目标会话卡片回填——未回填前验收状态 = 「自动化达成、试玩打分待用户」。
