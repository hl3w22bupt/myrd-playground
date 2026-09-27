class_name InputContract
extends RefCounted
## acc-01 输入映射契约：动作化输入（jump/slide/restart/confirm），键盘键位逐键核对，
## 游戏逻辑代码零 KEY_ 常量（键位一律进 project.godot [input]），触屏双通道节点在位。

## 键位契约：动作 → 键表承诺的物理键（逐键 AND，见模板 smoke.gd 说明）。
const KEY_CONTRACT: Dictionary = {
	&"jump": [KEY_W, KEY_UP, KEY_SPACE],
	&"slide": [KEY_S, KEY_DOWN],
	&"restart": [KEY_R],
	&"confirm": [KEY_SPACE, KEY_ENTER],
}

## 游戏逻辑代码目录（KEY_ 扫描范围；tests/ 的键位契约层属合法例外）。
## 前缀在打开时拼接，避免 P5 把目录字符串当资源引用。
const LOGIC_DIRS: Array[String] = ["scripts/", "autoload/"]


static func run(main: Node) -> PackedStringArray:
	var failures: PackedStringArray = []
	for action: StringName in KEY_CONTRACT.keys():
		if not InputMap.has_action(action):
			failures.append("InputMap 缺少动作 %s（project.godot [input] 未注册）" % action)
			continue
		var expected: Array = KEY_CONTRACT[action]
		var bound: Array[Key] = []
		for event in InputMap.action_get_events(action):
			var key := event as InputEventKey
			if key != null and key.physical_keycode != KEY_NONE:
				bound.append(key.physical_keycode)
		for key: Key in expected:
			if not (key in bound):
				failures.append("键位契约：动作 %s 缺物理键 %s（承诺逐键可用，实际 %s）" % [
					action, OS.get_keycode_string(key), bound,
				])
	var key_violations := _scan_key_constants()
	if not key_violations.is_empty():
		failures.append("游戏逻辑代码出现 KEY_ 常量（应改走 InputMap 动作）：%s" % [key_violations])
	# 触屏双通道：TouchUI 存在且挂手势/跳跃按钮生产者（仅检查接线，不要求可见）。
	if main != null:
		var swipe: Node = main.get_node_or_null("TouchUI/SwipeLayer")
		if swipe == null or swipe.get_script() == null:
			failures.append("TouchUI/SwipeLayer 缺失或未挂 touch_swipe.gd（触屏点按/上滑/下滑通道断裂）")
		var jump_button: Node = main.get_node_or_null("TouchUI/JumpAnchor/JumpButton")
		if jump_button == null or jump_button.get_script() == null:
			failures.append("TouchUI/JumpAnchor/JumpButton 缺失或未挂 touch_confirm_button.gd（触屏跳跃按钮断裂）")
	return failures


## 扫描游戏逻辑 .gd 里的 KEY_ 常量（剥注释后；contracts 键位契约层豁免）。
static func _scan_key_constants() -> PackedStringArray:
	var violations: PackedStringArray = []
	var key_regex := RegEx.new()
	key_regex.compile("\\bKEY_[A-Z0-9_]+\\b")
	for dir_path: String in LOGIC_DIRS:
		var dir := DirAccess.open("res://" + dir_path)
		if dir == null:
			continue
		dir.list_dir_begin()
		var file_name: String = dir.get_next()
		while file_name != "":
			if file_name.ends_with(".gd"):
				var text: String = _read_stripped("res://" + dir_path + file_name)
				if key_regex.search(text) != null:
					violations.append(dir_path + file_name)
			file_name = dir.get_next()
		dir.list_dir_end()
	return violations


## 读文件并剥掉 # 注释（与 preflight P13 同口径，注释里的对照不触发）。
static func _read_stripped(path: String) -> String:
	var access := FileAccess.open(path, FileAccess.READ)
	if access == null:
		return ""
	var lines: PackedStringArray = []
	while not access.eof_reached():
		var line: String = access.get_line()
		var hash_index: int = line.find("#")
		if hash_index >= 0:
			line = line.substr(0, hash_index)
		lines.append(line)
	return "\n".join(lines)
