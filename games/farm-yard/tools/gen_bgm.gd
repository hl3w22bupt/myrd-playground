extends SceneTree
## gen_bgm —— 程序化 BGM 合成器：治愈系田园小曲（C 大调五声 + 柔和弦垫）。
##
## 用法：godot --headless --path . -s res://tools/gen_bgm.gd
## 产物：assets/audio/bgm_meadow.wav（16-bit PCM mono，循环无缝 —— 尾帧与首帧同相位起音）。
## 资产治理：spec.assets 的 bgm-meadow 条目（source=generated, generator=procedural:tools/gen_bgm.gd）。
## 确定可复现：音符序列与音色全部为常量，无随机数 —— 同命令同产物。

const SAMPLE_RATE: int = 16000
const BPM: float = 84.0
const BEAT: float = 60.0 / BPM          # 0.714s
const BAR: float = BEAT * 4.0           # 2.857s
const BAR_COUNT: int = 8                # 8 小节 ≈ 22.9s 一循环

## 和弦垫（C–F–Am–G × 2）：频率用音名算，避免手抄错
const CHORD_PROGRESSION: Array = [
	["C3", "E3", "G3"], ["C3", "F3", "A3"], ["A2", "C3", "E3"], ["G2", "B2", "D3"],
	["C3", "E3", "G3"], ["C3", "F3", "A3"], ["A2", "C3", "E3"], ["G2", "B2", "D3"],
]
## 五声音阶旋律（C 大调五声：C D E G A），每小节 2 个拨弦音 —— 空灵感优先于信息量
const MELODY: Array = [
	["E4", "G4"], ["A4", "G4"], ["E4", "C4"], ["D4", "E4"],
	["G4", "E4"], ["A4", "C5"], ["E4", "D4"], ["C4", "A3"],
]

const NOTE_FREQS: Dictionary = {
	"C3": 130.81, "D3": 146.83, "E3": 164.81, "F3": 174.61, "G3": 196.0, "A3": 220.0, "B3": 246.94,
	"C4": 261.63, "D4": 293.66, "E4": 329.63, "G4": 392.0, "A4": 440.0, "C5": 523.25,
	"C2": 65.41, "F2": 87.31, "G2": 98.0, "A2": 110.0, "B2": 123.47,
}


func _initialize() -> void:
	var total := int(BAR * BAR_COUNT * float(SAMPLE_RATE))
	var samples := PackedFloat32Array()
	samples.resize(total)
	# ① 和弦垫：每小节一个三和弦，软起音慢释放（正弦叠置 + 轻微 detune 做宽度）
	for bar in BAR_COUNT:
		var chord: Array = CHORD_PROGRESSION[bar]
		var start := int(float(bar) * BAR * SAMPLE_RATE)
		var length := int(BAR * SAMPLE_RATE)
		for note_name: String in chord:
			var freq := float(NOTE_FREQS[note_name])
			for i in length:
				var t := float(i) / float(SAMPLE_RATE)
				var progress := float(i) / float(length)
				var env := _pad_envelope(progress)
				var value := sin(TAU * freq * t) * 0.6 + sin(TAU * (freq * 1.003) * t) * 0.4
				samples[start + i] += value * env * 0.13
	# ② 拨弦旋律：三角形波 + 指数衰减，落在每小节第 1、3 拍
	for bar in BAR_COUNT:
		var melody: Array = MELODY[bar]
		for beat_index in 2:
			var note_name: String = melody[beat_index]
			var freq := float(NOTE_FREQS[note_name])
			var start := int((float(bar) * BAR + float(beat_index) * BEAT * 2.0) * SAMPLE_RATE)
			var length := int(BEAT * 1.8 * SAMPLE_RATE)
			for i in length:
				if start + i >= total:
					break
				var t := float(i) / float(SAMPLE_RATE)
				var env := exp(-3.2 * t) * clampf(t / 0.004, 0.0, 1.0)
				var phase := TAU * freq * t
				var triangle := 2.0 * absf(2.0 * fmod(phase / TAU, 1.0) - 1.0) - 1.0
				samples[start + i] += triangle * env * 0.16
	# ③ 尾部 20ms 淡出 + 首部 5ms 淡入（循环无缝防爆音），写入 wav
	for i in mini(int(0.02 * SAMPLE_RATE), total):
		samples[total - 1 - i] *= float(i) / float(0.02 * SAMPLE_RATE)
	for i in mini(int(0.005 * SAMPLE_RATE), total):
		samples[i] *= float(i) / float(0.005 * SAMPLE_RATE)
	DirAccess.open("res://").make_dir_recursive("assets/audio")
	_write_wav("res://assets/audio/bgm_meadow.wav", samples)
	print("GEN_BGM: PASS bgm_meadow.wav %d samples @ %dHz（%.1fs 循环）" % [total, SAMPLE_RATE, float(total) / SAMPLE_RATE])
	quit(0)


func _pad_envelope(progress: float) -> float:
	var attack := clampf(progress / 0.18, 0.0, 1.0)
	var release := clampf((1.0 - progress) / 0.3, 0.0, 1.0)
	return attack * release


## 16-bit PCM mono WAV（与 gen_sfx.gd 同款手写头，显式小端）
func _write_wav(path: String, samples: PackedFloat32Array) -> void:
	var f := FileAccess.open(path, FileAccess.WRITE)
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
		_write_u16(f, int(clampf(s, -1.0, 1.0) * 32767.0) & 0xFFFF)
	f.flush()


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
