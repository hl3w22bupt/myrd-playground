extends Node2D
## snake-ghost 残影 spike（A2 · 独立 spike，不进主线分支）。
##
## 目的：对「残影 3.0s / 逻辑 10Hz 采样 / 30 节点池」做可复现实测，
## 产出帧率 / 内存数据 → 回答「能 / 不能」（判据见 concept-pool-v1.md §A2.2）。
##
## 实现口径（与美术规格 §A3.1 一致， spike 即按可开工粒度实现）：
## - 逻辑 10Hz 存档点采样：每 0.1s 在蛇头当前位置落一个残影节点；
## - 残影存活 3.0s，透明度线性衰减 α 0.35 → 0.00（按存活时间归一化，无台阶无缓动）；
## - 颜色偏移：色相 −24°、明度 +10%（「过去时」冷读法），本体色板不变；
## - 满载上限 30 节点（3.0s × 10Hz），对象池轮转复用，超发计数 pool_exhausted。
##
## 采样（§A2.1）：
## - 逐秒记录 Engine.get_frames_per_second() 与该秒内帧间隔 min/avg/max；
## - 内存 OS.get_memory_info()（起止差值）；
## - 结束时输出 verdict 行（§A2.2 阈值机判，仅覆盖桌面指标；
##   移动端 Safari 真机帧率/输入延迟按 README 录屏流程人工核对）。
##
## 运行（run-spike.sh 封装；也可手工）：
##   godot --headless --path <临时工程> （60s 后自动退出）
##   godot --path <临时工程>           （窗口模式，供录屏）
## 输出：$SPIKE_OUT_DIR（默认 ./spike-data）/fps.csv、mem.json、run-headless.log

const RUN_SEC: float = 60.0              # 默认采样时长（秒，真实墙钟）；可被环境变量 SPIKE_SEC 覆盖
const GHOST_LIFE_SEC: float = 3.0        # 残影存活（§A1.1 参数锁 3.0s）
const SAMPLE_HZ: float = 10.0            # 存档点采样频率（§A3.1）
const POOL_CAP: int = 30                 # 满载上限（3.0s × 10Hz，§A3.1）
const GHOST_ALPHA_MAX: float = 0.35      # 透明度衰减起点（§A3.1）
const CELL: float = 64.0                 # spike 场地格边长（像素）
const GRID_W: int = 11                   # 720 宽下 11 列
const GRID_H: int = 20                   # 1280 高下 20 行
const STEP_SEC: float = 0.12             # 蛇头步进间隔（≈8 格/秒，模拟游玩移速）
## 本体色板（spike 自带 5 色，代表糖果色板；残影在其上做 H/V 偏移，不引入新色板）。
const BASE_COLORS: Array[Color] = [
	Color(0.94, 0.35, 0.35), Color(0.35, 0.80, 0.45), Color(0.35, 0.55, 0.95),
	Color(0.95, 0.80, 0.30), Color(0.70, 0.45, 0.90),
]
## §A2.2 「能」阈值。
const THRESH_FPS_PCT: float = 95.0       # 60s 内 ≥95% 采样点 60fps
const THRESH_P1_LOW_FPS: float = 45.0    # 1% 低帧 ≥45fps
const THRESH_HEAP_DELTA_MB: float = 50.0 # 60s 满载堆增量 <50MB

var _rng := RandomNumberGenerator.new()
var _elapsed: float = 0.0
var _sample_clock: float = 0.0           # 残影 10Hz 采样钟
var _step_clock: float = 0.0             # 蛇头步进钟
var _second_clock: float = 0.0           # 逐秒统计钟
var _seconds_done: int = 0

## 蛇头状态（格子坐标 + 方向，随机转向模拟游玩）。
var _head: Vector2i = Vector2i(GRID_W / 2, GRID_H / 2)
var _dir: Vector2i = Vector2i.RIGHT
var _ghost_color: Color = BASE_COLORS[0]

