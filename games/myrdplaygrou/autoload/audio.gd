extends Node
## 自动加载单例 Audio：背景音乐播放（双版分层）+ 全局静音开关 + 紧张感氛围调度
## （对「BGM 与音效齐备、静音即时生效」与「紧张感音画分层」两条契约，spec.numeric.audio）。
##
## 分工：BGM（基础版 + 紧张版）在这里循环播放与交叉淡入；音效走 Juice.sfx（池化播放，
## 注册表见 juice.gd SFX_BANK）；僵尸低吼的 4~8s 随机间隔调度也在这里（场上无僵尸则静默）。
## 静音 = AudioServer 总线 mute，一次性覆盖 BGM 与全部音效，点击后即时生效。
##
## Web 注意：浏览器音频上下文需要用户手势解锁（spec audio.audioContextUnlock +
## 部署壳页面契约）。游戏侧兜底：首个人类输入时 ensure_playing() 补一次启动（见 main.gd）。
## 状态回传：解锁 / 起播 / 静音变化时把 {muted, bgmPlaying} 写到 window.__GAME_AUDIO_STATE__，
## 壳层 window.__audioDebug() 合并它返回 {unlocked, muted, bgmPlaying}
## （spec audio.audioContextUnlock.machineCheck：mobile-web-smoke audio-unlock 的机判依据）。

## BGM 音量（dB）：spec audio.bgm.volume = 0.4（线性）= 20·log10(0.4) ≈ -7.96 dB。
## 取整 -8dB；真实出声机判（RMS > 0.01）的余量由此锚定：bgm.wav 整体 RMS 0.0666 × 0.398 ≈ 0.0265，
## 对阈值约 2.6 倍余量（静音期 / 安静段不易误判缺音）。紧张版同音量（分层靠编曲不靠响度）。
const BGM_VOLUME_DB: float = -8.0
## spec audio.bgm.volume 的线性值（与 BGM_VOLUME_DB 换算一致，冒烟交叉核对）。
const BGM_VOLUME_LINEAR: float = 0.4
## 交叉淡入时长（秒）：spec tension.bgmLayering「≤1s 完成交接」。
const CROSSFADE_SEC: float = 0.9
## 僵尸低吼播放音量（dB）：spec tension.ambientSfx「响度低于 BGM 不喧宾夺主」——
## zombie_groan.wav 资产 RMS 0.10 × 0.251(-12dB) ≈ 0.025 < BGM 有效响度 0.0265，且仍高于
## 能量探针阈值 0.01（真实出声可机判）。
const GROAN_VOLUME_DB: float = -12.0
## 低吼随机间隔带（秒）：spec tension.ambientSfx「4~8s 随机间隔」。
const GROAN_INTERVAL_MIN: float = 4.0
const GROAN_INTERVAL_MAX: float = 8.0
## 无尽模式的紧张版切入波（0 起）：无尽无总波数可折半，取八关线的中点口径（ceil(8/2)=4）。
const ENDLESS_INTENSE_WAVE: int = 3

var _bgm_player: AudioStreamPlayer
var _bgm_intense_player: AudioStreamPlayer
var _started: bool = false
## 紧张版是否激活（true = intense 交叉淡入中/已接入）。
var intense_active: bool = false
## 僵尸在场标记（Field 每帧回写；false = 低吼调度静默）。
var zombies_present: bool = false
## 低吼倒计时（秒；归零触发一次低吼并重掷 4~8s）——冒烟断言可置小值提速。
var groan_timer: float = 0.0
var _fade_tween: Tween
var _groan_rng := RandomNumberGenerator.new()


func _ready() -> void:
	_groan_rng.randomize()
	_bgm_player = _make_bgm_player("Bgm", "res://assets/sfx/bgm.wav")
	_bgm_intense_player = _make_bgm_player("BgmIntense", "res://assets/sfx/bgm-loop-intense.wav")
	_bgm_intense_player.volume_db = -80.0
	groan_timer = _groan_rng.randf_range(GROAN_INTERVAL_MIN, GROAN_INTERVAL_MAX)


func _make_bgm_player(player_name: String, path: String) -> AudioStreamPlayer:
	var player := AudioStreamPlayer.new()
	player.name = player_name
	var stream: AudioStream = load(path)
	if stream is AudioStreamWAV:
		var wav := stream as AudioStreamWAV
		# 运行时打开前向循环（导入默认不循环；16-bit mono 每帧 2 字节）
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
		"intense_stream_ready": _bgm_intense_player.stream != null,
		"intense_loop": (_bgm_intense_player.stream as AudioStreamWAV).loop_mode == AudioStreamWAV.LOOP_FORWARD
			if _bgm_intense_player.stream is AudioStreamWAV else false,
	}


