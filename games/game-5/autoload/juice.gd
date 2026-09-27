extends Node
## 全局反馈单例（Juice）—— 模板协议（SKILL.md §3B）在本工程的落地。
##
## 结果性事件与反馈的对应（知识 6e91a11d：连击 UI 反馈必须显式、飘分区分颜色）：
##   收集水果 → pop(水果飘分) + sfx(&"score")；金水果 → sfx(&"golden")
##   坏水果 → sfx(&"bad") + 玩家减速；连击加成 → sfx(&"confirm")
##   倒计时最后 5 秒 → 每跨 1 秒 sfx(&"tick")；被原木击中 → flash + shake + hit_stop + sfx(&"hit"/&"fail")
##   结算界面（两条终局路径共用）→ sfx(&"settle")；重开 → pop(结算面板)
##   原木入场 → flash(原木)（可感知的场上事件）
##
## ── Web 音频门控三件套（知识 82e419bb §3.2，迭代硬契约）──
## 1. 入口门：任何真实用户手势（按键/鼠标/触摸）的输入回调内 unlock_audio() —— 解锁前
##    只记账不播放。Godot Web 引擎只在自身输入回调里 resume AudioContext，所以「解锁」
##    必须与第一次输入同栈发生；壳页面的 document 级 resume 是第二道兜底（覆盖 interrupted）。
## 2. 记账层：sfx() 在解锁前只累计 sfx_counts 与 events（事件名 + 计数），不播放、不报错、
##    不阻塞玩法 —— headless 断言「事件触发了没有」，声波交给浏览器策略。
## 3. 再解锁：unlock_audio() 幂等；解锁状态不随重开一局重置。静音开关独立于解锁，
##    走 AudioServer 总线 mute + 本地持久化（user://game_5_audio.cfg）。
## 局内全部音效走本单例入口，禁止绕过门控直连 AudioStreamPlayer。

## 反馈触发信号：反馈统计 / 连击 UI 可订阅；playtest 门禁以此作为反馈采样锚点。
signal feedback_fired(kind: StringName)
## 静音状态变化（HUD 按钮据此刷新文案）。
signal mute_changed(muted: bool)

## 音效注册表：名 → AudioStream（程序化合成的短音效 assets/sfx/*.wav）。
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

const AUDIO_SAVE_PATH: String = "user://game_5_audio.cfg"

## 本局反馈记录（"kind@ms"），断言只看是否非空；环形上限防长局内存膨胀。
var events: PackedStringArray = []
## 音效记账：名 → 触发次数（含解锁前被门控的次数）。冒烟按它断言「事件发生过」。
var sfx_counts: Dictionary = {}

## 音频解锁状态（首次用户手势后为 true；重开一局不重置）。
var audio_unlocked: bool = false
## 静音开关（用户偏好，本地持久化；与解锁相互独立）。
var muted: bool = false

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
	# 入口门：首个真实手势（按下类按键/鼠标/触摸）即解锁 —— 与引擎自身的
	# AudioContext resume 同栈发生（知识 82e419bb §3.1：引擎只在输入回调里 resume）。
	var is_press := (event is InputEventKey and event.is_pressed()) \
		or (event is InputEventMouseButton and event.is_pressed()) \
		or (event is InputEventScreenTouch and event.is_pressed())
	if is_press:
		unlock_audio()


## 幂等解锁：首次手势后翻标志。不回放解锁前积压的音效（记账已留痕）。
func unlock_audio() -> void:
	if audio_unlocked:
		return
	audio_unlocked = true
	_record(&"audio:unlocked", null)


## 静音开关（用户手势路径调用）：AudioServer 主总线 mute + 持久化。
func set_muted(value: bool) -> void:
	muted = value
	AudioServer.set_bus_mute(AudioServer.get_bus_index("Master"), muted)
	var config := ConfigFile.new()
	config.set_value("audio", "muted", muted)
	config.save(AUDIO_SAVE_PATH)
	_record(&"audio:muted" if muted else &"audio:unmuted", null)
	mute_changed.emit(muted)


func toggle_muted() -> void:
	set_muted(not muted)


func _load_mute_pref() -> void:
	if not FileAccess.file_exists(AUDIO_SAVE_PATH):
		return
	var config := ConfigFile.new()
	if config.load(AUDIO_SAVE_PATH) != OK:
		return
	set_muted(bool(config.get_value("audio", "muted", false)))


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


## 播放注册表里的音效（唯一音频入口）。
## - 未注册名合法空转（记录事件，资产后补即出声）；
## - 解锁前只记账不播放（门控三件套第 2 条）；
## - 静音时只记账不播放（偏好层，与解锁相互独立）。
func sfx(name: StringName, volume_db: float = 0.0) -> void:
	sfx_counts[name] = int(sfx_counts.get(name, 0)) + 1
	var stream: AudioStream = SFX_BANK.get(name)
	if stream == null:
		_record(StringName("sfx:%s(未注册)" % name), null)
		return
	if not audio_unlocked or muted:
		_record(StringName("sfx:%s(记账)" % name), null)
		return
	var player := _sfx_pool[_sfx_next]
	_sfx_next = (_sfx_next + 1) % _sfx_pool.size()
	player.stream = stream
	player.volume_db = volume_db
	player.play()
	_record(StringName("sfx:%s" % name), null)
	return true


## 测试辅助：清空反馈记录（playtest 每局开头会调）。账本 sfx_counts / 解锁状态不清。
func clear_events() -> void:
	events.clear()


func _record(kind: StringName, _target: Node) -> void:
	events.append("%s@%d" % [kind, Time.get_ticks_msec()])
	if events.size() > EVENTS_CAP:
		events.remove_at(0)
	feedback_fired.emit(kind)
