extends Node
## 无头冒烟自检（headless smoke）—— 机器可判定的「游戏能不能跑、玩得动、胜负可达、可重开」。
##
## 运行方式（由 scripts/smoke.sh 封装）：
##   godot --headless --path <工程目录> tests/smoke.tscn
##
## 判定协议（smoke.sh 按此断言退出码与日志）：
##   通过 → stdout 打印 `GODOT_SMOKE: PASS ...`，进程退出码 0
##   失败 → stderr 打印 `GODOT_SMOKE: FAIL <原因>`（每条一行），进程退出码 1
##
## 断言覆盖（spec v3 验收的可无头判定代理 + SKILL.md 冒烟七项）：
##   1. 内容表（acc-spec-consistency 代理）：出战卡 5 张（sunflower/peashooter/frostpea/
##      repeater/wallnut，造价 50/100/175/200/50，坚果 1200 血）；僵尸 5 类绝对数值与
##      掉落面额（walker/runner/conehead/buckethead/gargantuar，巨尸血量固定 2400、碾压型、
##      掉落 100）；生产卡 shots=0、双发 shots=2、寒冰 slow>0
##   2. 关卡表（acc-difficulty-curve，spec v3 难度曲线上调口径）：8 关逐关锚定
##      spec.numeric.difficulty（波数 4→10 / 总僵尸 12→63 / hpScale 1.00→2.85 /
##      speedScale 1.00→1.42 / 加权血量 100→449.9 / 加权速度 18→33 / 平均每波 3→6.3），
##      单调性机判（波数不减、总数/倍率/加权值严格递增 = 「难度逐关抬升、无整体回落」）；
##      起始阳光 100/150/150/100/150/200/250/250；编制只用已声明种类、种类数逐关不减；
##      L1 单一种类教学 + 引导声明；L4 阳光紧缩声明（天降 24s/15 + 卡槽禁双发）；
##      L6 存在单波 ≥3 类；L7/L8 boss 波次落点（4&9 / 7&10）
##   3. 对比度（acc-contrast）：WCAG 2.x 逐对复算 ≥3.0（含夜幕剪影 #6b7f94 vs 遮罩
##      #0d1626 = 4.39），渲染常量（FlatUI）与声明色值一致
##   4. 音频契约（acc-audio-complete / acc-mute-instant +「核查 bus 音量」）：BGM 就绪且
##      运行时前向循环；总线核查（Master 未静音、增益 0dB、BGM 音量 = spec 0.4 线性 ≈ -8dB）；
##      sfxBindings 全 8 类音效已注册；静音开关往返即时生效
##   5. 界面流：启动即选关界面（8 关入口 + 无尽入口未解锁隐藏）；进入关卡 → 对战态
##   6. 玩家能移动（四轴「方向」断言，Bug cmvxrs3fv005em905y4eouy35）：逐轴方向 + 支配正交轴
##   7. 核心交互生效：confirm 布防默认卡（向日葵）→ 扣费 + 信号 + 冷却 + 自动取消选卡
##      + L1 教学引导文案在展示（spec levelMechanics.teaching）
##   8. 出战卡系统：选卡→布防花色/扣费跟卡走；经济门/冷却门；教学引导完成态机判
##      （向日葵 ≥1 + 射手 ≥1 且总数 ≥2 → tutorial_done，提示切回常规说明）
##   9. 射击链路：行内僵尸 → 开火 → 命中 → 倒地；击杀掉落阳光拾取物（不直接入账）
##  10. 阳光经济（acc-resource-loop 代理）：点按收集入账；向日葵按周期生产
##  11. 失败可达：僵尸越线 ×5（生命 5）→ game_ended(false) + 结算浮层可见
##  12. 重开可用：结算态 confirm → 对局重置（生命/清场/冷却/选卡复位）
##  13. 下一波（acc-touch-only「提前开波」）：等待态点按提前召唤 → 真实出怪
##  14. 八关逐关通关（acc-playable-loop 无头代理）：第 1→8 关逐关走到胜利——
##      14a. 关卡推进：第 1 关走真实输入链（结算浮层 → confirm「下一关」）；第 2-7 关
##           通关后按直接选关（= level_select 按钮同一状态入口）推进，末关主按钮 = 再玩一次
##      14b. 难度数值逐关生效：每关真实出生路径探针（血量 = 基准×hpScale、速度 =
##           基准×speedScale —— 难度曲线上调真正接进行为）+ L4 卡槽 4 张无双发 +
##           L5 夜幕遮罩（遮罩内剪影 → 进点亮区显形）+ L7 坦克巨尸碾压（接触即摧毁坚果、
##           不进啃食循环、复用 hit+zombie_die 音效）
##      14c. 星级结算（content.replayHooks）：通关入档星级；第 8 关通关 → 无尽解锁
##  15. 无尽模式（acc-playable-loop「通关第 8 关解锁」）：选关页无尽入口可见可点；
##      进入后波次无限（complete_wave 不触发终局）、强度 1.08^波 复合递增、坦克巨尸混编
##  16. 键位契约：动作已注册 + 承诺的物理键全部绑定（逐键 AND）
##  17. 操作说明不常驻：开局提示可见，hint_show_seconds 后自动开始淡出
##  18. 调参协议：TUNING_META 非空；apply_tuning 应用/拒绝/钳制，检查后恢复原值
##
## ⚠️ 输入注入分两个阶段、互不重叠（error-signatures E-08）：
##   headless 下 `Input.parse_input_event()` 的缓冲冲刷会清掉 `Input.action_press()` 状态，
##   同帧混用会让「移动断言」假失败。噪声相位后统一清洗动作状态再进入正式断言。
##
## ⚠️ 帧预算纪律：门禁以 GODOT_SMOKE_FRAMES=240 兜底（--quit-after）。八关扫描靠三件事
##   压进预算：① 结算浮层误触窗走测试通道（GameState.overlay_accept_ms=30ms，生产默认
##   400ms 不变）；② 扫描关伤害走测试通道（projectile_damage 直调，真实伤害链在第 9 项
##   以 spec 数值验证）；③ 每关「跳末波 + 近距放怪」只验证胜负推进路径，波次编制由静态
##   锚点断言覆盖。

## ── 阶段帧数预算（最坏情形合计 = TOTAL_FRAMES ≈ 220 帧 < 门禁 240 帧兜底）──
const NOISE_FRAMES: int = 2         # 对抗输入噪声（原始事件：悬挂手势/孤儿释放/乱键；fuzz 门禁 6 批次全覆盖）
const CLEANUP_FRAMES: int = 2       # 噪声后清洗：释放动作 + 重开一局拿到干净棋盘
const AXIS_HOLD_FRAMES: int = 2     # 每根轴按住注入的帧数（520px/s × 2 帧 ≈ 17px 位移）
const AXES_FRAMES: int = 4 * (AXIS_HOLD_FRAMES + 2)   # 四轴：按下帧 + 保持 + 测量 + 切轴
const PLACE_FRAMES: int = 3         # confirm 注入后等布防生效
const CARDS_FRAMES: int = 8         # 出战卡：选卡动作 → 布防/扣费/经济门/冷却断言
const COMBAT_FRAMES: int = 24       # 等防御单位击杀行内僵尸（含提示淡出断言窗 + 向日葵产出窗）
const LOSE_FRAMES: int = 5          # 5 只越线僵尸 → 生命归零
const RESULT_FRAMES: int = 6        # 结算浮层误触窗（测试通道 30ms ≈ 2 帧）+ 余量
const RESTART_FRAMES: int = 5       # confirm → 再试一次 → 对战态
const NEXTWAVE_FRAMES: int = 4      # 下一波：等待态提前召唤 → 真实出怪
const SWEEP_SETUP_FRAMES: int = 2   # 每关：won_seen 清零 → 关卡断言 + 难度探针 + 胜利尝试
const SWEEP_KILL_FRAMES: int = 14   # 每关：一击必杀（齐射 4.5 帧 + 弹丸飞行 ~5 帧 + 清场判定）
const SWEEP_KILL_L7_FRAMES: int = 18  # L7：含碾压探针子步骤（1 帧碾压生效 + 重建胜利尝试）
const SWEEP_ADVANCE_FRAMES: int = 3 # confirm「下一关」→ level_index 前进断言（仅第 1 关真实链）
const ENDLESS_FRAMES: int = 8       # 无尽模式：入口可见 → 进入 → 出怪 → 强度递增 → boss 混编
## 八关扫描总预算：L1 真实链（setup+kill+advance）+ L2-6/L8 直选 + L7 碾压加量
const SWEEP_FRAMES: int = (SWEEP_SETUP_FRAMES + SWEEP_KILL_FRAMES + SWEEP_ADVANCE_FRAMES) \
	+ 6 * (SWEEP_SETUP_FRAMES + SWEEP_KILL_FRAMES) \
	+ (SWEEP_SETUP_FRAMES + SWEEP_KILL_L7_FRAMES)
const TOTAL_FRAMES: int = NOISE_FRAMES + CLEANUP_FRAMES + AXES_FRAMES + PLACE_FRAMES \
	+ CARDS_FRAMES + COMBAT_FRAMES + LOSE_FRAMES + RESULT_FRAMES \
	+ RESTART_FRAMES + NEXTWAVE_FRAMES + SWEEP_FRAMES + ENDLESS_FRAMES + 2

enum Phase { NOISE, CLEANUP, MOVE, PLACE, CARDS, COMBAT, LOSE, RESULT, RESTART, NEXTWAVE,
	SWEEP_SETUP, SWEEP_KILL, SWEEP_ADVANCE, ENDLESS }

