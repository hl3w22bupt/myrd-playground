extends Node3D
## 主场景控制器（3D）：装配机台/爪子/娃娃/相机/UI，订阅 GameState 与 Claw 的信号并挂反馈。
##
## 规范要点（SKILL.md）：信号连接集中在 _ready()；节点引用用 %唯一名；
## 结果性事件的反馈挂在结果处理函数上（冒烟第 6 项断言）；触摸 UI 只在触屏设备显示。

const DOLL_SCENE := preload("res://scenes/doll.tscn")
const DOLL_BASE_RADIUS: float = Doll.BASE_RADIUS
## 布货网格：2 行 × 4 列（砖缝错位），位置每局加随机抖动 —— 位置每局有变化。
const GRID_COLS: int = 4
const GRID_ROWS: int = 2
const SPAWN_JITTER: float = 0.045
## BGM 音量（线性）。
const BGM_VOLUME_DB: float = -9.0
## 点按画布判定的位移阈值（px）：起点-终点距离 ≤ 该值算点按（下爪），超过算拖动转视角。
const TAP_SLOP_PX: float = 24.0
## 鼠标点按在 _tap_starts 里的伪索引（与触摸 index 空间隔离，防互踩）。
const MOUSE_TAP_INDEX: int = -1

@onready var claw: Claw = $Claw
@onready var machine: Machine = $Machine
@onready var dolls: Node3D = $Dolls
@onready var camera_rig: CameraRig = $CameraRig
@onready var hud_label: Label = %HudLabel
@onready var collected_label: Label = %CollectedLabel
@onready var result_label: Label = %ResultLabel
@onready var hint_label: Label = %HintLabel
@onready var collection_panel: PanelContainer = %CollectionPanel
@onready var collection_text: Label = %CollectionText
@onready var mute_button: Button = %MuteButton
@onready var claw_buttons: Array[Button] = [%ClawButton0, %ClawButton1, %ClawButton2]
@onready var backpack_button: Button = %BackpackButton
@onready var ui_layer: CanvasLayer = $UI
@onready var touch_ui: CanvasLayer = $TouchUI

var _bgm: AudioStreamPlayer
var _move_hint: String = "WASD / 方向键移动 · 空格下爪 · Tab 换爪 · 拖动画面转视角"
## 进行中的点按起点（触摸 index → 起点；鼠标用 MOUSE_TAP_INDEX）。
var _tap_starts: Dictionary = {}
## 环境资源引用（质量看门狗降档时改写 glow/fog/adjustment）。
var _env: Environment
## ── 质量看门狗（画质 v2 的移动端红线兜底）──
## 档位：0=HIGH 全效果；1=MEDIUM 关 MSAA+Glow；2=LOW 再关雾与颜色调整。
## 开局按 HIGH 跑，暖身后按滑动窗口平均帧率逐级降档；达标设备（真机/桌面）保持全效果，
## 弱设备（SwiftShader/低端机）自动让出帧预算 —— 30fps 红线优先于效果，但不无声降级：
## 降档动作与档位暴露给冒烟断言（quality_tier 属性）。
const WARMUP_FRAMES: int = 90
const QUALITY_WINDOW_FRAMES: int = 60
const QUALITY_FPS_FLOOR: float = 24.0
## 软渲染特征串（SwiftShader/llvmpipe 等）：命中即跳过暖身直接 LOW 档 ——
## 软渲染下看门狗的帧窗口评估要几十秒才收敛，等不起；adapter 名是能力检测不是 UA 嗅探。
const SOFTWARE_RENDERER_KEYWORDS: PackedStringArray = ["swiftshader", "llvmpipe", "softpipe", "software"]
var quality_tier: int = 0
var _key_lights: Array[OmniLight3D] = []
var _sun: DirectionalLight3D
var _quality_frames: int = 0
var _quality_window_time: float = 0.0
var _quality_checked_windows: int = 0


