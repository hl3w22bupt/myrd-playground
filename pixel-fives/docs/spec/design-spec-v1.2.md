# GameDesignSpec v1.2 · 像素街机足球 Pixel Fives · M1 段（终稿 · 按裁决修订）

| 项 | 值 |
|---|---|
| 状态 | **v1.2-APPROVED**（2026-09-12 主策划复核批准 · 六问全 yes，盖章记录 = `v1.2-approval-record.md`；内容正文与送审版零差异，仅状态盖章。offline 落文待归位：平台 `game-design-specs` 接口恢复后由主策划 `POST /api/v1/game-design-specs/:id/revisions` 补建正式版本链） |
| 继承 | v1.1 全量继承（未被本版修订推翻的条目继续有效）；v1.1 原文因黑板不可达暂无法归档，**本版 M1 段为完整自洽文本**，实现与验收不依赖 v1.1 原文即可执行 |
| 唯一 approved 执行人 | 主策划（版本链 v1.1→v1.2 由主策划盖章） |
| 机器可读导出 | `.myrd/spec/design-spec.json`（contract-check 例行任务读取路径，status 与本文件同步） |
| 归位备注 | 平台 `game-design-specs` 接口本轮不可达，本文件为落文待归位版；接口恢复后由主策划经 `POST /api/v1/game-design-specs/:id/revisions` 建立正式版本链，旧版自动置 superseded |

---

## 0. 修订说明（v1.1 → v1.2 diff，供主策划与下游审阅）

每条 = 一项终裁落文。下游以此 diff 对照实现（程序 `PENDING_APPROVED_SLOTS` 翻转、QA verdict 依据、美术量产解锁）。

| id | 修订 | 内容 | 依据 |
|---|---|---|---|
| R-01 | **A06 锁定** | 射门动画 = 9 帧 @12fps = 0.75s；`contact_frame = 3`（0 基，≈250ms）仅为视觉触球帧，**不阻塞判定**（出球由程序在输入后即时触发） | 2026-09-12 终裁 |
| R-02 | **新增 A08** | 新增资产条目 `a08-sfx-goal-hit`（进球音效，0.6s 三层确定性合成）+ 新增 spec 字段 `goal_sfx_at_s = 0.0`（音效不删、变可测） | 2026-09-12 终裁 |
| R-03 | **红线落文** | `input_to_shot_latency_ms ≤ 50` 列入 numeric 红线 + acceptance 可执行检查；**v1.3 以实测定标**（v1.2 只锁红线，不锁实测分布） | 2026-09-12 终裁 |
| R-04 | **onboarding-hint check 落点** | 该验收项的 check 落点 = **UI 集成测试**（`tests/ui/onboarding-hint.test.mjs`）；**bot 对局 / bot-sim 不背此断言** | 2026-09-12 终裁 |
| R-05 | **out_of_scope 负面清单** | meta 段落文冻结负面清单（见 §1.4），PR 出现即打回 | 2026-09-12 终裁 + Team Lead 冻结项 |
| R-06 | **命名配色锁定** | 赤焰 Fives `#D93A2B` / 霜蓝 Fives `#2B6BD9` 写入 world 与 entities.kit，全链路（代码/美术/UI）以此为准 | 2026-09-12 流程外裁决 |
| R-07 | **落点规则** | 实体 script 落点 = `src/entities/<id>.js`，关卡 script 落点 = `src/levels/<id>.js`（相对游戏工程根 `pixel-fives/`）；contract-check 按此断言 | 2026-09-12 流程外裁决 |
| R-08 | **QA bot-sim 契约冻结** | ① 指标拆分为 `goal_range_ratio` 与 `duration_in_range_ratio` 两字段；② 报告 `errors` 非空 ⇒ runner **exit ≠ 0**；③ 报告结构补 `per_game[]`（逐场）+ `meta`（环境信息）；④ seeds = **42..141**（含端点，100 场），QA 与程序双方同一套 | 2026-09-12 终裁（Q5–Q7 回应） |
| R-09 | **继承声明** | 本版为完整自洽文本（见文件头「继承」行），v1.1 不可回溯条目不阻塞实现与验收 | 黑板不可达处置 |
| R-10 | **采纳程序线占位提案** | `player.kick_cooldown_s = 0.3`、`player.reach_px = 13` 首次入 spec（原为程序线 pending 提案，本版策划侧采纳）；标注为 v1.3 实测调参候选 | 程序线 `constants.js` 提案 + 策划侧采纳 |

