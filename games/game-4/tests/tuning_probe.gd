extends SceneTree
## headless 调参数据采集探针（QA 工具，非门禁——门禁唯一入口仍是 games/game-4/verify.sh）。
##
## 目的：为 spec.numeric 拍板取数。全部数值都从生产代码机判得出，不手填：
##   scripts/levels.gd（关卡单一事实源）+ scripts/puzzle_logic.gd（传播/星级纯函数）
##   + autoload/game_state.gd（真实通关状态机，画像模拟走 register_rotation 生产路径）。
##
## 采集内容（逐关）：
##   可解性（target 态必 solved）/ 未提前通关（init 态必不 solved）/ par（最优解步数）
##   元件计数（直管/弯管/三通/墙/空格）/ 光路形状（段数、途经格、分光路数）
##   星级阈值带（3 星 ≤par，2 星 ≤⌈par×1.5⌉，带宽 = ⌈par/2⌉）
##   三档玩家画像（绕圈试错 0/+4/+8 步）实测星级分布
##   有界 BFS 更短解搜索（小关穷举证明 par 最优；超预算如实报 exhausted，不猜）
##
## 输出协议：stdout 打印 TUNING_DATA_BEGIN / JSON / TUNING_DATA_END，
## 由 games/game-4/qa/collect_tuning_data.sh 落盘 games/game-4/qa/tuning-data.json。
##
## 用法：godot --headless --path . -s res://tests/tuning_probe.gd（退出码 0 = 采集完成）

const Levels := preload("res://scripts/levels.gd")
const Logic := preload("res://scripts/puzzle_logic.gd")
const GameStateScript := preload("res://autoload/game_state.gd")

## 有界搜索预算：节点数（状态数）与墙钟时间双护栏，超限如实报 exhausted。
## 时间预算按「每关」计，10 关合计约 ≤25s，保证探针本身不会成为长任务。
const SEARCH_NODE_BUDGET: int = 120000
const SEARCH_TIME_BUDGET_MS: int = 2500

## 人类时长估算模型参数（显式声明，估算值不是实测值，只用于节奏断档判断）。
const MODEL_OBSERVE_S: float = 8.0        # 开局读盘观察
const MODEL_DECIDE_S: float = 3.0         # 每根管的定位+决策
const MODEL_TEE_EXTRA_S: float = 6.0      # 每个分光三通额外推演（双路都要顾）
const MODEL_CLICK_S: float = 1.0          # 每次旋转（点击/按键）节奏

# 画像定义：绕圈试错的额外步数（绕一整圈 = 4 步净零旋转，是「试错一次」的最小物理代价）。
const PERSONAS: Array[Dictionary] = [
	{"key": "expert", "extra_clicks": 0, "desc": "知道解法，零试错（3 星基准）"},
	{"key": "casual", "extra_clicks": 4, "desc": "试错绕圈一次（+4 步）"},
	{"key": "novice", "extra_clicks": 8, "desc": "试错绕圈两次（+8 步）"},
]


func _initialize() -> void:
	var report: Dictionary = _collect()
	var problems: Array = report["contract_checks"]["problems"]
	print("TUNING_DATA_BEGIN")
	print(JSON.stringify(report, "  "))
	print("TUNING_DATA_END")
	var findings: Dictionary = report["par_findings"]
	for row: Dictionary in findings["inflate_levels"]:
		print("TUNING_PROBE: FINDING 第 %d 关「%s」声明 par=%d，真最优 ≤ %d（虚高 %d 步）" % [
			row["level"], row["name"], row["declared_par"], row["true_par"], row["inflation_steps"]])
	for row: Dictionary in findings["unproven_levels"]:
		print("TUNING_PROBE: FINDING 第 %d 关「%s」最优性未证明（BFS 预算耗尽），下界=%d 声明=%d" % [
			row["level"], row["name"], row["true_par"], row["declared_par"]])
	if not problems.is_empty():
		for problem: String in problems:
			printerr("TUNING_PROBE: FAIL " + problem)
		quit(1)
		return
	print("TUNING_PROBE: PASS 采集完成（%d 关，硬契约断言全过；调参发现见 FINDING 行与 JSON par_findings）" % Levels.count())
	quit(0)


