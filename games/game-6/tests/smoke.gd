extends Node
## 无头冒烟自检（headless smoke）——「能不能跑且玩得动」的机器判定（acc-07 门禁场景）。
##
## 运行方式（由 std-skills/godot-game-dev/scripts/smoke.sh 封装）：
##   godot --headless --path <工程目录> tests/smoke.tscn
## 判定协议（smoke.sh 按此双断言）：
##   通过 → stdout 打印 `GODOT_SMOKE: PASS ...`，进程退出码 0
##   失败 → stderr 打印 `GODOT_SMOKE: FAIL <原因>`（每条一行），进程退出码 1
##
## 阶段流（帧预算 290 < 门禁 smokeFrames=320 兜底，与 .myrd/routines.yaml 同值；
## Engine.max_fps=60 下 process:physics ≈ 1:1）：
##   NOISE(8)   确定种子对抗输入 → 噪声后玩法断言仍通过（输入管线不被楔死）
##   RUN_A(≤80) 负向局：不输入 → 自动奔跑撞首个障碍判负（死亡/距离/得分链路）
##   BETWEEN(3) 经「重新开始」按钮真实信号链重开 → 状态清零（acc-05）
##   RUN_B(≤195) 正向局：跳跃越障 + 输入延迟实测(≤3帧,acc-08) + 滞空二段跳封顶(acc-02) +
##              落地滑铲时长 + 磁铁吸附 + 护盾破盾 + 冲刺碾怪(acc-04) + 坠坑结算(acc-05)
##   FINAL(1)   八个契约全量机判（acc-01/02/03/04/05/06/08/09）→ 汇总 PASS/FAIL
##
## ⚠️ 输入注入只用 Input.parse_input_event（E-08：不与 Input.action_press 同帧混用）；
##   动作「先释放后按下、按下跨帧」，保证 just_pressed 边沿可读（实测冲刷延迟 2 帧）。

## ── 噪声相位：正式断言前注入确定种子的对抗输入（模板同源）──
const NOISE_FRAMES: int = 8

## 正向局：起跳触发线（x ≥ 380 起跳 → 单跳落地 ~621 > 障碍右沿 592，裕度 ~29px；
## 二段跳在滞空前段完成，弧线更高更远，越障裕度进一步扩大）。
const JUMP_TRIGGER_X: float = 380.0
## 离地判定：站立中心 y=268，上升 ≥10px 视为离地。
const AIRBORNE_MAX_Y: float = 258.0
## 障碍物中心 x（l1/e3，见 chunk_defs.gd）。
const OBSTACLE_X: float = 560.0
## 帧预算（必须 < 门禁 smokeFrames=320；物理帧计数；EXPIRE 步骤 +5 帧后留 15 帧裕度）。
const TOTAL_FRAME_BUDGET: int = 305
const RUN_A_DEADLINE: int = 90

enum Phase { NOISE, RUN_A, BETWEEN, RUN_B, FINAL, DONE }
enum RbStep {
	WAIT_TRIGGER, WAIT_AIRBORNE, DJUMP_VERIFY, WAIT_LAND,
	SLIDE_START, MAGNET, VERDICTS, SLIDE_END, EXPIRE, PIT_DEATH,
}

var _failures: PackedStringArray = []
var _frames: int = 0
var _phase: Phase = Phase.NOISE
var _phase_started_at: int = 0
var _rb_step: RbStep = RbStep.WAIT_TRIGGER
var _rb_step_started_at: int = 0
var _reported: bool = false

## 行为证据（契约 ctx/flags）。
var _flags: Dictionary = {
	"jump_latency_frames": -1,
	"jump_lifted_off": false,
	"slide_measured_frames": -1,
	"double_jump_capped": false,
	"magnet_pulled_coin": false,
	"shield_blocked_hazard": false,
	"dash_speed_up": false,
	"dash_smashed_obstacle": false,
	"settle_coins_match": false,
	"restart_cleared": false,
	# ── 迭代需求 ①：收集反馈全链路证据 ──
	"pickup_feedback": false,
	"pickup_hud_lit": false,
	"magnet_ring_on": false,
	"dash_trail_on": false,
	"dash_hud_lit": false,
	"powerup_expire_synced": false,
}

