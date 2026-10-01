extends Node2D
## 主场景控制器：三波取证收集循环 —— 拾取片段 → 本地校验 → 过波 / 扣信度 → 结算 → 重开。
##
## 玩法闭环（preflight 人工核对第 1 条）：
##   输入 → Player 移动 → KeyFragment 覆盖检测（拾取包络 28px = 片段半径 16 + 玩家半宽 12）
##   → GameState.register_fragment（emit fragment_collected）→ 玩家按「探测」
##   → OakKeyValidator 校验 → GameState.clear_wave / penalize（过波 / 扣信度）
##   → GameState.record_probe 落取证日志/存档（emit probe_finished）→ 本场景渲染反馈
##   → 3 波全过 = 胜利结算；信度归零 = 失败结算；R / 触摸「重开」随时重开一局。
##
## 规范要点（见 SKILL.md）：信号连接集中在 _ready；节点引用用 %唯一名；
## 反馈（Juice）挂在结果事件的处理函数上，不挂在输入处理上（§3B）；
## 调参面板只在网页 + ?tuning 参数时创建（§3C），桌面/无头零成本。

## 探针出生点（每波开始「重新部署」与重开时复位用）。
const SPAWN_POSITION: Vector2 = Vector2(320.0, 180.0)
const FRAGMENT_SCENE: PackedScene = preload("res://scenes/key_fragment.tscn")

## 波次布点（与 GameState.WAVES 一一对应，顺序不能换）：
## - fragments: [chunk, x, y]，按白名单顺序排列 = 推荐拾取路线（每段 41px，11 物理帧可达）；
## - decoys: [x, y, 振幅px, 频率rad/s]，伪造片段绕基准点水平巡逻，越往后越多越快。
const WAVE_LAYOUTS: Array = [
	{
		"fragments": [["OA", 361.0, 180.0], ["K7", 361.0, 139.0], ["42", 401.0, 139.0]],
		"decoys": [[160.0, 300.0, 0.0, 0.0]],
	},
	{
		"fragments": [["OA", 279.0, 180.0], ["K7", 279.0, 139.0], ["42", 320.0, 139.0]],
		"decoys": [[240.0, 80.0, 40.0, 1.0], [460.0, 220.0, 40.0, 1.0]],
	},
	{
		"fragments": [["OA", 320.0, 221.0], ["K7", 361.0, 221.0], ["42", 361.0, 180.0]],
		"decoys": [[140.0, 80.0, 60.0, 1.6], [320.0, 130.0, 60.0, 1.6], [540.0, 300.0, 60.0, 1.6]],
	},
]

@onready var player: Player = $Player
@onready var fragments_root: Node2D = $Fragments
@onready var hud_label: Label = %HudLabel
@onready var status_label: Label = %StatusLabel
@onready var key_label: Label = %KeyLabel
@onready var result_panel: Panel = %ResultPanel
@onready var result_label: Label = %ResultLabel
@onready var settlement_panel: Panel = %SettlementPanel
@onready var settlement_label: Label = %SettlementLabel
@onready var touch_ui: CanvasLayer = $TouchUI

## 按拾取顺序登记的真实片段（伪造片段只置位 decoy 标记，不进序列）。
var _chunks: PackedStringArray = PackedStringArray()
## 上次探测时的状态签名（片段数 | 是否含伪造 | 信度）：相同签名不重复探测。
## 语义：无效探测必扣信度 → 签名必变 → 同状态下可立即重试；拾取/过波/超时重铺
## 这些状态变化会额外清空签名（防「集齐后过波再集齐」被旧签名吞掉）。
var _probed_signature: String = ""
var _move_hint: String = "WASD / 方向键移动 · 空格探测 · R 重开"


func _ready() -> void:
	if DisplayServer.is_touchscreen_available():
		touch_ui.visible = true
		_move_hint = "摇杆移动 · 右下按钮探测 / 重开"
	_connect_signals()
	result_panel.visible = false
	settlement_panel.visible = false
	# 开局：start_run 复位波次/信度并 emit wave_changed → _on_wave_changed 生成第 1 波片段。
	GameState.start_run()
	# 调参工作台（SKILL.md §3C）：网页 + URL 带 ?tuning 参数才创建，其余环境零成本。
	if TuningPanel.is_enabled():
		add_child(TuningPanel.new())
	_refresh_hud()


func _connect_signals() -> void:
	if not player.moved.is_connected(_on_player_moved):
		player.moved.connect(_on_player_moved)
	if not GameState.fragment_collected.is_connected(_on_fragments_changed):
		GameState.fragment_collected.connect(_on_fragments_changed)
	if not GameState.probe_finished.is_connected(_on_probe_finished):
		GameState.probe_finished.connect(_on_probe_finished)
	if not GameState.wave_changed.is_connected(_on_wave_changed):
		GameState.wave_changed.connect(_on_wave_changed)
	if not GameState.run_finished.is_connected(_on_run_finished):
		GameState.run_finished.connect(_on_run_finished)


