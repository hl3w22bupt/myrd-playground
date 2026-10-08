extends Node
## 无头冒烟自检（headless smoke）—— 机器可判定的「游戏能不能跑」。
##
## 运行方式（由 scripts/smoke.sh 封装）：
##   godot --headless --path <工程目录> tests/smoke.tscn
##
## 判定协议（smoke.sh 按此断言退出码与日志）：
##   通过 → stdout 打印 `GODOT_SMOKE: PASS ...`，进程退出码 0
##   失败 → stderr 打印 `GODOT_SMOKE: FAIL <原因>`（每条一行），进程退出码 1
##
## 覆盖面（模板七项断言逐项保留 + 本游戏语义层）：
##   1. 主场景可实例化（main.tscn → blade.tscn / fruit.tscn 接线未断裂）
##   2. autoload GameState 已注册且带约定信号（score_changed / swing_combo / round_ended）
##   3. InputMap 动作已注册、物理键绑定正确（键位契约逐键核对），且注入输入后刀锋真的动了
##   4. 信号真的到达订阅方（Blade.moved / GameState.score_changed / swing_combo / round_ended）
##   5. 每项失败给出可读原因（可直接查 references/error-signatures.md）
##   6. 结果性事件真的挂了反馈（Juice.events 非空 —— 反馈缺失 = 玩起来是哑的，SKILL.md §3B）
##   7. 调参协议可判（TUNING_META 非空、apply_tuning 钳制与未知键拒绝、检查后恢复原值 §3C）
##   8. 玩法闭环（需求验收的无头翻译）：单果 +10 → 一刀两果合计 +30（连击加成）→
##      一刀三果累计 +50（combo_bonus_many）→ Combo 提示弹出 → 漏接计数 →
##      切中炸弹立即终局 → 重开可用
##
## ⚠️ 输入注入分两个阶段、互不重叠（error-signatures E-08）：
##   噪声相位（原始事件）→ 动作按住（action_press）→ 动作事件（parse_input_event），各相位错帧。

## ── 噪声相位：确定种子的对抗输入（悬挂手势/孤儿释放/双指抢控/乱键），断言照常全过 = 管线没被楔死 ──
const NOISE_FRAMES: int = 30
## 刀锋移动相位帧数。
const MOVE_FRAMES: int = 10
## 注入挥砍后等待切割/信号送达的帧数。
const CUT_WAIT_FRAMES: int = 8
## 连击窗口自然结算等待（combo_window 0.4s = 24 物理帧，取富余）。
const COMBO_FLUSH_FRAMES: int = 34
## 漏接探针从摆放落到 MISS_Y 的等待帧数（下坠 0.08s ≈ 5 帧，取富余）。
const MISS_WAIT_FRAMES: int = 10
## 炸弹终局等待帧数。
const BOMB_WAIT_FRAMES: int = 8
## 重开等待帧数。
const RESTART_WAIT_FRAMES: int = 8

const F_MOVE_PRESS: int = NOISE_FRAMES + 1
const F_MOVE_END: int = F_MOVE_PRESS + MOVE_FRAMES
const F_PLACE: int = F_MOVE_END + 2
const F_CONFIRM: int = F_PLACE + 1
const F_SCORE_CHECK: int = F_CONFIRM + CUT_WAIT_FRAMES
const F_COMBO_CHECK: int = F_SCORE_CHECK + COMBO_FLUSH_FRAMES
const F_TRIPLE_PLACE: int = F_COMBO_CHECK + 1
const F_TRIPLE_CUT: int = F_TRIPLE_PLACE + 1
const F_TRIPLE_CHECK: int = F_TRIPLE_CUT + COMBO_FLUSH_FRAMES
const F_MISS_PLACE: int = F_TRIPLE_CHECK + 1
const F_MISS_CHECK: int = F_MISS_PLACE + MISS_WAIT_FRAMES
const F_BOMB_PLACE: int = F_MISS_CHECK + 1
const F_BOMB_CUT: int = F_BOMB_PLACE + 1
const F_END_CHECK: int = F_BOMB_CUT + BOMB_WAIT_FRAMES
const F_RESTART: int = F_END_CHECK + 1
const F_TOTAL: int = F_RESTART + RESTART_WAIT_FRAMES

## 判定「刀锋真的移动了」的最小位移（世界单位；10 帧 × blade_speed 14 ≈ 2.3，取下限）。
const MIN_MOVE_DISTANCE: float = 0.5

