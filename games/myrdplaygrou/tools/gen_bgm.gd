extends SceneTree
## gen_bgm —— 程序化 BGM 生成器（《植物人大战僵尸-网页版》背景音乐，零外部依赖）。
##
## 用法（工程根运行）：
##   godot --headless --path . -s res://tools/gen_bgm.gd
##
## 产物：assets/sfx/bgm.wav（16-bit PCM mono，22050Hz，约 55.4s 无缝循环 = 8 小节曲式 × 3 轮）。
## 资产治理协议（SKILL.md §7B）：generated 资产，generator=procedural:tools/gen_bgm.gd；
## 同配方同产物（确定性音序表 + 固定噪声种子），改音序重跑本工具即再生成。
##
## 曲式：C 大调 I-V-vi-IV 进行 ×2 的 8 小节轻快循环，
## 四轨 = 方波贝斯 + 三角波主旋律（加高八度泛音）+ 正弦和弦铺底 + 噪声打点，
## 扁平明快、音量压低，不抢音效。

const SAMPLE_RATE: int = 22050
const BPM: float = 104.0
const BEAT: float = 60.0 / BPM          # 一拍秒数
const BEATS_PER_BAR: int = 4
## 总小节数 = 8 小节曲式 × 3 轮 ≈ 55.4s（spec assets「bgm-loop 约 60s 循环」口径）；
## 和弦/旋律表都按 8 小节取模循环，末句回落主音，循环接缝仍无缝。
const BARS: int = 24
const FORM_BARS: int = 8
const NOISE_SEED: int = 20261101        # 确定种子：同配方同产物

## 和弦进行（MIDI 音高）：C / G / Am / F ×2，贝斯用根音低两个八度。
const CHORD_ROOTS: Array[int] = [60, 55, 57, 53, 60, 55, 57, 53]
const CHORD_TONES: Array = [
	[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60],
	[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60],
]
## 主旋律（MIDI 音高，0 = 休止；每格半拍，共 BARS*8 = 64 格），末句回落主音循环无缝。
const MELODY: Array[int] = [
	72, 0, 76, 0, 79, 0, 76, 74,
	71, 0, 74, 0, 79, 0, 74, 71,
	69, 0, 72, 0, 76, 0, 72, 69,
	69, 72, 74, 72, 77, 74, 72, 74,
	72, 0, 76, 0, 79, 0, 81, 79,
	74, 0, 71, 0, 74, 0, 79, 74,
	76, 0, 72, 0, 69, 0, 72, 76,
	74, 72, 71, 72, 69, 0, 60, 0,
]


## 音名（MIDI）→ 频率（A4=440，十二平均律）。
func _freq(midi: int) -> float:
	return 440.0 * pow(2.0, float(midi - 69) / 12.0)


func _square(phase: float) -> float:
	return 1.0 if sin(phase) >= 0.0 else -1.0


func _triangle(phase: float) -> float:
	var t := fmod(phase, TAU) / TAU
	return 2.0 * abs(2.0 * t - 1.0) - 1.0


## 包络：4ms 起音 + 指数衰减 + 10ms 收尾（音符边界无咔哒）。
func _env(t: float, length: float, decay: float) -> float:
	var attack := clampf(t / 0.004, 0.0, 1.0)
	var release := clampf((length - t) / 0.01, 0.0, 1.0)
	return attack * exp(-decay * t) * release


