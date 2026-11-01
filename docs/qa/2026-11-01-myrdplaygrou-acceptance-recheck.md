# 试玩验收复核报告 —— 《植物人大战僵尸-网页版》（myrdplaygrou）

- 复核人：试玩验收 agent（独立复验，不采信前序节点结论本身，逐条重取证）
- 复核时间：2026-11-01（UTC 锚点：deployment v8 createdAt `2026-11-01T10:59:52.594Z`）
- 复核对象：部署版 liveUrl `https://leomac-studio.tail49399e.ts.net/apps/myrdplaygrou/`
- 依据：需求 `cmvxk40v1002gm905xp20rsmm`（验收标准 5 条）+ approved spec `cmvxkdcdp002om905wneuanvw` v1
- 证据基线 commit：`2e843425267700a392ccbf820f0767953c17abd6`（分支 `myrd/pvz-web-goal-cmvxjycvn001zm905jnwpyliv`，远端 tip `d2a6fe3` 仅追加 qa 证据，`git diff 2e84342..d2a6fe3 -- games/myrdplaygrou/export server apphost.toml` 为空 = 线上产物零漂移）

## 一、线上产物锚定（独立复验）

| 项 | 结果 |
| --- | --- |
| `GET /apps/myrdplaygrou/health` | 200 `{"ok":true,"app":"myrdplaygrou","title":"植物人大战僵尸-网页版"}` ✅ |
| `GET /apps/myrdplaygrou`（308 归一化尾斜杠后） | 200，HTML 标题「植物人大战僵尸-网页版」+ viewport meta + canvas 壳 ✅ |
| 线上 `index.pck`（资产通道 base64+gzip 解码）sha256 | `14131d755619f22b8a35d89acf94d9920caee8a12f6fb51ba3da1c541311c12a` = 仓库 `2e84342` 构建 sha256，**逐字节一致** ✅ |
| 部署记录 | v8 `cmvxpxci90049m905f47jfkaz`，gitRef=目标分支，status=running，errorMessage=null ✅ |

## 二、门禁复核（判定脚本只来自仓库 std-skills，未自写未改写；本 agent 在隔离副本独立复跑）

| 门禁 | 复跑结果 |
| --- | --- |
| `preflight.py` | PASS 15 类（1741 工程文件）exit 0 |
| `smoke.sh`（240 帧） | `godot-smoke: PASS`（选关/移动/布防/出战卡/提示淡出/射击/失败/重开/胜利/键位契约/难度与种类平缓/调参协议）exit 0 |
| `input-fuzz.sh` | `GODOT_FUZZ: PASS seed=20260913 batches=6` exit 0 |
| `playtest.sh`（3 局×900 帧） | `GODOT_PLAYTEST: PASS`（fb=235/260/266，first_reward 3.0s，max_gap ≤0.38s）exit 0 |
| `mobile-web-smoke.mjs`（对线上 v8，带 --project 完全口径） | `MOBILE_SMOKE: PASS` 11 项全绿（fps 51、console 零错误、触摸管线通、音频解锁器在、视口无溢出） |

## 三、验收标准逐条判定