const REQUIRED_ACTIONS: Array[StringName] = [
	&"move_left", &"move_right", &"move_up", &"move_down", &"confirm",
]

## 键位契约：动作 → 键表承诺的物理键，必须全部绑定（逐键 AND，见模板 smoke.gd 说明）。
const KEY_CONTRACT: Dictionary = {
	&"move_left": [KEY_A, KEY_LEFT],
	&"move_right": [KEY_D, KEY_RIGHT],
	&"move_up": [KEY_W, KEY_UP],
	&"move_down": [KEY_S, KEY_DOWN],
	&"confirm": [KEY_SPACE, KEY_ENTER],
}

var _failures: PackedStringArray = []
var _frames: int = 0
var _finished: bool = false
var _main: Node3D
var _blade: Blade
var _origin: Vector3 = Vector3.ZERO
var _moved_seen: bool = false
var _score_seen: bool = false
var _combo_count_seen: int = 0
var _round_end_reason: StringName = &""


func _ready() -> void:
	# headless 没有垂直同步：限 60 FPS 让 process 帧 : 物理帧 ≈ 1:1，--quit-after 兜底才有意义。
	Engine.max_fps = 60

	for action in REQUIRED_ACTIONS:
		if not InputMap.has_action(action):
			_failures.append("InputMap 缺少动作 %s（project.godot [input] 未注册）" % action)
	_check_key_bindings()

	var game_state := get_tree().root.get_node_or_null("GameState")
	if game_state == null:
		_failures.append("autoload GameState 未注册（project.godot [autoload] 缺失）")
	else:
		for signal_name in ["score_changed", "swing_combo", "round_ended"]:
			if not game_state.has_signal(signal_name):
				_failures.append("autoload GameState 缺少信号 %s" % signal_name)
		game_state.score_changed.connect(_on_score_changed)
		game_state.swing_combo.connect(_on_swing_combo)
		game_state.round_ended.connect(_on_round_ended)
		_check_tuning_protocol(game_state)
		_check_rule_defaults(game_state)

	_main = get_node_or_null("Main") as Node3D
	if _main == null:
		_failures.append("冒烟场景找不到 Main（smoke.tscn 未实例化 scenes/main.tscn）")
	else:
		# 断言确定性：关掉随机抛出并清场 —— 计分/连击/终局断言只认冒烟自己摆放的抛出物。
		_main.call("set_spawning", false)
		_main.call("clear_fruits")

	_blade = get_tree().root.find_child("Blade", true, false) as Blade
	if _blade == null:
		_failures.append("场景树找不到 Blade（main.tscn 未实例化 blade.tscn，或实例名不是 Blade）")
	else:
		_blade.moved.connect(_on_blade_moved)


func _physics_process(_delta: float) -> void:
	if _finished:
		return
	_frames += 1

	if _failures.is_empty():
		if _frames <= NOISE_FRAMES:
			_inject_noise_frame()
		elif _frames == F_MOVE_PRESS:
			_blade.reset_to(Vector3(0, -1, 0))
			_origin = _blade.position
			Input.action_press(&"move_right")
		elif _frames == F_MOVE_END:
			Input.action_release(&"move_right")
			_assert_blade_moved()
		elif _frames == F_PLACE:
			_place_pair()
		elif _frames == F_CONFIRM:
			_press_action(&"confirm")
		elif _frames == F_SCORE_CHECK:
			_assert_pair_scored()
		elif _frames == F_COMBO_CHECK:
			_assert_combo_bonus()
		elif _frames == F_TRIPLE_PLACE:
			_place_triple()
		elif _frames == F_TRIPLE_CUT:
			_press_action(&"confirm")
		elif _frames == F_TRIPLE_CHECK:
			_assert_triple_combo_and_label()
		elif _frames == F_MISS_PLACE:
			_place_miss_probe()
		elif _frames == F_MISS_CHECK:
			_assert_miss_counted()
		elif _frames == F_BOMB_PLACE:
			_place_bomb()
		elif _frames == F_BOMB_CUT:
			_press_action(&"confirm")
		elif _frames == F_END_CHECK:
			_assert_round_ended_by_bomb()
		elif _frames == F_RESTART:
			_press_action(&"confirm")
		elif _frames == F_TOTAL:
			_assert_restart_works()

	if _frames >= F_TOTAL or not _failures.is_empty():
		_finished = true
		_report()


