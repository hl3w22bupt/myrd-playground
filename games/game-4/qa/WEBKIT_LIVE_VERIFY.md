# WebKit 真内核核验：?qa=1 自检 / ?tuning=1 量表 / 一键实测链接（game-4）

- 核验时间：2026-09-27
- 内核：**Playwright WebKit 26.6（pw_run webkit-2359，真 Safari/WebKit 内核，UA `…AppleWebKit/605.1.15 … Safari/605.1.15`）**，非 Chromium 模拟
- 对象：
  - 线上 v18（deploymentId `cmuisxou100ccm9l6wv2gpynx`，commit `65e9c30`）：<https://leomac-studio.tail49399e.ts.net/apps/game-4/gw?qa=1&tuning=1>
  - 修复后本地构建（本目录 `webkit_qa_live_check.mjs`，`QA_LIVE_URL` 可指向任意同构入口）
- 脚本：`qa/webkit_qa_live_check.mjs`（一条命令复跑；产物落 `qa/shots-webkit-verify/`）
- 机判锚点全部来自游戏自身输出：console `QA: …` / `Survey: …` / `GUANGLU_QA_REPORT <json>` /
  `GUANGLU_SURVEY <json>` / 全局 `window.__GUANGLU_SHARE__`（四级降级导出结果）——脚本不向页面注入任何代码。

## 一、结论（TL;DR）

| 项 | 线上 v18 | 修复后构建 |
|---|---|---|
| 一键链接可开、引擎可启动（iPhone 形态 390×844 DPR3） | ✅ | ✅ |
| `?qa=1` 自检激活、被动采样、报告 JSON 生成并导出（share/clipboard 通道 `state=done`） | ✅ | ✅ |
| `?qa=1`「自动扫描」目标枚举 | ❌ **0 个目标格**（缺陷 ①） | ✅ 23 个目标 / 24 样本 |
| 真实触屏点按管格 → 旋转（`?tuning=1` 下） | ❌ **点击被遮挡，旋转无效**（缺陷 ③） | ✅ moves=1，被动样本 `hit:true`，latency 37ms |
| `?tuning=1` 四问量表「可点选」 | ⚠️ 选项可点 | ✅ 7/7 必答可点选 |
| `?tuning=1` 四问量表「可提交」 | ❌ **提交按钮在引擎视口外，不可达**（缺陷 ②） | ✅ `GUANGLU_SURVEY` 7 项必答回传，通道 `share` |
| 页面错误 | 0 | 0 |
| wasm / pck 与仓库产物一致性 | ✅（pck 解码后 sha256 `f5f101f9…` 一致；wasm `fe5cebc5…` 一致） | — |

> 三个缺陷都出自 v17「QA 自检 + 四问量表内置化」这轮迭代，且都属于**只有真机/真浏览器才暴露**
> 的 UI/输入层缺陷——无头门禁（headless 不构建这套 UI、场景拓扑也不同）与既有 Chromium 冒烟
> （只用键盘、只看壳页标志）都测不到。本轮 WebKit 实测全部复现、定位并已修复（见 §三）。
> **修复已入库（部署线分支），待下一轮重导出重部署上线；上线前线上入口仍按 v18 行为如实告知。**

## 二、线上 v18 实测明细（修复前取证）

| # | 检查 | 结果 | 证据 |
|---|---|---|---|
| 1 | `GET /apps/game-4/gw?qa=1&tuning=1` | 200 text/html（14310B） | curl |
| 2 | `GET /api/public/assets/index.wasm` | 200 `application/wasm`（硬约束持续满足） | curl |
| 3 | pck 一致性 | 线上 `index.pck.gz.b64` → b64 解码 → gunzip = 2,609,264B，sha256 `f5f101f9…` = 仓内产物 | python 解码比对 |
| 4 | iPhone 形态（390×844，DPR3，hasTouch）引擎启动 | ✅ boot hidden，`QA: QA 自检已激活`，点按后 `AudioContext=running`，0 页面错误 | `shots-webkit-verify/webkit-iphone-390x844.png` |
| 5 | 启动屏徽标 / `__QA_MODE__` / `__SURVEY_MODE__` / 调参面板 `shown` | ✅ 「🛠 QA 真机自检模式 · 📋 试玩四问模式」 | 脚本断言 |
| 6 | 「生成报告」「分享/复制」按钮（QA 面板） | ✅ 点击即触发：`QA: 报告已生成（N 字节），导出通道：share` | 脚本断言 |
| 7 | 「自动扫描」 | ❌ `QA: 自动扫描开始：0 个目标格…`（缺陷 ①） | 脚本断言 + 截图 |
| 8 | 量表选项点选 | ✅（能/否、1–5 等按钮可点） | 截图 `webkit-b-survey-open.png` |
| 9 | 量表「提交并导出回传」 | ❌ 按钮位于引擎视口之外，任何滚动手段都不可达（缺陷 ②） | 截图对比 |
| 10 | 点按管格旋转 | ❌ 点击前后棋盘区域截图逐字节一致（缺陷 ③，`?tuning=1` 下） | 差分截图 `in-*.png` |

## 三、三个缺陷的根因与修复（已入库）

### 缺陷 ①：`?qa=1` 自动扫描恒报「0 个目标格」
- 位置：`scripts/qa_selftest.gd` `_resolve_board()`
- 根因：`candidate = main if main.get_node_or_null("Board") != null else …` —— 真实游戏场景
  `current_scene` 就是 Main 且必然有 Board 子节点，于是把 **Main 节点本身**赋给 candidate，
  `candidate as BoardView` 得 `null` → `run_auto_sweep()` 直接返回 0。