func _collect() -> Dictionary:
	var gs: Node = GameStateScript.new()
	root.add_child(gs)
	gs.reset_progress()  # 密封开局（与冒烟同纪律），避免本机旧档污染画像星级

	var levels_out: Array = []
	var problems: Array = []
	for i: int in range(Levels.count()):
		var entry: Dictionary = _collect_level(i, gs, problems)
		levels_out.append(entry)

	# 解锁链契约：密封档下逐关通关后 unlocked_max 应推进到最后一关。
	if int(gs.unlocked_max) != Levels.count() - 1:
		problems.append("解锁链断裂：unlocked_max=%d，应为 %d" % [gs.unlocked_max, Levels.count() - 1])

	gs.queue_free()
	return {
		"levels": levels_out,
		"difficulty_curve": _difficulty_curve(levels_out, problems),
		"star_thresholds": _star_threshold_analysis(levels_out),
		"star_distribution": _star_distribution(levels_out),
		"par_findings": _par_findings(levels_out),
		"models": _human_time_model(levels_out),
		"contract_checks": {"problems": problems},
	}


## 调参发现聚合：par 虚高清单（不动代码、只给数据，修复走 spec.numeric 拍板流程）。
func _par_findings(levels_out: Array) -> Dictionary:
	var inflated: Array = []
	var proven: Array = []
	var unproven: Array = []
	for entry: Dictionary in levels_out:
		var opt: Dictionary = entry["par_optimality"]
		var row: Dictionary = {"level": int(entry["index"]) + 1, "name": entry["name"],
			"declared_par": int(opt["declared_par"]),
			"true_par": int(opt["true_par"]),
			"inflation_steps": int(opt["inflation_steps"])}
		match String(opt["status"]):
			"shorter_solution_found", "declared_par_inflated_by_symmetry":
				inflated.append(row)
			"declared_par_optimal_proven":
				proven.append(row)
			_:
				unproven.append(row)
	var declared_total: int = 0
	var true_total: int = 0
	for entry: Dictionary in levels_out:
		declared_total += int(entry["par_optimality"]["declared_par"])
		true_total += int(entry["par_optimality"]["true_par"])
	return {
		"root_cause": "直管元件有 180° 对称（rot 与 rot+2 开口等价），LevelSet.par_of 按精确 target_rot 计步，直管 init_rot 与 target_rot 同差 2 时多算 2 步",
		"impact": "星级阈值带（⌈par×1.5⌉）随 par 一起被抬高，2 星容差失真；「最优解」标签与真实最短走法不符（需求要求每关记录最少旋转步数）",
		"inflate_levels": inflated,
		"proven_optimal_levels": proven,
		"unproven_levels": unproven,
		"declared_par_total": declared_total,
		"true_par_total": true_total,
		"recommendation": "二选一走拍板：① 修 LevelSet.par_of 为等效朝向感知（直管按 (target-init)%2 计），同步复核冒烟 par 非递减契约；② 保留声明 par 作为 3 星参考线（玩家更少步数仍 3 星，无恶性），但 spec.numeric 的参考步数/星级阈值改用 true_par。",
	}