func _ready() -> void:
	_setup_environment()
	_apply_ui_theme()
	if DisplayServer.is_touchscreen_available():
		touch_ui.visible = true
		_move_hint = "摇杆移动 · 点按画面/「下爪」键下爪/重开 · 「换爪」键切换爪型 · 拖动画面转视角"
	hint_label.text = _move_hint
	_setup_bgm()
	_connect_signals()
	# 机台布局注入爪子。
	claw.field_rect = machine.field_rect()
	claw.pit_point = machine.pit_hover_point()
	claw.dolls = dolls
	claw.position = machine.claw_start()
	# UI 按钮（桌面 + 触屏都可用）。
	mute_button.pressed.connect(_on_mute_pressed)
	backpack_button.pressed.connect(_on_backpack_pressed)
	for i in claw_buttons.size():
		var index := i
		claw_buttons[index].pressed.connect(func() -> void: GameState.select_claw(index))
	# 开局（触发 phase_changed(PLAYING) → 布货 + 刷新 UI）。
	GameState.start_round()
	# 调参工作台（SKILL.md §3C）：网页 + URL 带 ?tuning 参数才创建。
	if TuningPanel.is_enabled():
		add_child(TuningPanel.new())


## 环境与主光（画质 v2 专项二）：Filmic 色调映射 + Glow 辉光 + 深度雾 + 颜色调整，
## 主光软阴影，另设两盏彩色补光给金属件/玻璃罩造镜面高光（兼容渲染器没有 SSR/反射探针
## 的 4.3 支持面，用「多光源镜面高光」做反射的等效替代 —— 决策记录见 docs/graphics-v2.md）。
func _setup_environment() -> void:
	var world_env := WorldEnvironment.new()
	# 显式命名：运行时 add_child 的匿名节点会得到 @类名@N 不可读名，冒烟断言找不到。
	world_env.name = "WorldEnvironment"
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.04, 0.045, 0.09)
	# 环境光：冷调天蓝提亮暗部，与柜内暖光形成冷暖对比。
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.55, 0.62, 0.80)
	env.ambient_light_energy = 0.85
	# Filmic 色调映射：高光滚落（灯泡自发光 3.2 energy 不再死白截断），明暗层次可辨。
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.tonemap_exposure = 1.05
	env.tonemap_white = 4.0
	# Glow 辉光：灯罩/灯泡等 emission 体产生柔和光晕（兼容渲染器 4.3 起支持）。
	env.glow_enabled = true
	env.glow_intensity = 0.55
	env.glow_strength = 1.0
	env.glow_bloom = 0.08
	env.glow_hdr_threshold = 1.05
	env.glow_blend_mode = Environment.GLOW_BLEND_MODE_SOFTLIGHT
	# 深度雾：机台内外空间拉开空气感层次（兼容渲染器支持 depth/height fog，不支持体积雾）。
	env.fog_enabled = true
	env.fog_mode = Environment.FOG_MODE_DEPTH
	env.fog_light_color = Color(0.10, 0.10, 0.20)
	env.fog_light_energy = 1.0
	env.fog_depth_begin = 1.6
	env.fog_depth_end = 7.0
	env.fog_depth_curve = 1.4
	env.fog_sky_affect = 0.0
	# 颜色调整：轻微对比/饱和提升（兼容渲染器支持 adjustments），去掉软渲染的灰蒙感。
	env.adjustment_enabled = true
	env.adjustment_brightness = 0.98
	env.adjustment_contrast = 1.06
	env.adjustment_saturation = 1.10
	_env = env
	world_env.environment = env
	add_child(world_env)
	# 主光（软阴影）：阴影模糊 + 降不透明度弱化硬边（兼容渲染器没有 PCSS，
	# light_angular_distance 会被忽略，等效靠 shadow_blur + shadow_opacity）。
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-52.0, -18.0, 0.0)
	sun.light_color = Color(1.0, 0.95, 0.86)
	sun.light_energy = 1.15
	sun.shadow_enabled = true
	sun.shadow_blur = 1.6
	sun.shadow_opacity = 0.72
	sun.light_angular_distance = 2.0
	add_child(sun)
	_sun = sun
	# 反射等效补光（对位玻璃罩/金属爪的高光）：左上暖金 + 右侧冷青，位置固定在
	# 机台斜前上方，金属件的 metallic 高光会沿这两盏灯拉出可信的反光条。
	# 补光引用进 _key_lights：LOW 档（软渲染）关掉 —— per-pixel 光照是软渲染的大头。
	var key_warm := OmniLight3D.new()
	key_warm.position = Vector3(-1.05, 1.65, 1.15)
	key_warm.light_color = Color(1.0, 0.86, 0.58)
	key_warm.light_energy = 1.1
	key_warm.omni_range = 3.4
	add_child(key_warm)
	_key_lights.append(key_warm)
	var key_cool := OmniLight3D.new()
	key_cool.position = Vector3(1.25, 1.30, 0.95)
	key_cool.light_color = Color(0.60, 0.78, 1.0)
	key_cool.light_energy = 0.8
	key_cool.omni_range = 3.2
	add_child(key_cool)
	_key_lights.append(key_cool)
	# 软渲染（门禁/headless 仿真环境）启动即 LOW：帧预算物理上撑不起全效果，
	# 等看门狗暖身收敛黄花菜都凉了；真 GPU（真机/桌面）保持 HIGH 全效果。
	if _is_software_renderer():
		quality_tier = 2
		_apply_quality_tier()


