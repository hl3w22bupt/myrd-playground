# 试玩收尾摘要：《实况足球》GOAL RUSH v3（缺陷修复 + 新手引导 + 打磨项，round-10/11/12，2026-11-11）

- 分支：`myrd/myrdplaygrou-3-goal-cmwaqvrng002lm9m2nftdd20h`；收尾 HEAD=**d76b72a**（v10 部署 commitHash=c906e96f 全等；取证提交与代码提交分离）
- 上游事实源：策划案 v3（**cmwburjse0011m9bb8t1mjuqn**，approved，parent=v2）+ 两张缺陷单（cmwbumwrj000qm9bb4s5v0lm6 抢断闪烁卡顿 / cmwbumwtv000sm9bbmm3zs0kc 传球切换无可发现性）；仓内镜像 `games/myrdplaygrou-3/.myrd/spec/design-spec.json`（v3Delta 三项 + 19 条验收）
- 历史链：round-1~9（v2 周期）摘要见 git 历史（8b37984/c8146ba 两轮收口）；本轮为 v3 周期三轮「改→玩→看」

## v3 改进点 → 改动 → 结论对照表

| 项 | 玩家可感问题（缺陷单/打磨项出处） | 改动（提交） | 结论（线上机判/取证） |
|---|---|---|---|
| BUG-1 抢断切换全队闪烁+卡顿 | cmwbumwrj000qm9bb4s5v0lm6（high）：抢断自动切换时全队高亮逐个闪 + 掉帧 | 上轮 checkpoint 立骨架（selection-ring.js 全场唯一池化环：构建期一次性建 mesh/材质，单次脉冲 0.15s+0.35s、失权 0.25s 渐出、easeOutCubic），本轮 c906e96 修复 checkpoint 遗留缺口并过门禁 | 线上实局切换 15 次环数恒 1（sessiond 探针）；smoke 双视口 instanceCount=1（acc-switch-single-highlight）；补回的 hud.flashBanner 消除了 goal 事件 TypeError（冒烟 timeout 根因） |
| BUG-2 传球/切换无可发现性 | cmwbumwtv000sm9bbmm3zs0kc（high）：开局一分钟看不懂怎么玩 | 教学卡（四操作图示+开始/跳过+localStorage 已读标记）+ HUD 常驻标签（移动/传球/射门+键位角标）+ 首次持球/被抢断一次性气泡（每档案 1 次） | 线上取证包 probe：tutorialVisible=true/ops=4/双按钮在场 → playing 三标签 visible=true/tutorialSeenMarked=true；气泡文案在链（「被抢断啦——即将自动切换…」） |
| 打磨-进球反馈 | v3 gameFeel：庆祝 ≥1s+倒计时暂停+比分弹跳+特写机位 | 内核 celebrationLeft 冻结窗（1.2s，球/人/倒计时全停）+ 彩带慢动作 0.3× + FOV 冲击 + 特写机位 2.2s + score-pop 1.6×/0.4s 队色高亮 | 冒烟截图四要素同框（qa/smoke/smoke-mobile.png）；契约断言终局 celebrationLeft 归零（football-contract） |
| 打磨-再来一局动机 | v3 replayHooks：主按钮一键重赛 ≤2s + 追赶目标 | 结算屏「再来一局」主按钮 + restart 捕获 lastScore 作追赶目标 + 败局针对性改进提示 | 线上 DOM 在场（rematchBtn=true）；重开契约 5 连点全复位（state-machine） |
| 打磨-手感音效 | v3 gameFeel：蓄力升调/60ms hit-stop/切换确认音/BGM duck 30% | chargeTone 220→880Hz 线性、shoot 后 60ms 表现层冻结、switchConfirm 高频正弦与抢断低通噪声异频段、duckBgm 只压 BGM 增益 | 数值镜像 numeric.js v3 块 + smoke payload 正常（exceptions=0）；听感待用户人工试玩打分卡 |

## 轮次索引（qa/playtest/round-N.md，机器可解析段协议齐全）

- round-10（c906e96→d76b72a 证据）：v10 部署上线 + 线上引导/切环取证（pack 14 步三 probe）· 截图 3
- round-11（d76b72a 证据）：sessiond 实局交互 12 步（跳过开局/摇杆/射门/切换 15 次单环恒定）· 截图 2
- round-12（d76b72a 证据）：收尾门禁复跑 + 线上一致性 + 部署核验 · 截图 3

## 收尾门禁与证据

- 构建：SRC_SHA=d9e8dca0a0ec8e18 单文件 606,863B ×2（index.html = landing.html，STAGE PASS 逐字节一致）
- tests/run-all：7/7 PASS（含 smoke-payload 新增 v3 断言面：切换单环/教学卡/常驻标签/庆祝冻结/再来一局）
- preflight：PASS（21 项 0 WARN）
- browser-smoke（双视口）：PASS——desktop fps=12.4 / mobile fps=13.2（headless 软渲染口径 ≥10），exceptions=0，非纯色 52/38 色，drawCalls 135/178
- asset-triple-check：PASS（清单 7 项全 programmatic，0 位图入包；goal-net-texture 回补登记）
- 部署：v10=cmwc10na3000qm9bh18cu3lvp（POST → 504 受理 → running，commitHash=c906e96f=推送 HEAD 全等；首发 cmwc1029w clone exit 128 失败如实留痕，重发即成）；线上 GET / 200=606,863B 与 dist/web/index.html 逐字节一致（cmp）；/health 200
- 线上 mobile-web-smoke：PASS（10 PASS + 1 WARN=摇杆热区 --project 读 Godot 字段，three.js 工程按设计无 → 合法降级仅取证，与 v9 同形态）
- playtest-summary：rounds=12 screenshots=37 consoleErrors=0 fps=17 versionSha=d76b72a2；**valid=false 唯一缺口 C4**（平台级判定器间 schema 漂移：mobile-web-smoke.mjs 写 checks={id,label,status,detail}、playtest-summary.mjs 读 c.name/c.pass → touch/input 过滤落空；两判定器红线禁改，原始证据在档 qa/mobile/report.json touch-pipeline=pass/touch-response=pass + 取证包 probe inputArrived 全 true）
- visual-ratchet（advisory）：**OK**——v9→v10 线上移动配对 1 对 0 回归（摇杆态相似度 0.7188 ≥ T1=0.7）；初始画面未配对 = v3 教学卡首屏刻意重设计（MAPPING.md 在档）

## 如实透出的缺口

1. playtest-summary C4 恒 FAIL（平台级 schema 漂移，两判定器红线禁改）——op=playtest_summary 回写 autoPassSuggested=false + 完整归因（与 round-9 收口同源）。
2. 实局进球庆祝线上实拍未捕获（sessiond 两脚射门未进球）；庆祝链以确定性冒烟 ?smoke 双视口取证（四要素同框）+ 内核契约断言（celebrationLeft 冻结/归零）为准。
3. 手感音效（蓄力升调音高曲线、hit-stop 力度感、BGM 压低听感）属人工试玩量表，机判面只锚数值与代码位，待用户打分卡回填（requestKey=playtest_cmwaqvrng002lm9m2nftdd20h 已发未答，不重发不代答）。
4. 平台 spec v3 levels 2~5 关卡递进维持 round-5 既有披露：本轮可玩面=90s 5v5 单局 level-1 语义 + v3 引导/切环/打磨层；关卡递进属后续迭代面。
