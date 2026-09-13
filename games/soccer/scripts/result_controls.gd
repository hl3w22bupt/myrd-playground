class_name ResultControls
extends CanvasLayer
## 终场结算「再来一局」按钮层（v3 迭代）：移动端触摸 + 桌面鼠标同一入口。
##
## 架构不变式（沿 TouchControls 的「InputMap 生产者」模式，SKILL.md §3A）：
##   - 本层是重开动作的生产者：按下命中区内注入 InputEventAction(ACTION)，
##     与键盘 R（[input] restart）走同一条 Main._unhandled_input 路径，
##     不存在「触摸重开分支逻辑」；键盘快捷键（R / Enter / 空格）全部保留；
##   - 鼠标与触摸走同一入口：InputEventMouseButton（左键）与
##     InputEventScreenTouch 都汇入 _press_at / _release_at，命中判定同一段代码；
##   - 可见性纪律：只在终场结算（Main.set_active(true)）出现且可交互，
##     比赛进行中整层隐藏、不接收任何输入，不干扰既有触摸控件（摇杆 + 射门/传球/切换）；
##   - 命中区与视觉绘制同源常量（BTN_RECT），触达区域 ≥ 44x44（触控最小触达标准）；
##     画布 1280x720 坐标系，canvas_items 拉伸下各分辨率等比映射。
##
## 子控件（全屏绘制 Control）在 _ready() 用代码构建：绘制型 UI 无外部资源引用，
## 不进 .tscn（遵守「场景文件最小手写」的工程纪律）。

## 注入的重开动作：与键盘 R 同一个 [input] 动作（复用既有重开输入路径）。
const ACTION: StringName = &"restart"
## 按钮命中区 = 绘制区（同源常量，画布坐标）。260x64 ≥ 44x44，
## 位于结算面板（y 256..464）下方、HUD 帮助条（y 678..708）上方，不遮挡比分/结果文字。
const BTN_RECT: Rect2 = Rect2(510.0, 508.0, 260.0, 64.0)
## 触控最小触达标准（像素）；断言钉死，防止误改成小尺寸。
const MIN_TOUCH_SIZE: float = 44.0
## 鼠标指针的伪 index（触点 index ≥ 0，互不冲突）。
const MOUSE_POINTER: int = -1

## 是否处于「可点」状态（终场结算）。由 Main 驱动，不自行读 GameState。
var active: bool = false

var _canvas: Control
## 当前按住的指针（触点 index 或 MOUSE_POINTER；-2 = 无）。
var _held_pointer: int = -2


func _ready() -> void:
	layer = 11  # 高于 TouchControls(10) 与 HUD，结算时按钮在最上层可见
	visible = false
	_canvas = Control.new()
	_canvas.name = "ResultCanvas"
	_canvas.set_anchors_preset(Control.PRESET_FULL_RECT)
	# 子 Control 不拦截 GUI 事件：输入由本层 _unhandled_input 统一处理，
	# 防止遮挡（拦截）键盘/触摸派发给游戏逻辑的关键事件。
	_canvas.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_canvas.draw.connect(_on_canvas_draw)
	add_child(_canvas)


## 终场结算显示按钮；重开/进行中隐藏并释放按住状态（防动作卡在按下态）。
func set_active(value: bool) -> void:
	active = value
	visible = value
	if not value:
		_force_release()
	_redraw()


func _exit_tree() -> void:
	_force_release()


## ---- 输入处理（鼠标左键与触摸同一入口） ----

func _unhandled_input(event: InputEvent) -> void:
	if not visible:
		return
	var touch := event as InputEventScreenTouch
	if touch != null:
		if touch.pressed:
			_press_at(touch.index, touch.position)
		elif _held_pointer == touch.index:
			_release_at(touch.index)
		return
	var mouse := event as InputEventMouseButton
	if mouse != null and mouse.button_index == MOUSE_BUTTON_LEFT:
		if mouse.pressed:
			_press_at(MOUSE_POINTER, mouse.position)
		elif _held_pointer == MOUSE_POINTER:
			_release_at(MOUSE_POINTER)


func _press_at(pointer: int, pos: Vector2) -> void:
	# 单指针语义：已有指针按住时忽略第二根手指（按钮非多点触控目标）。
	if _held_pointer != -2:
		return
	if not button_rect().has_point(pos):
		return
	_held_pointer = pointer
	var press := InputEventAction.new()
	press.action = ACTION
	press.pressed = true
	Input.parse_input_event(press)
	_redraw()


func _release_at(pointer: int) -> void:
	if _held_pointer != pointer:
		return
	_held_pointer = -2
	var release := InputEventAction.new()
	release.action = ACTION
	release.pressed = false
	Input.parse_input_event(release)
	_redraw()


func _force_release() -> void:
	if _held_pointer != -2:
		_release_at(_held_pointer)
	_held_pointer = -2


## ---- 查询（冒烟断言 / 调试用） ----

func button_rect() -> Rect2:
	return BTN_RECT


func button_center() -> Vector2:
	return BTN_RECT.get_center()


func button_size() -> Vector2:
	return BTN_RECT.size


func is_button_held() -> bool:
	return _held_pointer != -2


## ---- 绘制（命中区与视觉同源 BTN_RECT） ----

func _redraw() -> void:
	if _canvas != null:
		_canvas.queue_redraw()


func _on_canvas_draw() -> void:
	if not visible:
		return
	var font: Font = _canvas.get_theme_default_font()
	var font_size: int = 24
	var held := is_button_held()
	# 按钮主体：填充 + 描边（按住加亮）。
	var fill := Color(0.16, 0.62, 0.32, 0.92) if held else Color(0.16, 0.62, 0.32, 0.78)
	_canvas.draw_rect(BTN_RECT, fill)
	_canvas.draw_rect(BTN_RECT, Color(1, 1, 1, 0.85), false, 2.5)
	if font != null:
		var label := "再来一局"
		var width := font.get_string_size(label, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x
		var baseline := BTN_RECT.get_center().y + font_size * 0.36
		_canvas.draw_string(font, Vector2(BTN_RECT.get_center().x - width * 0.5, baseline),
			label, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, Color(1, 1, 1, 0.96))
