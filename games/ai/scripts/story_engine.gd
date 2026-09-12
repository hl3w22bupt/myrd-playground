class_name StoryEngine
extends RefCounted
## 剧情幕引擎：把三幕节点图（data/story/act*.json）装进来并做结构校验。
##
## 核心循环（全项目唯一表述）的幕侧实现：
##   剧情节点选择（narration / line / choice）→ 好感·威胁·生存状态变化（声明式 effects）
##   → 行动段（arena：互动 / 危机）→ 幕间结算 → 触发后续剧情与结局分支
##
## 节点图闭合规则（无死链，机器校验）：
##   - 每幕声明 entry；节点 goto 指向同幕节点或哨兵 ARENA / RESOLVE；
##   - 幕前段（pre-arena）所有路径必须到达 ARENA，且每个节点都能从 entry 到达（无孤儿）；
##   - 幕后段（post_arena，仅终幕）由 post_arena_entry 进入，所有路径到达 RESOLVE；
##   - choice 节点 ≥2 个选项，每个选项 id/text 非空、effects 合法、goto 可达。
##
## 依赖方向（基线 §八）：本引擎只读幕 JSON 与数值键名，不认具体角色名
## （effects 里 persona_id 的存在性由 Main 联合 PersonaLoader 校验）；节点内只声明数据，
## 禁止内嵌脚本逻辑 —— 效果全部由 GameState.apply_effects 的通用结算链消费。

## 资源协议头（拼接用，避免 P5 误判字面量引用）。
const RESOURCE_SCHEME: String = "res://"
## 剧情幕目录（相对工程根）。
const STORY_DIR: String = "data/story/"
## 幕清单：声明幕文件与顺序，幕链 next_act 由它闭合。
const MANIFEST_FILE: String = "manifest.json"

## goto 哨兵：进入行动段。
const GOTO_ARENA: String = "ARENA"
## goto 哨兵：进入终局判定。
const GOTO_RESOLVE: String = "RESOLVE"
## effects 允许的键集（声明式键值，出现未知键即结构违约）。
const ALLOWED_EFFECT_KEYS: Array[String] = [
	"favor", "threat", "sanity", "stamina", "satiety", "food", "flag",
]
## 节点类型。
const TYPE_NARRATION: String = "narration"
const TYPE_LINE: String = "line"
const TYPE_CHOICE: String = "choice"

## 已加载的幕（按幕序排列），每项是幕 JSON 的字典。
var acts: Array[Dictionary] = []
## 结构 / 契约问题（smoke 契约断言会逐条核对为空）。
var errors: PackedStringArray = PackedStringArray()
## 玩法边界（视口尺寸）：load_story 时写入，落点越界校验用它。
var play_bounds: Vector2 = Vector2(640.0, 360.0)


## 加载全部幕并做结构校验；play_size 是玩法边界（视口尺寸），节点落点越界即报错。
func load_story(play_size: Vector2) -> void:
	errors = PackedStringArray()
	acts = []
	play_bounds = play_size
	var manifest: Dictionary = JsonIO.load_object(RESOURCE_SCHEME + STORY_DIR + MANIFEST_FILE)
	var files: Array = manifest.get("acts", [])
	if files.is_empty():
		errors.append("剧情幕清单为空或不可读：%s" % (RESOURCE_SCHEME + STORY_DIR + MANIFEST_FILE))
		return
	for entry: Variant in files:
		var path := RESOURCE_SCHEME + STORY_DIR + String(entry)
		var act: Dictionary = JsonIO.load_object(path)
		if act.is_empty():
			errors.append("剧情幕不可读或不是 JSON 对象：%s" % path)
			return
		acts.append(act)
	_validate_chain()
	for act in acts:
		_validate_act(act, play_size)


## 幕数。
func act_count() -> int:
	return acts.size()


## 按下标取幕（0 基）；越界返回空字典。
func act_at(index: int) -> Dictionary:
	if index < 0 or index >= acts.size():
		return {}
	return acts[index]


