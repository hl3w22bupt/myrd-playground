# 《3D 切苹果》试玩验收包（playtest_kit）

- 游戏名：3D 切苹果（目标 cmuzmgo3y000gm9fyz4cd9en0）
- 试玩地址：https://leomac-studio.tail49399e.ts.net/apps/3d/
- 调参工作台：https://leomac-studio.tail49399e.ts.net/apps/3d/?tuning=1
- 依据：GameDesignSpec v1（cmuzn04d4000im9vim1akmc3h，approved）+ 实现说明（工程内无 .myrd/spec/design-spec.json，按实现说明写）
- 性质：本包只交付「怎么玩、看什么、怎么调」，**试玩结论必须由用户回填**，未回填前量表状态 = 待用户试玩。

## 0. 前置核对：移动端模拟门禁（preHook 证据）

`games/3d/qa/mobile/report.json` verdict=**PASS**，10/10 项 pass（2026-10-08T16:37Z 复验，部署 commit 6a0760c 之后）：
网络全通 / console 零错误 / canvas 挂载 / 首帧渲染（colorCount=16）/ 画面在动（idleDiff=400）/ 触摸派发（tap 1-0-1，swipe 2-8-2）/ 触摸响应（tapDiff=10）/ 音频解锁器 `__audioDebug` / 视口无溢出（390=390）/ FPS=28（swiftshader 软渲染口径，阈值 ≥8）。

判读说明：report.json 中 pass 项的 `detail` 字段是脚本预写的「失败话术模板」（`check()` 的 detail 参数在 PASS 时不打印但仍落盘），判读以 `status` + `metrics` 为准 —— 证据与 PASS 结论**不矛盾**，本节点为门禁背书成立。

## 1. 试玩指引（怎么玩 / 看什么）

### 怎么开始
手机或电脑浏览器打开 https://leomac-studio.tail49399e.ts.net/apps/3d/ ，引擎加载后直接开局（自动开始，无需点开始按钮）。

### 操作（对照 spec.meta.platform：Web H5，桌面鼠标 + 移动触摸）
| 设备 | 操作 |
|---|---|
| 触屏（推荐，手机 Safari） | 手指**按住滑动** = 刀痕轨迹，指哪切哪；切中炸弹立即终局 |
| 桌面鼠标 | **按住左键拖动**滑切；或方向键移刀 + 空格挥砍 |
| 结算画面 | 按任意键 / 点「再来一局」按钮 重开（街机惯例，切炸弹后不用干等） |

### 60 秒内会看到什么（对照 spec.levels[orchard-classic]）
- **开局 0.25s 内**：第一只苹果沿屏幕中线垂直上抛 —— 必切得到（开局正反馈设计）；每局**前 2 投必为苹果**，不会被炸弹开局打断。
- **三段递进节奏**：0-20s 约 1 只/1.5s → 20-40s 约 1 只/1.0s → 40-60s 约 1 只/0.7s，越到后面越密。
- **计分**（HUD 左上角实时刷新）：每切 1 苹果 +10；同一刀连切 2 只弹「连击 x2 +10」（该刀合计 +30）；连切 ≥3 只弹「Combo xN！+20」（三果合计 +50 起）。
- **炸弹**：约 15% 概率混入，外观与苹果不同（黑色引信球）；切中即「切中炸弹！对局结束」，不计负分。
- **终局结算**：总分 / 切中苹果数 / 最高单刀连击 / 漏接数 / 历史最高；破纪录显示「★ 新纪录！」（本地持久化，跨局保留）。
- **音频**：切果 / Combo / 炸弹 / 结算各有音效；首次触摸后解锁（iOS 手势策略）。

### 请重点留意（本节点核对出的观察项，不替你下结论）
1. spec acc-06 要求「倒计时最后 10 秒高亮」，当前实现 HUD 只显示「剩余 N 秒」文本、**未见高亮** —— 请确认是否影响紧张感。
2. 刀痕判定刻意偏宽容（minSwipe 12px、包络加宽），请感受「指哪切哪」是否成立、有无误切炸弹的委屈局。
3. 瞄准抛出（80% 朝屏幕中带）是否让「想切的苹果都够得着」、漏接是否令人挫败。

## 2. 结构化试玩量表（四问逐条 —— 待用户试玩回填）

| # | 问题 | 回填格式 | 状态 |
|---|---|---|---|
| ① | 首分钟能否看懂目标与操作？ | 是/否 + 卡点（哪里没看懂） | **待用户试玩** |
| ② | 结束时想不想再来一局？ | 1-5 分 + 原因 | **待用户试玩** |
| ③ | 手感与反馈（打击感/音效/画面响应）？ | 1-5 分（可拆三项） | **待用户试玩** |
| ④ | 节奏有没有明显断档或无聊段？ | 有/无 + 出现在第几秒 | **待用户试玩** |