## 位移方向断言的最小分量阈值（期望 17px，8px = 容忍首帧离散的下限）。
const MIN_AXIS_DISPLACEMENT: float = 8.0
## 四轴扫描序（右 → 左 → 上 → 下）：构成菱形，断言后光标回到起点，不污染布防断言。
const AXIS_SEQUENCE: Array[StringName] = [&"move_right", &"move_left", &"move_up", &"move_down"]
## 对局中不设独立「重开」动作（重开入口 = HUD 按钮 + 结算浮层，防误触清局），
## 故动作集 = 模板五动作 + 出战卡五键；键位契约与之对应。
const REQUIRED_ACTIONS: Array[StringName] = [
	&"move_left", &"move_right", &"move_up", &"move_down", &"confirm",
	&"select_card_1", &"select_card_2", &"select_card_3", &"select_card_4", &"select_card_5",
]

## 键位契约：动作 → 键表承诺的物理键，**必须全部绑定**（逐键 AND，不是命中一个就算过）。
## 与 project.godot [input] 的键表对应；「二选一」的键也两边都承诺（模板同款键表）。
const KEY_CONTRACT: Dictionary = {
	&"move_left": [KEY_A, KEY_LEFT],
	&"move_right": [KEY_D, KEY_RIGHT],
	&"move_up": [KEY_W, KEY_UP],
	&"move_down": [KEY_S, KEY_DOWN],
	&"confirm": [KEY_SPACE, KEY_ENTER],
	&"select_card_1": [KEY_1],
	&"select_card_2": [KEY_2],
	&"select_card_3": [KEY_3],
	&"select_card_4": [KEY_4],
	&"select_card_5": [KEY_5],
}

## spec audio.sfxBindings 全 8 类契约音效（SFX_BANK 必须全部注册）。
const SFX_CONTRACT: Array[StringName] = [
	&"shoot", &"hit", &"zombie_die", &"place", &"score", &"wave", &"victory", &"defeat",
]

## spec visual.contrast.lawnCellBase / plantTreatment / nightFog 的声明色
## （渲染常量必须与之一致）。
const DECLARED := {
	"lawn_dark": Color("2b5436"),
	"lawn_light": Color("31603f"),
	"outline": Color("1e3b25"),
	"plant_body": Color("2ecc71"),
	"sunflower_body": Color("f39c12"),
	"zombie_body": Color("bdc3c7"),
	"sun_pickup": Color("f1c40f"),
	"ui_base": Color("22313f"),
	"ui_text": Color("ecf0f1"),
	"ui_primary": Color("3498db"),
	"night_fog": Color("0d1626"),
	"silhouette": Color("6b7f94"),
}
## spec visual.contrast.colorPairs（id, bg, fg）—— 逐对 WCAG 复算 ≥3.0。
const CONTRAST_PAIRS: Array = [
	["plant-body-vs-lawn-dark", "lawn_dark", "plant_body"],
	["plant-body-vs-lawn-light", "lawn_light", "plant_body"],
	["sunflower-body-vs-lawn-dark", "lawn_dark", "sunflower_body"],
	["sunflower-body-vs-lawn-light", "lawn_light", "sunflower_body"],
	["zombie-body-vs-lawn-dark", "lawn_dark", "zombie_body"],
	["zombie-body-vs-lawn-light", "lawn_light", "zombie_body"],
	["sun-pickup-vs-lawn-dark", "lawn_dark", "sun_pickup"],
	["sun-pickup-vs-lawn-light", "lawn_light", "sun_pickup"],
	["sun-counter-vs-ui-base", "ui_base", "sun_pickup"],
	["ui-text-vs-ui-base", "ui_base", "ui_text"],
	["ui-primary-vs-ui-base", "ui_base", "ui_primary"],
	["silhouette-vs-night-fog", "night_fog", "silhouette"],
]

## 八关难度锚点（spec.numeric.difficulty 逐关数值，机算复核对齐 —— 禁止手改）：
## [波数, 僵尸总数, 起始阳光, hpScale, speedScale, 加权血量, 加权速度, 波间隔, 出怪间隔, 首波延迟]
const LEVEL_ANCHORS: Array = [
	[4, 12, 100, 1.0, 1.0, 100.0, 18.0, 20.0, 6.0, 15.0],
	[6, 23, 150, 1.1, 1.05, 133.0, 22.2, 16.0, 5.0, 12.0],
	[7, 29, 150, 1.3, 1.1, 160.9, 25.9, 12.0, 4.5, 10.0],
	[8, 36, 100, 1.5, 1.22, 190.0, 26.8, 15.0, 5.0, 12.0],
	[8, 40, 150, 1.75, 1.25, 249.8, 27.2, 13.0, 4.5, 11.0],
	[9, 52, 200, 2.05, 1.3, 299.6, 29.2, 12.0, 4.0, 10.0],
	[9, 54, 250, 2.4, 1.35, 400.0, 30.0, 11.0, 4.0, 10.0],
	[10, 63, 250, 2.85, 1.42, 449.9, 33.0, 11.0, 3.5, 10.0],
]

var _failures: PackedStringArray = []
var _phase: Phase = Phase.NOISE
var _phase_frames: int = 0
var _total_frames: int = 0
var _finished: bool = false

var _main: Node2D
var _field: Field
var _cursor: Player
var _director: WaveDirector
var _hud: Hud
## 方向断言游标（MOVE 相位：当前轴 / 轴起点）。
var _axis_index: int = -1
var _axis_origin := Vector2.ZERO
var _moved_seen: bool = false
var _placed_seen: bool = false
var _killed_seen: bool = false
var _combat_score_before: int = 0
var _lost_seen: bool = false
var _won_seen: bool = false
var _hint_alpha_at_start: float = -1.0
var _shooter_cell := Vector2i(-1, -1)
## COMBAT 相位的收集断言阶段：0 = 等击杀，1 = 收击杀掉落，2 = 等向日葵产出
var _collect_stage: int = 0
## 八关扫描游标（0 起索引；SWEEP_SETUP / SWEEP_KILL / SWEEP_ADVANCE 循环消费）。
var _sweep_level: int = 0
## L5 夜幕探针僵尸 / L7 碾压探针状态。
var _fog_probe: Zombie = null
var _crush_garg: Zombie = null
var _crush_checked: bool = false
## 无尽模式探针状态（基准血量，供复合递增对比）。
var _endless_base_hp: float = -1.0
var _tuning_backup: Dictionary = {}
var _noise_rng := RandomNumberGenerator.new()


## 场上找指定面额的阳光拾取物（冒烟收集断言用）。
func _find_sun_token(value: int) -> SunToken:
	for token in _field.get_children():
		var sun := token as SunToken
		if sun != null and sun.value == value:
			return sun
	return null


## 在当前关卡槽里找指定花色的卡位（L4 移除双发时自动回退豌豆射手）。
func _roster_index_of(id: StringName, fallback: StringName) -> int:
	var roster: Array[Dictionary] = GameState.roster()
	for i in roster.size():
		if (roster[i].get("id", &"") as StringName) == id:
			return i
	return _roster_index_of_strict(fallback)


func _roster_index_of_strict(id: StringName) -> int:
	var roster: Array[Dictionary] = GameState.roster()
	for i in roster.size():
		if (roster[i].get("id", &"") as StringName) == id:
			return i
	return 0


func _ready() -> void:
	# headless 无垂直同步：限帧让 process : 物理 ≈ 1:1，--quit-after 兜底才有意义
	Engine.max_fps = 60
	_collect_nodes()
	_check_content_tables()
	_check_level_table()
	_check_contrast()
	_check_audio_contract()
	_check_key_bindings()
	_check_tuning_protocol()
	_wire_signals()


func _collect_nodes() -> void:
	_main = get_tree().root.find_child("Main", true, false) as Node2D
	if _main == null:
		_failures.append("场景树找不到 Main（smoke.tscn 未实例化 main.tscn）")
		return
	_field = _main.get_node_or_null("Field") as Field
	_cursor = _main.get_node_or_null("Player") as Player
	_director = _main.get("director") as WaveDirector
	_hud = _main.get_node_or_null("UI/Hud") as Hud
	if _field == null:
		_failures.append("Main 下找不到 Field（main.tscn 战场节点缺失或脚本未挂）")
	if _cursor == null:
		_failures.append("Main 下找不到 Player（布防光标未实例化）")
	if _director == null:
		_failures.append("Main.director 未装配（波次导演缺失，波次推进无从判定）")
	if _hud == null or not _hud.has_method("set_hint"):
		_failures.append("Main/UI/Hud 缺失或未挂 hud.gd（战斗 HUD 断线）")
	if _main.get("mute_button") == null:
		_failures.append("Main.mute_button 未装配（常驻静音开关缺失，spec audio.mute）")
	var game_state := get_tree().root.get_node_or_null("GameState")
	if game_state == null:
		_failures.append("autoload GameState 未注册（project.godot [autoload] 缺失）")
	elif not game_state.has_signal("score_changed"):
		_failures.append("autoload GameState 缺少信号 score_changed（playtest 锚点断线）")
	var level_select: CanvasLayer = _main.get("level_select")
	if level_select == null or not level_select.visible:
		_failures.append("启动后选关界面不可见（应默认进入选关态）")
	elif level_select.get("endless_entry_visible") == null:
		_failures.append("选关界面缺 endless_entry_visible()（无尽入口机判断线）")


func _wire_signals() -> void:
	if _cursor != null:
		_cursor.moved.connect(_on_cursor_moved)
	if _field != null:
		_field.defender_placed.connect(_on_defender_placed)
		_field.zombie_killed.connect(_on_zombie_killed)
	var game_state := get_tree().root.get_node_or_null("GameState")
	if game_state != null and game_state.has_signal("game_ended"):
		game_state.game_ended.connect(_on_game_ended)


func _on_cursor_moved(_position: Vector2) -> void:
	_moved_seen = true


func _on_defender_placed(_defender: Defender) -> void:
	_placed_seen = true


func _on_zombie_killed(_zombie: Zombie) -> void:
	_killed_seen = true


func _on_game_ended(won: bool) -> void:
	if won:
		_won_seen = true
	else:
		_lost_seen = true


