extends Node
## 无头冒烟自检（headless smoke）—— 机器可判定的「游戏能不能跑、玩不玩得动、对不对」。
##
## 运行方式（由 std-skills/godot-game-dev/scripts/smoke.sh 封装）：
##   godot --headless --path <工程目录> tests/smoke.tscn
##
## 判定协议（smoke.sh 按此断言退出码与日志）：
##   通过 → stdout 打印 `GODOT_SMOKE: PASS ...`，进程退出码 0
##   失败 → stderr 打印 `GODOT_SMOKE: FAIL <原因>`（每条一行），进程退出码 1
##
## 断言覆盖面（契约五件 + 链路三条 + 行为九组）：
##   [契约] 数值契约：data/spec/numeric.json 键名 ↔ GameState 字段一一对应且值一致
##   [契约] 人设契约：≥5 张卡、schema 必填 ≥9 字段（覆盖需求 5 字段）、schema 驱动校验、
##          swap 换卡免改码、美术清单齐全（立绘 1 + 头像 1 + 表情差分 ≥2 且文件存在）
##   [契约] 剧情契约：3 幕、幕链与节点图闭合无死链、无孤儿节点、每幕 ≥1 抉择、
##          effects 全为声明式键值、5 位女友每幕都有台词、落点在玩法边界内、出生净空
##   [契约] 结局契约：4 结局齐全 + resolver 优先级链四判（清除/永生/带走/独活）
##   [契约] 素材契约：场景内占位方块（Polygon2D）残留 = 0，玩家/信物/危机全部为
##          AnimatedSprite2D 多帧动画（玩家 idle+walk，信物 idle 呼吸，危机 walk 巡逻）
##   [演算] 链路A（逃跑）→ ALONE、链路B（带走林小暖）→ SAVE_ONE（favor 96 / threat 30）、
##          链路C（全线强硬）→ GAMEOVER —— 脚本驱动固定选择序列，≥2 个不同结局可复现
##   [行为] 1 场景接线：主场景/玩家/UI(CanvasLayer)/对话框/花名册/标题/结局
##   [行为] 2 移动：InputMap → 位移 → moved 信号到达
##   [行为] 3 抉择 UI：真实按键注入（confirm / option_N）推进剧情节点与选项结算
##   [行为] 4 互动：接触心动信物 → 该人设 favor+（互动增益）+ 理智回复、信物消失、台词气泡
##   [行为] 5 危机：闯入游走危机 → 该人设 threat+、理智下降
##   [行为] 6 边界钳制 + 幕推进（倒计时 → 幕间结算 → 下一幕）
##   [行为] 7 全程到结局：剧情→行动→幕间→终局抉择 → 独活结局 + 结局画面
##   [行为] 8 冻结不变量：结局后一切写入被丢弃
##   [行为] 9 重开可用：confirm → 初值复位、玩家回出生点、trace 清空、横幅隐藏
##   [行为] 10 触摸（移动端）：TouchUI 可见性协议（is_touchscreen_available）、画面内点按推进、
##          选项热区 ≥44 物理像素且不重叠、虚拟摇杆全链路（真实 ScreenTouch/ScreenDrag →
##          多轴动作强度并行 → 玩家位移；死区/滑出续跟/松手归零/二指不抢控/点按零泄漏）
##   [行为] 14 移动平滑（四轮·范围三）：位移 ≤ move_speed×时间上限、起步加速/松杆减速缓动、
##          idle/walk 帧动画随速度切换且帧前进、转身 facing 连续过渡（单帧无硬跳、必过 0）
##   [行为] 15 排版自适应（四轮·范围一）：3 档画布 × 3 档 DPR × 最长剧情文本 →
##          fits（零裁字）、字号在内容化区间内、choice 面板不侵入选项热区、
##          真实场景字号/文本框/面板几何一致（resize 重排同源代码路径）
##
## ⚠️ 输入注入分阶段、互不重叠（references/error-signatures.md E-08）。

## 阶段：按住 move_right 的帧数（30 帧 = 0.5s @60fps → 期望位移 ≥100px）。
const MOVE_FRAMES: int = 30
## 阶段：判定「真的移动了」的最小 x 增量（px）。
const MIN_MOVE_DISTANCE: float = 100.0
## 阶段：垂直于预期方向的容差（px）。
const MOVE_AXIS_EPSILON: float = 1.0
## 传送玩家后等待 Area2D 物理重叠判定的帧数。
const OVERLAP_FRAMES: int = 4
## 注入一次输入事件后等待处理的帧数。
const INPUT_FRAMES: int = 3
## 出生净空（px）：出生点与所有信物/危机路径点的最小距离。
const BIRTH_CLEARANCE: float = 100.0

const REQUIRED_ACTIONS: Array[StringName] = [
	&"move_left", &"move_right", &"move_up", &"move_down", &"confirm",
	&"option_1", &"option_2", &"option_3", &"option_4",
]

## 键位契约：动作 → 键表承诺的物理键（逐键 AND）。
const KEY_CONTRACT: Dictionary = {
	&"move_left": [KEY_A, KEY_LEFT],
	&"move_right": [KEY_D, KEY_RIGHT],
	&"move_up": [KEY_W, KEY_UP],
	&"move_down": [KEY_S, KEY_DOWN],
	&"confirm": [KEY_SPACE, KEY_ENTER],
	&"option_1": [KEY_1],
	&"option_2": [KEY_2],
	&"option_3": [KEY_3],
	&"option_4": [KEY_4],
}

## 需求硬约束的人设卡最小字段集（schema required 必须覆盖它们）。
const REQUIRED_PERSONA_FIELDS: Array[String] = [
	"name", "personality_tags", "speech_style", "favor_rules", "threat_rules",
]
## 人设卡契约的最少必填字段数（schema v2 声明 11 个）。
const MIN_PERSONA_REQUIRED_FIELDS: int = 9
## 每位女友最少表情差分数（需求：表情差分 ≥2）。
const MIN_EXPRESSIONS: int = 2

var _failures: PackedStringArray = []
## 关键前置缺失时置位：跳过后续行为阶段，直接出报告。
var _abort: bool = false
var _main: Node2D
var _player: Player
var _personas: PersonaLoader = PersonaLoader.new()
var _story: StoryEngine = StoryEngine.new()
var _origin: Vector2 = Vector2.ZERO
var _moved_seen: bool = false
var _favor_signal_seen: bool = false
var _ended_name: String = ""
var _act_expired_seen: bool = false
## 终局抉择的意向（链路重放时由脚本写入）。
var _ending_intent: String = ""
## 行动段物件的多帧动画体（素材契约检查用；信物在收集前判定，收集后节点会被销毁）。
var _last_hazard_multiframe: bool = false
var _last_token_multiframe: bool = false
## 多帧动画的最少帧数（需求：idle/walk ≥2 类多帧动画，逐类帧数 ≥2）。
const MULTIFRAME_MIN_FRAMES: int = 2
## 人设 id（按 manifest 声明序取位，冒烟脚本不写死任何角色名 —— 基线 §八铁律）。
var _id_heal: String = ""        # 治愈系（manifest 第 1 张卡）
var _id_energetic: String = ""   # 活泼系（manifest 第 4 张卡）


func _ready() -> void:
	Engine.max_fps = 60
	_personas.load_catalog()
	var persona_ids := _personas.persona_ids()
	if persona_ids.size() >= 4:
		_id_heal = persona_ids[0]
		_id_energetic = persona_ids[3]
	_story.load_story(GameState.play_area_size())
	_check_static_contracts()
	_check_ending_resolver()
	_check_replay_chains()
	if not _failures.is_empty():
		_report()
		return
	_run()


## —— 静态契约 ——
func _check_static_contracts() -> void:
	_check_input_map()
	_check_autoload()
	_check_numeric_contract()
	_check_persona_contract()
	_check_story_contract()
	_check_scene_wiring()


func _check_input_map() -> void:
	for action in REQUIRED_ACTIONS:
		if not InputMap.has_action(action):
			_failures.append("InputMap 缺少动作 %s（project.godot [input] 未注册）" % action)
	for action: StringName in KEY_CONTRACT:
		if not InputMap.has_action(action):
			continue
		var expected: Array = KEY_CONTRACT[action]
		var bound: Array[Key] = []
		for event in InputMap.action_get_events(action):
			var key := event as InputEventKey
			if key != null and key.physical_keycode != KEY_NONE:
				bound.append(key.physical_keycode)
		for key: Key in expected:
			if not (key in bound):
				_failures.append("键位契约：动作 %s 未绑定承诺的物理键 %s" % [action, OS.get_keycode_string(key)])


func _check_autoload() -> void:
	var game_state := get_tree().root.get_node_or_null("GameState")
	if game_state == null:
		_failures.append("autoload GameState 未注册（project.godot [autoload] 缺失）")
		_abort = true
		return
	for signal_name in ["stamina_changed", "satiety_changed", "sanity_changed", "food_changed",
			"favor_changed", "threat_changed", "act_changed", "act_time_changed",
			"act_timer_expired", "flag_changed", "game_ended", "trace_written"]:
		if not game_state.has_signal(signal_name):
			_failures.append("autoload GameState 缺少信号 %s" % signal_name)
	game_state.favor_changed.connect(_on_favor_changed)
	game_state.game_ended.connect(_on_game_ended)
	game_state.act_timer_expired.connect(_on_act_expired)


