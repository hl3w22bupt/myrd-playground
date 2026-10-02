class_name Player
extends CharacterBody2D
## 玩家角色「牛牛」：四方向移动的 2D 俯视骨架，限时收集玩法的主角。
##
## 规范要点（见 SKILL.md「GDScript 规范」）：
## - 输入只读 InputMap 动作名（project.godot [input] 已注册），禁止硬编码 keycode；
## - 对外只发信号，不直接操作 UI 节点（UI 在 main.tscn 里订阅）；
## - 拾取判定由子节点 PickupArea（Area2D）承担，可收集物侧感知重叠后发信号。

## 玩家位置变化时发出；订阅方（main.gd）用它刷新 HUD 坐标与验证输入生效。
signal moved(position: Vector2)

## 可活动场地范围（640x360 视口内留 20px 边距，防止牛牛移出画面）。
const PLAY_RECT: Rect2 = Rect2(20.0, 20.0, 600.0, 320.0)

## 已应用到本节点的体型倍率（脏检查用：与数值区一致则跳过，避免每帧重设碰撞体）。
var _applied_scale: float = 0.0


func _ready() -> void:
	# v2 手感基线：体型倍率的唯一来源是 GameState 数值区声明键（禁止散点改场景/代码对数值）。
	_apply_tuned_scale()


func _physics_process(_delta: float) -> void:
	# 调参面板 / URL 改倍率后，下一物理帧生效（结算阶段同样应用，保证回滚可视）。
	_apply_tuned_scale()
	# 结算阶段（通关/失败）冻结移动，重开后由 start_run 恢复。
	if GameState.phase != GameState.Phase.RUNNING:
		velocity = Vector2.ZERO
		return
	var direction := Input.get_vector("move_left", "move_right", "move_up", "move_down")
	# 移速为数值区调参键（v2 手感基线：v1 默认 220 下调到 60~70% 区间，实际 145）。
	velocity = direction * GameState.PLAYER_SPEED
	move_and_slide()
	global_position = global_position.clamp(
		PLAY_RECT.position, PLAY_RECT.position + PLAY_RECT.size
	)
	if direction != Vector2.ZERO:
		moved.emit(global_position)


## 把数值区 PLAYER_SCALE 应用到根节点 uniform scale：
## 视觉精灵（Polygon2D 子节点）、碰撞体（CollisionShape2D）与 PickupArea 判定体
## 随根变换整体同步放大，与需求「体型放大」口径一致；v1 口径回滚 = 调回 1.0。
func _apply_tuned_scale() -> void:
	if is_equal_approx(GameState.PLAYER_SCALE, _applied_scale):
		return
	_applied_scale = GameState.PLAYER_SCALE
	scale = Vector2.ONE * _applied_scale
