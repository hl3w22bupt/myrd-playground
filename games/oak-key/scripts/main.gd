extends Node2D
## 主场景控制器：拾取 key 片段 → 本地校验 → 「有效 / 无效」反馈 → 重开一局。
##
## 规范要点（见 SKILL.md「场景规范」「移动端触摸规范」）：
## - 场景内信号连接统一写在 _ready()，集中可见、可被 preflight 静态核对；
## - 节点引用用 @onready + 类型标注，路径用 %唯一名 代替长路径字符串；
## - 玩法闭环（preflight 人工核对第 1 条）：输入 → Player 移动 → KeyFragment 覆盖检测
##   → GameState 登记（emit fragment_collected）→ 本场景发起探测 → OakKeyValidator 校验
##   → GameState.record_probe 落取证日志/存档（emit probe_finished）→ 本场景渲染反馈。

## 探针出生点（重开时复位用）。
const SPAWN_POSITION: Vector2 = Vector2(320.0, 180.0)

@onready var player: Player = $Player
@onready var fragments_root: Node2D = $Fragments
@onready var hud_label: Label = %HudLabel
@onready var key_label: Label = %KeyLabel
@onready var result_panel: Panel = %ResultPanel
@onready var result_label: Label = %ResultLabel
@onready var touch_ui: CanvasLayer = $TouchUI

## 按拾取顺序登记的真实片段（伪造片段只置位 decoy 标记，不进序列）。
var _chunks: PackedStringArray = PackedStringArray()
## 上次探测时的状态签名：相同签名不重复探测（按住键/盲按时避免刷取证日志）。
var _probed_signature: String = ""
var _move_hint: String = "WASD / 方向键移动 · 空格探测 · R 重开"


func _ready() -> void:
	if DisplayServer.is_touchscreen_available():
		touch_ui.visible = true
		_move_hint = "摇杆移动 · 右下按钮探测 / 重开"
	_connect_signals()
	result_panel.visible = false
	_refresh_hud()


func _connect_signals() -> void:
	for child in fragments_root.get_children():
		var fragment := child as KeyFragment
		if fragment != null and not fragment.collected.is_connected(_on_fragment_collected):
			fragment.collected.connect(_on_fragment_collected)
	if not player.moved.is_connected(_on_player_moved):
		player.moved.connect(_on_player_moved)
	if not GameState.fragment_collected.is_connected(_on_fragments_changed):
		GameState.fragment_collected.connect(_on_fragments_changed)
	if not GameState.probe_finished.is_connected(_on_probe_finished):
		GameState.probe_finished.connect(_on_probe_finished)


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("confirm"):
		_run_probe()
	elif event.is_action_pressed("restart"):
		restart_run()


## 发起一次 key 探测：本地校验 + 取证记录（GameState 落日志与存档）。
func _run_probe() -> void:
	var signature: String = "%d|%s" % [_chunks.size(), "1" if GameState.decoy_collected else "0"]
	if signature == _probed_signature:
		return
	_probed_signature = signature
	var result: Dictionary = OakKeyValidator.validate(_chunks, GameState.decoy_collected)
	# record_probe 内部：打取证日志行 + 写取证存档 + emit probe_finished（反馈在订阅方渲染）。
	GameState.record_probe(result)


## 重开一局：清空拾取状态、复位片段与出生点、隐藏结果面板（不重载场景树）。
func restart_run() -> void:
	_chunks = PackedStringArray()
	_probed_signature = ""
	GameState.reset_run()
	for child in fragments_root.get_children():
		var fragment := child as KeyFragment
		if fragment != null:
			fragment.restore()
	player.global_position = SPAWN_POSITION
	player.velocity = Vector2.ZERO
	result_panel.visible = false
	_refresh_hud()


## 最近一次探测结果（冒烟断言用）。
func last_probe_record() -> Dictionary:
	if GameState.probe_history.is_empty():
		return {}
	return GameState.probe_history[GameState.probe_history.size() - 1]


func _on_fragment_collected(fragment: KeyFragment) -> void:
	GameState.add_score(1)
	GameState.register_fragment(fragment.is_decoy)
	if not fragment.is_decoy:
		_chunks.append(fragment.chunk)
	_refresh_hud()


func _on_fragments_changed(count: int, required: int) -> void:
	_refresh_hud()
	if count >= required:
		hud_label.text = "已集齐 %d/%d 片段 · 按 空格 发起探测" % [count, required]


func _on_probe_finished(record: Dictionary) -> void:
	var valid: bool = String(record.get("oak_key_probe", "invalid")) == "valid"
	result_panel.visible = true
	var verdict: String = "有效 ✓" if valid else "无效 ✗"
	result_label.text = "探测结果：key %s\n%s\n（取证标记 oak_key_probe=%s · 按 R 重开）" % [
		verdict, String(record.get("reason", "")), String(record.get("oak_key_probe", "invalid")),
	]
	_refresh_hud()


func _on_player_moved(pos: Vector2) -> void:
	hud_label.text = "%s · 坐标 %d,%d" % [_move_hint, int(pos.x), int(pos.y)]


func _refresh_hud() -> void:
	key_label.text = "组装中 key：%s\n目标顺序：%s · 伪造片段 %s 必须避开" % [
		OakKeyValidator.assemble(_chunks),
		OakKeyValidator.CHUNK_SEPARATOR.join(PackedStringArray(OakKeyValidator.VALID_CHUNKS)),
		OakKeyValidator.DECOY_CHUNK,
	]
