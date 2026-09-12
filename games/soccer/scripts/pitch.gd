class_name Pitch
extends Node2D
## 球场：绘制草皮 / 边线 / 中圈 / 禁区 / 球门，并持有全部球场几何常量。
## Main（比赛控制器）与冒烟场景都从这里取几何，保证「画在哪」与「判在哪」同源。

## 球场矩形（俯视，主队向右进攻 → 主队防守左侧球门）。
const PITCH_RECT: Rect2 = Rect2(100, 80, 1080, 560)
## 球门口半高（门柱到中心的竖向距离）。
const GOAL_HALF: float = 80.0
## 球门深度（门线外的网深）。
const GOAL_DEPTH: float = 28.0
## 大禁区（罚球区）深度 / 半高。
const PENALTY_DEPTH: float = 130.0
const PENALTY_HALF: float = 180.0
## 小禁区（球门区）深度 / 半高。
const GOAL_AREA_DEPTH: float = 45.0
const GOAL_AREA_HALF: float = 90.0
## 中圈半径 / 中点。
const CENTER_CIRCLE_RADIUS: float = 80.0
const CENTER: Vector2 = Vector2(640, 360)
## 角旗弧半径。
const CORNER_RADIUS: float = 14.0

const COLOR_GRASS: Color = Color(0.13, 0.42, 0.16)
const COLOR_GRASS_STRIPE: Color = Color(0.16, 0.48, 0.19)
const COLOR_LINE: Color = Color(0.92, 0.95, 0.9, 0.9)
const COLOR_GOAL: Color = Color(0.88, 0.9, 0.92)
const COLOR_OUT: Color = Color(0.09, 0.28, 0.12)

const LINE_WIDTH: float = 3.0
const STRIPE_COUNT: int = 12


func _draw() -> void:
	# 场外底色 + 草皮与割草条纹。
	draw_rect(Rect2(0, 0, 1280, 720), COLOR_OUT)
	var stripe_w := PITCH_RECT.size.x / STRIPE_COUNT
	for i in STRIPE_COUNT:
		var stripe := Rect2(PITCH_RECT.position.x + stripe_w * i, PITCH_RECT.position.y, stripe_w, PITCH_RECT.size.y)
		draw_rect(stripe, COLOR_GRASS_STRIPE if i % 2 == 0 else COLOR_GRASS)

	# 边线 / 底线 / 中线。
	draw_rect(PITCH_RECT, COLOR_LINE, false, LINE_WIDTH)
	draw_line(Vector2(CENTER.x, PITCH_RECT.position.y), Vector2(CENTER.x, PITCH_RECT.end.y), COLOR_LINE, LINE_WIDTH)
	draw_circle(CENTER, 4.0, COLOR_LINE)
	draw_arc(CENTER, CENTER_CIRCLE_RADIUS, 0.0, TAU, 64, COLOR_LINE, LINE_WIDTH, true)

	# 两侧禁区 / 小禁区 / 点球点。
	for side: float in [-1.0, 1.0]:
		var goal_x := PITCH_RECT.position.x if side < 0.0 else PITCH_RECT.end.x
		var inner: float = side * PENALTY_DEPTH
		draw_rect(_edge_rect(goal_x, inner, PENALTY_HALF), COLOR_LINE, false, LINE_WIDTH)
		var inner_area: float = side * GOAL_AREA_DEPTH
		draw_rect(_edge_rect(goal_x, inner_area, GOAL_AREA_HALF), COLOR_LINE, false, LINE_WIDTH)
		draw_circle(Vector2(goal_x + inner * 0.68, CENTER.y), 3.5, COLOR_LINE)

	# 球门（门线外的矩形网 + 门框）。
	for side: float in [-1.0, 1.0]:
		var goal_x := PITCH_RECT.position.x if side < 0.0 else PITCH_RECT.end.x
		var outer: float = goal_x + side * GOAL_DEPTH
		var top := Vector2(minf(goal_x, outer), CENTER.y - GOAL_HALF)
		var net := Rect2(top, Vector2(GOAL_DEPTH, GOAL_HALF * 2.0))
		draw_rect(net, Color(0.05, 0.05, 0.08, 0.55), true)
		draw_rect(net, COLOR_GOAL, false, 3.0)

	# 四角角旗弧：弧段朝场内（左上 0→π/2，右上 π/2→π，右下 π→3π/2，左下 3π/2→2π）。
	for corner_x: float in [PITCH_RECT.position.x, PITCH_RECT.end.x]:
		for corner_y: float in [PITCH_RECT.position.y, PITCH_RECT.end.y]:
			var start := 0.0
			if corner_x > CENTER.x:
				start = PI * 0.5 if corner_y < CENTER.y else PI
			else:
				start = 0.0 if corner_y < CENTER.y else PI * 1.5
			draw_arc(Vector2(corner_x, corner_y), CORNER_RADIUS, start, start + PI * 0.5, 16, COLOR_LINE, LINE_WIDTH, true)


## 以某侧门线为基准、向场内伸入 depth 的矩形（用于禁区/小禁区）。
func _edge_rect(goal_x: float, depth_into_pitch: float, half_height: float) -> Rect2:
	var left := minf(goal_x, goal_x + depth_into_pitch)
	return Rect2(Vector2(left, CENTER.y - half_height), Vector2(absf(depth_into_pitch), half_height * 2.0))


## 队伍防守的球门中心（0 主队守左门，1 客队守右门）。
func defended_goal_center(defending_team: int) -> Vector2:
	if defending_team == 0:
		return Vector2(PITCH_RECT.position.x, CENTER.y)
	return Vector2(PITCH_RECT.end.x, CENTER.y)


## 队伍进攻方向的单位向量。
func attack_direction(attacking_team: int) -> Vector2:
	return Vector2.RIGHT if attacking_team == 0 else Vector2.LEFT


## 球是否已越过门线且在门框内（即进球）。
func is_goal_position(pos: Vector2) -> bool:
	if absf(pos.y - CENTER.y) > GOAL_HALF:
		return false
	return pos.x < PITCH_RECT.position.x - 2.0 or pos.x > PITCH_RECT.end.x + 2.0


## 球是否整体出了场内（不含进球区间的横向越线也算越线出界）。
func is_out_of_bounds(pos: Vector2) -> bool:
	return pos.x < PITCH_RECT.position.x - 4.0 or pos.x > PITCH_RECT.end.x + 4.0 \
		or pos.y < PITCH_RECT.position.y - 4.0 or pos.y > PITCH_RECT.end.y + 4.0


## 场内钳制余量：球员身体半径 + 视觉余量 2 —— 钳制后身体圆完整在场内，
## 贴边跑位不会被推出边线，也不会在角落卡死角（注释承诺的余量与常量推导一致）。
const CLAMP_MARGIN: float = Footballer.BODY_RADIUS + 2.0  ## = 9 + 2 = 11


## 把点钳制回场内（AI 跑位目标 / 球员越界回拉用）。
func clamp_inside(pos: Vector2) -> Vector2:
	return Vector2(
		clampf(pos.x, PITCH_RECT.position.x + CLAMP_MARGIN, PITCH_RECT.end.x - CLAMP_MARGIN),
		clampf(pos.y, PITCH_RECT.position.y + CLAMP_MARGIN, PITCH_RECT.end.y - CLAMP_MARGIN),
	)
