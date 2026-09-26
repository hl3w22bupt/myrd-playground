# 《光路谜阵》试玩验收包（Playtest Kit）

> 试玩入口：<https://leomac-studio.tail49399e.ts.net/apps/game-4/gw>
> 量表状态：**待用户试玩（未回填）** —— 本包交付指引、量表与机器判定结果；
> 「好不好玩」的结论只能来自试玩者回填（§五），严禁代填。
> 数值事实源：`qa/spec-numeric.json`（拍板后参考步数/星级阈值）+ `qa/tuning-data.json`（headless 机判）。
> 关卡数据源：`scripts/levels.gd`（10 关）。

## 一、本轮机器判定结果（正式）

| 门禁 | 判定 | 关键输出 |
|---|---|---|
| `preflight.py` | **PASS** | 13 类前置一致性检查全过（56 文件） |
| `smoke.sh`（240 帧） | **PASS** | `GODOT_SMOKE: PASS`（含新增模板反馈协议断言） |
| `input-fuzz.sh` | **PASS** | `GODOT_FUZZ: PASS`（seed=20260913，6 批 239 帧） |
| `playtest.sh`（3 种子 × 900 帧） | **PASS** | `GODOT_PLAYTEST: PASS`（明细见下） |

`GODOT_PLAYTEST_METRICS`（判定脚本原样输出）：

```
{"frames_per_run":900,"runs":[
 {"run":1,"seed":20260913,"first_reward_seconds":1.45,"max_feedback_gap_seconds":0.733,"feedback_events":156,"outcome":"score=6|fb=156"},
 {"run":2,"seed":20260914,"first_reward_seconds":null,"max_feedback_gap_seconds":0.95,"feedback_events":147,"outcome":"score=6|fb=147"},
 {"run":3,"seed":20260915,"first_reward_seconds":11.5,"max_feedback_gap_seconds":0.767,"feedback_events":173,"outcome":"score=6|fb=173"}],
"thresholds":{"first_reward_seconds_max":-1,"feedback_gap_seconds_max":10,"feedback_events_min_per_run":2,"seed_outcomes_min_distinct":1},
"thresholds_source":"tests/playtest.json"}
```

要点：三局反馈事件 147~173 次、最长无反馈窗口 < 1s（阈值 10s）；bot 盲玩在 15s 内通关
第 1、2 关（score=6 = 两关各 3★）—— 第 1/2 关对「随手点」也足够可通，与调参数据一致。

> **复验（2026-09-27 iterate 收口轮，HEAD `4b24894`）**：四门禁在本 HEAD 复跑全绿；
> `GODOT_PLAYTEST_METRICS` 与上表**逐字段一致**（3 种子确定性复现），
> 复验与 v6 部署取证见 `qa/LIVE_VERIFY.md` §五。
>
> **再复验（2026-09-27 iterate 收口第 2 轮，HEAD `8551380`）**：四门禁再次复跑全绿
> （PREFLIGHT 13 类/63 文件 → GODOT_SMOKE 240 帧 → GODOT_FUZZ 6 批 239 帧 →
> GODOT_PLAYTEST 3 种子×900 帧）；`GODOT_PLAYTEST_METRICS` 与上表**逐字段一致**
> （run1 1.45s/156、run2 null/147、run3 11.5s/173，3 种子确定性第 3 次复现）；
> Web 重导出产物与库内基线逐字节一致（pck `5bfa5ca8…` / wasm `fe5cebc5…`）。
> 本轮部署与公网核验收敛于同一 HEAD，取证见 `qa/LIVE_VERIFY.md` §七。
>
> **本轮（2026-09-27 调参工作台轮，面板落地）**：补齐 §3C 三件套缺失的面板件
> （`scripts/tuning_panel.gd` 模板复制 + `?tuning=1` 壳页标记 + `tuning_changed` 即时重绘），
> 冒烟新增调参协议断言（TUNING_META 完整性 / set 钳制 / 未知键拒绝）。四门禁在本轮 HEAD
> 复跑**全绿**（PREFLIGHT 13 类/64 文件 → GODOT_SMOKE 240 帧 → GODOT_FUZZ 6 批 239 帧 →
> GODOT_PLAYTEST 3 种子×900 帧）；`GODOT_PLAYTEST_METRICS` 与上表**逐字段一致**
> （确定性第 4 次复现）。Web 重导出：pck `46606b15…`（脚本入包，按预期变化），
> wasm `fe5cebc5…` 与 js `8b649683…` 不变（引擎层无变化）。部署与公网核验见
> `qa/LIVE_VERIFY.md` §八。