var _player: Player
var _main: RunnerMain
var _moved_seen: bool = false
var _score_seen: bool = false
var _coins_seen: bool = false
var _run_ended_seen: bool = false
var _death_cause: StringName = &""
var _death_seen: bool = false
## 输入注入小队列：{action, stage}（0=释放 1=按下 2=完成）。
var _inject_queue: Array[Dictionary] = []
var _slide_frame_counter: int = 0
var _slide_counting: bool = false
## 等待 jump 按下被解析（延迟计量起点）。
var _await_jump_parse: bool = false
var _rb_jump_inject_frame: int = -1
var _magnet_coins_before: int = 0
var _dash_score_before: int = 0
var _test_coin: Coin = null
var _test_pickup: PickupBox = null
var _player_fx: PlayerFx = null
var _settle_coins_at_end: int = -1


func _ready() -> void:
	# headless 无垂直同步：限 60FPS 让 process:physics ≈ 1:1（--quit-after 兜底才有意义）。
	Engine.max_fps = 60
	_player = get_tree().root.find_child("Player", true, false) as Player
	_main = get_tree().root.find_child("Main", true, false) as RunnerMain
	if _player == null:
		_failures.append("场景树找不到 Player（main.tscn 未实例化 player.tscn）")
	else:
		_player.moved.connect(_on_player_moved)
		_player.died.connect(_on_player_died)
	if _main == null:
		_failures.append("场景树找不到 Main（smoke.tscn 未实例化 main.tscn）")
	if _player != null:
		_player_fx = _player.get_node_or_null("Fx") as PlayerFx
		if _player_fx == null:
			_failures.append("Player 缺少 Fx 特效层（生效期表现未接入）")
	GameState.score_changed.connect(_on_score_changed)
	GameState.coins_changed.connect(_on_coins_changed)
	GameState.run_ended.connect(_on_run_ended)


func _physics_process(_delta: float) -> void:
	if _phase == Phase.DONE:
		return
	_frames += 1
	_tick_injection()
	# 幽灵拾取回归断言只看「不该有道具的局」：开局噪声局与负向局（重开后的正向局
	# 会真实拾取道具，不在此列）。
	if _phase == Phase.NOISE or _phase == Phase.RUN_A or _phase == Phase.BETWEEN:
		_check_no_phantom_pickup()
	if _failures.is_empty():
		match _phase:
			Phase.NOISE:
				_inject_noise_frame()
				if _frames >= NOISE_FRAMES:
					_enter_phase(Phase.RUN_A)
					if _main != null:
						_main.restart_run()
	if _phase == Phase.RUN_A:
		_tick_run_a()
	elif _phase == Phase.BETWEEN:
		_tick_between()
	elif _phase == Phase.RUN_B:
		_tick_run_b()
	elif _phase == Phase.FINAL:
		_run_contracts()
	if _frames >= TOTAL_FRAME_BUDGET:
		_failures.append("冒烟未在 %d 帧预算内完成（阶段 %s / 步骤 %s）" % [
			TOTAL_FRAME_BUDGET, Phase.keys()[_phase], RbStep.keys()[_rb_step],
		])
	if not _failures.is_empty() or _phase == Phase.DONE:
		_phase = Phase.DONE
		_report()


func _enter_phase(phase: Phase) -> void:
	_phase = phase
	_phase_started_at = _frames


## ── 幽灵拾取回归断言（迭代 v3 实机取证缺陷）──
## 形态：出生点/场景授权位与首个道具盒重叠时，物理服务端对「同帧授权+传送」的
## 配对事件有 1~2 步滞后 —— 玩家已跑开几十像素才补发 body_entered，开屏白捡随机
## 道具（上一版只改 PLAYER_SPAWN 常量、没改 main.tscn 授权位 (140,268)，即本断言
## 拦截的形态）。负向局全程不输入，任何道具状态 > 0 都属异常。
var _phantom_pickup_reported: bool = false