---

## 1. meta（是什么）

| 字段 | 值 |
|---|---|
| game_id | `pixel-fives` |
| 名称 | 像素街机足球 Pixel Fives |
| spec 段 | **M1「核心循环可玩」**（一轮冲刺，9/19 例会复盘 DoD） |
| 版本 | v1.2（继承 v1.1） |
| 状态 | **approved**（2026-09-12 主策划盖章；转移记录 draft-pending-review → approved 见 §9 与 `v1.2-approval-record.md`） |
| 工程根 | `pixel-fives/`（本 spec 全部落点路径相对此根） |
| 目标平台 | Web 浏览器（键盘 1v1 对局）；M2 端（微信/抖音小游戏）由主策划预排，不在 M1 |
| 对局模式 | 1v1 单局：人类 vs 人类 / 人类 vs bot / bot vs bot（bot vs bot 走与人类同一套模拟入口，供 QA） |
| 一句话 | 两名球员、一颗球、两个球门：追球、射门、进球，90 秒内比谁进球多 |

### 1.4 out_of_scope（负面清单 · R-05 · PR 出现即打回）

1. 《AI女友》不启动（冻结项）。
2. 不立新游戏（冻结项）。
3. M1 不做多模式、不做联赛/锦标赛/积分榜——只有 1v1 单局（冻结项）。
4. 不碰 Steam / Roblox（冻结项；M2 端为微信/抖音小游戏，由主策划预排）。
5. 资源 70/30 分配不变，M1 不追加资源（冻结项）。
6. M1 不做：守门员专用 AI、在线联机、账号/存档系统、内购、道具/技能系统、犯规/越位/点球规则。
7. M1 不做非 16px 公度美术与第二套风格（美术只从风格参考卡 v1 派生）。

---

## 2. world（世界观）

### 2.1 一段话世界观

霓虹夜色里的街机球馆「Fives Arena」：一块 16px 公度的像素球场，暖白灯光从左上方 45° 打下。赤焰 Fives 与霜蓝 Fives 是一对宿敌街机球队，在这座球馆里用最原始的方式解决争端——没有犯规、没有越位、没有裁判，只有追球、射门和网窝的哗啦声。谁在 90 秒里把球送进对方门更多次，谁就是今晚的 Fives。

### 2.2 球队（命名配色锁定 · R-06）

| team_id | 队名 | 主色 HEX | 暗阶/亮阶 | 进攻方向（M1 pitch 布局） |
|---|---|---|---|---|
| `red` | 赤焰 Fives | `#D93A2B` | `#A8281C` / `#F06A50` | 攻左门（el-03） |
| `blue` | 霜蓝 Fives | `#2B6BD9` | `#1E4DA8` / `#5C8FF0` | 攻右门（el-04） |

- 队色三阶映射与换色规则（`r↔b / R↔B / x↔y`）以风格参考卡 v1 §1 为唯一真源，本 spec 不复制色板全文。
- 队名用于：HUD 队名标签（A07 槽位）、终局结算文案、bot-sim 报告 `goals_red` / `goals_blue` 字段命名。

### 2.3 基调（供美术派生，不另编）

复古像素街机 · 暖白灯光 · 硬边无渐变 · 街机记分牌式 HUD。风格真源 = `docs/art/style-card-v1.md`（**v1-APPROVED**，2026-09-12 主策划盖章，量产解锁）。

---

## 3. entities（实体）

落点规则（R-07）：实体 script = `src/entities/<id>.js`（相对工程根 `pixel-fives/`）。讨论层编号 `A<nn>` 与文件层资产 id `a<nn>-<名>` 一一对应（资产台账 v1 §1）。

### 3.1 实体定义

