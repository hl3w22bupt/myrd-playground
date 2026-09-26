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
const SFX_BANK: Dictionary = {
	&"score": preload("res://assets/sfx/score.wav"),
	&"confirm": preload("res://assets/sfx/confirm.wav"),
	&"hit": preload("res://assets/sfx/hit.wav"),
	&"fail": preload("res://assets/sfx/fail.wav"),
}

## 本局反馈记录（"kind@ms"），断言只看是否非空；环形上限防长局内存膨胀。
var events: PackedStringArray = []

const EVENTS_CAP: int = 512
const SFX_POOL_SIZE: int = 4

var _sfx_pool: Array[AudioStreamPlayer] = []
var _sfx_next: int = 0
var _shake_tween: Tween
var _noise := RandomNumberGenerator.new()


func _ready() -> void:
	_noise.randomize()
	for i: int in range(SFX_POOL_SIZE):
		var player := AudioStreamPlayer.new()
		player.name = "Sfx%d" % i
		add_child(player)
		_sfx_pool.append(player)


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


## 播放注册表里的音效；未注册的名合法空转（记录事件，资产后补即出声）。
func sfx(name: StringName, volume_db: float = 0.0) -> void:
	var stream: AudioStream = SFX_BANK.get(name)
	if stream == null:
		_record(StringName("sfx:%s(未注册)" % name), null)
		return
	var player := _sfx_pool[_sfx_next]
	_sfx_next = (_sfx_next + 1) % _sfx_pool.size()
	player.stream = stream
	player.volume_db = volume_db
	player.play()
	_record(StringName("sfx:%s" % name), null)


## 测试辅助：清空反馈记录（playtest 每局开头会调）。
func clear_events() -> void:
	events.clear()


func _record(kind: StringName, _target: Node) -> void:
	events.append("%s@%d" % [kind, Time.get_ticks_msec()])
	if events.size() > EVENTS_CAP:
		events.remove_at(0)
	feedback_fired.emit(kind)