func _check_no_phantom_pickup() -> void:
	if _phantom_pickup_reported or _player == null or not _player.active:
		return
	if _player.magnet_timer > 0.0 or _player.is_dashing() or _player.shield_charges > 0:
		_phantom_pickup_reported = true
		_failures.append("负向局未拾取任何道具却出现道具状态（幽灵拾取/出生点压盒回归）："
			+ "magnet=%.2f dash=%.2f shield=%d frame=%d" % [
				_player.magnet_timer, _player.dash_timer, _player.shield_charges, _frames,
			])


func _enter_rb_step(step: RbStep) -> void:
	_rb_step = step
	_rb_step_started_at = _frames


func _rb_rel() -> int:
	return _frames - _rb_step_started_at


## ── RUN_A：负向局（不输入）—— 自动奔跑 → 撞首个障碍判负 ──
func _tick_run_a() -> void:
	var rel: int = _frames - _phase_started_at
	if _death_seen:
		return
	if rel > RUN_A_DEADLINE:
		_failures.append("负向局 %d 帧内未撞上障碍（x=%.0f）触发死亡：碰撞/死亡链路断裂" % [
			RUN_A_DEADLINE, OBSTACLE_X,
		])


## ── BETWEEN：经「重新开始」按钮真实信号链重开 → 断言清零 ──
func _tick_between() -> void:
	if _frames - _phase_started_at < 2:
		return
	# 死因断言放这里：died→run_ended 级联里 run_ended 处理器先跑，死因此刻才就绪。
	if _death_cause != &"hazard":
		_failures.append("负向局死因应为 hazard，实际 %s" % _death_cause)
	var button: Button = _main.settle_panel.get_node("%RestartButton") as Button
	button.pressed.emit()
	if GameState.coins != 0 or GameState.score != 0 or GameState.smashes != 0:
		_failures.append("重开后金币/得分/碾怪未清零：%d/%d/%d" % [
			GameState.coins, GameState.score, GameState.smashes,
		])
	if not GameState.run_active:
		_failures.append("重开后 run_active 为 false：新局未启动")
	if _main.settle_panel.visible:
		_failures.append("重开后结算页仍可见（restart_run 未隐藏面板）")
	if _player.global_position.distance_to(_main.PLAYER_SPAWN) > 2.0:
		_failures.append("重开后玩家未回到出生点：%s" % _player.global_position)
	if GameState.coins == 0 and GameState.score == 0 and GameState.run_active \
			and not _main.settle_panel.visible:
		_flags["restart_cleared"] = true
	_enter_phase(Phase.RUN_B)
	_enter_rb_step(RbStep.WAIT_TRIGGER)


