extends Node2D
## 主场景控制器：《我被ai女友包围了》剧情生存挑战。
##
## 玩法闭环（核心循环的本作落法）：
##   剧情节点选择（对话框 + 选项）→ 好感·威胁·生存结算（GameState.apply_effects，trace 落账）
##   → 行动段（追心动信物=互动 / 躲游走危机）→ 幕间结算（体力·饱食·升级）
##   → 触发后续剧情与结局分支 → 终局抉择 → resolver 判定 →（confirm 重开）
##
## 相位机：TITLE → STORY → ARENA → CHECKPOINT →（下一幕 STORY / 终局段 STORY）→ RESOLVE → ENDING。
##
## 数据驱动（基线 §八依赖方向）：
## - 人设卡（PersonaLoader）只认 schema，改卡免改码；美术路径全部来自卡内 art 字段；
## - 剧情幕（StoryEngine）只声明节点/选项/effects，效果由 GameState 通用结算链消费；
## - 全局数值来自 data/spec/numeric.json，改表即调；
## - 本脚本出现任何硬编码角色名 / 数值都属于违规（评审与冒烟契约都会打回）。

## 心动信物场景：Main 负责实例化（重开一局 / 换幕才能重生）。
const TOKEN_SCENE: PackedScene = preload("res://scenes/bond_token.tscn")
## 危机脉冲场景：同上。
const HAZARD_SCENE: PackedScene = preload("res://scenes/crisis_hazard.tscn")
## 选项按钮底板：StyleBoxTexture 共用一张，选中/hover 用 modulate 提亮。
const OPTION_TEXTURE: Texture2D = preload("res://assets/art/ui/option-button.svg")
## 触控参数默认值：键名与 data/spec/touch.json 一一对应（加载失败/缺键时回落到这里）。
## 改触控手感 = 改 JSON，不改代码（触控参数作为可配置内容管理）。
const TOUCH_DEFAULTS: Dictionary = {
	"joystick_base_radius": 56.0,
	"joystick_stick_radius": 26.0,
	"joystick_deadzone_ratio": 0.25,
	"min_touch_px": 44.0,
	"option_button_max_height": 96.0,
	"confirm_button_size": 128.0,
}
## 触控参数内容文件落点。
const TOUCH_CONFIG_PATH: String = "res://data/spec/touch.json"

## 相位枚举。
enum Phase { TITLE, STORY, ARENA, CHECKPOINT, ENDING }

## 表情档位（PersonaLoader.EXPRESSION_* 的本场景语义别名）。
enum ExpressionKind { NORMAL, HAPPY, CRISIS }

## 台词 / 旁白气泡的停留时长（秒）：到点自动隐藏，新台词会重置计时。
const DIALOGUE_SECONDS: float = 4.0
## 幕间结算文案的停留时长（秒）：confirm 可跳过。
const CHECKPOINT_SECONDS: float = 1.4
## 花名册行高（px）：5 行 × 行高 + 间隔落在 RosterBox 里。
const ROSTER_ROW_HEIGHT: float = 32.0

@onready var player: Player = $Player
@onready var hud_label: Label = %HudLabel
@onready var act_label: Label = %ActLabel
@onready var toast_label: Label = %ToastLabel
@onready var dialog_panel: TextureRect = %DialogPanel
@onready var portrait_rect: TextureRect = %Portrait
@onready var speaker_label: Label = %SpeakerLabel
@onready var dialog_text: Label = %DialogText
@onready var options_box: VBoxContainer = %OptionsBox
@onready var confirm_hint: Label = %ConfirmHint
@onready var roster_box: VBoxContainer = %RosterBox
@onready var title_screen: TextureRect = %TitleScreen
@onready var end_screen: TextureRect = %EndScreen
@onready var end_label: Label = %EndLabel
@onready var end_reason_label: Label = %EndReason
@onready var end_basis_label: Label = %EndBasis
@onready var touch_ui: CanvasLayer = $TouchUI
@onready var joystick: VirtualJoystick = $TouchUI/JoystickAnchor
@onready var confirm_button: TouchConfirmButton = $TouchUI/ConfirmAnchor/ConfirmButton

## 人设卡目录（只认 schema，不认角色名）。
var personas: PersonaLoader = PersonaLoader.new()
## 剧情幕引擎（幕链 / 节点图闭合校验）。
var story: StoryEngine = StoryEngine.new()

