class_name Player
extends CharacterBody2D
## 玩家角色：四方向移动的「捕愿人」，走进冒烟愿晶即可接触收集。
##
## 规范要点（见 SKILL.md「GDScript 规范」「移动端触摸规范」）：
## - class_name 唯一，且与文件名一致的职责（player.gd → class_name Player）；
## - 输入只读 InputMap 动作名（project.godot [input] 已注册），禁止硬编码 keycode；
## - 对外只发信号，不直接操作 UI 节点（UI 在 Main 场景里订阅）；
## - 移动速度只读 GameState 调参区，禁止写魔数。

## 玩家位置变化时发出；参数用类型标注（Vector2），订阅方可静态核对。
signal moved(position: Vector2)

## 距屏幕边缘的留白（像素）：把玩家钳制在竖屏视口内，防止走出画面。
const EDGE_MARGIN: float = 28.0


func _physics_process(_delta: float) -> void:
	var direction := Input.get_vector("move_left", "move_right", "move_up", "move_down")
	# 移动速度是可调数值：只读 GameState 调参区（spec.numeric 对接面）。
	velocity = direction * GameState.move_speed
	move_and_slide()
	_clamp_to_viewport()
	if direction != Vector2.ZERO:
		moved.emit(global_position)


## 钳制在视口矩形内（竖屏 360x640 + canvas_items 拉伸，headless 与真机一致）。
func _clamp_to_viewport() -> void:
	var half := Vector2.ONE * EDGE_MARGIN
	var bounds := get_viewport_rect().size - half
	global_position = global_position.clamp(half, bounds)