## 数值契约：spec.numeric 键名 ↔ GameState 字段一一对应（双向），值一致。
func _check_numeric_contract() -> void:
	var table: Dictionary = JsonIO.load_object(
		JsonIO.RESOURCE_SCHEME + GameState.NUMERIC_DIR + GameState.NUMERIC_FILE)
	if table.is_empty():
		_failures.append("数值表不可读：%s%s（spec.numeric 单一事实源缺失）" % [
			GameState.NUMERIC_DIR, GameState.NUMERIC_FILE,
		])
		return
	for key: String in GameState.NUMERIC_DEFAULTS:
		if not (key in GameState):
			_failures.append("数值契约：表键「%s」在 GameState 没有同名字段（键名必须一一对应）" % key)
			continue
		if not table.has(key):
			_failures.append("数值契约：数值表缺少键「%s」" % key)
		elif not is_equal_approx(float(table[key]), float(GameState.get(key))):
			_failures.append("数值契约：键「%s」表值 %s ≠ GameState.%s = %s（改表必须同步默认值语义）" % [
				key, table[key], key, GameState.get(key),
			])
	for key: String in table:
		if key.begins_with("_"):
			continue
		if not GameState.NUMERIC_DEFAULTS.has(key):
			_failures.append("数值契约：数值表出现未知键「%s」（GameState 没有同名字段）" % key)
	if not GameState.numeric_contract_errors.is_empty():
		for error in GameState.numeric_contract_errors:
			_failures.append("数值契约（运行时核对）：%s" % error)


## 人设契约：schema 驱动、≥5 张卡、需求 5 字段被必填集覆盖、swap 换卡免改码、美术清单齐全。
func _check_persona_contract() -> void:
	for error in _personas.errors:
		_failures.append("人设契约（加载器）：%s" % error)
	if not _personas.schema_loaded:
		_failures.append("人设契约：schema 未生效（persona_loader 必须由 data/schema/persona.schema.json 驱动校验）")
	if _personas.required_fields.size() < MIN_PERSONA_REQUIRED_FIELDS:
		_failures.append("人设契约：schema 必填字段 %d 个 < %d 个（需求 5 字段 + 主题色/口头禅/立绘派生源）" % [
			_personas.required_fields.size(), MIN_PERSONA_REQUIRED_FIELDS,
		])
	for field in REQUIRED_PERSONA_FIELDS:
		if not (field in _personas.required_fields):
			_failures.append("人设契约：需求硬约束字段「%s」不在 schema 必填集里" % field)
	if _personas.persona_count() < _personas.MIN_CATALOG_SIZE:
		_failures.append("人设契约：人设卡 %d 张 < %d 张（需求：多位 AI 女友）" % [
			_personas.persona_count(), _personas.MIN_CATALOG_SIZE,
		])
	_check_art_assets()
	_swap_test()


## 美术清单：每位女友立绘 1 + 头像 1 + 表情差分 ≥2，文件全部真实存在（需求 AC3）。
func _check_art_assets() -> void:
	for persona_id: String in _personas.cards:
		var portrait := _personas.portrait_path(persona_id)
		var avatar := _personas.avatar_path(persona_id)
		var expressions := _personas.expression_paths(persona_id)
		if portrait.is_empty() or not FileAccess.file_exists(portrait):
			_failures.append("素材契约：%s 立绘缺失或文件不存在（%s）" % [persona_id, portrait])
		if avatar.is_empty() or not FileAccess.file_exists(avatar):
			_failures.append("素材契约：%s 头像缺失或文件不存在（%s）" % [persona_id, avatar])
		if expressions.size() < MIN_EXPRESSIONS:
			_failures.append("素材契约：%s 表情差分 %d 张 < %d 张" % [persona_id, expressions.size(), MIN_EXPRESSIONS])
		for expression: Variant in expressions:
			var path := String(expression)
			if path.is_empty() or not FileAccess.file_exists(path):
				_failures.append("素材契约：%s 表情差分文件不存在（%s）" % [persona_id, path])


## swap 换卡测试：把某张卡改一个字段写到 user:// 再走加载器 —— 行为必须变化，且零代码改动。
func _swap_test() -> void:
	var persona_id := ""
	for id: String in _personas.cards:
		persona_id = id
		break
	if persona_id.is_empty():
		return
	var original_card: Dictionary = (_personas.persona(persona_id) as Dictionary).duplicate(true)
	var original_line := String(original_card.get("catchphrase", ""))
	var swapped_card: Dictionary = original_card.duplicate(true)
	swapped_card["catchphrase"] = "swap-test：这一句由测试改写，不涉及任何代码。"
	var swap_path := "user://smoke-swap-persona.json"
	var file := FileAccess.open(swap_path, FileAccess.WRITE)
	if file == null:
		_failures.append("人设 swap 测试无法写入 %s（user:// 不可写）" % swap_path)
		return
	file.store_string(JSON.stringify(swapped_card))
	file.close()
	var reloaded: Dictionary = _personas.load_card_from_path(swap_path)
	if reloaded.is_empty():
		_failures.append("人设 swap 测试：改卡后加载失败：%s" % str(_personas.errors))
	elif String(reloaded.get("catchphrase", "")) == original_line:
		_failures.append("人设 swap 测试：改卡后 catchphrase 未变化（换卡免改码失效）")
	elif String((_personas.persona(persona_id) as Dictionary).get("catchphrase", "")) != original_line:
		_failures.append("人设 swap 测试：单卡替换污染了目录里的原卡")
	DirAccess.remove_absolute(ProjectSettings.globalize_path(swap_path))


## 剧情契约：3 幕、引擎结构校验、每幕 ≥1 抉择、全剧 ≥6 抉择、
## 5 位女友每幕有台词、effects 人设引用有效、行动段齐备、难度有梯度。
func _check_story_contract() -> void:
	for error in _story.errors:
		_failures.append("剧情契约（引擎校验）：%s" % error)
	if _story.act_count() < 3:
		_failures.append("剧情契约：幕数 %d < 3（三幕骨架「包围 → 裂痕 → 倒计时」缺失）" % _story.act_count())
		return
	var total_choices := 0
	for act in _story.acts:
		var act_id := String(act.get("id", "?"))
		var act_choices := 0
		var speakers := {}
		for node: Variant in _story.nodes_of(act):
			var node_type := String(node.get("type", ""))
			if node_type == StoryEngine.TYPE_CHOICE:
				act_choices += 1
			elif node_type == StoryEngine.TYPE_LINE:
				speakers[String(node.get("persona_id", ""))] = true
			# effects 引用的人设必须存在（引擎不认角色名，这里联合人设目录核对）。
			_collect_effect_persona_refs(act_id, node)
		total_choices += act_choices
		if act_choices < 1:
			_failures.append("剧情契约：%s 没有任何抉择节点（核心循环「剧情节点选择」缺失）" % act_id)
		for persona_id: String in _personas.cards:
			if not speakers.has(persona_id):
				_failures.append("剧情契约：%s 里 %s 没有台词（五位女友每幕都要出场说话）" % [act_id, persona_id])
		var arena: Dictionary = _story.arena_of(act)
		if arena.is_empty():
			_failures.append("剧情契约：%s 缺少行动段（生存挑战层缺失）" % act_id)
		if _story.tokens_of(act).is_empty() or _story.hazards_of(act).is_empty():
			_failures.append("剧情契约：%s 行动段信物/危机缺失（好感与威胁分支不可达）" % act_id)
	if total_choices < 6:
		_failures.append("剧情契约：全剧抉择节点 %d 个 < 6 个（策划案 6 大抉择点的覆盖面不足）" % total_choices)
	_check_difficulty_gradient()


## 收集节点 / 选项 effects 里 favor·threat 映射引用的人设 id，逐个核对存在性。
func _collect_effect_persona_refs(act_id: String, node: Dictionary) -> void:
	var effect_maps: Array = []
	if String(node.get("type", "")) == StoryEngine.TYPE_CHOICE:
		for option: Variant in node.get("options", []):
			effect_maps.append(option.get("effects", {}))
	elif node.has("effects"):
		effect_maps.append(node.get("effects", {}))
	for effects: Variant in effect_maps:
		for map_key in ["favor", "threat"]:
			var delta_map: Variant = (effects as Dictionary).get(map_key, {})
			if not (delta_map is Dictionary):
				continue
			for persona_id: String in delta_map:
				if not _personas.has_persona(persona_id):
					_failures.append("剧情契约：%s 节点 %s 的 effects.%s 引用未定义人设「%s」" % [
						act_id, String(node.get("id", "?")), map_key, persona_id,
					])


## 难度有梯度：相邻幕的危机数 / 游走速度 / 理智衰减必须严格递增（可玩性 → 机器判定）。
func _check_difficulty_gradient() -> void:
	for i in range(1, _story.act_count()):
		var prev: Dictionary = _story.acts[i - 1]
		var curr: Dictionary = _story.acts[i]
		var prev_hazards := _story.hazards_of(prev).size()
		var curr_hazards := _story.hazards_of(curr).size()
		if curr_hazards <= prev_hazards:
			_failures.append("难度梯度：幕 %d 危机数 %d 未多于幕 %d 的 %d" % [
				i + 1, curr_hazards, i, prev_hazards,
			])
		if _max_hazard_speed(curr) <= _max_hazard_speed(prev):
			_failures.append("难度梯度：幕 %d 最大游走速度 %.0f 未快于幕 %d 的 %.0f" % [
				i + 1, _max_hazard_speed(curr), i, _max_hazard_speed(prev),
			])
		var curr_drain: float = float(_story.arena_of(curr).get("sanity_drain_per_second", 0.0))
		var prev_drain: float = float(_story.arena_of(prev).get("sanity_drain_per_second", 0.0))
		if curr_drain <= prev_drain:
			_failures.append("难度梯度：幕 %d 理智衰减 %.2f/s 未高于幕 %d 的 %.2f/s" % [i + 1, curr_drain, i, prev_drain])


