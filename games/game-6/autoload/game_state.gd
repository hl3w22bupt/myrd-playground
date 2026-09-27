extends Node
## 自动加载单例（autoload）：跑酷单局的全局状态 + 数值调参区。
##
## 注册方式：project.godot 的 [autoload] 段写 `GameState="*res://autoload/game_state.gd"`。
## 规范（见技能包 SKILL.md「GDScript 规范」）：
## - autoload 只放「状态 + 纯逻辑」，不放场景/节点引用；
## - 场景层订阅信号刷新 UI，而不是主动轮询；
## - 数值键名与 .myrd/spec/design-spec.json 的 spec.numeric（39 键）一一对应（策划案 §三），
##   改数值 = 先改策划案（revisions 新版本）再同步这里，禁止两头各改各的。
## - apply_tuning() 是调参唯一入口（acc-09）：只认 TUNING_META 声明的键、按 min/max 钳制。

## ── 信号（发布方只 emit，订阅方在场景 _ready 里集中连接）──
## 得分变化（距离分 + 金币分 + 碾怪分重算后触发）。
signal score_changed(score: int)
## 金币数变化。
signal coins_changed(coins: int)
## 单局结束（win 恒为 false：跑酷无尽模式，死亡即结算）。
signal run_ended(win: bool, score: int, coins: int, distance_m: float)
## 道具状态变化（kind: magnet/shield/dash；remaining_seconds < 0 表示非限时道具）。
signal powerup_changed(kind: StringName, remaining_seconds: float)
## 结果性反馈事件（拾取/碾怪/死亡/破盾），HUD 飘字与音效挂点订阅。
signal feedback(kind: StringName, position: Vector2)

## ── 数值调参区（键名 = spec.numeric，注释行尾对照 min/max/step 见 TUNING_META）──
const PIXELS_PER_METER: float = 40.0                      # pixelsPerMeter
const CHUNK_WIDTH_PX: float = 1280.0                      # chunkWidthPx
const CHUNK_SAFETY_MARGIN_PX: float = 96.0                # chunkSafetyMarginPx
const RUN_SPEED_BASE_PX_PER_SEC: float = 320.0            # runSpeedBasePxPerSec
const RUN_SPEED_GAIN_PER_METER: float = 0.3               # runSpeedGainPerMeter
const RUN_SPEED_MAX_PX_PER_SEC: float = 720.0             # runSpeedMaxPxPerSec
const GRAVITY_PX_PER_SEC2: float = 2400.0                 # gravityPxPerSec2
const JUMP_VELOCITY_PX_PER_SEC: float = -900.0            # jumpVelocityPxPerSec
const DOUBLE_JUMP_VELOCITY_PX_PER_SEC: float = -820.0     # doubleJumpVelocityPxPerSec
const COYOTE_TIME_SECONDS: float = 0.08                   # coyoteTimeSeconds
const JUMP_BUFFER_SECONDS: float = 0.1                    # jumpBufferSeconds
const SLIDE_DURATION_SECONDS: float = 0.6                 # slideDurationSeconds
const HITBOX_STAND_WIDTH_PX: float = 44.0                 # hitboxStandWidthPx
const HITBOX_STAND_HEIGHT_PX: float = 64.0                # hitboxStandHeightPx
const HITBOX_SLIDE_HEIGHT_PX: float = 36.0                # hitboxSlideHeightPx
const PIT_WIDTH_MIN_PX: float = 96.0                      # pitWidthMinPx
const PIT_WIDTH_MAX_PX: float = 192.0                     # pitWidthMaxPx
const PIT_LANDING_BUFFER_PX: float = 128.0                # pitLandingBufferPx
const REACTION_GAP_MIN_PX: float = 224.0                  # reactionGapMinPx
const COIN_VALUE: int = 1                                 # coinValue
const SCORE_PER_METER: int = 2                            # scorePerMeter
const SCORE_PER_COIN: int = 10                            # scorePerCoin
const SCORE_PER_OBSTACLE_SMASH: int = 30                  # scorePerObstacleSmash
const MAGNET_DURATION_SECONDS: float = 8.0                # magnetDurationSeconds
const MAGNET_RADIUS_PX: float = 200.0                     # magnetRadiusPx
const SHIELD_CHARGES: int = 1                             # shieldCharges
const HURT_INVINCIBLE_SECONDS: float = 1.0                # hurtInvincibleSeconds
const DASH_DURATION_SECONDS: float = 4.0                  # dashDurationSeconds
const DASH_SPEED_MULTIPLIER: float = 1.8                  # dashSpeedMultiplier
const POWERUP_BOX_COOLDOWN_CHUNKS: int = 1                # powerupBoxCooldownChunks
const DEATH_FALL_PX: float = 200.0                        # deathFallPx
const DEATH_SLOW_MOTION_SECONDS: float = 0.3              # deathSlowMotionSeconds
const INPUT_LATENCY_BUDGET_FRAMES: int = 3                # inputLatencyBudgetFrames
const FPS_TARGET: int = 60                                # fpsTarget
const FPS_FLOOR: int = 30                                 # fpsFloor
const SESSION_TARGET_SECONDS: float = 90.0                # sessionTargetSeconds
const ACCEPTANCE_DISTANCE_METERS: float = 1000.0          # acceptanceDistanceMeters
const PASSABILITY_SAMPLE_SEEDS: int = 10                  # passabilitySampleSeeds
const SAVE_KEY: String = "game6_save_v1"                  # saveKey

