# game-4 光路谜阵 — touch-response FAIL 诊断（门禁证据补充说明，不改 report.json）

- verdict：**FAIL**（唯一失败项 `touch-response`，其余 9 项全 PASS，FPS 44）
- 机器证据：`report.json` → `touchCounters.afterTap = {touchstart:1, touchend:1}`（事件已到达 DOM），
  `metrics.tapDiff = 0`，`metrics.idleDiff = 399`（画面本身在动，光束/动画持续）
- 截图取证（phase-tap.png）：
  - 游戏为横版棋盘设计，在 390×844 竖屏视口内 letterbox 成中屏横带（棋盘约 CSS y 355–506）
  - 门禁 tap 点 = 屏幕正中 CSS(195,422)，落在棋盘**空格子**上；本玩法是「点击镜子所在格移动」，
    点空格无任何视觉反馈 → tapDiff=0 与玩法语义一致，而非输入管线损坏
  - 门禁 swipe 点 = CSS(90,700)，位于棋盘横带**之外**（黑边区域），无法驱动棋盘交互
- 结论定性：**非结构性玩法缺陷**，属「门禁固定探针坐标 vs letterbox 棋盘」的探针落点错位。
  触摸管线（touch-pipeline）已证畅通，音频解锁契约、视口、FPS 均健康。
  是否真实可触玩需在真实交互点位（镜子格子）复核——本仓无该游戏源码（源在其他 goal 工作区），
  且门禁测的是已部署 liveUrl，本地改源无法改变线上判定，故按纪律如实记 FAIL。
- 门禁改进建议（mobile-web-smoke v2）：探针点应基于 canvas 内实际可交互元素 hit-test 自适应，
  而非固定屏幕中心/固定摇杆坐标（本条同样解释 game-2 的 touch-response FAIL）。
