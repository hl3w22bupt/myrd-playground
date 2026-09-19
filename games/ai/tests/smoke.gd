extends Node
## 无头冒烟自检（headless smoke）—— 机器可判定的「游戏能不能跑」。
##
## 运行方式（由 std-skills/godot-game-dev/scripts/smoke.sh 封装）：
##   godot --headless --path <工程目录> tests/smoke.tscn
##
## 判定协议（smoke.sh 按此断言退出码与日志）：
##   通过 → stdout 打印 `GODOT_SMOKE: PASS ...`，进程退出码 0
##   失败 → stderr 打印 `GODOT_SMOKE: FAIL <原因>`（每条一行），进程退出码 1
##
## 覆盖面（对应「生存挑战 + 剧情驱动收集」目标的验收标准）：
##   1. 场景可实例化（main.tscn → player.tscn / ai_girlfriend.tscn 接线未断裂）
##   2. autoload 已注册且带约定信号（affection/time/chapter/game_ended/game_restarted）
##   3. InputMap 动作已注册、物理键绑定正确（键位契约，逐键 AND），且注入输入后小李真的动了
##   4. 信号真的到达订阅方（Player.moved / GameState.affection_changed）
##   5. 核心交互生效：走进 AI 女友光圈 → 剧情对话弹出 + 好感 +1 + 她换位重生
##   6. 回应交互生效：对话在场按 confirm → 好感再 +1、对话关闭
##   7. 章节推进可达：好感达章目标 → 进第 2 章、好感清零、时间重置、HUD 刷新
##   8. 胜负可达：最终章好感达标 → WIN（遮罩+标题+按钮文案）；倒计时归零 → LOSE
##   9. 重开可用：键盘 restart 动作与遮罩 RETRY 按钮双通道，全部状态复位
##   外加：噪声相位（确定种子对抗输入）打在前、行为断言在后 —— 输入管线不被噪声楔死。
##
## ⚠️ 输入注入分阶段、互不重叠（error-signatures E-08）：
##   headless 下 `Input.parse_input_event()` 的缓冲冲刷会清掉 `Input.action_press()`
##   设置的按下状态，两者同帧混用会让「移动断言」假失败。

## ── 噪声相位（输入鲁棒性门禁的逐游戏语义层）──
## 正式断言前注入一段确定种子的对抗输入：悬挂手势（按下不抬起）、孤儿释放（抬起无按下）、
## 双指抢控、乱键。随后照常执行移动/收集断言 —— 断言仍全过 = 噪声没有楔死输入管线。
## 只注入原始事件（Key/Mouse/Touch），不注入 InputEventAction —— 动作级投递断言的判定不被噪声污染。
const NOISE_FRAMES: int = 30

## 帧阶段表（Engine.max_fps = 60 下 process : 物理 ≈ 1:1；门禁 --quit-after 240 帧兜底）。
const FRAME_MOVE: int = 31
const FRAME_MOVE_CHECK: int = 41
const FRAME_ENCOUNTER: int = 43
const FRAME_ENCOUNTER_CHECK: int = 47
const FRAME_RESPOND: int = 49
const FRAME_RESPOND_CHECK: int = 53
const FRAME_CHAPTER: int = 55
const FRAME_CHAPTER_CHECK: int = 59
const FRAME_WIN: int = 61
const FRAME_WIN_CHECK: int = 65
const FRAME_LOSE: int = 67
const FRAME_LOSE_CHECK: int = 71
const FRAME_RESTART: int = 73
const FRAME_RESTART_CHECK: int = 77
const FRAME_RETRY_PREP: int = 79
const FRAME_RETRY: int = 83
const FRAME_RETRY_CHECK: int = 87
## 总帧数上限（超过即出报告，防止死循环；smoke.sh 另有 --quit-after 兜底）。
const TOTAL_FRAMES: int = 92
## 判定「真的移动了」的最小位移（像素）。
const MIN_MOVE_DISTANCE: float = 1.0
## 换位重生的最小距离断言（实体承诺 ≥140px，断言取 100px 留兜底余量）。
const MIN_RELOCATE_DISTANCE: float = 100.0
## 时间复位类断言的容差（秒）：断言前会流逝几帧的倒计时。
const TIME_TOLERANCE: float = 2.0

const REQUIRED_ACTIONS: Array[StringName] = [
	&"move_left", &"move_right", &"move_up", &"move_down", &"confirm", &"restart",
]

