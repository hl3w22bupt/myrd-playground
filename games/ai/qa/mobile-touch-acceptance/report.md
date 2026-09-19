# 《我被ai女友包围了》移动端触屏仿真验收报告

- **验收日期**：2026-09-19
- **验收对象（上线产物三要素）**：
  - HostedApp id：`cmtoavt8p0006m9y6kzy2u14w`（slug=ai，status=ready）
  - deployment id：`cmu836iw00027m9x5uv3snds0`（v11，gitRef=`myrd/games-goal-cmtoavt8w0008m9y6kclb4s19@1f97f2a`，版本 `2.2.0-touch-viewport`）
  - liveUrl：https://leomac-studio.tail49399e.ts.net/apps/ai/
- **验收方式**：Playwright Chromium headless（`--enable-unsafe-swiftshader` 提供 WebGL2 软渲染）+ 移动设备仿真 —— 触屏 UA、`hasTouch`、DPR 3（iPhone 13，390×664 主流程）/ DPR 2.625（Pixel 7，412×839 冒烟），全部触摸经 CDP `Input.dispatchTouchEvent` 原生触摸事件序列下发（点按 / 拖拽 / 长按）。
- **结果总览**：**28 项检查 26 项通过**。liveUrl 在移动端仿真环境下**可玩**：启动 → 画面点按推进 → 选项点选结算 → 行动段摇杆拖动驱动玩家位移 全链路打通，全程 console 零 error。存在 2 项确证移动端体验缺陷（P1 热区 / P1 视觉遮挡，见下），不阻断「可玩」结论，建议下轮迭代修复。

## 一、检查项明细（28 项）

| # | 检查项 | 结果 | 实测 |
|---|---|---|---|
| A1 | 移动端 UA 可加载且引擎启动 | ✅ | 首屏 1520ms（iPhone）/ 1303ms（Pixel） |
| A2 | viewport meta 禁缩放（user-scalable=no） | ✅ | `width=device-width, user-scalable=no, initial-scale=1.0` |
| A3 | body overflow hidden（无页面滚动） | ✅ | overflow=hidden |
| A4 | touch-action:none 禁浏览器手势接管 | ✅ | body=none（canvas 未显式声明，靠祖先链生效 → P3 建议） |
| A5 | 文档高度不超视口（无回弹空间） | ✅ | scrollH=664 = innerH |
| A6 | **选项触控热区 ≥44×44 CSS pt** | ❌ | **14.7 CSS pt**（44 视口px × 0.333），详见 P1-1 |
| B1 | 编程滚动无页面滚动 | ✅ | scrollTo→y=0 |
| B2 | 长按无系统菜单/文字选中 | ✅ | contextmenu=0，selection=""（900ms 长按） |
| B3 | 双击不触发缩放/滚动 | ✅ | vvScale=1，innerW 不变 |
| C1 | 首次触摸前无自动播放报错 | ✅ | consoleErrors=0 |
| C2 | 首次触摸后音频上下文解锁 running | ✅ | created=1，finalState=running（仿真局限见 §五） |
| D1 | 画面内点按从标题启动一局 | ✅ | 全屏 diff=0.901 |
| D2 | 点按推进响应 ≤100ms | ✅ | **14ms**（rAF 帧级实测，对话面板首个变化帧） |
| D3 | 点按推进剧情至选择节点 | ✅ | 6 次点按走完 act1 前置 6 节点（与剧情图一致） |
| D4 | 选择节点空白点按不误触结算 | ✅ | diff=0.0000（防误触设计生效） |
| D5 | 点选选项可结算并推进 | ✅ | diff=0.108 |
| E1 | 行动段虚拟摇杆出现 | ✅ | 左下角环亮像素 10182（证据 s04b_joystick_crop.png） |
| E2 | 摇杆可拖动（knob 跟手） | ✅ | knobChangeRatio=0.75 |
| E3 | 摇杆拖动驱动玩家实际位移 | ✅ | A/B：拖拽期 0.030 vs 静置期 0.019；目视位移 ~335 视口px/1.4s ≈ 240px/s，与 `spec.numeric.move_speed=240` 吻合（e3crop_*.png） |
| E3b | 拖拽中不误触推进 | ✅ | dlgChangeRatio=0.00（GUI 吞触摸修复回归通过） |
| E4 | 拖拽手势不引发页面滚动 | ✅ | scrollY=0 |
| F1 | 帧率 ≥30fps | ✅ | **47.1fps**（SwiftShader 软渲染下实测） |
| G1 | 横屏后画布铺满、摇杆仍锚定左下 | ✅ | canvas=664×390，joyRingPx=10182 |
| G2 | 回竖屏画布恢复 | ✅ | canvas=390×664 |
| G3 | **DOM 提示条不遮挡对话面板/选项** | ❌ | 重叠 3200px²，选项 2/3 文字被盖住，详见 P1-2 |
| H1 | 全程 console 无 error | ✅ | errors=[] |
| P1 | Android 冒烟：可启动并点按推进 | ✅ | diff=0.182 |
| P2 | Android 冒烟 console 无 error | ✅ | errors=0 |

