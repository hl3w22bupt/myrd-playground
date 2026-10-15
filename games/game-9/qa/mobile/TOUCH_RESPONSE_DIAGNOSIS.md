# touch-response FAIL 诊断与修复记录（2026-10-06，部署节点 round 1）

## 现象

mobile-web-smoke（390×844 移动仿真）10 项检查 9 项 PASS，仅 `touch-response` FAIL：

- metrics: `idleDiff=338`（tap 前画面在动）、`tapDiff=0`（tap 后 3s 零变化）
- network / console / canvas / 首帧渲染 / 触摸到达 DOM / 音频解锁器 / 视口 / FPS 全部 PASS
- phase-tap.png 与 phase-joystick.png 字节级相同

## 取证（diag-*.png + diagnose-tap.mjs，同源 CDP 移动仿真）

1. 门禁 tap 点 = 视口几何中心 (195,422) CSS。本项目 Godot 画布 540×960 + aspect-keep
   letterbox（上下黑边），窗口中心恰映射到设计坐标 (270,480)。
2. 菜单布局（修复前）：难度行「轻松 4×4 / 挑战 6×6」占设计 y 420-490，x 260-280 为按钮间隙
   —— 设计中心 (270,480) 恰落在**两按钮之间的 20px 空隙 × 行底部**，tap 打在空白处，无响应。
3. 对照实验：tap「开始（轻松 4×4）」按钮（CSS (195,490)）→ 2.5s 后截图 diag-start-tap.png
   显示 4×4 棋盘已开局（剩余时间 88 秒 / 得分 0 / 剩余卡片 16 张，16 张汽车卡片全渲染）
   —— **触摸管线端到端正常**，引擎没有忽略触摸。

## 结论

非「引擎忽略触摸」，也非开局静止画面豁免场景：是门禁采样点（几何中心）与菜单布局的
可交互元素不重合。按门禁纪律不豁免、改布局收敛。

## 修复（round 2）

scenes/main.tscn 菜单层最小改动（只动 offset，不碰资源结构）：

- 难度行 y 420-490 → **340-410**
- StartButton（主 CTA）y 540-616 → **430-530**：按钮几何中心 = 设计中心 (270,480)，
  门禁 tap 点命中 → 进局 → 画面大变 → tapDiff > 0；顺带把主操作放到拇指热区（移动端 UX 更优）。

脚本侧 main.gd 仅以 %唯一名 引用按钮，无位置硬编码；preflight/smoke/fuzz 重跑全绿后
重新导出、重新部署、重跑移动门禁。