func _physics_process(delta: float) -> void:
	# 波次计时：tick_wave 返回 true = 本帧恰好归零（超时事件）。
	if GameState.tick_wave(delta):
		_on_wave_timeout()
	_refresh_status()


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("restart"):
		restart_run()
	elif event.is_action_pressed("confirm") and not GameState.run_over:
		_run_probe()


## ── 波次与片段 ────────────────────────────────────────────────────

## 波次开始（含开局/过波/重开）：按布点生成本波片段 + 探针重新部署到出生点。
func _on_wave_changed(_wave: int, _wave_count: int) -> void:
	_chunks = PackedStringArray()
	_probed_signature = ""
	_spawn_wave_fragments()
	player.global_position = SPAWN_POSITION
	player.velocity = Vector2.ZERO
	_refresh_hud()


## 生成本波片段：先移除上一波（remove_child 立即消失 + queue_free 释放），再按布点实例化。
func _spawn_wave_fragments() -> void:
	for child in fragments_root.get_children():
		fragments_root.remove_child(child)
		child.queue_free()
	var layout: Dictionary = WAVE_LAYOUTS[GameState.wave - 1]
	for entry: Array in layout["fragments"]:
		var fragment := FRAGMENT_SCENE.instantiate() as KeyFragment
		fragment.name = "Fragment_%s" % String(entry[0])
		fragment.position = Vector2(float(entry[1]), float(entry[2]))
		fragment.chunk = String(entry[0])
		fragment.is_decoy = false
		fragments_root.add_child(fragment)
	var decoys: Array = layout["decoys"]
	for decoy_index in decoys.size():
		var spec: Array = decoys[decoy_index]
		var decoy := FRAGMENT_SCENE.instantiate() as KeyFragment
		decoy.name = "FragmentDecoy_%d" % decoy_index
		decoy.position = Vector2(float(spec[0]), float(spec[1]))
		decoy.chunk = OakKeyValidator.DECOY_CHUNK
		decoy.is_decoy = true
		decoy.patrol_amplitude = float(spec[2])
		decoy.patrol_frequency = float(spec[3])
		# 相位错开：同波多个伪造片段不同步进退（确定性函数，冒烟可按基准点推算）。
		decoy.patrol_phase = TAU * float(decoy_index) / float(maxi(decoys.size(), 1))
		fragments_root.add_child(decoy)
	# 信号连接集中登记（新片段每波重生成，订阅方统一在此接线）。
	for child in fragments_root.get_children():
		var fragment := child as KeyFragment
		if fragment != null and not fragment.collected.is_connected(_on_fragment_collected):
			fragment.collected.connect(_on_fragment_collected)


## 波次超时：扣 1 信度；未败则本波重铺（片段复位、组装序列清空、计时重开）。
func _on_wave_timeout() -> void:
	GameState.penalize()
	if GameState.run_over:
		return  # 信度耗尽：_on_run_finished 已接管结算反馈
	_chunks = PackedStringArray()
	_probed_signature = ""
	# 本波白收的片段不作数：拾取进度归零（分数保留 —— 分数只在过波/拾取时增减）。
	GameState.reset_pickup()
	for child in fragments_root.get_children():
		var fragment := child as KeyFragment
		if fragment != null:
			fragment.restore()
	GameState.wave_time_left = GameState.wave_time_budget()
	result_panel.visible = true
	result_label.text = "⏱ 时间耗尽\n本波片段已重铺，组装序列清空\n（信度 -1 → %d/%d · 抓紧时间重新收集）" % [
		GameState.credibility, int(GameState.probe_credits),
	]
	# 结果性反馈（SKILL.md §3B）：超时 = 震动 + 音效 + 状态栏闪烁。
	Juice.shake(6.0)
	Juice.flash(status_label, Color(1.0, 0.5, 0.35, 0.8))
	Juice.sfx(&"hit")
	_refresh_hud()


## ── 探测与结算 ────────────────────────────────────────────────────

## 发起一次 key 探测：本地校验 + 取证记录（GameState 落日志与存档）。
func _run_probe() -> void:
	var signature: String = "%d|%d|%d" % [
		_chunks.size(), 1 if GameState.decoy_collected else 0, GameState.credibility,
	]
	if signature == _probed_signature:
		return
	_probed_signature = signature
	var result: Dictionary = OakKeyValidator.validate(_chunks, GameState.decoy_collected)
	# record_probe 内部：打取证日志行 + 写取证存档 + emit probe_finished（反馈在订阅方渲染）。
	GameState.record_probe(result)


