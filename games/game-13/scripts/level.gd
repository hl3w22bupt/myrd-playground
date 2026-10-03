class_name GameLevel
extends Node2D
## 关卡控制器 —— 《测试预算边界》的核心循环：
##   点击/拖拽收集 → 扣预算 → 每次扣减后立即边界检查 → 三分支结算。
## 数值口径全部来自策划案 numeric 段（冷却 120ms、扫收半径 28px、单局 240s / 硬上限 300s）。

signal progress_changed(collected: int, goal: int, budget: int)
signal outcome_decided(outcome: String, stars: int, collected: int, goal: int, budget_left: int)
signal time_warned(seconds_left: int)
signal next_level_requested

const CLICK_COOLDOWN_MS: int = 120
const MAX_COLLECT_PER_SWEEP: int = 12
const TARGET_SESSION_SECONDS: int = 240
const HARD_CAP_SESSION_SECONDS: int = 300
const WARN_AT_SECONDS_LEFT: int = 30
const SETTLE_DELAY_SECONDS: float = 0.6
const OUTCOME_CLEARED: String = "CLEARED"
const OUTCOME_PERFECT: String = "PERFECT"
const OUTCOME_FAILED: String = "FAILED"
const STARS_CLEARED: int = 2
const STARS_PERFECT: int = 3
const STARS_FAILED: int = 0
## 布点场地：640x360 视口内留出顶部 HUD 与边缘留白。
const ARENA := Rect2(64, 96, 512, 224)

@export var level_index: int = 1
@export var level_title: String = ""
@export var start_budget: int = 8
@export var star_count: int = 6
@export var crystal_count: int = 0
@export var decoy_count: int = 0
@export var spawn_seed: int = 20261004
@export_multiline var hint_text: String = ""

## 从存档恢复时由 Main 注入；非空则跳过常规铺设，按快照还原。
var restore_payload: Dictionary = {}

var machine := GameStateMachine.new()
var ledger := BudgetLedger.new()
var collected: int = 0
var goal: int = 0
var elapsed_seconds: float = 0.0
var outcome: String = ""
var stars: int = 0

var _last_action_ms: int = -1_000_000
var _sweeping: bool = false
var _sweep_collects: int = 0
var _spawn_cursor: int = 0
var _autosave_accumulator: float = 0.0
var _warned: bool = false
var _rng := RandomNumberGenerator.new()

@onready var _entities: Node2D = $Entities
@onready var _cursor: PlayerCursor = $Cursor
@onready var _budget_meter: HudBudgetMeter = $UI/BudgetMeter
@onready var _counter: HudCollectCounter = $UI/CollectCounter
@onready var _session_label: Label = $UI/SessionTime
@onready var _hint_label: Label = $UI/Hint
@onready var _settlement: SettlementPanel = $UI/SettlementPanel
@onready var _pause_overlay: PauseOverlay = $UI/PauseOverlay


func _ready() -> void:
	add_child(machine)
	machine.state_changed.connect(_on_state_changed)
	_rng.seed = spawn_seed

	_settlement.visible = false
	_pause_overlay.visible = false
	_settlement.restart_requested.connect(restart_level)
	_settlement.next_level_requested.connect(func() -> void: next_level_requested.emit())
	_pause_overlay.resume_requested.connect(resume_from_pause)
	_pause_overlay.save_and_quit_requested.connect(_save_and_quit)

	_cursor.sweep_started_at.connect(_on_sweep_started)
	_cursor.sweep_ended_at.connect(_on_sweep_ended)
	_cursor.sweep_moved.connect(_on_drag_moved)

	if restore_payload.is_empty():
		ledger.setup(start_budget)
		goal = star_count
		_spawn_entities()
	else:
		_restore_from(restore_payload)

	_hint_label.text = hint_text
	_publish_progress()
	machine.transition(GameStateMachine.State.PLAYING)


func _process(delta: float) -> void:
	if not machine.is_playing():
		return
	elapsed_seconds += delta
	_session_label.text = "本局用时：%ds / 上限 %ds" % [int(elapsed_seconds), HARD_CAP_SESSION_SECONDS]
	var seconds_left := HARD_CAP_SESSION_SECONDS - int(elapsed_seconds)
	if not _warned and seconds_left <= WARN_AT_SECONDS_LEFT and seconds_left > 0:
		_warned = true
		time_warned.emit(seconds_left)
	if elapsed_seconds >= HARD_CAP_SESSION_SECONDS:
		_settle(OUTCOME_FAILED, STARS_FAILED, "硬上限超时")
		return
	_autosave_accumulator += delta
	if _autosave_accumulator >= SaveStore.AUTOSAVE_INTERVAL_SECONDS:
		_autosave_accumulator = 0.0
		save_progress()


# ── 铺场 ───────────────────────────────────────────────────────────────

func _spawn_entities() -> void:
	var positions := _layout_positions()
	_spawn_stars(star_count, positions)
	_spawn_kind("res://scenes/refund_crystal.tscn", crystal_count, positions)
	_spawn_kind("res://scenes/decoy_rock.tscn", decoy_count, positions)