**entity `player`** — 球员
- script 落点：`src/entities/player.js`（已在库）
- 关联资产：A02 `a02-player-red`（kit=red）、A03 `a03-player-blue`（kit=blue）、A06 `a06-kick-shot`（射门动画）
- 字段（数值见 §5）：`team ∈ {red, blue}` · 16×16 · 侧视朝右、反向水平镜像、禁旋转
- 行为契约：射门判定**即时**——输入所在 tick 内完成出球判定（红线 R-03）；A06 动画为纯视觉反馈（kickAnimT 计时不参与判定，动画未播完仅受冷却约束）；射门方向 = 朝向水平分量 + 指向球的垂直修正（避免垂直死区）
- 已实现接口（程序线，与本 spec 一致）：`tryKick(ball, impulse)` / `tick(intent, ball, impulse, dt)` / `place(x, y)`

**entity `ball`** — 足球
- script 落点：`src/entities/ball.js`（已在库）
- 关联资产：A04 `a04-ball`（roll 4 帧 @12fps，渲染层按滚动距离采样）
- 字段（数值见 §5）：半径 4（8×8）· 最大速度 230 · 踢球冲量 240 · 摩擦半衰期 0.45s · 低速截断 2 px/s
- 行为契约：位置积分 + 指数摩擦；速度上限 clamp；`impulse()` 为射门/带球触碰共用入口

**entity `goal`** — 球门
- script 落点：`src/entities/goal.js`（已在库）
- 关联资产：A05 `a05-goal-net`（32×24，左门朝右、右门镜像）、A08 `a08-sfx-goal-hit`（进球音效）
- 字段（数值见 §5）：门嘴高 44 · 门深 12 · `defends` 归属队伍
- 行为契约：进球判定 = **球心越过门线且球心处于门嘴高度带内**；进球即按 `goal_sfx_at_s`（=0.0s）排程 A08（`sfxSchedule()` 接口已实现）

### 3.2 实体-资产 id 对齐表（contract-check 断言依据）

| 资产 | id | 挂接落点 |
|---|---|---|
| A01 | `a01-pitch-tileset` | `src/levels/pitch.js`（tile 索引见 manifest.tile_index） |
| A02/A03 | `a02-player-red` / `a03-player-blue` | `src/entities/player.js`（kit 参数区分） |
| A04 | `a04-ball` | `src/entities/ball.js` |
| A05 | `a05-goal-net` | `src/entities/goal.js` |
| A06 | `a06-kick-shot` | `src/entities/player.js`（shoot 动画，纯视觉） |
| A07 | `a07-ui-hud` | HUD（level pitch 元素 el-08 槽位） |
| A08 | `a08-sfx-goal-hit` | `src/entities/goal.js`（`goal_sfx_at_s` 触发） |

---

## 4. levels（关卡）

### 4.1 level `pitch` — Fives Arena 主球场（M1 唯一关卡）

- script 落点：`src/levels/pitch.js`（**落点声明**，程序线 M1 内交付，当前尚未在库）
- 逻辑坐标系：256×160 逻辑像素，原点左上，1x 世界单位；渲染整数倍缩放
- 元素编号 el-01..el-10 为**稳定 id**（关卡可视化编辑页「精确落点修改」依据；只增不改，改名/改号走 spec 新版本）

| element.id | 名称 | 类型 | 定义（可核对参数） |
|---|---|---|---|
| `el-01` | 边线 | 静态装饰 | 内缩 6px 白线矩形 (6,6)–(250,154)，1px 暖白 `w`；A01 tile 2（顶边线）沿边铺设 |
| `el-02` | 中线+中点 | 静态装饰 | 中线 x=128（y 6→154）；中点 (128,80)（A01 tile 3） |
| `el-03` | 左门 | goal 实体 | `side=left, lineX=6, centerY=80, defends=blue`；门嘴带 y ∈ (58,102)；A05 朝右 |
| `el-04` | 右门 | goal 实体 | `side=right, lineX=250, centerY=80, defends=red`；A05 水平镜像 |
| `el-05` | 赤焰站位 | 出生点 | 开球/重开位 (168,80)，`homeX=168` |
| `el-06` | 霜蓝站位 | 出生点 | 开球/重开位 (88,80)，`homeX=88` |
| `el-07` | 球位 | 出生点 | 开球/重开位 (128,80)，速度清零 |
| `el-08` | HUD 记分牌 | UI | 顶部居中 (104,6) 起 48×16，A07 九宫格；比分 = 系统像素字体（不占美术位图预算）；显示双方比分 + 剩余时间 |
| `el-09` | onboarding 提示 | UI | 底部居中提示条（文案见 §5 onboarding.text）；开局显示，首次触球后 ≤3s 淡出；**check 落点 = UI 集成测试（R-04）** |
| `el-10` | 进球庆祝层 | UI/流程 | 进球触发：冻结对局 → 播 A08（`goal_sfx_at_s=0.0`）→ 庆祝 1.2s → 中圈重开（el-05/06/07 复位、速度清零、无开球特权）→ 恢复运行 |

