extends Node
## 全局反馈单例（Juice）—— 模板协议（SKILL.md §3B）在本工程的落地。
##
## 结果性事件与反馈的对应（知识 6e91a11d：连击 UI 反馈必须显式、飘分区分颜色）：
##   收集水果 → pop(水果飘分) + sfx(&"score")；连击加成 → pop(连击标签) + sfx(&"confirm")
##   被原木击中 → flash + shake + hit_stop + sfx(&"hit"/&"fail")；时间到 → sfx(&"confirm")
##   重开 → pop(结算面板) + sfx(&"confirm")；原木入场 → flash(原木)（可感知的场上事件）
##
## 音效：SFX_BANK 指向程序化合成的短音效（assets/sfx/*.wav）；未注册名合法空转。
## Web 端出声依赖壳页的音频手势解锁（部署节点硬契约，headless 全绿 ≠ 移动端有声音）。

## 反馈触发信号：反馈统计 / 连击 UI 可订阅；playtest 门禁以此作为反馈采样锚点。
signal feedback_fired(kind: StringName)

## 音效注册表：名 → AudioStream。
## 迭代反馈新增：tick（倒计时末 5 秒告警）、settle（结算）、golden（金水果）、bad（坏水果）。
const SFX_BANK: Dictionary = {
	&"score": preload("res://assets/sfx/score.wav"),
	&"confirm": preload("res://assets/sfx/confirm.wav"),
	&"hit": preload("res://assets/sfx/hit.wav"),
	&"fail": preload("res://assets/sfx/fail.wav"),
	&"tick": preload("res://assets/sfx/tick.wav"),
	&"settle": preload("res://assets/sfx/settle.wav"),
	&"golden": preload("res://assets/sfx/golden.wav"),
	&"bad": preload("res://assets/sfx/bad.wav"),
}

## 本局反馈记录（"kind@ms"），断言只看是否非空；环形上限防长局内存膨胀。
var events: PackedStringArray = []

const EVENTS_CAP: int = 512
const SFX_POOL_SIZE: int = 4

## ── Web 音频门控三件套（知识 82e419bb §三：解锁 / 记账 / 再解锁）──
## GDScript 置「已解锁」标志 ≠ 浏览器真的放行了音频管线；引擎只在真实输入回调里
## resume AudioContext。因此：解锁只允许发生在 _input 捕获到的首个用户手势里；
## 解锁前所有 play 只记账不发声；静音是独立于解锁的用户开关（持久化）。
var audio_unlocked: bool = false
var muted: bool = false

const MUTE_SAVE_SECTION: String = "audio"
const MUTE_SAVE_KEY: String = "muted"

var _sfx_pool: Array[AudioStreamPlayer] = []
var _sfx_next: int = 0
var _shake_tween: Tween
var _noise := RandomNumberGenerator.new()
## Web 端退后台（focus 丢失）后 AudioContext 可能进入 interrupted：标记待再解锁，
## 下一个真实手势再次 unlock（unlock_audio 幂等，重开一局不重置解锁状态）。
var _await_reunlock: bool = false


func _ready() -> void:
	_noise.randomize()
	for i: int in range(SFX_POOL_SIZE):
		var player := AudioStreamPlayer.new()
		player.name = "Sfx%d" % i
		add_child(player)
		_sfx_pool.append(player)
	_load_mute_pref()


func _input(event: InputEvent) -> void:
	# 首个真实用户手势内解锁音频并同步出第一声（入口门：知识 82e419bb §三.2 第 1 条）。
	# 只读事件、不 set_input_as_handled —— 门控不得改变输入分发的既有语义。
	if event is InputEventKey or event is InputEventMouseButton \
			or event is InputEventScreenTouch or event is InputEventScreenDrag:
		var gesture_pressed := true
		if event is InputEventKey or event is InputEventMouseButton or event is InputEventScreenTouch:
			gesture_pressed = event.pressed
		if gesture_pressed and (not audio_unlocked or _await_reunlock):
			unlock_audio()
			sfx(&"confirm", -6.0)


func _notification(what: int) -> void:
	# Web 端退后台 / 锁屏：AudioContext 可能被浏览器挂起，标记「下一次手势再解锁」。
	if what == NOTIFICATION_APPLICATION_FOCUS_OUT and OS.has_feature("web"):
		_await_reunlock = true


## 幂等解锁：翻转标志并记账。真实浏览器侧的 resume 由引擎在输入回调栈内完成，
## 这里只保证「解锁前不发声、解锁后放行」的确定性（headless 可断言的是这层协议）。
func unlock_audio() -> void:
	_await_reunlock = false
	if audio_unlocked:
		return
	audio_unlocked = true
	_record(&"audio_unlocked", null)