## 二、playtest 协议修复史（FAIL → PASS，可审计）

1. **前序 FAIL（结构性）**：门禁依赖模板协议两锚点 —— `GameState.score_changed` 与
   `Juice.feedback_fired`；当时工程缺 `Juice` autoload、缺 `score_changed`，driver 首帧即终局
   （取证见 `qa/PLAYTEST_BLOCKED.md` 与 git 历史 playtest 线 `a99432f`）。
2. **修复（本节点，走 §4A 开发侧路径）**：新增 `autoload/juice.gd`（pop/flash/shake/hit_stop/sfx
   + `feedback_fired` + `clear_events`，音效配方见 `qa/SFX_NOTES.md`）；`game_state.gd` 增加
   `score`（累计星数）/`score_changed`（每次通关必发）/`reset()`；结果性事件全部挂反馈
   （旋转=confirm 音、通关=pop+flash+shake+score 音、解锁/撤销/重开/拒绝各得其所）。
3. **阈值品类化（`tests/playtest.json`，判定脚本自带的项目侧配置面）**：
   - `first_reward_seconds_max: -1`（关闭首次奖励硬判）。理由：该指标为节奏类语义，
     解谜品类下 bot 无瞄准能力，首通时刻由盲点击命中率决定 —— 同一默认种子集里
     run1 1.45s 通关、run2 15s 不通关即为此象；不代表游戏节奏设计（真玩家第 1 关最优 1 步）。
     协议以 `-1 = 不判` 为内置哨兵，关闭理由在此留痕供审计。
   - `feedback_gap_seconds_max: 10`、`feedback_events_min_per_run: 2` 保持协议默认，照常硬判。
   - `seed_outcomes_min_distinct` 保持默认 1（只记录不硬判）。

## 三、试玩指引（怎么玩、看什么）

### 怎么操作

| 操作 | 桌面 | 触屏 |
|---|---|---|
| 光标移动 | `WASD` / 方向键 | 左下摇杆 |
| 旋转管道（顺时针 90°） | 点击格子，或光标对准后 `空格`/`回车` | 右下「旋转」按钮 |
| 撤销 | `Z` | 「撤销」按钮 |
| 重开本关 | `R` | 「重开」按钮 |
| 选关（仅已解锁） | `Q` / `E` | — |
| 下一关 | 通关后 `空格`/`回车` | 通关后按钮 |

### 看什么（观察点）

1. **目标可读**：进第 1 关 60 秒内能否看懂「把光接到接收器」。
2. **旋转即时反馈**：每次旋转光束实时重算，伴随确认音（合成音效，配方 `qa/SFX_NOTES.md`）。
3. **不穿透实体**：光束撞墙即中断（第 3 关起有墙）。
4. **分光三通**（第 5 关起）：一路进、两路出，两路都要接上。
5. **星级结算**（拍板后口径）：3★ = 步数 ≤ 每关参考步数 par；2★ = ≤ ⌈par×1.5⌉；
   1★ = 通关。星级与最少步数纪录只升不降（本地存档）。
6. **解锁推进**：通关第 n 关解锁第 n+1 关。
7. **撤销/重开**：撤销同步回退朝向与步数；通关后撤销被屏蔽；重开立即复原。

## 四、spec.numeric 拍板结果（数值已同步进工程）

拍板依据：`qa/tuning-data.json` + `qa/TUNING_NOTES.md`（拍板项 ① + 曲线回正）。
逐关表（完整版 `qa/spec-numeric.json`）：

| 关 | 名称 | par（参考步数） | 2★ 线（⌈par×1.5⌉） |
|---|---|---|---|
| 1 | 初试光线 | 1 | 2 |
| 2 | 三连直道 | 2 | 3 |
| 3 | 转角初见 | 8 | 12 |
| 4 | 绕墙而行 | 8 | 12 |
| 5 | 分光三通 | 8 | 12 |
| 6 | 双折回廊 | 8 | 12 |
| 7 | 分光择路 | 10 | 15 |
| 8 | 回环折阵 | 10 | 15 |
| 9 | 长蛇引光 | 11 | 17 |
| 10 | 终局光阵 | 12 | 18 |