## 地面线世界 y（chunk 局部「地面 y=0、向上为正」的换算基准，见策划案 §三坐标约定）。
const GROUND_LINE_Y: float = 300.0

## ── 道具生成配置（迭代需求 ①：磁吸/冲刺必须可感知地进入生成池）──
## 每个道具点按此权重抽种类（可复核口径）：
##   磁铁 0.40 / 冲刺 0.35 / 护盾 0.25 → 单点拿到「磁铁或冲刺」合计 0.75。
##   一局跑 ≥6 个道具点时：至少一次磁铁概率 = 1−0.6^6 ≈ 95%；
##   至少一次磁铁或冲刺概率 = 1−0.25^6 ≈ 99.98%（验收「1~2 局内至少遇到一次」远超满足）。
## 定位说明：这是生成层配置而非手感调参，**不进 TUNING_META**（39 键契约键集保持与
## spec.numeric 一致）；分布由冒烟 powerup_pool_contract 以固定种子机判。
const POWERUP_KIND_WEIGHTS: Dictionary = {
	&"magnet": 0.40,
	&"dash": 0.35,
	&"shield": 0.25,
}


## 按权重表抽一个道具种类（seeded rng 由调用方提供：同种子同序列，冒烟可复现）。
func pick_powerup_kind(rng: RandomNumberGenerator) -> StringName:
	var total: float = 0.0
	for weight: Variant in POWERUP_KIND_WEIGHTS.values():
		total += maxf(float(weight), 0.0)
	if total <= 0.0:
		return &"magnet"
	var roll: float = rng.randf() * total
	for kind: StringName in POWERUP_KIND_WEIGHTS.keys():
		roll -= maxf(float(POWERUP_KIND_WEIGHTS[kind]), 0.0)
		if roll <= 0.0:
			return kind
	return &"magnet"

