class_name Zombie
extends Node2D
## 僵尸：沿所在行从右向左推进；到防御单位跟前停下啃咬；血量归零倒地。
## 行为推进由 Field 统一驱动（advance / take_damage），本脚本只管状态与扁平绘制。
##
## v2 对比度规范（spec.numeric.visual.contrast）：四类统一浅灰基底（FlatUI.ZOMBIE_BODY），
## 类型识别色只上头饰配件且带 2px 描边（FlatUI.OUTLINE）+ 投影；冻住 = 全身蓝白罩染。
## 啃咬 = 离散节拍（bite_interval 秒一口，每口 bite_damage），冷却计时在本实体上、
## 由 Field 在啃咬判定时消费（tick_bite）。

## 身体尺寸（扁平几何：圆角矩形身 + 圆头 + 前伸双臂）。
const BODY_RECT := Rect2(-14, -26, 28, 44)
const HEAD_RADIUS := 12.0
const HEAD_OFFSET := Vector2(2, -32)
## 冻住罩染色（渲染乘色，非新填色 —— 风格卡形状语言段）。
const SLOW_TINT := Color(0.72, 0.86, 1.0)

var lane: int = 0
var hp: float = 100.0
var max_hp: float = 100.0
var speed: float = 18.0
## 种类（GameState.ZOMBIE_KINDS 的键），驱动头顶造型与识别色。
var kind: StringName = &"walker"
## 正在啃咬防御单位（Field 每帧判定后回写）。
var eating: bool = false
## 已倒地（等待 Field 移除，不再参与判定）。
var dying: bool = false
## 啃咬冷却（Field 在啃咬距离内逐帧 tick_bite，归零 = 咬一口并重置）。
var bite_cooldown: float = 0.0
## 碾压型（gargantuar）：接触植物即摧毁，不进入啃食循环（spec combat.crush）。
var crushes: bool = false
## 处于夜幕遮罩内（L5 夜战关）：剪影预显示，不暴露种类配件与血量（spec levelMechanics.nightFog）。
var silhouetted: bool = false
## 冻住：倍率 <1 移动放缓，计时归零恢复。
var _slow_factor: float = 1.0
var _slow_timer: float = 0.0
var _phase: float = 0.0


func setup(z_lane: int, z_x: float, z_y: float, z_hp: float, z_speed: float,
		z_kind: StringName = &"walker") -> void:
	lane = z_lane
	position = Vector2(z_x, z_y)
	hp = z_hp
	max_hp = z_hp
	speed = z_speed
	kind = z_kind if GameState.ZOMBIE_KINDS.has(z_kind) else &"walker"
	crushes = GameState.zombie_crushes(kind)
	bite_cooldown = GameState.bite_interval
	z_index = 2
	# 坦克巨尸体型加大（扁平几何放大，识别度优先）；绘制锚点仍取脚底，挡住 2 格宽
	if crushes:
		z_index = 3
	# 同行多只僵尸的摆动相位错开（确定值，不用随机）
	_phase = float(z_lane) * 1.3 + z_x * 0.01


## 冻住命中：移动速度 ×(1-slow)（spec combat.freeze.speedFactor = 1-寒冰卡 slow），
## 持续 freeze_duration 秒（重复命中刷新计时）。
## 只减速移动、不改变啃咬节奏 —— 被定身咬住的僵尸不受额外影响，语义单一可预期。
func apply_slow(slow: float) -> void:
	if slow <= 0.0 or dying:
		return
	_slow_factor = 1.0 - clampf(slow, 0.0, 0.9)
	_slow_timer = GameState.freeze_duration
	modulate = SLOW_TINT


## 推进一步；返回实际位移（啃咬 / 倒地时为零向量）。
func advance(delta: float) -> Vector2:
	if eating or dying:
		return Vector2.ZERO
	if _slow_timer > 0.0:
		_slow_timer -= delta
		if _slow_timer <= 0.0:
			_slow_factor = 1.0
			_slow_timer = 0.0
			modulate = Color.WHITE
	var step := speed * _slow_factor * delta
	position.x -= step
	_phase += delta * (2.0 if not eating else 6.0)
	return Vector2(-step, 0.0)


## 啃咬节拍：在啃咬距离内逐帧调用；归零 = 该咬一口（返回 true，由 Field 扣血）并重置冷却。
func tick_bite(delta: float) -> bool:
	if dying:
		return false
	bite_cooldown -= delta
	if bite_cooldown <= 0.0:
		bite_cooldown = GameState.bite_interval
		return true
	return false


## 扣血；返回 true = 本次攻击致其倒地。
func take_damage(amount: float) -> bool:
	if dying:
		return false
	hp = maxf(hp - amount, 0.0)
	if hp <= 0.0:
		dying = true
		return true
	return false


func _process(_delta: float) -> void:
	queue_redraw()