## ── 静态断言 ①：内容表（spec.entities / numeric.plants / numeric.zombies 一致性代理）──
func _check_content_tables() -> void:
	# 出战卡：5 张、id/顺序/造价/血量、行为分类
	var expected_cards := [
		[&"sunflower", 50, 300.0], [&"peashooter", 100, 300.0], [&"frostpea", 175, 300.0],
		[&"repeater", 200, 300.0], [&"wallnut", 50, 1200.0],
	]
	if GameState.CARDS.size() != expected_cards.size():
		_failures.append("内容表：出战卡 %d 张 ≠ 5（spec.entities 植物清单失配）" % GameState.CARDS.size())
		return
	var ids := {}
	for i in expected_cards.size():
		var card: Dictionary = GameState.CARDS[i]
		var id: StringName = card.get("id", &"")
		ids[id] = true
		var want: Array = expected_cards[i]
		if id != (want[0] as StringName):
			_failures.append("内容表：第 %d 张卡 id %s ≠ %s（键位 1-5 与 spec 顺序失配）" % [i + 1, id, want[0]])
		if GameState.card_cost_of(id) != int(want[1]):
			_failures.append("内容表：%s 造价 %d ≠ %d" % [id, GameState.card_cost_of(id), want[1]])
		if not is_equal_approx(GameState.card_hp_of(id), float(want[2])):
			_failures.append("内容表：%s 血量 %.0f ≠ %.0f" % [id, GameState.card_hp_of(id), float(want[2])])
	if ids.size() != expected_cards.size():
		_failures.append("内容表：出战卡 id 重复")
	if GameState.card_produces(&"sunflower") != true or GameState.card_shots_of(&"sunflower") != 0:
		_failures.append("内容表：向日葵应为生产单位（produce=true, shots=0）")
	if GameState.card_shots_of(&"repeater") != 2:
		_failures.append("内容表：双发射手应一次两弹（shots=2）")
	if GameState.card_slow_of(&"frostpea") <= 0.0:
		_failures.append("内容表：寒冰射手缺减速（slow ≤ 0）")
	if not is_equal_approx(GameState.card_interval_of(&"repeater"), GameState.fire_interval * 0.5):
		_failures.append("内容表：双发射手射击间隔未按 0.5× 基准派生")
	# 僵尸：5 类绝对数值 + 击杀掉落面额 + 巨尸碾压/固定血量声明
	var expected_zombies := {
		&"walker": [100.0, 18.0, 15], &"runner": [70.0, 36.0, 20],
		&"conehead": [220.0, 18.0, 25], &"buckethead": [400.0, 14.0, 35],
		&"gargantuar": [2400.0, 12.0, 100],
	}
	if GameState.ZOMBIE_KINDS.size() != expected_zombies.size():
		_failures.append("内容表：僵尸 %d 类 ≠ 5（spec.entities 失配，缺坦克巨尸?）" % GameState.ZOMBIE_KINDS.size())
		return
	for kind: StringName in expected_zombies:
		var meta: Dictionary = GameState.ZOMBIE_KINDS.get(kind, {})
		var want: Array = expected_zombies[kind]
		if meta.is_empty():
			_failures.append("内容表：缺僵尸种类 %s" % kind)
			continue
		if not is_equal_approx(float(meta.get("hp", 0.0)), float(want[0])):
			_failures.append("内容表：%s 血量 %.0f ≠ %.0f" % [kind, float(meta.get("hp", 0.0)), float(want[0])])
		if not is_equal_approx(float(meta.get("speed", 0.0)), float(want[1])):
			_failures.append("内容表：%s 速度 %.0f ≠ %.0f" % [kind, float(meta.get("speed", 0.0)), float(want[1])])
		if GameState.kill_reward(kind) != int(want[2]):
			_failures.append("内容表：%s 击杀掉落 %d ≠ %d" % [kind, GameState.kill_reward(kind), int(want[2])])
	if GameState.zombie_crushes(&"gargantuar") != true or GameState.zombie_crushes(&"walker") != false:
		_failures.append("内容表：碾压标记失真（gargantuar 应 crush=true，walker 应 false）")
	if bool(GameState.ZOMBIE_KINDS[&"gargantuar"].get("boss", false)) != true:
		_failures.append("内容表：gargantuar 缺 boss 声明（血量固定不参与 hpScale 的依据）")
	# 生命与初始阳光常量
	if GameState.START_LIVES != 5:
		_failures.append("内容表：初始生命 %d ≠ 5（spec player.lives）" % GameState.START_LIVES)


## ── 静态断言 ②：关卡表与难度曲线上调（spec v3 numeric.difficulty，验收 acc-difficulty-curve）──
func _check_level_table() -> void:
	var levels: Array = GameState.LEVELS
	if levels.size() != LEVEL_ANCHORS.size():
		_failures.append("关卡表 %d 关 ≠ 8（spec v3 八关扩容失配）" % levels.size())
		return
	var prev_waves := 0
	var prev_total := 0
	var prev_hp_scale := -1.0
	var prev_speed_scale := -1.0
	var prev_avg_hp := -1.0
	var prev_avg_speed := -1.0
	var prev_per_wave := -1.0
	var prev_kinds := 0
	var min_gap := INF
	for i in levels.size():
		var cur: Dictionary = levels[i]
		GameState.level_index = i
		var waves: Array = cur.get("waves", [])
		var anchor: Array = LEVEL_ANCHORS[i]
		var total := GameState.level_zombie_count()
		# ① 波数锚点 + 单调不减；僵尸总数锚点 + 严格递增（难度无整体回落）
		if waves.size() != int(anchor[0]):
			_failures.append("第%d关波数 %d ≠ spec %d" % [i + 1, waves.size(), int(anchor[0])])
		if i > 0 and waves.size() < prev_waves:
			_failures.append("难度回落：第%d关波数 %d < 第%d关 %d（波次数须单调不减）" % [
				i + 1, waves.size(), i, prev_waves])
		if total != int(anchor[1]):
			_failures.append("第%d关僵尸总数 %d ≠ spec %d（波次编制与 spec 失配）" % [i + 1, total, int(anchor[1])])
		if i > 0 and total <= prev_total:
			_failures.append("难度回落：第%d关僵尸总数 %d ≤ 第%d关 %d（总数须严格递增）" % [
				i + 1, total, i, prev_total])
		# ② 难度倍率锚点 + 严格递增（hpScale 1.00→2.85 / speedScale 1.00→1.42）
		var hp_scale := GameState.level_hp_scale()
		var speed_scale := GameState.level_speed_scale()
		if absf(hp_scale - float(anchor[3])) > 0.001:
			_failures.append("第%d关 hpScale %.2f ≠ spec %.2f" % [i + 1, hp_scale, float(anchor[3])])
		if absf(speed_scale - float(anchor[4])) > 0.001:
			_failures.append("第%d关 speedScale %.2f ≠ spec %.2f" % [i + 1, speed_scale, float(anchor[4])])
		if i > 0:
			if hp_scale <= prev_hp_scale:
				_failures.append("难度回落：第%d关 hpScale %.2f ≤ 第%d关 %.2f（须严格递增）" % [
					i + 1, hp_scale, i, prev_hp_scale])
			if speed_scale <= prev_speed_scale:
				_failures.append("难度回落：第%d关 speedScale %.2f ≤ 第%d关 %.2f（须严格递增）" % [
					i + 1, speed_scale, i, prev_speed_scale])
		# ③ 编制：只声明已知种类；种类数逐关不减；L1 单一种类教学 + 教学引导声明
		var kinds := {}
		for wave: Dictionary in waves:
			for group: Dictionary in wave.get("groups", []):
				var kind: StringName = group.get("kind", &"") as StringName
				if not GameState.ZOMBIE_KINDS.has(kind):
					_failures.append("第%d关编制含未知种类 %s" % [i + 1, kind])
					GameState.level_index = 0
					return
				if int(group.get("count", 0)) <= 0:
					_failures.append("第%d关编制含零/负数量（%s）" % [i + 1, kind])
					GameState.level_index = 0
					return
				kinds[kind] = true
		if i == 0 and kinds.size() != 1:
			_failures.append("第1关应单一种类教学（实际 %d 种）" % kinds.size())
		if kinds.size() < prev_kinds:
			_failures.append("种类数逐关回落：第%d关 %d 种 < 第%d关 %d 种" % [i + 1, kinds.size(), i, prev_kinds])
		prev_kinds = kinds.size()
		if i == 0 and bool(cur.get("tutorial", false)) != true:
			_failures.append("第1关缺 tutorial 声明（L1 首布防引导机制缺失）")
		# ④ 编制加权平均血量/速度：与 spec 锚点吻合 + 严格递增（第 7 关台阶跃升属 boss 编制，曲线已声明）
		var avg_hp := GameState.level_avg("hp")
		var avg_speed := GameState.level_avg("speed")
		if absf(avg_hp - float(anchor[5])) > 0.06:
			_failures.append("第%d关加权血量 %.1f ≠ spec %.1f（基准×hpScale 加权复算失配）" % [
				i + 1, avg_hp, float(anchor[5])])
		if absf(avg_speed - float(anchor[6])) > 0.06:
			_failures.append("第%d关加权速度 %.1f ≠ spec %.1f（基准×speedScale 加权复算失配）" % [
				i + 1, avg_speed, float(anchor[6])])
		if i > 0:
			if avg_hp <= prev_avg_hp:
				_failures.append("难度回落：第%d关加权血量 %.1f ≤ 第%d关 %.1f" % [i + 1, avg_hp, i, prev_avg_hp])
			if avg_speed <= prev_avg_speed:
				_failures.append("难度回落：第%d关加权速度 %.1f ≤ 第%d关 %.1f" % [i + 1, avg_speed, i, prev_avg_speed])
		# ⑤ 刷新密度：出怪间隔 / 波间隔 / 首波延迟锚点（spec 数值表逐项）；平均每波严格递增
		var interval := float(cur.get("spawn_interval", 0.0))
		var gap := float(cur.get("wave_gap", 0.0))
		var delay := float(cur.get("first_wave_delay", 0.0))
		if absf(interval - float(anchor[8])) > 0.001:
			_failures.append("第%d关 spawn_interval %.1f ≠ spec %.1f" % [i + 1, interval, float(anchor[8])])
		if absf(gap - float(anchor[7])) > 0.001:
			_failures.append("第%d关 wave_gap %.1f ≠ spec %.1f" % [i + 1, gap, float(anchor[7])])
		if absf(delay - float(anchor[9])) > 0.001:
			_failures.append("第%d关 first_wave_delay %.1f ≠ spec %.1f" % [i + 1, delay, float(anchor[9])])
		var per_wave := float(total) / float(maxi(waves.size(), 1))
		if i > 0 and per_wave <= prev_per_wave:
			_failures.append("难度回落：第%d关平均每波 %.2f ≤ 第%d关 %.2f（刷新密度须严格递增）" % [
				i + 1, per_wave, i, prev_per_wave])
		prev_per_wave = per_wave
		min_gap = minf(min_gap, gap)
		# ⑥ 起始阳光锚点（spec player.startSun：100/150/150/100/150/200/250/250）
		var start_sun := int(cur.get("start_sun", 0))
		if start_sun != int(anchor[2]):
			_failures.append("第%d关起始阳光 %d ≠ spec %d" % [i + 1, start_sun, int(anchor[2])])
		# ⑦ 机制差异声明（spec numeric.levelMechanics）
		match i:
			3:  # L4 阳光紧缩：天降节流 24s/15 + 卡槽禁双发
				if not is_equal_approx(float(cur.get("sky_drop_interval", 0.0)), 24.0) \
						or int(cur.get("sky_drop_yield", 0)) != 15:
					_failures.append("L4 阳光紧缩：天降节流声明缺失（应 24s/15）")
				var exclude: Array = cur.get("roster_exclude", [])
				if not exclude.has(&"repeater"):
					_failures.append("L4 阳光紧缩：卡槽未禁用双发射手（roster_exclude 缺 repeater）")
			4:  # L5 夜幕迷雾：第 4 列及以右遮罩 + 剪影
				var fog: Dictionary = cur.get("night_fog", {})
				if fog.is_empty() or int(fog.get("lit_cols", -1)) != 3:
					_failures.append("L5 夜幕迷雾：night_fog.lit_cols 声明缺失（应 3 列点亮）")
			5:  # L6 混合高压：存在单波 ≥3 类
				var max_kinds := 0
				for wave: Dictionary in waves:
					max_kinds = maxi(max_kinds, (wave.get("groups", []) as Array).size())
				if max_kinds < 3:
					_failures.append("L6 混合高压：不存在单波 ≥3 类的编制（最多 %d 类）" % max_kinds)
			6:  # L7 boss 关：坦克巨尸于第 4 与最后一波登场
				if _boss_waves(waves) != [4, 9]:
					_failures.append("L7 boss 关：坦克巨尸波次落点 %s ≠ [4, 9]" % str(_boss_waves(waves)))
			7:  # L8 终局：10 波全兵种 + 巨尸压轴（第 7 与第 10 波）
				if _boss_waves(waves) != [7, 10]:
					_failures.append("L8 终局关：坦克巨尸波次落点 %s ≠ [7, 10]" % str(_boss_waves(waves)))
		prev_waves = waves.size()
		prev_total = total
		prev_hp_scale = hp_scale
		prev_speed_scale = speed_scale
		prev_avg_hp = avg_hp
		prev_avg_speed = avg_speed
	# 关卡推进终点（acc-playable-loop）：通关第 8 关解锁无尽模式 → 入口索引必须 = LEVELS.size()
	if GameState.LEVELS.size() != 8:
		_failures.append("关卡推进终点：关卡表 %d 关 ≠ 8（无尽入口索引随之失配）" % GameState.LEVELS.size())
	GameState.level_index = 0


