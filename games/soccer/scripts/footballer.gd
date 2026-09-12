class_name Footballer
extends CharacterBody2D
## 球员小人：俯视球场上的低模小人（躯干 + 头 + 双腿双臂），带程序化跑步动画。
##
## 控制分两种：
##   - 人工控制（control_enabled = true）：读 InputMap 的 move_left/right/up/down 动作；
##   - AI 控制（默认）：Main（比赛控制器）每帧写 ai_direction，这里只负责执行与动画。
##
## 规范要点（见 SKILL.md「GDScript 规范」）：
## - 输入只读 InputMap 动作名（project.godot [input] 已注册），禁止硬编码 keycode；
## - 对外只发信号（moved），不直接操作 UI 节点（Main 订阅）。

## 受控球员移动时发出；Main 与冒烟场景订阅。
signal moved(position: Vector2)

## 球员职责。
enum Role { GK, DF, MF, FW }

## 躯干半径（球贴脚距离等判定共用）。
const BODY_RADIUS: float = 9.0
## 人工/AI 通用移速上限（像素/秒）。带球时略降（见 Main）。
const RUN_SPEED: float = 170.0
## 跑步动画：步频系数（速度 → 相位推进速率）。
const RUN_CYCLE_RATE: float = 0.16
## 跑步动画：四肢摆幅上限（弧度）。
const RUN_SWING: float = 0.7

var team: int = 0                      # 0 = 主队，1 = 客队
var role: int = Role.MF
var is_gk: bool = false
## 阵型锚点（本队进攻方向坐标系下的落位，由 Main 计算）。
var anchor: Vector2 = Vector2.ZERO
## 在 FORMATION 数组里的序号（Main 用来重算落位）。
var formation_index: int = 0
## 是否为玩家当前控制的球员。
var control_enabled: bool = false
## AI 期望移动方向（由 Main 每帧写入；control_enabled 时忽略）。
var ai_direction: Vector2 = Vector2.ZERO
## 移速上限（带球/门将可被 Main 调低）。
var max_speed: float = RUN_SPEED
## 死球阶段冻结（开球/重发球/中场/终场时 Main 置 true，所有移动输入与 AI 都不生效）。
var frozen: bool = false
## 跑步动画相位。
var _run_phase: float = 0.0
## 静止回正用插值。
var _swing: float = 0.0

@onready var body: Polygon2D = $Body
@onready var head: Polygon2D = $Head
@onready var leg_l: Node2D = $LegL
@onready var leg_r: Node2D = $LegR
@onready var arm_l: Node2D = $ArmL
@onready var arm_r: Node2D = $ArmR
@onready var leg_l_poly: Polygon2D = %LegLPoly
@onready var leg_r_poly: Polygon2D = %LegRPoly
@onready var arm_l_poly: Polygon2D = %ArmLPoly
@onready var arm_r_poly: Polygon2D = %ArmRPoly
@onready var indicator: Polygon2D = $Indicator


func _physics_process(_delta: float) -> void:
	var direction := Vector2.ZERO
	if frozen:
		direction = Vector2.ZERO
	elif control_enabled:
		direction = Input.get_vector("move_left", "move_right", "move_up", "move_down")
	else:
		direction = ai_direction
	velocity = direction * max_speed
	move_and_slide()
	_animate(_delta)
	if control_enabled and direction != Vector2.ZERO:
		moved.emit(global_position)


## 程序化跑步动画：随速度加快步频，四肢交替摆动，静止时回正。
func _animate(delta: float) -> void:
	var speed := velocity.length()
	if speed > 8.0:
		_run_phase += delta * (speed * RUN_CYCLE_RATE + 6.0)
		_swing = sin(_run_phase) * RUN_SWING * clampf(speed / RUN_SPEED, 0.35, 1.0)
	else:
		_run_phase = 0.0
		_swing = lerpf(_swing, 0.0, clampf(12.0 * delta, 0.0, 1.0))
	leg_l.rotation = _swing
	leg_r.rotation = -_swing
	arm_l.rotation = -_swing * 0.8
	arm_r.rotation = _swing * 0.8
	# 身体随步伐轻微上下起伏 + 面朝移动方向左右翻转。
	body.position.y = -absf(cos(_run_phase)) * 1.2
	if absf(velocity.x) > 8.0:
		scale.x = -1.0 if velocity.x < 0.0 else 1.0


## 设置队服颜色（主客队 / 门将各不同）。
func set_kit(jersey: Color, shorts: Color) -> void:
	body.color = jersey
	arm_l_poly.color = jersey
	arm_r_poly.color = jersey
	leg_l_poly.color = shorts
	leg_r_poly.color = shorts


## 标记/取消「当前受控」高亮。
func set_controlled(controlled: bool) -> void:
	control_enabled = controlled
	indicator.visible = controlled


## 回到落位并清空运动状态（开球 / 重发球 / 重开比赛时调用）。
func reset_to(pos: Vector2) -> void:
	global_position = pos
	velocity = Vector2.ZERO
	ai_direction = Vector2.ZERO
	_run_phase = 0.0
	_swing = 0.0