## 当前相位。
var _phase: int = Phase.TITLE
## 当前幕数据。
var _current_act: Dictionary = {}
## 当前剧情节点（STORY 相位）。
var _current_node: Dictionary = {}
## 选项按钮（choice 节点重建）。
var _option_buttons: Array[Button] = []
## 键盘焦点选中的选项下标。
var _selected_option: int = 0
var _tokens: Array[BondToken] = []
var _hazards: Array[CrisisHazard] = []
## 气泡剩余显示时长（秒）。
var _dialogue_seconds_left: float = 0.0
## 幕间结算剩余时长（秒），confirm 可跳过。
var _checkpoint_seconds_left: float = 0.0
## 生成失败已进入 fail-fast 出口：置位后 _refresh_hud 不再改写 HUD，保住失败原因。
var _spawn_failed: bool = false
## 终局抉择声明的意向（alone/save_one/together）。
var _ending_intent: String = ""
## 花名册行缓存：persona_id → {favor_label, threat_label, panel}。
var _roster_rows: Dictionary = {}
## 生效中的触控参数（TOUCH_DEFAULTS ∪ touch.json 覆盖值）。
var _touch: Dictionary = TOUCH_DEFAULTS.duplicate()
## 推进提示文案：按输入设备切换（触屏 = 点按画面；桌面 = 空格）。
var _advance_hint: String = "空格 继续 ▼"


func _ready() -> void:
	end_screen.visible = false
	title_screen.visible = false
	dialog_panel.visible = false
	options_box.visible = false
	toast_label.visible = false
	personas.load_catalog()
	story.load_story(GameState.play_area_size())
	# 横竖屏旋转 / 窗口尺寸变化时刷新玩法边界（玩家由 player.gd 每帧钳制，落点下一幕重生）。
	if not get_viewport().size_changed.is_connected(_on_viewport_size_changed):
		get_viewport().size_changed.connect(_on_viewport_size_changed)
	_validate_content()
	_connect_signals()
	_build_roster()
	_setup_touch()
	_apply_safe_area()
	_show_title()


func _physics_process(delta: float) -> void:
	if _phase == Phase.ARENA and GameState.outcome == GameState.Outcome.NONE and not _current_act.is_empty():
		var arena: Dictionary = story.arena_of(_current_act)
		GameState.tick_survival(delta, float(arena.get("sanity_drain_per_second", 0.0)))
	if _dialogue_seconds_left > 0.0:
		_dialogue_seconds_left -= delta
		if _dialogue_seconds_left <= 0.0:
			toast_label.visible = false
	if _phase == Phase.CHECKPOINT and _checkpoint_seconds_left > 0.0:
		_checkpoint_seconds_left -= delta
		if _checkpoint_seconds_left <= 0.0:
			_after_checkpoint()


## 信号连接：订阅方（本场景）写连接代码，发布方（player / GameState / 按钮）只 emit。
func _connect_signals() -> void:
	if not player.moved.is_connected(_on_player_moved):
		player.moved.connect(_on_player_moved)
	for pair: Array in [[&"stamina_changed", _on_survival_changed], [&"satiety_changed", _on_survival_changed],
			[&"sanity_changed", _on_survival_changed], [&"act_time_changed", _on_act_time_changed],
			[&"favor_changed", _on_stat_changed], [&"threat_changed", _on_stat_changed]]:
		var signal_name: StringName = pair[0]
		if not GameState.is_connected(signal_name, pair[1]):
			GameState.connect(signal_name, pair[1])
	if not GameState.act_changed.is_connected(_on_act_changed):
		GameState.act_changed.connect(_on_act_changed)
	if not GameState.act_timer_expired.is_connected(_on_act_timer_expired):
		GameState.act_timer_expired.connect(_on_act_timer_expired)
	if not GameState.game_ended.is_connected(_on_game_ended):
		GameState.game_ended.connect(_on_game_ended)


## 内容交叉校验：加载器/引擎的结构错误 + effects 引用的人设必须存在 + 契约错误。
func _validate_content() -> void:
	var problems := PackedStringArray()
	problems.append_array(personas.errors)
	problems.append_array(story.errors)
	problems.append_array(GameState.numeric_contract_errors)
	for act in story.acts:
		for node: Variant in story.nodes_of(act):
			if String(node.get("type", "")) != StoryEngine.TYPE_CHOICE:
				continue
			for option: Variant in node.get("options", []):
				var effects: Dictionary = option.get("effects", {})
				for map_key in ["favor", "threat"]:
					if not effects.has(map_key):
						continue
					var delta_map: Dictionary = effects[map_key]
					for persona_id: String in delta_map:
						if not personas.has_persona(persona_id):
							problems.append("%s 选项 %s 的 effects.%s 引用了不存在的人设「%s」" % [
								String(node.get("id", "?")), String(option.get("id", "?")), map_key, persona_id,
							])
		for token: Variant in story.tokens_of(act):
			if not personas.has_persona(String(token.get("persona_id", ""))):
				problems.append("%s 引用了不存在的人设「%s」" % [
					String(token.get("node_id", "?")), token.get("persona_id", ""),
				])
		for hazard: Variant in story.hazards_of(act):
			if not personas.has_persona(String(hazard.get("persona_id", ""))):
				problems.append("%s 引用了不存在的人设「%s」" % [
					String(hazard.get("node_id", "?")), hazard.get("persona_id", ""),
				])
	if not problems.is_empty():
		_content_fatal(problems)


