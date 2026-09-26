extends Node
## 数值配置单例（autoload，注册名 GameConfig）：玩法数值的唯一运行时来源。
##
## 规范要点：
## - 只放「配置 + 纯逻辑」，不放场景/节点引用（同 autoload/game_state.gd）；
## - 不声明 class_name：autoload 单例名与 class_name 同名会触发
##   preflight P4（hides an autoload singleton）；
## - 必须在 [autoload] 里注册在 GameState 之前：GameState 依赖本单例的数值。

## 配置文件路径：改这里的数值即可调游戏，无需改代码（需求验收标准 5）。
const CONFIG_PATH: String = "res://config/gameplay.cfg"

## 收集一颗星尘的得分（默认 +1）。
var score_per_crystal: int = 1
## 撞上一次陨石扣除的护盾（默认 -1）。
var damage_per_hit: int = 1
## 初始护盾点数（默认 3）。
var initial_shield: int = 3
## 受击后的无敌帧时长（秒）。
var invincibility_seconds: float = 0.8
## 场上星尘常驻数量。
var max_crystals: int = 6
## 场上陨石常驻数量。
var max_asteroids: int = 5
## 陨石漂移速度下限（像素/秒）。
var asteroid_speed_min: float = 40.0
## 陨石漂移速度上限（像素/秒）。
var asteroid_speed_max: float = 110.0
## 玩家飞船移速（像素/秒）。
var player_speed: float = 240.0
## 星尘被收集后补位延迟（秒）。
var respawn_delay_seconds: float = 1.5


func _ready() -> void:
	apply_config_file()


## 从 CONFIG_PATH 读入数值；缺文件/缺键时保留上方内置默认值，不视为致命错误。
func apply_config_file() -> void:
	var config := ConfigFile.new()
	if config.load(CONFIG_PATH) != OK:
		push_warning("GameConfig: 读不到 %s，使用内置默认数值" % CONFIG_PATH)
		return
	score_per_crystal = config.get_value("gameplay", "score_per_crystal", score_per_crystal)
	damage_per_hit = config.get_value("gameplay", "damage_per_hit", damage_per_hit)
	initial_shield = config.get_value("gameplay", "initial_shield", initial_shield)
	invincibility_seconds = config.get_value("gameplay", "invincibility_seconds", invincibility_seconds)
	max_crystals = config.get_value("gameplay", "max_crystals", max_crystals)
	max_asteroids = config.get_value("gameplay", "max_asteroids", max_asteroids)
	asteroid_speed_min = config.get_value("gameplay", "asteroid_speed_min", asteroid_speed_min)
	asteroid_speed_max = config.get_value("gameplay", "asteroid_speed_max", asteroid_speed_max)
	player_speed = config.get_value("gameplay", "player_speed", player_speed)
	respawn_delay_seconds = config.get_value("gameplay", "respawn_delay_seconds", respawn_delay_seconds)
