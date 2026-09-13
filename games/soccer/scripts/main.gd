extends Node2D
## 比赛控制器（Main）：装配两队各 11 人 + 足球 + UI，驱动完整比赛流程 ——
## 开球 → 上下半场计时（模拟 90 分钟）→ 中场交换 → 终场结算；规则判定（进球 /
## 界外球 / 角球 / 球门球）；控球、带球、传球、射门、抢断；AI 攻防与门将扑救。
##
## 信号方向（SKILL.md 规范）：Footballer / Ball 只 emit；GameState 只存状态发信号；
## 本场景在 _ready() 集中订阅，输入只读 InputMap 动作名。

const FOOTBALLER_SCENE: PackedScene = preload("res://scenes/footballer.tscn")

## ---- 数值调参区（与策划案 numeric 对应；改数值不改逻辑） ----
## 碰撞包络余量（教训：注释承诺的余量必须与常量推导一致）——
## CONTROL_RADIUS = 球员身体半径 + 球半径：球心进入「贴脚」包络（身体圆 + 球圆相切）即被拿走；
## TACKLE_RADIUS  = 身体半径 × 2：两名球员身体圆相切即开始贴身抢断计时。
const CONTROL_RADIUS: float = Footballer.BODY_RADIUS + Ball.RADIUS  ## = 9 + 7 = 16
const TACKLE_RADIUS: float = Footballer.BODY_RADIUS * 2.0           ## = 18
var kickoff_delay: float = 0.45        ## 开球等待（秒）（var：冒烟门禁可压小以留帧预算，真实对局不变）
var restart_delay: float = 0.4         ## 死球重发等待（秒）：快发让节奏更跟手（var 同上）
const HALFTIME_DELAY: float = 1.0       ## 中场展示时长（秒）
const PASS_SPEED: float = 430.0         ## 传球初速
const SHOOT_SPEED: float = 580.0        ## 射门初速
const DRIBBLE_SPEED_FACTOR: float = 0.86
const GK_HOLD_TIME: float = 0.7         ## 门将持球后开大脚前的停留（秒）
const GK_CHASE_RANGE: float = 130.0     ## 门将出击半径

## 4-3-3 阵型（归一化：x 0=本方门线 → 1=对方门线，y 0=上边线 → 1=下边线）。
const FORMATION: Array[Vector2] = [
	Vector2(0.045, 0.5),
	Vector2(0.18, 0.2), Vector2(0.16, 0.4), Vector2(0.16, 0.6), Vector2(0.18, 0.8),
	Vector2(0.38, 0.3), Vector2(0.35, 0.5), Vector2(0.38, 0.7),
	Vector2(0.62, 0.25), Vector2(0.66, 0.5), Vector2(0.62, 0.75),
]
const FORMATION_ROLES: Array[int] = [
	Footballer.Role.GK,
	Footballer.Role.DF, Footballer.Role.DF, Footballer.Role.DF, Footballer.Role.DF,
	Footballer.Role.MF, Footballer.Role.MF, Footballer.Role.MF,
	Footballer.Role.FW, Footballer.Role.FW, Footballer.Role.FW,
]

const HOME_KIT: Color = Color(0.85, 0.2, 0.2)
const HOME_SHORTS: Color = Color(0.95, 0.95, 0.95)
const AWAY_KIT: Color = Color(0.2, 0.36, 0.85)
const AWAY_SHORTS: Color = Color(0.12, 0.12, 0.16)
const HOME_GK_KIT: Color = Color(0.95, 0.75, 0.1)
const AWAY_GK_KIT: Color = Color(0.1, 0.7, 0.35)
const TEAM_NAME: Array[String] = ["主队", "客队"]

var home_players: Array[Footballer] = []
var away_players: Array[Footballer] = []
var all_players: Array[Footballer] = []
## 玩家当前控制的球员（主队）。
var controlled: Footballer = null
## 上半场主队是否守左门（中场交换时翻转）。
var home_defends_left: bool = true
var phase_timer: float = 0.0
var message_timer: float = 0.0
var _halftime_done: bool = false
var _kickoff_team: int = 0
var _tackler: Footballer = null
var _tackle_progress: float = 0.0
var _gk_hold: float = 0.0

