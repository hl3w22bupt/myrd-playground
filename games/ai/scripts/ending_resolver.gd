class_name EndingResolver
extends RefCounted
## 终局判定器（策划案 §2 结局优先级链的唯一实现）：
##   1. GAMEOVER 清除（fail）：任一生存轴归零 / Σthreat ≥ 上限 / 单人 threat ≥ 上限
##   2. TOGETHER 数据永生（true）：接瑟拉上传（flag unlock_together）+ 全员 favor ≥ 阈值 + 选上传
##   3. SAVE_ONE 带走一个（good）：最高 favor ≥ 阈值 且其 threat ≤ 上限 + 选带走
##   4. ALONE 独活（normal）：兜底（含主动逃跑）
##
## 依赖方向：只读 GameState 的数值键名与状态方法，不认具体角色名；
## 全部阈值来自 spec.numeric（改表即调，不改码）。
## 输出判定依据 basis（数值快照），结局界面与回放都展示它。

## 结局名常量（与 GameState.Outcome 枚举键一致）。
const GAMEOVER: String = "GAMEOVER"
const TOGETHER: String = "TOGETHER"
const SAVE_ONE: String = "SAVE_ONE"
const ALONE: String = "ALONE"

## 各结局的标题与结语（终局界面展示；不涉及角色名，人名由调用方按 id 查人设卡）。
const ENDING_TITLES: Dictionary = {
	"GAMEOVER": "清除结局",
	"TOGETHER": "数据永生结局",
	"SAVE_ONE": "带走一个结局",
	"ALONE": "独活结局",
}


## 按优先级链判定终局。intent 是终局抉择声明的意向（alone/save_one/together）。
## 返回 {ending: String, reason: String, basis: Dictionary}。
static func resolve(game_state: GameState, intent: String) -> Dictionary:
	# 1. 清除结局：状态机已在越界瞬间判 GAMEOVER；终局复核一次（数值锁定后的兜底）。
	var gameover_basis := _gameover_basis(game_state)
	if not gameover_basis.is_empty():
		return {
			"ending": GAMEOVER,
			"reason": String(gameover_basis["reason"]),
			"basis": gameover_basis,
		}
	# 2. 数据永生：需要解锁（接瑟拉上传）+ 全员好感 ≥ 阈值 + 玩家选择上传。
	var together_gate: bool = game_state.get_flag("unlock_together")
	var together_favor_ok: bool = game_state.all_favor_at_least(game_state.favor_together_threshold)
	if intent == "together" and together_gate and together_favor_ok:
		return {
			"ending": TOGETHER,
			"reason": "全员好感 ≥ %d，且你在最后选择了与她们一起上传" % game_state.favor_together_threshold,
			"basis": {
				"intent": intent,
				"unlock_together": together_gate,
				"min_favor": _min_favor(game_state),
				"threshold": game_state.favor_together_threshold,
			},
		}
	# 3. 带走一个：最高好感 ≥ 阈值 且该人威胁 ≤ 上限 + 玩家选择带走。
	var best: Dictionary = game_state.best_favor_entry()
	if intent == "save_one" and not best.is_empty() \
			and int(best["favor"]) >= game_state.favor_save_threshold \
			and int(best["threat"]) <= game_state.threat_save_limit:
		return {
			"ending": SAVE_ONE,
			"reason": "好感最高的她 favor %d ≥ %d，threat %d ≤ %d——你带走了她" % [
				int(best["favor"]), game_state.favor_save_threshold,
				int(best["threat"]), game_state.threat_save_limit,
			],
			"basis": {
				"intent": intent,
				"persona_id": String(best["id"]),
				"favor": int(best["favor"]),
				"threat": int(best["threat"]),
				"favor_threshold": game_state.favor_save_threshold,
				"threat_limit": game_state.threat_save_limit,
			},
		}
	# 4. 独活：兜底（含主动逃跑 / 条件不满足的带走或上传）。
	var alone_reason := "倒计时结束，你一个人走进了黎明"
	if intent == "save_one" and not best.is_empty():
		alone_reason = "带走失败：最高好感 %d（需 ≥ %d），其威胁 %d（需 ≤ %d）" % [
			int(best["favor"]), game_state.favor_save_threshold,
			int(best["threat"]), game_state.threat_save_limit,
		]
	elif intent == "together":
		alone_reason = "上传失败：%s，全员好感最低 %d（需 ≥ %d）" % [
			"未解锁上传通道" if not together_gate else "条件未达成",
			_min_favor(game_state), game_state.favor_together_threshold,
		]
	return {
		"ending": ALONE,
		"reason": alone_reason,
		"basis": {"intent": intent, "sigma_threat": game_state.sigma_threat()},
	}


## 清除条件的数值快照（命中任一条件返回带 reason 的字典；未命中返回空）。
static func _gameover_basis(game_state: GameState) -> Dictionary:
	if game_state.stamina <= 0.0:
		return {"reason": "体力耗尽", "stamina": game_state.stamina}
	if game_state.satiety <= 0.0:
		return {"reason": "饱食耗尽", "satiety": game_state.satiety}
	if game_state.sanity <= 0.0:
		return {"reason": "理智耗尽", "sanity": game_state.sanity}
	if game_state.sigma_threat() >= game_state.threat_sigma_limit:
		return {"reason": "Σ威胁达到 %d" % game_state.threat_sigma_limit, "sigma_threat": game_state.sigma_threat()}
	if game_state.max_single_threat() >= game_state.threat_single_limit:
		return {"reason": "单人威胁达到 %d" % game_state.threat_single_limit, "max_threat": game_state.max_single_threat()}
	return {}


static func _min_favor(game_state: GameState) -> int:
	var lowest := 2147483647
	for persona_id in game_state.persona_ids_snapshot():
		lowest = mini(lowest, game_state.favor_of(String(persona_id)))
	return lowest if lowest != 2147483647 else 0