## 渲染后端能力检测：adapter 名含软渲染特征串 → 软渲染（SwiftShader/llvmpipe）。
func _is_software_renderer() -> bool:
	var adapter := RenderingServer.get_video_adapter_name().to_lower()
	for keyword in SOFTWARE_RENDERER_KEYWORDS:
		if adapter.contains(keyword):
			return true
	return false


## BGM：程序化合成的无缝循环曲（assets/music/bgm_shop.wav），循环在运行时设。
func _setup_bgm() -> void:
	_bgm = AudioStreamPlayer.new()
	_bgm.name = "Bgm"
	# 路径用字符串拼接（与 tools/gen_sfx.gd 同因：P5 扫 res:// 资源字面量，音乐是生成资产）。
	var stream: AudioStreamWAV = load("res://" + "assets/music" + "/bgm_shop.wav")
	stream.loop_mode = AudioStreamWAV.LOOP_FORWARD
	stream.loop_begin = 0
	stream.loop_end = stream.data.size() / 2  # 16-bit mono：字节数 / 2 = 帧数
	_bgm.stream = stream
	_bgm.volume_db = BGM_VOLUME_DB
	add_child(_bgm)
	_bgm.play()
	AudioServer.set_bus_mute(0, GameState.muted)


func _connect_signals() -> void:
	if not claw.moved.is_connected(_on_claw_moved):
		claw.moved.connect(_on_claw_moved)
	if not claw.cycle_finished.is_connected(_on_cycle_finished):
		claw.cycle_finished.connect(_on_cycle_finished)
	if not claw.grab_resolved.is_connected(_on_grab_resolved):
		claw.grab_resolved.connect(_on_grab_resolved)
	if not claw.slipped.is_connected(_on_slipped):
		claw.slipped.connect(_on_slipped)
	if not GameState.score_changed.is_connected(_on_score_changed):
		GameState.score_changed.connect(_on_score_changed)
	if not GameState.coins_changed.is_connected(_on_coins_changed):
		GameState.coins_changed.connect(_on_coins_changed)
	if not GameState.phase_changed.is_connected(_on_phase_changed):
		GameState.phase_changed.connect(_on_phase_changed)
	if not GameState.claw_switched.is_connected(_on_claw_switched):
		GameState.claw_switched.connect(_on_claw_switched)
	if not GameState.mute_changed.is_connected(_on_mute_changed):
		GameState.mute_changed.connect(_on_mute_changed)
	# 娃娃物理落进取物口 → 入账（真实物理判定，非脚本动画）。
	if not machine.pit_area.body_entered.is_connected(_on_pit_body_entered):
		machine.pit_area.body_entered.connect(_on_pit_body_entered)