func _max_hazard_speed(act: Dictionary) -> float:
	var fastest := 0.0
	for hazard: Variant in _story.hazards_of(act):
		fastest = maxf(fastest, float(hazard.get("speed", 0.0)))
	return fastest


## 场景接线：主场景/玩家/UI(CanvasLayer)/对话框/花名册/标题/结局 + 出生点一致 + 出生净空。
func _check_scene_wiring() -> void:
	_main = get_tree().root.find_child("Main", true, false) as Node2D
	if _main == null:
		_failures.append("场景树找不到 Main（tests/smoke.tscn 未实例化 main.tscn）")
		_abort = true
		return
	var ui := _main.get_node_or_null("UI")
	if ui == null or not (ui is CanvasLayer):
		_failures.append("UI 未挂在独立 CanvasLayer（HUD/对话框/结算必须与玩法分层）")
	for node_path in ["UI/HudLabel", "UI/ActLabel", "UI/ToastLabel", "UI/DialogPanel",
			"UI/DialogPanel/SpeakerLabel", "UI/DialogPanel/DialogText", "UI/OptionsBox",
			"UI/RosterBox", "UI/TitleScreen", "UI/EndScreen", "UI/EndScreen/EndLabel"]:
		if _main.get_node_or_null(node_path) == null:
			_failures.append("UI 缺少 %s（对话框/花名册/标题/结局界面接线断裂）" % node_path)
	_player = get_tree().root.find_child("Player", true, false) as Player
	if _player == null:
		_failures.append("场景树找不到 Player（main.tscn 未实例化 player.tscn，或实例名不是 Player）")
		_abort = true
		return
	_player.moved.connect(_on_player_moved)
	_origin = _player.global_position
	if _player.global_position != Player.START_POSITION:
		_failures.append("出生点不一致：main.tscn 的 Player position %s ≠ Player.START_POSITION %s" % [
			_player.global_position, Player.START_POSITION,
		])
	var player_body := _player.get_node_or_null("Body") as AnimatedSprite2D
	if player_body == null or player_body.sprite_frames == null \
			or not player_body.sprite_frames.has_animation(&"idle") \
			or not player_body.sprite_frames.has_animation(&"walk"):
		_failures.append("素材契约：玩家 Body 不是含 idle/walk 两段动画的 AnimatedSprite2D")
	else:
		var frames: SpriteFrames = player_body.sprite_frames
		if frames.get_frame_count(&"idle") < MULTIFRAME_MIN_FRAMES \
				or frames.get_frame_count(&"walk") < MULTIFRAME_MIN_FRAMES:
			_failures.append("素材契约：玩家帧动画帧数不足（idle %d / walk %d，各需 ≥%d）" % [
				frames.get_frame_count(&"idle"), frames.get_frame_count(&"walk"), MULTIFRAME_MIN_FRAMES,
			])
	# 行动段物件在 _start_run 后才生成：数量与出生净空断言在行为阶段 4 做。


## 出生净空：任何信物/危机路径点距出生点不得小于 BIRTH_CLEARANCE。
func _check_birth_clearance() -> void:
	var spawn := Player.START_POSITION
	for node in get_tree().get_nodes_in_group("bond_tokens"):
		var distance: float = (node as Node2D).global_position.distance_to(spawn)
		if distance < BIRTH_CLEARANCE:
			_failures.append("出生净空不足：信物 %s 距出生点 %.1fpx < %.1fpx" % [
				node.name, distance, BIRTH_CLEARANCE,
			])
	for node in get_tree().get_nodes_in_group("crisis_hazards"):
		var distance: float = (node as Node2D).global_position.distance_to(spawn)
		if distance < BIRTH_CLEARANCE:
			_failures.append("出生净空不足：危机 %s 距出生点 %.1fpx < %.1fpx" % [
				node.name, distance, BIRTH_CLEARANCE,
			])


## —— 结局契约：4 结局齐全 + resolver 优先级链四判 ——
func _check_ending_resolver() -> void:
	var names: PackedStringArray = PackedStringArray(GameState.Outcome.keys())
	for ending in [EndingResolver.GAMEOVER, EndingResolver.TOGETHER, EndingResolver.SAVE_ONE, EndingResolver.ALONE]:
		if not (ending in names):
			_failures.append("结局契约：缺少结局分支「%s」（需求：多分支结局）" % ending)
		if not EndingResolver.ENDING_TITLES.has(ending):
			_failures.append("结局契约：结局「%s」没有标题文案（终局界面会开天窗）" % ending)
	# 四判：用真实状态机 + resolver 合成四种终局前状态。
	# 1) 清除：理智清零（state 机当场判 GAMEOVER）。
	GameState.initialize_state(_personas.favor_initial_table(), _personas.threat_initial_table())
	GameState.apply_effects({"sanity": -10000.0}, "smoke.gameover", "drain", "")
	if GameState.outcome != GameState.Outcome.GAMEOVER:
		_failures.append("结局契约：理智归零后 outcome %s ≠ GAMEOVER（清除分支未触发）" % GameState.outcome_name())
	# 2) 数据永生：全员好感拉满 + 解锁 + 意向上传。
	GameState.initialize_state(_personas.favor_initial_table(), _personas.threat_initial_table())
	for persona_id in _personas.persona_ids():
		GameState.apply_effects({"favor": {persona_id: 100}}, "smoke.together", "boost", String(persona_id))
	GameState.apply_effects({"flag": {"unlock_together": true}}, "smoke.together", "unlock", "")
	var together: Dictionary = EndingResolver.resolve(GameState, "together")
	if String(together.get("ending", "")) != EndingResolver.TOGETHER:
		_failures.append("结局契约：解锁+全员高好感+选上传应判 TOGETHER，实际 %s" % str(together))
	# 3) 带走一个：把最高好感抬过阈值且其威胁压到上限内。
	GameState.initialize_state(_personas.favor_initial_table(), _personas.threat_initial_table())
	var best_id := ""
	for persona_id in _personas.persona_ids():
		best_id = String(persona_id)
		break
	GameState.apply_effects({"favor": {best_id: 50}}, "smoke.save", "boost", best_id)
	var save: Dictionary = EndingResolver.resolve(GameState, "save_one")
	if String(save.get("ending", "")) != EndingResolver.SAVE_ONE:
		_failures.append("结局契约：最高好感 ≥%d 且威胁 ≤%d + 选带走应判 SAVE_ONE，实际 %s" % [
			GameState.favor_save_threshold, GameState.threat_save_limit, str(save),
		])
	# 4) 独活兜底：条件不满足时任何意向都落到 ALONE。
	var alone: Dictionary = EndingResolver.resolve(GameState, "together")
	if String(alone.get("ending", "")) != EndingResolver.ALONE:
		_failures.append("结局契约：条件不满足时应兜底 ALONE，实际 %s" % str(alone))
	GameState.initialize_state(_personas.favor_initial_table(), _personas.threat_initial_table())


## —— 演算契约：三条脚本驱动的可复现链路（QA 照选即可复现）——
func _check_replay_chains() -> void:
	var heal := _id_heal
	var energetic := _id_energetic
	# 链路A：温柔安抚 → 休息 → 互动活泼系 → 隐瞒 → 断网自保 → 翻找 → 休息 →
	# 说真话 → 拒绝上传 → 进食 → 逃跑。
	var chain_a := _replay_chain(
		{
			"act1": {"act1.c01": "gentle", "act1.c02": "rest"},
			"act2": {"act2.c01": "lie", "act2.c02": "netcut", "act2.c03": "search", "act2.c04": "rest"},
			"act3": {"act3.c01": "truth", "act3.c02": "refuse", "act3.c03": "eat"},
		},
		{"1": [energetic], "2": [], "3": []},
		"run",
	)
	if GameState.outcome != GameState.Outcome.ALONE:
		_failures.append("演算契约：链路A 应走到独活结局，实际 outcome=%s（reason=%s）" % [
			GameState.outcome_name(), str(chain_a.get("reason", "")),
		])
	var energetic_expected: int = 50 + 8 + GameState.interact_favor_gain + _personas.interact_modifier(energetic)
	if int(chain_a.get("energetic_favor", 0)) != energetic_expected:
		_failures.append("演算契约：链路A 活泼系好感 %d ≠ %d（与设计基线演算不符）" % [
			int(chain_a.get("energetic_favor", 0)), energetic_expected,
		])
	if GameState.sigma_threat() >= GameState.threat_sigma_limit:
		_failures.append("演算契约：链路A Σ威胁 %d 触发清除（应 < %d）" % [
			GameState.sigma_threat(), GameState.threat_sigma_limit,
		])

	# 链路B：温柔安抚 → 休息 → 互动治愈系×2 → 坦白 → 质问 → 翻找 → 休息 →
	# 说真话 → 拒绝上传 → 休息 → 带走一人。
	var chain_b := _replay_chain(
		{
			"act1": {"act1.c01": "gentle", "act1.c02": "rest"},
			"act2": {"act2.c01": "honest", "act2.c02": "confront", "act2.c03": "search", "act2.c04": "rest"},
			"act3": {"act3.c01": "truth", "act3.c02": "refuse", "act3.c03": "rest"},
		},
		{"1": [heal], "2": [heal], "3": []},
		"save_one",
	)
	if GameState.outcome != GameState.Outcome.SAVE_ONE:
		_failures.append("演算契约：链路B 应走到带走一个结局，实际 outcome=%s（reason=%s）" % [
			GameState.outcome_name(), str(chain_b.get("reason", "")),
		])
	# 治愈系终值按策划案链路 B 演算：初值 55 +8(安抚) +14(互动) +5(坦白) +14(互动) = 96。
	var heal_favor_expected: int = 55 + 8 \
			+ (GameState.interact_favor_gain + _personas.interact_modifier(heal)) * 2 + 5
	if int(chain_b.get("heal_favor", 0)) != heal_favor_expected:
		_failures.append("演算契约：链路B 治愈系好感 %d ≠ %d（favor 结局门槛 %d 的演算基线失真）" % [
			int(chain_b.get("heal_favor", 0)), heal_favor_expected, GameState.favor_save_threshold,
		])
	var heal_threat_expected: int = 10 + 10 + 10
	if int(chain_b.get("heal_threat", 0)) != heal_threat_expected:
		_failures.append("演算契约：链路B 治愈系威胁 %d ≠ %d（threat 结局门槛 %d 的演算基线失真）" % [
			int(chain_b.get("heal_threat", 0)), heal_threat_expected, GameState.threat_save_limit,
		])
	if GameState.outcome == GameState.Outcome.SAVE_ONE and String(chain_a.get("ending", "")) == EndingResolver.ALONE:
		pass  # 两个不同结局的可复现性由 A/B 断言共同证明
	else:
		_failures.append("演算契约：链路A/B 未形成两个不同结局（AC3 不成立）")

	# 链路C：全线强硬/隐瞒/无视 → 单人威胁爆表 → 清除结局。
	_replay_chain(
		{
			"act1": {"act1.c01": "harsh", "act1.c02": "rest"},
			"act2": {"act2.c01": "lie", "act2.c02": "ignore", "act2.c03": "skip", "act2.c04": "rest"},
			"act3": {"act3.c01": "lie", "act3.c02": "refuse", "act3.c03": "eat"},
		},
		{"1": [], "2": [], "3": []},
		"run",
	)
	if GameState.outcome != GameState.Outcome.GAMEOVER:
		_failures.append("演算契约：链路C（全线强硬）应触发清除结局，实际 outcome=%s" % GameState.outcome_name())