@onready var pitch: Pitch = $Pitch
@onready var ball: Ball = $Ball
@onready var home_team_root: Node2D = $HomeTeam
@onready var away_team_root: Node2D = $AwayTeam
@onready var score_label: Label = %ScoreLabel
@onready var clock_label: Label = %ClockLabel
@onready var help_label: Label = %HelpLabel
@onready var message_label: Label = %MessageLabel
@onready var difficulty_label: Label = %DifficultyLabel
@onready var result_panel: PanelContainer = %ResultPanel
@onready var result_score: Label = %ResultScore
@onready var result_hint: Label = %ResultHint
@onready var mute_button: Button = %MuteButton
@onready var unlock_hint: Label = %UnlockHint
@onready var touch_controls: TouchControls = $TouchControls
@onready var result_controls: ResultControls = $ResultControls


func _ready() -> void:
	_spawn_teams()
	# 信号连接：订阅方（本场景）集中连接，发布方（GameState）只 emit。
	if not GameState.score_changed.is_connected(_on_score_changed):
		GameState.score_changed.connect(_on_score_changed)
	if not GameState.match_finished.is_connected(_on_match_finished):
		GameState.match_finished.connect(_on_match_finished)
	if not GameState.difficulty_changed.is_connected(_on_difficulty_changed):
		GameState.difficulty_changed.connect(_on_difficulty_changed)
	if not GameState.match_length_changed.is_connected(_on_match_length_changed):
		GameState.match_length_changed.connect(_on_match_length_changed)
	# 设置类状态跨局保留（autoload 不随场景重建），挂载时按当前值初始化 HUD。
	_on_difficulty_changed(GameState.difficulty)
	_on_match_length_changed(GameState.match_real_seconds())
	if not AudioManager.mute_changed.is_connected(_on_audio_mute_changed):
		AudioManager.mute_changed.connect(_on_audio_mute_changed)
	if not AudioManager.unlocked_changed.is_connected(_on_audio_unlocked):
		AudioManager.unlocked_changed.connect(_on_audio_unlocked)
	help_label.text = "WASD / 方向键 移动 · J 传球 · K 射门 · Q / Tab 切换球员 · C 难度 · L 时长 · R 重开 · M 静音（触屏：左摇杆 + 右侧按钮）"
	_sync_mute_button()
	_sync_unlock_hint()
	_set_controlled(_center_forward_of(0))
	kickoff(0)


## 生成两队各 11 人（含门将），按 4-3-3 阵型落位并着队服。
func _spawn_teams() -> void:
	for team in 2:
		var root := home_team_root if team == 0 else away_team_root
		for i in FORMATION.size():
			var p := FOOTBALLER_SCENE.instantiate() as Footballer
			p.team = team
			p.role = FORMATION_ROLES[i]
			p.formation_index = i
			p.is_gk = p.role == Footballer.Role.GK
			p.anchor = _anchor_for(team, FORMATION[i])
			var jersey := HOME_KIT if team == 0 else AWAY_KIT
			var shorts := HOME_SHORTS if team == 0 else AWAY_SHORTS
			if p.is_gk:
				jersey = HOME_GK_KIT if team == 0 else AWAY_GK_KIT
			root.add_child(p)
			# set_kit 依赖 @onready 的四肢引用，必须等 add_child 触发 _ready 之后再调用。
			p.set_kit(jersey, shorts)
			p.reset_to(p.anchor)
			all_players.append(p)
			if team == 0:
				home_players.append(p)
			else:
				away_players.append(p)


## ---- 比赛流程 ----