## 残影对象池：alive 持渲染态，free 持复用节点；超发只计数不破池上限。
var _alive: Array[Dictionary] = []       # {node: Polygon2D, age: float}
var _free: Array[Polygon2D] = []
var _ghosts_root: Node2D
var _pool_exhausted: int = 0

## 逐秒采样缓冲。
var _fps_samples: PackedInt64Array = []
var _frame_ms_samples: PackedFloat64Array = []
var _sec_frame_min_ms: float = 9999.0
var _sec_frame_max_ms: float = 0.0
var _sec_frame_sum_ms: float = 0.0
var _sec_frame_count: int = 0

var _mem_start: Dictionary = {}
var _hud: Label
var _run_sec: float = RUN_SEC


func _ready() -> void:
	Engine.max_fps = 60
	var sec_env := OS.get_environment("SPIKE_SEC")
	if sec_env.is_valid_float() and float(sec_env) > 0.0:
		_run_sec = float(sec_env)
	_rng.seed = 20260920  # spike 可复现：转向序列固定
	_mem_start = OS.get_memory_info()
	_build_stage()
	print("SPIKE: begin run_sec=%.0f life=%.1fs hz=%.0f pool=%d out=%s" % [
		_run_sec, GHOST_LIFE_SEC, SAMPLE_HZ, POOL_CAP,
		OS.get_environment("SPIKE_OUT_DIR") if OS.get_environment("SPIKE_OUT_DIR") != "" else "./spike-data",
	])


func _build_stage() -> void:
	var back := ColorRect.new()
	back.color = Color(0.13, 0.11, 0.24, 0.88)  # 延续 Pixel Fives 深紫底（§A3.2）
	back.size = Vector2(GRID_W * CELL, GRID_H * CELL)
	back.position = (Vector2(720, 1280) - back.size) * 0.5
	add_child(back)
	_ghosts_root = Node2D.new()
	_ghosts_root.position = back.position
	add_child(_ghosts_root)
	# 蛇头本体（当前帧位置，无拖尾责任）。
	var head_node := Polygon2D.new()
	head_node.color = _ghost_color
	head_node.polygon = _square(CELL * 0.8)
	head_node.position = _cell_center(_head)
	head_node.name = "Head"
	add_child(head_node)
	_hud = Label.new()
	_hud.position = Vector2(24, 60)
	_hud.add_theme_font_size_override("font_size", 28)
	_hud.text = "snake-ghost spike"
	add_child(_hud)


func _process(delta: float) -> void:
	if _elapsed >= _run_sec:
		_finish()
		return
	_elapsed += delta
	_sample_clock += delta
	_step_clock += delta
	_second_clock += delta
	# 帧间隔统计（逐帧累计，逐秒归档）。
	var frame_ms: float = delta * 1000.0
	_sec_frame_min_ms = minf(_sec_frame_min_ms, frame_ms)
	_sec_frame_max_ms = maxf(_sec_frame_max_ms, frame_ms)
	_sec_frame_sum_ms += frame_ms
	_sec_frame_count += 1
	# 蛇头步进 + 边界随机转向（模拟游玩轨迹）。
	if _step_clock >= STEP_SEC:
		_step_clock = 0.0
		_advance_head()
		(get_node("Head") as Polygon2D).position = _cell_center(_head)
	# 残影 10Hz 存档点采样。
	if _sample_clock >= 1.0 / SAMPLE_HZ:
		_sample_clock -= 1.0 / SAMPLE_HZ
		_spawn_ghost()
	_tick_ghosts(delta)
	# 逐秒归档。
	if _second_clock >= 1.0:
		_second_clock -= 1.0
		_archive_second()
		_roll_palette()
	# HUD（录屏模式可读，headless 无副作用）。
	_hud.text = "fps %d | ghosts %d/%d | mem %.1f MB | %.0fs" % [
		Engine.get_frames_per_second(), _alive.size(), POOL_CAP,
		float(OS.get_memory_info()["physical"]) / 1048576.0, _elapsed,
	]