## 键位契约：动作 → 键表承诺的物理键，**必须全部绑定**（逐键 AND，error-signatures E-12）。
const KEY_CONTRACT: Dictionary = {
	&"move_left": [KEY_A, KEY_LEFT],
	&"move_right": [KEY_D, KEY_RIGHT],
	&"move_up": [KEY_W, KEY_UP],
	&"move_down": [KEY_S, KEY_DOWN],
	&"confirm": [KEY_SPACE, KEY_ENTER],
	&"restart": [KEY_R],
}

## 三位 AI 女友人设 id（剧情人设必须齐：缺谁都是「包围」不成立）。
const EXPECTED_PERSONAS: Array[String] = ["sweet", "zero", "iori"]

var _failures: PackedStringArray = []
var _frames: int = 0
var _finished: bool = false

var _main: Node
var _player: Player
var _girlfriends_node: Node
var _gf_sweet: AIGirlfriend
var _overlay: ColorRect
var _restart_button: Button
var _overlay_action_button: Button
var _dialogue_box: PanelContainer
var _dialogue_label: Label
var _affection_label: Label
var _chapter_label: Label

var _origin_pos: Vector2 = Vector2.ZERO
var _affection_before_encounter: int = 0
var _moved_seen: bool = false
var _affection_changed_seen: bool = false
var _chapter_changed_seen: bool = false
var _win_seen: bool = false
var _lose_seen: bool = false
var _restart_count: int = 0


func _ready() -> void:
	# headless 没有垂直同步，process 帧率可跑到几百上千 FPS，而物理固定 60Hz。
	# 限到 60 FPS 让 --quit-after 的帧数兜底有意义（协程跑得完再退出）。
	Engine.max_fps = 60

	_check_project_settings()

	for action in REQUIRED_ACTIONS:
		if not InputMap.has_action(action):
			_failures.append("InputMap 缺少动作 %s（project.godot [input] 未注册）" % action)
	_check_key_bindings()

	var game_state := get_tree().root.get_node_or_null("GameState")
	if game_state == null:
		_failures.append("autoload GameState 未注册（project.godot [autoload] 缺失）")
	else:
		for signal_name in ["affection_changed", "time_changed", "chapter_changed", "game_ended", "game_restarted"]:
			if not game_state.has_signal(signal_name):
				_failures.append("autoload GameState 缺少信号 %s" % signal_name)
		game_state.affection_changed.connect(_on_affection_changed)
		game_state.chapter_changed.connect(_on_chapter_changed)
		game_state.game_ended.connect(_on_game_ended)
		game_state.game_restarted.connect(_on_game_restarted)

	_main = get_tree().root.find_child("Main", true, false)
	if _main == null:
		_failures.append("场景树找不到 Main（tests/smoke.tscn 未实例化 scenes/main.tscn）")
		return
	_player = _main.find_child("Player", true, false) as Player
	if _player == null:
		_failures.append("场景树找不到 Player（main.tscn 未实例化 player.tscn，或实例名不是 Player）")
	else:
		_player.moved.connect(_on_player_moved)
		_origin_pos = _player.global_position
	_check_girlfriends()
	_check_ui_nodes()


## 静态断言：全局中文字体在位（本工程 HUD/对话/遮罩全是中文文案，Web 导出无系统字体）。
func _check_project_settings() -> void:
	var font_path: String = String(ProjectSettings.get_setting("gui/theme/custom_font", ""))
	if font_path.is_empty():
		_failures.append("中文渲染保障缺失：project.godot 未设置 [gui] theme/custom_font（Web 导出中文会变缺字方块）")
	elif not ResourceLoader.exists(font_path):
		_failures.append("中文渲染保障缺失：theme/custom_font 指向的字体不存在：%s" % font_path)