## ── 断言 ──

func _assert_blade_moved() -> void:
	if _blade == null:
		return
	var travelled: float = _blade.position.distance_to(_origin)
	if travelled < MIN_MOVE_DISTANCE:
		_failures.append("刀锋 %d 帧内位移 %.2f < %.2f 世界单位：InputMap 动作未生效或刀锋未消费 move_* 动作" % [
			MOVE_FRAMES, travelled, MIN_MOVE_DISTANCE,
		])
	if not _moved_seen:
		_failures.append("信号 Blade.moved 未到达订阅方：连接断裂或从未 emit")


func _assert_pair_scored() -> void:
	# 需求口径字面值（不用调参变量计算期望：期望跟着参数走就成了恒真式，拦不住错参数）。
	if GameState.apples_sliced != 2:
		_failures.append("核心交互：摆 2 个苹果一刀挥砍后 apples_sliced=%d（期望 2）—— 切割查询未命中碰撞体" % GameState.apples_sliced)
	if GameState.score != 20:
		_failures.append("计分：两果 %d 分（期望 20 = 2×10，需求「每切中 1 个苹果 +10」）—— register_apple_cut 未按单果计分" % GameState.score)
	if not _score_seen:
		_failures.append("信号 GameState.score_changed 未到达订阅方：切割计分链路断裂")


func _assert_combo_bonus() -> void:
	# 需求口径字面值：一刀两果合计 +30（2×10 + 连击加成 10）。
	if GameState.score != 30:
		_failures.append("连击加成：一刀两果合计 %d 分（期望 30，需求「同一刀切中 2 个额外 +10」）—— combo_bonus_pair 未生效" % GameState.score)
	if GameState.max_swing_combo < 2:
		_failures.append("连击统计：max_swing_combo=%d（期望 ≥2）—— 同刀判定窗口未把两果记为一刀" % GameState.max_swing_combo)
	if _combo_count_seen < 2:
		_failures.append("信号 GameState.swing_combo 未到达订阅方（或连击数 <2）：连击提示链路断裂")


func _assert_triple_combo_and_label() -> void:
	# 需求口径字面值：前序累计 30（两果刀）+ 本刀三果 50（3×10 + 20）= 80。
	if GameState.score != 80:
		_failures.append("三果连击：累计 %d 分（期望 80 = 两果刀 30 + 三果 3×10 + 20，需求「三果及以上额外 +20」）—— 一刀三果加分口径与需求不符" % GameState.score)
	if GameState.apples_sliced != 5:
		_failures.append("三果连击：apples_sliced=%d（期望 5 = 两果 + 三果）—— 有苹果没被切中" % GameState.apples_sliced)
	if GameState.max_swing_combo < 3:
		_failures.append("三果连击：max_swing_combo=%d（期望 ≥3）—— 同刀窗口未把三果记为一刀" % GameState.max_swing_combo)
	if _combo_count_seen < 3:
		_failures.append("三果连击：swing_combo 未报 count≥3（实际 %d）—— 连击加成信号断裂" % _combo_count_seen)
	var combo_label: Label = _main.get_node_or_null("UI/ComboLabel") as Label
	if combo_label == null:
		_failures.append("Combo 提示：main.tscn 缺少 UI/ComboLabel 节点")
	elif not combo_label.visible:
		_failures.append("Combo 提示：一刀三果后 ComboLabel 不可见 —— 连击提示未弹出（验收：≥2 连须有提示）")
	elif not combo_label.text.contains("Combo"):
		_failures.append("Combo 提示：ComboLabel 文案 %s 不含 Combo 标识 —— 提示语义缺失" % combo_label.text)


func _assert_miss_counted() -> void:
	if GameState.missed_fruits != 1:
		_failures.append("漏接统计：missed_fruits=%d（期望 1）—— 抛出物落出屏幕下缘未计入漏接（不扣分但须计数）" % GameState.missed_fruits)