## 波次编制里的坦克巨尸落点（1 起索引的波次号数组）。
func _boss_waves(waves: Array) -> Array:
	var out: Array = []
	for i in waves.size():
		for group: Dictionary in (waves[i] as Dictionary).get("groups", []):
			if (group.get("kind", &"") as StringName) == &"gargantuar":
				out.append(i + 1)
				break
	return out


## ── 静态断言 ③：对比度（acc-contrast：WCAG 逐对复算 + 渲染常量与声明一致）──
func _check_contrast() -> void:
	# 渲染常量 = 声明色值（FlatUI 是场景/HUD 取色唯一来源）
	var render_constants := {
		"lawn_dark": FlatUI.LAWN_DARK, "lawn_light": FlatUI.LAWN_LIGHT,
		"outline": FlatUI.OUTLINE, "plant_body": FlatUI.GREEN,
		"sunflower_body": FlatUI.ORANGE, "zombie_body": FlatUI.ZOMBIE_BODY,
		"sun_pickup": FlatUI.SUN_PICKUP, "ui_base": FlatUI.UI_BASE,
		"ui_text": FlatUI.UI_TEXT, "ui_primary": FlatUI.UI_PRIMARY,
		"night_fog": FlatUI.FOG, "silhouette": FlatUI.SILHOUETTE,
	}
	for key: String in DECLARED:
		if not render_constants[key].is_equal_approx(DECLARED[key]):
			_failures.append("对比度：渲染常量 %s = %s 与声明 %s 不一致" % [
				key, render_constants[key], DECLARED[key]])
	# 逐对复算 WCAG 2.x 对比度 ≥ 3.0（acc-contrast 机判，含夜幕剪影对 = spec 实测 4.39）
	for pair: Array in CONTRAST_PAIRS:
		var ratio := FlatUI.contrast_ratio(DECLARED[pair[1]], DECLARED[pair[2]])
		if ratio < 3.0:
			_failures.append("对比度：%s 实测 %.2f < 3.0（前景与格底不可辨识）" % [pair[0], ratio])


## ── 静态断言 ④：音频契约（acc-audio-complete / acc-mute-instant + bus 音量核查）──
func _check_audio_contract() -> void:
	var audio := get_tree().root.get_node_or_null("Audio")
	if audio == null:
		_failures.append("音频契约：autoload Audio 未注册（BGM 与静音开关断线）")
		return
	if not audio.has_method("has_bgm") or not audio.call("has_bgm"):
		_failures.append("音频契约：BGM 流未就绪（assets/sfx/bgm.wav 缺失或未加载）")
	for name: StringName in SFX_CONTRACT:
		if not Juice.SFX_BANK.has(name) or Juice.SFX_BANK.get(name) == null:
			_failures.append("音频契约：契约音效 %s 未注册（sfxBindings 缺音）" % name)
	# 核查 bus 音量：无启动静音、Master 满增益、BGM 音量 = spec 0.4 线性（≈ -8dB）、循环已开
	var audit: Dictionary = audio.call("bus_audit")
	if bool(audit.get("master_muted", true)):
		_failures.append("音频契约：Master 总线启动即静音（真实无声，静音只能来自静音开关）")
	if not is_equal_approx(float(audit.get("master_volume_db", -99.0)), 0.0):
		_failures.append("音频契约：Master 增益 %.1f dB ≠ 0（bus 音量被启动路径改动）" % float(audit.get("master_volume_db", -99.0)))
	if not bool(audit.get("bgm_loop", false)):
		_failures.append("音频契约：BGM 未开前向循环（手势后无法无缝循环播放）")
	var bgm_db := float(audit.get("bgm_volume_db", -99.0))
	if not is_equal_approx(bgm_db, Audio.BGM_VOLUME_DB):
		_failures.append("音频契约：BGM 音量 %.1f dB ≠ 声明 %.1f dB" % [bgm_db, Audio.BGM_VOLUME_DB])
	if absf(db_to_linear(bgm_db) - Audio.BGM_VOLUME_LINEAR) > 0.01:
		_failures.append("音频契约：BGM 线性音量 %.3f ≠ spec 0.4（db/linear 换算失配）" % db_to_linear(bgm_db))
	# 静音开关：往返即时生效（会话内记忆由 Audio 单例承载）
	var was_muted: bool = audio.call("is_muted")
	audio.call("set_muted", true)
	if not audio.call("is_muted"):
		_failures.append("音频契约：静音开关未即时生效（set_muted(true) 后 is_muted=false）")
	audio.call("set_muted", false)
	if audio.call("is_muted"):
		_failures.append("音频契约：取消静音未即时生效")
	if was_muted:
		audio.call("set_muted", true)


## dB → 线性（20·log10 的逆运算，bus 音量核查用）。
func db_to_linear(db: float) -> float:
	return pow(10.0, db / 20.0)


## 键位契约：目标键表 → project.godot [input] 的 physical_keycode（逐键 AND）。
func _check_key_bindings() -> void:
	for action: StringName in KEY_CONTRACT:
		if not InputMap.has_action(action):
			_failures.append("InputMap 缺少动作 %s（project.godot [input] 未注册）" % action)
			continue
		var expected: Array = KEY_CONTRACT[action]
		var bound: Array[Key] = []
		for event in InputMap.action_get_events(action):
			var key := event as InputEventKey
			if key != null and key.physical_keycode != KEY_NONE:
				bound.append(key.physical_keycode)
		for code: Key in expected:
			if not (code in bound):
				_failures.append("键位契约：动作 %s 未绑定承诺的物理键 %s(%d) —— 真机按了没反应" % [
					action, OS.get_keycode_string(code), code])