func _initialize() -> void:
	var total_beats := BARS * BEATS_PER_BAR
	var duration := total_beats * BEAT
	var count := int(duration * float(SAMPLE_RATE))
	var samples := PackedFloat32Array()
	samples.resize(count)

	var bass_phase := 0.0
	var mel_phase := 0.0
	var mel_top_phase := 0.0
	var chord_phases: Array[float] = [0.0, 0.0, 0.0]
	var rng := RandomNumberGenerator.new()
	rng.seed = NOISE_SEED

	for i in count:
		var t := float(i) / float(SAMPLE_RATE)
		var value := 0.0
		var beat_idx := mini(int(t / BEAT), total_beats - 1)
		var beat_t := fmod(t, BEAT)
		var bar_idx := int(beat_idx / float(BEATS_PER_BAR))
		var step_len := BEAT * 0.5
		# 旋律按 8 小节曲式取模循环（总长 = FORM_BARS × 轮数），越界即回卷
		var step := int(t / step_len) % MELODY.size()

		# 贝斯：方波根音，每拍一枚
		var root := _freq(CHORD_ROOTS[bar_idx % CHORD_ROOTS.size()] - 24)
		bass_phase += TAU * root / float(SAMPLE_RATE)
		if beat_t < BEAT * 0.92:
			value += _square(bass_phase) * 0.15 * _env(beat_t, BEAT * 0.92, 8.0)

		# 主旋律：三角波 + 高八度正弦泛音
		var note := MELODY[step]
		var note_freq := _freq(note if note > 0 else 60)
		mel_phase += TAU * note_freq / float(SAMPLE_RATE)
		mel_top_phase += TAU * note_freq * 2.0 / float(SAMPLE_RATE)
		if note > 0:
			var step_t := fmod(t, step_len)
			value += _triangle(mel_phase) * 0.19 * _env(step_t, step_len * 0.92, 5.0)
			value += sin(mel_top_phase) * 0.05 * _env(step_t, step_len * 0.8, 6.0)

		# 和弦铺底：正弦长音，每小节一枚
		var bar_len := BEAT * BEATS_PER_BAR
		var bar_t := fmod(t, bar_len)
		var tones: Array = CHORD_TONES[bar_idx % CHORD_TONES.size()]
		for k in tones.size():
			chord_phases[k] += TAU * _freq(tones[k]) / float(SAMPLE_RATE)
			value += sin(chord_phases[k]) * 0.035 * _env(bar_t, bar_len * 0.96, 1.2)

		# 打点：噪声，每拍一次、强拍加倍
		var hat_gain := 0.05 if (beat_idx % 2 == 0) else 0.026
		value += rng.randf_range(-1.0, 1.0) * hat_gain * _env(beat_t, 0.05, 30.0)

		# 循环接缝：首尾 8ms 交叉渐隐/渐显，无咔哒
		var seam_in := clampf(t / 0.008, 0.0, 1.0)
		var seam_out := clampf((duration - t) / 0.008, 0.0, 1.0)
		samples[i] = clampf(value * seam_in * seam_out * 0.9, -1.0, 1.0)

	var f := FileAccess.open("res://assets/sfx/bgm.wav", FileAccess.WRITE)
	if f == null:
		printerr("GEN_BGM: FAIL 无法写出 assets/sfx/bgm.wav")
		quit(1)
		return
	var data_size := samples.size() * 2
	_write_tag(f, "RIFF")
	_write_u32(f, 36 + data_size)
	_write_tag(f, "WAVE")
	_write_tag(f, "fmt ")
	_write_u32(f, 16)
	_write_u16(f, 1)
	_write_u16(f, 1)
	_write_u32(f, SAMPLE_RATE)
	_write_u32(f, SAMPLE_RATE * 2)
	_write_u16(f, 2)
	_write_u16(f, 16)
	_write_tag(f, "data")
	_write_u32(f, data_size)
	for s in samples:
		_write_u16(f, int(s * 32767.0) & 0xFFFF)
	f.flush()
	print("GEN_BGM: PASS bgm.wav 已生成（%d samples @ %dHz，%.1fs 循环）" % [samples.size(), SAMPLE_RATE, duration])
	quit(0)


func _write_tag(f: FileAccess, tag: String) -> void:
	for ch in tag.to_ascii_buffer():
		f.store_8(ch)


func _write_u16(f: FileAccess, value: int) -> void:
	f.store_8(value & 0xFF)
	f.store_8((value >> 8) & 0xFF)


func _write_u32(f: FileAccess, value: int) -> void:
	f.store_8(value & 0xFF)
	f.store_8((value >> 8) & 0xFF)
	f.store_8((value >> 16) & 0xFF)
	f.store_8((value >> 24) & 0xFF)