func _assert_round_ended_by_bomb() -> void:
	if _round_end_reason != &"bomb":
		_failures.append("炸弹终局：切中炸弹后未收到 round_ended(&\"bomb\")（实际 %s）" % _round_end_reason)
	if GameState.round_active:
		_failures.append("炸弹终局：切中炸弹后 round_active 仍为 true —— 对局没有立即结束")
	var end_panel: Control = _main.get_node_or_null("UI/EndPanel") as Control
	if end_panel == null:
		_failures.append("结算面板：main.tscn 缺少 UI/EndPanel 节点")
	elif not end_panel.visible:
		_failures.append("结算面板：炸弹终局后 EndPanel 未显示 —— 结算链路断裂")


func _assert_restart_works() -> void:
	if not GameState.round_active:
		_failures.append("重开：结算画面按 confirm 后 round_active 仍为 false —— 重开入口未生效")
	if GameState.score != 0:
		_failures.append("重开：重开后 score=%d（期望 0）—— 局内状态未清零" % GameState.score)
	var end_panel: Control = _main.get_node_or_null("UI/EndPanel") as Control
	if end_panel != null and end_panel.visible:
		_failures.append("重开：重开后 EndPanel 仍可见 —— 结算面板未收起")


## ── 确定性摆放与输入注入 ──

func _place_pair() -> void:
	var center: Vector3 = _blade.position
	(_main.call("spawn_fruit", center + Vector3(-0.12, 0, 0), Vector3.ZERO, false) as Fruit)
	(_main.call("spawn_fruit", center + Vector3(0.12, 0, 0), Vector3.ZERO, false) as Fruit)


## 一刀三果的确定性摆放：三枚苹果横排在刀锋 ±0.26 内（原地点击脉冲的球形查询必全覆盖）。
func _place_triple() -> void:
	var center: Vector3 = _blade.position
	(_main.call("spawn_fruit", center + Vector3(-0.26, 0, 0), Vector3.ZERO, false) as Fruit)
	(_main.call("spawn_fruit", center, Vector3.ZERO, false) as Fruit)
	(_main.call("spawn_fruit", center + Vector3(0.26, 0, 0), Vector3.ZERO, false) as Fruit)


## 漏接探针：摆在 MISS_Y（-7.0）上方一点并给向下的初速，数帧内落出屏幕下缘。
func _place_miss_probe() -> void:
	(_main.call("spawn_fruit", Vector3(0, -6.8, 0), Vector3(0, -2, 0), false) as Fruit)


func _place_bomb() -> void:
	(_main.call("spawn_fruit", _blade.position, Vector3.ZERO, true) as Fruit)


## 无显示设备时模拟「玩家按键」：注入真实 InputEvent，让 _unhandled_input 收得到。
func _press_action(action: StringName) -> void:
	var event := InputEventAction.new()
	event.action = action
	event.pressed = true
	Input.parse_input_event(event)


## 键位契约断言：目标键表 → project.godot [input] 的 physical_keycode（逐键 AND）。
func _check_key_bindings() -> void:
	for action: StringName in KEY_CONTRACT:
		if not InputMap.has_action(action):
			continue  # 动作缺失已由 REQUIRED_ACTIONS 断言上报
		var expected: Array = KEY_CONTRACT[action]
		var bound: Array[Key] = []
		for event in InputMap.action_get_events(action):
			var key := event as InputEventKey
			if key != null and key.physical_keycode != KEY_NONE:
				bound.append(key.physical_keycode)
		if not _contains_all(expected, bound):
			_failures.append("键位契约：动作 %s 未绑全键表承诺的物理键（期望全部 %s，实际 %s）—— 缺的那个键真机按了没反应" % [
				action, _key_labels(expected), _key_labels(bound),
			])


func _contains_all(expected: Array, bound: Array[Key]) -> bool:
	for key in expected:
		if not (key in bound):
			return false
	return true


func _key_labels(keys: Array) -> String:
	var labels: PackedStringArray = []
	for code in keys:
		labels.append("%s(%d)" % [OS.get_keycode_string(code as Key), code])
	return "[%s]" % ", ".join(labels)


## ── 噪声相位（与模板同源）：确定种子随机原始事件，不含 InputEventAction ──

var _noise_rng := RandomNumberGenerator.new()


func _inject_noise_frame() -> void:
	if _frames == 1:
		_noise_rng.seed = 20260913  # 门禁要求可复现：同种子同事件序
	var roll := _noise_rng.randf()
	var pos := Vector2(_noise_rng.randf_range(0, 540), _noise_rng.randf_range(0, 960))
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
		k.physical_keycode = [KEY_A, KEY_D, KEY_W, KEY_S, KEY_SPACE, KEY_ENTER][_noise_rng.randi_range(0, 5)]
		k.pressed = _noise_rng.randf() < 0.5
		Input.parse_input_event(k)