func _collect_level(index: int, gs: Node, problems: Array) -> Dictionary:
	var level: Dictionary = Levels.level_at(index)
	var par: int = Levels.par_of(level)
	var cells_target: Dictionary = Levels.build_cells(level, true)
	var cells_init: Dictionary = Levels.build_cells(level, false)
	var res_target: Dictionary = Logic.propagate(
		cells_target, level["source_cell"], level["source_dir"], level["sink_open"])
	var res_init: Dictionary = Logic.propagate(
		cells_init, level["source_cell"], level["source_dir"], level["sink_open"])

	if not res_target["solved"]:
		problems.append("第 %d 关「%s」target 态不可解（关卡无解）" % [index, level["name"]])
	if res_init["solved"]:
		problems.append("第 %d 关「%s」init 态已通关（关卡未开局即解）" % [index, level["name"]])
	if par <= 0:
		problems.append("第 %d 关「%s」par=%d 非正数" % [index, level["name"], par])

	var counts: Dictionary = _count_pieces(level)
	var persona_runs: Dictionary = _persona_runs(index, level, gs)
	for persona_key: String in ["expert", "casual", "novice"]:
		var run: Dictionary = persona_runs[persona_key]
		if not bool(run["machine_consistent"]):
			problems.append("第 %d 关「%s」画像 %s 星级规则机判不一致：stars=%s moves=%s par=%d（或未通关）" % [
				index, level["name"], persona_key, run["stars"], run["moves"], par])
	var search: Dictionary = _search_shorter_solution(level, par)
	var par_optimality: Dictionary = _par_optimality(level, par, search)

	return {
		"index": index,
		"name": level["name"],
		"grid": {"w": level["w"], "h": level["h"], "cells_total": level["w"] * level["h"]},
		"counts": counts,
		"par": par,
		"star_bands": {
			"three_star_max_moves": par,
			"two_star_max_moves": int(ceil(par * 1.5)),
			"two_star_band_width": int(ceil(par * 1.5)) - par,
		},
		"solvability": {
			"target_state_solved": res_target["solved"],
			"init_state_solved": res_init["solved"],
			"init_state_hits_wall": res_init["hits_wall"],
		},
		"beam_shape_at_solution": _beam_shape(res_target),
		"persona_runs": persona_runs,
		"par_optimality": par_optimality,
	}


func _count_pieces(level: Dictionary) -> Dictionary:
	var counts: Dictionary = {"pipes": level["pipes"].size(), "straight": 0, "corner": 0, "tee": 0,
		"walls": level["walls"].size(),
		"empty_cells": level["w"] * level["h"] - level["pipes"].size() - level["walls"].size() - 2}
	for pipe: Dictionary in level["pipes"]:
		counts[pipe["type"]] = int(counts[pipe["type"]]) + 1
	return counts


func _beam_shape(res: Dictionary) -> Dictionary:
	var cells_touched: Dictionary = {}
	var turns: int = 0
	var prev_dir: int = -1
	for segment: Array in res["segments"]:
		var delta: Vector2 = segment[1] - segment[0]
		if prev_dir >= 0 and Vector2(delta).normalized().distance_to(Vector2(Logic.DIR_VEC[prev_dir])) > 0.01:
			turns += 1
		if delta.length() > 0.01:
			prev_dir = _dir_of(delta)
		cells_touched[Vector2i((segment[0] - Logic.CELL_CENTER_OFFSET).floor())] = true
		cells_touched[Vector2i((segment[1] - Logic.CELL_CENTER_OFFSET).floor())] = true
	return {
		"segments": res["segments"].size(),
		"turns": turns,
		"cells_touched": cells_touched.size(),
		"hits_wall_at_solution": res["hits_wall"],
		"solved": res["solved"],
	}


func _dir_of(delta: Vector2) -> int:
	if absf(delta.x) >= absf(delta.y):
		return Logic.DIR_RIGHT if delta.x > 0.0 else Logic.DIR_LEFT
	return Logic.DIR_DOWN if delta.y > 0.0 else Logic.DIR_UP


