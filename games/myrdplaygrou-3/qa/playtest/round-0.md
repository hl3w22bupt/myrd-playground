# round-0 — 基线取证（无改动 · liveUrl=线上部署 @88b7469，与本地构建字节级一致）

- 会话：sessiond 常驻 headless Chrome（mobile 仿真 390×844 DPR1.8），session.json startedAt 见同目录
- 本轮 URL：https://leomac-studio.tail49399e.ts.net/apps/myrdplaygrou-3/（线上部署）

## 观察

- 确定性回放路：?smoke=8 内核快照 state=playing score=240 goals=2 shots=3 collected=8
  timeLeft=82.0；?smoke=28 终局 state=gameover score=340 goals=3 shots=4 collected=8
  timeLeft=81.1 —— 与 qa/smoke/report.json 终局读数逐位一致（同 seed 同 autopilot → 复现成立）。
- **发现高优先级操控缺陷（IP9，新立改进点）**：上推摇杆（swipe 60,650→60,430）×4 后球员跑到
  画面下方尽头的本方底线（live-04：贴白线、身下即场外），离对方球门更远 —— 触屏映射
  「屏幕上推 = -Z」（touch.js:13 注释自述）与相机几何（机位在玩家 -Z 侧、视线朝 +Z，
  画面上方 = +Z = 进攻方向）**倒置**；键盘 W/ArrowUp 同样映射 -Z，同病。
- IP1/IP2 画面信号复核：live-04/live-05 里射门白虚线（z=8）完全不在画内，射门提示
  「带球压过白虚线才能射门」引用了一条玩家看不见的线（live-05 底部提示可见、所指线不可见）；
  画面底部约 45% 为场外深绿（球员在本方底线时构图为全场最差）。
- IP3 复核：live-04/live-05 球员脚下蓝色光晕把带球球染进光斑，球体不可辨。
- 射门出界外反馈链路工作正常（live-05 hint 弹出）；HUD 徽章/暂停按钮布局正常，无横向溢出。

## 动作

- navigate liveUrl → wait 1500 → screenshot（live-01-title）
- tap 320,650（右半屏开球）→ wait 600（live-02-kickoff）
- swipe 60,650:60,430（上推摇杆）×2 → screenshot（live-03-run-mid）
- swipe 60,650:60,430 ×2 → screenshot（live-04-run-attack）
- tap 320,650（射门尝试）→ wait 800 → screenshot（live-05-shot / live-06-final）
- probe #hud innerText：进球 0/3 | 金币 ×1 | 得分 5 | 时间 69s
- 确定性回放：navigate ?smoke=8 → wait 5000 → probe document.title → screenshot（det-smoke8）；
  navigate ?smoke=28 → 同序列（det-smoke28）；快照落 qa/playtest/snapshots/round-0-smoke{8,28}.json

## 截图

- qa/playtest/steps/round-0/live-01-title.png
- qa/playtest/steps/round-0/live-02-kickoff.png
- qa/playtest/steps/round-0/live-03-run-mid.png
- qa/playtest/steps/round-0/live-04-run-attack.png
- qa/playtest/steps/round-0/live-05-shot.png
- qa/playtest/steps/round-0/live-06-final.png
- qa/playtest/steps/round-0/det-smoke8.png
- qa/playtest/steps/round-0/det-smoke28.png

## 改进点

- 本轮为基线取证轮：新立 IP9（移动/键盘方向与相机倒置，高优先级）；IP1/IP2/IP3 画面信号在
  交互路径下复核成立（见 improvements.md）。

## 改动

- 无（基线取证，零代码改动；HEAD=收口时点记录于 summary）。

## 复玩对比

- 不适用（本轮为基线；后续轮 1/2/3 以本轮 det-smoke8/det-smoke28 与 live 序列截图为对照基准）。