## 开球：全员回位（压回本方半场），球交给开球方中锋，短暂倒计时后进入 PLAYING。
func kickoff(kick_team: int) -> void:
	_kickoff_team = kick_team
	for p in all_players:
		p.reset_to(_kickoff_position(p))
	var kicker := _center_forward_of(kick_team)
	kicker.reset_to(pitch.CENTER - _attack_unit(kick_team) * 20.0)
	ball.holder = null
	ball.velocity = Vector2.ZERO
	ball.capture_lock_team = -1
	ball.give_to(kicker)
	ball.global_position = kicker.global_position + _attack_unit(kick_team) * 14.0
	_tackler = null
	_tackle_progress = 0.0
	_gk_hold = 0.0
	GameState.set_phase(GameState.Phase.KICKOFF)
	phase_timer = kickoff_delay
	_show_message("开球 —— %s" % _team_name(kick_team))
	AudioManager.play_whistle(AudioManager.Whistle.KICKOFF)


## 重开整场比赛（R 键 / 终场后 confirm）：比分、计时、半场归属全部归零，
## 结算面板收起（难度与时长是设置项，跨局保留不清零）。
func restart_match() -> void:
	GameState.reset_match()
	_halftime_done = false
	home_defends_left = true
	_refresh_anchors()
	result_panel.visible = false
	# v3：结算「再来一局」按钮随之收起（比赛进行中整层隐藏、不可交互）。
	result_controls.set_active(false)
	kickoff(0)
	_show_message("新的一场比赛开始 —— %s 先开球" % _team_name(0))


## ---- 几何与阵型辅助 ----

## 队伍进攻方向单位向量（主队上半场向右，下半场翻转；客队相反）。
func _attack_unit(team: int) -> Vector2:
	var home_right := 1.0 if home_defends_left else -1.0
	if team == 0:
		return Vector2.RIGHT * home_right
	return Vector2.RIGHT * (-home_right)


## 某队防守的球门中心。
func _defended_goal(team: int) -> Vector2:
	var on_left := (team == 0) == home_defends_left
	var x := pitch.PITCH_RECT.position.x if on_left else pitch.PITCH_RECT.end.x
	return Vector2(x, pitch.CENTER.y)


## 攻击左侧球门的队伍（用于判定进球方）。
func _team_attacking_goal(is_left_goal: bool) -> int:
	return 0 if (is_left_goal != home_defends_left) else 1


## 队伍在归一化坐标下的阵型落位。
func _anchor_for(team: int, normalized: Vector2) -> Vector2:
	var rect := pitch.PITCH_RECT
	var forward := _attack_unit(team).x
	var x := rect.position.x + normalized.x * rect.size.x if forward > 0.0 else rect.end.x - normalized.x * rect.size.x
	return Vector2(x, rect.position.y + normalized.y * rect.size.y)


## 开球落位：阵型锚点整体压回本方半场（nx ≤ 0.47），门将保持原位。
func _kickoff_position(p: Footballer) -> Vector2:
	var own := FORMATION[p.formation_index]
	if not p.is_gk:
		own.x = minf(own.x, 0.47)
	return _anchor_for(p.team, own)


func _refresh_anchors() -> void:
	for p in all_players:
		p.anchor = _anchor_for(p.team, FORMATION[p.formation_index])


func _center_forward_of(team: int) -> Footballer:
	var list := home_players if team == 0 else away_players
	return list[9]


func gk_of(team: int) -> Footballer:
	var list := home_players if team == 0 else away_players
	return list[0]


func _team_name(team: int) -> String:
	return TEAM_NAME[team]


## ---- 主循环 ----

func _physics_process(delta: float) -> void:
	match GameState.phase:
		GameState.Phase.KICKOFF, GameState.Phase.RESTART:
			_set_frozen(true)
			phase_timer -= delta
			if phase_timer <= 0.0:
				ball.capture_lock_team = -1
				GameState.set_phase(GameState.Phase.PLAYING)
		GameState.Phase.PLAYING:
			_set_frozen(false)
			GameState.elapsed += delta
			_check_clock()
			if GameState.phase == GameState.Phase.PLAYING:
				_update_possession(delta)
				_update_ai()
				_apply_rules()
		GameState.Phase.HALFTIME:
			_set_frozen(true)
			phase_timer -= delta
			if phase_timer <= 0.0:
				# 中场交换：双方进攻方向翻转，下半场由客队开球。
				home_defends_left = not home_defends_left
				_refresh_anchors()
				kickoff(1)
		GameState.Phase.FINISHED:
			_set_frozen(true)
	_update_hud(delta)


