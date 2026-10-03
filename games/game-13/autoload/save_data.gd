class_name SaveStore
extends Node
## SaveStore（autoload 单例 SaveData 的脚本）—— 单存档槽进度持久化（策划案 numeric.persistence：1 槽）。
## 存本轮收集进度：关卡、已收计数、剩余预算、剩余实体位置、本局已用时。
## Web 导出下 user:// 落 IndexedDB；桌面端落用户目录，两端语义一致。

const SAVE_PATH: String = "user://game-13-save.json"
const AUTOSAVE_INTERVAL_SECONDS: float = 5.0


static func save_progress(payload: Dictionary) -> bool:
	var file := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if file == null:
		push_warning("[save] 写入失败：%s" % FileAccess.get_open_error())
		return false
	file.store_string(JSON.stringify(payload))
	return true


static func load_progress() -> Dictionary:
	if not FileAccess.file_exists(SAVE_PATH):
		return {}
	var file := FileAccess.open(SAVE_PATH, FileAccess.READ)
	if file == null:
		return {}
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	return parsed if parsed is Dictionary else {}


static func clear_progress() -> bool:
	if not FileAccess.file_exists(SAVE_PATH):
		return true
	return DirAccess.remove_absolute(SAVE_PATH) == OK


static func has_progress() -> bool:
	return not load_progress().is_empty()
