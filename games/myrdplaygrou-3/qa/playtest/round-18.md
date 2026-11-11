# round-18 · v3 线上终审（v16 基线机判 → 缺陷修复 → v18 复审全绿）—— 指派「试玩验收」节点

> 上游：策划案 v3（cmwburjse0011m9bb8t1mjuqn approved）+ 用户打分卡 r2（artifact playtest_scorecard_r2，2026-11-11T13:53Z 回填）+ polish v16（94a6648）。
> 本轮 = v16 线上终审四项机判（①引导可见性 ②抢断切换单环无闪烁卡顿 ③进球/比分反馈与再来一局动机 ④方向键回归）+ artifacts 回写。
> **试玩结论纪律：本文件只有机判与自动化证据；好不好玩的结论只能来自用户，未代填任何试玩结论。**

## 观察（v16 基线机判，修复前线上实锚）

- 线上 v16 = cmwc5dhrd0031m9bh58t9v2s1（94a6648）：live 607,064B sha16=97adfc85 与 dist 逐字节一致、/health 200。
- **①引导可见性 PASS**：新档（localStorage 无 gr-tutorial-seen-v3）加载即见教学卡「怎么玩 · 30 秒上手」，四卡齐全（移动/传球/射门/切换，缺陷单 cmwbumwtv 两项可发现性均覆盖），键盘行「键盘：WASD / 方向键移动…」与触屏行「触屏：左半屏摇杆移动…」双说明在卡；开赛后常驻 HUD 三标签全部可见（移动 WASD/摇杆 · 传球 X · 射门 空格 蓄力），传球钮热区 64×64px（≥44px）。截图 r18-v16-tutorial-card-mobile.png / r18-v16-hud-labels-live.png。
- **②切换稳定化保持 PASS**：v16 线上 131s 全场采样（switch-series-v16-live.json，1Hz，132 样本）——cid 切换仅 1 次（hold 13s→118s），ring 实例恒 1，帧间隙 p95=67ms/max=100ms（headless 节流基线内，无尖峰）；switch-sim 5 种子全集 switchesMean=22.4 / maxHoldSecMean=15.8（v14 缺陷时代同窗 82 次≈1.85次/s 已收敛一个量级）。
- **④方向回归 PASS（机判锚）**：线上 v16 触屏左推实测（同球员 id=4 num=5，x 5.3→4.1，z 不变）方向正确；canonical 锚=线上构建 ?smoke inputProbe（leftDx=-1.8/rightDx=+1.8/upDz=-1.39/downDz=+1.56，ok=true）。
- **③终审发现缺陷 FAIL（已修复）**：v16 两局线上实证——90s 打满 state=gameover 后 **#screen-over 保持 `screen hidden`（display:none）**，结算屏（胜负标题/终场比分/改进提示/上一局追赶目标文案）与「再来一局」主按钮**对玩家永不显示**；rAF 持续出帧（2s 窗 gap 序列 1893→1940）排除暂停假象；setOver 文本已填充（over-chase「上一局 0:0 —— 再来一局追上它！」在 DOM 不可见）。根因=hud.showScreen 屏键表 [title/tutorial/paused/over] 无 gameover 键，main.js:290 把内核终态名原样传入（v3 实现面 c906e96 即存在，v14/v16 均带）；既有门禁盲区=smoke 只断 rematchButtonPresent（DOM 存在非可见）且默认 62s 快进打不满全场。**缺陷单 cmwc7thnm004vm9bhbvcuhfmn（severity=high）已录入并闭环**。

## 动作

- v16 基线：experience-harness sessiond 线上会话（mobile 390×844 新档）四步机判 + 页内只读采样器（1Hz __tsState + rAF gap + MutationObserver）+ rematch 下一局全程采样。
- 修复：hud.js showScreen 终态名归一（gameover→over，一行语义修复零内核改动）+ payload 自检字段 onboarding.overScreenVisibleAtGameover（终局态必须 true）+ smoke-payload 契约新增断言 + 快进内核口径 controlledChanges（与渲染侧 switchCount 任一≥1；打满全场时采样落 gameover 态环失权停更，渲染侧漏计）。
- 门禁全绿后重部署：git push（d1b1a41..b1972cc，分支重写剔除工作区 checkpoint 误入库的本地 mcp 配置 apiKey——GitHub push protection 拦截项源除名）→ POST deployments（sourceId=cmwaqvrng002lm9m2nftdd20h goal 绑定、gitRef=本分支、manifestPath=games/myrdplaygrou-3/apphost.toml）→ 网关空响应但已受理判例形态（round-9 同款）→ 轮询 running。
- v18 复审（cmwc84ujy000vm9b2t7unrljk，version=18，commitHash=b1972cc=推送 HEAD 全等，线上 607,322B sha16=cb7ffe5a 与 dist 逐字节一致，/health 200）：mobile 新档全流程（教学卡→开赛→HUD 标签→终局→**结算屏可见实拍**→真实 tap 再来一局按钮 195,507→state=playing 88.9s 重开成功→第二局终局 chase 文案在显）+ 双视口 ?smoke=105 线上 payload + 双局 233s 采样。
- 缺陷核销：PATCH /bugs/status?id=cmwc7thnm004vm9bhbvcuhfmn（id 在 query，body 只放 status+closeReason）→ closed，证据链在案。

