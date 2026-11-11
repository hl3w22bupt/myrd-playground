# 试玩收尾摘要：《实况足球》GOAL RUSH v3 打磨周期（round-14~17：切换抖振稳定化/客队出手通道/冒烟证据面，2026-11-11）

- 分支：`myrd/myrdplaygrou-3-goal-cmwaqvrng002lm9m2nftdd20h`；收尾 HEAD=**94a6648**；**现役部署 v16=cmwc5dhrd0031m9bh58t9v2s1**（running @ 94a6648=推送 HEAD 全等；线上 607,064B 与 dist/web/index.html 逐字节一致，sha16=97adfc85）
- 上游事实源：策划案 v3（**cmwburjse0011m9bb8t1mjuqn**，approved）+ 缺陷单 cmwbumwrj/cmwbumwtv（v10 已 closed）；v14 前链路见 git 历史（round-1~13，311443a 收口）
- 本周期性质：polish 节点三轮「改→玩→看」，全部改动绑定具名改进点、判定脚本与 .myrd/routines.yaml 零触碰

## 具名改进点 → 改动 → 结论对照表

| 项 | 玩家可感问题（出处） | 改动（提交） | 结论（机判/取证） |
|---|---|---|---|
| IP-P1 切换抖振稳定化 | 抢断/争抢时控制权走马灯：线上 v14 实局 switchCount=82/44.4s（≈1.85 次/s，round-14 r14b 探针）——缺陷单 cmwbumwrj 修掉「全队闪烁」后残留的频率抖振后半段 | world.js 受控人切换三分支化：持球离散事件（契约不变）+ ball.cooldown 飞行窗冻结 + 最近重算加迟滞（复用 CONTROL_RADIUS，零新增数值，不触碰 spec.numeric）（c27629b） | 线上同序列同窗 82/44.4s → 19/40.6s（v15，-75%）/ 36/42.9s（v16 复测，方差带内）；内核模拟 maxHoldSecMean 11.2→15.8s（+37%）、firstShotSec 13.6→9.8s；契约 +5 用例（飞行窗冻结/迟滞保持/迟滞正向对照/守卫/接球契约不变） |
| IP-P3 客队出手通道 | 客队 5 种子全集对局 0 射门 0 进球（46:0，switch-sim 逐队事件统计）——AWAY_SHOT_RANGE_Z=8 声明的出手通道被「贴身门槛 1.8m」结构性堵死（chaser 恒距 0.4m），防守/GK 半场沦为摆设 | world.js 小禁区（closeRange）起脚门槛 distPress>1.2 → >0.5（远射 1.8 门槛保留；AI 决策阈值属实现层，AWAY_SHOT_RANGE_Z 语义不变）（c27629b） | 契约双断言：小禁区未贴脸（0.8m）起脚 ✓；贴脸远射（0.35m 非小禁区）不起脚 ✓（平缓难度保留）；全集模拟客队射门 0→1（autopilot 掌球权下进禁区本就少，线上长持球场景才显影） |
| IP-P5 冒烟证据面代表性 | v15 部署后 ?smoke=69 取证面 0:0/2 射门（旧版有进球横幅）——IP-P1 稳定化让「逐帧抢切换」不再喂养 1Hz autopilot（对照实验：旧内核同语义 10 射门 1 球 vs 新内核 2 射门 0 球） | main.js 冒烟快进意图粒度 1s→0.1s（游戏侧协议参数，零内核/零门禁改动）（799d06e） | v16 线上 ?smoke=69 恢复进球庆祝在链（goals=2，块末 celebrationLeft=0.38s 可见）；真人 60Hz 意图面不受影响（10Hz 模拟 9 球/22 射门 ≈ 旧 60Hz 口径） |
| round-11 遗留缺口② 实局进球庆祝线上实拍未捕获 | 线上进球反馈链（横幅/特写/彩带/弹跳）无实拍证据（summary.md v3 收口如实透出） | 证据轮（无源码改动） | **v16 线上实拍达成**：qa/playtest/steps/r17-002-live-v16-goal-celebration.png 横幅+特写机位网窝+彩带+比分弹跳四要素同框 |
| IP-P4 中场胶水僵局（登记不动） | 双方全队塌向球（round-14/16 截图）——归因 SUPPORT_OFFSET/盯人间距，spec.numeric 域 | 未动（调参走 spec 修订通道，待用户打分卡回填一并裁决） | 登记：qa/playtest/round-14.md 改进点节 |

