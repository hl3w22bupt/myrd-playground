# 《光路谜阵》真机自检（?qa=1）与四问量表内置化（?tuning=1 / 结算页）

> 上线版本：v17（deploymentId `cmuirsdyz00aom9l69tu1ts1v`，commit `5bb9554`，gitRef
> `myrd/games-goal-cmuieqj7o0031m9gyf4pbwptg`，2026-09-27）。
> 入口：<https://leomac-studio.tail49399e.ts.net/apps/game-4/?qa=1>
> 公网实测：8/8 项 PASS（`qa-live-check.log` + 截图 `qa-selftest-live.png`）。

## 一、真机自检模式（URL 加 `?qa=1`）

Godot Web 端用 `JavaScriptBridge` 解析 URL 参数激活（`scripts/web_bridge.gd` 读
`location.search`；壳页同步暴露 `window.__QA_MODE__` 供启动屏徽标与桌面取证）。
激活后（`scripts/qa_selftest.gd`）自动做四件事：

| 采集项 | 实现 | 报告字段 |
|---|---|---|
| 触屏命中 | 被动记录玩家真实点击 + 「自动扫描」合成点击 sweep，逐样本核对「点击坐标 → 路由格 → 是否按预期旋转」（BoardView 新增 `rotated` 信号作应用锚点；点击坐标改用事件自带坐标 `make_input_local`，触屏点按位 ≠ 悬停位不再路由错格） | `touch.summary{samples,hits,misses,hit_rate}` + `touch.rows[]` |
| 旋转响应时延 | 点击事件到达引擎 → 旋转应用后下一渲染帧（含帧开销），mean/p50/p95/max | `rotation_latency.stats` + 预算 120ms |
| 音效播放状态 | 壳页 `__audioDebug()`（AudioContext state / worklet 装载数 / 状态变迁日志）+ 引擎侧驱动/混音率/输出设备/SFX_BANK | `audio.audio_context_state` 等（`running`=出声；`suspended`=待手势解锁，点一下屏幕即恢复） |
| 设备信息 | UA / DPR / 屏幕/视口 / 触摸点数 / 语言 / 并发核数 / 时区 | `device.*` + `engine.*` |

一键 JSON 实测报告：「生成报告」构建紧凑 JSON（schema `guanglu-qa-report/1`，含逐样本明细、
统计量、`verdict{touch_hit_ok, rotation_latency_ok, audio_running, pass}` 与四问量表快照），
「分享/复制」走四级降级导出（`scripts/web_bridge.gd`）：
**iOS 系统分享 `navigator.share` → `navigator.clipboard` → `execCommand('copy')` → Blob 下载**；
报告同时投浏览器控制台（`GUANGLU_QA_REPORT` 标签）。异步导出结果经壳页全局
`window.__GUANGLU_SHARE__` 轮询回报到面板。

判定口径（机判，无主观项）：管格目标 = 路由到位且真的旋转；非管格（空格/墙）=
路由到位且正确地**不**旋转；其余记 miss。`verdict.pass = 命中率达标 ∧ p95 ≤ 120ms ∧ 音频可出声`。

文本过桥一律 base64（JSON 直插 JS 源码有 U+2028/引号坑）；回传一律 JSON 字符串
（JavaScriptBridge 布尔回传会被数值化 —— 调参面板线实测教训，见 git `0f57a73`）。

## 二、四问量表内置化（?tuning=1 及通关结算页）

`qa/PLAYTEST_KIT.md §五` 的四问全部改为游戏内点选（`scripts/survey_panel.gd`）：

1. **① 首分钟能否看懂目标与操作**（能/否 + 卡点 + 出现秒数）
2. **② 结束时想不想再来一局**（1-5 + 原因）
3. **③ 手感与反馈四维**（旋转手感 / 光束点亮 / 音效 / 画面响应，各 1-5）
4. **④ 节奏有没有明显断档**（无/有 + 位置 + 表现）

入口两处：URL 带 `?tuning=1` 浮出「📋 试玩四问」入口按钮（与调参工作台共存 ——
不弹模态、不遮挡右上角滑杆）；通关结算后同样浮出。点开为模态面板，逐问点选/填空，
**逐答即时落盘** `user://guanglu_survey.cfg`（独立于进度存档，版本 `SURVEY_VERSION=1`，
键面 `GameState.SURVEY_KEYS` 单一事实源，未声明键拒绝写入）。

「提交并导出回传」：必答校验（`survey_missing_required`）→ 盖章元数据（时刻/关卡/进度快照）
→ 走与 QA 报告同一条四级降级导出通道（JSON schema `guanglu-survey/1`，控制台标签
`GUANGLU_SURVEY`）。「仅导出 JSON」可先看载荷不盖章。

## 三、门禁与公网证据

- 冒烟新增 12/13 断言面（`tests/smoke.gd` 第三阶段）：QA 合成点击 sweep 全命中、
  时延样本闭合且 p95 ≤ 预算、报告键面与 JSON 可解析；四问作答/未声明键拒绝/持久化
  roundtrip/必答校验/导出载荷/面板开合状态机 —— 自检与量表本身也被门禁机判。
- 四门禁全绿（HEAD `5bb9554`）：PREFLIGHT（13 类/71 文件）→ GODOT_SMOKE（240 帧）→
  GODOT_FUZZ（seed=20260913）→ GODOT_PLAYTEST（3 种子×900 帧，METRICS 与既有基线一致）。
- 公网实测（无头 Chromium + 软件 WebGL，`qa/qa_live_check.mjs` 可复跑）：
  `?qa=1&tuning=1` 下 `__QA_MODE__=true`、`__SURVEY_MODE__=true`、调参面板
  `__GAME_TUNING_PANEL__='shown'`、启动屏徽标双模式、画布渲染推进、触屏点击零页面错误、
  `__audioDebug().state='running'` —— 8/8 PASS（`qa-live-check.log`、截图 `qa-selftest-live.png`）。

## 三·补、断言有效性负例探针（2026-09-27 收口轮实测，HEAD `676dfbe`）

按技能包纪律「断言要拦得住各自声称要拦的缺陷」，对两组新断言面各注入一枚缺陷探针，
冒烟均以清晰签名 FAIL（exit 1），还原后复绿（exit 0）——「拦得住、不误报」两头实测：

| 探针 | 注入缺陷（模拟真实故障） | 冒烟签名（实测） | 还原后 |
|---|---|---|---|
| A · QA 命中判定 | `qa_selftest.gd` 样本闭合处 `hit` 恒置 `false`（坐标映射错位类缺陷） | `GODOT_SMOKE: FAIL QA 命中断言：6/6 个合成点击未按预期命中（坐标映射错位）` + `命中率 0.000 低于预算 1.00`，exit 1 | `GODOT_SMOKE: PASS`，exit 0 |
| B · 四问持久化 | `game_state.gd load_survey()` 读盘后提前 `return`（存档丢失类缺陷） | `GODOT_SMOKE: FAIL 四问断言：持久化 roundtrip 后作答 0 项 != 7 项（存档丢失）`，exit 1 | `GODOT_SMOKE: PASS`，exit 0 |

两探针均为临时注入、当场还原（工作区无残留，`git status` 干净），探针代码不入库。

## 四、复跑方式

```bash
# 公网 QA 模式实测（无头浏览器，需 playwright）
node games/game-4/qa/qa_live_check.mjs
# 本地四门禁（同源判定器，见仓库 std-skills/godot-game-dev/scripts/）
bash games/game-4/verify.sh
```
