class_name BondToken
extends Area2D
## 心动信物：剧情收集物 —— 一枚信物 = 一位 AI 女友的一次剧情节点。
##
## 规范要点：
## - 本脚本只负责「被碰到 → 发信号」和携带剧情数据（node_id / persona_id / 台词），
##   不碰 GameState、不碰 UI（结算在 Main，可追溯）；
## - 剧情数据由 Main 在实例化后注入（来自幕 JSON × 人设卡），节点内不写死任何角色；
## - 信物视觉色来自人设卡 theme_color（美术派生单一事实源），不在场景里另配。

## 被玩家碰到时发出；Main 订阅它执行好感度结算与节点销毁。
signal collected(token: BondToken)

## 加入 `bond_tokens` 分组：冒烟与 Main 都按组取数，不依赖具体节点路径。
const GROUP_NAME: StringName = &"bond_tokens"
## 收集判定半径（px）：对应 bond_token.tscn 里 CircleShape2D 的 radius = 14。
## 「场景尺寸 ↔ 代码常量」契约值，两边改其一都要同步。
const PICKUP_RADIUS: float = 14.0
## √2：把玩家方形碰撞体「半边长」换算成「半对角线」（const 表达式里不能调 sqrt()）。
const SQRT_2: float = 1.4142135623730951
## 收集判定的额外余量（px）：圆(Area2D) 对 矩形(CharacterBody2D) 的接触可能发生在角上，
## 圆心距最大可到 半径 + 玩家半对角线 ≈ 30.97px，4px 余量保证真实碰撞不被误拒。
const PICKUP_MARGIN: float = 4.0
## 真正可收集的最大圆心距（由常量推导，不要手写魔数 ——
## 否则改了任一 .tscn 的形状尺寸，这里会静默过期，只会以「吃不到信物」的运行期症状暴露）。
const PICKUP_MAX_DISTANCE: float = PICKUP_RADIUS + Player.HALF_SIZE * SQRT_2 + PICKUP_MARGIN

## 剧情节点 id（trace 回放定位到具体节点）。
var node_id: String = ""
## 本信物归属的 AI 女友人设 id（trace / 对话 / 结算规则都按它查人设卡）。
var persona_id: String = ""
## 收集时展示的剧情台词（来自幕 JSON，语气遵循人设卡 speak_style）。
var dialogue_line: String = ""
## 人设主题色（光晕底色，来自人设卡 color 字段）。
var _theme_color: Color = Color(0, 0, 0, 0)


func _ready() -> void:
	# 入组供冒烟与工具清点：数量由幕数据声明，真心分支可达性由幕契约校验。
	add_to_group(GROUP_NAME)
	if not body_entered.is_connected(_on_body_entered):
		body_entered.connect(_on_body_entered)


## 注入剧情节点数据与美术资产（头像贴图路径来自人设卡 art 字段，主题色做呼吸光晕底色）。
## 实例化后、加入场景树前调用（Sprite2D 子节点在实例化时就已存在，可直接取）。
func apply_story(next_node_id: String, next_persona_id: String, line: String, avatar_path: String, color: Color) -> void:
	node_id = next_node_id
	persona_id = next_persona_id
	dialogue_line = line
	var body := get_node_or_null("Body") as Sprite2D
	if body != null and not avatar_path.is_empty():
		var texture: Texture2D = load(avatar_path)
		if texture != null:
			body.texture = texture
			body.scale = Vector2.ONE * (PICKUP_RADIUS * 2.0 / float(texture.get_width()))
		body.modulate = Color(1.0, 1.0, 1.0, 1.0)
		_theme_color = color
	queue_redraw()


func _draw() -> void:
	# 主题色光晕：信物底色仍由人设卡 theme_color 派生（美术单一事实源），贴图叠在其上。
	if _theme_color.a > 0.0:
		draw_circle(Vector2.ZERO, PICKUP_RADIUS + 5.0, Color(_theme_color.r, _theme_color.g, _theme_color.b, 0.35))


## 距离复核通过才发收集信号：Area2D 的重叠回调可能携带**陈旧的刚体变换** ——
## 玩家被传送/重置（重开一局）的同一帧内，重生在本位置的信物仍会收到 body_entered，
## 而玩家实际已在出生点。用当前坐标复核真实圆心距，「隔空收集」一律忽略；
## 被拒的是幽灵事件，玩家真实接触时会正常再触发，无需重试。
func _on_body_entered(body: Node2D) -> void:
	if not (body is Player):
		return
	if body.global_position.distance_to(global_position) > PICKUP_MAX_DISTANCE:
		return
	collected.emit(self)
