extends Node
## 自动加载单例（autoload）：《我被ai女友包围了》剧情生存挑战的全局状态机。
##
## 注册方式：project.godot 的 [autoload] 段写 `GameState="*res://autoload/game_state.gd"`。
##
## 核心循环（全项目唯一表述，UI/实现/测试均以此为准）：
##   剧情节点选择 → 好感度/威胁度/生存状态变化 → 触发后续剧情与结局分支 →（回到节点选择）
##
## 状态轴（本作 v2，与策划案 §5 数值基线对齐）：
##   stamina 体力 / satiety 饱食 / sanity 理智 —— 生存三轴，任一归零判「清除结局」；
##   food 食物库存 —— eat/翻找类选项消耗或补充；
##   favor/threat —— 每位 AI 女友各一套（字典 persona_id → 值），
##   初值来自人设卡 favor_rules/threat_rules（换卡=换初值，零代码改动）。
##
## 结局分支（4 个，判定优先级见 ending_resolver.gd）：
##   GAMEOVER 清除 / TOGETHER 数据永生 / SAVE_ONE 带走一个 / ALONE 独活。
##
## 数值单一事实源：全局数值表 data/spec/numeric.json（spec.numeric），
## 键名与本单例同名字段一一对应；运行时从表载入，改数值=改表不改码。
## 键名契约由 _load_numeric 双向核对，违约记入 numeric_contract_errors（冒烟断言为空）。
## 人设相关数值（初值/互动修正/升级阈值）不在本表 —— 它们落在人设卡，避免双事实源。
##
## 写入路径收口（先例 games/godot-coin-rush 的属性 setter 守卫模式）：
## - 三轴与 favor/threat 在结局判定后冻结：一切写入被丢弃；
## - 广播与写入一一对应：合法写入在结算方法里广播对应信号；
## - GDScript 没有 private：`_stamina` 等是按下划线约定内部使用的后备字段。

## 体力变化信号。
signal stamina_changed(value: float)
## 饱食变化信号。
signal satiety_changed(value: float)
## 理智变化信号。
signal sanity_changed(value: float)
## 食物库存变化信号。
signal food_changed(value: int)
## 某位女友的好感变化信号：参数 persona_id 与新值。
signal favor_changed(persona_id: String, value: int)
## 某位女友的威胁变化信号：参数 persona_id 与新值。
signal threat_changed(persona_id: String, value: int)
## 幕推进信号：参数是幕序（1 基）与幕标题。
signal act_changed(act_index: int, act_title: String)
## 本幕剩余时间变化信号。
signal act_time_changed(remaining_seconds: float)
## 幕倒计时到点且后面还有幕：Main 订阅它推进到下一幕（终幕到点由终局抉择收口）。
signal act_timer_expired
## 剧情标记变化信号（如 unlock_together）。
signal flag_changed(flag_name: String, value: bool)
## 结局判定信号：参数是结局名（GAMEOVER / TOGETHER / SAVE_ONE / ALONE），每局只发一次。
signal game_ended(outcome_name: String)
## 结算落账信号：每次结算写一条 trace（可回放定位到人设与状态前后值）。
signal trace_written(entry: Dictionary)

## 结局分支枚举：NONE = 进行中。判定优先级链见 ending_resolver.gd。
enum Outcome { NONE, GAMEOVER, TOGETHER, SAVE_ONE, ALONE }

## 数值表路径（相对工程根）与文件名：spec.numeric 单一事实源。
const NUMERIC_DIR: String = "data/spec/"
const NUMERIC_FILE: String = "numeric.json"

## 数值默认值（键名 ↔ 字段名一一对应；数值表缺失/不可读时兜底）。
const NUMERIC_DEFAULTS: Dictionary = {
	"move_speed": 240.0,
	"stamina_max": 100.0,
	"satiety_max": 100.0,
	"sanity_max": 100.0,
	"stamina_checkpoint_cost": 8.0,
	"satiety_checkpoint_cost": 15.0,
	"rest_stamina_regen": 40.0,
	"eat_satiety_regen": 30.0,
	"food_initial": 5,
	"food_search_gain": 2,
	"hunger_satiety_gate": 20.0,
	"hunger_sanity_penalty": 10.0,
	"interact_favor_gain": 12,
	"interact_favor_gate": 60,
	"interact_sanity_bonus": 10.0,
	"threat_per_hit": 1,
	"sanity_hit_penalty": 12.0,
	"favor_save_threshold": 70,
	"threat_save_limit": 60,
	"favor_together_threshold": 60,
	"threat_sigma_limit": 300,
	"threat_single_limit": 95,
}