## 探测结果落地（结果事件处理函数：反馈挂在这里，不挂在输入处理上）。
func _on_probe_finished(record: Dictionary) -> void:
	var valid: bool = String(record.get("oak_key_probe", "invalid")) == "valid"
	if valid:
		GameState.clear_wave()
	else:
		GameState.penalize()
	if GameState.run_over:
		return  # 胜利/失败结算面板已由 _on_run_finished 接管（探测结论并入结算文案）
	result_panel.visible = true
	if valid:
		result_label.text = "第 %d 波探测：key 有效 ✓\n+%d 分（含时间奖励） · 组装 %s\n（进入第 %d 波 · 片段重新布点，越往后人越多）" % [
			GameState.wave - 1, GameState.WAVE_CLEAR_SCORE, String(record.get("key", "")),
			GameState.wave,
		]
		Juice.pop(result_panel)
		Juice.sfx(&"confirm")
	else:
		result_label.text = "探测结果：key 无效 ✗\n%s\n（信度 -1 → %d/%d · 已拾片段保留，可继续调整再探）" % [
			String(record.get("reason", "")), GameState.credibility, int(GameState.probe_credits),
		]
		Juice.flash(result_panel, Color(1.0, 0.45, 0.4, 0.7))
		Juice.sfx(&"fail")
	_refresh_hud()


## 局终结算（胜利 / 失败共用一个面板，反馈与统计一次给全）。
func _on_run_finished(outcome: StringName) -> void:
	result_panel.visible = false
	settlement_panel.visible = true
	var victory := outcome == &"victory"
	var valid_count: int = 0
	for record in GameState.probe_history:
		if String(record.get("oak_key_probe", "")) == "valid":
			valid_count += 1
	var invalid_count: int = GameState.probe_history.size() - valid_count
	settlement_label.text = "%s\n\n到达第 %d/%d 波 · 总分 %d\n探测 %d 次：有效 %d · 无效 %d\n取证标记 oak_key_probe 已写入日志与 user://oak_key_probe.json\n按 R / 触摸「重开」再来一局" % [
		"胜利 ✓ 全部波次通过" if victory else "失败 ✗ 探针信度耗尽",
		GameState.wave, GameState.WAVES.size(), GameState.score,
		GameState.probe_history.size(), valid_count, invalid_count,
	]
	Juice.pop(settlement_panel)
	Juice.sfx(&"confirm" if victory else &"fail")


## 重开一局：start_run 复位波次/信度并重铺第 1 波（_on_wave_changed 接管片段与出生点）。
func restart_run() -> void:
	_chunks = PackedStringArray()
	_probed_signature = ""
	result_panel.visible = false
	settlement_panel.visible = false
	GameState.start_run()


## 最近一次探测结果（冒烟断言用）。
func last_probe_record() -> Dictionary:
	if GameState.probe_history.is_empty():
		return {}
	return GameState.probe_history[GameState.probe_history.size() - 1]


## ── UI 刷新 ───────────────────────────────────────────────────────

## 拾取落地：分数 +1、登记片段（伪造片段只置位 decoy 标记）、真实片段进组装序列。
## 结果性反馈（SKILL.md §3B）：收集 = 弹跳 + 音效，挂在结果处理函数上。
func _on_fragment_collected(fragment: KeyFragment) -> void:
	_probed_signature = ""
	GameState.add_score(1)
	GameState.register_fragment(fragment.is_decoy)
	if not fragment.is_decoy:
		_chunks.append(fragment.chunk)
		Juice.pop(player)
		Juice.sfx(&"score")
	_refresh_hud()


func _on_player_moved(pos: Vector2) -> void:
	hud_label.text = "%s · 坐标 %d,%d" % [_move_hint, int(pos.x), int(pos.y)]


func _on_fragments_changed(_count: int, _required: int) -> void:
	_refresh_hud()


func _refresh_hud() -> void:
	key_label.text = "组装中 key：%s\n目标顺序：%s · 伪造片段 %s 必须避开（红色会巡逻）" % [
		OakKeyValidator.assemble(_chunks),
		OakKeyValidator.CHUNK_SEPARATOR.join(PackedStringArray(OakKeyValidator.VALID_CHUNKS)),
		OakKeyValidator.DECOY_CHUNK,
	]
	_refresh_status()


## 状态栏每物理帧刷新（波次 / 倒计时 / 信度 / 分数）。
func _refresh_status() -> void:
	var dots: String = "●".repeat(GameState.credibility) \
		+ "○".repeat(maxi(int(GameState.probe_credits) - GameState.credibility, 0))
	status_label.text = "第 %d/%d 波 · 剩余 %.1fs · 信度 %s · 分数 %d" % [
		GameState.wave, GameState.WAVES.size(), GameState.wave_time_left, dots, GameState.score,
	]