## TUNING_META：可调数值键 → {min, max, step}（acc-09 契约断言键集与 spec.numeric 一致；
## saveKey 为字符串存档键，不参与数值钳制，meta 置 0 区间占位以满足键集相等）。
const TUNING_META: Dictionary = {
	&"pixelsPerMeter": {"min": 20.0, "max": 80.0, "step": 5.0},
	&"chunkWidthPx": {"min": 960.0, "max": 1920.0, "step": 64.0},
	&"chunkSafetyMarginPx": {"min": 64.0, "max": 192.0, "step": 16.0},
	&"runSpeedBasePxPerSec": {"min": 240.0, "max": 480.0, "step": 10.0},
	&"runSpeedGainPerMeter": {"min": 0.1, "max": 0.6, "step": 0.05},
	&"runSpeedMaxPxPerSec": {"min": 560.0, "max": 960.0, "step": 20.0},
	&"gravityPxPerSec2": {"min": 1800.0, "max": 3600.0, "step": 100.0},
	&"jumpVelocityPxPerSec": {"min": -1200.0, "max": -700.0, "step": 10.0},
	&"doubleJumpVelocityPxPerSec": {"min": -1100.0, "max": -650.0, "step": 10.0},
	&"coyoteTimeSeconds": {"min": 0.0, "max": 0.2, "step": 0.01},
	&"jumpBufferSeconds": {"min": 0.0, "max": 0.25, "step": 0.01},
	&"slideDurationSeconds": {"min": 0.3, "max": 1.2, "step": 0.05},
	&"hitboxStandWidthPx": {"min": 32.0, "max": 64.0, "step": 2.0},
	&"hitboxStandHeightPx": {"min": 48.0, "max": 96.0, "step": 2.0},
	&"hitboxSlideHeightPx": {"min": 24.0, "max": 48.0, "step": 2.0},
	&"pitWidthMinPx": {"min": 64.0, "max": 128.0, "step": 8.0},
	&"pitWidthMaxPx": {"min": 128.0, "max": 256.0, "step": 8.0},
	&"pitLandingBufferPx": {"min": 64.0, "max": 192.0, "step": 8.0},
	&"reactionGapMinPx": {"min": 160.0, "max": 320.0, "step": 8.0},
	&"coinValue": {"min": 1.0, "max": 5.0, "step": 1.0},
	&"scorePerMeter": {"min": 1.0, "max": 5.0, "step": 1.0},
	&"scorePerCoin": {"min": 5.0, "max": 20.0, "step": 1.0},
	&"scorePerObstacleSmash": {"min": 10.0, "max": 60.0, "step": 5.0},
	&"magnetDurationSeconds": {"min": 4.0, "max": 16.0, "step": 1.0},
	&"magnetRadiusPx": {"min": 120.0, "max": 320.0, "step": 10.0},
	&"shieldCharges": {"min": 1.0, "max": 3.0, "step": 1.0},
	&"hurtInvincibleSeconds": {"min": 0.5, "max": 2.0, "step": 0.1},
	&"dashDurationSeconds": {"min": 2.0, "max": 8.0, "step": 0.5},
	&"dashSpeedMultiplier": {"min": 1.2, "max": 2.5, "step": 0.1},
	&"powerupBoxCooldownChunks": {"min": 1.0, "max": 4.0, "step": 1.0},
	&"deathFallPx": {"min": 100.0, "max": 400.0, "step": 20.0},
	&"deathSlowMotionSeconds": {"min": 0.0, "max": 1.0, "step": 0.1},
	&"inputLatencyBudgetFrames": {"min": 2.0, "max": 6.0, "step": 1.0},
	&"fpsTarget": {"min": 30.0, "max": 120.0, "step": 10.0},
	&"fpsFloor": {"min": 24.0, "max": 60.0, "step": 6.0},
	&"sessionTargetSeconds": {"min": 60.0, "max": 180.0, "step": 10.0},
	&"acceptanceDistanceMeters": {"min": 500.0, "max": 2000.0, "step": 100.0},
	&"passabilitySampleSeeds": {"min": 3.0, "max": 20.0, "step": 1.0},
	&"saveKey": {"min": 0.0, "max": 0.0, "step": 0.0},
}