## 调参协议（§3C）：非空 META、应用已声明键、拒绝未声明/非数值键、按 max 钳制、恢复原值。
func _check_tuning_protocol() -> void:
	var meta: Variant = GameState.get("TUNING_META")
	if not (meta is Dictionary) or (meta as Dictionary).is_empty():
		_failures.append("调参协议：GameState.TUNING_META 为空（数值调参区必须声明可调键）")
		return
	var original_fire: float = GameState.fire_interval
	var original_cursor: float = GameState.cursor_move_speed
	var applied: PackedStringArray = GameState.apply_tuning({
		"fire_interval": 999.0,
		"tuning_bogus_key": 1,
		"cursor_move_speed": "not-a-number",
	})
	if not applied.has("fire_interval"):
		_failures.append("调参协议：apply_tuning 未应用已声明键 fire_interval")
	if applied.has("tuning_bogus_key"):
		_failures.append("调参协议：apply_tuning 应用了未声明键 tuning_bogus_key")
	if applied.has("cursor_move_speed"):
		_failures.append("调参协议：apply_tuning 应用了非数值输入 cursor_move_speed")
	if GameState.fire_interval > 3.0:
		_failures.append("调参协议：fire_interval=%s 超出 TUNING_META.max=3.0（钳制缺失）" % GameState.fire_interval)
	# 立即恢复：协议检查不得污染被测状态（钳制值可能被后续断言误当真实数值）
	GameState.fire_interval = original_fire
	GameState.cursor_move_speed = original_cursor


## ── 帧驱动（相位状态机）──

func _physics_process(_delta: float) -> void:
	if _finished:
		return
	_total_frames += 1
	_phase_frames += 1
	if _failures.is_empty():
		_step()
	if _total_frames >= TOTAL_FRAMES or not _failures.is_empty():
		_finished = true
		_report()


func _enter(phase: Phase) -> void:
	_phase = phase
	_phase_frames = 0


func _step() -> void:
	match _phase:
		Phase.NOISE:
			_inject_noise_frame()
			if _phase_frames >= NOISE_FRAMES:
				_enter(Phase.CLEANUP)
		Phase.CLEANUP:
			# 清洗噪声残留：释放全部动作 + 孤儿抬起，再重开一局拿到干净棋盘；
			# 射击链路用测试通道提速（真实数值在第 9 项以 spec 数值验证）、
			# 向日葵产出提速、提示停留压到最短、结算误触窗压到 30ms（帧预算纪律见文件头）
			if _phase_frames == 1:
				for action in REQUIRED_ACTIONS:
					Input.action_release(action)
				for touch_id in [0, 1]:
					var orphan := InputEventScreenTouch.new()
					orphan.index = touch_id
					orphan.pressed = false
					orphan.position = Vector2.ZERO
					Input.parse_input_event(orphan)
				if not is_equal_approx(GameState.projectile_damage, 20.0):
					_failures.append("内容表：弹丸伤害默认值 %.1f ≠ spec 20.0" % GameState.projectile_damage)
				_tuning_backup = {
					"fire_interval": GameState.fire_interval,
					"projectile_damage": GameState.projectile_damage,
					"hint_show_seconds": GameState.hint_show_seconds,
					"sunflower_interval": GameState.sunflower_interval,
					"overlay_accept_ms": GameState.overlay_accept_ms,
				}
				GameState.apply_tuning({"fire_interval": 0.15})
				GameState.projectile_damage = 4000.0  # 扫描用一击必杀（测试通道）
				GameState.sunflower_interval = 0.2    # 产出链路提速（测试通道）
				GameState.overlay_accept_ms = 30.0    # 误触窗压缩（测试通道）
				GameState.hint_show_seconds = 0.3     # 淡出断言窗提速（测试通道）
				GameState.start_level(0)
				_check_zombie_behavior()
			if _phase_frames >= CLEANUP_FRAMES:
				# 提示淡出断言的基线：开局提示必须完全可见（先浮现、后淡出）
				_hint_alpha_at_start = _hud.hint_alpha()
				_axis_index = -1
				_enter(Phase.MOVE)
		Phase.MOVE:
			_step_move_axis()
		Phase.PLACE:
			if _phase_frames >= PLACE_FRAMES:
				if _field.defender_count() != 1:
					_failures.append("核心交互：confirm 后场上防御单位 = %d（期望 1）—— 布防链路断裂" % _field.defender_count())
				else:
					var placed := _field.defender_at(_field.get_defender_cells()[0])
					if placed != null and placed.kind != &"sunflower":
						_failures.append("核心交互：默认卡应为向日葵（实际 %s）" % placed.kind)
				var expected_sun: int = GameState.level().get("start_sun", 100) - GameState.card_cost_of(&"sunflower")
				if GameState.sun != expected_sun:
					_failures.append("核心交互：布防未按卡价扣费（阳光 %d ≠ %d）" % [GameState.sun, expected_sun])
				if not _placed_seen:
					_failures.append("信号 Field.defender_placed 未到达订阅方")
				if GameState.selected_card != -1:
					_failures.append("布防后未自动取消选卡（spec：放置即消费，selected=%d）" % GameState.selected_card)
				if GameState.card_cooldowns.size() == GameState.roster().size() \
						and GameState.card_cooldowns[0] <= 0.0:
					_failures.append("布防后卡片未进入冷却（recharge 未启动）")
				# L1 教学引导（spec levelMechanics.teaching）：首布防完成前提示应为引导文案
				if GameState.tutorial_done:
					_failures.append("教学引导：仅布防 1 座向日葵即判定完成（应需 向日葵+射手 各 1）")
				if _hud.hint_alpha() < 1.0:
					_failures.append("教学引导：引导文案在完成前不应进入淡出（alpha=%.2f）" % _hud.hint_alpha())
				_enter(Phase.CARDS)
		Phase.CARDS:
			# 出战卡系统：选卡动作 → 布防花色/扣费跟卡走 → 经济门/冷却门 → 换卡断言
			if _phase_frames == 1:
				GameState.add_sun(500)  # 测试补充弹药（正式经济由收集链路验证）
				_press_action(&"select_card_2")
			elif _phase_frames == 3:
				var sun_before: int = GameState.sun
				if not _field.try_place(_field.cell_center(Vector2i(6, 0))):
					_failures.append("出战卡：切到豌豆后布防失败（选卡链路断裂）")
				var pea_cost: int = GameState.card_cost_of(&"peashooter")
				if GameState.sun != sun_before - pea_cost:
					_failures.append("出战卡：豌豆布防扣费 %d ≠ %d（卡价未跟卡走）" % [
						GameState.sun, sun_before - pea_cost])
				var pea := _field.defender_at(Vector2i(6, 0))
				if pea == null or pea.kind != &"peashooter":
					_failures.append("出战卡：(6,0) 防御单位花色 ≠ peashooter（卡片属性未跟上）")
				_press_action(&"select_card_5")
			elif _phase_frames == 5:
				if not _field.try_place(_field.cell_center(Vector2i(7, 4))):
					_failures.append("出战卡：坚果墙布防失败")
				var nut := _field.defender_at(Vector2i(7, 4))
				if nut == null or not is_equal_approx(nut.max_hp, 1200.0):
					_failures.append("出战卡：坚果墙血量 %.0f ≠ 1200（肉盾卡血量未跟上）" % (nut.max_hp if nut != null else 0.0))
				if GameState.card_cooldowns.size() == GameState.roster().size() \
						and GameState.card_cooldowns[4] <= 0.0:
					_failures.append("出战卡：坚果墙布防后未进入冷却（recharge=20s 未启动）")
				# 冷却中禁止布防（禁用门）
				GameState.select_card(4)
				if GameState.can_place_card(4):
					_failures.append("出战卡：冷却中的卡仍可布防（冷却门失效）")
				GameState.deselect_card()
				for i in GameState.card_cooldowns.size():
					GameState.card_cooldowns[i] = 0.0  # 清冷却，后续相位不受影响
			elif _phase_frames == 6:
				# 经济门：阳光不足禁止布防、失败不扣费
				var sun_backup: int = GameState.sun
				GameState.sun = 10
				GameState.select_card(1)
				if _field.try_place(_field.cell_center(Vector2i(8, 4))):
					_failures.append("出战卡：阳光不足仍布防成功（经济门失效）")
				if GameState.sun != 10:
					_failures.append("出战卡：失败布防不该扣费（%d ≠ 10）" % GameState.sun)
				GameState.sun = sun_backup
			elif _phase_frames >= CARDS_FRAMES:
				if GameState.selected_card != 1:
					_failures.append("出战卡：select 后选中态失真（selected=%d，期望 1）" % GameState.selected_card)
				# 教学引导完成态（L1：向日葵 ≥1 + 射手 ≥1 且总数 ≥2）
				if not GameState.tutorial_done:
					_failures.append("教学引导：向日葵+豌豆射手各 1 座后 tutorial_done 仍未置位（完成态机判断线）")
				# 射击链路：给豌豆射手同行放一只僵尸（开火即射，命中即杀）
				_combat_score_before = GameState.score
				var shooter := _field.defender_at(Vector2i(6, 0))
				if shooter == null:
					_failures.append("射击链路：豌豆射手不在场（布防阶段未生效）")
				else:
					_shooter_cell = shooter.cell
					_field.spawn_zombie(shooter.cell.y, shooter.position.x + 180.0, &"walker")
				_enter(Phase.COMBAT)
		Phase.COMBAT:
			# 操作说明不常驻（排版硬底线）：开局可见 → hint_show_seconds 后自动开始淡出
			if _phase_frames == 1 and _hint_alpha_at_start >= 0.0 and _hint_alpha_at_start < 1.0:
				_failures.append("操作提示：开局就不完全可见（alpha=%.2f，应先浮现后淡出）" % _hint_alpha_at_start)
			if _phase_frames == 22 and _hud.hint_alpha() >= 1.0:
				_failures.append("操作说明常驻：22 帧后提示仍未开始淡出（硬底线：提示须自动消失）")
			if _killed_seen and _collect_stage == 0:
				_collect_stage = 1
				if GameState.score != _combat_score_before:
					_failures.append("阳光经济：击杀直接入账（%d ≠ %d）—— v2 击杀只掉落拾取物，须点按收集" % [
						GameState.score, _combat_score_before])
				if _field.sun_token_count() < 1:
					_failures.append("阳光经济：击杀未掉落阳光拾取物（killReward 断线）")
				if Juice.events.is_empty():
					_failures.append("反馈断言：布防→开火→击杀没有触发任何 Juice 反馈（玩起来是哑的）")
			elif _collect_stage == 1 and _phase_frames > 1:
				# 点按收集 ①：击杀掉落的拾取物 → 点按入账（对局中，running=true）
				var kill_token := _find_sun_token(GameState.kill_reward(&"walker"))
				if kill_token != null:
					var sun_before: int = GameState.sun
					_field._handle_tap(kill_token.position)
					if GameState.sun != sun_before + kill_token.value:
						_failures.append("阳光经济：点按收集未按面额入账（%d ≠ %d+%d）" % [
							GameState.sun, sun_before, kill_token.value])
					_collect_stage = 2
			elif _collect_stage == 2:
				# 点按收集 ②：向日葵按周期产出（间隔已调速 0.2s）→ 点按入账
				var produced := _find_sun_token(int(GameState.sunflower_yield))
				if produced != null:
					var sun_before2: int = GameState.sun
					_field._handle_tap(produced.position)
					if GameState.sun != sun_before2 + produced.value:
						_failures.append("阳光经济：向日葵产出收集未入账")
					# 失败路径：5 只僵尸直接越线 → 生命归零（收集断言全部完成后）
					for i in 5:
						_field.spawn_zombie(0, Field.DEFENSE_X - 40.0, &"walker")
					_enter(Phase.LOSE)
				elif _phase_frames >= COMBAT_FRAMES:
					_failures.append("阳光经济：向日葵未在周期内产出阳光拾取物（生产链路断裂）")
			elif not _killed_seen and _phase_frames >= COMBAT_FRAMES:
				_failures.append("射击链路：%d 帧内僵尸未被击杀 —— 开火/命中/伤害链路断裂" % COMBAT_FRAMES)
				for i in 5:
					_field.spawn_zombie(0, Field.DEFENSE_X - 40.0, &"walker")
				_enter(Phase.LOSE)
		Phase.LOSE:
			if _phase_frames >= LOSE_FRAMES:
				if not _lost_seen:
					_failures.append("失败不可达：5 次越线后没有 game_ended(false)")
				var overlay: CanvasLayer = _main.get("result_overlay")
				if overlay == null or not overlay.visible:
					_failures.append("失败后结算浮层不可见（出口断线）")
				_enter(Phase.RESULT)
		Phase.RESULT:
			# 结算浮层误触窗（测试通道 30ms）后 confirm → 重开（收集断言已在 COMBAT 完成）
			if _phase_frames >= RESULT_FRAMES:
				_press_action(&"confirm")
				_enter(Phase.RESTART)
		Phase.RESTART:
			if _phase_frames >= RESTART_FRAMES:
				if not GameState.running:
					_failures.append("重开不可用：结算态 confirm 后未回到对局（running=false）")
				if GameState.lives != GameState.START_LIVES:
					_failures.append("重开不可用：生命未重置（%d ≠ %d）" % [GameState.lives, GameState.START_LIVES])
				if _field.defender_count() != 0 or _field.zombie_count() != 0:
					_failures.append("重开不可用：战场未清场（防御 %d / 僵尸 %d）" % [
						_field.defender_count(), _field.zombie_count()])
				if GameState.selected_card != 0:
					_failures.append("重开不可用：选卡未复位（selected=%d，期望 0）" % GameState.selected_card)
				for i in GameState.card_cooldowns.size():
					if GameState.card_cooldowns[i] > 0.0:
						_failures.append("重开不可用：卡片冷却未重置（卡 %d = %.1fs）" % [i, GameState.card_cooldowns[i]])
						break
				_enter(Phase.NEXTWAVE)
		Phase.NEXTWAVE:
			# 提前开波（spec input.next-wave）：等待态点按 → 立即转入出怪并真实出怪
			if _phase_frames == 1:
				if not _director.can_skip_wait():
					_failures.append("下一波：开局首波延迟期不处于等待态（can_skip_wait=false）")
				elif not _director.next_wave():
					_failures.append("下一波：等待态点按提前召唤未生效（next_wave=false）")
			if _phase_frames >= NEXTWAVE_FRAMES:
				if _field.zombie_count() < 1:
					_failures.append("下一波：提前召唤后 %d 帧内没有僵尸出生（出怪链路断裂）" % NEXTWAVE_FRAMES)
				if _director.can_skip_wait():
					_failures.append("下一波：召唤后仍处于等待态（状态未推进）")
				# 八关扫描（acc-playable-loop）：第 1 关的胜利尝试即扫描起点（真实推进链），
				# 随后逐关「通关 → 直选下一关」推进到第 8 关
				_sweep_level = 0
				_won_seen = false
				_begin_level_victory_attempt()
				_enter(Phase.SWEEP_KILL)
		Phase.SWEEP_SETUP:
			_step_sweep_setup()
		Phase.SWEEP_KILL:
			_step_sweep_kill()
		Phase.SWEEP_ADVANCE:
			_step_sweep_advance()
		Phase.ENDLESS:
			_step_endless()


