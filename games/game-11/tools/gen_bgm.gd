extends SceneTree
## gen_bgm —— 程序化 BGM 合成器（资产治理协议 SKILL.md §7B 的离线生成器，零外部依赖）。
##
## 用法：godot --headless --path . -s res://tools/gen_bgm.gd
##
## 产物：assets/music/bgm_shop.wav —— 八音盒风格的轻松循环曲（安静、欢快）：
##   96 BPM、8 小节（20.0s 整）、C–Am–F–G 进行 ×2；
##   声部 = 高音区琶音（音乐盒）+ 低音根音 + 和弦垫 + 每小节一颗高音闪音。
##   所有包络都完整落在小节内 → 首尾无缝（loop_mode 在运行时设 LOOP_FORWARD）。
## 输出路径用字符串拼接构造 —— 与 gen_sfx 同因：preflight P5 扫 res:// 字面量，
## 而生成目标在生成前不存在。

const RATE: int = 22050
## 96 BPM：一拍 0.625s，一小节（4 拍）2.5s。
const BEAT: float = 0.625
const BARS: int = 8

## 和弦进行：根音频率 + 三音性质（major/minor）。
const PROGRESSION: Array[Dictionary] = [
	{"root": 261.63, "third": 1.25, "name": "C"},
	{"root": 220.0, "third": 1.2, "name": "Am"},
	{"root": 174.61, "third": 1.25, "name": "F"},
	{"root": 196.0, "third": 1.2, "name": "G"},
]


func _initialize() -> void:
	var bar_samples := int(BEAT * 4.0 * float(RATE))
	var total := bar_samples * BARS
	var samples := PackedFloat32Array()
	samples.resize(total)
	for bar in BARS:
		var chord: Dictionary = PROGRESSION[bar % PROGRESSION.size()]
		_bake_bar(samples, bar * bar_samples, bar_samples, chord)
	_normalize(samples, 0.62)
	DirAccess.open("res://").make_dir_recursive("assets/music")
	var relative := "assets/music/" + "bgm_shop" + ".wav"
	_write_wav("res://" + relative, samples, RATE)
	print("GEN_BGM: PASS %s  %d samples @ %dHz（%.1fs 无缝循环，%d 小节）" % [
		relative, total, RATE, float(total) / float(RATE), BARS])
	quit(0)


## 一小节：8 个八分音符琶音 + 低音 + 和弦垫 + 闪音。
func _bake_bar(samples: PackedFloat32Array, offset: int, count: int, chord: Dictionary) -> void:
	var root := float(chord["root"])
	var third := float(chord["third"])
	# 琶音音高比：1 → 三音 → 五音 → 高八度 → 高十度 → 高八度 → 五音 → 三音。
	var ratios: Array[float] = [1.0, third, 1.5, 2.0, 2.0 * third, 2.0, 1.5, third]
	var note_len := float(count) / 8.0
	for n in 8:
		var freq := root * 2.0 * ratios[n]
		var start := offset + int(float(n) * note_len)
		for i in int(note_len):
			var idx := start + i
			if idx >= samples.size():
				break
			var t := float(i) / float(RATE)
			var tone := sin(TAU * freq * t) + 0.35 * sin(TAU * freq * 2.0 * t)
			var env := exp(-5.5 * t) * clampf(t / 0.004, 0.0, 1.0)
			samples[idx] += tone * env * 0.13
	# 低音根音（整小节缓衰减）。
	for i in count:
		var t2 := float(i) / float(RATE)
		samples[offset + i] += sin(TAU * root * 0.5 * t2) * exp(-1.1 * t2) * 0.10
	# 和弦垫（根/三/五持续，两端 80ms 淡入淡出 → 小节边界归零，循环无缝）。
	for ratio: float in [1.0, third, 1.5]:
		var pf: float = root * ratio
		for i in count:
			var t3 := float(i) / float(RATE)
			var edge := clampf(t3 / 0.08, 0.0, 1.0) * clampf((float(count) / float(RATE) - t3) / 0.08, 0.0, 1.0)
			samples[offset + i] += sin(TAU * pf * t3) * edge * 0.028
	# 每小节第一拍一颗高两个八度的闪音（音乐盒质感）。
	for i in int(note_len):
		var t4 := float(i) / float(RATE)
		samples[offset + i] += sin(TAU * root * 4.0 * t4) * exp(-9.0 * t4) * 0.05


func _normalize(samples: PackedFloat32Array, peak: float) -> void:
	var max_abs := 0.0001
	for s in samples:
		max_abs = maxf(max_abs, absf(s))
	var gain := peak / max_abs
	for i in samples.size():
		samples[i] *= gain


## 手写 WAV（16-bit PCM mono，显式小端字节序）—— 与 tools/gen_sfx.gd 同款实现。
func _write_wav(path: String, samples: PackedFloat32Array, rate: int) -> void:
	var f := FileAccess.open(path, FileAccess.WRITE)
	var data_size := samples.size() * 2
	_write_tag(f, "RIFF")
	_write_u32(f, 36 + data_size)
	_write_tag(f, "WAVE")
	_write_tag(f, "fmt ")
	_write_u32(f, 16)
	_write_u16(f, 1)
	_write_u16(f, 1)
	_write_u32(f, rate)
	_write_u32(f, rate * 2)
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
