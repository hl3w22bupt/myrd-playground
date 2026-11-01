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
## 断言覆盖（对应需求验收的可无头判定代理 + SKILL.md 冒烟七项）：
##   1. 关卡表：≥ 3 个关卡；相邻关卡波数/血量/速度/啃咬 dps 增幅 ≤ 30%、出怪间隔降幅 ≤ 30%
##      （需求「难度平缓，无断崖」的可判定代理）
##   2. 界面流：启动即选关界面；进入关卡 → 对战态（HUD 可见、光标激活）
##   3. 玩家能移动：注入 move_right 后位移 ≥ 1px，Player.moved 信号到达订阅方
##   4. 核心交互生效：confirm 在光标格布防成功（阳光扣费 + defender_placed 信号 + 布防反馈）
##   5. 射击链路：行内有僵尸 → 防御单位开火 → 弹丸命中 → 僵尸倒地
##      （击杀奖励入账 = score_changed，Juice 反馈非空）
##   6. 失败可达：僵尸越线 ×3 → 生命归零 → game_ended(false) + 结算浮层可见
##   7. 重开可用：结算态（过误触窗）按 confirm → 对局重置（生命/清场）回到对战
##   8. 胜利可达：最后一波清场 → game_ended(true)（真实击杀路径触发）
##   9. 键位契约：动作已注册 + 承诺的物理键全部绑定（逐键 AND）
##  10. 调参协议：TUNING_META 非空；apply_tuning 应用已声明键、拒绝未声明/非数值键、
##      按 max 钳制、检查后恢复原值（不得污染被测状态）
##
## ⚠️ 输入注入分两个阶段、互不重叠（error-signatures E-08）：
##   headless 下 `Input.parse_input_event()` 的缓冲冲刷会清掉 `Input.action_press()` 状态，
##   同帧混用会让「移动断言」假失败。噪声相位后统一清洗动作状态再进入正式断言。

## ── 阶段帧数预算（总计 ≈ 189 帧 < verify.sh 的 240 帧兜底）──
const NOISE_FRAMES: int = 30        # 对抗输入噪声（原始事件：悬挂手势/孤儿释放/乱键）
const CLEANUP_FRAMES: int = 2       # 噪声后清洗：释放动作 + 重开一局拿到干净棋盘
const MOVE_FRAMES: int = 10         # 按住 move_right 的帧数
const PLACE_FRAMES: int = 4         # confirm 注入后等布防生效
const COMBAT_FRAMES: int = 55       # 等防御单位击杀行内僵尸
const LOSE_FRAMES: int = 8          # 3 只越线僵尸 → 生命归零
const RESULT_FRAMES: int = 30       # 结算浮层误触窗（400ms）+ 余量
const RESTART_FRAMES: int = 8       # confirm → 再试一次 → 对战态
const WIN_FRAMES: int = 40          # 最后一波清场 → 通关
const TOTAL_FRAMES: int = NOISE_FRAMES + CLEANUP_FRAMES + MOVE_FRAMES + PLACE_FRAMES \
	+ COMBAT_FRAMES + LOSE_FRAMES + RESULT_FRAMES + RESTART_FRAMES + WIN_FRAMES + 2

enum Phase { NOISE, CLEANUP, MOVE, PLACE, COMBAT, LOSE, RESULT, RESTART, WIN }

const MIN_MOVE_DISTANCE: float = 1.0
## 对局中不设独立「重开」动作（重开入口 = HUD 按钮 + 结算浮层，防误触清局），
## 故动作集为模板五动作；键位契约与之对应。
const REQUIRED_ACTIONS: Array[StringName] = [
	&"move_left", &"move_right", &"move_up", &"move_down", &"confirm",
]

## 键位契约：动作 → 键表承诺的物理键，**必须全部绑定**（逐键 AND，不是命中一个就算过）。
## 与 project.godot [input] 的键表对应；「二选一」的键也两边都承诺（模板同款键表）。
const KEY_CONTRACT: Dictionary = {
	&"move_left": [KEY_A, KEY_LEFT],
	&"move_right": [KEY_D, KEY_RIGHT],
	&"move_up": [KEY_W, KEY_UP],
	&"move_down": [KEY_S, KEY_DOWN],
	&"confirm": [KEY_SPACE, KEY_ENTER],
}

var _failures: PackedStringArray = []
var _phase: Phase = Phase.NOISE
var _phase_frames: int = 0
var _total_frames: int = 0
var _finished: bool = false

