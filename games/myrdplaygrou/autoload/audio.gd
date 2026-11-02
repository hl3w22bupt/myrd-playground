extends Node
## 自动加载单例 Audio：背景音乐播放（平静 / 加压双层）+ 全局静音开关
## （对「BGM 与音效齐备、静音即时生效」契约 + 本轮「紧张感音画」升级）。
##
## 分工：BGM 在这里循环播放；音效走 Juice.sfx（池化播放，注册表见 juice.gd SFX_BANK）。
## 静音 = AudioServer 总线 mute，一次性覆盖 BGM 与全部音效，点击后即时生效。
##
## 双层 BGM（本轮修复②「紧张感」）：平静层 bgm.wav 与加压层 bgm-intense.wav 同曲式异编曲，
## 常态只出平静层；波次过半 / 末波（GameState.intense_bgm_desired）时 set_intensity(true)
## 把加压层交叉淡入、平静层淡出 —— 层间音量由补间驱动，任何时刻总量平滑无跳变。
##
## Web 注意：浏览器音频上下文需要用户手势解锁（spec audio.audioContextUnlock +
## 部署壳页面契约）。游戏侧兜底：首个人类输入时 ensure_playing() 补一次启动（见 main.gd）。
## 状态回传：解锁 / 起播 / 静音变化时把 {muted, bgmPlaying} 写到 window.__GAME_AUDIO_STATE__，
## 壳层 window.__audioDebug() 合并它返回 {unlocked, muted, bgmPlaying}
## （spec audio.audioContextUnlock.machineCheck：mobile-web-smoke audio-unlock 的机判依据）。

## BGM 音量（dB）：spec audio.bgm.volume = 0.4（线性）= 20·log10(0.4) ≈ -7.96 dB。
## 取整 -8dB；真实出声机判（RMS > 0.01）的余量由此锚定：bgm.wav 整体 RMS 0.0666 × 0.398 ≈ 0.0265，
## 对阈值约 2.6 倍余量（静音期 / 安静段不易误判缺音）。
const BGM_VOLUME_DB: float = -8.0
## spec audio.bgm.volume 的线性值（与 BGM_VOLUME_DB 换算一致，冒烟交叉核对）。
const BGM_VOLUME_LINEAR: float = 0.4
## 待命层静音档（dB）：交叉淡化时「另一层」沉到此值（远低于可闻域，等价静音但避免stop/start）。
const BGM_IDLE_DB: float = -60.0
## 交叉淡化时长（秒）。冒烟走测试通道压缩后验证淡化收敛；生产 1.2s 无感切换。
var crossfade_sec: float = 1.2

var _bgm_player: AudioStreamPlayer
var _intense_player: AudioStreamPlayer
## 当前加压目标态（true = 波次过半/末波的加压层在淡入或已接管）。
var _intense: bool = false
## 双层淡化补间（平静层 / 加压层各一条；换向时成对 kill）。
var _fade_tween: Tween
var _fade_tween_intense: Tween
var _started: bool = false


func _ready() -> void:
	_bgm_player = _make_loop_player("res://assets/sfx/bgm.wav", "Bgm")
	_intense_player = _make_loop_player("res://assets/sfx/bgm-intense.wav", "BgmIntense")
	# 加压层初始沉底待命（不 stop：交叉淡化只是音量位移，无缝衔接）
	_intense_player.volume_db = BGM_IDLE_DB


## 建一个前向循环播放器（导入默认不循环；16-bit mono 每帧 2 字节）。
func _make_loop_player(path: String, player_name: String) -> AudioStreamPlayer:
	var player := AudioStreamPlayer.new()
	player.name = player_name
	var stream: AudioStream = load(path)
	if stream is AudioStreamWAV:
		var wav := stream as AudioStreamWAV
		wav.loop_mode = AudioStreamWAV.LOOP_FORWARD
		wav.loop_begin = 0
		wav.loop_end = wav.data.size() / 2
	player.stream = stream
	player.volume_db = BGM_VOLUME_DB
	add_child(player)
	return player


## 总线状态核查快照（冒烟「核查 bus 音量」断言入口；spec audio：无启动静音、Master 满增益）。
func bus_audit() -> Dictionary:
	var master := AudioServer.get_bus_index("Master")
	return {
		"master_muted": AudioServer.is_bus_mute(master),
		"master_volume_db": AudioServer.get_bus_volume_db(master),
		"bgm_volume_db": _bgm_player.volume_db,
		"bgm_stream_ready": _bgm_player.stream != null,
		"bgm_loop": (_bgm_player.stream as AudioStreamWAV).loop_mode == AudioStreamWAV.LOOP_FORWARD
			if _bgm_player.stream is AudioStreamWAV else false,
		"intense_stream_ready": _intense_player.stream != null,
		"intense_loop": (_intense_player.stream as AudioStreamWAV).loop_mode == AudioStreamWAV.LOOP_FORWARD
			if _intense_player.stream is AudioStreamWAV else false,
	}