## 内容不合法必须 fail-fast：玩家面对的不能是一局「能操作但永远赢不了 / 输不了」的假游戏。
func _content_fatal(problems: PackedStringArray) -> void:
	_spawn_failed = true
	for problem in problems:
		push_error("内容校验失败：%s" % problem)
	hud_label.text = "内容校验失败（%d 处，详见日志），游戏终止" % problems.size()
	get_tree().quit(1)


## —— 花名册（左侧五人 favor/threat 面板，QA BUG-6 修复项）——
func _build_roster() -> void:
	for child in roster_box.get_children():
		child.queue_free()
	_roster_rows = {}
	for persona_id: String in personas.persona_ids():
		var row := PanelContainer.new()
		row.custom_minimum_size = Vector2(118.0, ROSTER_ROW_HEIGHT)
		row.mouse_filter = Control.MOUSE_FILTER_IGNORE
		var hbox := HBoxContainer.new()
		hbox.add_theme_constant_override("separation", 4)
		hbox.mouse_filter = Control.MOUSE_FILTER_IGNORE
		row.add_child(hbox)
		var avatar := TextureRect.new()
		avatar.custom_minimum_size = Vector2(26.0, 26.0)
		avatar.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		avatar.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		var avatar_texture: Texture2D = load(personas.avatar_path(persona_id))
		if avatar_texture != null:
			avatar.texture = avatar_texture
		hbox.add_child(avatar)
		var name_label := Label.new()
		name_label.text = personas.display_name(persona_id)
		name_label.add_theme_color_override("font_color", personas.color(persona_id))
		name_label.custom_minimum_size = Vector2(52.0, 0.0)
		hbox.add_child(name_label)
		var stat_label := Label.new()
		stat_label.add_theme_font_size_override("font_size", 11)
		hbox.add_child(stat_label)
		roster_box.add_child(row)
		_roster_rows[persona_id] = {"stat_label": stat_label, "row": row}
	_refresh_roster()


## 花名册数值刷新；威胁 ≥ 该人设 crisis_threshold 时整行描红（策划案 §6 视觉规则）。
func _refresh_roster() -> void:
	for persona_id: String in _roster_rows:
		var row_data: Dictionary = _roster_rows[persona_id]
		var stat_label: Label = row_data["stat_label"]
		stat_label.text = "好%d 威%d" % [GameState.favor_of(persona_id), GameState.threat_of(persona_id)]
		var row: PanelContainer = row_data["row"]
		var panicked: bool = GameState.threat_of(persona_id) >= personas.crisis_threshold(persona_id)
		row.modulate = Color(1.0, 0.45, 0.45) if panicked else Color.WHITE


## —— 相位：标题 ——
func _show_title() -> void:
	_phase = Phase.TITLE
	title_screen.visible = true
	dialog_panel.visible = false
	options_box.visible = false
	end_screen.visible = false
	toast_label.visible = false
	hud_label.text = ""
	act_label.text = ""


## 开一局（标题开始 / 重开共用）。
func _start_run() -> void:
	_spawn_failed = false
	_ending_intent = ""
	_current_act = {}
	_current_node = {}
	end_screen.visible = false
	title_screen.visible = false
	_clear_spawned()
	GameState.initialize_state(personas.favor_initial_table(), personas.threat_initial_table())
	player.reset_to_start()
	_load_act(1)


## 进入指定幕：清旧物件 → 幕状态 → 剧情入口节点。
func _load_act(index: int) -> void:
	var act := story.act_at(index - 1)
	if act.is_empty():
		_content_fatal(PackedStringArray(["幕序越界：第 %d 幕不存在（幕链可能断裂）" % index]))
		return
	_current_act = act
	_clear_spawned()
	var arena: Dictionary = story.arena_of(act)
	GameState.begin_act(
		index,
		String(act.get("title", "")),
		float(arena.get("duration_seconds", 0.0)),
	)
	_enter_node(story.entry_of(act))
	_refresh_hud()