## 僵尸行为探针（同步、即建即清）：种类绝对数值 + hpScale/speedScale 接线 + 啃咬节拍 + 冻结减速。
func _check_zombie_behavior() -> void:
	var walker := _field.spawn_zombie(0, Field.SPAWN_X, &"walker")
	var step := absf(walker.advance(0.5).x)
	if not is_equal_approx(step, 9.0):  # 18 px/s × 1.0(speedScale L1) × 0.5s
		_failures.append("行为探针：walker 速度 %.1f px/s ≠ 18" % (step / 0.5))
	if not is_equal_approx(walker.max_hp, 100.0):
		_failures.append("行为探针：walker 血量 %.1f ≠ 100×hpScale(1.0)" % walker.max_hp)
	if not is_equal_approx(walker.bite_cooldown, GameState.bite_interval):
		_failures.append("行为探针：啃咬冷却初值 %.2f ≠ bite_interval %.2f" % [walker.bite_cooldown, GameState.bite_interval])
	# 坦克巨尸（spec combat.crush / numeric.zombies）：血量固定 2400（不乘 hpScale）、碾压型
	var garg := _field.spawn_zombie(2, Field.SPAWN_X, &"gargantuar")
	if not is_equal_approx(garg.max_hp, 2400.0):
		_failures.append("行为探针：坦克巨尸血量 %.0f ≠ 2400（boss 不参与 hpScale 被破坏）" % garg.max_hp)
	if not is_equal_approx(garg.speed, 12.0):
		_failures.append("行为探针：坦克巨尸速度 %.1f ≠ 12×speedScale(1.0)" % garg.speed)
	if not garg.crushes:
		_failures.append("行为探针：坦克巨尸 crushes 未置位（碾压机制断线）")
	# 难度倍率接进行为：切到第 7 关口径复测 walker（100×2.4 = 240）
	GameState.level_index = 6
	var scaled := _field.spawn_zombie(3, Field.SPAWN_X, &"walker")
	if absf(scaled.max_hp - 240.0) > 0.01:
		_failures.append("行为探针：第 7 关口径 walker 血量 %.1f ≠ 240（hpScale 未接进出生路径）" % scaled.max_hp)
	GameState.level_index = 0
	var runner := _field.spawn_zombie(1, Field.SPAWN_X, &"runner")
	runner.apply_slow(0.4)
	var slowed := absf(runner.advance(0.5).x)
	if not is_equal_approx(slowed, 36.0 * 0.6 * 0.5):
		_failures.append("行为探针：寒冰冻结后速度因子 %.2f ≠ 0.6（spec combat.freeze）" % (slowed / (36.0 * 0.5)))
	_field.clear_all()


## ── 断言 6（Bug cmvxrs3fv005em905y4eouy35）：四轴「方向」断言 ──
## 逐轴按住注入并测量位移分量：方向错（上下反/左右反/轴串了）在这里必红，
## 只看位移量级的旧断言（move_right 位移 ≥1px）对这类键位缺陷完全失明。
func _step_move_axis() -> void:
	var hold_end := AXIS_HOLD_FRAMES + 2
	if _phase_frames == 1:
		_axis_index += 1
		if _axis_index >= AXIS_SEQUENCE.size():
			_failures.append("四轴断言：轴序越界（内部状态错）")
			return
		_axis_origin = _cursor.global_position
		Input.action_press(AXIS_SEQUENCE[_axis_index])
	elif _phase_frames >= hold_end:
		var action: StringName = AXIS_SEQUENCE[_axis_index]
		Input.action_release(action)
		var delta := _cursor.global_position - _axis_origin
		var along := delta.x if (action == &"move_right" or action == &"move_left") else delta.y
		var across := delta.y if (action == &"move_right" or action == &"move_left") else delta.x
		var expected_sign := 1.0
		match action:
			&"move_right", &"move_down":
				expected_sign = 1.0
			&"move_left", &"move_up":
				expected_sign = -1.0
		if along * expected_sign < MIN_AXIS_DISPLACEMENT:
			_failures.append("方向断言：%s 按住 %d 帧位移分量 %.1fpx 未向期望方向（右/下应为正、左/上应为负，阈值 %.1f）—— 动作未生效或轴映射反了" % [
				action, AXIS_HOLD_FRAMES, along, MIN_AXIS_DISPLACEMENT])
		if absf(along) <= absf(across):
			_failures.append("方向断言：%s 的本轴分量 |%.1f| 未支配正交轴 |%.1f| —— 按一根键动了两个轴（轴串了）" % [
				action, along, across])
		if not _moved_seen:
			_failures.append("信号 Player.moved 未到达订阅方：连接断裂或从未 emit")
		if _axis_index >= AXIS_SEQUENCE.size() - 1:
			_press_action(&"confirm")  # 四轴走完：在光标格布防（核心交互的输入入口）
			_enter(Phase.PLACE)
		else:
			_phase_frames = 0  # 切下一根轴（_axis_index 在下一段首帧推进）