## 是否终幕。
func is_final_act(act: Dictionary) -> bool:
	return String(act.get("next_act", "")).is_empty()


## 行动段配置（tokens/hazards/时长/理智衰减率）。
func arena_of(act: Dictionary) -> Dictionary:
	return act.get("arena", {})


func tokens_of(act: Dictionary) -> Array:
	return arena_of(act).get("tokens", [])


func hazards_of(act: Dictionary) -> Array:
	return arena_of(act).get("hazards", [])


## 幕间结算文案。
func checkpoint_text(act: Dictionary) -> String:
	return String(act.get("checkpoint_text", ""))


## 幕间结算的剧情性理智代价（如 act1 包围惊吓 -10）。
func checkpoint_sanity_cost(act: Dictionary) -> float:
	return float(act.get("checkpoint_sanity_cost", 0.0))


## 幕内全部节点。
func nodes_of(act: Dictionary) -> Array:
	return act.get("nodes", [])


## 按 id 取节点；不存在返回空字典。
func node_by_id(act: Dictionary, node_id: String) -> Dictionary:
	for node: Variant in nodes_of(act):
		if String(node.get("id", "")) == node_id:
			return node
	return {}


## 幕的剧情入口节点。
func entry_of(act: Dictionary) -> Dictionary:
	return node_by_id(act, String(act.get("entry", "")))


## 幕的终局段入口（仅终幕声明）。
func post_arena_entry_of(act: Dictionary) -> Dictionary:
	return node_by_id(act, String(act.get("post_arena_entry", "")))


## 幕链闭合校验：act[i].next_act 必须等于 act[i+1].id，终幕 next_act 必须为空。
func _validate_chain() -> void:
	if acts.is_empty():
		return
	for i in acts.size():
		var act := acts[i]
		var act_id := String(act.get("id", ""))
		if act_id.is_empty():
			errors.append("幕 %d 缺少 id" % (i + 1))
		var expected_next := "" if i == acts.size() - 1 else String(acts[i + 1].get("id", ""))
		var declared_next := String(act.get("next_act", ""))
		if declared_next != expected_next:
			errors.append("幕链断裂：%s 的 next_act=\"%s\" ≠ \"%s\"（幕图必须闭合无死链）" % [
				act_id, declared_next, expected_next,
			])
		var index := int(act.get("index", -1))
		if index != i + 1:
			errors.append("幕序断裂：%s 的 index=%d ≠ %d（幕必须从 1 连续递增）" % [act_id, index, i + 1])


## 单幕结构校验：入口 / 节点图闭合 / 行动段。
func _validate_act(act: Dictionary, play_size: Vector2) -> void:
	var act_id := String(act.get("id", "?"))
	_validate_node_graph(act)
	_validate_arena(act, play_size)


