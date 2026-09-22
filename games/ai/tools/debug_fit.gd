extends SceneTree
## 临时调试：核对 n01 节点的 fit 输出
func _init() -> void:
	pass
func _initialize() -> void:
	var main: Node2D = load("res://scenes/main.tscn").instantiate()
	root.add_child(main)
	await process_frame
	await process_frame
	var personas: PersonaLoader = main.get("personas")
	var story: StoryEngine = main.get("story")
	var fit_func: Callable = main("fit_dialog_text")
	quit(0)
