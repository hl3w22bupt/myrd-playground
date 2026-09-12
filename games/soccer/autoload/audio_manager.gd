extends Node
## 音频管理器（autoload，注册名 AudioManager）：比赛事件音 + 人群氛围 + 静音开关。
##
## Web 自动播放策略（浏览器沙箱）：AudioContext 在用户首次交互前处于挂起状态，
## 引擎层不会报错，但此时播放等于静默 —— 本单例用「解锁门控」显式管理：
##   - 解锁前：play_* 只记账（played_counts / last_event），不触发真正的播放，不阻塞流程；
##   - 解锁：任意「按下」类用户输入（键盘 / 鼠标 / 触摸）到来时自动解锁，并启动人群环境声；
##   - 解锁后：所有事件音正常播放，进球音与人群欢呼分层叠加。
##
## 规范（见 SKILL.md）：autoload 只放状态与纯逻辑；对外只发信号；无头运行（Dummy 音频驱动）
## 全路径零报错 —— 冒烟门禁据此断言。

## 解锁状态变化（首次用户交互后发出一次）；UI 可订阅提示「点按开启音效」。
signal unlocked_changed(unlocked: bool)
## 静音状态变化；HUD 静音按钮订阅它同步文案。
signal mute_changed(muted: bool)

## 哨声种类：开球一声、中场两声、终场三声。
enum Whistle { KICKOFF, HALFTIME, FULLTIME }

## 音效目录（相对工程根；加载时与 res:// 前缀拼接 —— 目录路径不是资源引用，
## 不写完整 res:// 字面量以免 preflight P5 把它当文件核对）。
const AUDIO_SUBDIR: String = "assets/audio"
## 全部音效流键名（与 assets/audio/*.wav 一一对应，缺失只告警不崩溃）。
const STREAM_KEYS: Array[StringName] = [
	&"kick", &"pass", &"steal",
	&"whistle_kickoff", &"whistle_halftime", &"whistle_fulltime",
	&"goal", &"crowd_cheer", &"crowd_ambient",
]
const SFX_VOLUME_DB: float = -4.0
const AMBIENCE_VOLUME_DB: float = -16.0
const CHEER_VOLUME_DB: float = -7.0

## 是否已通过首次用户交互解锁（Web 自动播放策略门控）。
var unlocked: bool = false
## 静音开关（主总线静音，立即生效）。
var muted: bool = false
## 最近一次触发的事件名（冒烟断言用）。
var last_event: StringName = &""
## 每个音效的触发次数（冒烟断言用）。
var played_counts: Dictionary = {}
## 已成功加载的音效流（键 → AudioStream）。
var streams: Dictionary = {}

var _players: Dictionary = {}
var _ambience: AudioStreamPlayer
var _cheer: AudioStreamPlayer


func _ready() -> void:
	for key in STREAM_KEYS:
		var stream := load("res://" + AUDIO_SUBDIR + "/" + String(key) + ".wav") as AudioStream
		if stream == null:
			push_warning("AudioManager: 音效资源缺失 %s（跳过，不影响运行）" % key)
			continue
		streams[key] = stream
		var player := AudioStreamPlayer.new()
		player.name = String(key).to_pascal_case()
		player.stream = stream
		player.volume_db = SFX_VOLUME_DB
		add_child(player)
		_players[key] = player
	_ambience = AudioStreamPlayer.new()
	_ambience.name = "Ambience"
	_ambience.volume_db = AMBIENCE_VOLUME_DB
	_ambience.finished.connect(_on_ambience_finished)
	add_child(_ambience)
	_cheer = AudioStreamPlayer.new()
	_cheer.name = "Cheer"
	_cheer.volume_db = CHEER_VOLUME_DB
	add_child(_cheer)


## 首次用户交互（键盘 / 鼠标 / 触摸按下）→ 解锁音频。只监听、不消费。
func _input(event: InputEvent) -> void:
	if unlocked:
		return
	var is_press: bool = (event is InputEventKey or event is InputEventMouseButton \
		or event is InputEventScreenTouch or event is InputEventJoypadButton) \
		and event.is_pressed()
	if is_press:
		unlock_audio()


## 解锁音频（幂等）：此后事件音真正发声，并启动人群环境声。
func unlock_audio() -> void:
	if unlocked:
		return
	unlocked = true
	_start_ambience()
	unlocked_changed.emit(unlocked)
	# v2.1 F3 双保险：web 平台把解锁同步到壳页手势解锁器，触发真正的
	# AudioContext.resume()。引擎只在输入回调里 resume，且不识别 WebKit 的
	# interrupted 态（见 qa/MOBILE_AUDIO_ROOT_CAUSE.md 疑点 2/6）；壳页
	# （server/src/shell-page.ts）暴露的 window.__soccerUnlock 覆盖两种非 running 态。
	# JavaScriptBridge 仅 web 平台存在，必须以 OS.has_feature 门控（headless 冒烟零影响）。
	if OS.has_feature("web"):
		JavaScriptBridge.eval("window.__soccerUnlock && window.__soccerUnlock();", true)


func set_muted(value: bool) -> void:
	if muted == value:
		return
	muted = value
	AudioServer.set_bus_mute(AudioServer.get_bus_index("Master"), muted)
	if not muted:
		_start_ambience()
	mute_changed.emit(muted)


func toggle_mute() -> void:
	set_muted(not muted)


## ---- 比赛事件音（main.gd 在事件点调用；记账不受解锁/静音影响，便于冒烟断言） ----

func play_named(key: StringName) -> void:
	last_event = key
	played_counts[key] = int(played_counts.get(key, 0)) + 1
	if not unlocked or muted:
		return
	var player: AudioStreamPlayer = _players.get(key)
	if player != null:
		player.play()


func play_kick() -> void:
	play_named(&"kick")


func play_pass() -> void:
	play_named(&"pass")


func play_steal() -> void:
	play_named(&"steal")


func play_whistle(kind: int) -> void:
	match kind:
		Whistle.KICKOFF:
			play_named(&"whistle_kickoff")
		Whistle.HALFTIME:
			play_named(&"whistle_halftime")
		Whistle.FULLTIME:
			play_named(&"whistle_fulltime")
		_:
			play_named(&"whistle_kickoff")


## 进球：进球音 + 人群欢呼分层叠加（两条独立轨道同时发声）。
func play_goal() -> void:
	play_named(&"goal")
	last_event = &"goal"
	if unlocked and not muted and streams.has(&"crowd_cheer"):
		_cheer.stream = streams[&"crowd_cheer"]
		_cheer.play()
		played_counts[&"crowd_cheer"] = int(played_counts.get(&"crowd_cheer", 0)) + 1
	elif not unlocked or muted:
		# 解锁前同样记账，保证断言语义一致（事件确实发生了）。
		played_counts[&"crowd_cheer"] = int(played_counts.get(&"crowd_cheer", 0)) + 1


func start_ambience() -> void:
	if unlocked and not muted:
		_start_ambience()


func _start_ambience() -> void:
	if not streams.has(&"crowd_ambient") or _ambience.playing:
		return
	_ambience.stream = streams[&"crowd_ambient"]
	_ambience.play()


func _on_ambience_finished() -> void:
	# 循环人群环境声（finished → 重播，避免依赖导入元数据里的 loop 标记）。
	if unlocked and not muted and _ambience.stream != null:
		_ambience.play()