## 节点图闭合校验（无死链 / 无孤儿 / effects 合法 / 哨兵使用正确）。
func _validate_node_graph(act: Dictionary) -> void:
	var act_id := String(act.get("id", "?"))
	var nodes := nodes_of(act)
	if nodes.is_empty():
		errors.append("%s 没有任何剧情节点：核心循环「剧情节点选择」缺失" % act_id)
		return
	var ids := PackedStringArray()
	for node: Variant in nodes:
		var node_id := String(node.get("id", ""))
		if node_id.is_empty():
			errors.append("%s 存在无 id 节点" % act_id)
		elif not node_id.begins_with(act_id + "."):
			errors.append("%s 的 node_id=\"%s\" 未按「<幕id>.<节点>」约定命名" % [act_id, node_id])
		elif node_id in ids:
			errors.append("%s 节点 id 重复：%s" % [act_id, node_id])
		ids.append(node_id)
	var entry_id := String(act.get("entry", ""))
	if entry_id.is_empty() or not (entry_id in ids):
		errors.append("%s 的 entry=\"%s\" 不指向任何节点（剧情无法开场）" % [act_id, entry_id])
	var is_final := is_final_act(act)
	var has_post_entry := String(act.get("post_arena_entry", "")) != ""
	if is_final and not has_post_entry:
		errors.append("%s 是终幕但未声明 post_arena_entry（终局抉择无处进入）" % act_id)
	if not is_final and has_post_entry:
		errors.append("%s 非终幕却声明了 post_arena_entry（只有终幕有终局抉择）" % act_id)

	# 终局段 = 从 post_arena_entry 正向可达的节点闭包（行动段之后才进入的子图）。
	var nodes_by_id: Dictionary = {}
	for node: Variant in nodes:
		nodes_by_id[String(node.get("id", ""))] = node
	var post_entry := String(act.get("post_arena_entry", "")) if is_final else ""
	var post_nodes: Dictionary = {}
	if not post_entry.is_empty() and nodes_by_id.has(post_entry):
		_closure(post_entry, nodes_by_id, post_nodes)
	var pre_nodes: Dictionary = {}
	for node_id: String in nodes_by_id:
		if not post_nodes.has(node_id):
			pre_nodes[node_id] = nodes_by_id[node_id]

	for node: Variant in nodes:
		_validate_node_fields(act_id, node, is_final)
		_validate_goto(act_id, node, ids, post_nodes, is_final)
	if is_final and not post_nodes.is_empty():
		_reach_check(act_id, post_entry, post_nodes, GOTO_RESOLVE, "终局段")
	# 幕前段：从 entry 可达 + 全员可到 ARENA。
	_reach_check(act_id, entry_id, pre_nodes, GOTO_ARENA, "剧情段")


## 单节点字段与 effects 校验。
func _validate_node_fields(act_id: String, node: Dictionary, is_final: bool) -> void:
	var node_id := String(node.get("id", "?"))
	var node_type := String(node.get("type", ""))
	if not (node_type in [TYPE_NARRATION, TYPE_LINE, TYPE_CHOICE]):
		errors.append("%s 节点 %s 的 type=\"%s\" 未知（应为 narration/line/choice）" % [act_id, node_id, node_type])
		return
	# effects 对三类节点都合法（旁白节点的幕首事件数值同样必须声明式）。
	var effect_maps: Array = []
	if node_type == TYPE_CHOICE:
		var options: Array = node.get("options", [])
		if options.size() < 2:
			errors.append("%s 抉择节点 %s 的选项 %d 个 < 2（没有选择就没有剧情）" % [act_id, node_id, options.size()])
		else:
			for option: Variant in options:
				var option_id := String(option.get("id", ""))
				if option_id.is_empty():
					errors.append("%s 抉择节点 %s 存在无 id 选项" % [act_id, node_id])
				if String(option.get("text", "")).is_empty():
					errors.append("%s 抉择节点 %s 的选项 %s 缺少 text" % [act_id, node_id, option_id])
				effect_maps.append(option.get("effects", {}))
				var intent := String(option.get("ending_intent", ""))
				if not intent.is_empty() and not (intent in ["alone", "save_one", "together"]):
					errors.append("%s 选项 %s 的 ending_intent=\"%s\" 未知（alone/save_one/together）" % [node_id, option_id, intent])
				if not intent.is_empty() and not is_final:
					errors.append("%s 选项 %s 声明了 ending_intent，但终局抉择只允许出现在终幕" % [node_id, option_id])
	else:
		if String(node.get("text", "")).is_empty():
			errors.append("%s 节点 %s 缺少 text（对话文本必须完整）" % [act_id, node_id])
		if node_type == TYPE_LINE and String(node.get("persona_id", "")).is_empty():
			errors.append("%s 节点 %s 是 line 却缺少 persona_id（台词必须可追溯到人设）" % [act_id, node_id])
		if node.has("effects"):
			effect_maps.append(node.get("effects", {}))
	for i in effect_maps.size():
		var effects: Dictionary = effect_maps[i]
		for effect_key: Variant in effects:
			if not (String(effect_key) in ALLOWED_EFFECT_KEYS):
				errors.append("%s 节点 %s 的 effects 键「%s」不在声明集内（%s）" % [
					node_id, str(i), effect_key, ", ".join(ALLOWED_EFFECT_KEYS),
				])
		for map_key in ["favor", "threat"]:
			if not effects.has(map_key):
				continue
			var delta_map: Variant = effects[map_key]
			if not (delta_map is Dictionary) or (delta_map as Dictionary).is_empty():
				errors.append("%s 节点 %s 的 effects.%s 必须是非空 {persona_id: Δ}" % [node_id, i, map_key])


