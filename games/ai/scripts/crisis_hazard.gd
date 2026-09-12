class_name CrisisHazard
extends Area2D
## 危机脉冲：剧情生存的威胁源 —— 一块游走的「纠缠区」，玩家闯入即被结算威胁。
##
## 规范要点：
## - 本脚本只负责「游走 + 被闯入 → 发信号」，不碰 GameState、不碰 UI（结算在 Main，可追溯）；
## - 游走路径与基准速度来自幕 JSON，实际速度 = 基准速度 × 人设卡 threat_rules.speed_bias
##   （危险「人格化」：薇克丝的纠缠区就是比别人的更快）；
## - 巡逻点两两连线往返，位置完全确定 —— 无随机数，无头冒烟可复现。

## 被玩家闯入时发出；Main 订阅它执行威胁度结算。
signal triggered(hazard: CrisisHazard)

## 加入 `crisis_hazards` 分组：冒烟与 Main 都按组取数，不依赖具体节点路径。
const GROUP_NAME: StringName = &"crisis_hazards"
## 危机方形的半边长（px）：对应 crisis_hazard.tscn 里 RectangleShape2D 的 size = 60×60。
## 「场景尺寸 ↔ 代码常量」契约值，两边改其一都要同步。
const HALF_SIZE: float = 30.0
## 威胁判定的额外余量（px）：真实重叠的轴心距上限是 HALF_SIZE + Player.HALF_SIZE，
## 幽灵事件（陈旧变换）远超此值，2px 余量覆盖浮点误差即可。
const TRIGGER_MARGIN: float = 2.0

## 剧情节点 id（trace 回放定位到具体危机节点）。
var node_id: String = ""
## 本危机归属的 AI 女友人设 id（威胁可追溯到人设，trace 落账）。
var persona_id: String = ""

var _patrol_points: PackedVector2Array = PackedVector2Array()
var _patrol_index: int = 0
var _speed: float = 0.0


func _ready() -> void:
	# 入组供冒烟与工具清点：危机区非空是威胁分支可达的前提。
	add_to_group(GROUP_NAME)
	if not body_entered.is_connected(_on_body_entered):
		body_entered.connect(_on_body_entered)


## 注入游走路径、实际速度与美术资产（危机表情贴图路径来自人设卡 art.expressions[crisis]）。
## 路径首点即出生点（Main 在实例化后、加入场景树前调用）。
func setup(next_node_id: String, next_persona_id: String, points: PackedVector2Array, speed: float, texture_path: String) -> void:
	node_id = next_node_id
	persona_id = next_persona_id
	_patrol_points = points
	_patrol_index = 0
	_speed = speed
	if not points.is_empty():
		position = points[0]
	var body := get_node_or_null("Body") as Sprite2D
	if body != null and not texture_path.is_empty():
		var texture: Texture2D = load(texture_path)
		if texture != null:
			body.texture = texture
			body.scale = Vector2.ONE * (HALF_SIZE * 2.0 / float(texture.get_width()))


## 是否具备游走能力（< 2 个路径点时静止为固定危机区）。
func has_patrol() -> bool:
	return _patrol_points.size() >= 2


## 当前游走速度（px/s），冒烟断言「难度梯度 / 人设速度倍率生效」用。
func speed() -> float:
	return _speed


func _physics_process(delta: float) -> void:
	if not has_patrol():
		return
	var target := _patrol_points[_patrol_index]
	var to_target := target - global_position
	var step := _speed * delta
	if to_target.length() <= step:
		global_position = target
		_patrol_index = (_patrol_index + 1) % _patrol_points.size()
	else:
		global_position += to_target.normalized() * step


## 距离复核通过才结算威胁：Area2D 的重叠回调可能携带**陈旧的刚体变换** ——
## 玩家被传送/重置（重开一局）的同一帧内，重生在本位置的危机区仍会收到 body_entered，
## 而玩家实际已在出生点（冒烟实测：玩家已回起点，仍报闯入 → 凭空 +1 威胁）。
## 用当前坐标复核真实重叠（AABB 轴判定），「隔空触发」一律忽略；
## 被拒的是幽灵事件，玩家真实重叠时会正常再触发，无需重试。
func _on_body_entered(body: Node2D) -> void:
	if not (body is Player):
		return
	var offset: Vector2 = (body.global_position - global_position).abs()
	var reach: float = HALF_SIZE + Player.HALF_SIZE + TRIGGER_MARGIN
	if offset.x > reach or offset.y > reach:
		return
	triggered.emit(self)
