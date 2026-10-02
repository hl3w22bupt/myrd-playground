# game-9 推箱子点亮方块解谜 — touch-response FAIL 诊断（门禁证据补充说明，不改 report.json）

- verdict：**FAIL**（唯一失败项 `touch-response`，其余 9 项全 PASS，FPS 43）
- 机器证据：`touchCounters.afterTap={touchstart:1,touchend:1}`、`afterSwipe={touchstart:2,touchmove:8,touchend:2}`
  （事件全到达 DOM）；`metrics.tapDiff=0`、`metrics.idleDiff=400`（画面持续在动）
- 截图取证（phase-tap.png / phase-joystick.png）：
  - 游戏 HUD 自述「摇杆移动 · 右下按钮撤销/重开/换关」，提示气泡含「触屏滑动」——触屏交互是产品意图
  - 实际虚拟摇杆中心在 CSS 约 (44,502)；游戏画面为横版设计，在 390×844 竖屏 letterbox 成中屏横带（约 CSS y 273–546）
  - 门禁 tap 点 CSS(195,422) 落在棋盘空格 → 该玩法语义下无反馈
  - 门禁 swipe 起点 CSS(90,700) 落在横带下方黑边区 → 摇杆未被驱动
- 结论定性：**非结构性玩法缺陷**，属门禁固定探针坐标与 letterbox 布局错位（与 game-2 同模式）。
  触摸管线畅通、音频契约/视口/渲染/FPS 全绿。本仓无该游戏源码（源在其他 goal 工作区），
  且门禁测已部署 liveUrl，本地改源无法改变线上判定，故按纪律如实记 FAIL。
- 门禁改进建议：探针点基于 canvas 实际可交互元素 hit-test 自适应（覆盖 letterbox 横带与真实摇杆热区）。