## —— 运行时数值（从 data/spec/numeric.json 载入，改表即生效，不改码）——
var move_speed: float = NUMERIC_DEFAULTS["move_speed"]
var stamina_max: float = NUMERIC_DEFAULTS["stamina_max"]
var satiety_max: float = NUMERIC_DEFAULTS["satiety_max"]
var sanity_max: float = NUMERIC_DEFAULTS["sanity_max"]
var stamina_checkpoint_cost: float = NUMERIC_DEFAULTS["stamina_checkpoint_cost"]
var satiety_checkpoint_cost: float = NUMERIC_DEFAULTS["satiety_checkpoint_cost"]
var rest_stamina_regen: float = NUMERIC_DEFAULTS["rest_stamina_regen"]
var eat_satiety_regen: float = NUMERIC_DEFAULTS["eat_satiety_regen"]
var food_initial: int = NUMERIC_DEFAULTS["food_initial"]
var food_search_gain: int = NUMERIC_DEFAULTS["food_search_gain"]
var hunger_satiety_gate: float = NUMERIC_DEFAULTS["hunger_satiety_gate"]
var hunger_sanity_penalty: float = NUMERIC_DEFAULTS["hunger_sanity_penalty"]
var interact_favor_gain: int = NUMERIC_DEFAULTS["interact_favor_gain"]
var interact_favor_gate: int = NUMERIC_DEFAULTS["interact_favor_gate"]
var interact_sanity_bonus: float = NUMERIC_DEFAULTS["interact_sanity_bonus"]
var threat_per_hit: int = NUMERIC_DEFAULTS["threat_per_hit"]
var sanity_hit_penalty: float = NUMERIC_DEFAULTS["sanity_hit_penalty"]
var favor_save_threshold: int = NUMERIC_DEFAULTS["favor_save_threshold"]
var threat_save_limit: int = NUMERIC_DEFAULTS["threat_save_limit"]
var favor_together_threshold: int = NUMERIC_DEFAULTS["favor_together_threshold"]
var threat_sigma_limit: int = NUMERIC_DEFAULTS["threat_sigma_limit"]
var threat_single_limit: int = NUMERIC_DEFAULTS["threat_single_limit"]

## 数值键名契约违约记录（smoke 契约断言核对为空）。
var numeric_contract_errors: PackedStringArray = PackedStringArray()

## 结算 trace（可回放）：act / node_id / option_id / persona_id / favor·threat 前后值。
var trace: Array[Dictionary] = []

var _favor: Dictionary = {}
var _threat: Dictionary = {}
var _stamina: float = NUMERIC_DEFAULTS["stamina_max"]
var _satiety: float = NUMERIC_DEFAULTS["satiety_max"]
var _sanity: float = NUMERIC_DEFAULTS["sanity_max"]
var _food: int = NUMERIC_DEFAULTS["food_initial"]
var _flags: Dictionary = {}
var _outcome: Outcome = Outcome.NONE
var _end_reason: String = ""
var _act_index: int = 1
var _act_title: String = ""
var _act_duration: float = 0.0
var _act_elapsed: float = 0.0
var _act_remaining: float = 0.0
var _act_expired: bool = false


func _ready() -> void:
	_load_numeric()
	_stamina = stamina_max
	_satiety = satiety_max
	_sanity = sanity_max