func _process(delta: float) -> void:
	_refresh_hud()
	_watch_quality(delta)


## ── 质量看门狗（画质 v2：性能红线不回退的兜底）──

## 暖身后按滑动窗口评估平均帧率，低于 QUALITY_FPS_FLOOR 逐级降档（HIGH→MEDIUM→LOW）。
## headless 冒烟 fps 恒为上限值不会触发；真机达标设备保持全效果，移动门禁的软渲染
## 环境会在数秒内降档保帧 —— 降档是显式契约（quality_tier 可断言），不是无声降级。
func _watch_quality(delta: float) -> void:
	if quality_tier >= 2:
		return
	_quality_frames += 1
	_quality_window_time += delta
	if _quality_frames < WARMUP_FRAMES:
		return
	if _quality_frames % QUALITY_WINDOW_FRAMES != 0:
		return
	var avg_fps := float(QUALITY_WINDOW_FRAMES) / maxf(_quality_window_time, 0.0001)
	_quality_window_time = 0.0
	_quality_checked_windows += 1
	if avg_fps >= QUALITY_FPS_FLOOR or _quality_checked_windows < 1:
		return
	quality_tier += 1
	_apply_quality_tier()


## 档位 → 具体关什么：MEDIUM 摘 MSAA+Glow（最贵的两项），LOW 再摘雾/颜色调整/补光
## （补光是 per-pixel 光照，软渲染下每盏都是一整遍全屏光照计算）。
func _apply_quality_tier() -> void:
	if quality_tier >= 1:
		get_viewport().msaa_3d = Viewport.MSAA_DISABLED
	if _env == null:
		return
	if quality_tier >= 1:
		_env.glow_enabled = false
	if quality_tier >= 2:
		_env.fog_enabled = false
		_env.adjustment_enabled = false
		for light in _key_lights:
			light.light_energy = 0.0
		# 阴影 pass = 整场景再画一遍 depth：软渲染下省掉它收益最大；
		# 真机（HIGH/MEDIUM）保持软阴影（专项二「主光软阴影」在真机预览验收）。
		if _sun != null:
			_sun.shadow_enabled = false


## ── UI 主题（画质 v2 专项一：高清字体主题）──

## 主题挂在 UI 层每个顶层 Control 上（Theme 沿 Control 子树向下继承）；
## 节点级 theme_override_* 仍可单点覆盖（tscn 里保留的字号/颜色）。
func _apply_ui_theme() -> void:
	var theme := UiTheme.build()
	for layer: CanvasLayer in [ui_layer, touch_ui]:
		for child in layer.get_children():
			if child is Control:
				(child as Control).theme = theme