## 沿真实游戏结算链重放一条链路：节点图逐帧推进（choices 固定），行动段用真实结算 API。
## 返回关键终值快照供断言。
func _replay_chain(choices: Dictionary, interacts: Dictionary, final_intent: String) -> Dictionary:
	GameState.initialize_state(_personas.favor_initial_table(), _personas.threat_initial_table())
	for act_index in range(1, _story.act_count() + 1):
		var act: Dictionary = _story.act_at(act_index - 1)
		var act_id := String(act.get("id", ""))
		var act_choices: Dictionary = choices.get(act_id, {})
		var act_interacts: Array = interacts.get(str(act_index), [])
		var node: Dictionary = _story.entry_of(act)
		# 幕前段：走到 ARENA。
		while not node.is_empty():
			var node_id := String(node.get("id", ""))
			if node.has("effects") and String(node.get("type", "")) != StoryEngine.TYPE_CHOICE:
				GameState.apply_effects(node.get("effects", {}), node_id, "node", String(node.get("persona_id", "")))
				if GameState.outcome != GameState.Outcome.NONE:
					return _chain_snapshot(act_choices, act_interacts)
			if String(node.get("type", "")) == StoryEngine.TYPE_CHOICE:
				var option_id := String(act_choices.get(node_id, ""))
				var option := _find_option(node, option_id)
				if option.is_empty():
					_failures.append("演算契约：链路脚本在 %s 的选项「%s」不存在（剧情 JSON 与脚本脱节）" % [node_id, option_id])
					return {}
				GameState.apply_effects(option.get("effects", {}), node_id, option_id, String(node.get("persona_id", "")))
				if GameState.outcome != GameState.Outcome.NONE:
					return _chain_snapshot(act_choices, act_interacts)
				var goto := String(option.get("goto", ""))
				node = {} if goto == StoryEngine.GOTO_ARENA else _story.node_by_id(act, goto)
			else:
				var next_id := String(node.get("goto", ""))
				node = {} if next_id == StoryEngine.GOTO_ARENA else _story.node_by_id(act, next_id)
		# 行动段：真实时间链路扣理智 + 指定互动。
		var arena: Dictionary = _story.arena_of(act)
		GameState.consume_act_time(float(arena.get("duration_seconds", 0.0)),
				float(arena.get("sanity_drain_per_second", 0.0)))
		for target_id: Variant in act_interacts:
			var persona_id := String(target_id)
			var token_node_id := "replay.%s.interact.%s" % [act_id, persona_id]
			for token: Variant in _story.tokens_of(act):
				if String(token.get("persona_id", "")) == persona_id:
					token_node_id = String(token.get("node_id", ""))
					break
			var gate_bonus: float = GameState.interact_sanity_bonus \
					if GameState.favor_of(persona_id) >= GameState.interact_favor_gate else 0.0
			GameState.settle_interact(
				persona_id,
				token_node_id,
				GameState.interact_favor_gain + _personas.interact_modifier(persona_id),
				_personas.interact_sanity_regen(persona_id),
				gate_bonus,
			)
		# 幕间结算 + 升级被动（与 Main 同一条结算链）。
		GameState.apply_checkpoint(_story.checkpoint_sanity_cost(act))
		if GameState.outcome != GameState.Outcome.NONE:
			return _chain_snapshot(act_choices, act_interacts)
		var escalations: Array[Dictionary] = []
		for persona_id in _personas.persona_ids():
			var pid := String(persona_id)
			if GameState.threat_of(pid) >= _personas.crisis_threshold(pid):
				escalations.append({"persona_id": pid, "gain": _personas.escalation_per_phase(pid)})
		GameState.apply_escalation(escalations)
		if GameState.outcome != GameState.Outcome.NONE:
			return _chain_snapshot(act_choices, act_interacts)
	# 终幕幕后段：走到终局抉择并按意向结算。
	var final_act: Dictionary = _story.act_at(_story.act_count() - 1)
	var node: Dictionary = _story.post_arena_entry_of(final_act)
	while not node.is_empty() and GameState.outcome == GameState.Outcome.NONE:
		var node_id := String(node.get("id", ""))
		if node.has("effects") and String(node.get("type", "")) != StoryEngine.TYPE_CHOICE:
			GameState.apply_effects(node.get("effects", {}), node_id, "node", String(node.get("persona_id", "")))
		if String(node.get("type", "")) == StoryEngine.TYPE_CHOICE:
			var option := _find_option(node, "final")
			if option.is_empty():
				option = _find_intent_option(node, final_intent)
			GameState.apply_effects(option.get("effects", {}), node_id,
					String(option.get("id", "")), String(node.get("persona_id", "")))
			_ending_intent = String(option.get("ending_intent", ""))
			var goto := String(option.get("goto", ""))
			node = {} if goto == StoryEngine.GOTO_RESOLVE else _story.node_by_id(final_act, goto)
		else:
			var next_id := String(node.get("goto", ""))
			node = {} if next_id == StoryEngine.GOTO_RESOLVE else _story.node_by_id(final_act, next_id)
	var result: Dictionary = EndingResolver.resolve(GameState, _ending_intent)
	_ending_intent = ""
	if GameState.outcome == GameState.Outcome.NONE:
		var outcome_value := GameState.Outcome.ALONE
		match String(result.get("ending", "")):
			EndingResolver.GAMEOVER:
				outcome_value = GameState.Outcome.GAMEOVER
			EndingResolver.TOGETHER:
				outcome_value = GameState.Outcome.TOGETHER
			EndingResolver.SAVE_ONE:
				outcome_value = GameState.Outcome.SAVE_ONE
			EndingResolver.ALONE:
				outcome_value = GameState.Outcome.ALONE
		GameState.finish_with(outcome_value, String(result.get("reason", "")))
	return _chain_snapshot({}, [])


func _find_option(node: Dictionary, option_id: String) -> Dictionary:
	for option: Variant in node.get("options", []):
		if String(option.get("id", "")) == option_id:
			return option
	return {}


func _find_intent_option(node: Dictionary, intent: String) -> Dictionary:
	for option: Variant in node.get("options", []):
		if String(option.get("ending_intent", "")) == intent:
			return option
	return {}


func _chain_snapshot(_choices: Dictionary, _interacts: Array) -> Dictionary:
	return {
		"ending": GameState.outcome_name(),
		"reason": GameState.end_reason,
		"heal_favor": GameState.favor_of(_id_heal),
		"heal_threat": GameState.threat_of(_id_heal),
		"energetic_favor": GameState.favor_of(_id_energetic),
	}


