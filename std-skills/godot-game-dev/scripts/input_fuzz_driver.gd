# input_fuzz_driver —— 门禁输入鲁棒性 fuzz 的运行时驱动（由 scripts/input-fuzz.sh 生成并运行）。
#
# 职责（通用层，不依赖任何游戏代码）：
#   1. 实例化游戏主场景（读 ProjectSettings 的 run/main_scene）；
#   2. 以确定种子注入随机输入事件流：InputMap 动作、触摸按下/拖动/抬起、鼠标、
#      以及「对抗序列」——按下不抬起（跨批悬挂）、抬起无按下（孤儿释放）、二次按下抢控；
#   3. 分批推进，每批后做活性探针：帧仍在推进、主场景仍在树上、未崩溃；
#   4. 全程零断言假设：不预设任何玩法，只判「任意输入序下进程健康、输入管线不挂死」。
#
# 判定协议（包装脚本 input-fuzz.sh 按此断言）：
#   GODOT_FUZZ: PASS  → 通过
#   GODOT_FUZZ: FAIL <原因> → 失败
#
# 「手势吞没」类的游戏语义不变式（如：任意输入序后一次标准滑动必须生效）属于逐游戏
# 断言，由 tests/smoke.gd 的噪声相位（模板已内置）覆盖：噪声打在前、既有行为断言在后，
# 断言仍全过 = 噪声没有楔死输入管线。本驱动与那层互补：它管崩溃/报错/挂死，不管玩法。
extends Node

## 每批注入帧数。
const BATCH_FRAMES: int = 40
## 批数（总帧 ≈ BATCH_FRAMES × BATCHES + 探针帧）。
const BATCHES: int = 6
## 每帧注入事件数的上界（0~3 个）。
const EVENTS_PER_FRAME_MAX: int = 3

var _rng := RandomNumberGenerator.new()
var _main_scene: Node = null
var _batch: int = 0
var _batch_frame: int = 0
var _actions: Array[StringName] = []
var _hung_batch_frames: int = 0
var _last_process_frames: int = -1
var _done: bool = false


func _ready() -> void:
	var seed_env := OS.get_environment("GODOT_FUZZ_SEED")
	_rng.seed = int(seed_env) if seed_env != "" else 20260913
	var main_scene_path: String = ProjectSettings.get_setting("application/run/main_scene", "")
	if main_scene_path == "":
		print("GODOT_FUZZ: FAIL 工程未设置 application/run/main_scene，fuzz 无从加载游戏")
		get_tree().quit(1)
		return
	var packed: PackedScene = load(main_scene_path)
	if packed == null:
		print("GODOT_FUZZ: FAIL 主场景加载失败: ", main_scene_path)
		get_tree().quit(1)
		return
	_main_scene = packed.instantiate()
	# _ready 期间父节点正在装配子节点，直接 add_child 会被拒（E-19）—— 必须延迟一拍
	get_tree().root.add_child.call_deferred(_main_scene)
	for action in InputMap.get_actions():
		if not String(action).begins_with("ui_"):
			_actions.append(action)
	print("[fuzz] seed=%d batches=%d batch_frames=%d actions=%d main=%s" % [
		_rng.seed, BATCHES, BATCH_FRAMES, _actions.size(), main_scene_path])
	if _actions.is_empty():
		print("GODOT_FUZZ: FAIL InputMap 没有任何自定义动作（游戏没有注册输入）")
		get_tree().quit(1)


func _process(_delta: float) -> void:
	if _done:
		return
	# 挂死探针：process 还在被调（帧计数在走）才可能到这 —— 真挂死由包装脚本的
	# --quit-after/超时兜底判 FAIL，这里管不了自身停转。
	var frames := Engine.get_process_frames()
	if frames == _last_process_frames:
		_hung_batch_frames += 1
	else:
		_hung_batch_frames = 0
	_last_process_frames = frames

	_inject_random_events()

	_batch_frame += 1
	if _batch_frame >= BATCH_FRAMES:
		_batch_frame = 0
		_batch += 1
		if not _probe_alive():
			_done = true
			return
		if _batch >= BATCHES:
			print("GODOT_FUZZ: PASS seed=%d batches=%d total_frames=%d" % [
				_rng.seed, BATCHES, frames])
			_done = true
			get_tree().quit(0)
			return


func _inject_random_events() -> void:
	var count := _rng.randi_range(0, EVENTS_PER_FRAME_MAX)
	for i in count:
		var roll := _rng.randf()
		var pos := Vector2(_rng.randf_range(0, 720), _rng.randf_range(0, 1280))
		if roll < 0.30 and not _actions.is_empty():
			# 动作级按下/抬起
			var action: StringName = _actions[_rng.randi_range(0, _actions.size() - 1)]
			var ev := InputEventAction.new()
			ev.action = action
			ev.pressed = _rng.randf() < 0.55
			ev.strength = 1.0
			Input.parse_input_event(ev)
		elif roll < 0.50:
			# 触摸按下（可能故意不配对抬起 —— 跨批悬挂手势）
			var t := InputEventScreenTouch.new()
			t.index = _rng.randi_range(0, 1)
			t.position = pos
			t.pressed = true
			Input.parse_input_event(t)
		elif roll < 0.65:
			# 触摸拖动（可能没有前置按下 —— 孤儿拖动）
			var d := InputEventScreenDrag.new()
			d.index = _rng.randi_range(0, 1)
			d.position = pos
			d.relative = Vector2(_rng.randf_range(-40, 40), _rng.randf_range(-40, 40))
			Input.parse_input_event(d)
		elif roll < 0.78:
			# 触摸抬起（可能没有前置按下 —— 孤儿释放）
			var t2 := InputEventScreenTouch.new()
			t2.index = _rng.randi_range(0, 1)
			t2.position = pos
			t2.pressed = false
			Input.parse_input_event(t2)
		elif roll < 0.90:
			# 鼠标按下/抬起/移动
			if _rng.randf() < 0.4:
				var mm := InputEventMouseMotion.new()
				mm.position = pos
				mm.relative = Vector2(_rng.randf_range(-30, 30), _rng.randf_range(-30, 30))
				Input.parse_input_event(mm)
			else:
				var mb := InputEventMouseButton.new()
				mb.button_index = MOUSE_BUTTON_LEFT
				mb.position = pos
				mb.pressed = _rng.randf() < 0.5
				Input.parse_input_event(mb)
		else:
			# 按键事件（随机物理键，含边缘键位）
			var k := InputEventKey.new()
			k.physical_keycode = [KEY_A, KEY_D, KEY_W, KEY_S, KEY_SPACE, KEY_ENTER, KEY_R, KEY_ESCAPE][_rng.randi_range(0, 7)]
			k.pressed = _rng.randf() < 0.5
			Input.parse_input_event(k)


## 批后活性探针：主场景仍在树上、帧仍在推进（连续挂死帧超阈值判 FAIL）。
func _probe_alive() -> bool:
	if not is_instance_valid(_main_scene) or not _main_scene.is_inside_tree():
		print("GODOT_FUZZ: FAIL 主场景在第 %d 批后离开场景树（崩溃或被释放）" % _batch)
		get_tree().quit(1)
		return false
	if _hung_batch_frames > BATCH_FRAMES:
		print("GODOT_FUZZ: FAIL 第 %d 批后帧计数停滞（主循环挂死）" % _batch)
		get_tree().quit(1)
		return false
	return true