## —— 相位：剧情段 ——
func _enter_node(node: Dictionary) -> void:
	if node.is_empty():
		_content_fatal(PackedStringArray(["剧情节点为空（节点图可能断裂）"]))
		return
	_phase = Phase.STORY
	_current_node = node
	_selected_option = 0
	var speaker_id := String(node.get("persona_id", ""))
	match String(node.get("type", "")):
		StoryEngine.TYPE_CHOICE:
			dialog_panel.visible = true
			_show_portrait(speaker_id, ExpressionKind.NORMAL)
			speaker_label.text = _speaker_prefix(speaker_id)
			dialog_text.text = String(node.get("prompt", ""))
			confirm_hint.text = "点按选项卡 选择" if _touch_enabled() else "W/S 或 ↑/↓ 选择 · 1-4 直选 · 空格 确认"
			_rebuild_options(node)
			options_box.visible = true
			_highlight_option()
		StoryEngine.TYPE_LINE:
			dialog_panel.visible = true
			options_box.visible = false
			_show_portrait(speaker_id, _mood_for(speaker_id))
			speaker_label.text = _speaker_prefix(speaker_id)
			dialog_text.text = String(node.get("text", ""))
			confirm_hint.text = _advance_hint
		_:
			dialog_panel.visible = true
			options_box.visible = false
			_show_portrait("", ExpressionKind.NORMAL)
			speaker_label.text = ""
			dialog_text.text = String(node.get("text", ""))
			confirm_hint.text = _advance_hint
	# 旁白 / 台词节点的幕首事件数值（如召回公告、无人机夜）：进入节点即结算。
	if String(node.get("type", "")) != StoryEngine.TYPE_CHOICE and node.has("effects"):
		GameState.apply_effects(node.get("effects", {}), String(node.get("id", "")), "node", speaker_id)
	_refresh_hud()


## 表情档位：好感 ≥ 互动门槛的她会用 happy 差分说话（美术状态由数据驱动）。
func _mood_for(persona_id: String) -> int:
	if persona_id.is_empty():
		return ExpressionKind.NORMAL
	if GameState.favor_of(persona_id) >= GameState.interact_favor_gate:
		return ExpressionKind.HAPPY
	return ExpressionKind.NORMAL


func _speaker_prefix(persona_id: String) -> String:
	if persona_id.is_empty():
		return ""
	return "%s · %s" % [personas.display_name(persona_id), personas.title_text(persona_id)]


## 立绘 / 表情差分切换：路径全部来自人设卡 art 字段（美术单一事实源）。
func _show_portrait(persona_id: String, kind: int) -> void:
	var path := ""
	if persona_id.is_empty():
		path = ""
	else:
		var expressions: Array = personas.expression_paths(persona_id)
		if kind == ExpressionKind.HAPPY and expressions.size() > PersonaLoader.EXPRESSION_HAPPY:
			path = String(expressions[PersonaLoader.EXPRESSION_HAPPY])
		elif expressions.size() > PersonaLoader.EXPRESSION_NORMAL:
			path = String(expressions[PersonaLoader.EXPRESSION_NORMAL])
		if path.is_empty():
			path = personas.portrait_path(persona_id)
	var texture: Texture2D = load(path) if not path.is_empty() else null
	portrait_rect.texture = texture


## 选项按钮：文本来自幕 JSON；选中态用 modulate 提亮（键盘 + 鼠标双通道）。
func _rebuild_options(node: Dictionary) -> void:
	for button in _option_buttons:
		button.queue_free()
	_option_buttons = []
	var options: Array = node.get("options", [])
	for i in options.size():
		var option: Dictionary = options[i]
		var button := Button.new()
		button.text = "%d. %s" % [i + 1, String(option.get("text", ""))]
		button.alignment = HORIZONTAL_ALIGNMENT_LEFT
		# 触控热区契约：高度 ≥ min_touch_px 个物理像素（窗口/画布缩放换算），宽度铺满选项列。
		button.custom_minimum_size = Vector2(0.0, _min_option_height())
		button.size_flags_horizontal = Control.SIZE_FILL
		button.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		button.focus_mode = Control.FOCUS_NONE
		var style := StyleBoxTexture.new()
		style.texture = OPTION_TEXTURE
		button.add_theme_stylebox_override("normal", style)
		button.add_theme_stylebox_override("hover", style)
		button.add_theme_stylebox_override("pressed", style)
		button.pressed.connect(_on_option_pressed.bind(i))
		options_box.add_child(button)
		_option_buttons.append(button)


func _highlight_option() -> void:
	for i in _option_buttons.size():
		_option_buttons[i].modulate = Color(1.35, 1.3, 1.1) if i == _selected_option else Color(0.75, 0.75, 0.8)


func _on_option_pressed(index: int) -> void:
	_select_option(index)