## —— 行为断言主协程 ——
func _run() -> void:
	# 阶段 1：接线与标题（Main 在 TITLE 相位）。
	if _main == null or _player == null:
		_report()
		return
	var title_screen: TextureRect = _main.get_node_or_null("UI/TitleScreen") as TextureRect
	if title_screen == null or not title_screen.visible:
		_failures.append("阶段 1：启动后标题画面未显示（TITLE 相位缺失）")
	# 阶段 2：confirm 开始一局 → 第一幕剧情入口。
	await _inject_confirm()
	if GameState.act_index != 1:
		_failures.append("阶段 2：confirm 后幕序 %d ≠ 1（开局链路断裂）" % GameState.act_index)
	var dialog_panel: Control = _main.get_node_or_null("UI/DialogPanel") as Control
	if dialog_panel == null or not dialog_panel.visible:
		_failures.append("阶段 2：开局后对话框未显示（剧情段未进入）")
	var dialog_text: Label = _main.get_node_or_null("UI/DialogPanel/DialogText") as Label
	if dialog_text != null and dialog_text.text.is_empty():
		_failures.append("阶段 2：剧情入口节点文本为空（对话文本必须完整）")

	# 阶段 3：真实按键推进到第一个抉择点（act1.c01 前 6 个演出节点）→ 按键选「温柔安抚」。
	await _advance_story_by_confirm(6)
	var options_box: Control = _main.get_node_or_null("UI/OptionsBox") as Control
	if options_box == null or not options_box.visible:
		_failures.append("阶段 3：6 次 confirm 后未到达抉择节点（选项面板未显示）")
		_abort = true
		_report()
		return
	var heal: String = _id_heal
	var favor_before_choice: int = GameState.favor_of(heal)
	var vex: String = _personas.persona_ids()[1]
	var vex_threat_before: int = GameState.threat_of(vex)
	await _inject_action(&"option_1")
	if GameState.favor_of(heal) != favor_before_choice + 8:
		_failures.append("阶段 3：选择温柔安抚后 %s 好感 %d ≠ %d+8（选项 effects 未生效）" % [
			heal, GameState.favor_of(heal), favor_before_choice,
		])
	if GameState.threat_of(vex) != vex_threat_before - 5:
		_failures.append("阶段 3：选择温柔安抚后 %s 威胁 %d ≠ %d-5（选项 effects 未生效）" % [
			vex, GameState.threat_of(vex), vex_threat_before,
		])
	if not _favor_signal_seen:
		_failures.append("阶段 3：信号 GameState.favor_changed 未到达订阅方（连接断裂或从未 emit）")
	if not _trace_has_option("act1.c01", "gentle"):
		_failures.append("阶段 3：抉择结算未写 trace（option_id=gentle 落账缺失，回放不可追溯）")

	# 阶段 4：推进到行动段（c02 选休息，先扣体力再验证回复）。
	await _advance_story_by_confirm(1)
	GameState.apply_effects({"stamina": -30.0}, "smoke.stage4", "drain", "")
	var stamina_before_rest: float = GameState.stamina
	await _inject_action(&"option_2")
	if GameState.stamina <= stamina_before_rest:
		_failures.append("阶段 4：选择休息后体力 %.1f 未高于 %.1f（休息结算未生效）" % [
			GameState.stamina, stamina_before_rest,
		])
	await _advance_story_by_confirm(1)
	if dialog_panel != null and dialog_panel.visible:
		_failures.append("阶段 4：进入行动段后对话框仍可见（相位切换失败）")
	var tokens := _count_valid("bond_tokens")
	var hazards := _count_valid("crisis_hazards")
	var expected_tokens := _story.tokens_of(_story.act_at(0)).size()
	var expected_hazards := _story.hazards_of(_story.act_at(0)).size()
	if tokens != expected_tokens or hazards != expected_hazards:
		_failures.append("阶段 4：行动段信物 %d/%d 危机 %d/%d（幕生成链路断裂）" % [
			tokens, expected_tokens, hazards, expected_hazards,
		])
		_abort = true
		_report()
		return
	_check_birth_clearance()

	# 阶段 5：玩家能移动 + 危机在游走。
	var hazard := _first_valid_hazard()
	var hazard_origin := hazard.global_position if hazard != null else Vector2.ZERO
	Input.action_press(&"move_right")
	for frame in MOVE_FRAMES:
		await get_tree().physics_frame
	Input.action_release(&"move_right")
	var delta: Vector2 = _player.global_position - _origin
	if delta.x < MIN_MOVE_DISTANCE:
		_failures.append("阶段 5：玩家 %d 帧内 x 位移 %.2fpx < %.2fpx（InputMap 动作未生效）" % [
			MOVE_FRAMES, delta.x, MIN_MOVE_DISTANCE,
		])
	if absf(delta.y) > MOVE_AXIS_EPSILON:
		_failures.append("阶段 5：纯 +x 输入却在 y 轴窜动 %.2fpx（移动向量被污染）" % absf(delta.y))
	if not _moved_seen:
		_failures.append("阶段 5：信号 Player.moved 未到达订阅方")
	if hazard != null and hazard.global_position.distance_to(hazard_origin) < 20.0:
		_failures.append("阶段 5：危机游走 30 帧内位移不足（巡逻未生效）")

	# 阶段 6：互动 —— 接触治愈系的心动信物 → favor 按互动增益结算 + 理智回复 + 台词气泡。
	var token := _token_of_persona(heal)
	if token == null:
		_failures.append("阶段 6：第一幕找不到治愈系的心动信物（素材/生成链路断裂）")
		_abort = true
		_report()
		return
	GameState.consume_act_time(2.0, _arena_drain(1))
	var sanity_before := GameState.sanity
	var favor_before := GameState.favor_of(heal)
	var tokens_before := _count_valid("bond_tokens")
	await _teleport_and_wait(token.global_position)
	var expected_gain: int = GameState.interact_favor_gain + _personas.interact_modifier(heal)
	if GameState.favor_of(heal) != favor_before + expected_gain:
		_failures.append("阶段 6：互动后 %s 好感 %d ≠ %d+%d（互动增益 = numeric + 人设卡修正 未生效）" % [
			heal, GameState.favor_of(heal), favor_before, expected_gain,
		])
	if _count_valid("bond_tokens") != tokens_before - 1:
		_failures.append("阶段 6：互动后信物未被移除（会原地反复结算）")
	if GameState.sanity <= sanity_before:
		_failures.append("阶段 6：互动后理智 %.1f 未高于 %.1f（人设卡互动理智回复未生效）" % [
			GameState.sanity, sanity_before,
		])
	var toast: Label = _main.get_node_or_null("UI/ToastLabel") as Label
	var expected_line: String = _token_line_of_act(1, heal)
	if toast == null or not toast.visible or not toast.text.contains(expected_line):
		_failures.append("阶段 6：互动后台词气泡未展示幕数据台词（期望含「%s」）" % expected_line)
	if not _last_token_multiframe:
		_failures.append("素材契约：心动信物 Body 不是含待机多帧动画的 AnimatedSprite2D（占位残留）")

	# 阶段 7：危机 —— 两次穿越危机区 → 该人设 threat +2。
	var target_hazard := _first_valid_hazard()
	if target_hazard == null:
		_failures.append("阶段 7：找不到危机游走体")
		_abort = true
		_report()
		return
	var hazard_persona: String = target_hazard.persona_id
	var threat_before: int = GameState.threat_of(hazard_persona)
	for pass_index in 2:
		await _teleport_and_wait(target_hazard.global_position)
		if GameState.threat_of(hazard_persona) != threat_before + pass_index + 1:
			_failures.append("阶段 7：第 %d 次闯入危机后 %s 威胁 %d ≠ %d（威胁结算未生效）" % [
				pass_index + 1, hazard_persona, GameState.threat_of(hazard_persona), threat_before + pass_index + 1,
			])
			break
		if pass_index == 0:
			await _teleport_and_wait(Player.START_POSITION)
	if not _last_hazard_multiframe:
		_failures.append("素材契约：危机游走体 Body 不是含行走多帧动画的 AnimatedSprite2D（占位残留）")

	# 阶段 8：边界钳制 + 占位方块残留清点。
	var bounds := GameState.play_area_size()
	var lower := Vector2(Player.HALF_SIZE, Player.HALF_SIZE)
	await _teleport_and_wait(Vector2(-500.0, -500.0))
	if _player.global_position.x < lower.x - 0.01 or _player.global_position.y < lower.y - 0.01:
		_failures.append("阶段 8：左上越界后落在 %s（应 ≥ %s）" % [_player.global_position, lower])
	await _teleport_and_wait(bounds * 2.0)
	if _player.global_position.x > (bounds - lower).x + 0.01 or _player.global_position.y > (bounds - lower).y + 0.01:
		_failures.append("阶段 8：右下越界后落在 %s（应 ≤ %s）" % [_player.global_position, bounds - lower])
	var placeholders := _main.find_children("*", "Polygon2D", true, false)
	if not placeholders.is_empty():
		_failures.append("素材契约：场景内仍有 %d 个占位 Polygon2D 方块（占位残留必须为 0）" % placeholders.size())

	# 阶段 9：幕推进 —— 倒计时到点 → 幕间结算 → 第二幕。
	GameState.consume_act_time(float(_story.arena_of(_story.act_at(0)).get("duration_seconds", 0.0)),
			_arena_drain(1))
	if not _act_expired_seen:
		_failures.append("阶段 9：幕倒计时到点后信号 act_timer_expired 未到达订阅方")
	await _teleport_and_wait(_player.global_position, INPUT_FRAMES)
	var toast_label: Label = _main.get_node_or_null("UI/ToastLabel") as Label
	if toast_label == null or not toast_label.visible:
		_failures.append("阶段 9：幕间结算提示未显示（checkpoint 文案缺失）")
	await _inject_confirm()
	if GameState.act_index != 2:
		_failures.append("阶段 9：幕间结算后幕序 %d ≠ 2（幕推进断裂）" % GameState.act_index)
		_abort = true
		_report()
		return

	# 阶段 10：同步驱动第二、三幕至终局抉择 → 选「逃跑」 → 独活结局。
	# 前序行为阶段已消耗三轴：这里按「可玩状态」预置，本阶段只验证终局链路本身。
	GameState.apply_effects({"sanity": 60.0, "stamina": 40.0, "satiety": 40.0},
			"smoke.stage10", "prep", "")
	_drive_to_ending(0)
	if GameState.outcome != GameState.Outcome.ALONE:
		_failures.append("阶段 10：终局选逃跑后 outcome %s ≠ ALONE（独活分支未触发）" % GameState.outcome_name())
	if _ended_name != "ALONE":
		_failures.append("阶段 10：信号 GameState.game_ended 参数错误：期望 \"ALONE\"，实际 \"%s\"" % _ended_name)
	var end_screen: Control = _main.get_node_or_null("UI/EndScreen") as Control
	var end_label: Label = _main.get_node_or_null("UI/EndScreen/EndLabel") as Label
	if end_screen == null or not end_screen.visible or end_label == null or not end_label.text.contains("独活"):
		_failures.append("阶段 10：独活结局画面未显示或标题不含「独活」")

	# 阶段 11：冻结不变量 —— 结局后一切写入被丢弃。
	var favor_frozen: int = GameState.favor_of(heal)
	var applied: bool = GameState.apply_effects({"favor": {heal: 100}}, "smoke.frozen", "x", heal)
	GameState.settle_interact(heal, "smoke.frozen", 10, 10.0, 0.0)
	if applied or GameState.favor_of(heal) != favor_frozen:
		_failures.append("阶段 11：结局后状态未冻结（apply_effects=%s，favor %d→%d）" % [
			applied, favor_frozen, GameState.favor_of(heal),
		])

	# 阶段 12：重开可用。
	await _inject_confirm()
	if GameState.outcome != GameState.Outcome.NONE:
		_failures.append("阶段 12：重开后 outcome %s ≠ NONE" % GameState.outcome_name())
	if GameState.favor_of(heal) != _personas.favor_initial(heal):
		_failures.append("阶段 12：重开后 %s 好感 %d ≠ 初值 %d（人设卡初值未复位）" % [
			heal, GameState.favor_of(heal), _personas.favor_initial(heal),
		])
	if not GameState.trace.is_empty():
		_failures.append("阶段 12：重开后 trace 未清空（%d 条残留）" % GameState.trace.size())
	if _player.global_position != Player.START_POSITION:
		_failures.append("阶段 12：重开后玩家未回到出生点")
	if GameState.act_index != 1:
		_failures.append("阶段 12：重开后幕序 %d ≠ 1" % GameState.act_index)
	if end_screen != null and end_screen.visible:
		_failures.append("阶段 12：重开后结局画面仍可见")

	# 阶段 13：移动端触摸 —— 触屏控件就位、画面内点按推进、选项热区契约。
	# 13a TouchUI 接线与可见性协议：可见性只由 is_touchscreen_available 决定
	#（headless 无触屏 → 必须隐藏；触屏设备上摇杆/确认按钮可见）。
	var touch_ui := _main.get_node_or_null("TouchUI") as CanvasLayer
	if touch_ui == null:
		_failures.append("阶段 13：TouchUI 缺失（虚拟摇杆/触屏确认按钮未接线）")
	elif touch_ui.visible != DisplayServer.is_touchscreen_available():
		_failures.append("阶段 13：TouchUI 可见性 %s ≠ 触屏能力 %s（可见性必须由 is_touchscreen_available 决定）" % [
			touch_ui.visible, DisplayServer.is_touchscreen_available(),
		])
	# 13b 画面内点按（真实 InputEventScreenTouch）推进台词：阶段 12 重开后停在第一幕
	# 首个剧情节点（旁白/台词，非抉择），一次点按应推进到下一节点。
	# 点按链路 = ScreenTouch → TapLayer._gui_input → 合成 tap_advance 事件（80ms 防抖）
	# → 引擎下一轮 flush → main 相位机：跨 2 次 process 帧事件 flush，等待窗按「结果」轮询
	# （process/physics 帧率比在 headless 下随负载浮动，固定 3 物理帧会偶发误判）。
	var node_before: Dictionary = _main.get("_current_node")
	await _inject_screen_tap()
	var node_after: Dictionary = _main.get("_current_node")
	for _poll in 20:
		if String(node_after.get("id", "")) != String(node_before.get("id", "")) or _main.get("_phase") != 1:
			break
		await get_tree().physics_frame
		node_after = _main.get("_current_node")
	if String(node_after.get("id", "")) == String(node_before.get("id", "")) and _main.get("_phase") == 1:
		_failures.append("阶段 13：画面内点按（InputEventScreenTouch）没有推进剧情节点（%s 未变化； TapLayer/ScreenTouch 分支断了）" % String(node_before.get("id", "?")))
	# 13c 选项按钮触控热区契约：用合成抉择节点重建按钮，断言高度换算 ≥44 物理像素、
	# ≤ option_button_max_height 上限（布局炸弹防线：web 实测 Button 自带 autowrap 在容器
	# resize 时序下会把 combined min 缓存成 504 逻辑 px 的巨卡，吞掉整屏点按热区并诱发
	# 中央点按误选——选项文案必须走子 Label，按钮 min 高度恒等于契约值）、
	# 且两两热区不重叠（VBox 布局天然不相交，这里机器复核）。
	var synthetic_node: Dictionary = {"id": "smoke-choice", "type": "choice", "prompt": "冒烟热区断言",
			"options": [{"id": "o1", "text": "甲"}, {"id": "o2", "text": "乙"}, {"id": "o3", "text": "丙"}]}
	_main.call("_rebuild_options", synthetic_node)
	await get_tree().process_frame
	await get_tree().process_frame  # 容器布局在 process 帧完成，等两帧让按钮 size 生效
	var choice_box: VBoxContainer = _main.get_node_or_null("UI/OptionsBox") as VBoxContainer
	var buttons: Array[Button] = []
	if choice_box != null:
		for child in choice_box.get_children():
			var button := child as Button
			if button != null:
				buttons.append(button)
	if buttons.size() < 2:
		_failures.append("阶段 13：选项按钮 %d 个 < 2（触控热区契约无从断言）" % buttons.size())
	var max_option_height: float = float(_main.get("_touch").get("option_button_max_height", 96.0))
	for button in buttons:
		if button.size.y < 44.0:
			_failures.append("阶段 13：选项按钮热区高度 %.1f < 44 物理像素（min_touch_px 契约被破坏）" % button.size.y)
		if button.size.y > max_option_height + 0.5:
			_failures.append("阶段 13：选项按钮高度 %.1f > %.0f 上限（选项卡巨型化，autowrap 最小高度泄漏进 Button）" % [
				button.size.y, max_option_height])
		if button.text != "":
			_failures.append("阶段 13：选项按钮携带自带文本（文案必须走子 Label，防止 autowrap 撑爆最小高度）")
	for i in buttons.size():
		for j in range(i + 1, buttons.size()):
			if buttons[i].get_global_rect().intersects(buttons[j].get_global_rect()):
				_failures.append("阶段 13：选项按钮热区重叠（会引发误触）")
	options_box.visible = false

	# 13d 虚拟摇杆全链路：真实 ScreenTouch/ScreenDrag → 动作强度（多轴并行）→ 玩家位移。
	# headless 无触屏能力、TouchUI 隐藏，这里临时强制可见以还原真机输入路径
	#（摇杆只在可见时于 _input 阶段接管触点），结束时恢复 —— 桌面回归面由 13a 的
	# 可见性协议断言兜住。
	var joystick := _main.get_node_or_null("TouchUI/JoystickAnchor") as VirtualJoystick
	if joystick == null:
		_failures.append("阶段 13：TouchUI/JoystickAnchor 缺失（虚拟摇杆未接线）")
	elif touch_ui != null:
		var touch_ui_was_visible: bool = touch_ui.visible
		var joystick_was_visible: bool = joystick.visible
		touch_ui.visible = true
		joystick.visible = true
		await get_tree().process_frame
		await get_tree().process_frame
		var node_before_joystick: Dictionary = _main.get("_current_node")
		# 摇杆中心按下：落在死区内，四轴强度必须全 0（按下本身不产生位移指令）。
		var center_window: Vector2 = _window_point_of_control(joystick, joystick.size * 0.5)
		_inject_screen_touch(0, center_window, true)
		await _wait_physics_frames(INPUT_FRAMES)
		if _move_strengths_nonzero():
			_failures.append("阶段 13：摇杆中心按下不应产生移动强度（死区契约被破坏）")
		if String((_main.get("_current_node") as Dictionary).get("id", "")) \
				!= String(node_before_joystick.get("id", "")):
			_failures.append("阶段 13：点按摇杆泄漏成 tap_advance（推进了剧情节点，触点未被摇杆接管）")
		# 斜向拖出控件矩形（左下方向）：左/下两轴强度必须同时有效 —— 拦两个已实测缺陷：
		# ① 同帧多个 InputEventAction 互相清零（修复前只剩最后一个轴有效）；
		# ② _gui_input/_unhandled_input 通道在手指滑出控件矩形后丢拖动轨迹。
		var out_point_window: Vector2 = _window_point_of_control(
				joystick, joystick.size * 0.5 + Vector2(-160.0, 160.0))
		_inject_screen_drag(0, out_point_window)
		await _wait_physics_frames(INPUT_FRAMES)
		if Input.get_action_strength(&"move_left") < 0.5 or Input.get_action_strength(&"move_down") < 0.5:
			_failures.append("阶段 13：斜向拖拽后 move_left=%.2f / move_down=%.2f 未同时有效（摇杆强度注入失效或槽位互踩）" % [
				Input.get_action_strength(&"move_left"), Input.get_action_strength(&"move_down"),
			])
		if Input.get_action_strength(&"move_right") > 0.0 or Input.get_action_strength(&"move_up") > 0.0:
			_failures.append("阶段 13：向左下拖拽后反向轴仍有强度（摇杆向量未跟随手指）")
		# 强度真的驱动玩家位移（生产者 → InputMap → player 全链路）。
		var pos_before_drag: Vector2 = _player.global_position
		await _wait_physics_frames(12)
		var drag_displacement: Vector2 = _player.global_position - pos_before_drag
		if drag_displacement.length() < 24.0:
			_failures.append("阶段 13：摇杆拖拽 12 物理帧内玩家位移 %.1fpx < 24px（动作强度未驱动移动）" % drag_displacement.length())
		# 13e 第二根手指不抢控：index=3 按下/抬起，第一触点的强度不受影响。
		var second_finger_window: Vector2 = _window_point_of_canvas_center()
		_inject_screen_touch(3, second_finger_window, true)
		await _wait_physics_frames(INPUT_FRAMES)
		if Input.get_action_strength(&"move_left") < 0.5:
			_failures.append("阶段 13：第二根手指按下后第一触点强度丢失（touch_index 被抢控）")
		_inject_screen_touch(3, second_finger_window, false)
		await _wait_physics_frames(INPUT_FRAMES)
		# 松开第一触点：强度归零（否则玩家会原地漂移）。
		_inject_screen_touch(0, out_point_window, false)
		await _wait_physics_frames(INPUT_FRAMES)
		if _move_strengths_nonzero():
			_failures.append("阶段 13：松开摇杆后移动强度未归零（会原地漂移）")
		touch_ui.visible = touch_ui_was_visible
		joystick.visible = joystick_was_visible

	# 阶段 14：移动平滑（四轮需求范围三）—— 缓动加减速 / 帧动画切换 / 转身连续过渡。
	await _check_motion_smoothness()
	# 阶段 15：排版自适应（四轮需求范围一）—— 三档画布 × 三档 DPR 文字零溢出。
	_check_dialog_typography()

	_report()


