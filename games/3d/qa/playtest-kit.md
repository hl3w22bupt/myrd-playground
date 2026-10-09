# 《3D 切水果》试玩验收包 v2（playtest_kit）—— 多水果 spec v2 轮

- 游戏名：3D 切水果（目标 cmuzmgo3y000gm9fyz4cd9en0，分支 myrd/game-3d-goal-cmuzmgo3y000gm9fyz4cd9en0）
- 试玩地址：https://leomac-studio.tail49399e.ts.net/apps/3d/
- 调参工作台：https://leomac-studio.tail49399e.ts.net/apps/3d/?tuning=1
- 依据：GameDesignSpec **v2**（cmv0matif000rm9aaxjtgi2ug，approved，六果阵容 + 3D 视觉品质标准）+ 实现说明（工程内无 .myrd/spec/design-spec.json，按实现说明写）
- 性质：本包只交付「怎么玩、看什么、怎么调」，**试玩结论必须由用户回填**，未回填前量表状态 = 待用户试玩。

## 0. 前置核对：移动端模拟门禁（preHook 证据）

`games/3d/qa/mobile/report.json` verdict=**PASS**，10/10 项 pass（2026-10-09T07:56Z 复验，部署 v6 之后）：
网络全通 / console 零错误 / canvas 挂载 / 首帧渲染（colorCount=16）/ 画面在动（idleDiff=400）/ 触摸派发（tap 1-0-1，swipe 2-8-2）/ 触摸响应（tapDiff=4）/ 音频解锁器 `__audioDebug` / 视口无溢出（390=390）/ FPS=17（swiftshader 软渲染口径，阈值 ≥8）。

判读说明：report.json 中 pass 项的 `detail` 字段是脚本预写的「失败话术模板」（`check()` 的 detail 参数在 PASS 时不打印但仍落盘，取证 `mobile-web-smoke.mjs` L273-295），判读以 `status` + `metrics` 为准 —— 证据与 PASS 结论**不矛盾**，本节点为门禁背书成立。分阶段截图 phase-load / phase-tap / phase-joystick.png 同目录在档。

**部署一致性取证（字节级）**：线上 `…/apps/3d/api/public/assets/index.pck` 为 base64(gzip(pck)) 编码，解码后 GDPC 魔数完好，SHA-256 与仓库 `games/3d/export/web/index.pck` 完全一致（`dbd26cca9283…`）——线上跑的就是本分支多水果 spec v2 构建（导出重建 f50a720 + 壳页多水果口径 c2f86da），pck 内含 fruit.gd×5 / Combo x 等多水果标记。

## 1. 试玩指引（怎么玩 / 看什么）

### 怎么开始
手机或电脑浏览器打开 https://leomac-studio.tail49399e.ts.net/apps/3d/ ，引擎加载后直接开局（自动开始，无需点开始按钮）。

### 操作（对照 spec.meta.platform：Web H5，桌面鼠标 + 移动触摸）
| 设备 | 操作 |
|---|---|
| 触屏（推荐，手机 Safari） | 手指**按住滑动** = 刀痕轨迹，指哪切哪；切中炸弹立即终局 |
| 桌面鼠标 | **按住左键拖动**滑切；或方向键移刀 + 空格挥砍 |
| 结算画面 | 按任意键 / 点「再来一局」按钮 重开（街机惯例，切炸弹后不用干等） |

### 60 秒内会看到什么（对照 spec v2 levels[orchard-classic]）
- **开局 0.25s 内**：第一只水果沿屏幕中线垂直上抛必切得到（开局正反馈设计）；每局**前 2 投必为水果**，不会被炸弹开局打断。
- **六果阵容**（spec v2 权重随机投放）：西瓜（最大，约 1.6×）· 橙子 · 苹果 · 桃子（1.15×）· 柠檬（0.85×）· 猕猴桃（最小 0.75×）。请逐个核对**外观可辨识不混同**：果皮配色贴近真实水果、大小分档、立体模型随抛物线旋转可见体积感。
- **3D 视觉验收点**（spec v2 visual-quality 元素）：方向光 + 阴影/明暗层次；水果为**果皮/果肉双层网格**；切开显示**切面剖面**（苹果五角星果心 + 两粒棕籽、猕猴桃放射籽纹等按种类可辨识）；**汁液粒子颜色与被切水果果肉对应**（西瓜红、橙子橙、柠檬黄、猕猴桃绿……）；两半沿刀痕方向分离坠落。
- **三段递进节奏**：0-20s 约 1 只/1.5s → 20-40s 约 1 只/1.0s → 40-60s 约 1 只/0.7s，越到后面越密。
- **计分**（HUD 左上角实时刷新）：当前实现**每切 1 水果 +10 不分种类**（注意：spec v2 已改为分种类计分 10~25 分，实现未跟——见 §4 首条，试玩时请按「你希望切猕猴桃值多少分」来给感受）；同一刀连切 2 只弹「连击 x2 +10」（该刀合计 +30）；连切 ≥3 只弹「Combo xN！+20」（三果合计 +50 起）。
- **炸弹**：约 15% 概率混入（每局上限 12 枚、相邻间隔 ≥3s），黑色引信球外观与水果明显不同；切中即「切中炸弹！对局结束」，不计负分。
- **终局结算**：总分 / 切中水果数（**分水果种类阵列**）/ 最高单刀连击 / 漏接数 / 历史最高；破纪录显示「★ 新纪录！」（本地持久化）。
- **音频**：切果 / Combo / 炸弹 / 结算各有音效；首次触摸后解锁（iOS 手势策略）。