## ── 断言 14（acc-playable-loop 无头代理）：八关逐关通关扫描 ──
## 每关四件事：① 关卡推进核对（到达的关 + 波次表/起始阳光/等待态切换）；
## ② 难度数值逐关生效（真实出生路径探针：基准×hpScale/speedScale 接进行为）；
## ③ 机制探针（L4 卡槽减员 / L5 夜幕剪影 / L7 坦克巨尸碾压）；
## ④ 布防（射手）+ 跳末波 + 放 walker → 一击清场 → game_ended(true)。
## 推进链：第 1 关通关走真实输入（结算浮层 → confirm「下一关」）；第 2-7 关通关后按
## 直接选关推进（= level_select 按钮回调的同一状态入口，GameState.start_level）。

## 胜利尝试（真实路径）：清场 → 补测试弹药 → 选射手 → 布防 → 跳末波 → 本行近距放 walker
## （伤害走测试通道一击必杀；近距 48px 压弹丸飞行帧数）。
func _begin_level_victory_attempt() -> void:
	_field.clear_all()
	GameState.add_sun(500)  # 测试补充弹药（正式经济由收集链路断言验证）
	for i in GameState.card_cooldowns.size():
		GameState.card_cooldowns[i] = 0.0  # 测试通道清冷却（L7 碾压探针后的二次尝试需要）
	GameState.select_card(_roster_index_of(&"repeater", &"peashooter"))
	var shooter_cell := Vector2i(1, 2)
	if not _field.try_place(_field.cell_center(shooter_cell)):
		_failures.append("第 %d 关：布防失败（阳光 %d），逐关胜利无从验证" % [
			_sweep_level + 1, GameState.sun])
		return
	var defender := _field.defender_at(shooter_cell)
	var expected_kind: StringName = &"repeater" \
			if GameState.roster().any(func(entry: Dictionary) -> bool:
				return (entry.get("id", &"") as StringName) == &"repeater") \
			else &"peashooter"
	if defender == null or defender.kind != expected_kind:
		_failures.append("第 %d 关：布防花色 %s ≠ %s（选卡未跟上扫关卡）" % [
			_sweep_level + 1, defender.kind if defender != null else "null", expected_kind])
		return
	_director.debug_jump_to_final_wave()
	_field.spawn_zombie(defender.cell.y, defender.position.x + 48.0, &"walker")


func _step_sweep_setup() -> void:
	var level := _sweep_level
	if _phase_frames == 1:
		# 胜利信号是「单关一次」的观测量：上一关通关置位后不重置，本关 SWEEP_KILL 会在
		# 开局第一帧就误判「已通关」（结算浮层早已关闭）—— 逐关进入时必须清零
		_won_seen = false
		_crush_checked = false
		_fog_probe = null
		_crush_garg = null
		return
	if _phase_frames < SWEEP_SETUP_FRAMES:
		return
	var cfg: Dictionary = GameState.LEVELS[level]
	# ① 关卡推进核对：到达的确实是这一关，关卡数值切到了本关
	if GameState.level_index != level:
		_failures.append("关卡推进：期望在第 %d 关，实际 level_index=%d（推进断线）" % [
			level + 1, GameState.level_index])
	if not GameState.running:
		_failures.append("关卡推进：第 %d 关未进入对局态（running=false）" % [level + 1])
	if GameState.wave_count() != (cfg.get("waves", []) as Array).size():
		_failures.append("难度数值逐关生效：第 %d 关波数 %d ≠ 表值 %d（关卡表没接进行为）" % [
			level + 1, GameState.wave_count(), (cfg.get("waves", []) as Array).size()])
	if GameState.sun != int(cfg.get("start_sun", -1)):
		_failures.append("难度数值逐关生效：第 %d 关起始阳光 %d ≠ 表值 %d" % [
			level + 1, GameState.sun, int(cfg.get("start_sun", -1))])
	if not _director.can_skip_wait():
		_failures.append("难度数值逐关生效：第 %d 关开局未处于首波等待态（begin_level 未随关执行）" % [
			level + 1])
	if GameState.wave_index != 0:
		_failures.append("关卡推进：第 %d 关开局波次指针 %d ≠ 0" % [level + 1, GameState.wave_index])
	# ② 难度数值逐关生效：真实出生路径探针（基准×hpScale/speedScale 接进行为，即建即清）
	var probe := _field.spawn_zombie(2, Field.SPAWN_X, &"walker")
	var expect_hp := GameState.zombie_hp_of(&"walker")
	var expect_speed := GameState.zombie_speed_of(&"walker")
	if absf(probe.max_hp - expect_hp) > 0.01:
		_failures.append("难度数值逐关生效：第 %d 关出生僵尸血量 %.1f ≠ 基准×hpScale %.1f" % [
			level + 1, probe.max_hp, expect_hp])
	if absf(probe.speed - expect_speed) > 0.01:
		_failures.append("难度数值逐关生效：第 %d 关出生僵尸速度 %.1f ≠ 基准×speedScale %.1f" % [
			level + 1, probe.speed, expect_speed])
	# ④ 胜利尝试先行（射手布防 + 跳末波 + 放怪）—— clear_all 之后再放机制探针，
	#   避免探针实体被清场误删（L7 碾压探针的坚果/巨尸必须活到 SWEEP_KILL）
	_begin_level_victory_attempt()
	# ③ 机制探针（spec levelMechanics 差异化）
	match level:
		3:  # L4 阳光紧缩：卡槽 4 张且无双发射手（真实 roster 接进本关）
			var roster: Array[Dictionary] = GameState.roster()
			if roster.size() != 4:
				_failures.append("L4 阳光紧缩：卡槽 %d 张 ≠ 4（双发未被移出卡槽）" % roster.size())
			for entry: Dictionary in roster:
				if (entry.get("id", &"") as StringName) == &"repeater":
					_failures.append("L4 阳光紧缩：双发射手仍在卡槽（roster_exclude 未接进行为）")
			if absf(float(cfg.get("sky_drop_interval", 0.0)) - 24.0) > 0.001:
				_failures.append("L4 阳光紧缩：天降间隔 %.0fs ≠ 24s（节流未生效）" % float(cfg.get("sky_drop_interval", 0.0)))
		4:  # L5 夜幕迷雾：遮罩生效 + 遮罩内剪影（显形在 SWEEP_KILL 第 2 帧核对）
			if not _field.fog_active():
				_failures.append("L5 夜幕迷雾：夜幕遮罩未生效（fog_active=false）")
			elif absf(_field.fog_boundary_x() - (Field.GRID_ORIGIN.x + 3.0 * Field.CELL_W)) > 0.5:
				_failures.append("L5 夜幕迷雾：点亮区边界 x=%.0f ≠ 前 3 列（lit_cols 未接进绘制层）" % _field.fog_boundary_x())
			_fog_probe = _field.spawn_zombie(4, Field.SPAWN_X, &"walker")
		6:  # L7 boss 关：坦克巨尸碾压探针（坚果墙在另一行阻挡，接触即毁）
			GameState.add_sun(500)
			GameState.select_card(_roster_index_of(&"wallnut", &"wallnut"))
			var nut_cell := Vector2i(2, 4)
			if not _field.try_place(_field.cell_center(nut_cell)):
				_failures.append("L7 boss 关：碾压探针坚果墙布防失败")
			else:
				_crush_garg = _field.spawn_zombie(4, _field.cell_center(nut_cell).x + 30.0, &"gargantuar")
	_enter(Phase.SWEEP_KILL)


func _step_sweep_kill() -> void:
	var level := _sweep_level
	var is_last := level >= GameState.LEVELS.size() - 1
	var result_overlay := _main.get("result_overlay") as ResultOverlay
	# L5 夜幕剪影探针（帧序对齐 Field 的 tick：剪影回写发生在 Field._advance_world）
	if level == 4 and _fog_probe != null and _field.fog_active():
		if _phase_frames == 2 and not _fog_probe.silhouetted:
			_failures.append("L5 夜幕迷雾：遮罩区内僵尸未进入剪影态（silhouetted=false）")
		if _phase_frames == 3:
			_fog_probe.position.x = _field.fog_boundary_x() - 40.0  # 拖进前 3 列点亮区
		if _phase_frames == 4:
			if _fog_probe.silhouetted:
				_failures.append("L5 夜幕迷雾：僵尸进入前 3 列点亮区后仍为剪影（未显形）")
			# 探针收尾：拖过防线走真实突破路径移除，不挡本关清场判定（扣 1 生命属预期）
			_fog_probe.position.x = Field.DEFENSE_X - 40.0
	# L7 碾压探针：第 1 帧世界 tick 过后坚果应已被接触碾压（spec combat.crush）
	if level == 6 and not _crush_checked and _phase_frames == 2:
		_crush_checked = true
		var nut := _field.defender_at(Vector2i(2, 4))
		if nut != null:
			_failures.append("L7 boss 关：坦克巨尸接触坚果墙 %d 帧后未被碾压（crush 断线）" % _phase_frames)
		if _crush_garg != null and _crush_garg.eating:
			_failures.append("L7 boss 关：坦克巨尸进入啃食循环（crush 应绕过 bite，spec combat.crush）")
		var crushed_seen := false
		for event in Juice.events:
			if event.begins_with("sfx:zombie_die"):
				crushed_seen = true
		if not crushed_seen:
			_failures.append("L7 boss 关：碾压未复用 zombie_die 音效（spec combat.crush.sfx）")
		# 探针收尾：清掉巨尸与坚果残局，重建本关胜利尝试（射手 + 近距 walker）
		_begin_level_victory_attempt()
	# 误触窗纪律：通关信号出现后等浮层可受理（误触窗已走测试通道 30ms）再注入
	var confirm_ready := _won_seen and (is_last
			or (result_overlay != null and result_overlay.can_accept()))
	if confirm_ready:
		if result_overlay == null or not result_overlay.visible:
			_failures.append("第 %d 关：通关后结算浮层不可见（逐关胜利出口断线）" % [level + 1])
		var action: String = result_overlay.primary_action() if result_overlay != null else ""
		var expected_action := "replay" if is_last else "next"
		if action != expected_action:
			_failures.append("第 %d 关：通关后主按钮语义 %s ≠ %s（逐关推进入口断线）" % [
				level + 1, action, expected_action])
		# 击杀掉落行为核对：walker 击杀必须掉落 sun_drop 面额拾取物（kind 表接进行为）
		if _find_sun_token(GameState.kill_reward(&"walker")) == null:
			_failures.append("第 %d 关：击杀掉落拾取物缺失（sun_drop 断线）" % [level + 1])
		# 星级结算（spec content.replayHooks）：通关入档 1-3 星
		var stars := int(GameState.level_stars[level]) if level < GameState.level_stars.size() else 0
		if stars < 1 or stars > 3:
			_failures.append("第 %d 关：通关后星级未入档（level_stars[%d]=%d）" % [level + 1, level, stars])
		# 逐关取证：本行随 GODOT_SMOKE 日志落盘，验收节点可直接核对「八关逐关通关 + 推进」
		print("[smoke] 第 %d 关通关（game_ended=true，主按钮 %s，波次 %d/%d，★%d，hpScale %.2f）" % [
			level + 1, action, GameState.wave_index, GameState.wave_count(), stars,
			GameState.level_hp_scale()])
		if is_last:
			# 第 8 关通关 → 无尽解锁（acc-playable-loop），转无尽模式探针
			if not GameState.endless_unlocked:
				_failures.append("无尽模式：通关第 8 关后 endless_unlocked 未置位（解锁断线）")
			_enter(Phase.ENDLESS)
		elif level == 0:
			_press_action(&"confirm")  # 真实输入路径：结算浮层「下一关」（仅第 1 关）
			_enter(Phase.SWEEP_ADVANCE)
		else:
			# 第 2-7 关：直接选关推进（= level_select 按钮回调的同一状态入口）
			_advance_to(level + 1)
	elif _phase_frames >= (SWEEP_KILL_L7_FRAMES if (level == 6 and _crush_checked) or is_last
			else SWEEP_KILL_FRAMES):
		if not _won_seen:
			_failures.append("逐关胜利不可达：第 %d 关末波清场后 %d 帧内没有 game_ended(true)" % [
				level + 1, SWEEP_KILL_FRAMES])
		else:
			_failures.append("第 %d 关：通关后结算浮层误触窗期满 confirm 仍未被受理 —— 下一关推进入口断线" % [
				level + 1])