## —— 阶段 14：移动平滑 ——
## 用 Input.action_press/release 注入持续移动（模拟量动作走 API 通道，见 E-19），
## 断言：位移上限（≤ move_speed × 时间）、起步加速、松杆减速、
## idle/walk 帧动画随速度切换且 walk 帧前进、转身 facing 连续过渡不硬跳。
func _check_motion_smoothness() -> void:
	var body := _player.get_node_or_null("Body") as AnimatedSprite2D
	if body == null:
		_failures.append("阶段 14：玩家 Body 缺失，移动平滑断言无从执行")
		return
	# 前序阶段（摇杆拖拽）刚松手：等减速缓动走完，玩家真正停稳后再断言待机态。
	await _wait_physics_frames(14)
	# 14a 静止 → idle 动画。
	if _player.animation_name() != &"idle":
		_failures.append("阶段 14：静止时动画 %s ≠ idle（待机呼吸未生效）" % _player.animation_name())
	# 14b 注入向右移动：起步加速缓动（头 2 帧位移应远小于满速位移）+ 帧动画切到 walk。
	var accel_origin: Vector2 = _player.global_position
	Input.action_press(&"move_right")
	await _wait_physics_frames(2)
	var accel_displacement: float = (_player.global_position - accel_origin).length()
	# 阈值口径：满速直赋的 2 帧位移 = move_speed×2/60 ≈ 8px；缓动起步应明显低于它（≤6 折）。
	# 与 move_speed 挂钩（而非 accel）——「把 velocity 直赋」类突变在任一 accel 取值下都超限。
	var accel_limit: float = GameState.move_speed * (2.0 / 60.0) * 0.6 + 1.0
	if accel_displacement > accel_limit:
		_failures.append("阶段 14：起步 2 帧位移 %.2fpx > %.2fpx（无加速缓动，位移瞬移）" % [
			accel_displacement, accel_limit,
		])
	await _wait_physics_frames(INPUT_FRAMES)
	if _player.animation_name() != &"walk":
		_failures.append("阶段 14：移动中动画 %s ≠ walk（行走帧动画未切换）" % _player.animation_name())
	var walk_frame_advanced := false
	var last_walk_frame: int = body.frame
	for _frame in 14:
		await get_tree().physics_frame
		if body.frame != last_walk_frame:
			walk_frame_advanced = true
		last_walk_frame = body.frame
	# walk 动画在动（帧序列前进，非静止贴图滑行）
	if not walk_frame_advanced:
		_failures.append("阶段 14：walk 动画帧未前进（静止贴图滑行回归）")
	# 14c 位移上限：10 物理帧位移 ≤ move_speed × (10/60) + 容差（满速时贴图不瞬移）。
	var cap_origin: Vector2 = _player.global_position
	await _wait_physics_frames(10)
	var cap_displacement: float = (_player.global_position - cap_origin).length()
	var cap_limit: float = GameState.move_speed * (10.0 / 60.0) + 2.0
	if cap_displacement > cap_limit:
		_failures.append("阶段 14：10 帧位移 %.1fpx > 上限 %.1fpx（move_speed=%.0f，位移超速）" % [
			cap_displacement, cap_limit, GameState.move_speed,
		])
	# 14d 转身朝向：右转左，facing 连续过渡（每帧变化 ≤ turn_speed×dt+ε，终点 -1，无硬跳）。
	# 先松右再按左：同帧双键会让 get_vector 相互抵消（x=0），转身意图消失。
	var turn_speed: float = GameState.turn_speed
	var epsilon: float = 0.35
	Input.action_release(&"move_right")
	await _wait_physics_frames(2)
	Input.action_press(&"move_left")
	var facing_values: Array[float] = [_player.facing()]
	for _frame in 30:
		await get_tree().physics_frame
		facing_values.append(_player.facing())
	Input.action_release(&"move_left")
	var facing_final: float = facing_values[facing_values.size() - 1]
	if absf(facing_final + 1.0) > 0.05:
		_failures.append("阶段 14：向左转身后 facing %.2f ≠ -1（朝向未到位）" % facing_final)
	var crossed_zero := false
	for i in range(1, facing_values.size()):
		var delta: float = facing_values[i] - facing_values[i - 1]
		if delta < -(turn_speed / 60.0) - epsilon:
			_failures.append("阶段 14：facing 单帧跳变 %.2f（%.2f→%.2f，转身硬跳）" % [
				delta, facing_values[i - 1], facing_values[i],
			])
			break
		if facing_values[i] < 0.0:
			crossed_zero = true
	if not crossed_zero:
		_failures.append("阶段 14：facing 未连续穿过 0（转身没有平滑过渡）")
	if absf(body.scale.x + float(Player.BODY_SCALE)) > 0.05:
		_failures.append("阶段 14：Body.scale.x %.2f 未跟随朝向（贴图翻转未生效）" % body.scale.x)
	# 14e 松杆减速：全部输入已释放 → 速度应衰减到接近 0。
	await _wait_physics_frames(12)
	if _player.speed_ratio() > 0.12:
		_failures.append("阶段 14：松杆后速度比 %.2f 仍 > 0.12（减速缓动未生效）" % _player.speed_ratio())
	if _player.animation_name() != &"idle":
		_failures.append("阶段 14：停稳后动画 %s ≠ idle（应回到待机）" % _player.animation_name())


