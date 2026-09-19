class_name AIGirlfriend
extends Area2D
## AI 女友实体：本作的核心交互对象（收集类玩法）。
##
## 玩法闭环：小李走进她的心动光圈 → body_entered → 发 encountered 信号 →
## Main 订阅后走 GameState.add_affection + 展示剧情台词，同时本实体换位重生 ——
## 「被 AI 女友包围」的追着收集节奏由此形成。
##
## 规范要点（见 SKILL.md「GDScript 规范」）：
## - 只 emit 信号，不持有 UI 节点；数值变化全部经 GameState 单例；
## - 输入感知只走物理碰撞（Area2D），不另起第二套触摸输入路径；
## - 游走用确定种子 RNG（门禁要求可复现：同种子同轨迹）。

## 遇到小李（body 进圈）时发出；Main 订阅，本实体不直接改 UI/数值。
signal encountered(girlfriend: AIGirlfriend)

## 人设 id：决定游走种子（可复现）与调试名。
@export var persona_id: String = "sweet"
## 展示名（剧情人设名，挂在头顶的 Label）。
@export var display_name: String = "糖糖"
## 心动台词（触发剧情时由 Main 展示，剧情驱动的一条内容）。
@export_multiline var story_line: String = "小李，今天也要记得吃饭哦。"
## 本体颜色（每人设一色，从主场景按实例覆盖）。
@export var body_color: Color = Color(1.0, 0.62, 0.75, 1.0)

## 游走速度（px/s）：GameState.girlfriend_speed（可调参基础值）× 章节追逐系数 ——
## 章节越深女友游走越快（难度梯度，见 game_state.gd CHAPTER_CHASE_SCALE），玩家仍主动追。
const WANDER_MARGIN: float = 48.0
## 重生点与玩家的最小距离：换位后不会立刻又被碰到（冒烟断言也依赖这一条）。
const RELOCATE_MIN_DISTANCE: float = 140.0
## 换位尝试次数上限（找不到足够远的点就取最后一次候选）。
const RELOCATE_ATTEMPTS: int = 12
## 重生保护帧数：传送落位后的几帧内忽略收集。物理引擎可能还拿着对方上一帧的变换，
## 瞬移落位的瞬间会被误判成一次新接触（实例：小李站在女友出生点上按重开 → 落位瞬间
## 弹对话 +1 好感）。保护窗一过才恢复正常的重叠收集判定。
const SPAWN_GUARD_FRAMES: int = 6

## 人设 → 游走随机种子（固定表：同种子同轨迹，冒烟可复现）。
const WANDER_SEEDS: Dictionary = {
	"sweet": 20260913,
	"zero": 20260914,
	"iori": 20260915,
}

var _wander_target: Vector2 = Vector2.ZERO
var _rng := RandomNumberGenerator.new()
## body_entered 是物理回调：换位不能在这里直接改物理状态，先记标记、物理帧里执行。
var _pending_relocate: bool = false
## 重生保护窗剩余帧数（>0 时忽略收集，见 SPAWN_GUARD_FRAMES）。
var _spawn_guard: int = 0
var _start_position: Vector2 = Vector2.ZERO

@onready var _body: Polygon2D = $Body
@onready var _name_label: Label = $NameLabel


func _ready() -> void:
	_rng.seed = int(WANDER_SEEDS.get(persona_id, 20260916))
	_start_position = global_position
	_body.color = body_color
	_name_label.text = display_name
	if not body_entered.is_connected(_on_body_entered):
		body_entered.connect(_on_body_entered)
	_pick_wander_target()


func _physics_process(delta: float) -> void:
	if _pending_relocate:
		_pending_relocate = false
		_relocate_away_from(_player_position())
		return
	if _spawn_guard > 0:
		_spawn_guard -= 1
	var to_target: Vector2 = _wander_target - global_position
	if to_target.length() <= 8.0:
		_pick_wander_target()
		return
	var speed: float = GameState.girlfriend_speed * GameState.chase_scale_for(GameState.chapter)
	global_position += to_target.normalized() * speed * delta


## 遇到玩家：对局态下才算收集；同一次接触只触发一次（换位前忽略重入）；
## 重生保护窗内的重叠是传送残留，不算新接触。
func _on_body_entered(body: Node2D) -> void:
	if not body is Player:
		return
	if _spawn_guard > 0:
		return
	if not GameState.is_playing() or _pending_relocate:
		return
	_pending_relocate = true
	encountered.emit(self)


## 重开归位：优先回初始落点；落点离玩家太近就换位到远处（Main 在 game_restarted 时
## 先把玩家送回起点，再传 player_pos 进来逐个调用）。两条分支都必须布防保护帧 ——
## 瞬移落位瞬间物理引擎可能还拿着对方上一帧的变换。
func reset_to_start(player_pos: Vector2) -> void:
	_pending_relocate = false
	if _start_position.distance_to(player_pos) >= RELOCATE_MIN_DISTANCE:
		global_position = _start_position
	else:
		_relocate_away_from(player_pos)
	_spawn_guard = SPAWN_GUARD_FRAMES
	_pick_wander_target()


func _pick_wander_target() -> void:
	var arena: Rect2 = Rect2(
		Vector2(WANDER_MARGIN, WANDER_MARGIN),
		Vector2(640, 360) - Vector2(WANDER_MARGIN, WANDER_MARGIN) * 2.0
	)
	_wander_target = Vector2(
		_rng.randf_range(arena.position.x, arena.end.x),
		_rng.randf_range(arena.position.y, arena.end.y)
	)


## 换位重生：在活动范围内随机取一个离玩家足够远的点（12 次尝试，兜底取最后一次）。
func _relocate_away_from(player_pos: Vector2) -> void:
	var candidate: Vector2 = global_position
	for _attempt in RELOCATE_ATTEMPTS:
		candidate = Vector2(
			_rng.randf_range(WANDER_MARGIN, 640.0 - WANDER_MARGIN),
			_rng.randf_range(WANDER_MARGIN, 360.0 - WANDER_MARGIN)
		)
		if candidate.distance_to(player_pos) >= RELOCATE_MIN_DISTANCE:
			break
	global_position = candidate
	_spawn_guard = SPAWN_GUARD_FRAMES
	_pick_wander_target()


func _player_position() -> Vector2:
	var found: Node = get_tree().get_first_node_in_group("player")
	if found is Node2D:
		return (found as Node2D).global_position
	return Vector2(320, 180)
