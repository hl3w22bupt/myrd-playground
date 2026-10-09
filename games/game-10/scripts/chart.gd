class_name ChartGen
extends RefCounted
## 谱面生成器（纯逻辑）：按难度档生成确定性谱面 + 谱面校验。
##
## - 确定性：同难度同参数必出同谱面（随机种子固定），门禁可复现；
## - 密度：相邻音符间隔 = GameState.note_interval_s（难度表），Expert 密、Easy 疏；
## - 校验（需求 AC3「谱面校验」）：时间升序、同轨相邻音符间隔 ≥ 判定窗下限的 2 倍
##   （同轨相邻音符判定互不吞噬）、轨道号在 0..3、全部落在 [first_time, song_duration]。

const LANES: int = 4
## 谱面起点：必须 ≥ 最慢档（Easy 300px/s）穿过全屏的下落时长（≈3.7s），
## 否则开局首个音符已经在屏幕中央而非从顶端落入。
const FIRST_NOTE_TIME_S: float = 3.8
## 同轨相邻音符的最小时间间隔（秒）：大于 GOOD 窗（±100ms）的 2 倍，判定互不吞噬。
const MIN_LANE_GAP_S: float = 0.24
## 结算前收尾静默时长（秒）。
const TAIL_S: float = 1.0


## 生成谱面：返回音符数组（{time: float 秒, lane: int 0..3}，按时间升序）。
## duration_in_s：本局歌曲时长；interval_s / rng_seed 由调用方（conductor）按难度给。
static func generate(duration_in_s: float, interval_s: float, rng_seed: int) -> Array[Dictionary]:
	var notes: Array[Dictionary] = []
	var rng := RandomNumberGenerator.new()
	rng.seed = rng_seed
	var last_time_per_lane: Array[float] = []
	for i in LANES:
		last_time_per_lane.append(-INF)
	var t := FIRST_NOTE_TIME_S
	while t <= duration_in_s - TAIL_S:
		# 均匀轮转 + 随机抖动选轨，保证四轨负载均衡又确定可复现。
		var lane := wrapi(notes.size() + rng.randi_range(0, 1), 0, LANES)
		var placed_time := t
		if placed_time - last_time_per_lane[lane] < MIN_LANE_GAP_S:
			placed_time += MIN_LANE_GAP_S  # 同轨太近：顺延到最小间隔之后
		notes.append({"time": snappedf(placed_time, 0.001), "lane": lane})
		last_time_per_lane[lane] = placed_time
		t += interval_s
	return notes


## 谱面校验：全部通过返回空字符串，否则返回第一条违规原因（可读、可断言）。
static func validate(notes: Array[Dictionary], song_duration_s: float) -> String:
	var last_time_per_lane: Array[float] = []
	for i in LANES:
		last_time_per_lane.append(-INF)
	var previous_time := -INF
	for note in notes:
		var time := float(note["time"])
		var lane := int(note["lane"])
		if lane < 0 or lane >= LANES:
			return "谱面校验：轨道号 %d 越界（合法 0..%d）" % [lane, LANES - 1]
		if time < previous_time:
			return "谱面校验：音符时间未升序（%.3f 出现在 %.3f 之后）" % [time, previous_time]
		if time < 0.0 or time > song_duration_s:
			return "谱面校验：音符时间 %.3f 超出歌曲时长 [0, %.3f]" % [time, song_duration_s]
		if time - last_time_per_lane[lane] < MIN_LANE_GAP_S:
			return "谱面校验：轨道 %d 相邻音符间隔 %.3fs < %.2fs（判定会互吞）" % [
				lane, time - last_time_per_lane[lane], MIN_LANE_GAP_S]
		previous_time = time
		last_time_per_lane[lane] = time
	if notes.is_empty():
		return "谱面校验：谱面为空"
	return ""


## 谱面结束时刻（最后一个音符时间 + 收尾静默），供 conductor 判定整局结束。
static func end_time(notes: Array[Dictionary]) -> float:
	if notes.is_empty():
		return TAIL_S
	return float(notes[notes.size() - 1]["time"]) + TAIL_S