## 确定性布点：网格 + 固定种子抖动（策划案 spawnJitterPx=12），冒烟可复现。
func _layout_positions() -> Array[Vector2]:
	var total: int = star_count + crystal_count + decoy_count
	var cols: int = maxi(1, int(ceil(sqrt(float(total) * ARENA.size.x / ARENA.size.y))))
	var rows: int = maxi(1, int(ceil(float(total) / cols)))
	var cell := Vector2(ARENA.size.x / cols, ARENA.size.y / rows)
	var result: Array[Vector2] = []
	for row in rows:
		for col in cols:
			if result.size() >= total:
				break
			var jitter := Vector2(_rng.randf_range(-12.0, 12.0), _rng.randf_range(-12.0, 12.0))
			result.append(ARENA.position + Vector2(cell.x * (col + 0.5), cell.y * (row + 0.5)) + jitter)
	return result


func _spawn_stars(count: int, positions: Array[Vector2]) -> void:
	var packed: PackedScene = load("res://scenes/collectible_star.tscn")
	for i in count:
		var star := packed.instantiate() as CollectibleStar
		_place(star, positions)
		star.collected.connect(_on_star_collected)
		_entities.add_child(star)


func _spawn_kind(scene_path: String, count: int, positions: Array[Vector2]) -> void:
	var packed: PackedScene = load(scene_path)
	for i in count:
		var node := packed.instantiate() as Node2D
		_place(node, positions)
		_entities.add_child(node)


func _place(node: Node2D, positions: Array[Vector2]) -> void:
	if not positions.is_empty():
		node.position = positions[_spawn_cursor % positions.size()]
	_spawn_cursor += 1


# ── 输入 → 判定 ────────────────────────────────────────────────────────

func _on_sweep_started(world_pos: Vector2) -> void:
	if not machine.is_playing():
		return
	_sweeping = true
	_sweep_collects = 0
	_resolve_at(world_pos)


func _on_sweep_ended(_world_pos: Vector2) -> void:
	_sweeping = false


## 拖拽扫收：按住移动途中逐件命中（单次扫收上限 12 件）。
func _on_drag_moved(world_pos: Vector2) -> void:
	if not _sweeping or not machine.is_playing():
		return
	if _sweep_collects >= MAX_COLLECT_PER_SWEEP:
		return
	_resolve_at(world_pos)


func _cooldown_ok() -> bool:
	var now := Time.get_ticks_msec()
	if now - _last_action_ms < CLICK_COOLDOWN_MS:
		return false
	_last_action_ms = now
	return true


## 命中解析：结晶 > 回扣晶体 > 诱饵石 > 点空。每次动作都花预算 → 立即边界检查。
func _resolve_at(point: Vector2) -> void:
	if not _cooldown_ok():
		return
	var star := _nearest(point, CollectibleStar) as CollectibleStar
	if star != null:
		star.collect()
		return
	var crystal := _nearest(point, RefundCrystal) as RefundCrystal
	if crystal != null:
		crystal.consume()
		ledger.spend_refund_crystal()
		_publish_progress()
		_check_boundary()
		return
	var rock := _nearest(point, DecoyRock) as DecoyRock
	if rock != null:
		rock.hit()
		_spend_misclick()
		return
	_spend_misclick()


func _spend_misclick() -> void:
	if not ledger.spend_misclick():
		return
	_publish_progress()
	_check_boundary()


## 半径命中（策划案 dragHitRadiusPx=28）：取最近的一个，已消费的不算。
func _nearest(point: Vector2, type: Variant) -> Node2D:
	var best: Node2D = null
	var best_distance: float = PlayerCursor.HIT_RADIUS_PX
	for child in _entities.get_children():
		var node := child as Node2D
		if node == null or not is_instance_of(node, type):
			continue
		if node.has_method("is_consumed") and node.is_consumed():
			continue
		var distance: float = point.distance_to(node.position)
		if distance <= best_distance:
			best_distance = distance
			best = node
	return best


# ── 收集 → 计数 → 边界 ────────────────────────────────────────────────

func _on_star_collected(_star: CollectibleStar) -> void:
	_sweep_collects += 1
	ledger.spend_collect()
	collected += 1
	_publish_progress()
	_check_boundary()


## 每次扣减后立即做边界检查（策划案状态机核心转移）：
##   集齐且剩余 > 0 → CLEARED（2 星）；集齐且剩余 == 0 → PERFECT（3 星）；
##   归零未集齐 → FAILED（0 星）。
func _check_boundary() -> void:
	if not machine.is_playing():
		return
	if goal > 0 and collected >= goal:
		if ledger.remaining > 0:
			_settle(OUTCOME_CLEARED, STARS_CLEARED)
		else:
			_settle(OUTCOME_PERFECT, STARS_PERFECT)
	elif ledger.remaining <= 0:
		_settle(OUTCOME_FAILED, STARS_FAILED)