## 静态断言：三位 AI 女友人设齐备（persona_id 唯一、名字与剧情台词非空、有碰撞体）。
func _check_girlfriends() -> void:
	_girlfriends_node = _main.find_child("Girlfriends", true, false)
	if _girlfriends_node == null:
		_failures.append("主场景找不到 Girlfriends 容器（scenes/main.tscn 缺少 Girlfriends 节点）")
		return
	var personas: Array[String] = []
	for node: Node in _girlfriends_node.get_children():
		var girlfriend := node as AIGirlfriend
		if girlfriend == null:
			_failures.append("Girlfriends 容器下有非 AIGirlfriend 节点：%s（ai_girlfriend.gd 未挂载）" % node.name)
			continue
		personas.append(girlfriend.persona_id)
		if girlfriend.display_name.is_empty():
			_failures.append("AI 女友 %s 的 display_name 为空（人设名缺失，剧情对话无法署名）" % girlfriend.persona_id)
		if girlfriend.story_line.is_empty():
			_failures.append("AI 女友 %s 的 story_line 为空（剧情台词缺失，收集无内容）" % girlfriend.persona_id)
		if girlfriend.get_node_or_null("TouchShape") == null:
			_failures.append("AI 女友 %s 缺少 TouchShape 碰撞体（走进光圈不会触发收集）" % girlfriend.persona_id)
		if girlfriend.persona_id == "sweet":
			_gf_sweet = girlfriend
	for persona in EXPECTED_PERSONAS:
		if not persona in personas:
			_failures.append("AI 女友人设缺失：期望 persona %s，实际 %s（包围感不成立）" % [persona, personas])


## 静态断言：UI 接线（对话/遮罩/重开按钮）与触摸按钮不抢键盘焦点。
func _check_ui_nodes() -> void:
	_dialogue_box = _main.find_child("DialogueBox", true, false) as PanelContainer
	if _dialogue_box == null:
		_failures.append("主场景找不到 DialogueBox（剧情对话无处展示）")
	elif _dialogue_box.visible:
		_failures.append("对话框初始可见：剧情对话应在触发后才出现")
	_dialogue_label = _main.find_child("DialogueLabel", true, false) as Label
	if _dialogue_label == null:
		_failures.append("主场景找不到 DialogueLabel（对话文本节点缺失）")
	_affection_label = _main.find_child("AffectionLabel", true, false) as Label
	if _affection_label == null:
		_failures.append("主场景找不到 AffectionLabel（好感 HUD 缺失）")
	_chapter_label = _main.find_child("ChapterLabel", true, false) as Label
	if _chapter_label == null:
		_failures.append("主场景找不到 ChapterLabel（章节 HUD 缺失）")
	_overlay = _main.find_child("Overlay", true, false) as ColorRect
	if _overlay == null:
		_failures.append("主场景找不到 Overlay 胜负遮罩（scenes/main.tscn 缺少 %Overlay）")
	elif _overlay.visible:
		_failures.append("胜负遮罩初始可见：对局未结束不应显示遮罩")
	_restart_button = _main.find_child("RestartButton", true, false) as Button
	_overlay_action_button = _main.find_child("OverlayActionButton", true, false) as Button
	var buttons: Dictionary = {
		"RestartButton": [_restart_button, "重开按钮"],
		"OverlayActionButton": [_overlay_action_button, "胜负遮罩动作按钮"],
	}
	for button_name: String in buttons:
		var button: Button = buttons[button_name][0]
		if button == null:
			_failures.append("可点按控件缺失：主场景找不到 %s（%s 未创建）" % [button_name, buttons[button_name][1]])
		elif button.focus_mode != Control.FOCUS_NONE:
			_failures.append("触摸控件会抢焦点：%s focus_mode != NONE（键盘 Space 会误触按钮而非回应心动）" % button_name)


func _physics_process(_delta: float) -> void:
	if _finished:
		return
	_frames += 1
	# 任一断言失败立即收口（后续阶段依赖前序状态，继续跑只会产生噪声失败）。
	if not _failures.is_empty():
		_finish()
		return
	if _frames <= NOISE_FRAMES:
		_inject_noise_frame()
	match _frames:
		FRAME_MOVE:
			_origin_pos = _player.global_position
			Input.action_press(&"move_right")
		FRAME_MOVE_CHECK:
			Input.action_release(&"move_right")
			_assert_player_moved()
		FRAME_ENCOUNTER:
			_start_encounter()
		FRAME_ENCOUNTER_CHECK:
			_assert_encounter()
		FRAME_RESPOND:
			_inject_action(&"confirm")
		FRAME_RESPOND_CHECK:
			_assert_responded()
		FRAME_CHAPTER:
			_run_chapter_scenario()
		FRAME_CHAPTER_CHECK:
			_assert_chapter_advanced()
		FRAME_WIN:
			_run_win_scenario()
		FRAME_WIN_CHECK:
			_assert_win()
		FRAME_LOSE:
			_run_lose_scenario()
		FRAME_LOSE_CHECK:
			_assert_lose()
		FRAME_RESTART:
			_inject_action(&"restart")
		FRAME_RESTART_CHECK:
			_assert_restarted("键盘 restart 动作")
		FRAME_RETRY_PREP:
			GameState.time_left = 0.0
			GameState.check_end()
		FRAME_RETRY:
			_overlay_action_button.pressed.emit()
		FRAME_RETRY_CHECK:
			_assert_restarted("遮罩 RETRY 按钮")
			_finish()
			return
	if _frames >= TOTAL_FRAMES:
		_finish()


