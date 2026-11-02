# implement 节点门禁证据 —— HUD 挂件审计 + 结算误触窗全路径（2026-11-02 · run cmvyp0n86006zm9y0ysizzt2t）

> 本目录是「实现玩法」（implement）节点本轮产出的独立门禁证据：基线复跑 → 缺陷修复 →
> 新断言先红后绿 → 四门禁全绿。判定脚本一律来自仓库 `std-skills/godot-game-dev/scripts/`
> （零自造零改写）；基线分支 tip `aa1781b`（修复前取证），修复后同一工作区复跑全绿。
> 玩法内容面（八关数值/机制/音频/色板）零改动 —— 本轮只修两个真实行为缺陷 + 同步升级冒烟。

## 1. 本轮修复的缺陷（均有探针/日志实证，非猜测）

### D1 HUD 重复挂件（首局开局即复现，累计恶化）

- 临时探针（已删，不入库）在旧代码上实测：`GameState.start_level(0)` 一次后顶栏
  row_children=18 —— 「下一波/波次/生命/返回/重开」各 ×2 + 提示 Label ×2；
  每次开关/重开再叠一层。旧挂件失联后文案冻结（假波次/假生命）且顶栏溢出。
- 根因：`hud.gd::rebuild_cards()` 整行重建（常驻挂件与出战卡没有分离）。
- 修复：常驻挂件收口 `_build_fixed_widgets()`（`_build()` 一次性挂载），`rebuild_cards()`
  只重建出战卡。修复后探针复测：row_children=12（7 常驻 + 5 卡片）、提示 Label 唯一、
  波次文案随关卡正确刷新（第 1/4 波 → 第 1/6 波）。

### D2 结算误触窗不覆盖按钮点按路径（触屏第一公民的实际路径裸奔）

- `ResultOverlay` 类契约「400ms 内不接受确认输入」只挂在 `press_primary()`（键盘 confirm），
  主/选关按钮 `Button.pressed` 处理器无条件放行 —— 终局瞬间连点的触屏玩家可直接跳过结算。
- 修复：`_on_primary_pressed` / `_on_select_pressed` 过同一 `can_accept()` 防线。
- 部署门禁影响面核查：mobile-web-smoke touch-response 落在选关页、acceptance-live-probe
  步骤到「进关→选卡→布防」为止，均不触结算浮层 —— 零影响。

### D3（顺手收口）无尽终局 HUD 波次战报 off-by-one（wave_index 0 起，展示 +1）。

## 2. 冒烟断言同步升级（新缺陷面 → 新断言，先红后绿）

| 新断言 | 拦的缺陷 | 红证据（本目录） | 绿证据 |
|---|---|---|---|
| 19 `_audit_hud_widgets` × `hud.gd::widget_audit`（第 1 关开局 + 八关逐关进入两点复核） | rebuild 重复挂载常驻挂件（D1） | `smoke-wrapper-RED-widget-audit.log`：复刻整行重建后 6 条全红（skip_wave/back/restart/wave/lives/hints 在栏 2 ≠ 1） | `smoke-wrapper.log` / `smoke-raw.log` PASS |
| 20 RESULT 相位按钮点按探针（窗口临时拉 600ms 与帧时序解耦，探针后恢复测试通道 30ms） | 误触窗不拦按钮路径（D2） | `smoke-raw-RED-overlay-guard.log`：`窗期内点按主按钮直接跳过了结算` + `…触发了重开` 两条全红 | 同上 |

红证据方法论披露：D1 的红证据用「带 widget_audit 的新 Hud + 复刻旧整行重建」构造 ——
stash 只回退 hud.gd 会连审计方法一起退掉，GDScript 运行时错误不中断调用方，审计会静默
变空操作（第一次尝试的教训，已记入本 SUMMARY）；D2 的红证据直接 stash 回退 result_overlay.gd。

## 3. 门禁判定（全绿，退出码 0）

| 门禁 | 命令（与 .myrd/routines.yaml godot-smoke 同源） | 结果 | 证据 |
|---|---|---|---|
| resolve-godot | `bash …/resolve-godot.sh` | exit 0（Godot 4.3.stable） | — |
| preflight | `python3 …/preflight.py games/myrdplaygrou` | **`PREFLIGHT: PASS`**（15 类，2662 个工程文件） | preflight.log |
| headless-smoke | `GODOT_SMOKE_FRAMES=240 GODOT_BIN=… bash …/smoke.sh games/myrdplaygrou` | **exit 0 + `godot-smoke: PASS`**（原始日志零 SCRIPT ERROR/Parse Error） | smoke-wrapper.log / smoke-raw.log |
| input-fuzz | `GODOT_BIN=… bash …/input-fuzz.sh games/myrdplaygrou` | **`GODOT_FUZZ: PASS`**（seed=20260913，6 批次 239 帧） | fuzz.log |
| playtest | `GODOT_BIN=… bash …/playtest.sh games/myrdplaygrou` | **`GODOT_PLAYTEST: PASS`**（3 局 ×900 帧，fb=227/245/236，最长无反馈窗 ≤0.38s） | playtest.log |

- 基线（修复前，分支 tip `aa1781b`）四门禁同样全绿（*-baseline.log）→ 本轮改动零回归：
  playtest 逐局 fb 227/245/236 vs 基线 227/245/248（同阈值，节奏面持平）。
- 冒烟逐关证据行（修复后实测，与基线一致 = 确定性复现）：第 1-8 关逐关通关 +
  `无尽模式探针通过（入口可见、波次无限、强度 285.0→307.8、巨尸混编）`；
  L5 星级 ★2 来自夜幕探针按设计走真实突破路径（扣 1 生命属预期，断言注释在案）。

## 4. 边界与披露

- 判定脚本零编写零改写零等价替代；取证用 `godot --headless --path games/myrdplaygrou
  --quit-after 240 tests/smoke.tscn` 为 SKILL.md §4.1 标准运行形态，只采日志，判定一律以
  smoke.sh / fuzz / playtest 的退出码与标记为准。
- 临时探针（tests/probe_hud.gd/.tscn）取证后已删除，不入库、不参与任何判定。
- 新增工程内文案（审计失败信息 / 注释）均为中文字符集内常用字，preflight P13/P13b 绿
  （字体配置未触碰）。