## 三档玩家画像：走真实 GameState 状态机（start_level → 逐次旋转 → register_rotation），
## 额外试错步用「绕整圈」（4 步净零）实现，保证通关解不变、只多花步数。
func _persona_runs(index: int, level: Dictionary, gs: Node) -> Dictionary:
	var par: int = Levels.par_of(level)
	var runs: Dictionary = {}
	for persona: Dictionary in PERSONAS:
		var run: Dictionary = _run_persona(index, level, gs, int(persona["extra_clicks"]))
		var extra: int = int(persona["extra_clicks"])
		# 解析预期：假设试错全部发生在通关前（未截断时必须成立）。
		run["expect_stars_analytic"] = Logic.stars_for(par + extra, par)
		# 状态机一致性：实测星数必须等于 stars_for(权威步数)（星级规则机判回归）。
		run["machine_consistent"] = bool(run["solved"]) \
			and int(run["stars"]) == Logic.stars_for(int(run["moves"]), par)
		run["matches_model"] = bool(run["solved"]) and not bool(run["solved_early"]) \
			and int(run["stars"]) == int(run["expect_stars_analytic"])
		runs[persona["key"]] = run
	runs["par"] = par
	return runs


func _run_persona(index: int, level: Dictionary, gs: Node, extra_clicks: int) -> Dictionary:
	gs.start_level(index)
	var cells: Dictionary = Levels.build_cells(level, false)
	var spins: int = extra_clicks / 4
	var remainder: int = extra_clicks % 4
	var planned: int = spins * 4 + remainder
	var solved_early: bool = false
	var earned_stars: int = 0  # 当次通关 register_rotation 的返回值（不能读 best_stars：只升不降会被前序画像污染）
	# 先烧掉整圈试错（对第 0 根管绕圈，净零旋转），再补余数（余数步并入第 0 根管的真实解）。
	for click: int in range(planned):
		if gs.solved:
			solved_early = true  # 试错途中就通关了：低 par 关的容错极高，画像模型在此退化
			break
		var first: Dictionary = level["pipes"][0]
		cells[first["cell"]] = {"type": first["type"],
			"rot": Logic.rotated_clockwise(int(cells[first["cell"]]["rot"]))}
		earned_stars = maxi(earned_stars, gs.register_rotation(cells, level))
	# 余数步可能把第 0 根管从目标朝向推走，这里按 clicks_between 补齐到 target 并继续解全局。
	for pipe: Dictionary in level["pipes"]:
		if gs.solved:
			break
		var need: int = Logic.clicks_between(int(cells[pipe["cell"]]["rot"]), int(pipe["target_rot"]))
		for click: int in range(need):
			cells[pipe["cell"]] = {"type": pipe["type"],
				"rot": Logic.rotated_clockwise(int(cells[pipe["cell"]]["rot"]))}
			earned_stars = maxi(earned_stars, gs.register_rotation(cells, level))
	return {
		"extra_clicks": extra_clicks,
		"planned_moves": planned,
		# gs.moves 是权威步数：通关后状态机会忽略后续点击，本地计数会虚高。
		"moves": int(gs.moves),
		"stars": earned_stars,
		"solved": bool(gs.solved),
		"solved_early": solved_early,
		"unlocked_next": bool(gs.is_unlocked(index + 1) and index + 1 < Levels.count()),
	}