func _step_sweep_advance() -> void:
	if _phase_frames < SWEEP_ADVANCE_FRAMES:
		return
	var target := _sweep_level + 1
	if GameState.level_index != target:
		_failures.append("关卡推进：第 %d 关通关 confirm「下一关」后 level_index=%d ≠ %d（真实推进链断线）" % [
			_sweep_level + 1, GameState.level_index, target])
	_advance_to(target)


## 直接选关推进（= level_select 按钮回调 → main._on_level_selected 的同一状态入口）。
func _advance_to(target: int) -> void:
	if target < GameState.LEVELS.size():
		GameState.start_level(target)
	else:
		_failures.append("关卡推进：目标关 %d 越界（内部状态错）" % target)
		return
	_sweep_level = target
	_enter(Phase.SWEEP_SETUP)


## ── 断言 15（acc-playable-loop 尾段）：无尽模式 ──
## 入口可见可点（通关第 8 关解锁）→ 进入（波次无限、complete_wave 不终局）→
## 出怪真实发生 → 强度 1.08^波 复合递增 → 坦克巨尸按编制混编。
func _step_endless() -> void:
	if _phase_frames == 1:
		var level_select: CanvasLayer = _main.get("level_select")
		if level_select == null:
			_failures.append("无尽模式：选关界面缺失")
		else:
			# 回选关页核对入口可见性（endless_unlocked 已在第 8 关通关时置位）
			_main.call("_show_level_select")
			if not level_select.call("endless_entry_visible"):
				_failures.append("无尽模式：通关第 8 关后选关页无尽入口不可见（解锁入口断线）")
		GameState.start_level(GameState.LEVELS.size())
		if not GameState.endless_active:
			_failures.append("无尽模式：start_level(越界索引) 未进入无尽态（endless_active=false）")
		if GameState.sun != GameState.ENDLESS_START_SUN:
			_failures.append("无尽模式：起始阳光 %d ≠ %d" % [GameState.sun, GameState.ENDLESS_START_SUN])
		if not _director.can_skip_wait():
			_failures.append("无尽模式：开局未处于首波等待态（begin_level 未随关执行）")
		if not _director.next_wave():
			_failures.append("无尽模式：提前召唤首波失败")
		_endless_base_hp = GameState.zombie_hp_of(&"walker")
		if absf(_endless_base_hp - 285.0) > 0.01:  # 100 × 2.85（末关 hpScale）× 1.08^0
			_failures.append("无尽模式：首波 walker 血量 %.1f ≠ 285（末关倍率底座失配）" % _endless_base_hp)
		var script0 := GameState.wave_script(0)
		var kinds0 := _wave_kinds(script0)
		if not kinds0.has(&"walker") or kinds0.size() != 1:
			_failures.append("无尽模式：第 1 波编制 %s 应为单 walker 起步" % str(kinds0))
	if _phase_frames == 3:
		if _field.zombie_count() < 1:
			_failures.append("无尽模式：召唤后没有僵尸出生（无尽出怪链路断裂）")
		# 波次推进不终局 + 强度复合递增（1.08^波）+ 坦克巨尸混编
		GameState.complete_wave()
		if not GameState.running:
			_failures.append("无尽模式：波次守完触发了终局（无尽应波次无限）")
		if GameState.wave_index != 1:
			_failures.append("无尽模式：波次指针未推进（%d ≠ 1）" % GameState.wave_index)
		if not _wave_kinds(GameState.wave_script(1)).has(&"runner"):
			_failures.append("无尽模式：第 2 波编制未混入疾跑（编制成长断线）")
		var scaled_hp := GameState.zombie_hp_of(&"walker")
		if scaled_hp <= _endless_base_hp:
			_failures.append("无尽模式：第 2 波 walker 血量 %.1f 未随波递增（1.08^波 复合断线）" % scaled_hp)
		var boss_script := GameState.endless_wave_script(4)
		if not _wave_kinds(boss_script).has(&"gargantuar"):
			_failures.append("无尽模式：编制未按承诺混编坦克巨尸（wave 4 应出现）")
		print("[smoke] 无尽模式探针通过（入口可见、波次无限、强度 %.1f→%.1f、巨尸混编）" % [
			_endless_base_hp, scaled_hp])
		_pass_summary()


## 波次编制的种类集合（去重）。
func _wave_kinds(script: Dictionary) -> Array:
	var kinds: Array = []
	for group: Dictionary in script.get("groups", []):
		var kind := group.get("kind", &"") as StringName
		if not kinds.has(kind):
			kinds.append(kind)
	return kinds


## 全部断言走完（含末关 replay 语义核对 + 无尽模式探针）→ 直接收口报告。
func _pass_summary() -> void:
	_finished = true
	_report()


## 模拟「玩家按键」：注入真实 InputEvent → _unhandled_input 收得到
## （Input.action_press 只改动作强度，产生不了 InputEvent）。
func _press_action(action: StringName) -> void:
	# 无显示设备下模拟「玩家按键」：注入真实 InputEvent → _unhandled_input 收得到
	var event := InputEventAction.new()
	event.action = action
	event.pressed = true
	Input.parse_input_event(event)


## 噪声相位：确定种子对抗输入（原始事件，不含 InputEventAction —— 不污染动作级断言）。
func _inject_noise_frame() -> void:
	if _phase_frames == 1:
		_noise_rng.seed = 20261101  # 门禁要求可复现：同种子同事件序
	var roll := _noise_rng.randf()
	var pos := Vector2(_noise_rng.randf_range(0, 1024), _noise_rng.randf_range(0, 640))
	if roll < 0.30:
		var t := InputEventScreenTouch.new()
		t.index = _noise_rng.randi_range(0, 1)
		t.position = pos
		t.pressed = true
		Input.parse_input_event(t)
	elif roll < 0.45:
		var t2 := InputEventScreenTouch.new()
		t2.index = _noise_rng.randi_range(0, 1)
		t2.position = pos
		t2.pressed = false
		Input.parse_input_event(t2)
	elif roll < 0.60:
		var d := InputEventScreenDrag.new()
		d.index = _noise_rng.randi_range(0, 1)
		d.position = pos
		d.relative = Vector2(_noise_rng.randf_range(-40, 40), _noise_rng.randf_range(-40, 40))
		Input.parse_input_event(d)
	elif roll < 0.80:
		var mb := InputEventMouseButton.new()
		mb.button_index = MOUSE_BUTTON_LEFT
		mb.position = pos
		mb.pressed = _noise_rng.randf() < 0.5
		Input.parse_input_event(mb)
	else:
		var k := InputEventKey.new()
		k.physical_keycode = [KEY_A, KEY_D, KEY_W, KEY_S, KEY_SPACE, KEY_ENTER, KEY_R][_noise_rng.randi_range(0, 6)]
		k.pressed = _noise_rng.randf() < 0.5
		Input.parse_input_event(k)


func _report() -> void:
	# 恢复调参：协议检查与测试通道改过的值不留给后续运行（不得污染被测状态）
	for key: String in _tuning_backup:
		GameState.set(key, _tuning_backup[key])
	if _failures.is_empty():
		print("GODOT_SMOKE: PASS 选关/四轴方向移动/教学引导/布防/出战卡/提示淡出/射击/掉落收集/失败/重开/下一波/八关逐关通关/关卡推进/逐关难度生效/夜幕剪影/坦克巨尸碾压/星级结算/无尽模式/键位契约/内容表/难度曲线锚点/对比度/音频契约与bus音量/调参协议 全部通过")
		get_tree().quit(0)
	else:
		for failure in _failures:
			printerr("GODOT_SMOKE: FAIL %s" % failure)
		get_tree().quit(1)
