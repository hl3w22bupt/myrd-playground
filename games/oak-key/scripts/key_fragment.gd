class_name KeyFragment
extends Area2D
## key 片段：探针可拾取的样本（真实片段 / 伪造片段共用一个场景，靠 @export 区分）。
##
## 规范要点（见 SKILL.md「场景规范」）：
## - 对外只发信号（collected），不直接改 UI / autoload（Main 场景订阅后统一登记）；
## - 重开一局用 restore() 复位，而不是 queue_free —— 场景结构保持稳定，冒烟可重复断言。

## 拾取成功信号：Main 订阅后把片段登记进组装序列。
signal collected(fragment: KeyFragment)

## 该片段携带的 key 片段文本（HUD 与校验都用它）。
@export var chunk: String = "OA"
## 伪造片段：拾到即让本次组装结果必然无效（颜色也会变红提示）。
@export var is_decoy: bool = false
## 真实片段的底色。
@export var base_color: Color = Color(0.42, 0.85, 0.5, 1.0)

var _collected: bool = false
## 重开复位后延迟再武装的剩余物理帧数（等玩家位移结算，避免原地重叠误触发拾取）。
var _rearm_frames: int = 0

@onready var _visual: Polygon2D = $Visual
@onready var _chunk_label: Label = $ChunkLabel


func _ready() -> void:
	body_entered.connect(_on_body_entered)
	_refresh_visual()


## 复位武装期：玩家可能仍站在拾取圈内，先关监控，等位移结算后再开。
func _physics_process(_delta: float) -> void:
	if _rearm_frames > 0:
		_rearm_frames -= 1
		if _rearm_frames == 0:
			set_deferred("monitoring", true)


## 是否已被拾取（本局内）。
func is_collected() -> bool:
	return _collected


## 重开一局：恢复可拾取状态（延迟 2 物理帧再武装，见 _physics_process）。
func restore() -> void:
	_collected = false
	visible = true
	_rearm_frames = 2
	set_deferred("monitoring", false)
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
