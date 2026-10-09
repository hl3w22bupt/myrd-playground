class_name Lane
extends Node2D
## 单条轨道：持有本轨音符、按歌曲时钟更新位置、处理击打判定与 MISS 收口。
##
## 规范要点：
## - 只 emit 信号，不直接操作 UI（订阅方在 main.gd 集中连接）；
## - 击打判定用时间差（歌曲时钟 − 音符时刻），窗口从 GameState 调参区读取；
## - 同轨相邻音符判定互不吞噬：每次按键只取「时间上最近的未命中音符」。

## 一次击打判定落定（judgment 为 BeatJudge.Judgment 的 int 值；diff_ms 带符号时间差）。
signal note_judged(lane_index: int, judgment: int, diff_ms: float)
## 空按（窗口内没有可判定的音符）：无惩罚，仅反馈用。
signal lane_pressed_empty(lane_index: int)

## 本轨序号（0..3）。
var lane_index: int = 0
## 歌曲指挥引用（main 装配时注入；轨道用它读时钟，不反向持有 UI）。
var conductor: Conductor
## 轨道主色（绘制与反馈用）。
var lane_color: Color = Color(0.35, 0.65, 1.0)
## 判定圈高亮（按键反馈，随时间衰减）。
var receptor_glow: float = 0.0

## 谱面引用与本轨已激活音符。
var _chart: Array[Dictionary] = []
var _active: Array[RhythmNote] = []


## 装配新谱面（重开/换难度时调用）：换引用 + 清轨。
func load_chart(notes: Array[Dictionary]) -> void:
	clear_notes()
	_chart = notes


func clear_notes() -> void:
	for note in _active:
		if is_instance_valid(note):
			note.queue_free()
	_active.clear()
	receptor_glow = 0.0
	queue_redraw()


## 本轨当前活跃音符快照（只读；冒烟/调试断言用，不暴露内部数组的写入口）。
func active_notes_snapshot() -> Array[RhythmNote]:
	return _active.duplicate()


## 激活一个谱面音符（conductor 在进入下落窗口时调用）。
func activate_note(chart_index: int) -> void:
	var note := RhythmNote.new()
	note.chart_index = chart_index
	note.note_time = float(_chart[chart_index]["time"])
	note.position = Vector2(0.0, Conductor.SPAWN_Y)
	add_child(note)
	_active.append(note)


## 本轨按键：对「时间上最近的未命中音符」做窗口判定。
## 返回 Judgment（int）；窗口内无音符返回 -1（空按，不惩罚不吞音符）。
func press(now: float, calibration_offset_ms: float) -> int:
	receptor_glow = 1.0
	queue_redraw()
	var best: RhythmNote = null
	var best_diff_ms := INF
	for note in _active:
		if note.hit:
			continue
		var diff_ms := (now - note.note_time) * 1000.0 + calibration_offset_ms
		if absf(diff_ms) < absf(best_diff_ms):
			best = note
			best_diff_ms = diff_ms
	if best == null:
		lane_pressed_empty.emit(lane_index)
		return -1
	var judgment := BeatJudge.classify(best_diff_ms,
		GameState.perfect_window_ms, GameState.good_window_ms)
	if judgment == BeatJudge.Judgment.MISS:
		# 早按/晚按超出 GOOD 窗：不吞音符不惩罚，音符仍可被后续按键命中。
		lane_pressed_empty.emit(lane_index)
		return -1
	best.hit = true
	_active.erase(best)
	best.queue_free()
	note_judged.emit(lane_index, judgment, best_diff_ms)
	return judgment


## 终局收口：把本轨全部未命中音符按 MISS 结算（conductor 在谱面终点调用）。
func flush_misses(now: float) -> void:
	for note in _active:
		note_judged.emit(lane_index, BeatJudge.Judgment.MISS,
			(now - note.note_time) * 1000.0)
		note.queue_free()
	_active.clear()


func _physics_process(delta: float) -> void:
	if _active.is_empty() and receptor_glow <= 0.0:
		return
	var speed := GameState.fall_speed_px_s()
	var now := conductor.song_time if conductor != null else 0.0
	var expired: Array[RhythmNote] = []
	for note in _active:
		# 超出 GOOD 窗仍未命中 → MISS（漏按，combo 清零）。
		if now > note.note_time + GameState.good_window_ms / 1000.0:
			expired.append(note)
			continue
		note.position = Vector2(0.0, Conductor.note_y(note.note_time, now, speed))
	for note in expired:
		_active.erase(note)
		note_judged.emit(lane_index, BeatJudge.Judgment.MISS,
			(now - note.note_time) * 1000.0)
		note.queue_free()
	if receptor_glow > 0.0:
		receptor_glow = maxf(receptor_glow - delta * 4.0, 0.0)
	queue_redraw()


func _draw() -> void:
	# 轨道底色（半透明）。
	draw_rect(Rect2(-Conductor.LANE_WIDTH / 2.0, Conductor.SPAWN_Y,
		Conductor.LANE_WIDTH, Conductor.JUDGMENT_Y - Conductor.SPAWN_Y),
		Color(lane_color.r, lane_color.g, lane_color.b, 0.05))
	# 判定线 + 判定圈（按键时高亮衰减）。
	var glow := clampf(receptor_glow, 0.0, 1.0)
	var ring_color := Color(lane_color.r, lane_color.g, lane_color.b, 0.35 + 0.65 * glow)
	draw_rect(Rect2(-Conductor.LANE_WIDTH / 2.0, Conductor.JUDGMENT_Y - 3.0,
		Conductor.LANE_WIDTH, 6.0), ring_color)
	var half := Conductor.LANE_WIDTH / 2.0 - 12.0
	draw_rect(Rect2(-half, Conductor.JUDGMENT_Y - 22.0, half * 2.0, 44.0),
		Color(lane_color.r, lane_color.g, lane_color.b, 0.12 + 0.55 * glow),
		false, 2.0)