## ── RUN_B：正向局 —— 跳跃/延迟/二段跳/滑铲/道具/坠坑结算 ──
func _tick_run_b() -> void:
	if _slide_counting and _player.is_sliding():
		_slide_frame_counter += 1
	match _rb_step:
		RbStep.WAIT_TRIGGER:
			if _player.global_position.x >= JUMP_TRIGGER_X:
				_stage_action(&"jump")
				_await_jump_parse = true
				_rb_jump_inject_frame = _frames
				_enter_rb_step(RbStep.WAIT_AIRBORNE)
		RbStep.WAIT_AIRBORNE:
			if _player.global_position.y < AIRBORNE_MAX_Y:
				_flags["jump_latency_frames"] = _frames - _rb_jump_inject_frame
				_flags["jump_lifted_off"] = true
				_enter_rb_step(RbStep.DJUMP_VERIFY)
			elif _rb_rel() > 30:
				_failures.append("注入 jump 后 30 帧未离地（跳跃链路断裂）")
		RbStep.DJUMP_VERIFY:
			_tick_djump_verify()
		RbStep.WAIT_LAND:
			if _player.is_on_floor():
				_enter_rb_step(RbStep.SLIDE_START)
			elif _rb_rel() > 120:
				_failures.append("二段跳后 120 帧未落地（重力失效）")
		RbStep.SLIDE_START:
			if _rb_rel() == 1:
				_stage_action(&"slide")
				_slide_frame_counter = 0
				_slide_counting = true
			elif _rb_rel() >= 4:
				# 滑铲进行中并行做道具验证（磁铁/护盾/冲刺），节省帧预算；
				# 冲刺无敌罩住滑铲结束后的暴露帧，时序安全。
				_enter_rb_step(RbStep.MAGNET)
		RbStep.MAGNET:
			_tick_magnet()
		RbStep.VERDICTS:
			_tick_verdicts()
		RbStep.SLIDE_END:
			# 滑铲计时自然走满（slideDurationSeconds）；结束后先做道具归零同步断言，再坠坑。
			if not _player.is_sliding() and _slide_frame_counter > 0:
				_flags["slide_measured_frames"] = _slide_frame_counter
				_slide_counting = false
				_enter_rb_step(RbStep.EXPIRE)
			elif _rb_rel() > 60:
				_failures.append("滑铲 %d 帧后仍未结束（slideDurationSeconds 失效）" % _slide_frame_counter)
		RbStep.EXPIRE:
			_tick_expire()
		RbStep.PIT_DEATH:
			_tick_pit_death()


## 二段跳封顶：滞空中注入第二跳（jumps_used 1→2）与第三跳（保持 2）—— acc-02。
## 注入冲刷实测延迟 2 帧（stage 按下 → 下下帧玩家状态变化），检查点留足帧窗。
func _tick_djump_verify() -> void:
	var rel: int = _rb_rel()
	if rel == 3:
		_stage_action(&"jump")
	elif rel == 8:
		if _player.jumps_used != 2:
			_failures.append("二段跳后 jumps_used=%d（应为 2）" % _player.jumps_used)
		_stage_action(&"jump")
	elif rel == 13:
		if _player.jumps_used != 2:
			_failures.append("第三跳未被封顶：jumps_used=%d（应仍为 2）" % _player.jumps_used)
		else:
			_flags["double_jump_capped"] = true
		_enter_rb_step(RbStep.WAIT_LAND)


## 磁铁吸附（迭代需求 ①升级：走真实道具盒碰撞拾取链，不再直调 apply_powerup）：
## 磁铁盒压到玩家身上 → 碰撞拾取（闪光+音效+HUD 点亮）→ 测试金币放在 90px 外被吸到
## 玩家身上计数（acc-04），同时采集生效期光圈证据。
func _tick_magnet() -> void:
	var rel: int = _rb_rel()
	if rel == 1:
		_magnet_coins_before = GameState.coins
		_test_coin = (load("res://scenes/coin.tscn") as PackedScene).instantiate() as Coin
		_test_coin.position = _player.global_position + Vector2(90, -40)
		_main.add_child(_test_coin)
		_test_pickup = (load("res://scenes/powerup_magnet.tscn") as PackedScene).instantiate() as PickupBox
		_test_pickup.position = _player.global_position + Vector2(6, 0)
		_main.add_child(_test_pickup)
	elif rel > 3 and GameState.coins > _magnet_coins_before:
		_flags["magnet_pulled_coin"] = true
		_flags["pickup_feedback"] = FxBank.spawned_of(&"pickup_magnet") > 0 \
			and SfxBank.plays_of(&"powerup") > 0
		_flags["pickup_hud_lit"] = _main.hud.is_powerup_lit(&"magnet")
		_flags["magnet_ring_on"] = _player_fx != null and _player_fx.ring_active
		_cleanup_test_coin()
		_enter_rb_step(RbStep.VERDICTS)
	elif rel > 20:
		if _test_pickup != null and is_instance_valid(_test_pickup):
			print("[smoke-dbg] pickup kind=%s collected=%s visible=%s monitoring=%s pos=%s player=%s mag=%.2f" % [
				_test_pickup.kind, _test_pickup._collected, _test_pickup.visible,
				_test_pickup.monitoring, _test_pickup.global_position,
				_player.global_position, _player.magnet_timer,
			])
		_failures.append("磁铁 20 帧内未把 90px 内金币吸到玩家（吸附失效）")
		_cleanup_test_coin()
		_enter_rb_step(RbStep.VERDICTS)