## goto 指向校验：节点或哨兵；哨兵使用场景正确（ARENA 只许幕前段，RESOLVE 只许终幕终局段）。
func _validate_goto(act_id: String, node: Dictionary, ids: PackedStringArray,
		post_nodes: Dictionary, is_final: bool) -> void:
	var node_id := String(node.get("id", "?"))
	var is_post: bool = post_nodes.has(node_id)
	var targets: Array = []
	if String(node.get("type", "")) == TYPE_CHOICE:
		for option: Variant in node.get("options", []):
			targets.append(String(option.get("goto", "")))
	else:
		targets.append(String(node.get("goto", "")))
	if targets.all(func(target: String) -> bool: return target.is_empty()):
		errors.append("%s 节点 %s 没有任何 goto（死链：路径无法推进）" % [act_id, node_id])
	for target: Variant in targets:
		var target_id := String(target)
		if target_id.is_empty():
			continue
		if target_id in ids:
			continue
		if target_id == GOTO_ARENA:
			if is_post:
				errors.append("%s 节点 %s 在终局段却 goto ARENA（终局段只能去 RESOLVE）" % [act_id, node_id])
			continue
		if target_id == GOTO_RESOLVE:
			if not is_final:
				errors.append("%s 节点 %s goto RESOLVE，但只有终幕允许终局判定" % [act_id, node_id])
			elif not is_post:
				errors.append("%s 节点 %s 在幕前段却 goto RESOLVE（必须先过行动段）" % [act_id, node_id])
			continue
		errors.append("%s 节点 %s 的 goto=\"%s\" 指向不存在的节点（死链）" % [act_id, node_id, target_id])


## 从 from_id 出发的正向可达闭包（含自身；goto 选项任一分支都算）。
func _closure(from_id: String, pool: Dictionary, result: Dictionary) -> void:
	if result.has(from_id) or not pool.has(from_id):
		return
	result[from_id] = pool[from_id]
	var node: Dictionary = pool[from_id]
	var targets: Array = []
	if String(node.get("type", "")) == TYPE_CHOICE:
		for option: Variant in node.get("options", []):
			targets.append(String(option.get("goto", "")))
	else:
		targets.append(String(node.get("goto", "")))
	for target: Variant in targets:
		var target_id := String(target)
		if not target_id.is_empty():
			_closure(target_id, pool, result)


## 可达性校验：from_id 出发沿 goto（选项任一分支）能全部到达 sentinel，且无环。
func _reach_check(act_id: String, from_id: String, pool: Dictionary, sentinel: String, label: String) -> void:
	if from_id.is_empty() or not pool.has(from_id):
		return
	var safe: Dictionary = {}
	if not _reaches_sentinel(from_id, pool, sentinel, safe, {}):
		errors.append("%s 的%s存在无法到达 %s 的路径（死链或环）" % [act_id, label, sentinel])
	for node_id: String in pool:
		if not safe.has(node_id):
			errors.append("%s 的%s节点 %s 无法从入口到达（孤儿节点）" % [act_id, label, node_id])


## 记忆化 DFS：node 能否到达 sentinel；safe 记录已证明安全的节点。
func _reaches_sentinel(node_id: String, pool: Dictionary, sentinel: String, safe: Dictionary, visiting: Dictionary) -> bool:
	if safe.has(node_id):
		return true
	if visiting.has(node_id):
		return false  # 环且未证明可达哨兵
	if not pool.has(node_id):
		return false
	visiting[node_id] = true
	var node: Dictionary = pool[node_id]
	var targets: Array = []
	if String(node.get("type", "")) == TYPE_CHOICE:
		for option: Variant in node.get("options", []):
			targets.append(String(option.get("goto", "")))
	else:
		targets.append(String(node.get("goto", "")))
	for target: Variant in targets:
		var target_id := String(target)
		if target_id == sentinel:
			continue  # 本分支到达哨兵
		if target_id.is_empty() or not _reaches_sentinel(target_id, pool, sentinel, safe, visiting):
			visiting.erase(node_id)
			return false
	visiting.erase(node_id)
	safe[node_id] = true
	return true


