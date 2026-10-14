extends Node
## 《牛牛打游戏》全局状态单例（autoload）：收集进度 / 限时胜负 / 波次节奏 / Combo / 本地持久化。
##
## 注册方式：project.godot 的 [autoload] 段写 `GameState="*res://autoload/game_state.gd"`。
## 规范要点（见 SKILL.md「GDScript 规范」）：
## - autoload 只放「状态 + 纯逻辑」，不持有任何场景节点；
## - 对外只发信号（score_changed / time_changed / phase_changed / best_changed /
##   combo_changed / wave_changed），场景层（main.gd）订阅它们刷新 UI，禁止反向轮询 UI；
## - 数值调参集中在下方「数值调参区」（变量 + TUNING_META 成对声明），
##   改数值 = 改这里，不改玩法代码；v3 全部新增数值同样走声明键。
## v3（需求 cmv6vkith000gjotytp4v915c）：玩法多样化（≥3 类目标物 / ≥2 道具 / Combo /
## ≥3 波次）+ v2 手感基线保留（PLAYER_SCALE=1.4 / PLAYER_SPEED=145）。

## 单局阶段：进行中 / 通关 / 失败 / 待开始（开始面板）/ 暂停。
## 追加阶段只能放在枚举尾部：tests/smoke.gd 的 _phase_label 按下标 0..2 取名。
enum Phase { RUNNING, WON, LOST, READY, PAUSED }

## ── 目标物类型表（v3 玩法多样化①：≥3 种、分值/效果各不相同）──
## normal 青草垛 +1 · rare 金铃铛 +3（低权重高分）· clock 时钟 +2 且加时。
## magnet / boost 是道具（分值 0，拾取触发效果，见 player.gd）。
const KIND_NORMAL: String = "normal"
const KIND_RARE: String = "rare"
const KIND_CLOCK: String = "clock"
const KIND_MAGNET: String = "magnet"
const KIND_BOOST: String = "boost"
## 计分口径（唯一来源）：触碰得分 = 类型分值 + Combo 加成（gain_for）。
const ITEM_SCORES: Dictionary = {
	KIND_NORMAL: 1,
	KIND_RARE: 3,
	KIND_CLOCK: 2,
	KIND_MAGNET: 0,
	KIND_BOOST: 0,
}
## 波次类型权重（v3 玩法多样化④：每波刷出强度参数化；逐波合计恒为 1.0）。
## 越往后高分稀有物与道具占比越高 —— 用「值得追」补偿「越来越快」。
const WAVE_WEIGHTS: Array[Dictionary] = [
	{KIND_NORMAL: 0.80, KIND_RARE: 0.10, KIND_CLOCK: 0.05, KIND_MAGNET: 0.025, KIND_BOOST: 0.025},
	{KIND_NORMAL: 0.68, KIND_RARE: 0.17, KIND_CLOCK: 0.08, KIND_MAGNET: 0.035, KIND_BOOST: 0.035},
	{KIND_NORMAL: 0.55, KIND_RARE: 0.25, KIND_CLOCK: 0.10, KIND_MAGNET: 0.05, KIND_BOOST: 0.05},
]

