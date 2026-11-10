# 打磨轮收尾摘要（polish 节点 · 2026-11-11）

- run：cmwar74im003km9m2cwb92xkq ｜ 分支：myrd/game-3-goal-cmwaqvrng002lm9m2nftdd20h ｜ 收口 HEAD：见 qa/playtest-summary.json versionSha
- 试玩会话：sessiond 常驻 headless Chrome（mobile 仿真 390×844 DPR1.8），130 步，TTL 内显式 stop 回收
- 证据基线：轮 0（线上部署 @88b7469，与本地构建字节级一致）→ 轮 1/2/3（本地伺服 127.0.0.1:8137 重建产物）
- 试玩结论状态：**用户打分卡未回填**（playtest_cmwaqvrng002lm9m2nftdd20h 已发未回，无 GET 通道）——
  本轮全部改进点均为取证自查（见 qa/playtest/improvements.md，每条带证据出处），零「好玩」类人工结论

## 每轮对照表（改 → 玩 → 看）

| 轮 | 改进点 → 改动 | 复玩证据（截图路径） | 结论 |
|---|---|---|---|
| 0 | 基线取证（无改动） | qa/playtest/steps/round-0/{det-smoke8,det-smoke28,live-01..06}.png | ?smoke=28 终局读数与 qa/smoke/report.json 逐位一致（复现成立）；**新立 IP9**：上推摇杆×4 球员抵本方底线（live-04）——方向映射与相机倒置 |
| 1 | IP9 方向对齐相机（touch.js moveZ 取反 + main.js 键盘翻转）；IP1/IP2 相机重取景（CAM_AHEAD 2.7→8，俯角 84°→72°）；IP3 光晕收口（2.2→1.6） | qa/playtest/steps/round-1/live-02-kickoff.png（开球位球门+守门员入画、底部场外空带消除）、live-03-run-mid.png（球可辨+虚线居中） | 同一手势序列战果 5 分→215 分；?smoke 快照与轮 0 逐位一致（内核零回归） |
| 2 | IP4 金币立体化（竖立盘面+落点光斑+自转浮动）；IP6 title 文案拆两行；IP8 __footballProbe 只读探针 | qa/playtest/steps/round-2/live-02-kickoff.png（10 币全可辨）、live-01-title.png（孤字消失）、live-04-run-attack.png（提前破关 3/3 · 315 分） | 金币细条→圆盘可辨；probe 通道可用；快照三轮逐位一致 |
| 3 | IP5 事件粒子爆点（goal 门区橙蓝双爆 / save 白闪 / collect 淡蓝屑，48-sprite 池）；IP7 __audioDebug 诊断契约；看台色带（门后死区，首版宽檐白板当轮自纠窄檐） | qa/playtest/steps/round-3/live-02-kickoff.png（终版构图）、live-08-burst-b.png（白板取证）、burst-trace-0056.jpg（收集爆点痕迹） | audio 契约双态实测；快照四轮逐位一致；burst 静态全貌捕获受 CDP 延迟限制（如实留痕，视频帧序列为完整通道） |

## 内核确定性绊线（跨轮可比的锚）

?smoke=8（state=playing score=240 goals=2 shots=3 collected=8 timeLeft=82.0）与 ?smoke=28
（gameover score=340 goals=3/3 shots=4 collected=8 timeLeft=81.1）在轮 0/1/2/3 **逐位一致**
（qa/playtest/snapshots/round-{0,1,3}-smoke{8,28}.json）—— 三轮打磨全部落在表现层，零玩法回归。

## 视觉棘轮（advisory）逐条复核

报告：qa/visual-ratchet/report.json（scenario=polish-cmwaqvrng002lm9m2nftdd20h，before=round-0，
after=round-3，8 对同名配对，T1=0.7）。**SUSPECTED_REGRESSION(ADVISORY) ×4 逐条复核结论：
全部为刻意重设计，非意外退化**——

| 配对 | similarity | 解释 |
|---|---|---|
| det-smoke8.png | 0.5938 | 刻意：相机重取景（IP1/IP2）正是本轮目标——同一内核状态下构图从「空旷中场、门不可见」改为「门前特写」；内核快照逐位一致证明仅表现层变化 |
| det-smoke28.png | 0.6875 | 同上：进攻三区构图 + 看台入画，刻意重设计 |
| live-03-run-mid.png | 0.625 | 刻意：画面变化 = 方向修复后同一手势把球员带到了完全不同的位置（轮 0 在本方底线、轮 3 在进攻三区）+ 金币立体化 |
| live-04-run-attack.png | 0.5938 | 刻意：轮 0 该步在本方底线贴墙，轮 3 同步为「胜利!」终局屏（手势序列终于能打满对局）—— 状态本身不同，非同构对比 |
| live-01/02/05/06 | 0.7188-0.875 | comparable-pass，无需动作 |

## 门禁自检（收口时点全部实跑）