## 载入数值表：键名契约双向核对（表缺键 / 表多键都算违约），违约时保留默认值继续跑。
func _load_numeric() -> void:
	numeric_contract_errors = PackedStringArray()
	var table: Dictionary = JsonIO.load_object(JsonIO.RESOURCE_SCHEME + NUMERIC_DIR + NUMERIC_FILE)
	if table.is_empty():
		numeric_contract_errors.append("数值表不可读：%s（沿用内置默认值）" % (JsonIO.RESOURCE_SCHEME + NUMERIC_DIR + NUMERIC_FILE))
		return
	for key: String in NUMERIC_DEFAULTS:
		if not table.has(key):
			numeric_contract_errors.append("数值表缺少键「%s」（game_state 同名字段将沿用默认值）" % key)
	for key: String in table:
		if key.begins_with("_"):
			continue  # 允许表内以 _ 开头的说明性字段，不参与契约
		if not NUMERIC_DEFAULTS.has(key):
			numeric_contract_errors.append("数值表出现未知键「%s」（game_state 没有同名字段，改了不生效）" % key)
	for key: String in NUMERIC_DEFAULTS:
		if not table.has(key):
			continue
		if typeof(NUMERIC_DEFAULTS[key]) == TYPE_INT:
			set(key, int(table[key]))
		else:
			set(key, float(table[key]))


## —— 只读状态访问 ——
var stamina: float:
	get:
		return _stamina


var satiety: float:
	get:
		return _satiety


var sanity: float:
	get:
		return _sanity


var food: int:
	get:
		return _food


## 当前结局分支：NONE → 终局单向跳变（只有 reset 能回到 NONE）。
var outcome: Outcome:
	get:
		return _outcome


## 终局原因（结算横幅展示）。
var end_reason: String:
	get:
		return _end_reason


## 当前幕序（1 基）。
var act_index: int:
	get:
		return _act_index


## 当前幕标题。
var act_title: String:
	get:
		return _act_title


## 本幕剩余秒数。
var act_remaining: float:
	get:
		return _act_remaining


## 某位女友的好感度（未知 id 返回 0）。
func favor_of(persona_id: String) -> int:
	return int(_favor.get(persona_id, 0))


## 某位女友的威胁度（未知 id 返回 0）。
func threat_of(persona_id: String) -> int:
	return int(_threat.get(persona_id, 0))


## 剧情标记取值。
func get_flag(flag_name: String) -> bool:
	return bool(_flags.get(flag_name, false))


## Σthreat：全体威胁度之和（清除结局判定条件之一）。
func sigma_threat() -> int:
	var total := 0
	for persona_id: String in _threat:
		total += int(_threat[persona_id])
	return total


## 单人最高威胁。
func max_single_threat() -> int:
	var highest := 0
	for persona_id: String in _threat:
		highest = maxi(highest, int(_threat[persona_id]))
	return highest


## 好感最高的人设：{id, favor, threat}（带走的候选）。空局返回空字典。
func best_favor_entry() -> Dictionary:
	var best_id := ""
	var best_favor := -1
	for persona_id: String in _favor:
		if int(_favor[persona_id]) > best_favor:
			best_favor = int(_favor[persona_id])
			best_id = persona_id
	if best_id.is_empty():
		return {}
	return {"id": best_id, "favor": best_favor, "threat": threat_of(best_id)}


## 当前对局里的人设 id 列表（结局判定 / UI 花名册用）。
func persona_ids_snapshot() -> Array[String]:
	var ids: Array[String] = []
	for persona_id: String in _favor:
		ids.append(persona_id)
	return ids


## 全员好感是否都 ≥ threshold（数据永生结局条件）。
func all_favor_at_least(threshold: int) -> bool:
	if _favor.is_empty():
		return false
	for persona_id: String in _favor:
		if int(_favor[persona_id]) < threshold:
			return false
	return true


## 开一局（新局 / 重开共用）：由 Main 传入从人设卡读出的初值表（换卡=换初值）。
func initialize_state(favor_initial: Dictionary, threat_initial: Dictionary) -> void:
	_outcome = Outcome.NONE
	_end_reason = ""
	_favor = {}
	_threat = {}
	for persona_id: String in favor_initial:
		_favor[persona_id] = int(favor_initial[persona_id])
	for persona_id: String in threat_initial:
		_threat[persona_id] = int(threat_initial[persona_id])
	_stamina = stamina_max
	_satiety = satiety_max
	_sanity = sanity_max
	_food = food_initial
	_flags = {}
	_act_index = 1
	_act_title = ""
	_act_duration = 0.0
	_act_elapsed = 0.0
	_act_remaining = 0.0
	_act_expired = false
	trace = []
	_emit_all()