## 可调数值的运行时副本（消费方只读这里；默认 = spec.numeric 定稿值）。
var tuning: Dictionary = {
	&"pixelsPerMeter": PIXELS_PER_METER,
	&"chunkWidthPx": CHUNK_WIDTH_PX,
	&"chunkSafetyMarginPx": CHUNK_SAFETY_MARGIN_PX,
	&"runSpeedBasePxPerSec": RUN_SPEED_BASE_PX_PER_SEC,
	&"runSpeedGainPerMeter": RUN_SPEED_GAIN_PER_METER,
	&"runSpeedMaxPxPerSec": RUN_SPEED_MAX_PX_PER_SEC,
	&"gravityPxPerSec2": GRAVITY_PX_PER_SEC2,
	&"jumpVelocityPxPerSec": JUMP_VELOCITY_PX_PER_SEC,
	&"doubleJumpVelocityPxPerSec": DOUBLE_JUMP_VELOCITY_PX_PER_SEC,
	&"coyoteTimeSeconds": COYOTE_TIME_SECONDS,
	&"jumpBufferSeconds": JUMP_BUFFER_SECONDS,
	&"slideDurationSeconds": SLIDE_DURATION_SECONDS,
	&"hitboxStandWidthPx": HITBOX_STAND_WIDTH_PX,
	&"hitboxStandHeightPx": HITBOX_STAND_HEIGHT_PX,
	&"hitboxSlideHeightPx": HITBOX_SLIDE_HEIGHT_PX,
	&"pitWidthMinPx": PIT_WIDTH_MIN_PX,
	&"pitWidthMaxPx": PIT_WIDTH_MAX_PX,
	&"pitLandingBufferPx": PIT_LANDING_BUFFER_PX,
	&"reactionGapMinPx": REACTION_GAP_MIN_PX,
	&"coinValue": COIN_VALUE,
	&"scorePerMeter": SCORE_PER_METER,
	&"scorePerCoin": SCORE_PER_COIN,
	&"scorePerObstacleSmash": SCORE_PER_OBSTACLE_SMASH,
	&"magnetDurationSeconds": MAGNET_DURATION_SECONDS,
	&"magnetRadiusPx": MAGNET_RADIUS_PX,
	&"shieldCharges": SHIELD_CHARGES,
	&"hurtInvincibleSeconds": HURT_INVINCIBLE_SECONDS,
	&"dashDurationSeconds": DASH_DURATION_SECONDS,
	&"dashSpeedMultiplier": DASH_SPEED_MULTIPLIER,
	&"powerupBoxCooldownChunks": POWERUP_BOX_COOLDOWN_CHUNKS,
	&"deathFallPx": DEATH_FALL_PX,
	&"deathSlowMotionSeconds": DEATH_SLOW_MOTION_SECONDS,
	&"inputLatencyBudgetFrames": INPUT_LATENCY_BUDGET_FRAMES,
	&"fpsTarget": FPS_TARGET,
	&"fpsFloor": FPS_FLOOR,
	&"sessionTargetSeconds": SESSION_TARGET_SECONDS,
	&"acceptanceDistanceMeters": ACCEPTANCE_DISTANCE_METERS,
	&"passabilitySampleSeeds": PASSABILITY_SAMPLE_SEEDS,
	&"saveKey": SAVE_KEY,
}

## ── 单局状态 ──
var score: int = 0
var coins: int = 0
var smashes: int = 0
var distance_m: float = 0.0
var run_active: bool = false
## 历史最高分 / 累计金币 / 最远距离（本地持久化，跨会话保留，acc-06）。
var best_score: int = 0
var total_coins: int = 0
var best_distance_m: float = 0.0


func _ready() -> void:
	_apply_web_shell_tuning()
	load_progress()


## ── Web 壳调参桥（工坊 §3C 硬契约的游戏侧接线）──
## 壳页面在引擎加载前把 URL 参数 tuning 解析进 window.__GAME_TUNING__；
## 这里在启动时读取并经 apply_tuning 应用（只认 TUNING_META 声明的键、按 min/max 钳制），
## 使「试玩调好的参数可用 URL 复现」。仅 Web 平台生效；动态取单例，
## 桌面/无头环境零引用零开销；解析失败静默回落 spec 默认值，绝不阻塞启动。
func _apply_web_shell_tuning() -> void:
	if OS.get_name() != "Web":
		return
	if not Engine.has_singleton("JavaScriptBridge"):
		return
	var js_bridge: Object = Engine.get_singleton("JavaScriptBridge")
	var raw: Variant = js_bridge.eval("JSON.stringify(window.__GAME_TUNING__ || null)", true)
	var raw_text := String(raw)
	if raw_text.is_empty() or raw_text == "null" or raw_text == "undefined":
		return
	var parsed: Variant = JSON.parse_string(raw_text)
	if typeof(parsed) != TYPE_DICTIONARY:
		return
	apply_tuning(parsed)


## ── 调参协议（acc-09 唯一应用入口）──
## 只应用 TUNING_META 声明的键；数值按 min/max 钳制；saveKey 走字符串赋值不钳制。
## 返回实际生效的键名列表（未声明键被拒绝，不出现在返回值里）。
func apply_tuning(values: Dictionary) -> Array[StringName]:
	var applied: Array[StringName] = []
	for key: Variant in values.keys():
		var key_name := StringName(String(key))
		if not TUNING_META.has(key_name):
			continue
		var meta: Dictionary = TUNING_META[key_name]
		if key_name == &"saveKey":
			tuning[key_name] = String(values[key])
			applied.append(key_name)
			continue
		var value := clampf(float(values[key]), float(meta["min"]), float(meta["max"]))
		tuning[key_name] = value
		applied.append(key_name)
	return applied