func _draw() -> void:
	if dying:
		# 倒地：压扁 + 半透明，等 Field 移除
		draw_set_transform(Vector2(0, 26), 0.0, Vector2(1.3, 0.45))
		draw_rect(BODY_RECT, Color(FlatUI.GRAY_DARK, 0.7))
		draw_circle(HEAD_OFFSET + Vector2(0, 26), HEAD_RADIUS, Color(FlatUI.GRAY_DARK, 0.7))
		draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
		return
	# 夜幕剪影（L5 遮罩内预显示）：单色几何剪影，不暴露种类配件 / 眼 / 血量
	if silhouetted:
		_draw_silhouette()
		return
	var bob := sin(_phase * 3.0) * 1.5
	# 投影（v2 前景主体统一投影：rgba(0,0,0,.25) 偏移 2px）
	draw_set_transform(Vector2(2.0, 24.0), 0.0, Vector2(1.0, 0.35))
	draw_circle(Vector2.ZERO, 18.0, FlatUI.SHADOW)
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
	# 坦克巨尸：整体放大（扁平几何等比放大，识别度优先）
	var body_scale := 1.55 if crushes else 1.0
	draw_set_transform(Vector2.ZERO, 0.0, Vector2(body_scale, body_scale))
	# 疾跑：身体前倾（头前移）+ 摆臂更急（速度识别靠姿态，不动底色）
	var runner := kind == &"runner"
	var head_offset := HEAD_OFFSET + Vector2(-5.0 if runner else 0.0, 0.0)
	# 双臂（前伸，行走时小幅摆动）
	var swing := sin(_phase * (9.0 if runner else 6.0)) * (3.0 if runner else 2.0)
	draw_rect(Rect2(-30, -16 + bob + swing, 18, 8), FlatUI.ZOMBIE_BODY)
	draw_rect(Rect2(-30, -16 + bob + swing, 18, 8), FlatUI.OUTLINE, false, 2.0)
	draw_rect(Rect2(-28, -4 + bob - swing, 18, 8), FlatUI.ZOMBIE_BODY)
	draw_rect(Rect2(-28, -4 + bob - swing, 18, 8), FlatUI.OUTLINE, false, 2.0)
	# 身体（浅灰基底 + 2px 描边）
	var body := Rect2(BODY_RECT.position + Vector2(0, bob), BODY_RECT.size)
	draw_rect(body, FlatUI.ZOMBIE_BODY)
	draw_rect(body, FlatUI.OUTLINE, false, 2.0)
	# 头
	draw_circle(head_offset + Vector2(0, bob), HEAD_RADIUS, FlatUI.ZOMBIE_BODY)
	draw_arc(head_offset + Vector2(0, bob), HEAD_RADIUS, 0.0, TAU, 20, FlatUI.OUTLINE, 2.0)
	# 眼（危险感：红色小方块）
	draw_rect(Rect2(head_offset.x + 2, head_offset.y - 4 + bob, 4, 4), FlatUI.RED)
	# 头顶造型（种类识别面：识别色只上头饰，全部 2px 描边 —— 风格卡形状语言）
	match kind:
		&"conehead":
			var cone := PackedVector2Array([
				head_offset + Vector2(-10, -8 + bob),
				head_offset + Vector2(10, -8 + bob),
				head_offset + Vector2(0, -26 + bob),
			])
			draw_polygon(cone, PackedColorArray([FlatUI.ORANGE, FlatUI.ORANGE, FlatUI.ORANGE]))
			draw_polyline(cone + PackedVector2Array([cone[0]]), FlatUI.OUTLINE, 2.0)
		&"buckethead":
			var bucket := Rect2(head_offset.x - 11, head_offset.y - 30 + bob, 22, 20)
			draw_rect(bucket, FlatUI.GRAY_DARK)
			draw_rect(bucket, FlatUI.OUTLINE, false, 2.0)
			draw_rect(Rect2(head_offset.x - 13, head_offset.y - 14 + bob, 26, 4), FlatUI.GRAY)
		&"runner":
			# 疾跑头带（识别件：暗红束带）
			draw_rect(Rect2(head_offset.x - 10, head_offset.y - 8 + bob, 20, 4), FlatUI.RED)
		&"gargantuar":
			# 坦克巨尸识别件：肩部装甲板 + 碾压巨锤（危险色锤头，2px 描边）
			draw_rect(Rect2(-16, -34 + bob, 32, 10), FlatUI.GRAY_DARK)
			draw_rect(Rect2(-16, -34 + bob, 32, 10), FlatUI.OUTLINE, false, 2.0)
			draw_rect(Rect2(-34, -6 + bob, 30, 12), FlatUI.GRAY_DARK)
			draw_rect(Rect2(-42, -12 + bob, 14, 24), FlatUI.RED)
			draw_rect(Rect2(-42, -12 + bob, 14, 24), FlatUI.OUTLINE, false, 2.0)
		_:
			pass
	# 残血条（血量不满才出现；boss 血条加宽以覆盖 2400 血量级）
	if hp < max_hp:
		var ratio := hp / maxf(max_hp, 0.001)
		var bar_w := 64.0 if crushes else 30.0
		draw_rect(Rect2(-bar_w * 0.5 - 1.0, -50.0 * body_scale + bob, bar_w + 2.0, 5), FlatUI.OUTLINE)
		draw_rect(Rect2(-bar_w * 0.5, -50.0 * body_scale + 1.0 + bob, bar_w * ratio, 3), FlatUI.RED)
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)


## 夜幕剪影（spec levelMechanics.nightFog.silhouette #6b7f94）：等比单色剪影，
## 僵尸在遮罩内以「有东西来了」预显示，进入点亮区才显形。
func _draw_silhouette() -> void:
	var body_scale := 1.55 if crushes else 1.0
	draw_set_transform(Vector2.ZERO, 0.0, Vector2(body_scale, body_scale))
	var bob := sin(_phase * 3.0) * 1.5
	draw_rect(Rect2(-30, -16 + bob, 18, 8), FlatUI.SILHOUETTE)
	draw_rect(Rect2(-28, -4 + bob, 18, 8), FlatUI.SILHOUETTE)
	draw_rect(Rect2(BODY_RECT.position + Vector2(0, bob), BODY_RECT.size), FlatUI.SILHOUETTE)
	draw_circle(HEAD_OFFSET + Vector2(0, bob), HEAD_RADIUS, FlatUI.SILHOUETTE)
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