## 选中一个选项：effects 走通用结算链（trace 落账），随后按 goto 推进。
func _select_option(index: int) -> void:
	if _phase != Phase.STORY or _current_node.is_empty():
		return
	var options: Array = _current_node.get("options", [])
	if index < 0 or index >= options.size():
		return
	var option: Dictionary = options[index]
	_ending_intent = String(option.get("ending_intent", ""))
	var speaker_id := String(_current_node.get("persona_id", ""))
	GameState.apply_effects(
		option.get("effects", {}),
		String(_current_node.get("id", "")),
		String(option.get("id", "")),
		speaker_id,
	)
	if GameState.outcome == GameState.Outcome.GAMEOVER:
		return  # 结算触发清除结局：game_ended 已接管 UI
	_advance(String(option.get("goto", "")))


## 推进 goto：哨兵 ARENA / RESOLVE 或下一个剧情节点。
func _advance(goto: String) -> void:
	if goto == StoryEngine.GOTO_ARENA:
		_start_arena()
		return
	if goto == StoryEngine.GOTO_RESOLVE:
		_resolve_ending()
		return
	_enter_node(story.node_by_id(_current_act, goto))


## —— 相位：行动段 ——
func _start_arena() -> void:
	_phase = Phase.ARENA
	dialog_panel.visible = false
	options_box.visible = false
	_clear_spawned()
	_spawn_tokens(_current_act)
	_spawn_hazards(_current_act)
	_show_dialogue("行动段：追上心动信物与她互动，躲开游走的危机！")
	_refresh_hud()


func _clear_spawned() -> void:
	for token in _tokens:
		if is_instance_valid(token):
			token.queue_free()
	for hazard in _hazards:
		if is_instance_valid(hazard):
			hazard.queue_free()
	_tokens.clear()
	_hazards.clear()


func _spawn_tokens(act: Dictionary) -> void:
	for token_data: Variant in story.tokens_of(act):
		var token: BondToken = TOKEN_SCENE.instantiate() as BondToken
		if token == null:
			_content_fatal(PackedStringArray(["心动信物场景实例化失败：res://scenes/bond_token.tscn"]))
			return
		var persona_id := String(token_data.get("persona_id", ""))
		token.position = StoryEngine.to_vector2(token_data.get("position", []))
		token.apply_story(
			String(token_data.get("node_id", "")),
			persona_id,
			String(token_data.get("line", "")),
			personas.avatar_path(persona_id),
			personas.color(persona_id),
		)
		token.collected.connect(_on_token_collected)
		add_child(token)
		_tokens.append(token)


func _spawn_hazards(act: Dictionary) -> void:
	for hazard_data: Variant in story.hazards_of(act):
		var hazard: CrisisHazard = HAZARD_SCENE.instantiate() as CrisisHazard
		if hazard == null:
			_content_fatal(PackedStringArray(["危机脉冲场景实例化失败：res://scenes/crisis_hazard.tscn"]))
			return
		var persona_id := String(hazard_data.get("persona_id", ""))
		var points := PackedVector2Array()
		for point: Variant in hazard_data.get("patrol", []):
			points.append(StoryEngine.to_vector2(point as Array))
		var expressions: Array = personas.expression_paths(persona_id)
		var crisis_texture := ""
		if expressions.size() > PersonaLoader.EXPRESSION_CRISIS:
			crisis_texture = String(expressions[PersonaLoader.EXPRESSION_CRISIS])
		hazard.setup(
			String(hazard_data.get("node_id", "")),
			persona_id,
			points,
			float(hazard_data.get("speed", 0.0)) * personas.speed_bias(persona_id),
			crisis_texture,
		)
		hazard.triggered.connect(_on_hazard_triggered)
		add_child(hazard)
		_hazards.append(hazard)


## 幕倒计时到点 → 幕间结算（体力/饱食/饥饿/升级 → 下一幕或终局段）。
func _on_act_timer_expired() -> void:
	if _phase != Phase.ARENA or GameState.outcome != GameState.Outcome.NONE:
		return
	_phase = Phase.CHECKPOINT
	_clear_spawned()
	GameState.apply_checkpoint(story.checkpoint_sanity_cost(_current_act))
	if GameState.outcome == GameState.Outcome.GAMEOVER:
		return  # 幕间结算触发清除结局：game_ended 已接管 UI
	var escalations: Array[Dictionary] = []
	for persona_id in personas.persona_ids():
		var pid := String(persona_id)
		if GameState.threat_of(pid) >= personas.crisis_threshold(pid):
			escalations.append({
				"persona_id": pid,
				"gain": personas.escalation_per_phase(pid),
			})
	GameState.apply_escalation(escalations)
	if GameState.outcome == GameState.Outcome.GAMEOVER:
		return
	var text := story.checkpoint_text(_current_act)
	if text.is_empty():
		_after_checkpoint()
		return
	toast_label.text = text
	toast_label.visible = true
	_dialogue_seconds_left = 0.0
	_checkpoint_seconds_left = CHECKPOINT_SECONDS


