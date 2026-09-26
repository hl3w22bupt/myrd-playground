class_name Cursor
extends Node2D
## 玩家可控光标：网格上的「角色」，决定旋转操作作用于哪个格子。
##
## 规范要点：
## - 输入只读 InputMap 动作名（project.godot [input] 已注册），键盘与触摸摇杆同一通道；
## - 对外只发信号（moved），不直接操作 UI / 棋盘；
## - 父节点固定为 BoardView（场景树：Main/Board/Cursor），用它做网格尺寸与坐标换算。

## 光标在网格上移动（参数：新格子坐标）。
signal moved(grid_pos: Vector2i)

## 逐格移动的冷却帧数（60 物理帧/秒下约 6 格/秒，兼顾手感与冒烟可断言性）。
const MOVE_COOLDOWN_FRAMES: int = 10

var grid_pos: Vector2i = Vector2i.ZERO

var _cooldown: int = 0

@onready var _board: BoardView = get_parent() as BoardView


## 关卡切换 / 重开时光标归位（由 BoardView 在装载关卡时调用）。
func place_at(cell: Vector2i) -> void:
	grid_pos = cell
	_cooldown = 0
	_sync_position()
	queue_redraw()


func _physics_process(_delta: float) -> void:
	if _cooldown > 0:
		_cooldown -= 1
		return
	var direction := Input.get_vector("move_left", "move_right", "move_up", "move_down")
	if direction == Vector2.ZERO:
		return
	var step: Vector2i = _dominant_step(direction)
	var next_pos: Vector2i = grid_pos + step
	if not _board.is_inside_grid(next_pos):
		return
	grid_pos = next_pos
	_cooldown = MOVE_COOLDOWN_FRAMES
	_sync_position()
	queue_redraw()
	moved.emit(grid_pos)


## 模拟量方向 → 单格步进（取绝对值最大的轴，保证逐格可断言）。
func _dominant_step(direction: Vector2) -> Vector2i:
	if absf(direction.x) >= absf(direction.y):
		return Vector2i(1, 0) if direction.x > 0.0 else Vector2i(-1, 0)
	return Vector2i(0, 1) if direction.y > 0.0 else Vector2i(0, -1)


func _sync_position() -> void:
	position = _board.cell_center(grid_pos)


func _draw() -> void:
	var half: float = _board.CELL * 0.5 - 6.0
	var color := Color(1.0, 0.92, 0.35, 0.95)
	draw_rect(Rect2(-half, -half, half * 2.0, half * 2.0), color, false, 4.0)
