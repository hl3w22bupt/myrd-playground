class_name Player
extends Node2D
## 玩家可控角色 = 布防光标：WASD / 方向键（或 InputMap 动作）在草坪上移动，
## confirm 在光标所在格布防；触屏用户直接点按草坪，不经过光标（双输入路径等价）。
##
## 规范要点（见 SKILL.md「GDScript 规范」）：
## - class_name 唯一，与文件名职责一致（player.gd → class_name Player）；
## - 输入只读 InputMap 动作名（project.godot [input] 已注册），禁止硬编码 keycode；
## - 对外只发信号，不直接操作 UI 节点（订阅方在 Main 场景接线）。

## 光标位置变化（模板信号契约：移动断言 / HUD 提示订阅）。
signal moved(position: Vector2)
## 光标所在格变化（Field 高亮回写用）。
signal cell_changed(cell: Vector2i)

## 战场引用（Main 接线时注入；光标的移动范围与格子换算都在 Field 上）。
var field: Field
## 仅在对局中响应输入（选关 / 结算界面冻结光标）。
var active: bool = false
var _cell: Vector2i = Vector2i(-1, -1)
var _pulse: float = 0.0


func _physics_process(delta: float) -> void:
	_pulse += delta
	queue_redraw()
	if not active or field == null:
		return
	var direction := Input.get_vector("move_left", "move_right", "move_up", "move_down")
	if direction != Vector2.ZERO:
		# 移动速度是可调数值：只读 GameState 调参区（spec.numeric 对接面），不写魔数
		position += direction * GameState.cursor_move_speed * delta
		position = field.clamp_to_grid(position)
		moved.emit(position)
		var cell := field.cell_at(position)
		if cell != _cell:
			_cell = cell
			field.highlight_cell = cell
			cell_changed.emit(cell)


## 当前所在格（无战场引用时返回界外格）。
func current_cell() -> Vector2i:
	return field.cell_at(position) if field != null else Vector2i(-1, -1)


func _draw() -> void:
	# 布防光标：蓝色双环 + 呼吸脉冲（风格卡：辅色 + 唯一描边色）
	var radius := 26.0 + sin(_pulse * 4.0) * 2.0
	draw_arc(Vector2.ZERO, radius, 0.0, TAU, 32, FlatUI.BLUE, 3.0)
	draw_arc(Vector2.ZERO, radius - 8.0, 0.0, TAU, 32, Color(FlatUI.BLUE, 0.55), 2.0)
	draw_circle(Vector2.ZERO, 4.0, FlatUI.BLUE)
