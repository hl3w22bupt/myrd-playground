extends Node
## 音效单例（autoload，注册名 Sfx）：四类音效（收集/受击/结算/重开）的唯一入口。
##
## 实现口径（验收标准 6「音效反馈」）：
## - 每类音效 = 1 个 AudioStreamPlayer 子节点 + 1 条程序化生成的 AudioStreamWAV
##   （GDScript 运行时合成 16-bit PCM，不依赖任何二进制音频资产，Web 导出零额外体积）；
## - 四个播放器相互独立：连续收集/受击时音效可叠加，不互相掐断；
## - 生成失败降级为静音占位流：音效缺席不允许变成启动/运行故障。
##
## 规范（同 autoload/game_state.gd）：
## - 只放「音频资源 + 播放调度」，不改玩法状态；跨场景通信走信号，不持有场景节点；
## - 不声明 class_name（避免与单例名冲突，preflight P4）；
## - 冒烟断言入口：play_counts（每类音效真实触发计数）+ 播放器/流节点结构。

## 合成采样率（22050 Hz 足够覆盖 8-bit 复古音色，数据量小、Web 端解码零压力）。
const MIX_RATE: int = 22050
## 音效键清单：冒烟按此顺序断言播放器/流/计数齐全。
const SFX_KEYS: Array[String] = ["collect", "hit", "game_over", "restart"]
## 峰值上限（< 1.0）：多音效叠加时不削波爆音。
const PEAK_LIMIT: float = 0.8

## 每类音效的真实触发计数（冒烟断言「接线真的送达」的机判形态）。
var play_counts: Dictionary = {}

## 键 → 播放器节点（_ready 里创建，见 SFX_KEYS 顺序）。
var _players: Dictionary = {}


func _ready() -> void:
	for key in SFX_KEYS:
		play_counts[key] = 0
		var stream := _stream_for(key)
		var player := AudioStreamPlayer.new()
		player.name = key.capitalize() + "Player"
		player.stream = stream
		player.volume_db = _volume_db_for(key)
		add_child(player)
		_players[key] = player


## 触发一类音效（缺键静默忽略：调用方只管语义，不管音频资产是否存在）。
func play(key: String) -> void:
	var player: AudioStreamPlayer = _players.get(key)
	if player == null or player.stream == null:
		return
	play_counts[key] = int(play_counts.get(key, 0)) + 1
	player.play()


## 收集星尘（+1 分瞬间的正反馈：上行双音「叮」）。
func play_collect() -> void:
	play("collect")


## 撞上陨石扣盾（受击反馈：下行锯齿「闷响」+ 噪声颗粒）。
func play_hit() -> void:
	play("hit")


## 结算面板弹出（护盾耗尽 / 达成目标分共用：下行三连音「落幕」）。
func play_game_over() -> void:
	play("game_over")


## 重开新一局（重开入口确认：上行扫频「启动」）。
func play_restart() -> void:
	play("restart")


## 各键的音量（dB）：收集最高频、出现最频繁，压低 4dB 防听感疲劳。
func _volume_db_for(key: String) -> float:
	match key:
		"collect":
			return -8.0
		"hit":
			return -4.0
		"game_over":
			return -4.0
		"restart":
			return -6.0
	return -6.0


## 按键分发合成参数；未知键回退收集音（不返回 null，保证播放器永远有合法流）。
func _stream_for(key: String) -> AudioStreamWAV:
	match key:
		"collect":
			return _render([
				{"wave": "sine", "freq0": 987.77, "freq1": 987.77, "duration": 0.08, "gain": 0.55, "decay": 8.0},
				{"wave": "sine", "freq0": 1318.51, "freq1": 1318.51, "duration": 0.16, "gain": 0.60, "decay": 14.0},
			])
		"hit":
			return _render([
				{"wave": "saw", "freq0": 220.0, "freq1": 62.0, "duration": 0.26, "gain": 0.62, "decay": 9.0, "noise": 0.25},
			])
		"game_over":
			return _render([
				{"wave": "triangle", "freq0": 440.0, "freq1": 440.0, "duration": 0.18, "gain": 0.50, "decay": 6.0},
				{"wave": "triangle", "freq0": 329.63, "freq1": 329.63, "duration": 0.18, "gain": 0.50, "decay": 6.0},
				{"wave": "triangle", "freq0": 261.63, "freq1": 261.63, "duration": 0.36, "gain": 0.55, "decay": 7.0},
			])
		"restart":
			return _render([
				{"wave": "sine", "freq0": 523.25, "freq1": 1046.50, "duration": 0.30, "gain": 0.55, "decay": 3.5},
				{"wave": "sine", "freq0": 1046.50, "freq1": 1046.50, "duration": 0.12, "gain": 0.45, "decay": 10.0},
			])
	return _stream_for("collect")


## ── 程序化合成 ──
## 把分段音色描述渲染成 16-bit 单声道 AudioStreamWAV。
## 每段：wave（sine/triangle/square/saw）、freq0→freq1 线性扫频、duration 秒、
## gain 峰值、decay 指数衰减系数（越大衰减越快，含 5% 起音斜坡防爆音）、
## noise（0~1，混入白噪声比例，给「受击」加颗粒感）。
func _render(segments: Array) -> AudioStreamWAV:
	var samples := PackedFloat32Array()
	for segment: Dictionary in segments:
		var frame_count: int = maxi(int(float(segment.get("duration", 0.1)) * MIX_RATE), 1)
		samples.resize(samples.size() + frame_count)
		var phase: float = 0.0
		var wave: String = String(segment.get("wave", "sine"))
		var freq0: float = float(segment.get("freq0", 440.0))
		var freq1: float = float(segment.get("freq1", freq0))
		var gain: float = float(segment.get("gain", 0.5))
		var decay: float = float(segment.get("decay", 6.0))
		var noise_mix: float = clampf(float(segment.get("noise", 0.0)), 0.0, 1.0)
		var attack_frames: int = maxi(frame_count / 20, 1)
		for i in frame_count:
			var progress := float(i) / float(frame_count)
			var freq: float = lerpf(freq0, freq1, progress)
			phase += TAU * freq / float(MIX_RATE)
			var tone := _waveform(wave, phase)
			if noise_mix > 0.0:
				tone = lerpf(tone, randf() * 2.0 - 1.0, noise_mix)
			var envelope := exp(-decay * float(i) / float(MIX_RATE))
			if i < attack_frames:
				envelope *= float(i) / float(attack_frames)
			samples[samples.size() - frame_count + i] = clampf(tone * envelope * gain, -1.0, 1.0)
	var bytes := PackedByteArray()
	bytes.resize(samples.size() * 2)
	for i in samples.size():
		bytes.encode_s16(i * 2, int(samples[i] * 32767.0))
	var stream := AudioStreamWAV.new()
	stream.format = AudioStreamWAV.FORMAT_16_BITS
	stream.mix_rate = MIX_RATE
	stream.stereo = false
	stream.data = bytes
	return stream


## 基础波形（phase 单位为弧度，0~2π 循环）。
func _waveform(wave: String, phase: float) -> float:
	match wave:
		"triangle":
			return 2.0 / PI * asin(sin(phase))
		"square":
			return signf(sin(phase)) * 0.6
		"saw":
			return 2.0 * fmod(phase / TAU, 1.0) - 1.0
		_:
			return sin(phase)
