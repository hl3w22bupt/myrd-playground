extends SceneTree
## 开发工具：把行动段精灵帧拼成一张预览图（tools/sprite-preview.png）。
## 用途：美术帧目检 —— godot --headless -s tools/preview_atlas.gd（工程根执行）。
## 非游戏逻辑、不进导出产物（tools/ 不被场景引用）。

const COLUMNS: int = 6
const CELL: Vector2i = Vector2i(96, 128)
const SCALE := 2.0
const ROWS := [
	"res://assets/art/player/frames/idle-0.svg",
	"res://assets/art/player/frames/idle-1.svg",
	"res://assets/art/player/frames/walk-0.svg",
	"res://assets/art/player/frames/walk-1.svg",
	"res://assets/art/player/frames/walk-2.svg",
	"res://assets/art/player/frames/walk-3.svg",
	"res://assets/art/sprites/lumi/idle-0.svg",
	"res://assets/art/sprites/lumi/walk-0.svg",
	"res://assets/art/sprites/lumi/walk-1.svg",
	"res://assets/art/sprites/lumi/walk-2.svg",
	"res://assets/art/sprites/lumi/walk-3.svg",
	"res://assets/art/sprites/vex/idle-0.svg",
	"res://assets/art/sprites/vex/walk-0.svg",
	"res://assets/art/sprites/vex/walk-1.svg",
	"res://assets/art/sprites/vex/walk-2.svg",
	"res://assets/art/sprites/vex/walk-3.svg",
	"res://assets/art/sprites/ada/idle-0.svg",
	"res://assets/art/sprites/ada/walk-0.svg",
	"res://assets/art/sprites/ada/walk-1.svg",
	"res://assets/art/sprites/ada/walk-2.svg",
	"res://assets/art/sprites/ada/walk-3.svg",
	"res://assets/art/sprites/momo/idle-0.svg",
	"res://assets/art/sprites/momo/walk-0.svg",
	"res://assets/art/sprites/momo/walk-1.svg",
	"res://assets/art/sprites/momo/walk-2.svg",
	"res://assets/art/sprites/momo/walk-3.svg",
	"res://assets/art/sprites/sera/idle-0.svg",
	"res://assets/art/sprites/sera/walk-0.svg",
	"res://assets/art/sprites/sera/walk-1.svg",
	"res://assets/art/sprites/sera/walk-2.svg",
	"res://assets/art/sprites/sera/walk-3.svg",
]


func _init() -> void:
	var cols := COLUMNS
	var rows := int(ceil(ROWS.size() / float(cols)))
	var img := Image.create(cols * CELL.x, rows * CELL.y, false, Image.FORMAT_RGBA8)
	img.fill(Color(0.16, 0.15, 0.2))
	for i in ROWS.size():
		var tex: Texture2D = load(ROWS[i])
		if tex == null:
			continue
		var ox := (i % cols) * CELL.x
		var oy := (i / cols) * CELL.y
		var scaled: Image = tex.get_image()
		scaled.resize(CELL.x, CELL.y, Image.INTERPOLATE_LANCZOS)
		img.blend_rect(scaled, Rect2i(Vector2i.ZERO, CELL), Vector2i(ox, oy))
	img.save_png("res://tools/sprite-preview.png")
	print("sprite-preview.png written: %d×%d (%d 帧)" % [img.get_width(), img.get_height(), ROWS.size()])
	quit(0)
