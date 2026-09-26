extends Node
## 全局反馈单例（Juice）：把「结果性事件的反馈」收敛成一调用 API，并逐条记录事件。
##
## 来源：minimal-2d 模板 autoload/juice.gd（SKILL.md §3B 反馈完备性协议），
## 随 playtest 门禁接入本工程（playtest_driver 采样 Juice.feedback_fired 作为
## 反馈事件流 —— 单例缺失时机器人试玩 fail-closed）。
##
## 规范（SKILL.md §3B）：结果性事件（得分/收集/命中/失败/确认/升级）至少挂 1 条反馈，
## 且挂在**结果事件的处理函数**上（如 `_on_game_lost`），不挂在输入处理上；
## 移动类连续输入由游戏表现本身承担反馈，不强制挂 Juice。
##
## 音效：SFX_BANK 留空 = 调用合法空转（不报错）。本工程调用点已钉
## &"score" / &"fail" / &"confirm"，音效资产后补时在注册表各加一行即全局出声
## （参照模板 tools/gen_sfx.gd 程序化合成，或替换为音频文件）。

## 反馈触发信号：想对反馈做统计 / 连击 UI 的场景可以订阅；
## 机器人试玩门禁（scripts/playtest.sh + playtest_driver.gd）以它为反馈事件采样锚点。
signal feedback_fired(kind: StringName)

## 音效注册表：名 → AudioStream。留空时 sfx() 静默空转（不报错）——调用点先钉、资产后补。
## 资产就位后形如：&"score": preload("res://assets/sfx/score.wav")。
const SFX_BANK: Dictionary = {}

## 本局反馈记录（"kind@ms"），冒烟断言只看是否非空；环形上限防长局内存膨胀。
var events: PackedStringArray = []

const EVENTS_CAP: int = 512
const SFX_POOL_SIZE: int = 4

var _sfx_pool: Array[AudioStreamPlayer] = []
var _sfx_next: int = 0
var _shake_tween: Tween
var _noise := RandomNumberGenerator.new()


func _ready() -> void:
	_noise.randomize()
	for i in SFX_POOL_SIZE:
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


## 相机震动（命中/爆炸/落地类重结果）。
## 没有 Camera2D 时只记录不位移 —— UI-only 场景调用合法，相机加进来后自动生效。
## 注：本工程的失败/过关震屏由 Main 自己驱动（冒烟 is_shaking() 断言依赖），
## 这里保留模板 API 以备移植与后续统一。
func shake(strength: float = 6.0, duration: float = 0.22) -> void:
	_record(&"shake", null)
	var camera := get_viewport().get_camera_2d()
	if camera == null:
		return
	if _shake_tween != null and _shake_tween.is_valid():
		_shake_tween.kill()
	_shake_tween = create_tween()
	var steps := 6
	for step in steps:
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


## 测试辅助：清空反馈记录（冒烟按时间窗断言 / 试玩每局清窗用）。
func clear_events() -> void:
	events.clear()


func _record(kind: StringName, _target: Node) -> void:
	events.append("%s@%d" % [kind, Time.get_ticks_msec()])
	if events.size() > EVENTS_CAP:
		events.remove_at(0)
	feedback_fired.emit(kind)