## 重开一局（兼容入口）：沿用上局的初值表。
func reset() -> void:
	var favor_snapshot := _favor.duplicate(true)
	var threat_snapshot := _threat.duplicate(true)
	initialize_state(favor_snapshot, threat_snapshot)


## 开启一幕：Main 在幕切换 / 重开时调用。
func begin_act(index: int, title: String, duration: float) -> void:
	if _outcome != Outcome.NONE:
		return
	_act_index = index
	_act_title = title
	_act_duration = duration
	_act_elapsed = 0.0
	_act_remaining = duration
	_act_expired = false
	act_changed.emit(index, title)
	act_time_changed.emit(_act_remaining)


## 行动段帧推进：理智按幕衰减率流逝，倒计时到点触发 act_timer_expired。
func tick_survival(delta: float, sanity_drain_per_second: float) -> void:
	if _outcome != Outcome.NONE or _act_duration <= 0.0:
		return
	_act_elapsed = minf(_act_elapsed + delta, _act_duration)
	var remaining := _act_duration - _act_elapsed
	if not is_equal_approx(remaining, _act_remaining):
		_act_remaining = remaining
		act_time_changed.emit(_act_remaining)
	_set_sanity(_sanity - sanity_drain_per_second * delta)
	if _act_remaining <= 0.0 and not _act_expired and _outcome == Outcome.NONE:
		_act_expired = true
		act_timer_expired.emit()


## 一次性推进 N 秒行动时间（冒烟 / 模拟入口）：按 ≤0.25s 步进走完，等价真实逐帧推进。
func consume_act_time(seconds: float, sanity_drain_per_second: float) -> void:
	var remaining_seconds := maxf(0.0, seconds)
	var step := 0.25
	while remaining_seconds > 0.0 and _outcome == Outcome.NONE:
		var slice := minf(step, remaining_seconds)
		tick_survival(slice, sanity_drain_per_second)
		remaining_seconds -= slice


## 剧情节点 effects（声明式键值）的统一结算入口：
## effects 键集 = {favor, threat, sanity, stamina, satiety, food, flag}，
## favor/threat 值是 persona_id → Δ 字典，其余是标量 Δ，flag 是 flag_name → bool。
## 结算后写 trace 并做清除结局检查。 返回是否实际生效（冻结时为 false）。
func apply_effects(effects: Dictionary, node_id: String, option_id: String, persona_id: String) -> bool:
	if _outcome != Outcome.NONE:
		return false
	var favor_before := _snapshot_keys(_favor, effects.get("favor", {}))
	var threat_before := _snapshot_keys(_threat, effects.get("threat", {}))
	var sanity_before := _sanity
	var stamina_before := _stamina
	var satiety_before := _satiety
	var food_before := _food
	var flags_before := _flags.duplicate(true)

	if effects.has("favor"):
		for target_id: String in effects["favor"]:
			_bump_favor(target_id, int(effects["favor"][target_id]))
	if effects.has("threat"):
		for target_id: String in effects["threat"]:
			_bump_threat(target_id, int(effects["threat"][target_id]))
	if effects.has("sanity"):
		_set_sanity(_sanity + float(effects["sanity"]))
	if effects.has("stamina"):
		_set_stamina(_stamina + float(effects["stamina"]))
	if effects.has("satiety"):
		_set_satiety(_satiety + float(effects["satiety"]))
	if effects.has("food"):
		_food = maxi(0, _food + int(effects["food"]))
		food_changed.emit(_food)
	if effects.has("flag"):
		for flag_name: String in effects["flag"]:
			var value := bool(effects["flag"][flag_name])
			_flags[flag_name] = value
			flag_changed.emit(flag_name, value)
	_write_effect_trace(node_id, option_id, persona_id, favor_before, threat_before,
			sanity_before, stamina_before, satiety_before, food_before, flags_before)
	_check_gameover()
	return true


