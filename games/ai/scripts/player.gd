class_name Player
extends CharacterBody2D
## 玩家（小李）：被 AI 女友包围的主角，四方向移动。
##
## 规范要点（见 SKILL.md「GDScript 规范」）：
## - class_name 全工程唯一，文件名 = 类职责（player.gd → class_name Player）；
## - 输入只读 InputMap 动作名（project.godot [input] 已注册），禁止硬编码 keycode；
## - 对外只发信号，不直接操作 UI 节点（UI 在 Main 场景里订阅）；
## - 移动速度来自数值表（GameState.move_speed），改 data/spec/numeric.json 即调手感。

## 玩家位置变化时发出；参数用类型标注（Vector2），订阅方可静态核对。
signal moved(position: Vector2)

## 玩家方形碰撞体的半边长（px）：对应 player.tscn 里 RectangleShape2D 的 size = 24×24。
## 这是「场景尺寸 ↔ 代码常量」的契约值，两边改其一都要同步（信物/危机的距离复核依赖它）。
const HALF_SIZE: float = 12.0

## 出生点唯一权威：重开一局「回起点」的落点。
## main.tscn 里 Player 节点的 position 必须与本值一致（冒烟阶段 A 会核对一致性）。
const START_POSITION: Vector2 = Vector2(320.0, 180.0)


func _physics_process(_delta: float) -> void:
	var direction := Input.get_vector("move_left", "move_right", "move_up", "move_down")
	velocity = direction * GameState.move_speed
	move_and_slide()
	_clamp_to_play_area()
	if direction != Vector2.ZERO:
		moved.emit(global_position)


## 边界钳制：以视口为玩法边界，内缩玩家半边长。
## 钳制在 move_and_slide 之后做，玩家永远不会卡在画面外/死角里（越界即被推回可视区）。
func _clamp_to_play_area() -> void:
	var bounds := get_viewport_rect().size
	global_position = global_position.clamp(
		Vector2(HALF_SIZE, HALF_SIZE),
		bounds - Vector2(HALF_SIZE, HALF_SIZE),
	)


## 重开一局时由 Main 调用：玩家回到出生点并清空残余速度（避免重开瞬间滑出出生净空）。
func reset_to_start() -> void:
	global_position = START_POSITION
	velocity = Vector2.ZERO