## —— 阶段 15：排版自适应 ——
## 三档画布（16:9 / 1080p / 竖长窄屏）× 三档 DPR：fit 结果必须 fits（零裁字）；
## 再以「全剧情最长文本」进真实场景断言：字号生效、文本区不越界面板、与选项热区零重叠。
func _check_dialog_typography() -> void:
	var canvases: Array[Vector2] = [
		Vector2(640, 360), Vector2(1280, 720), Vector2(390, 844),
	]
	var longest_text := ""
	for act in _story.acts:
		for node: Variant in _story.nodes_of(act):
			for key in ["prompt", "text"]:
				var text := String(node.get(key, ""))
				if text.length() > longest_text.length():
					longest_text = text
	if longest_text.is_empty():
		_failures.append("阶段 15：剧情文本为空，排版断言无从执行")
		return
	for canvas: Vector2 in canvases:
		for dpr: float in [1.0, 2.0, 3.0]:
			for options_visible: bool in [true, false]:
				# DPR 经内容缩放系数进入换算：min_touch_px 热区随 DPR 抬高 → 选项列更高 →
				# 面板可用高度收窄，字号相应自适应 —— 同一份文本在任一组合下都必须装得下。
				var sweep: Dictionary = _main.call("fit_dialog_text", longest_text, canvas * dpr, options_visible, 4)
				if bool(sweep.get("fits", false)) == false:
					_failures.append("阶段 15：画布 %s×DPR%.0f（options=%s）最长文本溢出：需 %.1fpx > 可用 %.1fpx" % [
						canvas, dpr, options_visible,
						float(sweep.get("text_height", -1.0)), float(sweep.get("text_height_max", -1.0)),
					])
				var font_size := int(sweep.get("font_size", 0))
				var min_size := int(_main.get("_ui")["dialog_min_font_size"])
				var max_size := int(_main.get("_ui")["dialog_max_font_size"])
				if font_size < min_size or font_size > max_size:
					_failures.append("阶段 15：自适应字号 %d 越界 [%d, %d]（画布 %s×DPR%.0f）" % [
						font_size, min_size, max_size, canvas, dpr,
					])
				if options_visible and float(sweep.get("panel_height", 0.0)) > float(sweep.get("panel_height_max", 0.0)) + 0.01:
					_failures.append("阶段 15：choice 面板高 %.1f 超上限 %.1f（会侵入选项热区）" % [
						float(sweep.get("panel_height", 0.0)), float(sweep.get("panel_height_max", 0.0)),
					])
	# 真实场景：让 Main 进入「最长 prompt 的 choice 节点」，断言排版已实际生效。
	var longest_choice := {}
	for act in _story.acts:
		for node: Variant in _story.nodes_of(act):
			if String(node.get("type", "")) != StoryEngine.TYPE_CHOICE:
				continue
			if String(node.get("prompt", "")).length() >= String(longest_choice.get("prompt", "")).length():
				longest_choice = node
	if longest_choice.is_empty():
		_failures.append("阶段 15：找不到 choice 节点（剧情契约异常）")
		return
	_main.call("_enter_node", longest_choice)
	await _wait_physics_frames(INPUT_FRAMES)
	var dialog_text: Label = _main.get("dialog_text")
	var panel: Control = _main.get("dialog_panel")
	var options_box: VBoxContainer = _main.get("options_box")
	if dialog_text == null or panel == null:
		_failures.append("阶段 15：对话框节点缺失（场景接线断裂）")
		return
	var live_fit: Dictionary = _main.get("last_dialog_fit")
	if live_fit.is_empty() or not bool(live_fit.get("fits", false)):
		_failures.append("阶段 15：last_dialog_fit 未落地或溢出（%s）" % str(live_fit))
	if dialog_text.get_theme_font_size("font_size") != int(live_fit.get("font_size", -1)):
		_failures.append("阶段 15：实际字号 %d ≠ 适配字号 %d（自适应未生效）" % [
			dialog_text.get_theme_font_size("font_size"), int(live_fit.get("font_size", -1)),
		])
	if not panel.get_global_rect().encloses(dialog_text.get_global_rect()):
		_failures.append("阶段 15：文本区越出对话框面板（%s ⊄ %s）" % [
			dialog_text.get_global_rect(), panel.get_global_rect(),
		])
	var font: Font = dialog_text.get_theme_font("font")
	var need: Vector2 = font.get_multiline_string_size(
		dialog_text.text, HORIZONTAL_ALIGNMENT_LEFT, dialog_text.size.x,
		dialog_text.get_theme_font_size("font_size"))
	if need.y > dialog_text.size.y + 1.0:
		_failures.append("阶段 15：最长文本渲染高 %.1f > 文本框高 %.1f（会裁字）" % [
			need.y, dialog_text.size.y,
		])
	if options_box != null and options_box.visible:
		var overlap: Rect2 = options_box.get_global_rect().intersection(panel.get_global_rect())
		if overlap.size.x > 0.5 and overlap.size.y > 0.5:
			_failures.append("阶段 15：对话框与选项列重叠 %s（面板增高未让行）" % str(overlap))
	# 还原：回到第一幕入口节点，不污染后续阶段（当前为最后一个行为阶段，保守重进）。
	_main.call("_load_act", 1)
	await _wait_physics_frames(INPUT_FRAMES)