## 行动段「互动」结算（收集心动信物 = 与该女友互动）：
## favor_gain = numeric.interact_favor_gain + 卡 interact_modifier（Main 从人设卡读出后传入）；
## sanity_regen 来自人设卡；互动前好感 ≥ interact_favor_gate 时另加 gate_bonus（基线：理智+10）。
func settle_interact(persona_id: String, node_id: String, favor_gain: int,
		sanity_regen: float, gate_bonus: float) -> void:
	if _outcome != Outcome.NONE:
		return
	var favor_before := {}
	favor_before[persona_id] = favor_of(persona_id)
	var sanity_before := _sanity
	_bump_favor(persona_id, favor_gain)
	var regen := sanity_regen + (gate_bonus if favor_before[persona_id] >= interact_favor_gate else 0.0)
	_set_sanity(_sanity + regen)
	_write_effect_trace(node_id, "interact", persona_id, favor_before, {},
			sanity_before, _stamina, _satiety, _food, _flags)
	_check_gameover()


## 行动段「危机」结算（闯入游走纠缠区）：该女友威胁 +threat_gain，理智 -sanity_penalty。
func settle_hit(persona_id: String, node_id: String, threat_gain: int, sanity_penalty: float) -> void:
	if _outcome != Outcome.NONE:
		return
	var threat_before := {}
	threat_before[persona_id] = threat_of(persona_id)
	var sanity_before := _sanity
	_bump_threat(persona_id, threat_gain)
	_set_sanity(_sanity - sanity_penalty)
	_write_effect_trace(node_id, "hit", persona_id, {}, threat_before,
			sanity_before, _stamina, _satiety, _food, _flags)
	_check_gameover()


## 幕间结算（checkpoint）：体力/饱食按数值表扣减；饱食 ≤ 饥饿线时理智再扣饥饿惩罚。
## sanity_cost 是幕 JSON 声明的剧情性理智代价（如 act1 包围惊吓 -10）。
func apply_checkpoint(sanity_cost: float) -> void:
	if _outcome != Outcome.NONE:
		return
	var sanity_before := _sanity
	var stamina_before := _stamina
	var satiety_before := _satiety
	_set_stamina(_stamina - stamina_checkpoint_cost)
	_set_satiety(_satiety - satiety_checkpoint_cost)
	var penalty := sanity_cost
	if _satiety <= hunger_satiety_gate:
		penalty += hunger_sanity_penalty
	_set_sanity(_sanity - penalty)
	_write_effect_trace("checkpoint.act%d" % _act_index, "checkpoint", "", {}, {},
			sanity_before, stamina_before, satiety_before, _food, _flags)
	_check_gameover()


## 幕间升级结算（被动机制，策划案 §3.1）：entries 由 Main 从人设卡算出
## （threat ≥ crisis_threshold 的人设 → escalation_per_phase）。
func apply_escalation(entries: Array[Dictionary]) -> void:
	if _outcome != Outcome.NONE:
		return
	for entry in entries:
		var persona_id := String(entry.get("persona_id", ""))
		var gain := int(entry.get("gain", 0))
		if persona_id.is_empty() or gain == 0:
			continue
		var threat_before := {}
		threat_before[persona_id] = threat_of(persona_id)
		_bump_threat(persona_id, gain)
		_write_effect_trace("escalation.act%d" % _act_index, "escalation", persona_id,
				{}, threat_before, _sanity, _stamina, _satiety, _food, _flags)
	if not entries.is_empty():
		_check_gameover()


func _bump_favor(persona_id: String, delta: int) -> void:
	if delta == 0:
		return
	_favor[persona_id] = maxi(0, favor_of(persona_id) + delta)
	favor_changed.emit(persona_id, _favor[persona_id])


func _bump_threat(persona_id: String, delta: int) -> void:
	if delta == 0:
		return
	_threat[persona_id] = maxi(0, threat_of(persona_id) + delta)
	threat_changed.emit(persona_id, _threat[persona_id])


func _set_stamina(value: float) -> void:
	var next_value := clampf(value, 0.0, stamina_max)
	if is_equal_approx(next_value, _stamina):
		return
	_stamina = next_value
	stamina_changed.emit(_stamina)


func _set_satiety(value: float) -> void:
	var next_value := clampf(value, 0.0, satiety_max)
	if is_equal_approx(next_value, _satiety):
		return
	_satiety = next_value
	satiety_changed.emit(_satiety)


func _set_sanity(value: float) -> void:
	var next_value := clampf(value, 0.0, sanity_max)
	if is_equal_approx(next_value, _sanity):
		return
	_sanity = next_value
	sanity_changed.emit(_sanity)