var _main: Node2D
var _field: Field
var _cursor: Player
var _director: WaveDirector
var _origin := Vector2.ZERO
var _moved_seen: bool = false
var _placed_seen: bool = false
var _killed_seen: bool = false
var _breach_sun_before: int = 0
var _combat_score_before: int = 0
var _combat_sun_before: int = 0
var _lost_seen: bool = false
var _won_seen: bool = false
var _tuning_backup: Dictionary = {}
var _noise_rng := RandomNumberGenerator.new()


func _ready() -> void:
	# headless 无垂直同步：限帧让 process : 物理 ≈ 1:1，--quit-after 兜底才有意义
	Engine.max_fps = 60
	_collect_nodes()
	_check_level_table()
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
	if _field == null:
		_failures.append("Main 下找不到 Field（main.tscn 战场节点缺失或脚本未挂）")
	if _cursor == null:
		_failures.append("Main 下找不到 Player（布防光标未实例化）")
	if _director == null:
		_failures.append("Main.director 未装配（波次导演缺失，波次推进无从判定）")
	var hud: Control = _main.get_node_or_null("UI/Hud")
	if hud == null or not hud.has_method("set_hint"):
		_failures.append("Main/UI/Hud 缺失或未挂 hud.gd（战斗 HUD 断线）")
	var game_state := get_tree().root.get_node_or_null("GameState")
	if game_state == null:
		_failures.append("autoload GameState 未注册（project.godot [autoload] 缺失）")
	elif not game_state.has_signal("score_changed"):
		_failures.append("autoload GameState 缺少信号 score_changed（playtest 锚点断线）")
	var level_select: CanvasLayer = _main.get("level_select")
	if level_select == null or not level_select.visible:
		_failures.append("启动后选关界面不可见（应默认进入选关态）")


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