## 复审读数（v18 线上）

- **① PASS**：新档教学卡即显（四操作卡 + 双输入说明行）；开赛三常驻标签全可见；传球钮 64×64px。
- **② PASS**：双局 233s 采样 ring 恒 1；cid 切换仅 1 次/局（hold 74s/159s）；帧间隙 p50=p95=50ms/max=150ms（headless 节流口径，无尖峰）；线上 ?smoke=105 双视口 ctlChg=15（≈0.17/s，IP-P1 保持）、switchRing.instanceCount=1、drawCalls=85 恒定（池化零新建=无全队闪烁的渲染面证据）。
- **③ PASS（修复后）**：终局结算屏可见（MutationObserver 实锚 class hidden 摘除 + r18-v18-gameover-screen-visible.png 实拍「平局/全场 0:0/改进提示/再来一局」四要素）；再来一局按钮真实 tap 重开成功；第二局终局「上一局 0:0 —— 再来一局追上它！」追赶目标在显；线上 payload overScreenVisibleAtGameover=true（双视口）。
- **④ PASS**：双视口 inputProbe.ok=true（leftDx=-1.8/rightDx=+1.8/upDz=-1.39/downDz=+1.56）——上轮左右反向缺陷（cmwbl6h4h）零复发；触屏左推实测同向。
- 线上 payload 双视口：goals=3/shots=6/possChg=139/exceptions=0；fps 口径=专项门禁跑 BROWSER-SMOKE PASS 11.5/12.9（≥10），线上会话旁跑读数 8.7 系双 Chrome 并行负载噪声（证据注记，非门禁口径）。
- 门禁（判定器=仓库 std-skills 副本未改写）：GAME-GATES 7/7（smoke-payload 契约含新增两条断言）/ PREFLIGHT 0 WARN / ASSET_TRIPLE_CHECK PASS / STAGE PASS（dist/web=607,322B 与 index.html 逐字节一致）/ BROWSER-SMOKE 双视口 PASS。

## 截图

- qa/playtest/steps/r18-v16-tutorial-card-mobile.png（v16 基线：教学卡）
- qa/playtest/steps/r18-v16-hud-labels-live.png（v16 基线：常驻 HUD 标签）
- qa/playtest/steps/r18-v16-play-ring.png（v16 基线：受控单环实拍）
- qa/playtest/steps/r18-v18-tutorial-card-mobile.png（v18 复审：教学卡）
- qa/playtest/steps/r18-v18-gameover-screen-visible.png（**v18 复审：终局结算屏可见实拍——本轮修复的直观证据**）

## 改动（本轮源码改动全部绑定具名缺陷/断言，判定器与 .myrd/routines.yaml 零触碰）

- src/render/hud.js：showScreen 内核终态名归一（gameover→over）——缺陷 cmwc7thnm 的修复本体。
- src/main.js：payload.onboarding.overScreenVisibleAtGameover 自检字段 + 快进 controlledChanges 内核口径计数（smoke 协议面，零内核改动）。
- tests/smoke-payload.contract.mjs：+2 断言（overScreenVisibleAtGameover 字段在链；state=gameover → 必须 true；controlledChanges 与 switchCount 任一≥1）。
- 卫生：.wt-*/ 入仓库 .gitignore（.wt-polish-r5 误入 gitlink 移除——多节点工作树不入库）。

## 状态与交接

- **自动化终审 = 全绿（v18 在服）**；四问结论只能来自用户——打分卡不代填，邀请已发 goal 会话（@Admin），重点试三处：Ⓐ 终局结算屏与「再来一局」追赶目标（本轮新修）Ⓑ 抢断/争抢时切换是否还有闪烁或卡顿感（上轮 Q4 残留信号的复核点）Ⓒ 射门蓄力→进球庆祝→比分弹跳的反馈链手感（上轮 Q3/Q2 打磨项）。
- artifacts 回写：op=playtest_summary 增量条目（GET→upsert→PATCH→GET 核对条目数/版本号，见本轮黑板记录）。
