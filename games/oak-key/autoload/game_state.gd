extends Node
## 自动加载单例（autoload）：跨场景共享的全局状态 + key 探测取证记录。
##
## 注册方式：project.godot 的 [autoload] 段写 `GameState="*res://autoload/game_state.gd"`。
## `*` 前缀 = 单例模式（全局唯一）；脚本必须 extends Node，否则无法挂到场景树根部。
##
## 规范（见技能包 SKILL.md「GDScript 规范」）：
## - autoload 只放「状态 + 纯逻辑」，不放场景/节点引用；
## - 跨场景通信一律走信号，禁止 autoload 反向持有场景节点；
## - 命名用 PascalCase 单例名，成员变量 snake_case。
##
## 取证探针职责（需求 id=cmupslvp7002gm9dh42h3maq5，不计入三样例）：
## - 每次 key 校验都产出可检索的取证标记：日志行 `OAK_KEY_PROBE oak_key_probe=valid|invalid ...`
##   + 存档字段（user://oak_key_probe.json 的 `oak_key_probe` 键）。

## 分数变化信号：场景层订阅它刷新 UI，而不是主动轮询。
signal score_changed(score: int)

## 拾取片段信号：count / required 用于 HUD 与冒烟断言「核心交互生效」。
signal fragment_collected(count: int, required: int)

## 探测完成信号：result 结构见 record_probe()，Main 场景订阅它渲染「有效 / 无效」反馈。
signal probe_finished(result: Dictionary)

## 有效 key 需要集齐的真实片段数（与 OakKeyValidator.VALID_CHUNKS 数量一致）。
const REQUIRED_FRAGMENTS: int = 3
## 取证存档落点（Web 导出沙箱内也可写）。
const FORENSIC_SAVE_PATH: String = "user://oak_key_probe.json"
## 取证日志前缀：冒烟/部署日志里 grep 这个词即可检索全部探测记录。
const FORENSIC_LOG_TAG: String = "OAK_KEY_PROBE"

var score: int = 0
## 本局已拾取的真实片段数。
var collected_fragments: int = 0
## 本局是否拾到伪造片段（拾到 = 组装出的 key 必然校验失败）。
var decoy_collected: bool = false
## 全部探测记录（跨局累计，供取证检索）。
var probe_history: Array[Dictionary] = []


func add_score(amount: int) -> void:
	score += amount
	score_changed.emit(score)


## 拾取一个片段。is_decoy = true 表示伪造片段（计入 decoy_collected，不计入有效片段数）。
func register_fragment(is_decoy: bool) -> void:
	if is_decoy:
		decoy_collected = true
	else:
		collected_fragments += 1
	fragment_collected.emit(collected_fragments, REQUIRED_FRAGMENTS)


## 记录一次 key 探测结果：写取证日志 + 取证存档，并向场景层广播。
## result 约定字段：valid(bool) / reason(String) / key(String) / fragments(int) / decoy(bool)。
func record_probe(result: Dictionary) -> void:
	var marker: String = "valid" if bool(result.get("valid", false)) else "invalid"
	var record: Dictionary = {
		"oak_key_probe": marker,
		"reason": String(result.get("reason", "")),
		"key": String(result.get("key", "")),
		"fragments": int(result.get("fragments", collected_fragments)),
		"decoy_collected": decoy_collected,
		"probe_count": probe_history.size() + 1,
	}
	probe_history.append(record)
	_write_forensic_record(record)
	probe_finished.emit(record)


## 取证落盘：日志一行 + JSON 存档一份。两者都失败也不抛错（取证失败不阻塞玩法）。
func _write_forensic_record(record: Dictionary) -> void:
	print("%s oak_key_probe=%s probe_count=%d fragments=%d/%d decoy=%s key=%s reason=%s" % [
		FORENSIC_LOG_TAG,
		String(record["oak_key_probe"]),
		int(record["probe_count"]),
		collected_fragments,
		REQUIRED_FRAGMENTS,
		"true" if decoy_collected else "false",
		String(record["key"]),
		String(record["reason"]),
	])
	var file: FileAccess = FileAccess.open(FORENSIC_SAVE_PATH, FileAccess.WRITE)
	if file == null:
		print("%s WARN 取证存档写入失败(%s)：%s" % [
			FORENSIC_LOG_TAG, FORENSIC_SAVE_PATH, error_string(FileAccess.get_open_error()),
		])
		return
	file.store_string(JSON.stringify(record, "  "))
	file.close()


## 重开一局：清空本局拾取状态（取证历史跨局保留，供审计）。
func reset_run() -> void:
	score = 0
	collected_fragments = 0
	decoy_collected = false
	score_changed.emit(score)
	fragment_collected.emit(collected_fragments, REQUIRED_FRAGMENTS)