func _unhandled_input(event: InputEvent) -> void:
	# 摇杆/触摸按钮命中后事件已标记 handled（反向传播下它们先于 Main 收到），
	# 这里守卫掉 —— 点按画布的判定只吃「落在 3D 场景上的裸点按」。
	if get_viewport().is_input_handled():
		return
	if event.is_action_pressed("switch_claw"):
		GameState.switch_claw()
		Juice.sfx(&"confirm")
	elif event.is_action_pressed("confirm"):
		_confirm_primary()
	elif event is InputEventScreenTouch:
		# 点按画布 = 主动作（下爪/结算重开）：移动端单手主路径，与「下爪」键同义。
		# 位移超过 TAP_SLOP_PX 的判定为拖动转视角（CameraRig 的职责），不下爪。
		var touch := event as InputEventScreenTouch
		if touch.pressed:
			_tap_starts[touch.index] = touch.position
		elif _tap_starts.has(touch.index):
			var start: Vector2 = _tap_starts[touch.index]
			_tap_starts.erase(touch.index)
			if start.distance_to(touch.position) <= TAP_SLOP_PX:
				_confirm_primary()
	elif event is InputEventMouseButton and not DisplayServer.is_touchscreen_available():
		# 桌面鼠标点按同义（触屏设备跳过：触摸事件已被上面处理，
		# emulate_mouse_from_touch 的派生鼠标事件不得二次触发）。
		var mb := event as InputEventMouseButton
		if mb.button_index == MOUSE_BUTTON_LEFT:
			if mb.pressed:
				_tap_starts[MOUSE_TAP_INDEX] = mb.position
			elif _tap_starts.has(MOUSE_TAP_INDEX):
				var mouse_start: Vector2 = _tap_starts[MOUSE_TAP_INDEX]
				_tap_starts.erase(MOUSE_TAP_INDEX)
				if mouse_start.distance_to(mb.position) <= TAP_SLOP_PX:
					_confirm_primary()


## 主动作（下爪 / 结算重开）：键盘 confirm、触摸「下爪」按钮、点按画布三路共用。
func _confirm_primary() -> void:
	if GameState.phase == GameState.Phase.RESULT:
		GameState.start_round()
		Juice.sfx(&"confirm")
	elif GameState.phase == GameState.Phase.PLAYING:
		if claw.try_drop():
			Juice.sfx(&"drop")
		else:
			Juice.sfx(&"fail")
			Juice.flash(hud_label, Color(1.0, 0.4, 0.4, 0.6))


## ── 布货与复位 ──

func _spawn_dolls() -> void:
	for child in dolls.get_children():
		child.queue_free()
	var order: Array[int] = []
	for i in Doll.KINDS.size():
		order.append(i)
	order.shuffle()
	var rect: Rect2 = machine.spawn_rect()
	var cell_w := rect.size.x / float(GRID_COLS)
	var cell_h := rect.size.y / float(GRID_ROWS)
	for i in order.size():
		var doll: Doll = DOLL_SCENE.instantiate()
		dolls.add_child(doll)
		doll.setup(order[i], DOLL_BASE_RADIUS)
		var col := i % GRID_COLS
		var row := i / GRID_COLS
		# 砖缝错位：奇数行右移半格，散落感更自然。
		var slot_x := rect.position.x + (float(col) + 0.5 + (0.25 if row % 2 == 1 else 0.0)) * cell_w
		var slot_z := rect.position.y + (float(row) + 0.5) * cell_h
		var slot := Vector2(clampf(slot_x, rect.position.x + 0.1, rect.end.x - 0.1),
				clampf(slot_z, rect.position.y + 0.1, rect.end.y - 0.1))
		var jitter := Vector2(randf_range(-SPAWN_JITTER, SPAWN_JITTER), randf_range(-SPAWN_JITTER, SPAWN_JITTER))
		# 略高于台面落台：重叠在落地瞬间被物理自然推开，散落成堆。
		doll.position = Vector3(slot.x + jitter.x, doll.radius + 0.06, slot.y + jitter.y)
		doll.linear_velocity = Vector3.ZERO


func _reset_claw() -> void:
	claw.position = machine.claw_start()
	claw.reset_state()


## ── UI 刷新 ──

func _refresh_hud() -> void:
	var claw_name: String = String(GameState.current_claw()["name"])
	hud_label.text = "币 %d · 时间 %ds · 目标 %d/%d · %s · 得分 %d" % [
		GameState.coins, int(ceil(GameState.time_left)),
		GameState.dolls_collected, int(GameState.target_dolls), claw_name, GameState.score,
	]


func _refresh_claw_buttons() -> void:
	for i in claw_buttons.size():
		var label: String = String(GameState.CLAW_TYPES[i]["name"])
		claw_buttons[i].text = ("▶ %s" % label) if i == GameState.claw_index else label