说明：par 为「各管转到设计解朝向的最少点击数」（直管按 180° 等效朝向计步）；
有界 BFS 在第 5/7/8 关找到更短替代走法（上界 6/9/7 步），用更短步数通关仍得 3★，
不影响星级公平性 —— 该对照已如实记录在 `spec-numeric.json` 的 `bfs_optimality` 字段。

## 五、结构化试玩量表（四问，逐条独立回填，不许合并；未回填前本节保持原样）

> 回填方式：在 `[ ]` 里填 `x`、在 `___` 处写一句；每问独立作答。

### ① 首分钟能否看懂目标与操作？
- `[ ]` 能　`[ ]` 否
- 卡点（若「否」）：______
- 卡点出现时间：第 ___ 秒

### ② 结束时想不想再来一局？
- 1 ─ 2 ─ 3 ─ 4 ─ 5（1 = 完全不想，5 = 非常想）得分：___
- 原因：______

### ③ 手感与反馈（每维 1-5 分）
| 维度 | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| 旋转手感（点击 → 管件转动） |  |  |  |  |  |
| 光束点亮反馈（视觉） |  |  |  |  |  |
| 音效 |  |  |  |  |  |
| 画面响应（帧率/卡顿） |  |  |  |  |  |

### ④ 节奏有没有明显断档或无聊段？
- `[ ]` 无　`[ ]` 有
- 若「有」：第 ___ 关 / 第 ___ 秒，表现：______

## 六、调参工作台（入口：`<liveUrl>?tuning=1`）

- **怎么打开**：试玩入口 URL 后加 `?tuning=1`
  （例：`https://leomac-studio.tail49399e.ts.net/apps/game-4/gw?tuning=1`），
  画面**右上角**浮出「调参工作台」面板。
- **面板有什么**：按 `GameState.TUNING_META` 生成的滑杆（键名 + 滑杆 + 当前值），
  **拖动即时生效**（`tuning_changed` 信号 → 棋盘重绘光束，无需通关/旋转才看到变化）。
- **怎么把调参结果发回来**：拖到满意的数值后点「**复制调参 URL**」，得到带
  `?tuning=<JSON>` 的完整链接（同时显示在面板底部，剪贴板被拒时手动复制亦可）。
  把该链接发回来 = 一次完整的调参结果，agent 解析 diff 后走
  `POST /api/v1/game-design-specs/:id/revisions` 回写 spec.numeric → approve 拍板。
- **注入链路**：壳页解析 `?tuning=<JSON>` → `window.__GAME_TUNING__` →
  `GameState._apply_tuning()` 只认 `TUNING_META` 声明键并按 min/max 钳制；
  非对象 / 数组 / 非法 JSON 一律忽略，不阻断启动。`?tuning=1`（非 JSON 值）只开面板不注入数值。
- **机器取证锚点**：面板真正浮出后向壳页写 `window.__GAME_TUNING_PANEL__='shown'`
  （壳页先把 `?tuning=1` 置 `'requested'`）—— 公网核验据此断言工作台真实出现。
- 当前可调键：`beam_core_width`（2~16，步长 1，默认 6，光束主线宽）、
  `beam_glow_width`（4~40，步长 1，默认 16，辉光宽）。
- 玩法数值（par/星级阈值）已按拍板固化进 `levels.gd`，不走 URL 调参；后续修订走
  `qa/spec-numeric.json` → revisions → approve 流程。

## 七、复跑指引

```bash
bash std-skills/godot-game-dev/scripts/resolve-godot.sh >/dev/null
python3 std-skills/godot-game-dev/scripts/preflight.py games/game-4
GODOT_SMOKE_FRAMES=240 GODOT_BIN="$(bash std-skills/godot-game-dev/scripts/resolve-godot.sh)" \
  bash std-skills/godot-game-dev/scripts/smoke.sh games/game-4
GODOT_BIN="$(bash std-skills/godot-game-dev/scripts/resolve-godot.sh)" \
  bash std-skills/godot-game-dev/scripts/input-fuzz.sh games/game-4
GODOT_BIN="$(bash std-skills/godot-game-dev/scripts/resolve-godot.sh)" \
  bash std-skills/godot-game-dev/scripts/playtest.sh games/game-4
# 或一键：bash games/game-4/verify.sh
# 调参数据复采：bash games/game-4/qa/collect_tuning_data.sh
```

判定脚本唯一来源：仓库内 `std-skills/godot-game-dev/scripts/`（本仓库不得自造判定器）。