## 二、确证缺陷（本轮移动端仿真发现，建议下轮迭代修复）

### P1-1 触控热区与 UI 尺寸按物理像素渲染，DPR 换算在 Web 导出下失效 ❌
- **现象**：DPR 3 的 iPhone 仿真下，选项按钮热区实测/推算 **14.7 CSS pt**（要求 ≥44 CSS pt），选项字号约 7.3 CSS pt，对话面板约 107×37 CSS pt，摇杆底环渲染直径 37.7 CSS px —— 全部只有设计值的 1/3。
- **代码根因**（部署源码 `games/ai/scripts/main.gd` `_min_option_height()`）：换算用
  `scale = min(window_size / viewport_rect.size)`，而 Web 导出（canvasResizePolicy=2 + DPR）下
  `DisplayServer.window_get_size()` 与 `get_viewport_rect().size` **同为画布物理像素**（本项目实测均为 1170×1992），
  scale 恒为 1，`min_touch_px=44` 落成 44 物理px。桌面 DPR=1 时恰好看不出差异，真机 DPR≥2 即暴露。
- **修复方向**：换算比应改用 `1 / 浏览器 devicePixelRatio`（经 JavaScript 桥传入或 `DisplayServer.screen_get_dpi` 不可用于 web，
  建议在壳层 `index.html` 把 `window.devicePixelRatio` 注入引擎自定义参数），或改用 Godot `stretch/scale` 内容缩放方案；
  修复应保持「改表不改码」口径 —— 换算因子可落入 `data/spec/touch.json`。
- **证据**：results.json `optionHotzoneCssComputed`；截图 `s02_choice_bottom_crop.png`（选项文字肉眼难辨）。

### P1-2 DOM 提示条遮挡选项 2/3 与对话文本 ❌
- **现象**：壳层 `index.html` 的 `#hint` 提示条（195×65 CSS @ bottom，pointer-events:none）在移动端换行成 3 行，
  与 Godot 对话面板（底边中心 320×110 视口px）及选项列表重叠 3200px² —— **选项 2/3 的文字被提示条完全盖住**
  （功能上 pointer-events:none 仍可点选，但用户看不见自己选的是什么，误选风险高）。
- **证据**：`s02_choice_bottom_crop.png`（可见「2. 稳硬驱赶…」「3. 假装不在家…」被盖住）、results.json `hintOverlapDialogPx`。
- **修复方向**：移动端（`maxTouchPoints>1` 或窄视口）隐藏 `#hint` 或把对话面板/选项列上移让位；提示条改触屏文案（见 P2-2）。