func _advance_head() -> void:
	if _rng.randf() < 0.25:  # 25% 概率转向，轨迹覆盖全场
		var left: Vector2i = Vector2i(Vector2(_dir).rotated(PI / 2.0).round())
		var right: Vector2i = Vector2i(Vector2(_dir).rotated(-PI / 2.0).round())
		_dir = left if _rng.randf() < 0.5 else right
	var next: Vector2i = _head + _dir
	if next.x < 0 or next.y < 0 or next.x >= GRID_W or next.y >= GRID_H:
		_dir = -_dir
		next = _head + _dir
	_head = next


func _spawn_ghost() -> void:
	var node: Polygon2D
	if _free.size() > 0:
		node = _free.pop_back()
	elif _alive.size() + _free.size() < POOL_CAP:
		node = Polygon2D.new()
		node.polygon = _square(CELL * 0.8)
		_ghosts_root.add_child(node)
	else:
		_pool_exhausted += 1  # 理论不应发生（3.0s×10Hz=30=池上限），发生即数据里如实记录
		return
	node.position = _cell_center(_head)
	var tint: Color = _shifted(_ghost_color)
	tint.a = GHOST_ALPHA_MAX  # 0.35 系数烘进本体色；衰减只走 modulate，保证线性
	node.color = tint
	node.modulate.a = 1.0
	node.visible = true
	_alive.append({"node": node, "age": 0.0})


## 残影寿命推进：α 线性 0.35 → 0.00 按存活时间归一化（color 系数 × modulate 线性衰减）；到期回池。
func _tick_ghosts(delta: float) -> void:
	var expired: Array[int] = []
	for i in _alive.size():
		var ghost: Dictionary = _alive[i]
		ghost["age"] = float(ghost["age"]) + delta
		var t: float = clampf(float(ghost["age"]) / GHOST_LIFE_SEC, 0.0, 1.0)
		var node: Polygon2D = ghost["node"]
		node.modulate.a = 1.0 - t
		if t >= 1.0:
			node.visible = false
			expired.append(i)
	for i in range(expired.size() - 1, -1, -1):
		var ghost: Dictionary = _alive[expired[i]]
		_free.append(ghost["node"])
		_alive.remove_at(expired[i])


## 颜色偏移（§A3.1）：色相 −24°、明度 +10%（逐秒换本体色，覆盖色板全部 5 色）。
func _shifted(base: Color) -> Color:
	# Godot 4 Color 的 HSV 读取是 .h/.s/.v 属性（不存在 get_h()/get_s()/get_v() 方法，实测解析错误）。
	var h: float = fposmod(base.h - 24.0 / 360.0, 1.0)
	var s: float = base.s
	var v: float = minf(base.v * 1.1, 1.0)
	return Color.from_hsv(h, s, v)


func _roll_palette() -> void:
	_ghost_color = BASE_COLORS[_seconds_done % BASE_COLORS.size()]


func _archive_second() -> void:
	var fps: int = Engine.get_frames_per_second()
	_fps_samples.append(fps)
	_frame_ms_samples.append(_sec_frame_sum_ms / float(maxi(_sec_frame_count, 1)))
	print("SPIKE: sample second=%d fps=%d frame_ms_avg=%.2f frame_ms_min=%.2f frame_ms_max=%.2f ghosts=%d pool_exhausted=%d" % [
		_seconds_done, fps, _sec_frame_sum_ms / float(maxi(_sec_frame_count, 1)),
		_sec_frame_min_ms, _sec_frame_max_ms, _alive.size(), _pool_exhausted,
	])
	_sec_frame_min_ms = 9999.0
	_sec_frame_max_ms = 0.0
	_sec_frame_sum_ms = 0.0
	_sec_frame_count = 0


func _finish() -> void:
	var mem_end: Dictionary = OS.get_memory_info()
	var heap_delta_mb: float = (float(mem_end["physical"]) - float(_mem_start["physical"])) / 1048576.0
	_write_csv()
	_write_json(mem_end, heap_delta_mb)
	_print_verdict(heap_delta_mb)
	get_tree().quit(0)