func _settle(decided: String, decided_stars: int, reason: String = "") -> void:
	if machine.state != GameStateMachine.State.PLAYING:
		return
	outcome = decided
	stars = decided_stars
	machine.transition(GameStateMachine.State.SETTLING)
	await get_tree().create_timer(SETTLE_DELAY_SECONDS).timeout
	if not is_inside_tree():
		return
	match decided:
		OUTCOME_CLEARED:
			machine.transition(GameStateMachine.State.CLEARED)
		OUTCOME_PERFECT:
			machine.transition(GameStateMachine.State.PERFECT)
		_:
			machine.transition(GameStateMachine.State.FAILED)
	_settlement.show_outcome(outcome, stars, collected, goal, ledger.remaining)
	outcome_decided.emit(outcome, stars, collected, goal, ledger.remaining)
	if reason != "":
		print("[level] 结算 %s（%s）" % [outcome, reason])
	if decided != OUTCOME_FAILED:
		SaveStore.clear_progress()


# ── 暂停 / 存档 ───────────────────────────────────────────────────────

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("restart") and (machine.is_playing() or machine.is_settled()):
		restart_level()
		get_viewport().set_input_as_handled()


## ESC 暂停：先存档再冻结树（暂停层 UI 设为 PROCESS_MODE_ALWAYS，保持可点）。
func pause_game() -> void:
	if not machine.is_playing():
		return
	save_progress()
	machine.transition(GameStateMachine.State.PAUSED)
	get_tree().paused = true
	_pause_overlay.show_pause(progress_text())


func resume_from_pause() -> void:
	if machine.state != GameStateMachine.State.PAUSED:
		return
	_pause_overlay.hide_pause()
	get_tree().paused = false
	machine.transition(GameStateMachine.State.PLAYING)


func restart_level() -> void:
	get_tree().paused = false
	SaveStore.clear_progress()
	get_tree().reload_current_scene()


func _save_and_quit() -> void:
	save_progress()
	get_tree().paused = false
	get_tree().quit(0)


func progress_text() -> String:
	return "收集 %d/%d · 剩余预算 %d · 第 %d 关" % [collected, goal, ledger.remaining, level_index]


## 存本轮进度（已收计数 / 剩余预算 / 剩余实体位置 / 用时）。
func save_progress() -> bool:
	if machine.is_settled():
		return false
	var items_left: Array = []
	for child in _entities.get_children():
		var node := child as Node2D
		if node == null:
			continue
		var consumed: bool = child.has_method("is_consumed") and child.is_consumed()
		if consumed:
			continue
		var kind := "rock"
		if child is CollectibleStar:
			kind = "star"
		elif child is RefundCrystal:
			kind = "crystal"
		items_left.append({"kind": kind, "position": [node.position.x, node.position.y]})
	return SaveStore.save_progress({
		"level_index": level_index,
		"level_title": level_title,
		"start_budget": ledger.start_budget,
		"remaining_budget": ledger.remaining,
		"collected": collected,
		"goal": goal,
		"elapsed_seconds": elapsed_seconds,
		"hint_text": hint_text,
		"items_left": items_left,
	})


func snapshot() -> Dictionary:
	return {
		"level_index": level_index,
		"remaining_budget": ledger.remaining,
		"collected": collected,
		"goal": goal,
		"elapsed_seconds": elapsed_seconds,
	}


## 从存档快照还原：只重铺剩余实体，计数与预算按存档续。
func _restore_from(payload: Dictionary) -> void:
	level_index = int(payload.get("level_index", level_index))
	goal = int(payload.get("goal", star_count))
	collected = int(payload.get("collected", 0))
	elapsed_seconds = float(payload.get("elapsed_seconds", 0.0))
	ledger.setup(int(payload.get("start_budget", start_budget)))
	ledger.remaining = int(payload.get("remaining_budget", ledger.start_budget))
	var items_left: Array = payload.get("items_left", [])
	var scenes: Dictionary = {
		"star": load("res://scenes/collectible_star.tscn"),
		"crystal": load("res://scenes/refund_crystal.tscn"),
		"rock": load("res://scenes/decoy_rock.tscn"),
	}
	for item: Dictionary in items_left:
		var packed: PackedScene = scenes.get(str(item.get("kind", "")))
		if packed == null:
			continue
		var node := packed.instantiate() as Node2D
		if node is CollectibleStar:
			(node as CollectibleStar).collected.connect(_on_star_collected)
		var pos: Array = item.get("position", [0.0, 0.0])
		node.position = Vector2(float(pos[0]), float(pos[1]))
		_entities.add_child(node)


func _publish_progress() -> void:
	_budget_meter.set_budget(ledger.remaining)
	_counter.set_progress(collected, goal)
	progress_changed.emit(collected, goal, ledger.remaining)


func _on_state_changed(_from: GameStateMachine.State, _to: GameStateMachine.State) -> void:
	if _cursor != null:
		_cursor.visible = _to != GameStateMachine.State.PAUSED