## 道具倒计时归零（迭代需求 ①「倒计时结束特效与增益同步消失」）：
## 把磁铁/冲刺计时压到 0.02s → 数帧内自然归零 → 光圈/速度线/HUD 槽位全部同步熄灭。
func _tick_expire() -> void:
	var rel: int = _rb_rel()
	if rel == 1:
		_player.magnet_timer = 0.02
		_player.dash_timer = 0.02
	elif rel >= 5:
		var fx_off: bool = _player_fx != null and not _player_fx.ring_active \
			and not _player_fx.lines_active and not _player_fx.visible
		var gain_off: bool = not _player.is_dashing() and _player.magnet_timer == 0.0
		_flags["powerup_expire_synced"] = fx_off and gain_off \
			and not _main.hud.is_powerup_lit(&"magnet") \
			and not _main.hud.is_powerup_lit(&"dash")
		_settle_coins_at_end = GameState.coins
		_player.global_position.y = GameState.GROUND_LINE_Y \
			+ GameState.tuning_value(&"deathFallPx") + 20.0
		_enter_rb_step(RbStep.PIT_DEATH)


## 护盾/冲刺裁决 + 冲刺速度倍增 + 真实碾怪计分（acc-04）。滑铲中执行，冲刺无敌罩住后续暴露帧。
func _tick_verdicts() -> void:
	var rel: int = _rb_rel()
	if rel == 1:
		_player.apply_powerup(Player.POWERUP_SHIELD)
		var verdict: StringName = _player.hit_hazard()
		_flags["shield_blocked_hazard"] = verdict == &"shield_break" \
			and _player.active and _player.hurt_invincible_timer > 0.0
		_player.hurt_invincible_timer = 0.0
		_player.apply_powerup(Player.POWERUP_DASH)
		_dash_score_before = GameState.score
	elif rel == 3:
		_flags["dash_speed_up"] = absf(_player.velocity.x - GameState.speed_for_distance(
			GameState.distance_m) * GameState.tuning_value(&"dashSpeedMultiplier")) < 1.0
		# 真实障碍压到玩家身上 → 下一物理帧 body_entered → hit_hazard → smash → +30。
		var obstacle: ObstacleGround = (load("res://scenes/obstacle_ground.tscn") as PackedScene).instantiate()
		obstacle.position = _player.global_position + Vector2(10, 0)
		_main.add_child(obstacle)
	elif rel > 8:
		# 冲刺生效期证据在特效/HUD 层（idle 帧驱动）至少走一帧后再采（避免同帧假阴性）。
		_flags["dash_trail_on"] = _player_fx != null and _player_fx.lines_active
		_flags["dash_hud_lit"] = _main.hud.is_powerup_lit(&"dash")
		if GameState.score >= _dash_score_before + GameState.tuning_value(&"scorePerObstacleSmash"):
			_flags["dash_smashed_obstacle"] = true
		else:
			_failures.append("冲刺碾怪未得分：score %d → %d（预期 +%d）" % [
				_dash_score_before, GameState.score,
				int(GameState.tuning_value(&"scorePerObstacleSmash")),
			])
		_enter_rb_step(RbStep.SLIDE_END)


## 坠坑死亡 → run_ended → 结算页展示（acc-05 金币账实一致）。
func _tick_pit_death() -> void:
	if _rb_rel() > 10:
		_failures.append("坠坑判定未触发死亡（deathFallPx 判定失效）")
		_enter_phase(Phase.FINAL)


func _cleanup_test_coin() -> void:
	if _test_coin != null and is_instance_valid(_test_coin):
		_test_coin.queue_free()
	_test_coin = null
	if _test_pickup != null and is_instance_valid(_test_pickup):
		_test_pickup.queue_free()
	_test_pickup = null


