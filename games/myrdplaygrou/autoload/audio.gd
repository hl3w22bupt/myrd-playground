extends Node
## 自动加载单例 Audio：背景音乐播放 + 全局静音开关（对「BGM 与音效齐备、静音即时生效」契约）。
##
## 分工：BGM 在这里循环播放；音效走 Juice.sfx（池化播放，注册表见 juice.gd SFX_BANK）。
## 静音 = AudioServer 总线 mute，一次性覆盖 BGM 与全部音效，点击后即时生效。
##
## Web 注意：浏览器音频上下文需要用户手势解锁（部署壳页面契约）。
## 游戏侧兜底：首个人类输入时 ensure_playing() 补一次启动（见 main.gd）。

## BGM 音量（dB）：压低铺底，不抢音效。
const BGM_VOLUME_DB: float = -13.0

var _bgm_player: AudioStreamPlayer
var _started: bool = false


func _ready() -> void:
	_bgm_player = AudioStreamPlayer.new()
	_bgm_player.name = "Bgm"
	var stream: AudioStream = load("res://assets/sfx/bgm.wav")
	if stream is AudioStreamWAV:
		var wav := stream as AudioStreamWAV
		# 运行时打开前向循环（导入默认不循环；16-bit mono 每帧 2 字节）
		wav.loop_mode = AudioStreamWAV.LOOP_FORWARD
		wav.loop_begin = 0
		wav.loop_end = wav.data.size() / 2
	_bgm_player.stream = stream
	_bgm_player.volume_db = BGM_VOLUME_DB
	add_child(_bgm_player)


## 启动 BGM（幂等）。浏览器手势解锁后由 main.gd 首输入回调，或直接在开局调用。
func ensure_playing() -> void:
	if _started:
		return
	_started = true
	if not _bgm_player.playing:
		_bgm_player.play()


## 全局静音开关（BGM + 音效一起），点击后即时生效。
func set_muted(muted: bool) -> void:
	AudioServer.set_bus_mute(AudioServer.get_bus_index("Master"), muted)


func is_muted() -> bool:
	return AudioServer.is_bus_mute(AudioServer.get_bus_index("Master"))