## ── 阶段 1 断言：注入 move_right 后小李真的动了（位移 + moved 信号双核对）。
func _assert_player_moved() -> void:
	if _player == null:
		return
	var travelled: float = _player.global_position.distance_to(_origin_pos)
	if travelled < MIN_MOVE_DISTANCE:
		_failures.append(
			"玩家 %d 帧内位移 %.2fpx < %.2fpx：InputMap 动作未生效或 _physics_process 未驱动 velocity" % [
				FRAME_MOVE_CHECK - FRAME_MOVE, travelled, MIN_MOVE_DISTANCE,
			]
		)
	if not _moved_seen:
		_failures.append("信号 Player.moved 未到达订阅方：连接断裂或从未 emit")


## ── 阶段 2 准备：把小李瞬移到糖糖身上（真实物理重叠 → body_entered 链路）。
func _start_encounter() -> void:
	if _player == null or _gf_sweet == null:
		_failures.append("核心交互准备失败：Player 或 GfSweet 缺失，收集链路无法验证")
		return
	_affection_before_encounter = GameState.affection
	_player.global_position = _gf_sweet.global_position


## ── 阶段 2 断言：重叠触发收集 —— 好感 +1、剧情对话弹出、女友换位重生、信号送达。
func _assert_encounter() -> void:
	if _gf_sweet == null:
		return
	var expected: int = _affection_before_encounter + 1
	if GameState.affection != expected:
		_failures.append("核心交互失效：走进 AI 女友光圈后好感 %d → %d（期望 %d），Area2D body_entered → encountered → add_affection 链路断裂" % [
			_affection_before_encounter, GameState.affection, expected,
		])
	if not _affection_changed_seen:
		_failures.append("信号 GameState.affection_changed 未到达订阅方：收集计分链路断裂")
	if _dialogue_box != null and not _dialogue_box.visible:
		_failures.append("剧情对话未弹出：收集后 DialogueBox 仍隐藏（main.gd _on_girlfriend_encountered 未生效）")
	if _dialogue_label != null:
		var expected_text: String = "%s：%s" % [_gf_sweet.display_name, _gf_sweet.story_line]
		if _dialogue_label.text != expected_text:
			_failures.append("剧情台词不符：DialogueLabel.text = %s（期望 %s）" % [_dialogue_label.text, expected_text])
	if _player != null:
		var distance: float = _gf_sweet.global_position.distance_to(_player.global_position)
		if distance < MIN_RELOCATE_DISTANCE:
			_failures.append("收集后未换位重生：糖糖距小李 %.1fpx < %.1fpx（_pending_relocate 换位链路断裂，会被反复收集）" % [
				distance, MIN_RELOCATE_DISTANCE,
			])


## ── 阶段 3 断言：对话在场按 confirm → 好感再 +1、对话关闭。
func _assert_responded() -> void:
	var expected: int = _affection_before_encounter + 2
	if GameState.affection != expected:
		_failures.append("回应交互失效：按 confirm 后好感 %d（期望 %d），_unhandled_input → _respond_to_dialogue 链路断裂" % [
			GameState.affection, expected,
		])
	if _dialogue_box != null and _dialogue_box.visible:
		_failures.append("回应交互残留：confirm 回应后 DialogueBox 仍显示（_close_dialogue 未生效）")


## ── 阶段 4 准备：走真实收集管线把好感抬到本章目标（章节推进可达性）。
func _run_chapter_scenario() -> void:
	var target: int = GameState.target_for_chapter(GameState.chapter)
	GameState.add_affection(target - GameState.affection)


