# 《光路谜阵》试玩验收包（Playtest Kit）

> 试玩入口：<https://leomac-studio.tail49399e.ts.net/apps/game-4/gw>
> 量表状态：**待用户试玩（未回填）** —— 本包交付指引、量表与机器判定结果；
> 「好不好玩」的结论只能来自试玩者回填（§五），严禁代填。
> **量表已内置化（v17，2026-09-27）**：§五四问改为游戏内点选，URL 加 `?tuning=1`
> 浮出「📋 试玩四问」入口按钮（与调参工作台共存），通关结算页同样浮出；答案本地
> 持久化（`user://guanglu_survey.cfg`），提交一键导出回传（iOS 系统分享 → 剪贴板，
> JSON schema `guanglu-survey/1`）。线下 markdown 回填方式仍有效（§五原样保留），
> 游戏内回填导出的 JSON 与本节字段一一对应。详见 `qa/QA_SELFTEST.md` §二。
> **真机自检已内置（v18，2026-09-27）**：URL 加 `?qa=1` 进入「真机自检」模式——自动采集
> 触屏命中（真实点击 + 全格 sweep）、旋转响应时延（p95 预算 120ms）、音效播放状态
> （AudioContext/设备信息），一键生成 JSON 实测报告并 iOS 系统分享/剪贴板/下载四级导出；
> 试玩者用法见本包 §六·补，技术细节见 `qa/QA_SELFTEST.md` §一。
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
>
> **本轮追补（模板缺陷修复 + 浏览器实测）**：真浏览器（Chromium 内核 + swiftshader 软渲染）
> 实测发现模板 `is_enabled()` 在 Web 上**恒假** —— Godot 4.3 的 `JavaScriptBridge.eval` 对
> 布尔表达式回传被数值化（`true`→`"1"`），`"… !== null"` 恒等于 `"1"` ≠ `"true"`；
> 修复为 JS 侧先转字符串（`String(new URLSearchParams(location.search).has('tuning'))`）。
> 实测矩阵（eval 回传语义）：`'ok'`→`"ok"` ✓ / `1+1`→`"2"` ✓ / 裸布尔→`"1"` ✗ /
> `String(bool)`→`"true"` ✓ / `JSON.stringify(bool)`→`"true"` ✓ —— **跨 eval 传值一律用
> 字符串**（该发现已留档，供技能包模板后续修正参考）。修复后本地双场景实测通过：
> `?tuning=1` 面板浮出（滑杆 6/16）+ 带桥壳注入 `{"beam_core_width":12}` 滑杆显示 12
> （截图 `qa/shots-live-verify/tuning-panel-local-*.png`）；修复态四门禁复跑全绿
> （PREFLIGHT 13 类/66 文件 → SMOKE → FUZZ → PLAYTEST，METRICS 确定性第 5 次逐字段一致）。
>
> **公网实测（v9 部署 `cmuipykw3007em9l6darx2jw0`，HEAD `0f57a73`）**：
> `<liveUrl>?tuning=1` 面板浮出（`__GAME_TUNING_PANEL__='shown'`，右上角滑杆 6/16）；
> 真壳页注入 `?tuning={"beam_core_width":14}` 滑杆正确显示 14 —— 调参回传通道在公网就绪
> （截图 `qa/shots-live-verify/tuning-panel-LIVE-*.png`，HTTP 级核验见 `qa/LIVE_VERIFY.md` §八）。
> **四问量表仍「待用户试玩（未回填）」—— 调参工作台入口：`<liveUrl>?tuning=1`。**
>
> **本轮复验（2026-09-27 试玩验收轮，HEAD `65e9c30`）**：四门禁在当前 HEAD 复跑全绿
> （PREFLIGHT PASS 13 类/77 文件 → GODOT_SMOKE PASS 240 帧退出码 0 零脚本错误 →
> GODOT_FUZZ PASS seed=20260913 6 批 239 帧 → GODOT_PLAYTEST PASS 3 种子×900 帧）；
> `GODOT_PLAYTEST_METRICS` 与上表**逐字段一致**（run1 1.45s/156、run2 null/147、
> run3 11.5s/173，确定性第 6 次复现）。部署线：v18（deploymentId
> `cmuisxou100ccm9l6wv2gpynx`，commit `65e9c30`，gitRef=`myrd/games-goal-cmuieqj7o0031m9gyf4pbwptg`）
> 公网 8/8 全绿——/health 200、落地页 200、壳契约标记齐全、wasm
> Content-Type=application/wasm、wasm/pck sha256 与仓内产物一致（取证
> `qa/QA_SURVEY_ITERATION.md` §五）；本轮工作区零代码改动，导出字节一致性维持，
> liveUrl 不变：`https://leomac-studio.tail49399e.ts.net/apps/game-4/gw`。

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
  注：桥回传布尔会被数值化（见 §一本轮追补），跨桥判定一律走字符串回传。
- 当前可调键：`beam_core_width`（2~16，步长 1，默认 6，光束主线宽）、
  `beam_glow_width`（4~40，步长 1，默认 16，辉光宽）。
- 玩法数值（par/星级阈值）已按拍板固化进 `levels.gd`，不走 URL 调参；后续修订走
  `qa/spec-numeric.json` → revisions → approve 流程。

## 六·补、真机自检模式（入口：`<liveUrl>?qa=1`）

> 这台设备玩不玩得动？不靠感觉，靠机判。试玩者/验收者打开
> `https://leomac-studio.tail49399e.ts.net/apps/game-4/?qa=1`（可与调参工作台叠加：
> `?qa=1&tuning=1`），画面浮出 QA 自检面板。

1. **怎么采**：正常玩即可——每次真实点击自动记一个样本（点击坐标 → 路由格子 →
   是否按预期旋转）；点「**自动扫描**」跑全格合成点击 sweep（逐格命中核验，
   坐标映射错位当场现形）。
2. **看什么**：面板实时显示触屏命中率（预算 100%）、旋转响应时延 mean/p50/p95/max
   （预算 **p95 ≤ 120ms**，含帧开销的「跟手度」）、音效播放状态（AudioContext
   running / 待手势解锁）与设备信息（UA/DPR/屏幕/触摸点数）。
3. **怎么回传**：点「生成报告并导出」得到单行 JSON（schema `guanglu-qa-report/1`，
   含 `verdict.pass` 机判结论与四问量表快照），按 **iOS 系统分享 → 剪贴板 →
   execCommand 复制 → 下载** 四级降级导出，同时投浏览器控制台（标签
   `GUANGLU_QA_REPORT`）。把该 JSON 发回来 = 一次完整的真机自检结果。
4. **判定口径（机判、无主观项）**：`verdict.pass = 触屏命中达标 ∧ 时延 p95 达标 ∧
   音频可出声`；管格样本「路由到位且真的转了」计 hit，非管格（空格/墙）「正确地
   不旋转」也计 hit，坐标映射错位/响应丢失计 miss。
5. **公网可用性**：?qa=1 壳页徽标 + `__QA_MODE__` 标记已随 v18 部署生效；门禁侧
   自检纯逻辑（样本记录/统计/报告构建）被冒烟直接断言——「自检本身也被门禁检」。
   浏览器端实测取证：`qa/QA_SELFTEST.md` §三、`qa/qa-live-check.log`。

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