> 回填方式：直接把四问答案 + 调参 URL 发回来即可。未回填前，第 3 步（spec 数值回写）不执行。

## 3. 调参工作台

- 入口：**https://leomac-studio.tail49399e.ts.net/apps/3d/?tuning=1**
- 打开后画面**右上角**出现「调参工作台（?tuning）」面板：13 个滑杆（键名/当前值实时显示），拖动**即时生效**，可边玩边调。
- 点「**复制调参 URL**」→ 生成带 `?tuning=<JSON>` 的完整链接（写入剪贴板，同时显示在面板上）→ 把它发回来就是一次完整的调参结果。
- 「关闭面板」随时收起；不带 `?tuning` 参数打开时面板零成本不出现。

可调键（GameState.TUNING_META 声明，URL 中未声明的键会被忽略）：

| 键 | 当前默认 | 范围/步长 | 含义 |
|---|---|---|---|
| round_seconds | 60 | 30-120 /5 | 单局时长 |
| apple_points | 10 | 5-50 /1 | 每苹果分值 |
| combo_bonus_pair | 10 | 0-40 /1 | 一刀两果加成 |
| combo_bonus_many | 20 | 0-60 /1 | 一刀三果+加成 |
| combo_window | 0.4 | 0.2-1.0 /0.05 | 「同一刀」判定窗口（秒） |
| bomb_ratio | 0.15 | 0-0.5 /0.01 | 炸弹占比 |
| spawn_interval_early | 1.5 | 0.4-3.0 /0.1 | 0-20s 抛射间隔 |
| spawn_interval_mid | 1.0 | 0.3-2.5 /0.1 | 20-40s 抛射间隔 |
| spawn_interval_late | 0.7 | 0.2-2.0 /0.1 | 40-60s 抛射间隔 |
| gravity | 12.0 | 5-30 /0.5 | 抛出物重力 |
| throw_speed_min | 13.5 | 9-20 /0.5 | 抛出初速下限 |
| throw_speed_max | 16.0 | 10-24 /0.5 | 抛出初速上限 |
| blade_speed | 26.0 | 4-40 /1 | 键盘/摇杆刀锋移速 |

## 4. spec ↔ 实现数值对照（供调参时对齐，如实记录差异）

| spec.numeric | spec 值 | 实现默认 | 判读 |
|---|---|---|---|
| session.durationSec | 60 | 60 | 一致 |
| scoring.appleValue / comboTwoBonus / comboThreePlusBonus | 10 / 10 / 20 | 10 / 10 / 20 | 一致 |
| bomb.probability | 0.15 | 0.15 | 一致 |
| thrower.phases 间隔 | 1.5 / 1.0 / 0.7 | 1.5 / 1.0 / 0.7 | 一致 |
| thrower.gravity | -13（向下矢量） | 12.0（幅值） | **幅值差 1**，手感以试玩为准 |
| thrower.launchSpeedMin/Max | 14 / 18 | 13.5 / 16.0 | **实现收窄初速带**（commit cf79dbb：配合 80% 瞄准中带，保证可达性） |
| combo「同一刀」语义 | pointerdown→up 连续轨迹 | 0.4s 时间窗近似 | 语义近似实现 |
| acc-06 最后 10 秒高亮 | 要求 | 未实现 | **差距**，留给用户试玩确认后走迭代回流 |
| meta.engine | Three.js + TypeScript | Godot 4（实际） | **spec meta 漂移**（实现为 Godot 4 Web 导出），数值口径不受影响 |
| acceptance[].check → tests/contract/*.test.mjs | 10 条挂载路径 | 仓库内不存在该目录 | 契约覆盖由 godot-smoke（smoke.gd 断言）+ playtest.sh（3 局 GODOT_PLAYTEST）替代，挂载路径未落地 |

> 本节点纪律：调参数值只经 `POST /api/v1/game-design-specs/cmuzn04d4000im9vim1akmc3h/revisions` 回写 spec.numeric（带 sourceTrajectoryId 溯源）→ `/approve` 拍板 → 下一轮按新 spec 重部署；不在本节点直接改代码默认值。

## 5. 试玩结论回填后会发生什么

1. 解析你的 `?tuning=<JSON>`，与当前 spec.numeric 逐键 diff（未声明键忽略并标注）；
2. diff 数值经 revisions API 写入 spec.numeric（产生 v2，sourceTrajectoryId=本轨迹）→ approve 拍板；
3. artifacts 追加 `op=tuning_applied` 产物记录拍板结论与数值 diff；
4. 下一轮工作流按新 spec 重部署。

**当前状态：量表四问全部「待用户试玩」，未收到用户结论前不执行任何 spec 回写。**