## 幕间结算完成后：终幕进终局段，其余进下一幕。
func _after_checkpoint() -> void:
	_checkpoint_seconds_left = 0.0
	toast_label.visible = false
	if GameState.outcome != GameState.Outcome.NONE:
		return
	if story.is_final_act(_current_act):
		_enter_node(story.post_arena_entry_of(_current_act))
	else:
		_load_act(GameState.act_index + 1)


## —— 相位：终局判定 ——
func _resolve_ending() -> void:
	var result: Dictionary = EndingResolver.resolve(GameState, _ending_intent)
	var outcome_value := -1
	match String(result.get("ending", "")):
		EndingResolver.GAMEOVER:
			outcome_value = GameState.Outcome.GAMEOVER
		EndingResolver.TOGETHER:
			outcome_value = GameState.Outcome.TOGETHER
		EndingResolver.SAVE_ONE:
			outcome_value = GameState.Outcome.SAVE_ONE
		EndingResolver.ALONE:
			outcome_value = GameState.Outcome.ALONE
	if outcome_value < 0:
		_content_fatal(PackedStringArray(["终局判定返回未知结局：%s" % str(result)]))
		return
	_pending_ending_basis = result
	GameState.finish_with(outcome_value, String(result.get("reason", "")))


## 结局界面展示用（_on_game_ended 时消费）。
var _pending_ending_basis: Dictionary = {}


## —— HUD / 台词 ——
func _refresh_hud() -> void:
	if _spawn_failed:
		return
	hud_label.text = "体力 %.0f/%.0f · 饱食 %.0f/%.0f · 理智 %.0f/%.0f · 食物 %d · Σ威胁 %d" % [
		GameState.stamina, GameState.stamina_max,
		GameState.satiety, GameState.satiety_max,
		GameState.sanity, GameState.sanity_max,
		GameState.food,
		GameState.sigma_threat(),
	]
	act_label.text = "%s ｜ 行动倒计时 %d 秒" % [
		GameState.act_title if not GameState.act_title.is_empty() else "准备中",
		int(ceil(GameState.act_remaining)),
	]
	_set_bar_fill("UI/BarStamina", GameState.stamina / GameState.stamina_max)
	_set_bar_fill("UI/BarSatiety", GameState.satiety / GameState.satiety_max)
	_set_bar_fill("UI/BarSanity", GameState.sanity / GameState.sanity_max)
	_refresh_roster()


func _set_bar_fill(bar_path: String, ratio: float) -> void:
	var fill := get_node_or_null(bar_path + "/Fill") as ColorRect
	if fill == null:
		return
	fill.size = Vector2(clampf(ratio, 0.0, 1.0) * 116.0, 8.0)


## 剧情气泡：收集台词 / 危机台词 / 幕旁白共用一条通道（单行滚动覆盖，末位优先）。
func _show_dialogue(text: String) -> void:
	if text.is_empty():
		return
	toast_label.text = text
	toast_label.visible = true
	_dialogue_seconds_left = DIALOGUE_SECONDS


## —— 信号回调 ——
func _on_player_moved(_position: Vector2) -> void:
	_refresh_hud()


func _on_survival_changed(_value: float) -> void:
	_refresh_hud()


func _on_stat_changed(_persona_id: String, _value: int) -> void:
	_refresh_hud()


func _on_act_time_changed(_remaining: float) -> void:
	_refresh_hud()


func _on_act_changed(_act_index: int, _act_title: String) -> void:
	_refresh_hud()


func _on_token_collected(token: BondToken) -> void:
	var persona_id := token.persona_id
	var gate_bonus: float = GameState.interact_sanity_bonus \
			if GameState.favor_of(persona_id) >= GameState.interact_favor_gate else 0.0
	GameState.settle_interact(
		persona_id,
		token.node_id,
		GameState.interact_favor_gain + personas.interact_modifier(persona_id),
		personas.interact_sanity_regen(persona_id),
		gate_bonus,
	)
	_tokens.erase(token)
	token.queue_free()
	_show_dialogue("%s：%s" % [personas.display_name(persona_id), token.dialogue_line])
	_refresh_hud()


func _on_hazard_triggered(hazard: CrisisHazard) -> void:
	GameState.settle_hit(
		hazard.persona_id,
		hazard.node_id,
		GameState.threat_per_hit,
		GameState.sanity_hit_penalty,
	)
	var line := personas.crisis_line(hazard.persona_id)
	if not line.is_empty():
		_show_dialogue("危机｜%s：%s" % [personas.display_name(hazard.persona_id), line])
	_refresh_hud()


