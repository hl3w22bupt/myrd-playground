extends Node
## 《牛牛打游戏》程序化音效单例（autoload 注册名 Sfx）：零外部资产的确定性合成音效库。
##
## v3 交互打磨（需求 cmv6vkith000gjotytp4v915c ④1）：game-8 曾实锤「零音效」缺陷，
## 本单例是闭环方案 —— 启动时用正弦/扫频合成 AudioStreamWAV（16-bit PCM，纯数学、
## 同种子同产物），main.gd 在结果性事件处调用 play()。
## Web/iOS 出声的前提是壳页面的音频手势解锁器（server/src/game-page.ts，部署硬契约），
## 引擎侧只负责「有可播的流、调用不报错」。
## 规范：autoload 只放状态与纯逻辑，不持有场景节点引用；播放器池是自己的子节点。

## 合成采样率（Hz）：22.05k 对短音效足够，体积小、合成快。
const SAMPLE_RATE: int = 22050
## 播放器池大小（复用空闲播放器，避免每次 new 节点）。
const POLYPHONY: int = 6
## 主音量（线性增益；合成波已做指数衰减包络，0.5 防削波刺耳）。
const MASTER_GAIN: float = 0.5

## 音效库：名字 → 合成好的 AudioStreamWAV。
var _bank: Dictionary = {}
## 播放器池。
var _players: Array[AudioStreamPlayer] = []
## 已播放次数（冒烟断言「收集后真的播了声」的机判口径）。
var played_count: int = 0


func _ready() -> void:
	_bank[&"collect"] = _synth_blip(880.0, 0.09)
	_bank[&"rare"] = _synth_arpeggio([987.77, 1174.66, 1396.91], 0.055)
	_bank[&"clock"] = _synth_double(660.0, 880.0, 0.07)
	_bank[&"powerup"] = _synth_sweep(320.0, 960.0, 0.18)
	_bank[&"wave"] = _synth_blip(293.66, 0.22)
	_bank[&"win"] = _synth_arpeggio([523.25, 659.25, 783.99, 1046.5], 0.11)
	_bank[&"lose"] = _synth_sweep(440.0, 174.61, 0.45)
	# v4 交互反馈映射（需求 cmv7hnfx3000ojofistqwry8l ④1）：UI 结果事件的短双音 ——
	# 确认(开始/重开)=上行、暂停=下行、恢复=上行，全部走 Juice.sfx 统一记录反馈事件。
	_bank[&"confirm"] = _synth_double(659.25, 880.0, 0.06)
	_bank[&"pause"] = _synth_double(523.25, 392.0, 0.06)
	_bank[&"resume"] = _synth_double(392.0, 523.25, 0.06)
	_bank[&"expire"] = _synth_blip(220.0, 0.12)
	for _i: int in POLYPHONY:
		var player := AudioStreamPlayer.new()
		player.bus = &"Master"
		add_child(player)
		_players.append(player)


## 播放一个已注册音效；pitch 用于连击音高爬升等微变调。未注册名静默忽略。
func play(sound_name: StringName, pitch: float = 1.0) -> void:
	if not _bank.has(sound_name):
		return
	var stream: AudioStreamWAV = _bank[sound_name]
	for player: AudioStreamPlayer in _players:
		if not player.playing:
			player.stream = stream
			player.pitch_scale = maxf(pitch, 0.1)
			player.play()
			played_count += 1
			return
	# 池满：抢占 0 号播放器（丢最老的一帧声音优于不出声）。
	var oldest: AudioStreamPlayer = _players[0]
	oldest.stream = stream
	oldest.pitch_scale = maxf(pitch, 0.1)
	oldest.play()
	played_count += 1


## 已注册音效名列表（冒烟断言库完备性用）。
func registered_names() -> Array[StringName]:
	var names: Array[StringName] = []
	for key: Variant in _bank:
		names.append(key as StringName)
	return names


## ── 合成基元（纯数学、确定性：同参数同字节）──

## 单音：正弦波 + 指数衰减包络。
func _synth_blip(freq: float, duration: float) -> AudioStreamWAV:
	var sample_count := int(float(SAMPLE_RATE) * duration)
	var samples := PackedFloat32Array()
	samples.resize(sample_count)
	for i: int in sample_count:
		var t := float(i) / float(SAMPLE_RATE)
		var envelope: float = exp(-6.0 * t / duration)
		samples[i] = sin(TAU * freq * t) * envelope
	return _to_wav(samples)


## 双音（叮-咚）：两个短单音背靠背。
func _synth_double(freq_a: float, freq_b: float, note_duration: float) -> AudioStreamWAV:
	var samples := PackedFloat32Array()
	for freq: float in [freq_a, freq_b]:
		_append_note(samples, freq, note_duration, 6.0)
	return _to_wav(samples)


## 上行琶音：一串短单音（胜利/稀有物的明亮感）。
func _synth_arpeggio(freqs: Array, note_duration: float) -> AudioStreamWAV:
	var samples := PackedFloat32Array()
	for freq: float in freqs:
		_append_note(samples, freq, note_duration, 4.0)
	return _to_wav(samples)


## 向采样缓冲追加一个带指数衰减包络的短音符。
func _append_note(samples: PackedFloat32Array, freq: float, note_duration: float, decay: float) -> void:
	var sample_count := int(float(SAMPLE_RATE) * note_duration)
	var base := samples.size()
	samples.resize(base + sample_count)
	for i: int in sample_count:
		var t := float(i) / float(SAMPLE_RATE)
		var envelope: float = exp(-decay * t / note_duration)
		samples[base + i] = sin(TAU * freq * t) * envelope


## 扫频：频率从 f0 滑到 f1（道具升起感 / 失败下坠感）。
func _synth_sweep(freq_from: float, freq_to: float, duration: float) -> AudioStreamWAV:
	var sample_count := int(float(SAMPLE_RATE) * duration)
	var samples := PackedFloat32Array()
	samples.resize(sample_count)
	var phase: float = 0.0
	for i: int in sample_count:
		var progress := float(i) / float(sample_count)
		var freq := lerpf(freq_from, freq_to, progress)
		phase += TAU * freq / float(SAMPLE_RATE)
		var envelope: float = exp(-2.5 * progress)
		samples[i] = sin(phase) * envelope
	return _to_wav(samples)


## 浮点采样 → 16-bit 单声道 AudioStreamWAV（含 MASTER_GAIN 与防削波钳制）。
func _to_wav(samples: PackedFloat32Array) -> AudioStreamWAV:
	var bytes := PackedByteArray()
	bytes.resize(samples.size() * 2)
	for i: int in samples.size():
		var value: float = clampf(samples[i] * MASTER_GAIN, -1.0, 1.0)
		var pcm := int(value * 32767.0)
		bytes.encode_s16(i * 2, pcm)
	var wav := AudioStreamWAV.new()
	wav.format = AudioStreamWAV.FORMAT_16_BITS
	wav.mix_rate = SAMPLE_RATE
	wav.stereo = false
	wav.data = bytes
	return wav
