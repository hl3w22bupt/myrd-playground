class_name PauseOverlay
extends Control
## 暂停层 —— ESC 暂停 / 继续，退出前先存档（保留本轮收集进度）。
## 树暂停时本层保持 PROCESS_MODE_ALWAYS（场景里设置），所以这里的输入仍然收得到。

signal resume_requested
signal save_and_quit_requested

@onready var _status: Label = $Card/Status


func _unhandled_input(event: InputEvent) -> void:
	if not visible:
		return
	if event.is_action_pressed("pause"):
		resume_requested.emit()
		get_viewport().set_input_as_handled()


func show_pause(progress_text: String) -> void:
	visible = true
	_status.text = "本轮进度已保存：%s" % progress_text


func hide_pause() -> void:
	visible = false


func _on_resume_pressed() -> void:
	resume_requested.emit()


func _on_quit_pressed() -> void:
	save_and_quit_requested.emit()