## ── 数值调参区（SKILL.md §3C 调参工作台）──
## 可调数值 = 变量（默认值 = 需求基线）+ TUNING_META（min/max/step）成对声明。
## apply_tuning() 是唯一应用入口：只认 META 声明的键、按范围钳制、返回生效键列表；
## Web 端启动时 _apply_web_tuning() 读壳页面调参桥（window.__GAME_TUNING__）覆盖默认值。
const TUNING_META: Dictionary = {
	"TARGET_SCORE": {"min": 5.0, "max": 60.0, "step": 1.0},
	"TIME_LIMIT": {"min": 15.0, "max": 180.0, "step": 5.0},
	"MAX_COLLECTIBLES": {"min": 1.0, "max": 20.0, "step": 1.0},
	"SPAWN_INTERVAL_START": {"min": 0.3, "max": 3.0, "step": 0.05},
	"SPAWN_INTERVAL_MIN": {"min": 0.2, "max": 2.0, "step": 0.05},
	"LIFETIME_START": {"min": 2.0, "max": 15.0, "step": 0.5},
	"LIFETIME_MIN": {"min": 1.0, "max": 10.0, "step": 0.5},
	"PLAYER_SCALE": {"min": 0.5, "max": 2.0, "step": 0.05},
	"PLAYER_SPEED": {"min": 60.0, "max": 300.0, "step": 5.0},
	"COMBO_WINDOW": {"min": 0.5, "max": 5.0, "step": 0.1},
	"COMBO_BONUS_MAX": {"min": 0.0, "max": 10.0, "step": 1.0},
	"TIME_BONUS_CLOCK": {"min": 0.0, "max": 10.0, "step": 0.5},
	"MAGNET_RADIUS": {"min": 60.0, "max": 200.0, "step": 5.0},
	"MAGNET_DURATION": {"min": 1.0, "max": 10.0, "step": 0.5},
	"BOOST_MULT": {"min": 1.1, "max": 2.5, "step": 0.05},
	"BOOST_DURATION": {"min": 1.0, "max": 10.0, "step": 0.5},
	"WAVE_BREAK_SECONDS": {"min": 0.0, "max": 3.0, "step": 0.1},
}
## 单局目标分数（通关硬线：score 达标即通关；v3 起口径为「分数」而非「件数」）。
var TARGET_SCORE: int = 20
## 单局时限秒数（需求验收基线 3：限时 60 秒）。
var TIME_LIMIT: float = 60.0
## 场上同屏可收集物上限（少于该数时由生成器补充）。
var MAX_COLLECTIBLES: int = 6
## 刷新间隔锚点：第 1 波起点（开局值）；难度曲线沿波次向第 3 波终点（下限值）收紧。
var SPAWN_INTERVAL_START: float = 0.8
## 刷新间隔下限（第 3 波终点的值，难度封顶，保证后期仍可读、可反应）。
var SPAWN_INTERVAL_MIN: float = 0.45
## 物品寿命锚点：第 1 波起点（开局值，秒）。
var LIFETIME_START: float = 6.0
## 物品寿命下限（第 3 波终点的值，秒）。
var LIFETIME_MIN: float = 3.0
## 牛牛体型倍率（v2 手感基线，需求 cmuqmej89000ym9gg6mom93o0）：视觉精灵与碰撞体
##（含 PickupArea 判定体）整体同步放大，在 1.3~1.5 区间内取 1.4 落账。
var PLAYER_SCALE: float = 1.4
## 牛牛移动速度 px/s（v2 手感基线）：v1 默认 220 的 65.9%，落在需求的 60~70% 区间。
var PLAYER_SPEED: float = 145.0
## Combo 连击窗口（秒）：窗口内连续收集 combo 递增，超时清零（v3 玩法多样化③）。
var COMBO_WINDOW: float = 2.0
## Combo 加成封顶（分）：连击加成 = min(combo-1, COMBO_BONUS_MAX)，防后期分数爆炸。
var COMBO_BONUS_MAX: int = 5
## 时钟道具加时（秒）：拾取 clock 立即回填时限（上限钳到 TIME_LIMIT）。
var TIME_BONUS_CLOCK: float = 4.0
## 磁铁吸附半径（px）：生效期间该范围内的计分物被吸向牛牛。
var MAGNET_RADIUS: float = 100.0
## 磁铁持续时间（秒）。
var MAGNET_DURATION: float = 5.0
## 加速倍率：boost 生效期间实际移速 = PLAYER_SPEED × BOOST_MULT。
var BOOST_MULT: float = 1.5
## 加速持续时间（秒）。
var BOOST_DURATION: float = 4.0
## 波间停顿（秒）：跨波时生成器暂停、横幅提示，停顿结束自动恢复（v3 波次化④）。
var WAVE_BREAK_SECONDS: float = 1.2
## 物品临期闪烁警示的剩余寿命阈值（秒）。
const LIFETIME_WARN_SECONDS: float = 1.5
## 持久化文件（历史最高分 / 累计收集数 / 历史最高连击）。
const SAVE_PATH: String = "user://niuniu_game8_save.json"

## 本局阶段（初始为 READY：显示开始面板，按确认/点击开始进入 RUNNING）。
var phase: int = Phase.READY
## 本局分数（分数口径：普通 +1 / 稀有 +3 / 时钟 +2，另计 Combo 加成）。
var score: int = 0
## 本局剩余时间（秒）。
var time_left: float = TIME_LIMIT
## 历史最高单局分数（持久化）。
var best_score: int = 0
## 累计收集件数（持久化，跨局累加；按「件」不按「分」）。
var total_collected: int = 0
## 历史最高连击（持久化，v3 新增档案字段）。
var best_combo: int = 0
## 当前连击数（窗口内递增，超时或重开清零）。
var combo_count: int = 0
## Combo 剩余窗口（秒）；>0 表示连击链仍活着。
var combo_timer: float = 0.0
## 本局最高连击（结算时与 best_combo 比较）。
var run_max_combo: int = 0
## 当前波次下标（0..2）；跨波时发 wave_changed（场景层接管波间停顿）。
var wave_index: int = 0

