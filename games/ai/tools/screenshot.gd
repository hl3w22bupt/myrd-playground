extends Node
## 开发工具：给主场景拍阶段性截图（user://shots/*.png，不入库），供美术目检。
## 运行：godot --path . tools/screenshot.tscn（需要真实渲染环境，非 headless）。

const SHOT_DIR: String = "user://shots"


func _ready() -> void:
	DirAccess.make_dir_recursive_absolute(SHOT_DIR.trim_prefix("user://"))
	var main: Node2D = load("res://scenes/main.tscn").instantiate()
	add_child(main)
	await _wait(18)
	await _snap("1-title")
	# 剧情首节点
	main.call("_start_run")
	await _wait(36)
	await _snap("2-story-line")
	# 找一个 choice 节点展示对话框 + 选项 + 新面板
	var story: StoryEngine = main.get("story")
	for act in story.acts:
		for node: Variant in story.nodes_of(act):
			if String(node.get("type", "")) == StoryEngine.TYPE_CHOICE:
				main.call("_enter_node", node)
				await _wait(36)
				await _dump_dialog_state(main)
				await _snap("3-story-choice")
				break
		break
	# 行动段：信物 + 危机 多帧精灵
	main.call("_start_arena")
	await _wait(16)
	await _snap("4-arena")
	# 结局画面
	var game_state := get_node("/root/GameState")
	game_state.call("finish_with", 3, "冒烟截图：独活结局演示")
	await _wait(16)
	await _snap("5-ending")
	get_tree().quit(0)


func _dump_dialog_state(main: Node2D) -> void:
	var dialog_text: Label = main.get("dialog_text")
	var panel: Control = main.get("dialog_panel")
	var options: VBoxContainer = main.get("options_box")
	print("[dump] panel rect=", panel.get_global_rect(), " modulate=", panel.modulate,
			" texture=", panel.texture != null)
	print("[dump] dialog_text text='", dialog_text.text, "' font=", dialog_text.get_theme_font_size("font_size"),
			" rect=", dialog_text.get_global_rect(), " visible=", dialog_text.visible)
	print("[dump] options_box rect=", options.get_global_rect(), " visible=", options.visible,
			" anchors=", options.anchor_left, ",", options.anchor_top, ",", options.anchor_right, ",", options.anchor_bottom,
			" offsets=", options.offset_left, ",", options.offset_top, ",", options.offset_right, ",", options.offset_bottom)
	print("[dump] canvas=", main.get_viewport_rect().size, " window=", DisplayServer.window_get_size(),
			" safe=", DisplayServer.get_display_safe_area(), " play=", GameState.play_area_size())
	for child in options.get_children():
		var button := child as Button
		print("[dump]   btn rect=", button.get_global_rect(), " modulate=", button.modulate,
				" stylebox=", button.get_theme_stylebox("normal") != null)


func _snap(shot_name: String) -> void:
	await RenderingServer.frame_post_draw
	var image: Image = get_viewport().get_texture().get_image()
	var path := "%s/%s.png" % [SHOT_DIR, shot_name]
	image.save_png(path)
	print("shot: ", path, " ", image.get_size())


func _wait(frames: int) -> void:
	# 按墙上时间等待（窗口环境 process 帧率不稳，按帧数等会让动效停在半程）。
	await get_tree().create_timer(maxf(frames / 60.0, 0.5)).timeout
