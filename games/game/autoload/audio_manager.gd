extends Node
## 自动加载单例 GameAudio：全游戏音效的统一出入口（播放池 / 静音开关 / Web 解锁）。
##
## 注册方式：project.godot [autoload] 写 `GameAudio="*res://autoload/audio_manager.gd"`。
## 规范（见 SKILL.md「GDScript 规范」）：
## - autoload 只放「状态 + 纯逻辑」，不持有业务场景节点；业务方（main.gd）在信号回调里
##   调 play_* 播音，本单例不订阅任何游戏信号（保持单向依赖：场景 → 单例）。
##
## 浏览器自动播放限制（Web 导出）：Chrome/Safari 要求 AudioContext 必须在用户手势之后
## 才允许出声，否则保持 suspended 且首批 play() 被静默吞掉。策略：
## 1) 解锁前（unlocked == false）丢弃一切播放请求；
## 2) _input 收到「首个任意输入事件」（触摸/鼠标/按键）即置 unlocked，并补播一条
##    -60dB 的解锁音 —— 让 AudioContext 真正消费一次播放调用后稳定进入 running 态
##    （部分浏览器只 resume 不消费播放仍会回落 suspended）；
## 3) 主流程用「开始游戏」按钮作为首个必然交互，天然满足手势前置条件。
## 桌面 / headless 无此限制，同一逻辑等价成立（首次输入即解锁），冒烟可机判。

## 静音开关切换完成（参数 = 当前静音态），设置按钮订阅刷新文案。
signal mute_changed(muted: bool)

## 静音偏好持久化位置（user:// 在 Web 导出下映射到 IndexedDB，可跨会话保留）。
const SETTINGS_PATH: String = "user://settings.cfg"
const SETTINGS_SECTION: String = "audio"
const SETTINGS_KEY: String = "muted"

## 音效全部走主总线（工程未拆分子总线，集中一处便于以后调整）。
const MASTER_BUS: String = "Master"
## 播放池大小：同帧多事件（交换音 + 消除音 + 连锁音）不互相掐断；轮转复用。
const POOL_SIZE: int = 10
## 连锁音每深一波的音高倍率（×1.12/波，2 波起生效）与上限。
const COMBO_PITCH_STEP: float = 1.12
const COMBO_MAX_PITCH: float = 2.0
## 解锁音音量：-60dB 人耳不可闻，只为触发 AudioContext 消费一次播放调用。
const UNLOCK_BLIP_DB: float = -60.0

## 事件 → 音频流（assets/audio/LICENSE.md 有逐条来源与 CC0 许可说明）。
const SFX: Dictionary = {
	&"swap": preload("res://assets/audio/swap.wav"),
	&"select": preload("res://assets/audio/select.wav"),
	&"match": preload("res://assets/audio/match.wav"),
	&"combo": preload("res://assets/audio/combo.wav"),
	&"win": preload("res://assets/audio/win.wav"),
	&"lose": preload("res://assets/audio/lose.wav"),
	&"invalid": preload("res://assets/audio/invalid.wav"),
	&"click": preload("res://assets/audio/click.wav"),
}

## 当前是否已静音（AudioServer 主总线同步置哑；播放请求在静音态直接短路）。
var muted: bool = false
## 首个用户交互后置真（Web 自动播放解锁标记），冒烟断言用。
var unlocked: bool = false

## 轮转播放池（_ready 里创建；AudioStreamPlayer 播完自动回到空闲态）。
var _players: Array[AudioStreamPlayer] = []
var _next_player: int = 0


func _ready() -> void:
	for i in POOL_SIZE:
		var player := AudioStreamPlayer.new()
		player.bus = MASTER_BUS
		add_child(player)
		_players.append(player)
	_load_mute_preference()
	AudioServer.set_bus_mute(AudioServer.get_bus_index(MASTER_BUS), muted)


## 首个任意输入 = 首次用户交互：解锁音频（见文件头 Web 自动播放限制说明）。
## 不 set_input_as_handled：解锁是旁路观察，绝不吞事件。
func _input(_event: InputEvent) -> void:
	if unlocked:
		return
	unlocked = true
	_play_on_pool(&"click", UNLOCK_BLIP_DB, 1.0)


## 播放一个命名音效（SFX 键名）；未解锁或静音态静默丢弃。
func play(event: StringName, pitch: float = 1.0) -> void:
	if muted or not unlocked:
		return
	_play_on_pool(event, 0.0, pitch)


## 连锁音：wave 为连锁波次（第 1 波走普通消除音，第 2 波起逐波升调）。
func play_combo(wave: int) -> void:
	if wave < 2:
		play(&"match")
		return
	var pitch: float = minf(pow(COMBO_PITCH_STEP, wave - 1), COMBO_MAX_PITCH)
	play(&"combo", pitch)


## 切换静音并持久化；返回切换后的静音态。
func toggle_muted() -> bool:
	set_muted(not muted)
	return muted


func set_muted(value: bool) -> void:
	if muted == value:
		return
	muted = value
	AudioServer.set_bus_mute(AudioServer.get_bus_index(MASTER_BUS), muted)
	_save_mute_preference()
	mute_changed.emit(muted)


## 从播放池取下一个空闲位播放（轮转复用，同帧多音效不互掐）。
func _play_on_pool(event: StringName, volume_db: float, pitch: float) -> void:
	var stream: AudioStream = SFX.get(event)
	if stream == null or _players.is_empty():
		return
	var player := _players[_next_player]
	_next_player = (_next_player + 1) % _players.size()
	player.stream = stream
	player.volume_db = volume_db
	player.pitch_scale = pitch
	player.play()


func _load_mute_preference() -> void:
	var config := ConfigFile.new()
	if config.load(SETTINGS_PATH) != OK:
		return
	muted = bool(config.get_value(SETTINGS_SECTION, SETTINGS_KEY, false))


func _save_mute_preference() -> void:
	var config := ConfigFile.new()
	config.set_value(SETTINGS_SECTION, SETTINGS_KEY, muted)
	config.save(SETTINGS_PATH)