## ── 反馈断言（第 6 项）：切割计分这条结果链必须挂了 Juice 反馈 ──
func _assert_feedback_fired() -> void:
	if Juice.events.is_empty():
		_failures.append("反馈断言：切割计分的结果事件没有触发任何 Juice 反馈"
			+ "（结果性事件必须挂 ≥1 条反馈，见 SKILL.md §3B）")


## 调参协议（SKILL.md §3C，纯逻辑无头可判；检查完恢复原值，不污染被测状态）。
func _check_tuning_protocol(game_state: Node) -> void:
	var meta: Variant = game_state.get("TUNING_META")
	if not (meta is Dictionary) or (meta as Dictionary).is_empty():
		_failures.append("调参协议：GameState.TUNING_META 为空或不可读（数值调参区必须声明至少一个可调键）")
		return
	var meta_dict: Dictionary = meta
	var first_key: String = meta_dict.keys()[0]
	var key_meta: Dictionary = meta_dict[first_key]
	var original: Variant = game_state.get(first_key)
	var applied: PackedStringArray = game_state.call("apply_tuning", {first_key: 99999.0, "tuning_bogus_key": 1})
	if not applied.has(first_key):
		_failures.append("调参协议：apply_tuning 未应用已声明键 %s（应用逻辑断裂）" % first_key)
	if applied.has("tuning_bogus_key"):
		_failures.append("调参协议：apply_tuning 应用了未声明键 tuning_bogus_key（必须只认 TUNING_META 声明的键）")
	var tuned: Variant = game_state.get(first_key)
	if not (tuned is float or tuned is int) or float(tuned) > float(key_meta["max"]):
		_failures.append("调参协议：%s=%s 超出 TUNING_META.max=%s（钳制缺失）" % [first_key, tuned, key_meta["max"]])
	if applied.has(first_key) and original != null:
		game_state.set(first_key, original)


## 需求口径锚点：计分与节奏的「默认值」必须等于需求数值。
## 期望值不读取这些变量来算（否则断言跟着参数漂移成恒真式）—— 这里逐个对照需求原文。
func _check_rule_defaults(game_state: Node) -> void:
	var expectations: Array = [
		["round_seconds", 60.0, "单局 60 秒"],
		["apple_points", 10.0, "每切中 1 个苹果 +10"],
		["combo_bonus_pair", 10.0, "一刀两果额外 +10（合计 +30）"],
		["combo_bonus_many", 20.0, "一刀三果及以上额外 +20（合计 +50）"],
		["bomb_ratio", 0.15, "炸弹混入概率约 15%"],
		["spawn_interval_early", 1.5, "0-20s 约 1 个/1.5s"],
		["spawn_interval_mid", 1.0, "20-40s 约 1 个/1s"],
		["spawn_interval_late", 0.7, "40-60s 约 1 个/0.7s"],
	]
	for entry: Array in expectations:
		var actual: Variant = game_state.get(entry[0])
		if actual == null or not is_equal_approx(float(actual), float(entry[1])):
			_failures.append("需求口径：默认值 %s=%s 偏离需求（期望 %s —— %s）" % [
				entry[0], actual, entry[1], entry[2]])


func _report() -> void:
	# 反馈断言收口在报告前：前序任一断言失败时反馈链多半也没机会触发，只在前序全绿时判它。
	if _failures.is_empty():
		_assert_feedback_fired()
	if _failures.is_empty():
		print("GODOT_SMOKE: PASS 场景实例化/autoload/键位契约/刀锋移动/切割计分/两果连击/三果连击+50/Combo提示/漏接计数/炸弹终局/重开/反馈/调参协议 全部通过")
		get_tree().quit(0)
	else:
		for failure in _failures:
			printerr("GODOT_SMOKE: FAIL %s" % failure)
		get_tree().quit(1)


func _on_blade_moved(_position: Vector3) -> void:
	_moved_seen = true


func _on_score_changed(_score: int) -> void:
	_score_seen = true


func _on_swing_combo(count: int, _bonus: int) -> void:
	_combo_count_seen = count


func _on_round_ended(reason: StringName, _stats: Dictionary) -> void:
	_round_end_reason = reason