## 收集得分变化：场景层订阅它刷新 HUD 计数。
signal score_changed(score: int)
## 剩余时间变化：场景层订阅它刷新倒计时。
signal time_changed(time_left: float)
## 胜负阶段变化：场景层订阅它弹出/收起结算面板。
signal phase_changed(phase: int)
## 历史最佳变化：场景层订阅它刷新最佳成绩展示。
signal best_changed(best: int)
## 连击变化（含清零）：场景层订阅它刷新连击 UI。
signal combo_changed(combo: int)
## 波次推进：场景层订阅它做波间停顿与横幅提示。
signal wave_changed(wave: int)


func _ready() -> void:
	load_progress()
	# 调参桥（SKILL.md §3C）：Web 端读壳页面在引擎加载前写入的 window.__GAME_TUNING__。
	# 桌面/无头环境无此桥，函数内部直接返回 —— 冒烟断言始终基于默认值，不受影响。
	_apply_web_tuning()


func _process(delta: float) -> void:
	# Combo 窗口倒计时只在进行中推进；暂停/结算冻结（重开由 start_run 归零）。
	if phase != Phase.RUNNING:
		return
	if combo_timer > 0.0:
		combo_timer = maxf(combo_timer - delta, 0.0)
		if combo_timer <= 0.0 and combo_count > 0:
			combo_count = 0
			combo_changed.emit(0)


## ── 目标物类型与 Combo 的纯函数口径（运行时与 tests/smoke.gd 共用，单一事实源）──

## 类型分值（未知类型按普通物 +1 兜底）。
func item_score_for(kind: String) -> int:
	return int(ITEM_SCORES.get(kind, 1))


## Combo 加成（纯函数）：连击 <2 无加成；≥2 时每级 +1，封顶 COMBO_BONUS_MAX。
func combo_bonus_for(combo: int) -> int:
	if combo < 2:
		return 0
	return mini(combo - 1, COMBO_BONUS_MAX)


## 单次收集的应得分（类型分值 + Combo 加成）——收集路径唯一计分口径。
## 加成只作用于高分物（分值 ≥2 的 rare/clock）：普通物恒 +1，
## 「50 次真实触碰每次恰好 +1」的验收基线（需求 cmujpt1gb007lm99irx1sk17u）
## 在 v3 多类型下原样成立 —— 面包黄油收集保持可预期，连击是高分物的技巧放大器。
func gain_for(kind: String, combo: int) -> int:
	var base := item_score_for(kind)
	if base < 2:
		return base
	return base + combo_bonus_for(combo)


## ── 收集判定计数入口：由场景层在「角色触碰到可收集物」时调用 ──
## 返回本次实际得分（含 Combo 加成）；非进行中阶段忽略并返回 0。
## clock 类型附加回填时限；跨波时推进 wave_index 并发 wave_changed。
func collect_item(kind: String) -> int:
	if phase != Phase.RUNNING:
		return 0
	combo_count = _advance_combo()
	if combo_count > run_max_combo:
		run_max_combo = combo_count
	var gain := gain_for(kind, combo_count)
	score += gain
	total_collected += 1
	if kind == KIND_CLOCK and TIME_BONUS_CLOCK > 0.0:
		time_left = minf(time_left + TIME_BONUS_CLOCK, TIME_LIMIT)
		time_changed.emit(time_left)
	combo_changed.emit(combo_count)
	score_changed.emit(score)
	var wave := wave_index_for(score)
	if wave != wave_index:
		wave_index = wave
		wave_changed.emit(wave)
	if score >= TARGET_SCORE:
		_set_phase(Phase.WON)
	return gain


## Combo 递推：窗口活着则 +1，断链则从 1 重新起算；同时刷新窗口。
func _advance_combo() -> int:
	if combo_timer > 0.0:
		combo_count += 1
	else:
		combo_count = 1
	combo_timer = COMBO_WINDOW
	return combo_count


## ── 波次曲线（v3 玩法多样化④：≥3 波，每波强度参数化、单调有界）──
## 波次按分数切分（默认 20 分 → 三段 0..6 / 7..13 / 14..19，随 TARGET_SCORE 自适应）。
## 每波的刷新间隔/寿命在锚点区间内线性收紧：第 1 波起点 = SPAWN_INTERVAL_START，
## 第 3 波终点 = SPAWN_INTERVAL_MIN —— 与 v1/v2 的锚点断言完全兼容。
const WAVE_INTERVAL_FRAC: Array[float] = [0.0, 0.45, 0.75, 1.0]
const WAVE_LIFETIME_FRAC: Array[float] = [0.0, 0.55, 0.8, 1.0]


