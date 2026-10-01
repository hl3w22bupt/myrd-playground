class_name Player
extends Node2D
## 玩家角色（值班电工·小安）：网格离散移动，每次 1 格，可推动蓄能方块。
##
## 规范要点（godot-game-dev SKILL.md）：
## - 输入只读 InputMap 动作名（project.godot [input] 已注册 move_left/right/up/down），
##   键盘与虚拟摇杆共用同一条路径（摇杆把触摸向量分解成 4 个移动动作的 strength）；
## - 玩法规则全部委托 GameState.try_move（SokobanBoard），本脚本只负责节奏与表现：
##   长按按 KEY_REPEAT_INTERVAL_MS 节流重复步进，步进动画 MOVE_ANIM_MS；
## - 对外只发信号（moved），不直接操作 UI 节点。

## 玩家完成一步移动（世界坐标为目标格中心）。
signal moved(world_position: Vector2)

var _repeat_cooldown: float = 0.0
var _step_tween: Tween


func _physics_process(delta: float) -> void:
	_repeat_cooldown = maxf(0.0, _repeat_cooldown - delta)
	if _repeat_cooldown > 0.0:
		return
	var direction := _read_direction()
	if direction == Vector2i.ZERO:
		return
	if not GameState.try_move(direction):
		# 撞墙 / 顶死方块：无效移动同样节流，避免按住方向键时每帧重试。
		_repeat_cooldown = GameState.KEY_REPEAT_INTERVAL_MS / 1000.0
		return
	_repeat_cooldown = GameState.KEY_REPEAT_INTERVAL_MS / 1000.0
	_animate_to(GameState.board.player)
	moved.emit(cell_center(GameState.board.player))


## 棋盘整体复位（载入 / 重开 / 撤销 / 换关）时对齐格子，终止在途动画。
func snap_to_board() -> void:
	if _step_tween != null and _step_tween.is_valid():
		_step_tween.kill()
	global_position = cell_center(GameState.board.player)


## 格子坐标 → 世界坐标（格中心）。棋盘原点与单格边长都来自 GameState 调参区。
func cell_center(cell: Vector2i) -> Vector2:
	var half := float(GameState.CELL_SIZE_PX) / 2.0
	return GameState.BOARD_ORIGIN_PX + Vector2(cell) * float(GameState.CELL_SIZE_PX) + Vector2(half, half)


## 读方向动作，取主轴（对角输入时按绝对值大的轴走，推箱子不允许斜走）。
func _read_direction() -> Vector2i:
	var axis := Input.get_vector("move_left", "move_right", "move_up", "move_down")
	if axis == Vector2.ZERO:
		return Vector2i.ZERO
	if absf(axis.x) > absf(axis.y):
		return Vector2i.RIGHT if axis.x > 0.0 else Vector2i.LEFT
	return Vector2i.DOWN if axis.y > 0.0 else Vector2i.UP


func _animate_to(cell: Vector2i) -> void:
	if _step_tween != null and _step_tween.is_valid():
		_step_tween.kill()
	_step_tween = create_tween()
	_step_tween.tween_property(self, "global_position", cell_center(cell), GameState.MOVE_ANIM_MS / 1000.0)