## 静音开关（独立于解锁）：静音时 play 全部降级为记账。持久化到用户存档。
func set_muted(value: bool) -> void:
	if muted == value:
		return
	muted = value
	var config := ConfigFile.new()
	config.load(GameState.SAVE_PATH)  # 文件不存在时保留默认，写入其余段不丢
	config.set_value(MUTE_SAVE_SECTION, MUTE_SAVE_KEY, muted)
	config.save(GameState.SAVE_PATH)
	_record(&"muted_on" if muted else &"muted_off", null)


func _load_mute_pref() -> void:
	if not FileAccess.file_exists(GameState.SAVE_PATH):
		return
	var config := ConfigFile.new()
	if config.load(GameState.SAVE_PATH) != OK:
		return
	muted = bool(config.get_value(MUTE_SAVE_SECTION, MUTE_SAVE_KEY, false))


## 弹跳放大后回弹（收集/得分/确认类结果的默认反馈）。
## Control 以中心为轴缩放，pivot_offset 必须在缩放前设置。
func pop(node: Node, amount: float = 1.18, duration: float = 0.16) -> void:
	if node is Control:
		var control := node as Control
		control.pivot_offset = control.size / 2.0
	var tween := node.create_tween()
	tween.tween_property(node, "scale", Vector2.ONE * amount, duration * 0.4) \
		.from(Vector2.ONE).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tween.tween_property(node, "scale", Vector2.ONE, duration * 0.6) \
		.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	_record(&"pop", node)


## 闪一下 modulate（受击/失效/状态切换类结果）。
func flash(node: CanvasItem, color: Color = Color(1, 1, 1, 0.65), duration: float = 0.12) -> void:
	var original := node.modulate
	node.modulate = color
	var tween := node.create_tween()
	tween.tween_property(node, "modulate", original, duration)
	_record(&"flash", node)


## 相机震动（受击类重结果）。
## 没有 Camera2D 时只记录不位移 —— UI-only 场景调用合法，相机加进来后自动生效。
func shake(strength: float = 6.0, duration: float = 0.22) -> void:
	_record(&"shake", null)
	var camera := get_viewport().get_camera_2d()
	if camera == null:
		return
	if _shake_tween != null and _shake_tween.is_valid():
		_shake_tween.kill()
	_shake_tween = create_tween()
	var steps: int = 6
	for step: int in range(steps):
		var decay: float = 1.0 - float(step) / float(steps)
		var offset := Vector2(_noise.randf_range(-1.0, 1.0), _noise.randf_range(-1.0, 1.0)) * strength * decay
		_shake_tween.tween_property(camera, "offset", offset, duration / float(steps))
	_shake_tween.tween_property(camera, "offset", Vector2.ZERO, duration / float(steps))


## 顿帧（重结果定格）。ignore_time_scale 的计时器保证还原不受 time_scale 影响。
func hit_stop(duration: float = 0.06) -> void:
	_record(&"hit_stop", null)
	Engine.time_scale = 0.05
	await get_tree().create_timer(duration, true, false, true).timeout
	Engine.time_scale = 1.0


## 播放注册表里的音效。返回「本次是否真的发声」——事件触发（确定性，headless 可断言）
## 与声波放出（受浏览器音频策略控制）是两层（知识 82e419bb §三.2 第 2 条）：
##   未注册   → 记账 sfx:<name>(未注册)，不发声，返回 false；
##   未解锁   → 记账 gate:<name>，不发声不报错（玩法不阻塞），返回 false；
##   已静音   → 记账 muted:<name>，不发声，返回 false；
##   其余     → 进池播放，返回 true。
func sfx(name: StringName, volume_db: float = 0.0) -> bool:
	var stream: AudioStream = SFX_BANK.get(name)
	if stream == null:
		_record(StringName("sfx:%s(未注册)" % name), null)
		return false
	if not audio_unlocked:
		_record(StringName("gate:%s" % name), null)
		return false
	if muted:
		_record(StringName("muted:%s" % name), null)
		return false
	var player := _sfx_pool[_sfx_next]
	_sfx_next = (_sfx_next + 1) % _sfx_pool.size()
	player.stream = stream
	player.volume_db = volume_db
	player.play()
	_record(StringName("sfx:%s" % name), null)
	return true


## 测试辅助：清空反馈记录（playtest 每局开头会调）。
func clear_events() -> void:
	events.clear()


func _record(kind: StringName, _target: Node) -> void:
	events.append("%s@%d" % [kind, Time.get_ticks_msec()])
	if events.size() > EVENTS_CAP:
		events.remove_at(0)
	feedback_fired.emit(kind)