### 4.2 对局流程（pitch 关卡规则）

1. **开球**：双方置 el-05/el-06，球置 el-07，90s 计时开始（无倒计时特权回合，M1 简化）。
2. **进球**：goal 实体判定通过 → 对方比分 +1 → el-10 流程 → 中圈重开。
3. **终局**：计时归零冻结对局，显示终局比分；平局合法（M1 无加时）；提供「再来一局」重开（回到第 1 步，比分清零）。
4. **确定性**：core/sim 内禁止 `Math.random`/`Date.now`，一切随机走 `src/core/rng.js`（mulberry32，同 seed 必同序列）——bot-sim 可复跑校验的前提。

---

## 5. numeric（数值 · 单源）

数值单源 = `pixel-fives/src/core/constants.js`。**本表键名与程序线 `PENDING_APPROVED_SLOTS` 一一对应**；主策划批准后由程序线逐条翻转 `pending-approved → approved`，constants.js 是唯一改动点。来源标记：〔终裁〕=2026-09-12 终裁；〔v1.1〕=继承条目；〔采纳〕=R-10 采纳程序线提案。

> **别名映射（策划线自检发现，随本版送批）**：程序线槽位登记键 `bot.goal_range` / `bot.duration_in_range_s` 即本表 `bot_sim.goal_range` / `bot_sim.duration_in_range_s`（同值别名，2026-09-12 策划线对齐 constants.js 时确认）。翻转时按此对应，勿漏两条。

| 键 | 值 | 单位 | 来源 |
|---|---|---|---|
| `tick_hz` | 60 | Hz | 〔v1.1〕 |
| `pitch.logical_size` | 256×160（16px tile，16×10） | 逻辑 px | 〔v1.1〕 |
| `pitch.inset_px` | 6 | px | 〔v1.1〕 |
| `match.duration_s` | 90 | s | 〔v1.1〕 |
| `goal.mouth_h_px` | 44 | px | 〔v1.1〕 |
| `goal.depth_px` | 12 | px | 〔v1.1〕 |
| `player.size_px` | 16（16×16） | px | 〔v1.1〕 |
| `player.speed_px_s` | 92 | px/s | 〔v1.1〕 |
| `player.kick_cooldown_s` | 0.3 | s | 〔采纳 R-10，v1.3 调参候选〕 |
| `player.reach_px` | 13 | px | 〔采纳 R-10，v1.3 调参候选〕 |
| `ball.size_px` | 8（半径 4） | px | 〔v1.1〕 |
| `ball.max_speed_px_s` | 230 | px/s | 〔v1.1〕 |
| `ball.kick_impulse_px_s` | 240 | px/s | 〔v1.1〕 |
| `ball.friction_half_life_s` | 0.45 | s | 〔v1.1〕 |
| `ball.low_speed_cutoff_px_s` | 2 | px/s | 〔v1.1〕 |
| `goal_celebration_s` | 1.2 | s | 〔v1.1〕 |
| `goal_sfx_at_s` | 0.0 | s | 〔终裁 R-02〕 |
| `red_line.input_to_shot_latency_ms` | ≤ 50（v1.3 以实测定标） | ms | 〔终裁 R-03〕 |
| `a06.frames / fps / duration_s / contact_frame` | 9 / 12 / 0.75 / 3 | 帧·fps·s·帧号 | 〔终裁 R-01〕 |
| `a08.duration_s / sample_rate_hz / seed` | 0.6 / 44100 / 20260912 | s·Hz·— | 〔终裁 R-02〕 |
| `bot_sim.seeds` | 42..141（含端点，100 场） | — | 〔终裁 R-08〕 |
| `bot_sim.goal_range` | [1, 12] | 进球数 | 〔v1.1〕 |
| `bot_sim.duration_in_range_s` | [80, 100] | s | 〔v1.1〕 |
| `onboarding.hide_after_first_touch_s` | 3 | s | 〔v1.1〕 |
| `onboarding.text` | `移动 WASD/方向键 · 射门 空格/J` | — | 〔v1.1〕 |