| # | 标准 | 判定 | 证据 |
| --- | --- | --- | --- |
| 1 | 完整可玩（选关→布防→抵御波次→通关/失败重试，3 关均可实际通关） | **PASS（复核证实）** | 闭环链路机判见 smoke 断言 2/4/6/7/8；三关真实数值通关由验收 agent 隔离探针证实（见 §四）：L1 79.7s / L2 103.2s / L3 105.3s 全部 `game_ended(true)` 且满生命。⚠️ 门禁未把 per-level 通关编码进判定器（本探针一次性、不可回归）→ 已记 Bug `cmvxr1f1a004fm905ua2ua9ir` 打回 |
| 2 | 难度平缓（相邻关卡增幅 ≤30%） | **PASS** | 独立复算 LEVELS+ZOMBIE_KINDS 加权口径：波数 +20%/+16.7%、血量 +20%/+19.4%、速度 +19.2%/+16.1%、出怪间隔 −9.4%/−10.3%、加权血量 +26.5%/+28.6%、加权速度 +24.2%/+17.4%、种类 1→3→4 逐关提升；全部 ≤30%，且 smoke::_check_level_table 机判同口径 PASS |
| 3 | 扁平色板（纯色块+几何，无渐变无写实素材） | **PASS** | 风格卡 `games/myrdplaygrou/.myrd/style-card.md`（12 色固定板）；模板 Ambience 渐变天空被压平（`main.gd AMBIENCE_FLAT: sky_top==sky_bottom==#2ecc71`）、暗角 strength=0、粒子=0；实体绘制全为 draw_rect/draw_circle 几何；assets 仅字体/未启用粒子纹理/程序化音效，无写实素材 |
| 4 | 触屏优先（单指点按完成全部核心操作） | **PASS** | 代码层：tap 收阳光/布防（field.gd `_handle_tap`）、卡片/静音/重开/选关/结算全按钮化（pressed 信号），无悬停/键盘必经路径（键盘为等价可选）；移动端门禁对线上 v8 复跑触摸管线/触摸响应/视口全绿 |
| 5 | 音画齐备（BGM+关键音效+静音即时生效） | **PASS** | `autoload/audio.gd`：bgm.wav `LOOP_FORWARD` 循环 −13dB；Juice SFX 全接线：shoot/hit/zombie_die/breach/place/score/fail/confirm/victory/defeat；静音=AudioServer 总线 mute（点击即时）；音频手势解锁器 `window.__audioDebug` 在位（门禁 PASS） |

**机器侧验收复核结论：5/5 通过（第 1 条附门禁覆盖缺口 Bug）。人工试玩量表未回填 → 最终验收待 owner 试玩拍板（见 §六）。**

## 四、三关通关性探针（验收 agent 独立验证，非门禁、不入判定器）

- 方法：隔离副本（`2e84342` 提取到 /tmp），场景入口实例化 main.tscn；「称职玩家」bot：自动收天降阳光 + 贪心布防（每行 pea→twin→twin，阵亡即补）；真实数值/真实经济/无调试跳波；`Engine.time_scale=2` 仅快进（弹丸每帧位移 14px < 命中窗 20px，无隧穿失真）。
- 结果 `PROBE_VERDICT: ALL_WIN`：

| 关 | 结果 | 游戏用时 | 剩余生命 | 分数 |
| --- | --- | --- | --- | --- |
| 1 初春草地（5 波） | win | 79.7s | 3/3 | 655 |
| 2 盛夏庭院（6 波） | win | 103.2s | 3/3 | 835 |
| 3 暮秋防线（7 波） | win | 105.3s | 3/3 | 880 |

- 探针源码存档于本报告附录 A（仅复核用，未写入游戏工程、不输出 GODOT_* 门禁标记）。

## 五、缺口与 Bug（打回修复）

| Bug | 严重度 | 内容 | 打回动作 |
| --- | --- | --- | --- |
| `cmvxr1f1a004fm905ua2ua9ir` | medium | 三关通关性缺机判门禁覆盖：smoke 胜利相位只驱动第 1 关，playtest 不判通关；第 2/3 关通关可达未编码进判定器 | 扩展 tests/smoke.gd 胜利相位逐关驱动（`start_level(1)/(2)` + `debug_jump_to_final_wave`）或新增 per-level 通关机判 → 四门禁重跑全绿 → 重部署 |
| `cmvxr34hs004hm905t24jq33l` | medium | write_document 产物回写断链：调研文档 id `95edb8d9-9dc3-48ab-970f-11ee57653c1c` 知识库 GET NOT_FOUND（global/project 列表均 0 命中），goal.artifacts 声称已落账 | 补录调研文档实体，或修正 artifacts 指向可达产物 |

