class_name Tile
extends Node2D
## 汽车卡片：棋盘上的一个格子，承载车型与点击反馈。
##
## 规范要点（见 SKILL.md「GDScript 规范」）：
## - class_name 唯一且与文件名一致（Tile.gd → class_name Tile）；
## - 卡片只管「长什么样、怎么动」，选中/配对逻辑在 GameBoard（对外只暴露状态方法）；
## - 中文车名由全局字体渲染（project.godot [gui] theme/custom_font）。

## 卡片底色（半尺寸，单位像素）：棋盘格子按 100px 布局，卡片本体 88px 留缝。
const HALF_SIZE: float = 44.0

## 车型索引（0..CAR_TYPES.size()-1），由 GameBoard 发牌时写入。
var type_index: int = 0
## 所属格子（col,row），由 GameBoard 维护。
var cell: Vector2i = Vector2i.ZERO
## 选中高亮由 GameBoard 统一控制，卡片只提供接口。
var _selected: bool = false
## 基础缩放（随难度格子尺寸变化）；选中/消除动画都在它之上叠加，避免 6×6 时动画改写尺寸。
var _base_scale: float = 1.0

@onready var _bg: Polygon2D = $Bg
@onready var _label: Label = %CarLabel


## GameBoard 发牌时按难度格子尺寸设置（6×6 格 78px → 卡片缩放 0.78，相邻不重叠）。
func set_base_scale(value: float) -> void:
	_base_scale = value
	if not _selected:
		scale = Vector2.ONE * _base_scale


## GameBoard 实例化后立即调用（在 _ready 之前也可能被调，故字体文案放 setup）。
func setup(new_type: int, new_cell: Vector2i, car_name: String, color: Color) -> void:
	type_index = new_type
	cell = new_cell
	if _label == null:
		await ready
	_label.text = car_name
	_bg.color = color


func set_selected(value: bool) -> void:
	_selected = value
	_apply_tint()


## 光标悬停微高亮（与选中高亮叠加时选中优先）。
func set_cursor_hover(value: bool) -> void:
	modulate = Color(1.16, 1.16, 1.16) if value and not _selected else Color.WHITE


func _apply_tint() -> void:
	if _selected:
		_bg.color = Color(1.0, 0.82, 0.25, 1.0)
		scale = Vector2.ONE * _base_scale * 1.06
	else:
		scale = Vector2.ONE * _base_scale


## 不可消除时的抖动反馈（要求：明确提示，替代刺耳音效）。
func shake() -> void:
	var tween := create_tween()
	tween.tween_property(self, "position:x", position.x + 7.0, 0.05)
	tween.tween_property(self, "position:x", position.x - 7.0, 0.05)
	tween.tween_property(self, "position:x", position.x, 0.05)


## 配对成功：先闪一下再缩放消失；格子数据由 GameBoard 即时清理，动画只管观感。
func pop() -> void:
	var tween := create_tween()
	tween.tween_property(self, "scale", Vector2.ONE * _base_scale * 1.18, 0.08)
	tween.tween_property(self, "scale", Vector2.ZERO, 0.14)
	tween.tween_callback(queue_free)