## BGM 流是否就绪（冒烟音频契约断言入口）。
func has_bgm() -> bool:
	return _bgm_player.stream != null


## 加压层流是否就绪（紧张感音画断言入口）。
func has_intense_bgm() -> bool:
	return _intense_player.stream != null


## BGM 是否在播（冒烟 / 状态回传用；任一层在播即算）。
func bgm_playing() -> bool:
	return _bgm_player.playing or _intense_player.playing


## 加压层当前目标态（冒烟 / 调参面板显示用）。
func intensity() -> bool:
	return _intense


## 加压层状态快照（紧张感音画断言入口）：目标态 + 双层实时音量 + 淡化进行中。
func intense_state() -> Dictionary:
	var fading := (_fade_tween != null and _fade_tween.is_valid() and _fade_tween.is_running()) \
		or (_fade_tween_intense != null and _fade_tween_intense.is_valid() and _fade_tween_intense.is_running())
	return {
		"desired": _intense,
		"calm_db": _bgm_player.volume_db,
		"intense_db": _intense_player.volume_db,
		"calm_playing": _bgm_player.playing,
		"intense_playing": _intense_player.playing,
		"crossfading": fading,
	}


## 启动 BGM（幂等，双层同时起播、加压层沉底待命）。浏览器手势解锁后由 main.gd 首输入回调。
## spec firstInteractionPolicy：首交互前不播放任何音频 —— 本方法只由手势路径触发。
func ensure_playing() -> void:
	if _started:
		return
	_started = true
	if not _bgm_player.playing:
		_bgm_player.play()
	if not _intense_player.playing:
		_intense_player.play()
	_publish_state()


## 加压层交叉淡入 / 淡出（幂等；波次过半 / 末波由 main.gd 按 GameState.intense_bgm_desired 驱动）。
## 双层音量同时补间（每层一条独立 Tween，终止/反向时成对 kill）：淡入层升至 BGM_VOLUME_DB、
## 淡出层沉到 BGM_IDLE_DB，总量平滑无跳变。
func set_intensity(intense: bool) -> void:
	if _intense == intense:
		return
	_intense = intense
	_kill_fades()
	var calm_target := BGM_IDLE_DB if intense else BGM_VOLUME_DB
	var intense_target := BGM_VOLUME_DB if intense else BGM_IDLE_DB
	var dur := maxf(crossfade_sec, 0.001)
	_fade_tween = create_tween()
	_fade_tween.tween_property(_bgm_player, "volume_db", calm_target, dur)
	_fade_tween_intense = create_tween()
	_fade_tween_intense.tween_property(_intense_player, "volume_db", intense_target, dur)


## 终止进行中的双层淡化补间（换向 / 新目标时）。
func _kill_fades() -> void:
	if _fade_tween != null and _fade_tween.is_valid():
		_fade_tween.kill()
	if _fade_tween_intense != null and _fade_tween_intense.is_valid():
		_fade_tween_intense.kill()


## 测试通道：显式推进淡化补间时间（冒烟断言「淡化收敛」用）。
## 无头环境的空闲（process）帧步进不保证（实测 process 帧计数不增长，IDLE 补间不推进），
## 生产运行里补间的逐帧推进由冒烟「提示淡出」断言同机制覆盖；这里用 Tween.custom_step
## 确定性地推进时间，专判「淡化目标/时长/收敛」这条逻辑本身。
func debug_advance_crossfade(seconds: float) -> void:
	if _fade_tween != null and _fade_tween.is_valid():
		_fade_tween.custom_step(maxf(seconds, 0.001))
	if _fade_tween_intense != null and _fade_tween_intense.is_valid():
		_fade_tween_intense.custom_step(maxf(seconds, 0.001))


## 全局静音开关（BGM + 音效一起），点击后即时生效；状态回传壳层取证出口。
func set_muted(muted: bool) -> void:
	AudioServer.set_bus_mute(AudioServer.get_bus_index("Master"), muted)
	_publish_state()


func is_muted() -> bool:
	return AudioServer.is_bus_mute(AudioServer.get_bus_index("Master"))


## 把 {muted, bgmPlaying} 写到 window.__GAME_AUDIO_STATE__（壳层 __audioDebug 合并读取）。
## 桌面/无头环境桥不工作（eval 恒 null），静默跳过；eval 返回形态不参与判定，只写不读。
func _publish_state() -> void:
	if not OS.has_feature("web"):
		return
	if not Engine.has_singleton("JavaScriptBridge"):
		return
	var payload := JSON.stringify({"muted": is_muted(), "bgmPlaying": bgm_playing()})
	var bridge: Object = Engine.get_singleton("JavaScriptBridge")
	bridge.call("eval", "window.__GAME_AUDIO_STATE__ = %s" % payload)
