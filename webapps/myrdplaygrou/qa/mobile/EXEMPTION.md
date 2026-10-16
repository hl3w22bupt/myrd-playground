# EXEMPTION —— mobile-web-smoke 四项游戏向判定对《今日汇率》不适用说明

> 依据门禁脚本预留机制（mobile-web-smoke.mjs L440：「touch-response 判 FAIL 但游戏确为开局静止画面时：
> 在本目录放 EXEMPTION.md 说明依据，产物 detail 注明——不得无据豁免」）。
> 本应用是**非游戏 DOM 工具应用**（无 canvas / 无主循环 / 无音频），四项判定逐条说明如下。
> 等价证据全部在 `acceptance-report.json`（15/15 PASS）与本目录截图。

| 门禁判定项 | 判定口径 | 不适用依据 | 等价 DOM 向证据（acceptance-report.json） |
|---|---|---|---|
| canvas 存在 | 游戏/引擎产物以 canvas 挂载为启动标志 | 本应用是纯 DOM 应用（web-app-dev 技能「静态优先」规范），界面为 HTML/CSS/SVG，**设计上无 canvas** | `首帧截图非纯色 PASS`（门禁自身项）+ `qa-07-mobile-390.png` 完整渲染 |
| 画面在动（1.5s 帧差） | 游戏主循环持续重绘 → 像素帧差 > 0 | 工具应用静止 UI，无 rAF 主循环；画面变化只发生在交互时 | `trend-7d/trend-30d PASS`：切换区间后 SVG 数据点 6→23 重绘 |
| 触摸后画面有响应（帧差口径） | tap 后看 canvas 像素帧差 | DOM 应用的响应体现在 DOM 状态而非全屏像素 | `swap-button PASS`（tap 后币对互换）、`trend-30d PASS`（tap 后 23 点重绘）、`localStorage-persist PASS`（输入后留存）；门禁自身项 `触摸事件到达 DOM PASS` |
| 音频手势解锁器（window.__audioDebug） | 移动端音频需手势解锁层 | 本应用**无任何音效**，不存在音频静默风险 | 不适用，无等价项 |

## 结论

mobile-web-smoke 11 项中：**7 项 PASS**（网络全通 / console 零错误 / 首帧非纯色 / 触摸到达 DOM / 无横向溢出 / FPS 达标 / ——均为 Web 应用核心可用性指标），**4 项游戏向判定不适用**（如上，非应用缺陷）。机器结论如实记录为「7 PASS + 4 豁免」，不伪造全绿。

复测轮次记录：r1 网络项 FAIL（相对引用 404）→ 修复（base 锚定 + 资产路由）→ r2 起网络项 PASS；r2 后 4 项游戏向判定持续为「不适用豁免」。r1 证据留档 `report-r1-network404.json`。r3（2026-10-16 13:55）webapp-smoke（std-skills/web-app-dev/scripts/webapp-smoke.mjs，web 口径）对线上 v11 复测：退出码 0，WEBAPP_SMOKE: PASS（网络/console/首屏内容/触摸管线/视口 7 项全过，触控响应为静态页提示性 warn）——该口径本就不含 canvas/帧差/音频游戏向判定，无需豁免；canonical `report.json` 自 r3 起为该 PASS 报告，r2 游戏向报告留档 `report-r2-gamescript.json`（截图 gs-phase-*.png）。
