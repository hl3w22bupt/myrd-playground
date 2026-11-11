# 线上终审记录：《实况足球》v3 终审 + v16 缺陷修复 + v18 复审全绿（final-review-v18，2026-11-11）

- 分支：`myrd/myrdplaygrou-3-goal-cmwaqvrng002lm9m2nftdd20h`；节点执行时 HEAD=b1972cc（推送 HEAD 与 v18 deployment commitHash 全等）
- 上游：策划案 v3（cmwburjse0011m9bb8t1mjuqn approved）+ 用户打分卡 r2（13:53Z 回填，Q1 看懂了/Q2 3 分/Q3 3 分/Q4 有一点）+ polish v16 收口
- 节点产物：games/myrdplaygrou-3/qa/playtest/round-18.md（观察/动作/截图/改动/复审读数/交接六段）

## ① 部署事实三项（回写后 GET 复核一致）

- HostedApp id = cmwaqvrnc002jm9m2nqwfsoie
- deployment id = **cmwc84ujy000vm9b2t7unrljk（version=18，status=running）**，commitHash=b1972cc0e98697726579dedba3b1cf3385f64364=推送 HEAD 全等，gitRef=myrd/myrdplaygrou-3-goal-cmwaqvrng002lm9m2nftdd20h，manifestPath=games/myrdplaygrou-3/apphost.toml
- liveUrl = https://leomac-studio.tail49399e.ts.net/apps/myrdplaygrou-3/ （GET 200，607,322B sha16=cb7ffe5a 与 dist/web/index.html 逐字节一致；/health 200）

## ② 四项机判结论（自动化口径；试玩结论不代填）

| 项 | 结论 | 关键证据 |
|---|---|---|
| ① 引导可见性（30s 内教学卡 + 常驻 HUD 标签，触屏+键盘两套说明） | **PASS** | v16/v18 新档即显教学卡（四操作卡+双输入行）；开赛三常驻标签可见；传球钮 64×64px≥44 |
| ② 抢断切换单环、无全队闪烁、无可感知卡顿 | **PASS** | 双局 233s 采样 ring 恒 1、cid 切换 1 次/局、帧间隙无尖峰（p95=50ms headless 口径）；?smoke ctlChg=15/场（≈0.17/s，IP-P1 保持）、instanceCount=1、drawCalls=85 恒定（池化）；switch-sim 5 种子 switchesMean 22.4 / maxHold 15.8s |
| ③ 进球/比分反馈与再来一局动机 | **PASS（v18 修复后）** | v16 终审发现结算屏永不显示缺陷（cmwc7thnm，high）→ hud.showScreen gameover→over 一行归一修复 → v18 线上实拍结算屏四要素 + 真实 tap 重开成功 + 第二局 chase 文案「上一局 0:0 —— 再来一局追上它！」+ payload overScreenVisibleAtGameover=true 双视口；缺陷已核销 closed |
| ④ 方向键方向回归（上轮缺陷不复发） | **PASS** | 双视口 inputProbe.ok=true（leftDx=-1.8/rightDx=+1.8/upDz=-1.39/downDz=+1.56）；触屏左推实测同向（cmwbl6h4h 零复发） |

## ③ 回写核验（GET→upsert→PATCH→GET）

- PATCH 前 GET：artifacts **42** 条（playtest_scorecard_r2 为尾）。
- upsert：hosted_app 条目（artifactId=cmwaqvrnc002jm9m2nqwfsoie）原位更新 detail（v16→v18 部署事实与终审读数，条目数不变）；追加 op=playtest_summary 增量条目 1 条（本轮机判摘要单行 JSON）。
- PATCH 后 GET：artifacts **43** 条（42 旧条目逐条在案无丢失 + 新增 1）；hosted_app 条目 detail 含 v18=cmwc84ujy000vm9b2t7unrljk/b1972cc/cb7ffe5a；playtest_summary 尾条 versionSha=b1972cc。

## ④ 纪律与注记

- 试玩结论纪律：四问结论只能来自用户，本轮未代填任何「好玩/不好玩」结论；goal 会话 @Admin 邀请已附「重点试三处」（结算屏与追赶目标 / 抢断切换闪烁卡顿残留 / 蓄力-进球反馈链）。
- push protection 判例：工作区 checkpoint 提交（25cc98a）携带本地 mcp 配置（VolcEngine Ark apiKey）被 GitHub 拦截 → 分支重写为 d1b1a41+单净提交（b1972cc），apiKey 源除名不入库；.wt-*/ 入 .gitignore 防工作树 gitlink 复发。
- 部署 POST 空响应但已受理（round-9 判例同款）：以轮询 running + GET 记录 + 线上字节核验为准。