## 有界 BFS 更短解搜索：状态 = 各管朝向（≤16 管可编码成 int）。
## 在 par-1 步内穷举完 → 证明 par 就是全局最优（exhausted=true 且 found_shorter=false）；
## 预算耗尽 → 如实报 budget_exhausted，不宣称最优。
func _search_shorter_solution(level: Dictionary, par: int) -> Dictionary:
	var pipes: Array = level["pipes"]
	var n: int = pipes.size()
	if par <= 1:
		# 键形状必须与 bounded_bfs 分支一致（消费方 _par_optimality 直接取值）。
		return {"mode": "trivial", "pipes": n, "par": par, "searched_depth": 0,
			"nodes_explored": 1, "elapsed_ms": 0, "node_budget": SEARCH_NODE_BUDGET,
			"shorter_solution_found": false, "shorter_solution_depth": -1,
			"par_proven_optimal": par == 1,
			"status": "exhausted_proven_optimal" if par == 1 else "budget_exhausted"}
	var init_rots: PackedInt32Array = PackedInt32Array()
	for pipe: Dictionary in pipes:
		init_rots.append(int(pipe["init_rot"]))

	var start_ms: int = Time.get_ticks_msec()
	var visited: Dictionary = {_encode_rots(init_rots): 0}
	var frontier: Array = [init_rots]
	var depth: int = 0
	var nodes: int = 1
	var found_depth: int = -1
	var budget_hit: bool = false

	while depth < par - 1:
		if frontier.is_empty():
			break
		var next_frontier: Array = []
		for state: PackedInt32Array in frontier:
			var stop_layer: bool = false
			for p: int in range(n):
				# 预算护栏放在最内层：单层展开可能远超节点预算，层间检查兜不住。
				if nodes > SEARCH_NODE_BUDGET or Time.get_ticks_msec() - start_ms > SEARCH_TIME_BUDGET_MS:
					budget_hit = true
					stop_layer = true
					break
				var child: PackedInt32Array = state.duplicate()
				child[p] = (child[p] + 1) % 4
				var key: int = _encode_rots(child)
				if visited.has(key):
					continue
				visited[key] = depth + 1
				nodes += 1
				var cells: Dictionary = Levels.build_cells(level, false)
				for q: int in range(n):
					var pipe: Dictionary = pipes[q]
					cells[pipe["cell"]] = {"type": pipe["type"], "rot": child[q]}
				var res: Dictionary = Logic.propagate(
					cells, level["source_cell"], level["source_dir"], level["sink_open"])
				if res["solved"]:
					found_depth = depth + 1
					stop_layer = true
					break
				next_frontier.append(child)
			if stop_layer:
				break
		if found_depth >= 0 or budget_hit:
			break
		frontier = next_frontier
		depth += 1

	var elapsed_ms: int = Time.get_ticks_msec() - start_ms
	var explored_all: bool = frontier.is_empty() and not budget_hit
	return {
		"mode": "bounded_bfs",
		"pipes": n,
		"par": par,
		"searched_depth": depth,
		"nodes_explored": nodes,
		"elapsed_ms": elapsed_ms,
		"node_budget": SEARCH_NODE_BUDGET,
		"shorter_solution_found": found_depth >= 0,
		"shorter_solution_depth": found_depth,
		"par_proven_optimal": explored_all and found_depth < 0,
		"status": "shorter_found" if found_depth >= 0 else ("exhausted_proven_optimal" if explored_all else "budget_exhausted"),
	}


## par 最优性结论（调参发现，非硬契约）：
##   直管有 180° 对称（rot 与 rot+2 开口集合相同），所以「沿既定路线、直管停在最近等效朝向」
##   的走法一定存在，其代价（闭式可算）是 par 的可达上界；声明 par 高于它即证明 par 虚高。
##   BFS 在预算内穷举到更短解时给出精确真最优；预算耗尽则只断言下界，不猜。
func _par_optimality(level: Dictionary, par: int, search: Dictionary) -> Dictionary:
	var symmetry_aware: int = 0
	for pipe: Dictionary in level["pipes"]:
		var raw: int = Logic.clicks_between(int(pipe["init_rot"]), int(pipe["target_rot"]))
		if pipe["type"] == Logic.TYPE_STRAIGHT:
			symmetry_aware += raw % 2  # 直管：等效类差（0 或 1）
		else:
			symmetry_aware += raw
	var bfs_depth: int = int(search.get("shorter_solution_depth", -1))
	var true_par: int = par
	var semantics: String = "proven_exact"
	var status: String = "declared_par_optimal_proven"
	if bfs_depth >= 0:
		true_par = bfs_depth
		status = "shorter_solution_found"
	elif symmetry_aware < par:
		true_par = symmetry_aware  # 可达路线已证明 ≤ symmetry_aware，BFS 未给出更精确值
		semantics = "achievable_upper_bound"  # 真最优 ≤ 该值且该值可达成；精确值未证
		status = "declared_par_inflated_by_symmetry"
	elif search["status"] == "budget_exhausted":
		semantics = "lower_bound_only"  # 只证明了「没有比声明 par 更短的解被找到」；未穷举
		status = "unproven_search_budget_exhausted"
	return {
		"declared_par": par,
		"symmetry_aware_par": symmetry_aware,
		"true_par": true_par,
		"true_par_semantics": semantics,
		"inflation_steps": par - true_par,
		"status": status,
		"bfs": search,
	}