## 计时与赛段推进：上半场打满 → 中场；全场打满 → 终场结算。
func _check_clock() -> void:
	if GameState.elapsed >= GameState.match_real_seconds():
		GameState.finish_match()
		return
	if not _halftime_done and GameState.elapsed >= GameState.half_real_seconds():
		_halftime_done = true
		GameState.set_phase(GameState.Phase.HALFTIME)
		phase_timer = HALFTIME_DELAY
		_show_message("中场休息 —— 交换场地")
		AudioManager.play_whistle(AudioManager.Whistle.HALFTIME)


func _set_frozen(frozen: bool) -> void:
	for p in all_players:
		p.frozen = frozen


## ---- 控球 / 抢断 ----

func _update_possession(delta: float) -> void:
	if ball.holder == null:
		# 自由球：冷却与归属锁允许的人里，离球最近的拿到球。
		var best: Footballer = null
		var best_d := CONTROL_RADIUS
		for p in all_players:
			if not ball.can_be_captured_by(p):
				continue
			var d := p.global_position.distance_to(ball.global_position)
			if d < best_d:
				best_d = d
				best = p
		if best != null:
			ball.holder = best
			ball.velocity = Vector2.ZERO
			ball.last_touch_team = best.team
			ball.capture_lock_team = -1
			_gk_hold = 0.0
			# 主队球员拿球 → 自动切换为受控（玩家始终控制脚下有球的人）。
			if best.team == 0 and not best.is_gk and controlled != best:
				_set_controlled(best)
	else:
		# 带球中：最近的对方球员贴身（抢断时间按抢方队伍难度梯度）后完成抢断。
		var tackler: Footballer = null
		var best_d := TACKLE_RADIUS
		for p in all_players:
			if p.team == ball.holder.team:
				continue
			var d := p.global_position.distance_to(ball.global_position)
			if d < best_d:
				best_d = d
				tackler = p
		if tackler != null and tackler == _tackler:
			_tackle_progress += delta
			if _tackle_progress >= GameState.ai_tackle_time(tackler.team):
				var victim := ball.holder
				ball.give_to(tackler)
				ball.kicker_cooldown = victim
				ball.kicker_cooldown_left = Ball.RECAPTURE_COOLDOWN
				_tackler = null
				_tackle_progress = 0.0
				_gk_hold = 0.0
				_show_message("%s 抢断成功" % _team_name(tackler.team))
				AudioManager.play_steal()
				if tackler.team == 0 and not tackler.is_gk:
					_set_controlled(tackler)
		elif tackler != null:
			_tackler = tackler
			_tackle_progress = 0.0
		else:
			_tackler = null
			_tackle_progress = 0.0
		# 门将持球：短暂停留后开大脚。
		if ball.holder != null and ball.holder.is_gk:
			_gk_hold += delta
			if _gk_hold >= GK_HOLD_TIME:
				_ai_gk_clearance(ball.holder)


## ---- 规则判定（进球 / 界外球 / 角球 / 球门球） ----

func _apply_rules() -> void:
	var pos := ball.global_position
	if pitch.is_goal_position(pos):
		# 进球：得分方 = 攻击该侧球门的队伍；由失球方重新开球。
		var scoring := _team_attacking_goal(pos.x < pitch.CENTER.x)
		GameState.add_goal(scoring)
		if GameState.phase == GameState.Phase.PLAYING:
			_show_message("GOAL！%s 破门  主 %d : %d 客" % [
				_team_name(scoring), GameState.home_score, GameState.away_score,
			])
			AudioManager.play_goal()
			kickoff(1 - scoring)
		return
	if pitch.is_out_of_bounds(pos):
		_handle_out_of_bounds(pos)