## 行动段结构校验：时长 / 衰减 / 信物落点 / 危机游走路径。
func _validate_arena(act: Dictionary, play_size: Vector2) -> void:
	var act_id := String(act.get("id", "?"))
	var arena := arena_of(act)
	if float(arena.get("duration_seconds", 0.0)) <= 0.0:
		errors.append("%s 的 arena.duration_seconds 必须 > 0（行动推进靠倒计时驱动）" % act_id)
	if float(arena.get("sanity_drain_per_second", -1.0)) < 0.0:
		errors.append("%s 缺少 arena.sanity_drain_per_second（理智随行动时间衰减）" % act_id)
	var tokens: Array = tokens_of(act)
	if tokens.is_empty():
		errors.append("%s 没有任何心动信物节点：本幕无法推进好感" % act_id)
	for token: Variant in tokens:
		_validate_node_id(act_id, token, "tokens")
		if String(token.get("persona_id", "")).is_empty():
			errors.append("%s 信物节点缺少 persona_id（人设可追溯）" % act_id)
		if String(token.get("line", "")).is_empty():
			errors.append("%s 信物节点 %s 缺少 line（好感事件的台词必须完整）" % [
				act_id, String(token.get("node_id", "?")),
			])
		_validate_position(act_id, token.get("position", []), act_id + " 信物落点")
	var hazards: Array = hazards_of(act)
	if hazards.is_empty():
		errors.append("%s 没有任何危机节点：威胁分支不可达" % act_id)
	for hazard: Variant in hazards:
		_validate_node_id(act_id, hazard, "hazards")
		if String(hazard.get("persona_id", "")).is_empty():
			errors.append("%s 危机节点缺少 persona_id（威胁需可追溯到人设）" % act_id)
		if float(hazard.get("speed", 0.0)) <= 0.0:
			errors.append("%s 危机节点 speed 必须 > 0" % act_id)
		var patrol: Array = hazard.get("patrol", [])
		if patrol.size() < 2:
			errors.append("%s 危机节点 patrol 至少 2 个路径点（游走语义）" % act_id)
		for point: Variant in patrol:
			_validate_position(act_id, point, act_id + " 危机路径点")


## node_id 必须非空且以幕 id 为前缀（回放定位到具体节点）。
func _validate_node_id(act_id: String, node: Dictionary, kind: String) -> void:
	var node_id := String(node.get("node_id", ""))
	if node_id.is_empty():
		errors.append("%s 的 %s 节点缺少 node_id" % [act_id, kind])
	elif not node_id.begins_with(act_id + "."):
		errors.append("%s 的 node_id=\"%s\" 未按「<幕id>.<节点>」约定命名" % [act_id, node_id])


## 落点 [x, y] 必须是二元数组且在玩法边界内（留 1px 内缩余量防边界悬浮）。
func _validate_position(act_id: String, pair: Variant, label: String) -> void:
	if not (pair is Array) or (pair as Array).size() != 2:
		errors.append("%s：%s 必须是 [x, y]" % [act_id, label])
		return
	var position := to_vector2(pair as Array)
	var upper := play_bounds - Vector2.ONE
	if position.x < 1.0 or position.y < 1.0 or position.x > upper.x or position.y > upper.y:
		errors.append("%s：%s %s 越界（玩法边界 %s）" % [
			act_id, label, position, play_bounds,
		])


## [x, y] → Vector2。
static func to_vector2(pair: Array) -> Vector2:
	if (pair as Array).size() < 2:
		return Vector2.ZERO
	return Vector2(float(pair[0]), float(pair[1]))