## 轮次索引（qa/playtest/round-N.md，机器可解析段协议齐全）

- round-14（基线发现轮）：线上 v14 SEQ-P 基线 + switch-sim 仪器建立 · 截图 3（r14b-*）
- round-15（改→玩→看 ①）：IP-P1+IP-P3 修复 + 契约 8 用例 + 本地复玩 · 截图 2（r16-*，r15 截图 tmp 回收失误如实记录）
- round-16（改→玩→看 ②）：v15 部署 + 线上验证 + 冒烟回归发现与归因 · 截图 2（r16b-*）
- round-17（改→玩→看 ③）：IP-P5 修复 + v16 部署 + 线上进球实拍收口 · 截图 4（r17-*/r17b-*）

## 收尾门禁与证据（全部本节点实跑）

- 构建：SRC_SHA=8fc3299ab842d470，单文件 607,064B ×2（verify-reproducible 两次逐字节一致 + stage-dist PASS）
- tests/run-all：**7/7 PASS**（构建复现/controls-direction/football-contract 含 8 新用例/kernel-determinism/singlefile/smoke-payload/state-machine）
- preflight：PASS（0 WARN）；asset-triple-check：PASS（清单 7 项全 programmatic）
- browser-smoke（双视口）：PASS——desktop 14.4 / mobile 13.3（headless SwiftShader ≥10），exceptions=0，非纯色；payload：score=1:0、switchRing.instanceCount=1、onboarding 断言面在链
- 部署：v15=cmwc4zm8z002tm9bhray3nnyo → v16=cmwc5dhrd0031m9bh58t9v2s1 running @ 94a6648（均单笔受理核对；manifestPath=games/myrdplaygrou-3/apphost.toml 判例姿势；504 受理形态）
- 线上：GET / 200=607,064B 与 dist 逐字节一致；mobile-web-smoke **PASS**（网络/渲染/触摸/音频契约/视口/FPS）；/health 200（title=共享壳硬编码标签，已知平台形态）
- playtest-summary：rounds=17 / screenshots=50 / actions=86 / consoleErrors=0 / fps=16 / versionSha=94a6648；**FAIL 唯一缺口=C4**（平台级判定器间 schema 漂移：mobile-web-smoke.mjs 写 checks={id,label,status}、playtest-summary.mjs 读 c.name/c.pass → 过滤落空；两判定器红线禁改，与 round-9/12/13 收口同源亲验。原始可达性证据在档：qa/mobile/report.json touch-pipeline=pass / touch-response=pass + 取证包 inputArrived 全 true + SEQ-P 每步 inputArrived=true）
- visual-ratchet（advisory）：**OK**——polish-cycle-v14-to-v16 同序列步配对 2 对 0 回归（sim 0.8438/0.75 ≥ T1=0.7）
- 环境事故留痕：宿主 jetsam per-process-limit 杀 headless Chrome renderer 致 3 次 CDP 会话中断（会话重启续跑，无证据伪造）；首轮/本地复玩截图 tmp 回收失误 2 处（round-14/15 如实记录，基线以线上复跑 r14b 重建）

## 如实透出的缺口

1. playtest-summary C4 恒 FAIL（平台级 schema 漂移，两判定器红线禁改）——op=playtest_summary 回写按 ADVISORY 第一阶段口径如实归因。
2. IP-P4 中场胶水（SUPPORT_OFFSET 类 AI 间距/数值域）登记未动——spec 修订通道候选，待用户打分卡回填一并裁决，不擅自调 spec.numeric。
3. 实局「人类通道进球」：burst 触摸驱动（每步 ~400ms 触地+截图开销，占空比 ~50%）未复现进球；机制可达性以确定性内核模拟（autopilot 9.2 球/场）+ 线上 smoke 进球实拍为证；连续摇杆手感待用户真机试玩打分卡（cmwc3b24p 已发未答，不重发不代答）。
4. spec levels=1 维持 round-13 既有披露：可玩面=90s 5v5 单局；关卡递进属后续迭代面。
