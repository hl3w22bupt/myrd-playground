extends Node
## 《牛牛打游戏》全局反馈单例（autoload 注册名 Juice）：把「结果性事件的反馈」
## 收敛成一调用 API，并逐条记录事件（反馈是否真的发生 = 无头可判）。
##
## 模板协议（std-skills/godot-game-dev/SKILL.md §3B）：结果性事件（得分/收集/命中/
## 失败/确认/升级）至少挂 1 条反馈，且挂在**结果事件的处理函数**上，不挂在输入处理上。
## playtest 机器人试玩门禁采样本单例的 feedback_fired 信号做「反馈密度/无反馈窗口」
## 代理指标；冒烟断言 Juice.events 非空（反馈接线断了 = 冒烟 FAIL）。
##
## 音效委托：game-8 的发声走既有程序化合成库 Sfx（零外部资产、确定性 PCM），
## 本单例 sfx() 只做「注册表名 → Sfx.play()」的委托与事件记录，不自带音频资产 ——
## 两套发声系统只留一个出声口，避免重复播报。
## Web/iOS 出声的前提是壳页面的音频手势解锁器（部署硬契约），引擎侧只负责可播、不报错。

## 反馈触发信号：playtest 门禁与连击 UI 订阅；冒烟断言不依赖它。
signal feedback_fired(kind: StringName)

## 本局反馈记录（"kind@ms"），冒烟断言只看是否非空；环形上限防长局内存膨胀。
var events: PackedStringArray = []

const EVENTS_CAP: int = 512

var _shake_tween: Tween
var _noise := RandomNumberGenerator.new()


func _ready() -> void:
	_noise.randomize()


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


## 相机震动（命中/胜负/波次切换类重结果）。
## 没有 Camera2D 时只记录不位移 —— UI-only 场景调用合法，相机加进来后自动生效。
func shake(strength: float = 6.0, duration: float = 0.22) -> void:
	_record(&"shake", null)
	var camera := get_viewport().get_camera_2d()
	if camera == null:
		return
	if _shake_tween != null and _shake_tween.is_valid():
		_shake_tween.kill()
	_shake_tween = create_tween()
	var steps := 6
	for step: int in steps:
		var decay := 1.0 - float(step) / float(steps)
		var offset := Vector2(_noise.randf_range(-1.0, 1.0), _noise.randf_range(-1.0, 1.0)) * strength * decay
		_shake_tween.tween_property(camera, "offset", offset, duration / float(steps))
	_shake_tween.tween_property(camera, "offset", Vector2.ZERO, duration / float(steps))


## 顿帧（命中定格）。ignore_time_scale 的计时器保证还原不受 time_scale 影响；
## 连续命中互相覆盖、以最后一次为准，属预期语义。
func hit_stop(duration: float = 0.06) -> void:
	_record(&"hit_stop", null)
	Engine.time_scale = 0.05
	await get_tree().create_timer(duration, true, false, true).timeout
	Engine.time_scale = 1.0


## 播放音效：委托既有程序化合成库 Sfx（未注册名由 Sfx 静默忽略），本单例只记录事件。
func sfx(sound_name: StringName, pitch: float = 1.0) -> void:
	Sfx.play(sound_name, pitch)
	_record(StringName("sfx:%s" % sound_name), null)


## 测试辅助：清空反馈记录（冒烟需要按时间窗断言时用）。
func clear_events() -> void:
	events.clear()


func _record(kind: StringName, _target: Node) -> void:
	events.append("%s@%d" % [kind, Time.get_ticks_msec()])
	if events.size() > EVENTS_CAP:
		events.remove_at(0)
	feedback_fired.emit(kind)