func tuning_value(key: StringName) -> float:
	return float(tuning.get(key, 0.0))


## ── 派生数值（消费方经这里读，禁止散落魔数）──
## 速度曲线：v(m) = clamp(base + gain × m, base, max)（慢起步长尾加速，策划案 §3.1）。
func speed_for_distance(distance: float) -> float:
	var raw: float = tuning_value(&"runSpeedBasePxPerSec") \
		+ tuning_value(&"runSpeedGainPerMeter") * maxf(distance, 0.0)
	return clampf(raw, tuning_value(&"runSpeedBasePxPerSec"), tuning_value(&"runSpeedMaxPxPerSec"))


## 得分公式：⌊距离 m⌋×2 + 金币×10 + 碾怪×30（策划案 §3.4）。
func _recalculate_score() -> void:
	var next_score: int = int(distance_m) * int(tuning_value(&"scorePerMeter")) \
		+ coins * int(tuning_value(&"scorePerCoin")) \
		+ smashes * int(tuning_value(&"scorePerObstacleSmash"))
	if next_score != score:
		score = next_score
		score_changed.emit(score)


## chunk 抽取权重（策划案 §四）：
## l1 = clamp(1.0 − d/1000, 0.55, 1.0)；l2 = clamp((d−300)/700, 0, 1)×0.8；l3 = clamp((d−1200)/800, 0, 1)。
func chunk_weights_for_distance(distance: float) -> Dictionary:
	var l1: float = clampf(1.0 - distance / 1000.0, 0.55, 1.0)
	var l2: float = clampf((distance - 300.0) / 700.0, 0.0, 1.0) * 0.8
	var l3: float = clampf((distance - 1200.0) / 800.0, 0.0, 1.0)
	return {&"l1": l1, &"l2": l2, &"l3": l3}


## ── 单局流程 ──
## 单局开始：清零计数并置运行态（由主场景 restart_run() 调用）。
func start_run() -> void:
	score = 0
	coins = 0
	smashes = 0
	distance_m = 0.0
	run_active = true
	score_changed.emit(score)
	coins_changed.emit(coins)


## 单局结束：幂等（重复调用只结算一次），刷新三项存档并持久化。
func end_run(win: bool) -> void:
	if not run_active:
		return
	run_active = false
	var dirty: bool = false
	if score > best_score:
		best_score = score
		dirty = true
	if distance_m > best_distance_m:
		best_distance_m = distance_m
		dirty = true
	if dirty:
		save_progress()
	run_ended.emit(win, score, coins, distance_m)


## 拾取一枚金币：计数 + 加分 + 累计金币（acc-05：结算页金币数与本局实际拾取数同源）。
func add_coin() -> void:
	if not run_active:
		return
	coins += int(tuning_value(&"coinValue"))
	total_coins += int(tuning_value(&"coinValue"))
	coins_changed.emit(coins)
	_recalculate_score()


## 冲刺碾毁一个障碍：碾怪计数 + 加分。
func add_smash() -> void:
	if not run_active:
		return
	smashes += 1
	_recalculate_score()


## 距离推进（主场景随玩家位移刷新）。
func set_distance(meters: float) -> void:
	if meters > distance_m:
		distance_m = meters
		_recalculate_score()


## 结果性反馈（拾取/碾怪/破盾/死亡）：HUD 飘字与音效的唯一入口。
func emit_feedback(kind: StringName, position: Vector2) -> void:
	feedback.emit(kind, position)


## ── 本地持久化（bestScore/totalCoins/bestDistance → user://<saveKey>.cfg，headless 亦可写）──
func save_progress() -> bool:
	var config := ConfigFile.new()
	config.set_value("save", "best_score", best_score)
	config.set_value("save", "total_coins", total_coins)
	config.set_value("save", "best_distance_m", best_distance_m)
	return config.save("user://%s.cfg" % SAVE_KEY) == OK


func load_progress() -> void:
	var config := ConfigFile.new()
	if config.load("user://%s.cfg" % SAVE_KEY) == OK:
		best_score = int(config.get_value("save", "best_score", 0))
		total_coins = int(config.get_value("save", "total_coins", 0))
		best_distance_m = float(config.get_value("save", "best_distance_m", 0.0))