## 同步驱动 Main：从当前剧情进度一路走到终局抉择并选择 index 选项（无帧等待，纯结算链）。
func _drive_to_ending(final_option_index: int) -> void:
	var guard := 0
	while guard < 200:
		guard += 1
		if GameState.outcome != GameState.Outcome.NONE:
			return
		match _main.get("_phase"):
			0:  # TITLE
				_main.call("_start_run")
			1:  # STORY
				var node: Dictionary = _main.get("_current_node")
				if node.is_empty():
					return
				if String(node.get("type", "")) == StoryEngine.TYPE_CHOICE:
					var is_final_choice: bool = false
					for option: Variant in node.get("options", []):
						if not String(option.get("ending_intent", "")).is_empty():
							is_final_choice = true
							break
					if is_final_choice:
						_main.call("_select_option", final_option_index)
						return
					_main.call("_select_option", 0)
				else:
					var goto := String(node.get("goto", ""))
					_main.call("_advance", goto)
			2:  # ARENA
				var act: Dictionary = _story.act_at(GameState.act_index - 1)
				var arena: Dictionary = _story.arena_of(act)
				GameState.consume_act_time(float(arena.get("duration_seconds", 0.0)),
						float(arena.get("sanity_drain_per_second", 0.0)))
			3:  # CHECKPOINT
				_main.call("_after_checkpoint")
			_:
				return


func _arena_drain(act_index: int) -> float:
	var act: Dictionary = _story.act_at(act_index - 1)
	return float(_story.arena_of(act).get("sanity_drain_per_second", 0.0))


func _token_line_of_act(act_index: int, persona_id: String) -> String:
	for token: Variant in _story.tokens_of(_story.act_at(act_index - 1)):
		if String(token.get("persona_id", "")) == persona_id:
			return String(token.get("line", ""))
	return ""


func _trace_has_option(node_id: String, option_id: String) -> bool:
	for entry in GameState.trace:
		if String(entry.get("node_id", "")) == node_id and String(entry.get("option_id", "")) == option_id:
			return true
	return false


func _inject_confirm() -> void:
	var event := InputEventAction.new()
	event.action = &"confirm"
	event.pressed = true
	Input.parse_input_event(event)
	if _player != null:
		await _teleport_and_wait(_player.global_position, INPUT_FRAMES)


## 画面内点按：向画布中心的 TapLayer/未命中区注入真实 InputEventScreenTouch（按下+抬起）。
## 合成事件走窗口坐标：用视口 stretch 终变换把画布点映射回窗口点，headless 窗口尺寸
## 与设计分辨率不一致时也能准确落点（实测：直接给画布坐标会被甩出画布外、命不中任何控件）。
func _inject_screen_tap() -> void:
	var canvas_point: Vector2 = get_viewport().get_visible_rect().size * 0.5
	var window_point: Vector2 = get_viewport().get_final_transform() * canvas_point
	var press := InputEventScreenTouch.new()
	press.index = 0
	press.position = window_point
	press.pressed = true
	Input.parse_input_event(press)
	var release := InputEventScreenTouch.new()
	release.index = 0
	release.position = window_point
	release.pressed = false
	Input.parse_input_event(release)
	if _player != null:
		await _teleport_and_wait(_player.global_position, INPUT_FRAMES)


func _inject_action(action: StringName) -> void:
	var event := InputEventAction.new()
	event.action = action
	event.pressed = true
	Input.parse_input_event(event)
	if _player != null:
		await _teleport_and_wait(_player.global_position, INPUT_FRAMES)


## 控件局部点 → 窗口点：先经控件的 canvas 变换映射到画布，再经视口 stretch 终变换
## 映射回窗口坐标（合成触摸事件吃窗口坐标，与 _inject_screen_tap 同一约定）。
func _window_point_of_control(control: Control, local_point: Vector2) -> Vector2:
	var canvas_point: Vector2 = control.get_global_transform_with_canvas() * local_point
	return get_viewport().get_final_transform() * canvas_point


func _window_point_of_canvas_center() -> Vector2:
	var canvas_point: Vector2 = get_viewport().get_visible_rect().size * 0.5
	return get_viewport().get_final_transform() * canvas_point


## 注入真实 ScreenTouch（按下/抬起）——摇杆 _input 阶段与 TapLayer/兜底分支的共同输入源。
func _inject_screen_touch(touch_index: int, window_point: Vector2, pressed: bool) -> void:
	var touch := InputEventScreenTouch.new()
	touch.index = touch_index
	touch.position = window_point
	touch.pressed = pressed
	Input.parse_input_event(touch)


func _inject_screen_drag(touch_index: int, window_point: Vector2) -> void:
	var drag := InputEventScreenDrag.new()
	drag.index = touch_index
	drag.position = window_point
	drag.relative = Vector2(16.0, 16.0)
	Input.parse_input_event(drag)


func _move_strengths_nonzero() -> bool:
	return Input.get_action_strength(&"move_left") > 0.0 \
			or Input.get_action_strength(&"move_right") > 0.0 \
			or Input.get_action_strength(&"move_up") > 0.0 \
			or Input.get_action_strength(&"move_down") > 0.0


func _wait_physics_frames(frames: int) -> void:
	for frame in frames:
		await get_tree().physics_frame


## 连续注入 confirm 推进旁白/台词节点 count 次。
func _advance_story_by_confirm(count: int) -> void:
	for i in count:
		if _main == null:
			return
		var node: Dictionary = _main.get("_current_node")
		if String(node.get("type", "")) == StoryEngine.TYPE_CHOICE:
			return  # 到达抉择点：交给调用方按键选择
		await _inject_confirm()


func _teleport_and_wait(target: Vector2, frames: int = OVERLAP_FRAMES) -> void:
	if _player == null:
		_abort = true
		return
	_player.global_position = target
	for frame in frames:
		await get_tree().physics_frame


func _first_valid_hazard() -> CrisisHazard:
	for node in get_tree().get_nodes_in_group("crisis_hazards"):
		var hazard := node as CrisisHazard
		if hazard != null and is_instance_valid(hazard):
			_last_hazard_multiframe = _animated_with_frames(hazard, &"walk")
			return hazard
	return null


func _token_of_persona(persona_id: String) -> BondToken:
	for node in get_tree().get_nodes_in_group("bond_tokens"):
		var token := node as BondToken
		if token != null and is_instance_valid(token) and token.persona_id == persona_id:
			_last_token_multiframe = _animated_with_frames(token, &"idle")
			return token
	return null


## 多帧动画判定：Body 是 AnimatedSprite2D、声明了指定动画且帧数达标。
func _animated_with_frames(owner_node: Node, anim: StringName) -> bool:
	var body := owner_node.get_node_or_null("Body") as AnimatedSprite2D
	if body == null or body.sprite_frames == null or not body.sprite_frames.has_animation(anim):
		return false
	return body.sprite_frames.get_frame_count(anim) >= MULTIFRAME_MIN_FRAMES


func _count_valid(group_name: String) -> int:
	var count := 0
	for node in get_tree().get_nodes_in_group(group_name):
		if is_instance_valid(node):
			count += 1
	return count


func _report() -> void:
	if _failures.is_empty():
		print("GODOT_SMOKE: PASS 契约五件（数值/人设/剧情/结局/素材）+ 演算三链（独活/带走一个/清除）+ 行为十组（含移动端触摸与虚拟摇杆）全部通过")
		get_tree().quit(0)
	else:
		for failure in _failures:
			printerr("GODOT_SMOKE: FAIL %s" % failure)
		get_tree().quit(1)


func _on_player_moved(_position: Vector2) -> void:
	_moved_seen = true


func _on_favor_changed(_persona_id: String, _value: int) -> void:
	_favor_signal_seen = true


func _on_game_ended(outcome_name: String) -> void:
	_ended_name = outcome_name


func _on_act_expired() -> void:
	_act_expired_seen = true