**非 Bug 事项（如实标注）**：人工试玩量表（playtest_kit 四问）**全部待回填** —— 试玩结论只能来自用户，本验收不代答、不预填、不伪造。

## 六、待 owner（@Admin）事项 —— 目标关闭的唯一前置

1. 打开 **liveUrl**：https://leomac-studio.tail49399e.ts.net/apps/myrdplaygrou/ （免登录直开，手机/电脑均可）
2. 按 playtest_kit 指引完整试玩：选关（1→2→3）→ 布防 → 抵御波次 → 通关/失败重试；顺带点一次右上角「静音」验证即时生效
3. 回填四问量表（goal artifacts `playtest_kit` 条目内）：①首分钟看懂？②想再来一局？1-5 分 ③手感/反馈/观感 1-5 分 ④节奏断档？
4. 觉得数值不对就开调参工作台 `?tuning=1` 拖滑杆 → 「复制调参 URL」发回平台（经 spec revisions 落账后下轮重部署）

## 附录 A：通关性探针源码（复核用，`tests/accept_probe.gd` + 同名 .tscn，放隔离副本运行）

```gdscript
extends Node
## 验收复核探针 —— 非门禁判定器：不输出 GODOT_* 标记、不入库、不作为门禁证据。
## 仅回答：第 1/2/3 关在真实数值、真实经济、无调试跳波下能否实际通关。

const LEVEL_BUDGET_FRAMES: int = 16000
const COLLECT_EVERY: int = 15

@onready var field: Field = $Main/Field

var _level := 0
var _level_frames := 0
var _outcome := ""
var _results: Array[Dictionary] = []
var _boot_frames := 0

func _ready() -> void:
	Engine.time_scale = 2.0
	GameState.game_ended.connect(_on_game_ended)

func _on_game_ended(won: bool) -> void:
	_outcome = "win" if won else "lose"

func _physics_process(_delta: float) -> void:
	_boot_frames += 1
	if _boot_frames == 5:
		GameState.start_level(0)   # 游戏默认停在选关页（running=false），探针负责开局
	if _outcome != "":
		_record(_outcome); return
	_level_frames += 1
	if _level_frames > LEVEL_BUDGET_FRAMES:
		print("PROBE: L%d 超预算未终局（wave=%d lives=%d）" % [_level+1, GameState.wave_index, GameState.lives])
		_record("timeout"); return
	if not GameState.running:
		return
	if _level_frames % COLLECT_EVERY == 0:
		for token in field._sun_tokens.duplicate():
			field._collect_token(token)
	_place_greedy()

func _record(outcome: String) -> void:
	_results.append({"level": _level+1, "name": String(GameState.level().get("name","")),
		"outcome": outcome, "game_seconds": snappedf(_level_frames*Engine.time_scale/60.0, 0.1),
		"lives_left": GameState.lives, "score": GameState.score, "defenders": field.defender_count()})
	_level += 1
	if _level >= GameState.LEVELS.size() or outcome == "lose":
		print("PROBE_RESULT: " + JSON.stringify(_results))
		var all_win := true
		for r in _results: if r.get("outcome","") != "win": all_win = false
		print("PROBE_VERDICT: %s" % ("ALL_WIN" if all_win else "NOT_ALL_WIN"))
		get_tree().quit(0); return
	_outcome = ""; _level_frames = 0
	GameState.start_level(_level)

func _place_greedy() -> void:
	for row in 5:
		for col_plan: Array in [[1, 0], [2, 2], [3, 2]]:   # col1=豌豆 col2/3=双发
			var cell := Vector2i(int(col_plan[0]), row)
			var card: int = int(col_plan[1])
			if field.defender_at(cell) != null: continue
			var cost: int = GameState.card_cost_of(GameState.CARDS[card].get("id", &"pea"))
			if GameState.sun < cost + 10: continue
			GameState.select_card(card)
			if field.try_place(field.cell_center(cell)):
				return   # 一帧一动作
```