## 波次下标（纯函数）：分数 <1/3 目标为第 0 波，<2/3 为第 1 波，其余第 2 波。
func wave_index_for(score_value: int) -> int:
	var third := maxi(TARGET_SCORE / 3, 1)
	var two_thirds := maxi(TARGET_SCORE * 2 / 3, third + 1)
	if score_value < third:
		return 0
	if score_value < two_thirds:
		return 1
	return 2


## 波内进度 0..1（波起点 → 波终点），用于把该波的两个锚点插值成当前值。
## 末波终点取 TARGET_SCORE-1：达标分（≥TARGET）当帧即通关、曲线不再被查询，
## 这样「满难度（score=TARGET-1）收敛到 SPAWN_INTERVAL_MIN / LIFETIME_MIN」与 v1/v2 断言同值。
func _wave_ratio(score_value: int) -> float:
	var wave := wave_index_for(score_value)
	var third := maxi(TARGET_SCORE / 3, 1)
	var two_thirds := maxi(TARGET_SCORE * 2 / 3, third + 1)
	var start_score: int = [0, third, two_thirds][wave]
	var end_score: int = [third, two_thirds, maxi(TARGET_SCORE - 1, two_thirds + 1)][wave]
	if end_score <= start_score:
		return 1.0
	return clampf(float(score_value - start_score) / float(end_score - start_score), 0.0, 1.0)


## 按波次锚点插值出的当前刷新间隔（秒）：难度曲线 = 三段线性、全局单调不增、有界。
func spawn_interval_now() -> float:
	var wave := wave_index_for(score)
	var ratio := _wave_ratio(score)
	var from_value := lerpf(SPAWN_INTERVAL_START, SPAWN_INTERVAL_MIN, WAVE_INTERVAL_FRAC[wave])
	var to_value := lerpf(SPAWN_INTERVAL_START, SPAWN_INTERVAL_MIN, WAVE_INTERVAL_FRAC[wave + 1])
	return lerpf(from_value, to_value, ratio)


## 按波次锚点插值出的当前物品寿命（秒）：与刷新间隔同构，全局单调不增、有界。
func collectible_lifetime_now() -> float:
	var wave := wave_index_for(score)
	var ratio := _wave_ratio(score)
	var from_value := lerpf(LIFETIME_START, LIFETIME_MIN, WAVE_LIFETIME_FRAC[wave])
	var to_value := lerpf(LIFETIME_START, LIFETIME_MIN, WAVE_LIFETIME_FRAC[wave + 1])
	return lerpf(from_value, to_value, ratio)


## 当前波次的类型权重表（场景层刷出物品时用 roll 查表；表逐波不同且合计 1.0）。
func wave_weights(wave: int) -> Dictionary:
	return WAVE_WEIGHTS[clampi(wave, 0, WAVE_WEIGHTS.size() - 1)]


## 在波次权重表下按 roll ∈ [0,1) 选取类型（纯函数，确定性可测）。
func pick_kind(wave: int, roll: float) -> String:
	var weights := wave_weights(wave)
	var accumulated: float = 0.0
	for kind: String in weights:
		accumulated += float(weights[kind])
		if roll < accumulated:
			return kind
	return KIND_NORMAL


## 限时推进入口：由主场景每帧调用（仅进行中阶段消耗时间），归零即判定失败。
func tick_time(delta: float) -> void:
	if phase != Phase.RUNNING:
		return
	time_left = maxf(time_left - delta, 0.0)
	time_changed.emit(time_left)
	if time_left <= 0.0:
		_set_phase(Phase.LOST)


## ── 阶段控制（v3 ④2：开始面板 → 局内暂停/恢复 → 胜负结算 → 一键重开）──

## 模板协议（playtest driver 的 _begin_run 调用点）：跨局完整复位到出厂初始态。
## GameState 是 autoload，场景换局时自身状态会跨局残留（上局的相位/时限/连击），
## driver 换种子重实例化场景后调用本方法，保证每局都从 READY 干净起跑 ——
## 首局开始事件（start_run 的 score_changed）才能落在每局的采样窗口头部。
func reset() -> void:
	score = 0
	time_left = TIME_LIMIT
	combo_count = 0
	combo_timer = 0.0
	run_max_combo = 0
	wave_index = 0
	phase = Phase.READY
	phase_changed.emit(phase)
	score_changed.emit(score)
	time_changed.emit(time_left)
	combo_changed.emit(combo_count)