- 为什么门禁没拦住：无头冒烟的 current_scene 是 smoke 场景（没有直接 Board 子节点），走的是
  `find_child` 兜底分支 —— 被污染的分支恰好只有真实场景会走（**场景拓扑差异**）。
- 修复：显式取 `main.get_node_or_null("Board")`，取不到再 `find_child` 兜底。
- 连带修复：`_ready()` 时若解析失败，信号接线从未建立（样本 `routed/applied` 恒 -99，全 miss）
  → 新增 `_ensure_board_wiring()`，解析成功后幂等补接 `rotated` / `rotate_requested`。

### 缺陷 ②：四问量表「提交并导出回传」不可达
- 位置：`scripts/survey_panel.gd` `_build_ui()`
- 根因：`_panel.set_anchors_preset(PRESET_CENTER)` 只设锚点不清偏移，PanelContainer 在子控件
  装配后向右下生长 → 面板左上角钉在**视口中心**（640,360），底部（按钮行）落到引擎视口外
  （1280×720 设计分辨率 + `keep` 拉伸，任何 16:9 屏都一样）；ScrollContainer 写死 520 高，
  内容 ~880 高，而 WebKit 不支持 `mouse.wheel`、鼠标拖拽也不触发滚动 → 无任何可达路径。
- 修复：显示时 `_center_panel()`（`reset_size()` 后按最终尺寸居中 + 越界钳回）；
  ScrollContainer 高度自适应视口（`clampf(view_h - 200, 320, 520)`），按钮行始终在屏内。
- 实测：滚动条轨道点击翻页可达（本地修复构建中 `GUANGLU_SURVEY` 7 项必答成功回传）。

### 缺陷 ③（P0）：`?tuning=1` 一带入口，「点击旋转」就失效
- 位置：`scripts/survey_panel.gd` `_build_ui()` 的 `_root`（全屏 Control）
- 根因：`Control.mouse_filter` 默认 `STOP`，常显的全屏 `_root` 把所有鼠标/触屏点击吃进 GUI 层，
  `BoardView._unhandled_input` 永远收不到 → 点管格不转（键盘空格仍可转，因为按键不走鼠标命中）。
- 差分实验：`?qa=1`（无量表 UI）鼠标点击/触屏点按都正常旋转；加 `?tuning=1` 立即失效 —— 实锤。
- 为什么门禁没拦住：headless 不构建这套 UI（`WebBridge.is_web()` 为假），且既有冒烟的合成点击
  走 `Input.parse_input_event`（无头下不经同一套 GUI 命中路径）。
- 修复：`_root.mouse_filter = MOUSE_FILTER_IGNORE`（子控件遮罩 `STOP`、入口按钮不受影响，
  模态打开时的背景遮挡行为保持不变）。
- 修复后实测：`?qa=1&tuning=1` 触屏点按管格 → `moves=1`、被动样本 `hit:true`、`latency 37ms`。

## 四、修复后构建全量核验（WebKit，27/27 PASS）

```
WEBKIT_QA_LIVE_CHECK: PASS（27/27 项通过）
```

关键项（完整日志 `qa/webkit-live-check.log`）：

| 检查 | 结果 |
|---|---|
| A·iPhone 形态（390×844 DPR3）引擎启动 + 画布渲染 + 零页面错误 | PASS |
| B·自动扫描 `23 个目标格 → 24 个样本` | PASS |
| B·`GUANGLU_QA_REPORT` schema=`guanglu-qa-report/1`，样本 24、p95=52ms、含 verdict 机判 | PASS |
| B·导出通道 `__GUANGLU_SHARE__.state=done`（channel=share） | PASS |
| B·四问量表 7 项必答点选 + 提交 → `GUANGLU_SURVEY`，通道 `share` | PASS |
| B·回传载荷 7/7 必答键（q1_understood / q2_replay / q3_rotate / q3_beam / q3_sfx / q3_perf / q4_gap） | PASS |
| B·全程零页面错误 | PASS |

截图取证：`shots-webkit-verify/`（iPhone 形态、sweep、报告、量表填写、最终态 + `qa-report-live.json` / `survey-live.json`）。

## 五、复跑方式

```bash
# 1) 需要 Playwright WebKit（一次）：
#    npm i playwright && npx playwright install webkit
# 2) 复跑线上（或本地构建入口，用 QA_LIVE_URL 覆盖）：
cp games/game-4/qa/webkit_qa_live_check.mjs <playwright 目录>/ && \
cd <playwright 目录> && QA_LIVE_URL="https://leomac-studio.tail49399e.ts.net/apps/game-4/gw?qa=1&tuning=1" \
QA_OUT_DIR=/tmp/webkit-out node webkit_qa_live_check.mjs
# 退出码 0 = 全部通过；截图与报告 JSON 落在 $QA_OUT_DIR/shots-webkit-verify/
```

## 六、门禁与部署状态

- 四门禁（修复后复跑，同源判定脚本）：`PREFLIGHT: PASS`（13 类/79 文件）→
  `godot-smoke: PASS`（退出码 0）→ `GODOT_FUZZ: PASS`（seed=20260913）→
  `GODOT_PLAYTEST: PASS`（3 局 × 900 帧）。
- Web 重导出：`index.pck` 2,609,840B（含三处修复）；`index.wasm` sha256 `fe5cebc5…` 与线上 v18
  **逐字节一致**（本轮未动引擎，仅脚本入 pck）。
- **部署**：修复在部署线分支 `myrd/games-goal-cmuieqj7o0031m9gyf4pbwptg`，需按既有 iterate 流程
  重导出重部署后线上生效；上线后用 §五 脚本复跑即为上线验收。