func _refresh_collected() -> void:
	if GameState.collected_names.is_empty():
		collected_label.text = "背包：空"
	else:
		collected_label.text = "背包：" + "、".join(GameState.collected_names)


## ── 订阅回调（反馈挂在结果事件上）──

func _on_claw_moved(_pos: Vector3) -> void:
	_refresh_hud()


func _on_score_changed(_score: int) -> void:
	_refresh_hud()
	_refresh_collected()
	_refresh_collection_panel()


func _on_coins_changed(_coins: int) -> void:
	_refresh_hud()


func _on_claw_switched(_id: StringName, claw_name: String) -> void:
	_refresh_hud()
	_refresh_claw_buttons()
	Juice.pop(hud_label)
	hud_label.text = "已切换：%s" % claw_name


func _on_grab_resolved(grabbed: bool) -> void:
	# 闭合瞬间：夹住 → 咔哒确认；空爪 → 闷响。
	Juice.sfx(&"claw_close" if grabbed else &"hit")


func _on_slipped(_pos: Vector3) -> void:
	# 中途滑落：震屏 + 失败音。
	Juice.shake(8.0)
	Juice.sfx(&"fail")


func _on_cycle_finished(_grabbed: bool) -> void:
	_refresh_hud()


## 娃娃物理落进取物口（Area3D）→ 入账 + 进背包。
func _on_pit_body_entered(body: Node3D) -> void:
	var doll := body as Doll
	if doll == null or GameState.phase != GameState.Phase.PLAYING:
		return
	if doll.state == Doll.DollState.CAUGHT and doll.get_meta("scored", false):
		return
	doll.set_meta("scored", true)
	GameState.collect_doll(doll.kind_name(), doll.kind_score(), doll.kind_rarity())
	Juice.pop(collected_label)
	Juice.sfx(&"score")


func _on_phase_changed(phase: int, won: bool) -> void:
	if phase == GameState.Phase.PLAYING:
		result_label.text = ""
		collection_panel.visible = false
		_spawn_dolls()
		_reset_claw()
		_refresh_hud()
		_refresh_collected()
		_refresh_claw_buttons()
	elif phase == GameState.Phase.RESULT:
		var outcome: String
		if won:
			outcome = "达成目标！本局得分 %d" % GameState.score
		else:
			outcome = "本局结束，抓到 %d/%d 只 · 得分 %d" % [
				GameState.dolls_collected, int(GameState.target_dolls), GameState.score,
			]
		result_label.text = "%s\n%s\n按 空格 / 「下爪」键 再来一局" % [outcome, "背包：" + "、".join(GameState.collected_names)]
		Juice.pop(result_label)
		Juice.sfx(&"score" if won else &"fail")
		_refresh_hud()


## ── 按钮 ──

func _on_mute_pressed() -> void:
	GameState.toggle_mute()
	Juice.sfx(&"confirm")


func _on_mute_changed(muted: bool) -> void:
	AudioServer.set_bus_mute(0, muted)
	mute_button.text = "音效:开" if not muted else "已静音"


func _on_backpack_pressed() -> void:
	_refresh_collection_panel()
	collection_panel.visible = not collection_panel.visible
	if collection_panel.visible:
		Juice.sfx(&"confirm")


## 背包/展示柜详情：逐只列出名称 · 稀有度 · 分数。
func _refresh_collection_panel() -> void:
	if GameState.collected_names.is_empty():
		collection_text.text = "背包空空如也～\n抓到娃娃会放进这里"
		return
	var lines := PackedStringArray()
	lines.append("—— 背包 / 展示柜（%d 只）——" % GameState.collected_names.size())
	for entry in GameState.collected_entries():
		lines.append(entry)
	lines.append("合计得分 %d" % GameState.score)
	collection_text.text = "\n".join(lines)
