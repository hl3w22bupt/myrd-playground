# round-2 — IP4 金币立体化 + IP6 title 文案 + IP8 内核探针钩子

- 本轮 URL：http://127.0.0.1:8137/index.html（本地伺服重建产物，SRC_SHA=bbf28c16ed9bf098，
  GAME-GATES 5/5 PASS）
- 对照基准：round-1（同一固定动作序列、同一 seed）

## 观察

- **内核确定性绊线零漂移（第三轮验证）**：?smoke=8 score=240 goals=2 shots=3 collected=8
  timeLeft=82.0、?smoke=28 终局 score=340 goals=3/3 shots=4 collected=8 timeLeft=81.1 —— 与
  round-0/round-1 逐位一致（本轮改 scene.js 金币装配 / main.js 同步与探针钩子 /
  index.template.html 文案，零内核触碰）。
- **IP4 修复见效**：金币由「细橙条」变为带落点光斑的竖立圆盘（live-02 开球位全景：10 枚金币
  全部可辨、光斑锚定地面位置；自转+浮动在 live-02→live-03 帧差中可见）。
- **IP6 修复见效**：title 说明拆两行短句（live-01：带球压过白虚线射门 · 进 3 球提前获胜 /
  金币捡到即补 · 永不枯竭），孤字换行消失；title 屏背景即整场构图（球门在上、金币散布），
  目标可读性比 round-0 的空场背景显著更好。
- **IP8 修复见效**：window.__footballProbe() 返回只读内核快照（live probe 实测：
  {"state":"playing","score":0,...,"player":{"x":0,"z":-4,...},"ball":{"state":"dribble"},"keeperX":0.96}），
  sessiond probe 通道从「只能读 ?smoke 载荷」升级为「任意时刻可取内核快照」。
- **交互序列打满终局**：同一手势序列本轮在 live-04 即触发「胜利！提前破关 · 进球 3/3 · 金币 3 ·
  得分 315」（剩 77s）—— 直线推进 + 自动射门（AUTO_SHOOT_Z 兜底）即可破关，休闲收集定位下
  难度偏易；**平衡数值不动**（无用户试玩回填依据，见 improvements.md 数值通道声明），
  记为下一轮带数据调参的候选输入。
- 序列语义注记（如实）：live-05 的右半屏点按落在终局屏「再来一局」上触发重开（live-05/live-06
  为重开后 kickoff 帧，probe score=0 timeLeft=89s 佐证）—— 固定动作序列与对局时序存在 CDP
  抖动，跨轮对比以 ?smoke 确定性快照为准、live 序列看手感，两路分工在 round-0 已声明。

## 动作

- 与 round-0/1 完全一致：navigate ?smoke=8 → wait 5000 → screenshot+probe；
  navigate ?smoke=28 → wait 5000 → screenshot+probe；navigate 直连页 → wait 1500 →
  screenshot → tap 320,650 → wait 600 → screenshot → swipe 60,650:60,430 ×2 → screenshot →
  swipe ×2 → screenshot → tap 320,650 → wait 800 → screenshot → probe __footballProbe()

## 截图

- qa/playtest/steps/round-2/det-smoke8.png
- qa/playtest/steps/round-2/det-smoke28.png
- qa/playtest/steps/round-2/live-01-title.png
- qa/playtest/steps/round-2/live-02-kickoff.png
- qa/playtest/steps/round-2/live-03-run-mid.png
- qa/playtest/steps/round-2/live-04-run-attack.png
- qa/playtest/steps/round-2/live-05-shot.png
- qa/playtest/steps/round-2/live-06-final.png

## 改进点

- IP4 金币辨识度弱/收集无视觉反馈（细条→竖立圆盘+落点光斑+自转浮动）
- IP6 title 说明行孤字换行（拆两行短句）
- IP8 内核状态不可观测（__footballProbe 只读探针）

## 改动

- src/render/scene.js：buildCoins 重构 —— 组节点（竖立盘面 rotation.z=π/2 + 落点光斑 sprite），
  userData.id 迁到组节点
- src/main.js：syncVisuals 金币段改组节点驱动（x/z 跟内核、y 浮动与自转用表现层 coinClock，
  纯装饰不回写内核）；新增 window.__footballProbe 只读快照钩子（IP8）
- index.template.html：title 说明行拆两行（IP6）
- 验证：GAME-GATES 5/5 PASS；?smoke 快照与轮 0/1 逐位一致（零玩法回归）

## 复玩对比

- 比 round-1 更好，保留：金币可辨度（细条→圆盘+光斑，live-02 全景对照 round-1 同机位）、
  title 排版（孤字消失）、内核可观测（probe 通道可用）。
- 无回滚项。