## 球出边线 → 界外球；出底线 → 攻方最后触球判球门球（防守方门将开球），
## 守方最后触球判角球（攻方在角旗区重发）。
func _handle_out_of_bounds(pos: Vector2) -> void:
	var rect := pitch.PITCH_RECT
	var last_touch := ball.last_touch_team if ball.last_touch_team != -1 else 0
	if pos.y < rect.position.y - 4.0 or pos.y > rect.end.y + 4.0:
		# 边线出界 → 界外球，对方在出界点掷球。
		var throw_team := 1 - last_touch
		var spot := Vector2(
			clampf(pos.x, rect.position.x + 20.0, rect.end.x - 20.0),
			rect.position.y + 8.0 if pos.y < pitch.CENTER.y else rect.end.y - 8.0,
		)
		_dead_ball_restart(spot, throw_team, "界外球 —— %s 掷球" % _team_name(throw_team))
		return
	# 底线出界（非进球）。足球规则：攻方最后触球 → 球门球（守方门将开球）；
	# 守方最后触球 → 角球（攻方在角旗区开出）。
	var is_left := pos.x < pitch.CENTER.x
	var defending := _team_attacking_goal(not is_left)  # 守这侧门的队 = 攻另一侧门的队
	var goal_x := rect.position.x if is_left else rect.end.x
	var inward := _attack_unit(defending)
	if last_touch != defending:
		# 攻方最后触球 → 球门球，直接交防守方门将。
		var gk := gk_of(defending)
		gk.reset_to(gk.anchor)
		ball.holder = null
		ball.velocity = Vector2.ZERO
		ball.give_to(gk)
		ball.global_position = Vector2(goal_x, pitch.CENTER.y) + Vector2(inward.x, 0.0) * Pitch.GOAL_AREA_DEPTH * 0.7
		_gk_hold = 0.0
		GameState.set_phase(GameState.Phase.RESTART)
		phase_timer = restart_delay
		_show_message("球门球 —— %s 门将开球" % _team_name(defending))
	else:
		# 守方最后触球 → 角球，交给攻方在角旗区重发。
		var attacking := 1 - defending
		var corner := Vector2(
			goal_x + inward.x * 10.0,
			rect.position.y + 10.0 if pos.y < pitch.CENTER.y else rect.end.y - 10.0,
		)
		_dead_ball_restart(corner, attacking, "角球 —— %s 开出" % _team_name(attacking))


## 死球重发的通用流程：球放在落点并归属锁给获球方，短暂倒计时后恢复比赛。
func _dead_ball_restart(spot: Vector2, team: int, message: String) -> void:
	ball.holder = null
	ball.velocity = Vector2.ZERO
	ball.global_position = spot
	ball.capture_lock_team = team
	ball.last_touch_team = team
	_tackler = null
	_tackle_progress = 0.0
	_gk_hold = 0.0
	GameState.set_phase(GameState.Phase.RESTART)
	phase_timer = restart_delay
	_show_message(message)


## ---- AI（非受控球员的门将扑救与攻防跑位） ----

func _update_ai() -> void:
	var holder := ball.holder
	for p in all_players:
		# 移速按队伍难度梯度缩放（主队恒为基准，难度只调客队）；带球减速照常生效。
		var speed := Footballer.RUN_SPEED * GameState.ai_speed_factor(p.team)
		if p == controlled:
			# 受控球员读玩家输入，AI 不覆盖。
			p.max_speed = speed * (DRIBBLE_SPEED_FACTOR if holder == p else 1.0)
			continue
		p.max_speed = speed * (DRIBBLE_SPEED_FACTOR if holder == p else 1.0)
		if p.is_gk:
			_ai_gk(p)
		else:
			_ai_outfield(p)
	_clamp_players()