func _on_game_ended(_outcome_name: String) -> void:
	_phase = Phase.ENDING
	_clear_spawned()
	dialog_panel.visible = false
	options_box.visible = false
	end_screen.visible = true
	end_label.text = EndingResolver.ENDING_TITLES.get(GameState.outcome_name(), "终局")
	end_reason_label.text = GameState.end_reason
	var lines := PackedStringArray()
	for persona_id in GameState.persona_ids_snapshot():
		lines.append("%s 好%d/威%d" % [
			personas.display_name(String(persona_id)),
			GameState.favor_of(String(persona_id)),
			GameState.threat_of(String(persona_id)),
		])
	end_basis_label.text = " ｜ ".join(lines)
	_refresh_hud()


## —— 输入 ——
func _unhandled_input(event: InputEvent) -> void:
	# 画面内点按：触屏的「推进」主路径。只认 InputEventScreenTouch（emulate_mouse_from_touch
	# 合成出的鼠标事件在此忽略，避免一次点按双触发）；落在选项按钮/摇杆/确认按钮上的触摸
	# 已被 gui 命中或摇杆消费，不会到达这里。
	if event.is_action_pressed("tap_advance", false):
		_handle_screen_tap()
		return
	if event is InputEventScreenTouch and event.pressed:
		# 兜底路径：未被 gui 命中体系消费的裸触摸（不同平台分发差异下的第二通道）。
		_handle_screen_tap()
		return
	# allow_echo 显式传 false：长按会产生一串 echo 事件。
	match _phase:
		Phase.TITLE:
			if event.is_action_pressed("confirm", false):
				_start_run()
		Phase.STORY:
			_handle_story_input(event)
		Phase.CHECKPOINT:
			if event.is_action_pressed("confirm", false):
				_after_checkpoint()
		Phase.ENDING:
			if event.is_action_pressed("confirm", false):
				restart()
		_:
			pass


func _handle_story_input(event: InputEvent) -> void:
	if _current_node.is_empty() or String(_current_node.get("type", "")) != StoryEngine.TYPE_CHOICE:
		if event.is_action_pressed("confirm", false):
			var goto := String(_current_node.get("goto", ""))
			_advance(goto)
		return
	var option_count := _option_buttons.size()
	if option_count == 0:
		return
	if event.is_action_pressed("move_down", false):
		_selected_option = (_selected_option + 1) % option_count
		_highlight_option()
	elif event.is_action_pressed("move_up", false):
		_selected_option = (_selected_option - 1 + option_count) % option_count
		_highlight_option()
	elif event.is_action_pressed("confirm", false):
		_select_option(_selected_option)
	else:
		for i in option_count:
			if event.is_action_pressed("option_%d" % (i + 1), false):
				_selected_option = i
				_highlight_option()
				_select_option(i)
				return


## 视口尺寸变化（旋转 / 分屏 / 桌面拖拽窗口）：刷新玩法边界。
func _on_viewport_size_changed() -> void:
	story.play_bounds = GameState.play_area_size()


## 画面内点按的相位语义（与 confirm 一致，唯独 choice 相位例外）：
## choice 相位点按空白处不结算 —— 必须点选项按钮（热区 ≥44 物理像素），防止误触选错。
func _handle_screen_tap() -> void:
	match _phase:
		Phase.TITLE:
			_start_run()
		Phase.STORY:
			if _current_node.is_empty() or String(_current_node.get("type", "")) != StoryEngine.TYPE_CHOICE:
				_advance(String(_current_node.get("goto", "")))
		Phase.CHECKPOINT:
			_after_checkpoint()
		Phase.ENDING:
			restart()
		_:
			pass


## 重开一局（结局界面 confirm 触发）：状态归零、玩家回起点、第一幕重生。
## 顺序硬约束：先 reset 状态与玩家，再重生物件 —— 否则上一局接触点上的新物件会立刻被结算。
func restart() -> void:
	_start_run()