### P2 行动段可玩区域只占竖屏左上角（体验断裂，不阻断可玩）⚠️
- 640×360 世界坐标固定铺在视口左上：竖屏下玩家/信物/危机集中在**顶部 18%**（实测占比 0.547×0.181），
  其余 82% 为空白灰底；摇杆却锚定在屏幕底部 —— 视线与操作距离横跨整屏。
- **修复方向**：为移动竖屏给玩法相机居中/缩放（camera zoom 或把世界映射到可视区中心），属 gameplay 层迭代。
- 证据：`s04_arena.png`、results.json `playfieldExtent`。

### P3 与真机复核项 ⚠️
1. `#canvas` 未显式声明 `touch-action:none`（当前靠 body 祖先链生效；旧版 iOS Safari 对 touch-action 继承支持不稳），建议壳层 CSS 补一行。
2. `#hint` 文案仍为键鼠导向（「WASD/方向键 移动 · 空格/回车 对话推进 · 1-4 剧情选项」），触屏设备应切换为触屏语义文案（游戏内推进提示已是「点按画面 继续 ▼」，仅壳层未跟随）。
3. 音频手势门控：headless 仿真不强制 autoplay policy（AudioContext 创建即 running），**iOS Safari 的「首次触摸解锁」需真机复核**；机制层面（无报错、上下文可运行、无自动播放告警）已验证。

## 三、移动端性能与加载基线（回填《AI女友剧情生存玩法设计基线》§七-3）

| 指标 | iPhone 13 仿真（DPR3） | Pixel 7 仿真（DPR2.625） | 说明 |
|---|---|---|---|
| 首屏耗时（导航→引擎启动完成） | 1520ms | 1303ms | 含 10.6MB 资产下载 + wasm 编译，本地 tail003 网段 |
| 资产传输量 | 10636.7KB | — | index.js 82.8KB + index.wasm.gz.b64 7844.1KB + index.pck.gz.b64 2709.8KB |
| 帧率（行动段 rAF 采样） | 47.1fps | — | SwiftShader 软渲染环境，真机 GPU 只会更好 |
| 点按推进响应 | 14ms | — | rAF 帧级精度，≤100ms 要求富余量大 |
| /health | 200 | 200 | `{"ok":true,"version":"2.2.0-touch-viewport","assets":5}` |
| console | 0 error | 0 error | 全程 |

> 注：基线为**仿真环境实测**（非真机），绝对值供回归对比；真机（尤其 iOS Safari）数值建议在具备条件时复核后覆盖本表。

## 四、结论

- **liveUrl 在移动端浏览器可玩：是**。核心触控链路（点按启动 / 点按推进 ≤100ms / 选项点选结算 / 摇杆拖动驱动玩家 / 横竖屏切换 / 无缩放·滚动·长按冲突 / 音频上下文解锁 / console 干净）全部验证通过（26/28）。
- 上线产物三要素确认有效：HostedApp `cmtoavt8p0006m9y6kzy2u14w` + deployment `cmu836iw00027m9x5uv3snds0`（v11，`2.2.0-touch-viewport`）+ liveUrl `https://leomac-studio.tail49399e.ts.net/apps/ai/`，已回写目标 artifacts。
- 遗留：P1-1（热区 DPR 换算失效）与 P1-2（提示条遮挡选项）建议作为下一轮移动端迭代 entry；P3-3 音频解锁建议真机复核。

## 五、复现方式

```bash
cd games/ai/qa/mobile-touch-acceptance
node qa_mobile_touch.mjs          # 全量（iPhone 13 主流程 + Pixel 7 冒烟）
QA_FAST=1 node qa_mobile_touch.mjs # 只跑 iPhone 主流程
```
- 依赖：全局 playwright ≥1.58（Chromium），启动参数 `--enable-unsafe-swiftshader`（headless WebGL2 必须）。
- 产物：`results.json`（机器可读结果 + 指标）、`shots/*.png`（逐项证据截图）、`debug_boot.mjs`/`debug_input.mjs`（启动/输入探针工具）。