## 清除结局检查：任一生存轴归零 / Σthreat ≥ 上限 / 单人威胁 ≥ 上限。
func _check_gameover() -> void:
	if _outcome != Outcome.NONE:
		return
	if _stamina <= 0.0:
		_finish(Outcome.GAMEOVER, "体力耗尽（%.0f/%.0f）" % [_stamina, stamina_max])
	elif _satiety <= 0.0:
		_finish(Outcome.GAMEOVER, "饱食耗尽（%.0f/%.0f）" % [_satiety, satiety_max])
	elif _sanity <= 0.0:
		_finish(Outcome.GAMEOVER, "理智耗尽（%.0f/%.0f）" % [_sanity, sanity_max])
	elif sigma_threat() >= threat_sigma_limit:
		_finish(Outcome.GAMEOVER, "Σ威胁 %d ≥ %d，触发全面清除" % [sigma_threat(), threat_sigma_limit])
	elif max_single_threat() >= threat_single_limit:
		_finish(Outcome.GAMEOVER, "单人威胁 %d ≥ %d，她先动了手" % [max_single_threat(), threat_single_limit])


## 结局判定（resolver 判完后由 Main 调用）：写入结局并广播一次，之后进入冻结。
func finish_with(result: Outcome, reason: String) -> void:
	_finish(result, reason)


func _finish(result: Outcome, reason: String) -> void:
	if _outcome != Outcome.NONE:
		return
	_outcome = result
	_end_reason = reason
	game_ended.emit(Outcome.keys()[result])


## 结局名（与 Outcome 枚举键一致，trace / UI / 冒烟共用）。
func outcome_name() -> String:
	return Outcome.keys()[_outcome]


## 结算落账：可追溯格式 —— act / node_id / option_id / persona_id / favor·threat 前后值
## （字典快照只含受影响的人设）+ 三轴后值。回放可定位到具体人设与状态。
func _write_effect_trace(node_id: String, option_id: String, persona_id: String,
		favor_before: Dictionary, threat_before: Dictionary, sanity_before: float,
		stamina_before: float, satiety_before: float, food_before: int, flags_before: Dictionary) -> void:
	var favor_after := {}
	for key: String in favor_before:
		favor_after[key] = favor_of(key)
	var threat_after := {}
	for key: String in threat_before:
		threat_after[key] = threat_of(key)
	var flags_after := {}
	if not flags_before.is_empty():
		for key: String in _flags:
			if not flags_before.has(key) or bool(flags_before[key]) != bool(_flags[key]):
				flags_after[key] = _flags[key]
	var entry := {
		"act": _act_index,
		"node_id": node_id,
		"option_id": option_id,
		"persona_id": persona_id,
		"favor_before": favor_before,
		"favor_after": favor_after,
		"threat_before": threat_before,
		"threat_after": threat_after,
		"sanity_before": snappedf(sanity_before, 0.1),
		"sanity_after": snappedf(_sanity, 0.1),
		"stamina_after": snappedf(_stamina, 0.1),
		"satiety_after": snappedf(_satiety, 0.1),
		"food_after": _food,
	}
	if not flags_after.is_empty():
		entry["flags_after"] = flags_after
	trace.append(entry)
	trace_written.emit(entry)


## 只取 effects 涉及的人设键的前值快照（空 effects 返回空字典）。
func _snapshot_keys(source: Dictionary, delta_map: Variant) -> Dictionary:
	var snapshot := {}
	if delta_map is Dictionary:
		for key: String in delta_map:
			snapshot[key] = int(source.get(key, 0))
	return snapshot


## 把全部状态各广播一次（开局 / 重开用）：订阅方按当前值刷新 UI，无增量假设。
func _emit_all() -> void:
	stamina_changed.emit(_stamina)
	satiety_changed.emit(_satiety)
	sanity_changed.emit(_sanity)
	food_changed.emit(_food)
	for persona_id: String in _favor:
		favor_changed.emit(persona_id, _favor[persona_id])
	for persona_id: String in _threat:
		threat_changed.emit(persona_id, _threat[persona_id])
	for flag_name: String in _flags:
		flag_changed.emit(flag_name, _flags[flag_name])