## ── 阶段 4 断言：进第 2 章、好感清零、时间重置、HUD 与信号全部到位。
func _assert_chapter_advanced() -> void:
	if GameState.chapter != 2:
		_failures.append("章节推进失效：好感达标后 chapter = %d（期望 2，GameState.check_end → advance_chapter 链路断裂）" % GameState.chapter)
	if GameState.affection != 0:
		_failures.append("章节推进失效：进章后好感未清零（affection=%d）" % GameState.affection)
	if GameState.time_left < GameState.TIME_PER_CHAPTER - TIME_TOLERANCE:
		_failures.append("章节推进失效：进章后心动时间未重置（time_left=%.1f）" % GameState.time_left)
	if not _chapter_changed_seen:
		_failures.append("信号 GameState.chapter_changed 未到达订阅方：章节推进链路断裂")
	if _chapter_label != null and _chapter_label.text != GameState.title_for_chapter(2):
		_failures.append("章节 HUD 未刷新：ChapterLabel.text = %s（期望 %s）" % [
			_chapter_label.text, GameState.title_for_chapter(2),
		])


## ── 阶段 5 准备：最终章把好感抬到目标（WIN 可达性，走真实收集管线）。
func _run_win_scenario() -> void:
	GameState.chapter = GameState.FINAL_CHAPTER
	var target: int = GameState.target_for_chapter(GameState.chapter)
	GameState.add_affection(target - GameState.affection)


## ── 阶段 5 断言：最终章目标达成 → WIN、遮罩显示、按钮切 RETRY。
func _assert_win() -> void:
	if GameState.outcome != GameState.Outcome.WIN:
		_failures.append("胜负不可达：最终章好感达标后 outcome = %s（期望 WIN，check_end 未判胜）" % GameState.outcome)
	if not _win_seen:
		_failures.append("信号 GameState.game_ended(\"win\") 未到达订阅方：胜利判定链路断裂")
	if _overlay != null and not _overlay.visible:
		_failures.append("胜利后遮罩未显示（main.gd _on_game_ended 未生效）")
	var title := _main.find_child("OverlayTitle", true, false) as Label
	if title != null and title.text != _main.TEXT_WIN_TITLE:
		_failures.append("胜利文案缺失：OverlayTitle.text = %s（期望 %s）" % [title.text, _main.TEXT_WIN_TITLE])
	if _overlay_action_button != null and _overlay_action_button.text != _main.TEXT_RETRY_BUTTON:
		_failures.append("遮罩按钮文案未切换：OverlayActionButton.text = %s（期望 %s）" % [
			_overlay_action_button.text, _main.TEXT_RETRY_BUTTON,
		])


## ── 阶段 6 准备：倒计时归零（生存挑战的失败条件），check_end 必须判负。
func _run_lose_scenario() -> void:
	GameState.start_game()
	GameState.time_left = 0.0
	GameState.check_end()


## ── 阶段 6 断言：LOSE、game_ended("lose") 送达、遮罩标题切换。
func _assert_lose() -> void:
	if GameState.outcome != GameState.Outcome.LOSE:
		_failures.append("胜负不可达：心动时间耗尽后 outcome = %s（期望 LOSE，check_end 未判负）" % GameState.outcome)
	if not _lose_seen:
		_failures.append("信号 GameState.game_ended(\"lose\") 未到达订阅方：失败判定链路断裂")
	if _overlay != null and not _overlay.visible:
		_failures.append("失败后遮罩未显示（main.gd _on_game_ended 未覆盖 lose 分支）")
	var title := _main.find_child("OverlayTitle", true, false) as Label
	if title != null and title.text != _main.TEXT_LOSE_TITLE:
		_failures.append("失败文案缺失：OverlayTitle.text = %s（期望 %s，胜负反馈不明确）" % [
			title.text, _main.TEXT_LOSE_TITLE,
		])


## ── 阶段 7 断言：重开后全部复位（状态/章节/好感/时间/遮罩），双通道各验一次。
func _assert_restarted(channel: String) -> void:
	if GameState.outcome != GameState.Outcome.PLAYING:
		_failures.append("重开不可用（%s）：对局状态未复位（outcome=%s，期望 PLAYING）" % [channel, GameState.outcome])
	if GameState.affection != 0:
		_failures.append("重开不可用（%s）：好感未清零（affection=%d）" % [channel, GameState.affection])
	if GameState.chapter != 1:
		_failures.append("重开不可用（%s）：章节未回到第 1 章（chapter=%d）" % [channel, GameState.chapter])
	if GameState.time_left < GameState.TIME_PER_CHAPTER - TIME_TOLERANCE:
		_failures.append("重开不可用（%s）：心动时间未重置（time_left=%.1f）" % [channel, GameState.time_left])
	if _restart_count < 1:
		_failures.append("信号 GameState.game_restarted 未到达订阅方：%s 重开链路断裂" % channel)
	if _overlay != null and _overlay.visible:
		_failures.append("重开不可用（%s）：胜负遮罩仍显示" % channel)
	if _dialogue_box != null and _dialogue_box.visible:
		_failures.append("重开不可用（%s）：剧情对话未关闭" % channel)
	if _chapter_label != null and _chapter_label.text != GameState.title_for_chapter(1):
		_failures.append("重开不可用（%s）：章节 HUD 未复位（ChapterLabel.text=%s）" % [
			channel, _chapter_label.text,
		])