## BGM 流是否就绪（冒烟音频契约断言入口）。
func has_bgm() -> bool:
	return _bgm_player.stream != null and _bgm_intense_player.stream != null


## BGM 是否在播（冒烟 / 状态回传用）。
func bgm_playing() -> bool:
	return _bgm_player.playing


## 紧张版切换状态快照（冒烟 acc-audio-tension 断言入口）。
func tension_state() -> Dictionary:
	return {
		"intense_active": intense_active,
		"base_playing": _bgm_player.playing,
		"intense_playing": _bgm_intense_player.playing,
		"base_volume_db": _bgm_player.volume_db,
		"intense_volume_db": _bgm_intense_player.volume_db,
	}


## 紧张版切换规则（纯函数，冒烟真值表机判）：spec tension.intenseSwitchRule ——
## 已出场波次（1 起）≥ ceil(总波次/2) 或进入最后一波 → intense；无尽模式无总波数，
## 取 ENDLESS_INTENSE_WAVE（第 4 波起，对齐八关线折半口径）。
func tension_should_be_intense(wave_index: int, wave_count: int) -> bool:
	if GameState.endless_active:
		return wave_index >= ENDLESS_INTENSE_WAVE
	if wave_count <= 0:
		return false
	var started_waves := wave_index + 1
	var half := ceili(float(wave_count) / 2.0)
	return started_waves >= half or wave_index >= wave_count - 1


## 波次推进时的分层切换（main._on_wave_started 调用）：按规则交叉淡入 / 切回。
func update_wave_tension(wave_index: int, wave_count: int) -> void:
	_set_intense(tension_should_be_intense(wave_index, wave_count))


## 回到基础版（开局 / 重开 / 结算 —— spec「结算/回落切回基础版」）。
func reset_tension() -> void:
	_set_intense(false)


## 交叉淡入 / 切出（幂等；≤1s 完成交接 = CROSSFADE_SEC 0.9s）。
func _set_intense(intense: bool) -> void:
	if intense == intense_active:
		return
	intense_active = intense
	if not _started:
		return  # 未解锁先记状态，ensure_playing 时按状态起播
	if _fade_tween != null and _fade_tween.is_valid():
		_fade_tween.kill()
	_fade_tween = create_tween().set_parallel(true)
	var rising := _bgm_intense_player if intense else _bgm_player
	var falling := _bgm_player if intense else _bgm_intense_player
	rising.volume_db = -40.0
	if not rising.playing:
		rising.play()
	_fade_tween.tween_property(rising, "volume_db", BGM_VOLUME_DB, CROSSFADE_SEC)
	_fade_tween.tween_property(falling, "volume_db", -40.0, CROSSFADE_SEC)
	_fade_tween.chain().tween_callback(falling.stop)


## 僵尸在场回写（Field 每帧调用；无僵尸 = 低吼调度静默，spec ambientSfx「场上无僵尸则静默」）。
func set_zombies_present(present: bool) -> void:
	zombies_present = present


func _process(delta: float) -> void:
	if not _started or not zombies_present or not GameState.running:
		return
	groan_timer -= delta
	if groan_timer <= 0.0:
		groan_timer = _groan_rng.randf_range(GROAN_INTERVAL_MIN, GROAN_INTERVAL_MAX)
		Juice.sfx(&"zombie_groan", GROAN_VOLUME_DB)


## 启动 BGM（幂等）。浏览器手势解锁后由 main.gd 首输入回调，或直接在开局调用。
## spec firstInteractionPolicy：首交互前不播放任何音频 —— 本方法只由手势路径触发。
func ensure_playing() -> void:
	if _started:
		return
	_started = true
	if not _bgm_player.playing:
		_bgm_player.play()
	if intense_active and not _bgm_intense_player.playing:
		# 解锁前已判定 intense：按状态把两版一起接入（音量面由 _set_intense 的 tween 收口）
		_bgm_intense_player.volume_db = BGM_VOLUME_DB
		_bgm_player.volume_db = -40.0
		_bgm_intense_player.play()
	_publish_state()


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
	var payload := JSON.stringify({"muted": is_muted(), "bgmPlaying": _bgm_player.playing})
	var bridge: Object = Engine.get_singleton("JavaScriptBridge")
	bridge.call("eval", "window.__GAME_AUDIO_STATE__ = %s" % payload)