func _run_contracts() -> void:
	if _player != null:
		# 契约需要活体玩家：放回出生点再复位（坠坑局结束时玩家还在坑底）。
		_player.global_position = _main.PLAYER_SPAWN
		_player.reset_for_run()
		# 坠坑死因断言（此刻 died 级联已结束，死因就绪）。
		if _death_cause != &"fall":
			_failures.append("坠坑死因应为 fall，实际 %s" % _death_cause)
	for failure: String in TuningContract.run():
		_failures.append("tuning_contract：%s" % failure)
	for failure: String in SaveContract.run():
		_failures.append("save_contract：%s" % failure)
	for failure: String in InputContract.run(_main):
		_failures.append("input_contract：%s" % failure)
	for failure: String in TrackPassabilityContract.run():
		_failures.append("passability_contract：%s" % failure)
	for failure: String in ScoreSettleContract.run(_flags):
		_failures.append("score_settle_contract：%s" % failure)
	for failure: String in PlayerMoveContract.run({"player": _player, "flags": _flags}):
		_failures.append("player_move_contract：%s" % failure)
	for failure: String in PowerupContract.run({"player": _player, "flags": _flags}):
		_failures.append("powerup_contract：%s" % failure)
	for failure: String in PowerupPoolContract.run({"root": _main}):
		_failures.append("powerup_pool_contract：%s" % failure)
	for failure: String in FeedbackContract.run({"flags": _flags, "hud": _main.hud, "root": _main}):
		_failures.append("feedback_contract：%s" % failure)
	for failure: String in InputLatencyContract.run(_flags):
		_failures.append("input_latency_contract：%s" % failure)
	_signal_report_asserts()
	_phase = Phase.DONE
	_report()


## ── 输入注入：释放→按下→自动完成（按下跨帧，just_pressed 边沿可读）──
func _stage_action(action: StringName) -> void:
	_inject_queue.append({"action": action, "stage": 0})


func _tick_injection() -> void:
	for item: Dictionary in _inject_queue:
		var stage: int = item["stage"]
		if stage == 0:
			_inject_raw(StringName(item["action"]), false)
			item["stage"] = 1
		elif stage == 1:
			_inject_raw(StringName(item["action"]), true)
			item["stage"] = 2
			# 延迟计量从「按下事件真正解析」这一帧起算（acc-08 量的是角色响应，
			# 不含测试暂存队列的开销）。
			if _await_jump_parse and StringName(item["action"]) == &"jump":
				_rb_jump_inject_frame = _frames
				_await_jump_parse = false
	_inject_queue = _inject_queue.filter(func(item: Dictionary) -> bool: return int(item["stage"]) < 2)


func _inject_raw(action: StringName, pressed: bool) -> void:
	var event := InputEventAction.new()
	event.action = action
	event.pressed = pressed
	Input.parse_input_event(event)

## ── 噪声相位：确定种子随机事件（原始事件，模板同源）──
var _noise_rng := RandomNumberGenerator.new()


func _inject_noise_frame() -> void:
	if _frames == 1:
		_noise_rng.seed = 20260913  # 门禁要求可复现：同种子同事件序
	var roll := _noise_rng.randf()
	var pos := Vector2(_noise_rng.randf_range(0, 960), _noise_rng.randf_range(0, 540))
	if roll < 0.30:
		var t := InputEventScreenTouch.new()
		t.index = _noise_rng.randi_range(0, 1)
		t.position = pos
		t.pressed = true
		Input.parse_input_event(t)
	elif roll < 0.45:
		var t2 := InputEventScreenTouch.new()
		t2.index = _noise_rng.randi_range(0, 1)
		t2.position = pos
		t2.pressed = false
		Input.parse_input_event(t2)
	elif roll < 0.60:
		var d := InputEventScreenDrag.new()
		d.index = _noise_rng.randi_range(0, 1)
		d.position = pos
		d.relative = Vector2(_noise_rng.randf_range(-40, 40), _noise_rng.randf_range(-40, 40))
		Input.parse_input_event(d)
	elif roll < 0.80:
		var mb := InputEventMouseButton.new()
		mb.button_index = MOUSE_BUTTON_LEFT
		mb.position = pos
		mb.pressed = _noise_rng.randf() < 0.5
		Input.parse_input_event(mb)
	else:
		var k := InputEventKey.new()
		k.physical_keycode = [KEY_A, KEY_D, KEY_W, KEY_S, KEY_SPACE, KEY_ENTER][_noise_rng.randi_range(0, 5)]
		k.pressed = _noise_rng.randf() < 0.5
		Input.parse_input_event(k)