### 请重点留意（本节点核对出的观察项，不替你下结论）
1. **分种类计分口径差**：spec v2 `scoring.valuesByFruit` = 苹果/橙子 10、西瓜/桃子 15、柠檬 20、猕猴桃 25（小果分高难点中），实现目前**扁平 +10 不分种类**（与需求更正版「+10 不分种类」一致，与 spec v2 不一致）——请感受哪种计分更想刷分。
2. **倒计时最后 10 秒高亮**（spec v2 hud-timer.warnBelowSec=10）仍未实现，HUD 只显示「剩余 N 秒」文本——请确认是否影响紧张感。
3. 刀痕判定刻意偏宽容（minSwipe 12px、包络加宽），请感受「指哪切哪」是否成立、六果混抛时有无误切炸弹的委屈局。
4. 瞄准抛出（80% 朝屏幕中带 ±2.9 可达带）是否让「想切的水果都够得着」、小果（猕猴桃/柠檬）是否难点、漏接是否令人挫败。
5. 六果切面辨识度：切开后能否一眼说出切的是什么水果（籽/纹理/果心），汁液颜色对不对得上。

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
- 打开后画面**右上角**出现「调参工作台」面板：13 个滑杆（键名/当前值实时显示，按 `GameState.TUNING_META` 生成），拖动**即时生效**，可边玩边调。
- 点「**复制调参 URL**」→ 生成带 `?tuning=<JSON>` 的完整链接（写入剪贴板）→ 把它发回来就是一次完整的调参结果。
- 「关闭面板」随时收起；不带 `?tuning` 参数打开时面板零成本不出现。

可调键（`GameState.TUNING_META` 声明，URL 中未声明的键会被忽略并在 diff 中标注）：

| 键 | 当前默认 | 范围/步长 | 含义 |
|---|---|---|---|
| round_seconds | 60 | 30-120 /5 | 单局时长 |
| fruit_points | 10 | 5-50 /1 | 每水果分值（不分种类，见 §4 首条口径差） |
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

## 4. spec v2 ↔ 实现数值对照（供调参时对齐，如实记录差异）

| spec v2 numeric | spec 值 | 实现默认 | 判读 |
|---|---|---|---|
| scoring.valuesByFruit | 苹果/橙子 10、西瓜/桃子 15、柠檬 20、猕猴桃 25 | 扁平 fruit_points=10（不分种类） | **口径差**：spec v2 分种类计分，实现遵循需求更正版「+10 不分种类」；两者只能留一个，请试玩后定 |
| session.durationSec | 60 | 60 | 一致 |
| scoring.comboTwoBonus / comboThreePlusBonus | 10 / 20 | 10 / 20 | 一致 |
| bomb.spawnWeight / maxPerRound / minGapSec | 0.15 / 12 / 3 | 0.15 / 12 / 3 | 一致 |
| thrower.phases 间隔 | 1.5 / 1.0 / 0.7 | 1.5 / 1.0 / 0.7 | 一致 |
| levels.fruit-roster-weights 六果权重 | 0.18/0.16/0.14/0.13/0.12/0.12 | 六果随机投放（fruit_catalog.gd） | 阵容一致；逐果权重实现按目录轮转，未逐项核对 |
| thrower.firstThrowDelaySec | 0.8 | 0.25（FIRST_SPAWN_DELAY） | **差**：实现更快开局正反馈 |
| thrower.safeThrows | 2 投保底水果 | 2（SAFE_THROWS_PER_ROUND） | 一致 |
| thrower.gravity | -13（向下矢量） | 12.0（幅值） | **幅值差 1**，手感以试玩为准 |
| thrower.launchSpeedMin/Max | 14 / 18 | 13.5 / 16.0 | **实现收窄初速带**（配 80% 瞄准中带保可达性） |
| combo「同一刀」语义 | 同一刀连续轨迹 | 0.4s 时间窗近似 | 语义近似实现 |
| hud-timer.warnBelowSec | 10（最后 10 秒警示） | 未实现（纯文本） | **差距**，留给用户试玩确认后走迭代回流 |
| meta.engine | Godot 4.3 + GDScript 2.0（gl_compatibility） | Godot 4 Web 导出（实际） | v2 已对齐（v1 的 Three.js 漂移已修正） |

## 5. 试玩结论回填后会发生什么

1. 解析你的 `?tuning=<JSON>`，与当前 spec.numeric 逐键 diff（未声明键忽略并标注）；
2. diff 数值经 `POST /api/v1/game-design-specs/cmv0matif000rm9aaxjtgi2ug/revisions` 写入 spec.numeric（产生新版本，sourceTrajectoryId=本轨迹溯源）→ `/approve` 拍板；
3. artifacts 追加 `op=tuning_applied` 产物记录拍板结论与数值 diff；
4. 下一轮工作流按新 spec 重部署（spec 是唯一事实源，本节点不改代码默认值）。

**当前状态：量表四问全部「待用户试玩」，未收到用户结论前不执行任何 spec 回写。**
