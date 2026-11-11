# 试玩验收 round-13：流水线重跑轮 playtest 节点（2026-11-11）

- 分支：`myrd/myrdplaygrou-3-goal-cmwaqvrng002lm9m2nftdd20h`；本节点 HEAD=c7a5b8768a2bda87eb3da96d1a5b4a3266531ba9
- 上游：策划案 v3（cmwburjse0011m9bb8t1mjuqn，approved）；缺陷单 cmwbumwrj（抢断切换闪烁卡顿）/ cmwbumwtv（传球切换不可发现）修复面已随 v10/c906e96 上线，本节点游戏源码零改动
- 性质：playtest 节点（第四步）验收记录 —— 把「好不好玩」交还给人；本文件不含任何试玩结论
- 格式备注（polish 节点 2026-11-11 补）：为通过 playtest-summary 判定器的机器可解析段协议（C2），按原文补齐 ## 观察/## 动作/## 截图/## 改进点/## 改动/## 复玩对比 六段壳，**原文内容逐字保留未改写**；原 ①前置核验→观察、②验收动作→动作、③缺口→改进点。

## 观察

（原 ① 前置核验，先核对后动手，全部本节点实跑）

- 门禁资产：std-skills/threejs-game-dev/scripts/ 六件判定脚本在仓；.myrd/routines.yaml 含 id=threejs-preflight 与 id=threejs-browser-smoke（gamePath=games/myrdplaygrou-3）→ 不触发 blocked。
- **stalled run 处置**：上轮 stalled run cmwbl6h6e008am97aetlijmmv 经 GET /api/v1/workflows/runs/ 实查 status=completed（2026-11-11T08:16:52Z 终态）→ 免 cancel，无双 run 并飞（deploy-v3-rerun-blackboard 同轮留痕）。
- **preHook threejs-browser-smoke 亲跑**（node std-skills/threejs-game-dev/scripts/browser-smoke.mjs games/myrdplaygrou-3）：**BROWSER-SMOKE: PASS，exit 0**——desktop 1280×720 fps=12.7 / mobile 720×1280 fps=11.7（headless SwiftShader ≥10 达标），双视口零未捕获异常（exceptions=0，CDP 侧=0）、状态机推进 playing、截图非纯色（52/38 种量化色）。v3 断言面在链：`switchRing.instanceCount=1`（单环，缺陷 cmwbumwrj 修复可见）、`onboarding.hudLabels=["移动","传球","射门"]`（常驻标签，缺陷 cmwbumwtv 修复可见）、tutorialCard/rematchButton present、inputProbe.ok=true、playersOnField=10 / teams=2。证据刷新 qa/smoke/（report.json + 双视口截图）。
- **线上复证**：liveUrl GET → 200，606,863B，sha256 16 位前缀 321171cd97bc65d8 与 `dist/web/index.html` 及工程根 index.html **逐字节一致**；/health 200（注：响应 title 字段「植物人大战僵尸-网页版」为共享壳 server/src/index.ts:15 硬编码标签，多游戏共用，非页面串线——线上页面即本构建）。
- **部署核验**：v14 = cmwc2lz7f001im9bhquvnkgv5（version=14，commitHash=c8ed7aad… 与推送 HEAD 全等，manifestPath=games/myrdplaygrou-3/apphost.toml）；v12/v13 串线事故已 superseded（deploy 节点留痕）。
- **取证包**：qa/experience/ 现役部署轮双包——mobile=2026-11-11T12-05-40-deploy（8 截图）/ desktop=2026-11-11T12-07-12-deploy-desktop（8 截图），console/errors.json 双包 errors=[]（consoleErrors=0），输入步 inputArrived 全 true。
- **playtest-summary 判定器亲跑**（node std-skills/threejs-game-dev/scripts/playtest-summary.mjs --game … --version-sha $(git rev-parse HEAD)）：rounds=12 / screenshots=37 / actions=62 / consoleErrors=0 / fps=17 / versionSha=c7a5b8768a2b；**PLAYTEST_SUMMARY: FAIL 唯一缺口=C4**——qa/mobile/report.json 无 touch/input 类检查：mobile-web-smoke.mjs 写 checks={id,label,status,detail}、playtest-summary.mjs 读 c.name/c.pass → 过滤落空（两判定器红线禁改，平台级 schema 漂移，与 round-9/12 收口同源亲验）。原始可达性证据在档：qa/mobile/report.json touch-pipeline=pass / touch-response=pass + 取证包 inputArrived 全 true。