## ── 信号到达断言与逐局判据 ──
func _on_player_moved(_position: Vector2) -> void:
	_moved_seen = true


func _on_player_died(cause: StringName) -> void:
	_death_seen = true
	_death_cause = cause
	print("[smoke-dbg] died cause=%s f=%d step=%s x=%.0f y=%.0f dash=%.2f shield=%d mag=%.2f slide=%.2f" % [
		cause, _frames, RbStep.keys()[_rb_step], _player.global_position.x,
		_player.global_position.y, _player.dash_timer, _player.shield_charges,
		_player.magnet_timer, _player.slide_timer,
	])


func _on_score_changed(_score: int) -> void:
	_score_seen = true


func _on_coins_changed(_coins: int) -> void:
	_coins_seen = true


func _on_run_ended(win: bool, _score: int, coins: int, distance_m: float) -> void:
	_run_ended_seen = true
	match _phase:
		Phase.RUN_A:
			if win:
				_failures.append("负向局（未输入）被判胜：障碍碰撞未触发死亡")
			if coins != 0:
				_failures.append("负向局死亡时金币应为 0（首障在金币前），实际 %d" % coins)
			if GameState.score <= 0:
				_failures.append("负向局死亡时得分应 > 0（距离分），实际 %d" % GameState.score)
			if distance_m <= 0.0:
				_failures.append("负向局死亡时距离应 > 0，实际 %.1f" % distance_m)
			_enter_phase(Phase.BETWEEN)
		Phase.RUN_B:
			if _rb_step == RbStep.PIT_DEATH:
				# 死因断言放 FINAL（died 处理器在 run_ended 级联之后才更新死因）。
				if coins != _settle_coins_at_end:
					_failures.append("结算金币 %d ≠ 本局实际拾取 %d（acc-05 账实不一致）" % [
						coins, _settle_coins_at_end,
					])
				else:
					_flags["settle_coins_match"] = true
				if not _main.settle_panel.visible:
					_failures.append("run_ended 后结算页未展示")
				_enter_phase(Phase.FINAL)


func _signal_report_asserts() -> void:
	if not _moved_seen:
		_failures.append("信号 Player.moved 未到达订阅方：连接断裂或从未 emit")
	if not _score_seen:
		_failures.append("信号 GameState.score_changed 未到达订阅方")
	if not _coins_seen:
		_failures.append("信号 GameState.coins_changed 未到达订阅方")
	if not _run_ended_seen:
		_failures.append("信号 GameState.run_ended 未到达订阅方（胜负判定从未发生）")
	if not _death_seen:
		_failures.append("信号 Player.died 未到达订阅方（死亡链路断裂）")


func _report() -> void:
	if _reported:
		return
	_reported = true
	if _failures.is_empty():
		print("GODOT_SMOKE: PASS 噪声抗性/自动奔跑/撞怪判负/重开清零/跳跃越障/输入延迟%d帧/滑铲%d帧/二段跳封顶/磁铁吸附+拾取反馈/护盾/冲刺碾怪+拖尾/归零同步熄灭/坠坑结算/10契约 全部通过" % [
			int(_flags["jump_latency_frames"]), int(_flags["slide_measured_frames"]),
		])
		get_tree().quit(0)
	else:
		for failure in _failures:
			printerr("GODOT_SMOKE: FAIL %s" % failure)
		get_tree().quit(1)
