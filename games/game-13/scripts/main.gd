extends Node2D
## 主场景控制器 —— BOOT → PLAYING 的落点：
##   · 有存档 → 带进度还原对应关卡（随时退出并保留本轮收集进度）
##   · 无存档 → 从第 1 关开始
##   · 通关（CLEARED/PERFECT）→ 结算面板「下一关」进入下一关；第 3 关通完清存档
##   · ESC → 关卡暂停（暂停层负责继续/存档退出）

const LEVEL_SCENE_PATHS: Dictionary = {
	1: "res://scenes/levels/level_01.tscn",
	2: "res://scenes/levels/level_02.tscn",
	3: "res://scenes/levels/level_03.tscn",
}
const FIRST_LEVEL: int = 1
const LAST_LEVEL: int = 3

var current_level: GameLevel

@onready var _holder: Node2D = $LevelHolder


func _ready() -> void:
	var payload := SaveStore.load_progress()
	var level_index: int = FIRST_LEVEL
	if not payload.is_empty():
		level_index = clampi(int(payload.get("level_index", FIRST_LEVEL)), FIRST_LEVEL, LAST_LEVEL)
	_load_level(level_index, payload)


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("pause") and current_level != null and current_level.machine.is_playing():
		current_level.pause_game()
		get_viewport().set_input_as_handled()


func _load_level(level_index: int, payload: Dictionary = {}) -> void:
	var path: String = LEVEL_SCENE_PATHS.get(level_index, LEVEL_SCENE_PATHS[FIRST_LEVEL])
	var packed: PackedScene = load(path)
	var level := packed.instantiate() as GameLevel
	if not payload.is_empty() and int(payload.get("level_index", -1)) == level_index:
		level.restore_payload = payload
	current_level = level
	_holder.add_child(level)
	level.next_level_requested.connect(_on_next_level_requested.bind(level))


func _on_next_level_requested(finished: GameLevel) -> void:
	if finished.level_index >= LAST_LEVEL:
		SaveStore.clear_progress()
		finished.restart_level()  # 第 3 关通完：回第 1 关开新档
		return
	_holder.remove_child(finished)
	finished.queue_free()
	_load_level(finished.level_index + 1)