### 5.1 bot-sim 报告契约（冻结 · R-08，QA 与程序双方同一套）

```json
{
  "meta": {
    "seeds_start": 42, "seeds_end": 141, "game_count": 100,
    "spec_version": "v1.2", "built_from": "<git sha 或 build id>",
    "generated_at": "<ISO8601>", "deterministic": true
  },
  "per_game": [
    { "seed": 42, "goals_total": 5, "goals_red": 3, "goals_blue": 2,
      "duration_s": 90.0, "shots": 41, "touches": 118, "errors": [] }
  ],
  "summary": {
    "goal_range_ratio": 1.0,
    "duration_in_range_ratio": 1.0,
    "games_with_errors": 0,
    "errors": []
  }
}
```

**指标定义（冻结，不得再合并/改名）**：
- `goal_range_ratio` = #{ g : `per_game[g].goals_total ∈ [1,12]` } / 100
- `duration_in_range_ratio` = #{ g : `per_game[g].duration_s ∈ [80,100]` } / 100
- `per_game[]` 必须逐场给出 seed/比分/时长/errors（越界或报错按 seed 定位）；`meta` 必须可追溯到 build。

**退出码规则（冻结）**：runner exit 0 ⇔ `games_with_errors == 0` ∧ `goal_range_ratio == 1.0` ∧ `duration_in_range_ratio == 1.0`。**`errors` 非空 ⇒ exit ≠ 0**（终裁原文）。套件确定性（同 seed 同对局），故比率断言取 ==1.0；个别 seed 越界 → 按 per_game.seed 定位修复后重跑，**禁止放宽区间过关**；区间变更必须走 spec 新版本。

**种子纪律（冻结）**：seeds = 42..141，QA 与程序**双方同一套**；bot vs bot 双方控制器从同一 seed 确定性派生，同 seed 复跑逐字节一致。

---

## 6. acceptance（验收）

check 落点为契约声明：标〔在库〕的检查当前可跑；标〔待交付〕的由程序线/QA 线本冲刺交付，路径即落点，QA 按此打缺陷。

| id | 验收陈述（人能核对） | check | 状态/注 |
|---|---|---|---|
| `acc-01` | 完整对局：M1 build 可从开球踢到 90s 终局并显示比分，全程零报错；结构化指标 `fps_min ≥ 58`、`frame_time_p95_ms ≤ 18`、`errors = 0` | `tests/smoke/full-match.test.mjs`（输出 JSON 指标） | 〔待交付·程序线〕DoD#3 冒烟门禁 |
| `acc-02` | 红线：射门输入到出球判定延迟 ≤ 50ms（60Hz 同 tick 即时判定，≤16.7ms）；动画不阻塞判定 | `tests/red-line/input-to-shot.test.mjs`（断言判定发生在输入所在 tick） | 〔待交付·程序线〕v1.3 以实测定标，v1.2 只锁红线（R-03） |
| `acc-03` | bot-sim 门禁：seeds 42..141 共 100 场全过；exit 0 ⇔ errors 空 ∧ 两比率 == 1.0；errors 非空 ⇒ exit ≠ 0 | `node tools/bot-sim.mjs --seeds 42..141 --json`（runner 由程序线交付）+ `tests/qa/bot-sim-contract.test.mjs` | 〔待交付·程序+QA〕R-08；双方同一套种子 |
| `acc-04` | bot-sim 报告契约：含 `meta` + `per_game[]`（逐场 seed/比分/时长/errors）+ `summary`（两拆分比率字段）；同 seed 复跑输出逐字节一致 | `tests/qa/bot-sim-contract.test.mjs` | 〔待交付·QA〕字段名与 §5.1 逐字一致 |
| `acc-05` | onboarding 提示：开局可见（el-09），首次触球后 ≤3s 内淡出 | `tests/ui/onboarding-hint.test.mjs`（**UI 集成测试**） | 〔待交付·QA〕**bot 对局与 bot-sim 不背此断言**（终裁 R-04） |
| `acc-06` | 进球链路：球心过门线且在门嘴带内 → 比分 +1 → A08 于 `goal_sfx_at_s=0.0` 触发 → 庆祝 1.2s 冻结 → 中圈重开 | `tests/goal-flow.test.mjs` | 〔待交付·程序线〕el-10 流程逐拍断言 |
| `acc-07` | 落点契约：`src/entities/{player,ball,goal}.js`〔在库〕、`src/levels/pitch.js`〔M1 内交付〕存在；实体-资产 id 对齐表（§3.2）成立；关卡元素 id 稳定唯一 | contract-check 例行任务（`game-contract`，读 `.myrd/spec/design-spec.json`） | spec approved 后启用；「跑的是不是策划案里那个游戏」 |
| `acc-08` | 资产预算：全部产物 ≤ 1,572,864 B（1.5MB，微信主包 ≤4MB 红线内） | `node pixel-fives/tools/gen-assets.mjs`（超线 exit 1）〔在库〕 | 美术线已接线 |
| `acc-09` | 数值单源：玩法数值只出现在 `src/core/constants.js`；spec approved 后 `PENDING_APPROVED_SLOTS` 全部翻转、以本表 §5 覆盖 | 人工核对（主策划批准后程序线执行翻转并回报） | 〔流程项〕constants.js 是唯一改动点 |

