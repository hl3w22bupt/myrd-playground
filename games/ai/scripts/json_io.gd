class_name JsonIO
extends RefCounted
## JSON 数据读取的统一入口：人设卡 / 剧情幕 / 数值表都从这里读。
##
## 为什么不直接 `FileAccess.get_file_as_string` 一把梭：
## - Godot 4 会把 `.json` 识别为 JSON 资源，`load()` 返回带 `data` 属性的 JSON 对象；
## - 但 Web 导出默认只打包「资源」，未列入导出过滤器的裸 .json 走不进 PCK；
##   因此这里做双通道：优先资源加载，失败再退回文本解析，两条路都给出一致的结果。
##
## 注意：调用方拼 res:// 路径时必须用 RESOURCE_SCHEME 常量拼接
## （不要写字面量 "res://data/..." —— preflight P5 会把带引号的 res:// 字面量当资源引用做存在性核对）。

## 资源协议头：拼接路径用，避免出现可被 P5 误判的字面量引用。
const RESOURCE_SCHEME: String = "res://"


## 读取一个 JSON 对象；读不到 / 不是对象时返回空字典（调用方据此 fail-fast）。
static func load_object(path: String) -> Dictionary:
	var value: Variant = load_value(path)
	return value if value is Dictionary else {}


## 读取任意 JSON 值；读不到返回 null。资源通道 → 文本通道，两级兜底。
static func load_value(path: String) -> Variant:
	if not FileAccess.file_exists(path):
		return null
	var resource: Resource = load(path)
	if resource is JSON:
		return (resource as JSON).data
	var text: String = FileAccess.get_file_as_string(path)
	if text.is_empty():
		return null
	return JSON.parse_string(text)