## §A2.2 判据机判（桌面指标；Safari 真机项按 README 人工核对后并入结论）。
func _print_verdict(heap_delta_mb: float) -> void:
	var total: int = _fps_samples.size()
	var at60: int = 0
	for fps in _fps_samples:
		if fps >= 60:
			at60 += 1
	var pct60: float = 100.0 * float(at60) / float(maxi(total, 1))
	var sorted_ms: PackedFloat64Array = _frame_ms_samples.duplicate()
	sorted_ms.sort()
	# 1% 低帧 = 帧间隔 MS 的 P99（最差 1% 秒的平均帧间隔 ≥ 1000/45=22.2ms 即不达）。
	var p99_ms: float = sorted_ms[mini(sorted_ms.size() - 1, int(floor(float(sorted_ms.size()) * 0.99)))] if sorted_ms.size() > 0 else 0.0
	var p1_low_fps: float = 1000.0 / p99_ms if p99_ms > 0.0 else 0.0
	var fps_ok: bool = pct60 >= THRESH_FPS_PCT and p1_low_fps >= THRESH_P1_LOW_FPS
	var mem_ok: bool = heap_delta_mb < THRESH_HEAP_DELTA_MB
	print("SPIKE: verdict_desktop fps_pct_at60=%.1f%%(阈值≥%.0f%%) p1_low_fps=%.1f(阈值≥%.0f) heap_delta=%.1fMB(阈值<%.0fMB) pool_exhausted=%d" % [
		pct60, THRESH_FPS_PCT, p1_low_fps, THRESH_P1_LOW_FPS, heap_delta_mb, THRESH_HEAP_DELTA_MB, _pool_exhausted,
	])
	print("SPIKE: verdict_desktop fps=%s mem=%s => 桌面口径 %s" % [
		"能" if fps_ok else "不能", "能" if mem_ok else "不能",
		"能" if (fps_ok and mem_ok) else "不能",
	])


func _write_csv() -> void:
	var path := _out_path("fps.csv")
	var f := FileAccess.open(path, FileAccess.WRITE)
	if f == null:
		printerr("SPIKE: FAIL csv 写入失败: %s" % path)
		return
	f.store_line("second,fps,frame_ms_avg,frame_ms_min_missing,ghosts_alive,pool_exhausted")
	for i in _fps_samples.size():
		f.store_line("%d,%d,%.3f,,%d,%d" % [i, _fps_samples[i], _frame_ms_samples[i], POOL_CAP, _pool_exhausted])
	f.close()
	print("SPIKE: csv written %s" % path)


func _write_json(mem_end: Dictionary, heap_delta_mb: float) -> void:
	var path := _out_path("mem.json")
	var f := FileAccess.open(path, FileAccess.WRITE)
	if f == null:
		printerr("SPIKE: FAIL json 写入失败: %s" % path)
		return
	f.store_string(JSON.stringify({
		"run_sec": _run_sec,
		"ghost_life_sec": GHOST_LIFE_SEC,
		"sample_hz": SAMPLE_HZ,
		"pool_cap": POOL_CAP,
		"pool_exhausted": _pool_exhausted,
		"mem_start_physical_bytes": float(_mem_start["physical"]),
		"mem_end_physical_bytes": float(mem_end["physical"]),
		"heap_delta_mb": heap_delta_mb,
		"fps_samples": _fps_samples,
		"frame_ms_avg_per_second": _frame_ms_samples,
	}, "  "))
	f.close()
	print("SPIKE: json written %s" % path)


func _out_path(filename: String) -> String:
	var dir := OS.get_environment("SPIKE_OUT_DIR")
	if dir.is_empty():
		dir = "spike-data"
	if not DirAccess.dir_exists_absolute(dir):
		DirAccess.make_dir_recursive_absolute(dir)
	return dir.path_join(filename)


func _square(size: float) -> PackedVector2Array:
	var h: float = size * 0.5
	return PackedVector2Array([Vector2(-h, -h), Vector2(h, -h), Vector2(h, h), Vector2(-h, h)])


func _cell_center(cell: Vector2i) -> Vector2:
	return Vector2(cell.x * CELL + CELL * 0.5, cell.y * CELL + CELL * 0.5)