func _encode_rots(rots: PackedInt32Array) -> int:
	var code: int = 0
	for r: int in rots:
		code = (code << 2) | (r & 3)
	return code


func _difficulty_curve(levels_out: Array, problems: Array) -> Dictionary:
	var pars: Array = []
	for entry: Dictionary in levels_out:
		pars.append(int(entry["par"]))
	var deltas: Array = []
	for i: int in range(1, pars.size()):
		deltas.append(int(pars[i]) - int(pars[i - 1]))
	var plateaus: Array = []
	var jumps: Array = []
	for i: int in range(deltas.size()):
		if int(deltas[i]) == 0:
			plateaus.append(i + 1)
		elif int(deltas[i]) >= 4:
			jumps.append({"at_level": i + 1, "delta": int(deltas[i])})
	for i: int in range(1, pars.size()):
		if int(pars[i]) < int(pars[i - 1]):
			problems.append("难度曲线回退：第 %d 关 par=%d < 第 %d 关 par=%d" % [i, pars[i], i - 1, pars[i - 1]])
	# 真 par 曲线（调参视角的难度梯度）：逐关取 par_optimality.true_par
	# （BFS 精确值或对称可达上界）。注意不能用 expert 画像步数：它会提前通关（L8 走 6 步即亮）。
	var true_pars: Array = []
	for entry: Dictionary in levels_out:
		true_pars.append(int(entry["par_optimality"]["true_par"]))
	var true_deltas: Array = []
	for i: int in range(1, true_pars.size()):
		true_deltas.append(int(true_pars[i]) - int(true_pars[i - 1]))
	var true_drops: Array = []
	for i: int in range(true_deltas.size()):
		if int(true_deltas[i]) < 0:
			true_drops.append({"at_level": i + 2, "delta": int(true_deltas[i])})
	return {
		"par_by_level": pars,
		"par_delta": deltas,
		"non_decreasing": jumps.is_empty() and plateaus.size() <= levels_out.size(),
		"plateau_levels": plateaus,
		"steep_jump_levels": jumps,
		"par_total": int(pars[-1]),
		"mechanic_introductions": _mechanic_intros(levels_out),
		"true_par_by_level_expert_moves": true_pars,
		"true_par_delta": true_deltas,
		"true_par_drops": true_drops,
		"true_par_note": "真 par 曲线若非单调（true_par_drops 非空）说明声明 par 的虚高掩盖了实际难度回落；难度还含读盘/推演成分，此曲线只代表点击成本梯度",
	}


func _mechanic_intros(levels_out: Array) -> Array:
	var intros: Array = []
	var seen: Dictionary = {"first_wall": false, "first_tee": false, "grid_growth": false}
	for entry: Dictionary in levels_out:
		var idx: int = int(entry["index"])
		if not bool(seen["first_wall"]) and int(entry["counts"]["walls"]) > 0:
			intros.append({"at_level": idx + 1, "mechanic": "墙体阻挡"})
			seen["first_wall"] = true
		if not bool(seen["first_tee"]) and int(entry["counts"]["tee"]) > 0:
			intros.append({"at_level": idx + 1, "mechanic": "分光三通"})
			seen["first_tee"] = true
		if not bool(seen["grid_growth"]) and idx > 0:
			var prev: Dictionary = levels_out[idx - 1]
			if int(entry["grid"]["cells_total"]) > int(prev["grid"]["cells_total"]):
				intros.append({"at_level": idx + 1, "mechanic": "网格扩容(%dx%d)" % [entry["grid"]["w"], entry["grid"]["h"]]})
				seen["grid_growth"] = true
	return intros