## ── 静态断言：关卡表与难度平缓（需求验收 2 的可判定代理）──
func _check_level_table() -> void:
	var levels: Array = GameState.LEVELS
	if levels.size() < 3:
		_failures.append("关卡表只有 %d 关（需求要求至少 3 关 + 选关入口）" % levels.size())
		return
	for i in range(1, levels.size()):
		var prev: Dictionary = levels[i - 1]
		var cur: Dictionary = levels[i]
		for key: String in ["waves", "zombies_per_wave", "zombie_hp", "zombie_speed", "eat_dps"]:
			var before := float(prev.get(key, 0.0))
			var after := float(cur.get(key, 0.0))
			if before > 0.0 and (after - before) / before > 0.30:
				_failures.append("难度断崖：第%d→%d关 %s 增幅 %.0f%% > 30%%" % [
					i, i + 1, key, (after - before) / before * 100.0])
		var spawn_before := float(prev.get("spawn_interval", 0.0))
		var spawn_after := float(cur.get("spawn_interval", 0.0))
		if spawn_before > 0.0 and spawn_after < spawn_before \
				and (spawn_before - spawn_after) / spawn_before > 0.30:
			_failures.append("难度断崖：第%d→%d关 spawn_interval 降幅 %.0f%% > 30%%" % [
				i, i + 1, (spawn_before - spawn_after) / spawn_before * 100.0])


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
			# 射击链路用调参通道提速（帧预算内验证链路本身，正式数值由 playtest/人工校准）
			if _phase_frames == 1:
				for action in REQUIRED_ACTIONS:
					Input.action_release(action)
				for touch_id in [0, 1]:
					var orphan := InputEventScreenTouch.new()
					orphan.index = touch_id
					orphan.pressed = false
					orphan.position = Vector2.ZERO
					Input.parse_input_event(orphan)
				_tuning_backup = {
					"fire_interval": GameState.fire_interval,
					"projectile_damage": GameState.projectile_damage,
				}
				GameState.apply_tuning({"fire_interval": 0.2, "projectile_damage": 60.0})
				GameState.start_level(0)
			if _phase_frames >= CLEANUP_FRAMES:
				_origin = _cursor.global_position
				Input.action_press(&"move_right")
				_enter(Phase.MOVE)
		Phase.MOVE:
			if _phase_frames >= MOVE_FRAMES:
				Input.action_release(&"move_right")
				var travelled := _cursor.global_position.distance_to(_origin)
				if travelled < MIN_MOVE_DISTANCE:
					_failures.append("玩家 %d 帧内位移 %.2fpx < %.2fpx：InputMap 动作未生效或光标未驱动" % [
						MOVE_FRAMES, travelled, MIN_MOVE_DISTANCE])
				if not _moved_seen:
					_failures.append("信号 Player.moved 未到达订阅方：连接断裂或从未 emit")
				_press_action(&"confirm")
				_enter(Phase.PLACE)
		Phase.PLACE:
			if _phase_frames >= PLACE_FRAMES:
				if _field.defender_count() != 1:
					_failures.append("核心交互：confirm 后场上防御单位 = %d（期望 1）—— 布防链路断裂" % _field.defender_count())
				var expected_sun: int = GameState.START_SUN - int(GameState.defender_cost)
				if GameState.sun != expected_sun:
					_failures.append("核心交互：布防未扣费（阳光 %d ≠ %d）" % [GameState.sun, expected_sun])
				if not _placed_seen:
					_failures.append("信号 Field.defender_placed 未到达订阅方")
				# 射击链路：在防守单位同行右侧放一只僵尸（开火即射，命中即杀）
				_combat_score_before = GameState.score
				_combat_sun_before = GameState.sun
				var cells := _field.get_defender_cells()
				if cells.is_empty():
					_failures.append("射击链路：场上没有防御单位可测（布防阶段未生效）")
				else:
					var defender := _field.defender_at(cells[0])
					_field.spawn_zombie(defender.cell.y, defender.position.x + 180.0)
				_enter(Phase.COMBAT)
		Phase.COMBAT:
			if _killed_seen or _phase_frames >= COMBAT_FRAMES:
				if not _killed_seen:
					_failures.append("射击链路：%d 帧内僵尸未被击杀 —— 开火/命中/伤害链路断裂" % COMBAT_FRAMES)
				else:
					if GameState.score <= _combat_score_before:
						_failures.append("射击链路：击杀后 score 未增长（击杀奖励断线）")
					if GameState.sun <= _combat_sun_before:
						_failures.append("射击链路：击杀奖励阳光未入账（资源闭环断线）")
					if Juice.events.is_empty():
						_failures.append("反馈断言：布防→开火→击杀没有触发任何 Juice 反馈（玩起来是哑的）")
				# 失败路径：3 只僵尸直接越线 → 生命归零
				for i in 3:
					_field.spawn_zombie(0, Field.DEFENSE_X - 40.0)
				_enter(Phase.LOSE)
		Phase.LOSE:
			if _phase_frames >= LOSE_FRAMES:
				if not _lost_seen:
					_failures.append("失败不可达：3 次越线后没有 game_ended(false)")
				var overlay: CanvasLayer = _main.get("result_overlay")
				if overlay == null or not overlay.visible:
					_failures.append("失败后结算浮层不可见（出口断线）")
				_enter(Phase.RESULT)
		Phase.RESULT:
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
				# 胜利路径：跳到最后一波，用真实「布防 → 开火 → 击杀 → 清场」触发通关
				_director.debug_jump_to_final_wave()
				_field.try_place(_field.cell_center(Vector2i(1, 1)))
				var win_cells := _field.get_defender_cells()
				if win_cells.is_empty():
					_failures.append("胜利路径：布防失败，无法验证通关可达")
				else:
					var win_defender := _field.defender_at(win_cells[0])
					_field.spawn_zombie(win_defender.cell.y, win_defender.position.x + 200.0)
				_enter(Phase.WIN)
		Phase.WIN:
			if _won_seen or _phase_frames >= WIN_FRAMES:
				if not _won_seen:
					_failures.append("胜利不可达：最后一波清场后 %d 帧内没有 game_ended(true)" % WIN_FRAMES)


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
	var pos := Vector2(_noise_rng.randf_range(0, 960), _noise_rng.randf_range(0, 540))
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
	# 恢复调参：协议检查与射击提速改过的值不留给后续运行（不得污染被测状态）
	for key: String in _tuning_backup:
		GameState.set(key, _tuning_backup[key])
	if _failures.is_empty():
		print("GODOT_SMOKE: PASS 选关/移动/布防/射击/失败/重开/胜利/键位契约/难度平缓/调参协议 全部通过")
		get_tree().quit(0)
	else:
		for failure in _failures:
			printerr("GODOT_SMOKE: FAIL %s" % failure)
		get_tree().quit(1)
