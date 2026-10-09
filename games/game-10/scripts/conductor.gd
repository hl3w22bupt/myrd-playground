class_name Conductor
extends Node
## 歌曲指挥（song clock）：唯一的时间权威，持有谱面并驱动四轨。
##
## - 音符位置是 song_time 的纯函数：y = 判定线y − (音符时刻 − song_time) × 下落速度。
##   匀速、无累积漂移；song_time 在固定物理步（60Hz）里推进，无头运行确定可复现。
## - 需求口径：判定基准是歌曲时钟而非渲染帧；正式版接入音频时钟时只需替换
##   本文件里 song_time 的推进来源，判定逻辑（BeatJudge）零改动。

## 整局结束信号（谱面走完）。
signal finished

## ── 舞台几何（720×1280 竖屏）──
const LANE_COUNT: int = 4
const LANE_WIDTH: float = 180.0
const JUDGMENT_Y: float = 1040.0
const SPAWN_Y: float = -80.0

## 本局歌曲时长（秒）——脚手架固定曲目长度；完整版随曲目/难度配置交付。
const SONG_DURATION_S: float = 32.0
## 谱面随机种子基值（+ 难度档）：同难度必出同谱面，门禁可复现。
const SEED_BASE: int = 20261010

## 四轨（main.gd 装配后注入）。
var lanes: Array[Lane] = []
## 谱面（{time, lane} 数组，时间升序）。
var notes: Array[Dictionary] = []
## 歌曲时钟（秒）。
var song_time: float = 0.0
## 谱面游标：下一首待激活音符的下标。
var next_index: int = 0
## 是否在局中（局中才推进时钟与判定 MISS）。
var playing: bool = false
## 暂停（结算页/测试冻结时钟）。
var paused: bool = false
## 谱面校验信息（空串 = 通过）。
var validation_error: String = ""


## 开一局：按当前难度生成谱面并复位时钟。
func start() -> void:
	song_time = 0.0
	next_index = 0
	notes = ChartGen.generate(SONG_DURATION_S, GameState.note_interval_s(), SEED_BASE + GameState.difficulty)
	validation_error = ChartGen.validate(notes, SONG_DURATION_S)
	for lane in lanes:
		lane.load_chart(notes)
	playing = not notes.is_empty() and validation_error.is_empty()
	GameState.begin_run(notes.size())


## 重开：清轨后再开（同难度谱面确定复现）。
func restart() -> void:
	for lane in lanes:
		lane.clear_notes()
	start()


func song_end_time() -> float:
	return ChartGen.end_time(notes)


## 取第 i 个谱面音符（冒烟/调试用）。
func get_note(i: int) -> Dictionary:
	return notes[i]


func _physics_process(delta: float) -> void:
	if not playing or paused:
		return
	song_time += delta
	# 激活已进入下落窗口的音符（激活前在屏幕上方外，不可见）。
	var appear_lead_s := appear_lead_seconds()
	while next_index < notes.size() and float(notes[next_index]["time"]) - appear_lead_s <= song_time:
		var note: Dictionary = notes[next_index]
		lanes[int(note["lane"])].activate_note(next_index)
		next_index += 1
	# 时钟越过谱面终点：先把未命中音符按 MISS 收口（结算计数完整），再宣告结束。
	if song_time >= song_end_time():
		for lane in lanes:
			lane.flush_misses(song_time)
		playing = false
		finished.emit()


## 音符从出生点到判定线需要的时长（秒）：与下落速度联动，难度越快预备越短。
func appear_lead_seconds() -> float:
	return (JUDGMENT_Y - SPAWN_Y) / GameState.fall_speed_px_s()


## 音符在 song_time 时刻的 y 坐标（纯函数，无累积漂移）。
static func note_y(note_time: float, now: float, fall_speed: float) -> float:
	return JUDGMENT_Y - (note_time - now) * fall_speed