| 门禁 | 结果 | 关键读数 |
|---|---|---|
| GAME-GATES（tests/run-all.mjs） | PASS 5/5 | 构建复现 PASS（SRC_SHA=f530de90633c28c9）/ singlefile / kernel-determinism / state-machine / football-contract |
| PREFLIGHT（仓库内判定器） | PASS 0 WARN | — |
| BROWSER-SMOKE（正式 62s 双视口） | PASS | desktop fps 17.3 / mobile fps 14.8（改前 16.4/14.2，零回归）；exceptions=0；数值健康 score=340 timeLeft=81.1；drawCalls 71/74（改前 66，+8=金币光斑 sprite）；非纯色 16/19 种量化色 |
| MOBILE_SMOKE（mobile-web-smoke 对本地打磨版） | PASS | **audio-unlock PASS（IP7 落地）**；触摸管线/响应 PASS；fps 10（≥8）；consoleErrors=0；首跑 fps=6 判 FAIL 为本机负载干扰（sessiond 未停时复测），停会话复跑即恢复 |
| ASSET_TRIPLE_CHECK | PASS | 清单 7 项 programmatic，零位图入包 |
| VISUAL_RATCHET | SUSPECTED_REGRESSION(ADVISORY) | 4 条疑似全部解释为刻意重设计（见上表），advisory 不拦截 verdict |
| PLAYTEST_SUMMARY | **FAIL（1 项，模板级缺陷）** | 见下节 |

## PLAYTEST_SUMMARY FAIL 缺口归因（如实，不伪造证据）

- 唯一缺口：`[C4] qa/mobile/report.json 无 touch/input 类检查`。
- **根因 = 模板仓库两个预置判定器的 schema 漂移**：产出器 `mobile-web-smoke.mjs:89`
  `results.push({ id, label, status, detail })` vs 读数器 `playtest-summary.mjs` C4
  `.filter((c) => /touch|input|tap|joy|gesture/i.test(String(c.name ?? "")))` + `c.pass === true`
  —— 产出器从预置首版（28620b1）起就是 id/label/status 形状，读数器期望 name/pass 形状，
  两者永不匹配（历史版本穷尽：git log 全部提交同形状；webapp-smoke.mjs 同形状）。
  即：**任何游戏的合法产出都无法通过该 C4 读数**，与本游戏证据无关。
- 触摸可达性证据实际存在且 PASS：qa/mobile/report.json checks 含 touch-pipeline（pass）、
  touch-response（pass）、joystick-target（warn，未传 --project 的取证级警告）；C1/C2/C3/C5/C6/C7
  全部满足（rounds=4 / screenshots=34 / actions=13 / consoleErrors=0 / fps=10 / 时间窗一致）。
- 处置：两份脚本均为判定器，红线禁改（「打磨不许触碰：门禁判定脚本」）——本节点不改判定器、
  不手改 report.json/summary.json 凑 PASS；按异常纪律如实回写 op=playtest_summary
  （autoPassSuggested=false + reason 指向本节）。**待运维在模板仓库修复** playtest-summary.mjs
  C4 读数（读 `c.id ?? c.name` + `c.pass ?? (c.status === "pass")` 即可对齐产出器），
  修复后重跑 `node std-skills/threejs-game-dev/scripts/playtest-summary.mjs --game
  games/myrdplaygrou-3 --version-sha <HEAD>` 预期即 PASS。

## 数值通道与边界声明

- 唯一数值改动 = CAM_AHEAD 2.7→8（numeric.js 注释原文「手感类，需试玩校准」；平台 spec v1
  numeric 段未登记任何 CAM_* 键，亲查 GET /api/v1/game-design-specs/cmwarhr9y000zm9ri2yf159t2）。
- 玩法平衡数值（PLAYER_SPEED/KEEPER_*/GOALS_TO_WIN/ROUND_SECONDS/COIN_* 等）零改动：
  无用户试玩回填依据。观察到的「贪心横瞄 autopilot 易、人类直线推进被守门员扑救制衡」
  （live-09 前 kernel 实测 shots=15 saves=1）记为打分卡回填后的调参候选输入。
- 部署边界：线上仍为 @88b7469 旧版；打磨新版部署按知识库「部署身份链 403」纪律归宿主
  deploy_playable 执行（gitRef=myrd/game-3-goal-cmwaqvrng002lm9m2nftdd20h），节点不碰部署 API。
- 会话回收：sessiond 显式 stop（steps=130，Chrome/临时目录清理完成）；本地静态伺服收尾即停。
- session.json 生命周期注记：守护进程 stop 时按协议自清会话文件（首跑装配曾因此回退最早 mtime 口径），
  已从基线提交 99dbe77 恢复原文件（同一 startedAt=2026-11-10T17:20:28.305Z，非重构），重跑装配后
  playtest-summary.json 的 startedAt 即真实会话起点，C6 窗口核验通过。