## 一键重开 / 从开始面板进入：清零本局进度并回到进行中（场景层负责重置场上实体）。
func start_run() -> void:
	score = 0
	time_left = TIME_LIMIT
	phase = Phase.RUNNING
	combo_count = 0
	combo_timer = 0.0
	run_max_combo = 0
	wave_index = 0
	score_changed.emit(score)
	time_changed.emit(time_left)
	combo_changed.emit(combo_count)
	phase_changed.emit(phase)


## 局内暂停（仅进行中可暂停）。
func pause_game() -> void:
	if phase != Phase.RUNNING:
		return
	phase = Phase.PAUSED
	phase_changed.emit(phase)


## 恢复进行（仅暂停态可恢复）。
func resume_game() -> void:
	if phase != Phase.PAUSED:
		return
	phase = Phase.RUNNING
	phase_changed.emit(phase)


## ── 调参应用（SKILL.md §3C 调参工作台唯一应用入口）──
## 只认 TUNING_META 声明的键（未声明键拒绝）、按 min/max 钳制，返回实际生效的键列表。
func apply_tuning(values: Dictionary) -> Array[String]:
	var applied: Array[String] = []
	for key: String in values:
		if not TUNING_META.has(key):
			continue  # 未声明的键一律拒绝：调参不能改到玩法逻辑或存档字段
		var meta: Dictionary = TUNING_META[key]
		var clamped: float = clampf(float(values[key]), float(meta["min"]), float(meta["max"]))
		set(key, _cast_tuned_value(key, clamped))
		applied.append(key)
	_normalize_tuning_order()
	if applied.has("TIME_LIMIT"):
		# 改时限立即生效：本局剩余时间重置为新时限（调参台是开发工具，语义直观优先）。
		time_left = TIME_LIMIT
		time_changed.emit(time_left)
	return applied


## 把钳制后的浮点值转回变量自身类型（整型变量取整，其余保持浮点）。
func _cast_tuned_value(key: String, value: float) -> Variant:
	var current: Variant = get(key)
	if typeof(current) == TYPE_INT:
		return int(roundf(value))
	return value


## 保序约束：下限值不允许高于开局值（否则波次难度曲线的单调性被破坏）。
func _normalize_tuning_order() -> void:
	SPAWN_INTERVAL_MIN = minf(SPAWN_INTERVAL_MIN, SPAWN_INTERVAL_START)
	LIFETIME_MIN = minf(LIFETIME_MIN, LIFETIME_START)


## Web 调参桥消费端：壳页面在引擎加载前把 URL ?tuning=<JSON> 写进 window.__GAME_TUNING__，
## 这里读回并应用。非 Web 平台（桌面/无头）没有 JavaScriptBridge 语义，直接返回。
func _apply_web_tuning() -> void:
	if not OS.has_feature("web"):
		return
	var raw: Variant = JavaScriptBridge.eval(
		"window.__GAME_TUNING__ ? JSON.stringify(window.__GAME_TUNING__) : null", true
	)
	if raw == null or typeof(raw) != TYPE_STRING:
		return
	var parsed: Variant = JSON.parse_string(raw)
	if typeof(parsed) != TYPE_DICTIONARY:
		return
	var applied := apply_tuning(parsed)
	if not applied.is_empty():
		print("[game-8] 已应用 URL 调参: ", ", ".join(applied))


func _set_phase(next_phase: int) -> void:
	if phase == next_phase:
		return
	phase = next_phase
	if next_phase != Phase.RUNNING:
		_record_run_result()
	phase_changed.emit(phase)


## 结算：刷新历史最佳/最高连击并落盘（通关与失败都结算，失败也保留已收集的累计进度）。
func _record_run_result() -> void:
	if score > best_score:
		best_score = score
		best_changed.emit(best_score)
	if run_max_combo > best_combo:
		best_combo = run_max_combo
	save_progress()


## 本地持久化：历史最高分 / 累计收集数 / 历史最高连击写入 user:// JSON。
func save_progress() -> void:
	var data := {
		"best_score": best_score,
		"total_collected": total_collected,
		"best_combo": best_combo,
	}
	var file := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if file == null:
		return
	file.store_string(JSON.stringify(data))
	file.close()


## 启动时读回持久化数据；文件缺失/损坏时保持默认值（首次游玩或存档清空）。
func load_progress() -> void:
	if not FileAccess.file_exists(SAVE_PATH):
		return
	var file := FileAccess.open(SAVE_PATH, FileAccess.READ)
	if file == null:
		return
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	file.close()
	if typeof(parsed) != TYPE_DICTIONARY:
		return
	var data: Dictionary = parsed
	best_score = int(data.get("best_score", 0))
	total_collected = int(data.get("total_collected", 0))
	best_combo = int(data.get("best_combo", 0))