## 无球/有球的普通球员 AI：持球推进、无球接应、上抢与回防。
func _ai_outfield(p: Footballer) -> void:
	var holder := ball.holder
	if holder != null and holder.team == p.team:
		if holder == p:
			_ai_carrier(p)
		else:
			# 无球队员：向「阵型锚点 + 球势偏移」跑位接应。
			var target := p.anchor + (ball.global_position - pitch.CENTER) * 0.35
			p.ai_direction = _steer(p, _clamp_target(target))
	elif holder != null:
		# 防守：离球最近的本队球员上抢（人数按难度梯度），其余回防锚点（带球势偏移）。
		if p in _nearest_of_team_to_ball(p.team, GameState.ai_press_count(p.team)):
			p.ai_direction = _steer(p, ball.global_position + ball.velocity * 0.15)
		else:
			var target := p.anchor + (ball.global_position - pitch.CENTER) * 0.25
			var own_goal := _defended_goal(p.team)
			target += (own_goal - target) * 0.12
			p.ai_direction = _steer(p, _clamp_target(target))
	else:
		# 自由球：归属锁允许时，本队最近的两人去拿，其余回位。
		if ball.can_be_captured_by(p) and p in _nearest_of_team_to_ball(p.team, 2):
			p.ai_direction = _steer(p, ball.global_position)
		else:
			var target := p.anchor + (ball.global_position - pitch.CENTER) * 0.2
			p.ai_direction = _steer(p, _clamp_target(target))


## 持球队员 AI：向对方球门推进；近门且受压 → 射门（起脚距离按难度梯度），
## 受压 → 传球，否则带球。
func _ai_carrier(p: Footballer) -> void:
	var goal := _defended_goal(1 - p.team)
	var dist_goal := p.global_position.distance_to(goal)
	var pressure := _nearest_opponent_distance(p)
	var shoot_range := GameState.ai_shoot_range(p.team)
	if (dist_goal < shoot_range and pressure < 90.0) or dist_goal < shoot_range * 0.5:
		_do_shoot(p)
	elif pressure < 46.0:
		_do_pass(p)
	else:
		var target := goal + Vector2(0.0, (pitch.CENTER.y - p.global_position.y) * 0.25)
		p.ai_direction = _steer(p, target)


## 门将 AI：门线站位跟随球（扑救反应）、禁区自由球出击、持球等开大脚。
func _ai_gk(gk: Footballer) -> void:
	var goal := _defended_goal(gk.team)
	var inward := _attack_unit(gk.team)
	if ball.holder == gk:
		gk.ai_direction = Vector2.ZERO
		return
	var mouth_top := pitch.CENTER.y - Pitch.GOAL_HALF + 8.0
	var mouth_bottom := pitch.CENTER.y + Pitch.GOAL_HALF - 8.0
	var in_penalty := _in_own_penalty_area(gk.team, ball.global_position)
	if ball.holder == null and in_penalty \
			and gk.global_position.distance_to(ball.global_position) < GK_CHASE_RANGE:
		# 出击拿球。
		gk.ai_direction = _steer(gk, ball.global_position)
		return
	# 站位：x 钉在门前小距离，y 以有限速度跟随球（反应速度按难度梯度）→ 射门有扑救窗口。
	var target := Vector2(goal.x + inward.x * 26.0, clampf(ball.global_position.y, mouth_top, mouth_bottom))
	gk.ai_direction = _steer(gk, target, GameState.ai_gk_react(gk.team))


func _ai_gk_clearance(gk: Footballer) -> void:
	var unit := _attack_unit(gk.team)
	# 朝本方进攻方向开大脚（略带朝场地中心的竖向分量）。
	var vertical := clampf((pitch.CENTER.y - gk.global_position.y) * 0.5, -160.0, 160.0)
	var dir := Vector2(unit.x, vertical * 0.004).normalized()
	ball.kick_by(gk, dir * PASS_SPEED * 1.2)
	AudioManager.play_kick()
	_gk_hold = 0.0
	_show_message("%s 门将开大脚" % _team_name(gk.team))


## ---- 动作（传球 / 射门 / 切换球员） ----

## 传球：优先向前、距离适中的队友，球速带提前量。
func _do_pass(p: Footballer) -> void:
	if ball.holder != p:
		return
	var unit := _attack_unit(p.team)
	var best: Footballer = null
	var best_score := -INF
	for mate in _teammates(p):
		if mate.is_gk:
			continue
		var to_mate := mate.global_position + mate.velocity * 0.25 - p.global_position
		var dist := to_mate.length()
		if dist < 24.0:
			continue
		var score := to_mate.normalized().dot(unit) * 260.0 - dist * 0.45
		if score > best_score:
			best_score = score
			best = mate
	if best == null:
		# 兜底：传给离自己最近的非门将队友。
		var nearest_d := INF
		for mate in _teammates(p):
			if mate == p or mate.is_gk:
				continue
			var d := p.global_position.distance_to(mate.global_position)
			if d < nearest_d:
				nearest_d = d
				best = mate
	if best == null or best == p:
		return
	var dir := (best.global_position + best.velocity * 0.25 - ball.global_position).normalized()
	ball.kick_by(p, dir * PASS_SPEED)
	AudioManager.play_pass()


