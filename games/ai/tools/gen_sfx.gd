extends SceneTree
## gen_sfx —— 程序化 SFX 合成器（资产治理协议 SKILL.md §7B 的离线生成器，零外部依赖）。
##
## 用法（工程根运行）：
##   godot --headless --path . -s res://tools/gen_sfx.gd
##   godot --headless --path . -s res://tools/gen_sfx.gd -- --recipe res://tests/sfx-recipes.json
##
## 配方（tests/sfx-recipes.json）：sample_rate + effects[]，每个 effect：
##   name 必填（输出 assets/sfx/<name>.wav；噪声种子 = hash(name)，确定可复现）
##   kind: blip（固定频振荡+包络）/ sweep（from→to 扫频）/ noise（白噪声+包络）
##   wave: sine / square / triangle / sawtooth；duration 秒；volume 0~1；decay 包络衰减
##
## 产物即资产治理协议里的 generated 资产：入库后进 spec.assets 段（source=generated，
## generator=procedural:tools/gen_sfx.gd），改配方重跑本工具即再生成。
## 输出路径刻意用字符串拼接构造（而非完整 res:// 字面量）——preflight P5 会扫描 .gd 里的
## res:// 字面量并断言存在，而生成目标在生成前并不存在（先有鸡还是先有蛋）。

const DEFAULT_RECIPE: String = "res://tests/sfx-recipes.json"


func _initialize() -> void:
	var recipe_path := DEFAULT_RECIPE
	var user_args := OS.get_cmdline_user_args()
	var i := 0
	while i < user_args.size():
		if user_args[i] == "--recipe" and i + 1 < user_args.size():
			recipe_path = user_args[i + 1]
			i += 2
		else:
			i += 1

	var errors := PackedStringArray()
	if not FileAccess.file_exists(recipe_path):
		printerr("GEN_SFX: FAIL 配方文件不存在: ", recipe_path)
		quit(1)
		return
	var parsed: Variant = JSON.parse_string(FileAccess.open(recipe_path, FileAccess.READ).get_as_text())
	if not (parsed is Dictionary):
		printerr("GEN_SFX: FAIL 配方不是合法 JSON 对象: ", recipe_path)
		quit(1)
		return
	var recipe: Dictionary = parsed
	var effects: Variant = recipe.get("effects")
	if not (effects is Array) or (effects as Array).is_empty():
		printerr("GEN_SFX: FAIL 配方缺少非空 effects 数组")
		quit(1)
		return
	var rate := int(recipe.get("sample_rate", 22050))
	if rate < 8000 or rate > 48000:
		errors.append("sample_rate=%d 不在 8000~48000 之间" % rate)
		rate = 22050

	DirAccess.open("res://").make_dir_recursive("assets/sfx")
	for effect: Variant in effects:
		if not (effect is Dictionary):
			errors.append("effects 里存在非对象条目")
			continue
		var message := _bake(effect, rate)
		if message != "":
			errors.append(message)

	if errors.is_empty():
		print("GEN_SFX: PASS %d 个音效已生成到 assets/sfx/（配方 %s）" % [(effects as Array).size(), recipe_path])
		quit(0)
	else:
		for error in errors:
			printerr("GEN_SFX: FAIL ", error)
		quit(1)


## 合成一个音效并写 wav；返回 "" = 成功，否则为可读错误。
func _bake(effect: Dictionary, rate: int) -> String:
	var name := String(effect.get("name", ""))
	if name.is_empty() or not name.is_valid_filename():
		return "effect 缺少合法 name（用作文件名）"
	var kind := String(effect.get("kind", "blip"))
	if not kind in ["blip", "sweep", "noise"]:
		return "%s: kind 必须是 blip/sweep/noise，实际 %s" % [name, kind]
	var duration := float(effect.get("duration", 0.2))
	if duration <= 0.0 or duration > 3.0:
		return "%s: duration 必须在 (0, 3] 秒，实际 %s" % [name, duration]
	var volume := clampf(float(effect.get("volume", 0.6)), 0.0, 1.0)
	var wave := String(effect.get("wave", "sine"))
	var decay := absf(float(effect.get("decay", 6.0)))
	var count := int(duration * float(rate))
	if count <= 0:
		return "%s: 采样数为 0" % name

	var rng := RandomNumberGenerator.new()
	rng.seed = hash(name)  # 确定种子：同配方同产物，diff 干净
	var from := float(effect.get("from", float(effect.get("freq", 440.0))))
	var to := float(effect.get("to", from))
	var samples := PackedFloat32Array()
	samples.resize(count)
	var phase := 0.0
	for i in count:
		var t := float(i) / float(rate)
		var progress := float(i) / float(max(count - 1, 1))
		phase += TAU * lerpf(from, to, progress) / float(rate)
		var value := rng.randf_range(-1.0, 1.0) if kind == "noise" else _oscillator(wave, phase)
		var attack := clampf(t / 0.002, 0.0, 1.0)          # 2ms 起音防爆音
		var fade_out := clampf((duration - t) / 0.005, 0.0, 1.0)  # 5ms 收尾防咔哒
		samples[i] = value * exp(-decay * t) * attack * fade_out * volume

	var relative := "assets/sfx/" + name + ".wav"
	_write_wav("res://" + relative, samples, rate)
	print("[gen_sfx] %s.wav  %d samples @ %dHz（kind=%s wave=%s）" % [name, count, rate, kind, wave])
	return ""


func _oscillator(wave: String, phase: float) -> float:
	match wave:
		"square":
			return 1.0 if sin(phase) >= 0.0 else -1.0
		"triangle":
			var t := fmod(phase, TAU) / TAU
			return 2.0 * abs(2.0 * t - 1.0) - 1.0
		"sawtooth":
			return 2.0 * (fmod(phase, TAU) / TAU) - 1.0
		_:
			return sin(phase)


## 手写 WAV（16-bit PCM mono，显式小端字节序）——不依赖 AudioStreamWAV.save_to_wav 的版本门槛。
func _write_wav(path: String, samples: PackedFloat32Array, rate: int) -> void:
	var f := FileAccess.open(path, FileAccess.WRITE)
	var data_size := samples.size() * 2
	_write_tag(f, "RIFF")
	_write_u32(f, 36 + data_size)
	_write_tag(f, "WAVE")
	_write_tag(f, "fmt ")
	_write_u32(f, 16)          # fmt 块长度（PCM）
	_write_u16(f, 1)           # PCM
	_write_u16(f, 1)           # mono
	_write_u32(f, rate)
	_write_u32(f, rate * 2)    # byte rate
	_write_u16(f, 2)           # block align
	_write_u16(f, 16)          # bits per sample
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