func _finish() -> void:
	if _finished:
		return
	_finished = true
	if _failures.is_empty():
		print("GODOT_SMOKE: PASS 场景实例化/autoload/键位契约/物理移动/收集交互/剧情对话/换位重生/confirm回应/章节推进/胜负判定/键盘重开/遮罩重开/噪声相位 全部通过")
		get_tree().quit(0)
	else:
		for failure in _failures:
			printerr("GODOT_SMOKE: FAIL %s" % failure)
		get_tree().quit(1)


func _on_player_moved(_position: Vector2) -> void:
	_moved_seen = true


func _on_affection_changed(_affection: int) -> void:
	_affection_changed_seen = true


func _on_chapter_changed(_chapter: int) -> void:
	_chapter_changed_seen = true


func _on_game_ended(outcome: String) -> void:
	if outcome == "win":
		_win_seen = true
	elif outcome == "lose":
		_lose_seen = true


func _on_game_restarted() -> void:
	_restart_count += 1


## 无显示设备时模拟「玩家按键」：注入真实 InputEvent，让 _unhandled_input 收得到。
## （Input.action_press 只改动作强度，不产生 InputEvent，触发不了 _unhandled_input。）
## ⚠️ 注入后必须手动 Input.flush_buffered_events() 立即派发，断言才有确定性。
func _inject_action(action: StringName) -> void:
	var event := InputEventAction.new()
	event.action = action
	event.pressed = true
	Input.parse_input_event(event)
	Input.flush_buffered_events()


## 噪声相位：确定种子随机事件（原始事件，不含 InputEventAction）。
var _noise_rng := RandomNumberGenerator.new()


func _inject_noise_frame() -> void:
	if _frames == 1:
		_noise_rng.seed = 20260913  # 门禁要求可复现：同种子同事件序
	var roll := _noise_rng.randf()
	var pos := Vector2(_noise_rng.randf_range(0, 720), _noise_rng.randf_range(0, 1280))
	if roll < 0.30:
		# 悬挂手势：按下不抬起
		var t := InputEventScreenTouch.new()
		t.index = _noise_rng.randi_range(0, 1)
		t.position = pos
		t.pressed = true
		Input.parse_input_event(t)
	elif roll < 0.45:
		# 孤儿释放：抬起无按下
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


## 键位契约断言：目标键表 → project.godot [input] 的 physical_keycode（逐键 AND，E-12）。
func _check_key_bindings() -> void:
	for action: StringName in KEY_CONTRACT:
		if not InputMap.has_action(action):
			continue  # 动作缺失已由 REQUIRED_ACTIONS 断言上报，这里不重复计失败
		var expected: Array = KEY_CONTRACT[action]
		var bound: Array[Key] = []
		for event in InputMap.action_get_events(action):
			var key := event as InputEventKey
			if key != null and key.physical_keycode != KEY_NONE:
				bound.append(key.physical_keycode)
		if not _contains_all(expected, bound):
			_failures.append("键位契约：动作 %s 未绑全键表承诺的物理键（期望全部 %s，实际 %s）—— 缺的那个键真机按了没反应" % [
				action, _key_labels(expected), _key_labels(bound),
			])


## 逐一核对 expected 里每个键都已在 bound 中（AND 语义）。
func _contains_all(expected: Array, bound: Array[Key]) -> bool:
	for key in expected:
		if not (key in bound):
			return false
	return true


## 键码 → 可读键名 + 数值（未映射键名会打私有区字形，数值才能定位）。
func _key_labels(keys: Array) -> String:
	var labels: PackedStringArray = []
	for code in keys:
		labels.append("%s(%d)" % [OS.get_keycode_string(code as Key), code])
	return "[%s]" % ", ".join(labels)