## 射门：球速指向对方球门中心。
func _do_shoot(p: Footballer) -> void:
	if ball.holder != p:
		return
	var goal := _defended_goal(1 - p.team)
	var dir := (goal - ball.global_position).normalized()
	ball.kick_by(p, dir * SHOOT_SPEED)
	AudioManager.play_kick()
	_show_message("%s 射门！" % _team_name(p.team))


## 切换控制球员：换成主队里离球最近的非门将球员。
func _switch_controlled() -> void:
	var best: Footballer = null
	var best_d := INF
	for p in home_players:
		if p.is_gk or p == controlled:
			continue
		var d := p.global_position.distance_to(ball.global_position)
		if d < best_d:
			best_d = d
			best = p
	if best != null:
		_set_controlled(best)


func _set_controlled(p: Footballer) -> void:
	if controlled != null:
		controlled.set_controlled(false)
	controlled = p
	if controlled != null:
		controlled.set_controlled(true)


## ---- 输入（只读 InputMap 动作名） ----

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("toggle_mute"):
		AudioManager.toggle_mute()
		return
	if event.is_action_pressed("restart"):
		restart_match()
		return
	if event.is_action_pressed("confirm") and GameState.phase == GameState.Phase.FINISHED:
		restart_match()
		return
	# 设置类按键任意阶段可用（含终场结算画面），即时生效。
	if event.is_action_pressed("difficulty_next"):
		GameState.cycle_difficulty()
		return
	if event.is_action_pressed("match_length_next"):
		GameState.cycle_match_length()
		return
	if GameState.phase != GameState.Phase.PLAYING or controlled == null:
		return
	if event.is_action_pressed("pass") and ball.holder == controlled:
		_do_pass(controlled)
	elif event.is_action_pressed("shoot") and ball.holder == controlled:
		_do_shoot(controlled)
	elif event.is_action_pressed("switch_player"):
		_switch_controlled()


## ---- 音频与静音开关 ----

## HUD 静音按钮（鼠标 / 触摸通吃；桌面隐藏触摸层时也能用）。
func _on_mute_button_pressed() -> void:
	AudioManager.toggle_mute()


## M 键 / 按钮 / 任意来源的静音切换都汇到这里：同步按钮文案 + HUD 提示。
func _on_audio_mute_changed(muted: bool) -> void:
	_sync_mute_button()
	_show_message("音效已关闭（M 键可重新开启）" if muted else "音效已开启", 1.5)


func _sync_mute_button() -> void:
	mute_button.text = "音效：关" if AudioManager.muted else "音效：开"


## v2.1 F4：解锁前 HUD 常驻「开启音效」指引，解锁后隐藏。
## 移动端 WebKit 自动播放策略严格（见 qa/MOBILE_AUDIO_ROOT_CAUSE.md），
## 「无声且无指引」是最差体验 —— 桌面键盘 / 鼠标按下即解锁，行为不变。
func _on_audio_unlocked(unlocked: bool) -> void:
	unlock_hint.visible = not unlocked


func _sync_unlock_hint() -> void:
	unlock_hint.visible = not AudioManager.unlocked


## ---- HUD 与信号订阅 ----

func _update_hud(delta: float) -> void:
	score_label.text = "主 %d : %d 客" % [GameState.home_score, GameState.away_score]
	var half_text := "上半场" if GameState.current_half() == 1 else "下半场"
	if GameState.phase == GameState.Phase.FINISHED:
		half_text = "全场"
	clock_label.text = "%s %d'" % [half_text, GameState.sim_minute()]
	if message_timer > 0.0:
		message_timer -= delta
		if message_timer <= 0.0:
			message_label.text = ""


