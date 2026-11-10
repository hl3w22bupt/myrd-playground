# round-3 — IP5 事件粒子爆点 + IP7 音频诊断契约 + 看台色带（门后死区）

- 本轮 URL：http://127.0.0.1:8137/index.html（本地伺服重建产物，终版 SRC_SHA=f530de90633c28c9，
  GAME-GATES 5/5 PASS；同轮内含一次看台微调：SRC c90f834b（宽檐白板取证 live-08）→ f530de90）
- 对照基准：round-2（同一固定动作序列、同一 seed）

## 观察

- **内核确定性绊线零漂移（第四轮验证）**：?smoke=8 score=240 goals=2 shots=3 collected=8
  timeLeft=82.0、?smoke=28 终局 score=340 goals=3/3 shots=4 collected=8 timeLeft=81.1 —— 与
  round-0/1/2 逐位一致（本轮改 scene.js 粒子池与看台 / main.js 事件挂钩 / audio.js 钩子，
  零内核触碰）。
- **IP7 修复见效（audio-unlock 契约）**：window.__audioDebug 实测两个状态 —— 解锁前
  {"created":false,"state":"none","bgmOn":false}、开球手势解锁后
  {"created":true,"state":"suspended","bgmOn":true}（headless 无音频设备，suspended 为该环境
  正常态；真机应报 running）。mobile-web-smoke 判定器要求的 function 契约满足。
- **IP5 部分取证（如实）**：粒子爆点已实现并在事件瞬间触发——经验包帧序列捕到收集爆点痕迹
  （burst-trace-0056.jpg：球员脚下淡蓝爆屑；burst-trace-0059.jpg：摇杆推进帧）；
  sessiond 单帧竞拍（live-07/08/09）未捕到爆点全貌 —— CDP 截图延迟 ~0.7-1s vs 粒子寿命
  0.45-0.9s，静态全貌捕获受限，如实记录（视频帧序列是完整证据通道）。
- **看台色带（新增，门后死区）**：scene.js buildArena 注释里的「看台色带」此前从未实现 ——
  本轮补上（四面低矮看台块，主色蓝体+白帽檐）。first-版宽檐白顶面在门前构图形成 ~18% 大片
  白板（live-08-burst-b.png 取证）→ 当轮微调为窄檐（深 2.2m）+ 降身高 3.2→2.8，复拍
  live-02-kickoff.png 顶部死区变干净。
- **手感读数（交互）**：固定序列终局于 live-04（胜利！3/3 · 315 分 · 剩 76s）；守门员对
  直线中路推进有真实拦截（live-09 前 kernel 实测 shots=15 saves=1 —— 自动射门每 0.9s 一发的
  连射被守门员相位拦截，进球需要横向空当或时机）——「难度偏易」的轮 2 结论修正为：
  「贪心横瞄的 autopilot 易、人类直线推进被扑救机制制衡」，仍不动平衡数值（无用户回填）。
- live-05 点按再次落在重开（终局后 gesture 语义），如实注记（同 round-2）。

## 动作

- 确定路段：navigate ?smoke=8 → wait 5000 → screenshot+probe；navigate ?smoke=28 → wait 5000
  → screenshot+probe（与轮 0/1/2 逐位可比）
- 交互段：navigate 直连页 → wait 1500 → screenshot → tap 320,650 → wait 600 → screenshot →
  swipe 60,650:60,430 ×2 → screenshot → swipe ×2 → screenshot → tap 320,650 → wait 800 →
  screenshot → wait 500 → screenshot → probe __footballProbe + __audioDebug
- 补充段（看台微调后重跑确定路段+live-01/02，终版 f530de90）；粒子竞拍段：3 swipes → tap →
  连拍 ×3（live-07/08/09）
- 经验包：pack.mjs --url 本地构建 --label polish-round3（8 步截图 + 185 帧 + consoleErrors=0）

## 截图

- qa/playtest/steps/round-3/det-smoke8.png
- qa/playtest/steps/round-3/det-smoke28.png
- qa/playtest/steps/round-3/live-01-title.png
- qa/playtest/steps/round-3/live-02-kickoff.png
- qa/playtest/steps/round-3/live-03-run-mid.png
- qa/playtest/steps/round-3/live-04-run-attack.png
- qa/playtest/steps/round-3/live-05-shot.png
- qa/playtest/steps/round-3/live-06-final.png
- qa/playtest/steps/round-3/live-08-burst-b.png
- qa/playtest/steps/round-3/burst-trace-0056.jpg

## 改进点

- IP5 进球/扑救/收集无画面爆点（粒子池：进球门区橙蓝双爆 / 扑救白闪 / 收集淡蓝屑）
- IP7 音频诊断契约缺位（window.__audioDebug）
- 新增：门后死区看台色带（buildArena 注释计划未实现项）+ 看台宽檐白板当轮自纠

## 改动

- src/render/scene.js：buildStands（四面看台块，窄檐白帽线）+ buildParticles/emitBurst/
  updateParticles 粒子池（48 sprite，加性混合，轻重力抛物线，render 侧时钟零内核回写）
- src/main.js：handleEvents 挂 emitBurst（goal 门区双色双爆 / save 白闪 / collect 球员脚下屑）；
  syncVisuals 步进 updateParticles；import GOAL_LINE
- src/render/audio.js：window.__audioDebug 只读诊断钩子（IP7，模块级挂载不依赖 unlock 先行）
- 当轮微调：看台白檐 7m 宽顶面 → 2.2m 窄檐、身高 3.2→2.8（live-08 白板取证驱动）
- 验证：GAME-GATES 5/5 PASS（两次重建均过）；?smoke 快照四轮逐位一致（零玩法回归）

## 复玩对比

- 比 round-2 更好，保留：正反馈三事件均有画面爆点；audio 契约可用；门后死区有看台结构
  （kickoff/门前构图对照 round-1 live-03）；粒子实现不触碰内核（快照绊线四轮零漂移）。
- 无回滚项。