## 动作

（原 ② 验收动作）

- **playtest_kit 重写（v3 语义）并回写 artifacts**：旧 kit（05:55:56）为 v2「GOAL RUSH」单人守门员语义（金币收集/进 3 球获胜），与线上 5v5 实况不符已过时；新 kit 对照 v3 spec（meta/levels/content）+ numeric.js 声明键写就（教学卡四操作 / 摇杆+X 传球+蓄力射门 / 自动切环+脚下光环 / 90 秒一局 / 进球演出+再来一局 / 音频解锁），量表四问与打分卡同构，调参通道如实披露（构建无 ?tuning=1 调参桥，仅 ?smoke= 协议，src/main.js:22 实证）。
- **打分卡重发**：requestKey=playtest_cmwaqvrng002lm9m2nftdd20h 上一张卡已于 2026-11-10T23:51Z 被用户回答（其反馈已闭环为 v3 两缺陷单 + spec v3，本次打分对象即修复后的 v3）；POST /api/v1/goals/:id/ask-user → **HTTP 201 created=true**，messageId=**cmwc3b24p001nm9bh0sxv783u**（平台题库 mini_game_playtest 出题，本节点未自编题）。
- **playtest_summary 回写**（ADVISORY 第一阶段单行 JSON）：autoPassSuggested=true（冒烟 PASS + 部署成功线上逐字节一致 + qa/ 证据齐全三条件全证）；rounds=0（本节点无新增打磨轮，游戏源码零漂移）；screenshots=70（qa/experience/ 8 包 PNG 全量，其中现役部署轮 2 包 16 张）；consoleErrors=0；versionSha=c7a5b8768a2bda87eb3da96d1a5b4a3266531ba9。
- **spec 修订：未写**——本轮打分卡未回填（等待用户试玩 v3），严禁编造数值；用户回答到达后按 numeric.js/spec.numeric 声明键 POST /api/v1/game-design-specs/:id/revisions（带 sourceTrajectoryId 溯源）→ 回写 op=tuning_applied。**当前状态 = 待用户试玩。**

## 截图

- qa/smoke/smoke-mobile.png 本节点 preHook 冒烟复跑产物（横幅「进球！主队」+网窝+彩带+比分弹跳+常驻标签+单环同框，v14 构建面）
- qa/playtest/round11-live-controlled-ring.png 线上实局：受控球员单环随行（round-11 取证，本节点引用）
- qa/playtest/round11-live-shoot-press.png 线上实局：射门沿触发瞬间画面（round-11 取证，本节点引用）

## 改进点

（原 ③ 如实透出的缺口）

1. C4 判定器间 schema 漂移（平台级，见 ①）：交互可达性以原始 checks + 取证包 inputArrived 为证，不伪造 PASS。
2. 构建无 ?tuning=1 调参桥（kit 内如实声明；?tuning=1 打开即正常游戏，URL 未声明键按纪律忽略）。
3. spec levels=1：可玩面 = 90 秒 5v5 单局；spec v2 曾提的 level-2~5 关卡递进未实现（策划案 v3 未列为验收项，单关语义在 spec levels 声明）。
4. /health title 为共享壳硬编码标签（PvZ 名称残留），仅标签不影响页面与资产通道，留平台侧知悉。

## 改动

- 游戏源码零改动（本节点为验收记录轮）；qa/smoke 三件证据刷新 + playtest_kit/playtest_summary artifacts 回写

## 复玩对比

- 与 round-10~12 互证：v14 在服（commitHash=c8ed7aad=推送 HEAD），切环单实例/教学卡/常驻标签断言面在链；试玩打分待用户（打分卡 cmwc3b24p 已发未答）