func _show_message(text: String, duration: float = 2.0) -> void:
	message_label.text = text
	message_timer = duration


func _on_score_changed(home_score: int, away_score: int) -> void:
	score_label.text = "主 %d : %d 客" % [home_score, away_score]


func _on_match_finished(home_score: int, away_score: int) -> void:
	AudioManager.play_whistle(AudioManager.Whistle.FULLTIME)
	_show_message("全场比赛结束  主 %d : %d 客 —— %s" % [home_score, away_score, GameState.result_for_home()], 3600.0)
	# 终场结算面板：胜负反馈明确（比分 + 胜/平/负 + 重开入口提示）。
	result_score.text = "主 %d : %d 客 · %s" % [home_score, away_score, GameState.result_for_home()]
	result_panel.visible = true
	# v3：终场结算显示触摸/鼠标可点的「再来一局」按钮（注入 restart 动作，与键盘 R 同路径）。
	result_controls.set_active(true)


## 难度切换：刷新设置行（客队 AI 下一帧即按新梯度行动）。
func _on_difficulty_changed(difficulty: int) -> void:
	difficulty_label.text = "难度：%s · 时长：%s" % [GameState.difficulty_name(), GameState.match_length_name()]


## 时长切换：刷新设置行（计时映射即时按新档换算）。
func _on_match_length_changed(real_seconds: float) -> void:
	difficulty_label.text = "难度：%s · 时长：%s" % [GameState.difficulty_name(), GameState.match_length_name()]


## ---- 小工具 ----

func _teammates(p: Footballer) -> Array[Footballer]:
	return home_players if p.team == 0 else away_players


func _nearest_of_team_to_ball(team: int, count: int) -> Array[Footballer]:
	var list := _teammates_of(team).duplicate()
	list.sort_custom(_by_distance_to_ball)
	var result: Array[Footballer] = []
	for i in mini(count, list.size()):
		result.append(list[i])
	return result


## 按到球的距离升序排序（AI 上抢选择用）。
func _by_distance_to_ball(a: Footballer, b: Footballer) -> bool:
	return a.global_position.distance_squared_to(ball.global_position) \
		< b.global_position.distance_squared_to(ball.global_position)


func _teammates_of(team: int) -> Array[Footballer]:
	return home_players if team == 0 else away_players


func _nearest_opponent_distance(p: Footballer) -> float:
	var best := INF
	for opp in _teammates_of(1 - p.team):
		best = minf(best, p.global_position.distance_to(opp.global_position))
	return best


## 朝目标点的移动方向（贴近即停，speed_factor 缩放移速）。
func _steer(p: Footballer, target: Vector2, speed_factor: float = 1.0) -> Vector2:
	var to_target := target - p.global_position
	if to_target.length() < 6.0:
		return Vector2.ZERO
	return to_target.normalized() * speed_factor


func _clamp_target(target: Vector2) -> Vector2:
	return pitch.clamp_inside(target)


## 球是否在本队禁区附近（门将出击判定用）。
func _in_own_penalty_area(team: int, pos: Vector2) -> bool:
	var goal := _defended_goal(team)
	return pos.distance_to(goal) < (Pitch.PENALTY_DEPTH + 60.0)


## 把球员钳回场内（门将额外限制在本方禁区纵深附近）。
func _clamp_players() -> void:
	for p in all_players:
		if p.is_gk:
			var goal := _defended_goal(p.team)
			var inward := _attack_unit(p.team)
			p.global_position = Vector2(
				clampf(p.global_position.x,
					minf(goal.x, goal.x + inward.x * Pitch.PENALTY_DEPTH * 1.1),
					maxf(goal.x, goal.x + inward.x * Pitch.PENALTY_DEPTH * 1.1)),
				clampf(p.global_position.y,
					pitch.CENTER.y - Pitch.GOAL_HALF * 1.8, pitch.CENTER.y + Pitch.GOAL_HALF * 1.8),
			)
		else:
			p.global_position = pitch.clamp_inside(p.global_position)