**QA verdict 前置条件**（承接 Team Lead 收敛稿）：spec approved + 程序 P1–P4 交付 + 美术资产获批，三份输入到齐才出 verdict；QA 打回依据 = 本 §6 逐条。

---

## 7. 交主策划复核清单（yes/no）

1. §0 修订 diff R-01..R-10 是否与终裁逐条一致（含 R-10 两处采纳值 `kick_cooldown_s=0.3`、`reach_px=13`）；
2. §5 数值表是否批准（批准 ⇒ 程序线翻转 `PENDING_APPROVED_SLOTS`，constants.js 为唯一改动点）；
3. §5.1 bot-sim 报告契约与退出码规则是否批准（批准 ⇒ QA 以此出 verdict，程序按此冻结接口）；
4. §4 pitch 关卡布局（el-01..el-10 坐标、开球/重开/终局规则、平局合法）是否批准；
5. §6 acceptance 9 条及 check 落点是否批准（批准 ⇒ QA 验收包以本节为依据）；
6. 批准动作（主策划执行）：spec 状态 → **approved**（版本链 v1.1→v1.2 盖章）→ 通知程序线翻转槽位、QA 出 verdict、美术量产解锁（manifest.status 同步 approved）。

**任何一条 no = 打回策划线修订，产生 v1.2.x 或 v1.3；不批准期间程序线按 pending-approved 槽位推进不受阻，QA verdict 继续挂起。**

## 8. 待归位清单（接口恢复后）

- [ ] 平台 `game-design-specs` 接口恢复：由主策划 `POST /api/v1/game-design-specs/:id/revisions` 建立 v1.2 正式版本（detail 引用本文件 §0），旧版自动置 superseded；
- [ ] `.myrd/spec/design-spec.json` 与接口侧 approved 版本对齐（以接口为准回写本导出）；
- [ ] 黑板恢复：本 spec 迁入/挂链 `.myrd/blackboard/`；
- [ ] 9/19 例会：M1 DoD 复盘以本文件 §6 + QA verdict 为准。

## 9. 变更记录

| 日期 | 版本 | 变更 | 作者 |
|---|---|---|---|
| 2026-09-12 | v1.2 | **主策划复核批准（approved）**：六问全 yes，美术送审五问全 yes；版本链 v1.1（superseded）→v1.2（approved）盖章，详见 `v1.2-approval-record.md`；内容正文与送审版零差异，仅状态盖章 | 主策划（唯一 approved 执行人） |
| 2026-09-12 | v1.2 | 按终裁全量修订（R-01..R-10），完整自洽文本落文，交主策划复核 | 游戏策划线 |
| 2026-09-12 | v1.2 | 机器可读导出 `.myrd/spec/design-spec.json` 补全为六段全量（修复上轮截断）；自检发现并注明 `bot.*`↔`bot_sim.*` 键名别名映射（§5）；出具送审单 `v1.2-review-submission.md` 正式送审主策划 | 游戏策划线 |
| — | v1.1 | M1 段初版（原文随黑板不可达暂无法归档） | 游戏策划线 |