func _star_threshold_analysis(levels_out: Array) -> Dictionary:
	var bands: Array = []
	for entry: Dictionary in levels_out:
		bands.append({"level": int(entry["index"]) + 1, "name": entry["name"],
			"par": int(entry["par"]),
			"two_star_max": int(entry["star_bands"]["two_star_max_moves"]),
			"band_width": int(entry["star_bands"]["two_star_band_width"])})
	var tight: Array = []
	for band: Dictionary in bands:
		if int(band["band_width"]) <= 2:
			tight.append(band)
	var recommended: Array = []
	for entry: Dictionary in levels_out:
		var opt: Dictionary = entry["par_optimality"]
		var tp: int = int(opt["true_par"])
		recommended.append({"level": int(entry["index"]) + 1, "name": entry["name"],
			"true_par": tp,
			"true_par_semantics": String(opt["true_par_semantics"]),
			"recommended_two_star_max": int(ceil(tp * 1.5)),
			"declared_two_star_max": int(entry["star_bands"]["two_star_max_moves"])})
	return {
		"rule": "3 星 = par；2 星 = ≤⌈par×1.5⌉；1 星 = 通关（PuzzleLogic.stars_for 机判）",
		"bands": bands,
		"tight_two_star_levels": tight,
		"recommended_bands_from_true_par": recommended,
		"note": "band_width = ⌈par/2⌉ = 2 星允许的额外步数；≤2 的关卡一次绕圈试错（+4）即掉 1 星",
	}


func _star_distribution(levels_out: Array) -> Dictionary:
	var out: Dictionary = {}
	for persona: Dictionary in PERSONAS:
		var key: String = persona["key"]
		var dist: Dictionary = {"3": 0, "2": 0, "1": 0, "fail": 0}
		for entry: Dictionary in levels_out:
			var run: Dictionary = entry["persona_runs"][key]
			var stars: int = int(run["stars"])
			if not bool(run["solved"]):
				dist["fail"] = int(dist["fail"]) + 1
			else:
				dist[str(stars)] = int(dist[str(stars)]) + 1
		out[key] = dist
	out["personas"] = PERSONAS
	out["note"] = "moves = 按既定路线逐管旋转到通关的实测步数（走生产状态机 register_rotation）；" \
		+ "中途光路已通即判通关，moves 可小于声明 par（直管对称性所致）；" \
		+ "solved_early=true 表示试错步还没烧完就通关了，该关试错成本近乎为零"
	return out


func _human_time_model(levels_out: Array) -> Dictionary:
	var per_level: Array = []
	for entry: Dictionary in levels_out:
		var par: float = float(entry["par"])
		var est: float = MODEL_OBSERVE_S + float(entry["counts"]["pipes"]) * MODEL_DECIDE_S \
			+ float(entry["counts"]["tee"]) * MODEL_TEE_EXTRA_S + par * MODEL_CLICK_S
		per_level.append({"level": int(entry["index"]) + 1, "est_seconds": int(round(est))})
	return {
		"provenance": "model_estimate_not_measurement",
		"formula": "8s 读盘 + 3s×管数 + 6s×三通数 + 1s×par 步",
		"parameters": {"observe_s": MODEL_OBSERVE_S, "decide_s_per_pipe": MODEL_DECIDE_S,
			"tee_extra_s": MODEL_TEE_EXTRA_S, "click_s": MODEL_CLICK_S},
		"per_level": per_level,
		"usage": "仅用于找节奏断档（相邻关估算时长跳变 >45s 视为陡增），不能当玩家实测数据",
	}
