extends Node
## 全局反馈单例（Juice）：把「结果性事件的反馈」收敛成一调用 API，并逐条记录事件。
##
## 移植自技能包模板 autoload/juice.gd（SKILL.md §3B）：结果性事件（得分/收集/命中/失败/
## 确认/升级）至少挂 1 条反馈，且挂在**结果事件的处理函数**上（如 `_on_pair_matched`），
## 不挂在输入处理上。事件记录让「反馈真的发生了」变成无头可判（tests/smoke.gd 断言）。
##
## 音效：SFX_BANK 留空 = 调用合法空转（调用点先钉住，音效资产后补即在注册表加一行）。
## Web 导出别忘了壳页面的音频手势解锁（部署节点硬契约，headless 全绿 ≠ 移动端有声音）。

## 反馈触发信号：想对反馈做统计 / 连击 UI 的场景可以订阅；冒烟断言只依赖 events 记录。
signal feedback_fired(kind: StringName)

## 音效注册表：名 → AudioStream。暂无音频资产，留空时 sfx() 静默空转（不报错）。
## 补音效：assets/sfx/ 放入 wav 后在这里加一行 `&"名": preload("res://assets/sfx/名.wav")`。
const SFX_BANK: Dictionary = {}

## 本局反馈记录（"kind@ms"），冒烟断言只看是否非空；环形上限防长局内存膨胀。
var events: PackedStringArray = []

const EVENTS_CAP: int = 512


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


## 相机震动（命中/爆炸/落地类重结果）。
## 没有 Camera2D 时只记录不位移 —— UI-only 场景调用合法，相机加进来后自动生效。
func shake(strength: float = 6.0, duration: float = 0.22) -> void:
	_record(&"shake", null)
	var camera := get_viewport().get_camera_2d()
	if camera == null:
		return
	var tween := create_tween()
	var steps := 6
	for step in steps:
		var decay := 1.0 - float(step) / float(steps)
		var offset := Vector2(randf_range(-1.0, 1.0), randf_range(-1.0, 1.0)) * strength * decay
		tween.tween_property(camera, "offset", offset, duration / float(steps))
	tween.tween_property(camera, "offset", Vector2.ZERO, duration / float(steps))


## 顿帧（命中定格）。ignore_time_scale 的计时器保证还原不受 time_scale 影响；
## 连续命中互相覆盖、以最后一次为准，属预期语义。
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
	var player := AudioStreamPlayer.new()
	add_child(player)
	player.stream = stream
	player.volume_db = volume_db
	player.play()
	player.finished.connect(player.queue_free)
	_record(StringName("sfx:%s" % name), null)


## 测试辅助：清空反馈记录（冒烟需要按时间窗断言时用）。
func clear_events() -> void:
	events.clear()


func _record(kind: StringName, _target: Node) -> void:
	events.append("%s@%d" % [kind, Time.get_ticks_msec()])
	if events.size() > EVENTS_CAP:
		events.remove_at(0)
	feedback_fired.emit(kind)
