class_name RhythmNote
extends Node2D
## 下落音符：极简几何（圆角条块），位置由轨道按歌曲时钟计算。
##
## - 位置更新是纯函数赋值（conductor.note_y），不自己做速度积分；
## - 命中后由轨道标记并隐藏；MISS 后由轨道移除。

## 音符在谱面中的时刻（秒）。
var note_time: float = 0.0
## 谱面下标（轨道用它回查谱面/去重）。
var chart_index: int = -1
## 是否已被命中（命中后不再参与判定）。
var hit: bool = false

## 视觉尺寸（轨道宽 180，留边距）。
const NOTE_WIDTH: float = 150.0
const NOTE_HEIGHT: float = 34.0


func _draw() -> void:
	var half := Vector2(NOTE_WIDTH, NOTE_HEIGHT) / 2.0
	draw_rect(Rect2(-half, Vector2(NOTE_WIDTH, NOTE_HEIGHT)), Color(0.30, 0.80, 1.0, 0.95))
	# 内芯高亮条：给音符一点「可击打」的视觉重心。
	draw_rect(Rect2(-half + Vector2(8, 8), Vector2(NOTE_WIDTH - 16, NOTE_HEIGHT - 16)),
		Color(0.85, 0.98, 1.0, 0.9))
