class_name KeyFragment
extends Area2D
## key 片段：探针可拾取的样本（真实片段 / 伪造片段共用一个场景，靠 @export 区分）。
##
## 规范要点（见 SKILL.md「场景规范」）：
## - 对外只发信号（collected），不直接改 UI / autoload（Main 场景订阅后统一登记）；
## - 重开一局用 restore() 复位，而不是 queue_free —— 场景结构保持稳定，冒烟可重复断言。
##
## 伪造片段巡逻（难度梯度的一部分，波次配置见 GameState.WAVES）：
## - 绕基准点水平往返：pos = base + (sin(elapsed × frequency × decoy_speed) × amplitude, 0)；
## - decoy_speed 来自 GameState 调参区（玩家可整体调难度），片段自身不散落魔数；
## - 真实片段 amplitude = 0，巡逻分支直接跳过。

## 拾取成功信号：Main 订阅后把片段登记进组装序列。
signal collected(fragment: KeyFragment)

## 该片段携带的 key 片段文本（HUD 与校验都用它）。
@export var chunk: String = "OA"
## 伪造片段：拾到即让本次组装结果必然无效（颜色也会变红提示）。
@export var is_decoy: bool = false
## 真实片段的底色。
@export var base_color: Color = Color(0.42, 0.85, 0.5, 1.0)

## 水平巡逻振幅（px，0 = 静止）；频率（rad/s）。由 Main 按波次配置赋值。
var patrol_amplitude: float = 0.0
var patrol_frequency: float = 0.0
## 巡逻相位偏移（rad）：同波多个伪造片段错开，避免同进同退。
var patrol_phase: float = 0.0

var _collected: bool = false
## 重开复位后延迟再武装的剩余物理帧数（等玩家位移结算，避免原地重叠误触发拾取）。
var _rearm_frames: int = 0
## 巡逻基准点（_ready 时锁定出生位置）与巡逻计时。
var _base_position: Vector2 = Vector2.ZERO
var _elapsed: float = 0.0

@onready var _visual: Polygon2D = $Visual
@onready var _chunk_label: Label = $ChunkLabel


func _ready() -> void:
	body_entered.connect(_on_body_entered)
	_base_position = global_position
	_refresh_visual()
	# 出生武装延迟（与 restore() 同款）：波次切换/重开时玩家可能还没传送走，
	# 生成瞬间 overlap 会在传送结算前注册拾取 —— 先关监控 2 物理帧再武装。
	_rearm_frames = 2
	set_deferred("monitoring", false)


func _physics_process(delta: float) -> void:
	if _rearm_frames > 0:
		_rearm_frames -= 1
		if _rearm_frames == 0:
			set_deferred("monitoring", true)
	_patrol(delta)


## 水平巡逻：确定性函数（时间 → 位置），无随机数，冒烟可按基准点 + 振幅规划安全路线。
func _patrol(delta: float) -> void:
	if _collected or patrol_amplitude <= 0.0 or patrol_frequency <= 0.0:
		return
	_elapsed += delta
	var offset := sin(_elapsed * patrol_frequency * GameState.decoy_speed + patrol_phase) * patrol_amplitude
	global_position = _base_position + Vector2(offset, 0.0)


## 是否已被拾取（本局内）。
func is_collected() -> bool:
	return _collected


## 重开一局：恢复可拾取状态（延迟 2 物理帧再武装，见 _physics_process），
## 巡逻计时归零 —— 波次开始时伪造片段必在基准点，冒烟路线按此规划。
func restore() -> void:
	_collected = false
	visible = true
	_elapsed = 0.0
	_rearm_frames = 2
	set_deferred("monitoring", false)
	global_position = _base_position
	_refresh_visual()


func _refresh_visual() -> void:
	if is_decoy:
		_visual.color = Color(0.9, 0.32, 0.28, 1.0)
	else:
		_visual.color = base_color
	_chunk_label.text = chunk


func _on_body_entered(body: Node2D) -> void:
	if _collected or not visible or _rearm_frames > 0:
		return
	var player := body as Player
	if player == null:
		return
	_collected = true
	collected.emit(self)
	visible = false
	# 物理回调里改监控开关必须延迟到帧末，否则引擎会报错（flushing queries）。
	set_deferred("monitoring", false)