## —— 移动端触摸装配 ——
## 触屏环境才显示 TouchUI（摇杆 + 确认按钮）；用 is_touchscreen_available 判定，
## 不用平台特征：触屏笔记本键盘 UI 也在，无触屏设备不显示。桌面环境整体不可见（零回归）。
func _setup_touch() -> void:
	_load_touch_config()
	touch_ui.visible = _touch_enabled()
	joystick.base_radius = float(_touch.get("joystick_base_radius", 56.0))
	joystick.stick_radius = float(_touch.get("joystick_stick_radius", 26.0))
	joystick.deadzone_ratio = float(_touch.get("joystick_deadzone_ratio", 0.25))
	joystick.custom_minimum_size = Vector2(joystick.base_radius, joystick.base_radius) * 2.0
	joystick.queue_redraw()
	var confirm_size := maxf(float(_touch.get("confirm_button_size", 128.0)),
			float(_touch.get("min_touch_px", 44.0)))
	confirm_button.apply_hotspot(Vector2(confirm_size, confirm_size))
	if _touch_enabled():
		_advance_hint = "点按画面 继续 ▼"
		var title_hint := get_node_or_null("UI/TitleScreen/TitleHint") as Label
		if title_hint != null:
			title_hint.text = "点按画面 开始"
		var end_hint := get_node_or_null("UI/EndScreen/EndHint") as Label
		if end_hint != null:
			end_hint.text = "点按画面 再来一局"


func _touch_enabled() -> bool:
	return DisplayServer.is_touchscreen_available()


## 读取触控参数内容文件：JSON 缺失/格式错/缺键都回落默认值，不让坏配置崩掉游戏。
func _load_touch_config() -> void:
	var text: String = FileAccess.get_file_as_string(TOUCH_CONFIG_PATH)
	if text.is_empty():
		return
	var parsed: Variant = JSON.parse_string(text)
	if typeof(parsed) != TYPE_DICTIONARY:
		push_warning("触控参数文件格式不正确，使用默认值：%s" % TOUCH_CONFIG_PATH)
		return
	for key: String in TOUCH_DEFAULTS:
		if parsed.has(key):
			_touch[key] = parsed[key]


## 选项按钮的最小高度（逻辑像素）：把「≥ min_touch_px 物理像素」按窗口/画布缩放换算，
## 并用可配置上限钳制 —— 桌面缩放 ≥1 时回到紧凑尺寸（视觉不变），小屏手机换算出大热区。
func _min_option_height() -> float:
	var window_size := Vector2(DisplayServer.window_get_size())
	var canvas_size := get_viewport_rect().size
	var min_touch_px: float = float(_touch.get("min_touch_px", 44.0))
	var max_height: float = float(_touch.get("option_button_max_height", 96.0))
	if window_size.x <= 0.0 or window_size.y <= 0.0 or canvas_size.x <= 0.0 or canvas_size.y <= 0.0:
		return min_touch_px
	var scale := minf(window_size.x / canvas_size.x, window_size.y / canvas_size.y)
	if scale <= 0.0:
		return min_touch_px
	return clampf(ceilf(min_touch_px / scale), 20.0, max_height)


## 刘海/打孔屏安全区避让：把安全区内缩量换算成画布逻辑像素，分别推移
## 顶部信息簇（下移右移）与底部/右侧触控与对话控件（上收左收）。
## 无安全区 API 的环境（headless/Web 返回零矩形）自然退化为零位移。
func _apply_safe_area() -> void:
	var window_size := Vector2(DisplayServer.window_get_size())
	var safe := Rect2(DisplayServer.get_display_safe_area())
	var canvas_size := get_viewport_rect().size
	if window_size.x <= 0.0 or window_size.y <= 0.0 or safe.size.x <= 0.0 or safe.size.y <= 0.0:
		return
	var sx := canvas_size.x / window_size.x
	var sy := canvas_size.y / window_size.y
	var left := safe.position.x * sx
	var top := safe.position.y * sy
	var right := (window_size.x - safe.end.x) * sx
	var bottom := (window_size.y - safe.end.y) * sy
	for node_path in ["UI/HudLabel", "UI/ActLabel", "UI/BarStamina", "UI/BarSatiety", "UI/BarSanity"]:
		var node := get_node_or_null(NodePath(node_path)) as Control
		if node != null:
			node.offset_left += left
			node.offset_top += top
			node.offset_right += left
			node.offset_bottom += top
	_nudge_control(get_node_or_null("UI/DialogPanel") as Control, left, 0.0, -right, -bottom)
	_nudge_control(get_node_or_null("UI/OptionsBox") as Control, 0.0, 0.0, -right, -bottom)
	_nudge_control(get_node_or_null("TouchUI/JoystickAnchor") as Control, left, 0.0, 0.0, -bottom)
	_nudge_control(get_node_or_null("TouchUI/ConfirmAnchor") as Control, 0.0, 0.0, -right, -bottom)


## 安全区推移助手：对 Control 的四边 offsets 追加增量（节点缺失时静默跳过）。
func _nudge_control(control: Control, dl: float, dt: float, dr: float, db: float) -> void:
	if control == null:
		return
	control.offset_left += dl
	control.offset_top += dt
	control.offset_right += dr
	control.offset_bottom += db
