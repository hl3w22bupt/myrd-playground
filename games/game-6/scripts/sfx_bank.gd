class_name SfxBank
extends RefCounted
## 程序化音效银行（迭代需求 ①「拾取瞬间音效」落点）：
## 全部音效在运行时合成为 AudioStreamWAV（16-bit PCM 单弦波/噪声段），零二进制资产 ——
## Web 导出不增文件数（APPHOST 文件数红线），headless 冒烟下 Dummy 音频驱动照常可播不报错。
##
## 规范要点：纯静态工具（无节点状态）；播放 = 往调用方父节点挂一次性 AudioStreamPlayer，
## 播完自毁（树计时器兜底回收，不依赖 finished 信号 —— Dummy 驱动下该信号不可靠）。
## plays_total / plays_of(kind) 计数器供冒烟断言「音效真的触发过」。

const SAMPLE_RATE: int = 22050

## 音效定义：key → 音段序列（每段 {freq, freq_end, seconds, volume, wave}）。
## wave: "sine" 正弦 / "square" 方波 / "noise" 白噪声（冲刺嗖声用）。
const SFX_DEFS: Dictionary = {
	&"coin": [{"freq": 1318.0, "freq_end": 1318.0, "seconds": 0.07, "volume": 0.5, "wave": "sine"},
		{"freq": 1760.0, "freq_end": 1760.0, "seconds": 0.09, "volume": 0.42, "wave": "sine"}],
	&"powerup": [{"freq": 523.0, "freq_end": 523.0, "seconds": 0.07, "volume": 0.5, "wave": "sine"},
		{"freq": 659.0, "freq_end": 659.0, "seconds": 0.07, "volume": 0.5, "wave": "sine"},
		{"freq": 880.0, "freq_end": 880.0, "seconds": 0.14, "volume": 0.5, "wave": "sine"}],
	&"shield": [{"freq": 622.0, "freq_end": 932.0, "seconds": 0.18, "volume": 0.45, "wave": "sine"},
		{"freq": 1244.0, "freq_end": 1244.0, "seconds": 0.1, "volume": 0.35, "wave": "sine"}],
	&"dash": [{"freq": 180.0, "freq_end": 90.0, "seconds": 0.16, "volume": 0.5, "wave": "square"},
		{"freq": 0.0, "freq_end": 0.0, "seconds": 0.2, "volume": 0.32, "wave": "noise"}],
	&"smash": [{"freq": 140.0, "freq_end": 70.0, "seconds": 0.16, "volume": 0.55, "wave": "square"}],
	&"death": [{"freq": 440.0, "freq_end": 110.0, "seconds": 0.36, "volume": 0.5, "wave": "square"}],
}

## 累计播放计数（冒烟断言用；进程级，不随重开清零 —— 只断言「>0」）。
static var plays_total: int = 0
## 按 key 计数（冒烟断言「特定音效触发」用）。
static var _plays_by_key: Dictionary = {}
## 合成结果缓存（进程级一份，重复播放零合成开销）。
static var _cache: Dictionary = {}


## 播放一段音效：往 parent 挂一次性 AudioStreamPlayer，播完自毁。
## headless（Dummy 驱动）下 play() 为安全空操作，不产生脚本错误。
static func play(key: StringName, parent: Node) -> void:
	if parent == null or not parent.is_inside_tree():
		return
	var stream: AudioStreamWAV = stream_of(key)
	if stream == null:
		return
	var player := AudioStreamPlayer.new()
	player.stream = stream
	player.volume_db = -6.0
	player.name = "Sfx%s%d" % [key.to_pascal_case(), plays_total]
	parent.add_child(player)
	player.play()
	plays_total += 1
	_plays_by_key[key] = int(_plays_by_key.get(key, 0)) + 1
	var lifetime: float = stream.get_length() + 0.1
	parent.get_tree().create_timer(lifetime).timeout.connect(func() -> void:
		if is_instance_valid(player):
			player.queue_free()
	)


## key 的累计播放次数（冒烟断言用）。
static func plays_of(key: StringName) -> int:
	return int(_plays_by_key.get(key, 0))


## 取（必要时合成并缓存）key 对应的 AudioStreamWAV。
static func stream_of(key: StringName) -> AudioStreamWAV:
	if _cache.has(key):
		return _cache[key] as AudioStreamWAV
	var segments: Array = SFX_DEFS.get(key, [])
	if segments.is_empty():
		return null
	var stream := _synthesize(segments)
	_cache[key] = stream
	return stream


## 把音段序列合成为一份 16-bit PCM（段间无缝拼接，尾端 8ms 淡出防爆音）。
static func _synthesize(segments: Array) -> AudioStreamWAV:
	var samples: PackedFloat32Array = PackedFloat32Array()
	for segment: Dictionary in segments:
		_append_segment(samples, segment)
	var bytes := PackedByteArray()
	bytes.resize(samples.size() * 2)
	for i: int in samples.size():
		bytes.encode_s16(i * 2, int(clampf(samples[i], -1.0, 1.0) * 32767.0))
	var stream := AudioStreamWAV.new()
	stream.format = AudioStreamWAV.FORMAT_16_BITS
	stream.mix_rate = SAMPLE_RATE
	stream.stereo = false
	stream.data = bytes
	return stream


## 追加一个音段：freq → freq_end 线性扫频，正弦/方波/噪声可选，末端 8ms 淡出。
static func _append_segment(samples: PackedFloat32Array, segment: Dictionary) -> void:
	var count: int = int(float(segment["seconds"]) * float(SAMPLE_RATE))
	var fade: int = mini(int(float(SAMPLE_RATE) * 0.008), count)
	var phase: float = 0.0
	var rng := RandomNumberGenerator.new()
	rng.seed = 20260927  # 噪声段也确定可复现（门禁要求同种子同输出）
	for i: int in count:
		var t: float = float(i) / float(maxi(count, 1))
		var freq: float = lerpf(float(segment["freq"]), float(segment["freq_end"]), t)
		phase += TAU * freq / float(SAMPLE_RATE)
		var amplitude: float = float(segment["volume"])
		if i >= count - fade:
			amplitude *= float(count - i) / float(maxi(fade, 1))
		var wave: String = String(segment["wave"])
		var value: float
		if wave == "noise":
			value = rng.randf_range(-1.0, 1.0) * amplitude
		elif wave == "square":
			value = (1.0 if fmod(phase, TAU) < PI else -1.0) * amplitude
		else:
			value = sin(phase) * amplitude
		samples.append(value)
