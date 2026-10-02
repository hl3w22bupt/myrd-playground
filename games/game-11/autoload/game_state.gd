extends Node
## 自动加载单例（autoload）：接苹果（game-11）的全局状态与玩法参数。
##
## 注册方式：project.godot 的 [autoload] 段写 `GameState="*res://autoload/game_state.gd"`。
## 规范（见技能包 SKILL.md「GDScript 规范」）：
## - autoload 只放「状态 + 纯逻辑」，不放场景/节点引用；
## - 跨场景通信一律走信号，禁止 autoload 反向持有场景节点；
## - 玩法数值集中在下方调参区，后续调优只改这一处（对应需求第 7 条）。

## ── 对外信号（场景层订阅刷新 UI，而不是主动轮询）──
signal state_changed(state: State)
signal score_changed(score: int)
signal lives_changed(lives: int)
signal best_changed(best: int)
signal game_over(score: int, best: int)

## 游戏阶段：开局入口（MENU）→ 游玩（PLAYING）→ 生命耗尽结算（GAME_OVER）。
enum State { MENU, PLAYING, GAME_OVER }

## ── 调参区（集中配置，便于后续调优；单位：像素 / 秒 / 个）──
const PLAYFIELD_WIDTH: float = 640.0          # 与 project.godot 视口宽一致
const PLAYFIELD_MARGIN: float = 40.0          # 苹果/果篮左右留白（不贴边）
const BASKET_SPEED: float = 340.0             # 果篮水平速度（键盘/触屏摇杆）
const BASKET_Y: float = 320.0                 # 果篮固定高度
const FLOOR_Y: float = 396.0                  # 苹果越过即漏接（视口高 360 + 苹果半径余量）
const APPLE_FALL_SPEED: float = 150.0         # 苹果初始下落速度
const APPLE_FALL_RAMP: float = 14.0           # 每得 1 分下落速度增量（难度曲线）
const APPLE_FALL_SPEED_MAX: float = 460.0     # 下落速度上限
const SPAWN_INTERVAL: float = 1.10            # 初始生成间隔（秒）
const SPAWN_RAMP: float = 0.045               # 每得 1 分生成间隔缩短量（秒）
const SPAWN_INTERVAL_MIN: float = 0.35        # 生成间隔下限（秒）
const START_LIVES: int = 3                    # 初始生命
const SCORE_PER_APPLE: int = 1                # 每接住 1 个苹果得分

## 最高分持久化文件：Web 导出时 user:// 落在浏览器 IndexedDB（引擎内置 JS 文件系统），
## 页面刷新后仍在 —— 与原生平台的普通文件等价，单实现覆盖两端（见 SKILL.md Web 导出要点）。
const SAVE_PATH := "user://game_11_highscore.txt"

var state: State = State.MENU
var score: int = 0
var lives: int = START_LIVES
var best: int = 0


func _ready() -> void:
	best = _load_best()


## ── 一局的生命周期 ──
func start_game() -> void:
	score = 0
	lives = START_LIVES
	_set_state(State.PLAYING)
	score_changed.emit(score)
	lives_changed.emit(lives)


func restart_game() -> void:
	# 重开 = 清零本局、保留历史最高分，回到 PLAYING。
	start_game()


func catch_apple() -> void:
	if state != State.PLAYING:
		return
	score += SCORE_PER_APPLE
	if score > best:
		best = score
		best_changed.emit(best)
		_save_best()
	score_changed.emit(score)


func miss_apple() -> void:
	if state != State.PLAYING:
		return
	lives -= 1
	lives_changed.emit(lives)
	if lives <= 0:
		lives = 0
		_set_state(State.GAME_OVER)
		game_over.emit(score, best)


## 难度曲线：随得分提高下落速度（需求第 4 条，可观测递增）。
func apple_fall_speed() -> float:
	return minf(APPLE_FALL_SPEED + APPLE_FALL_RAMP * float(score), APPLE_FALL_SPEED_MAX)


## 难度曲线：随得分缩短生成间隔（需求第 4 条）。
func spawn_interval() -> float:
	return maxf(SPAWN_INTERVAL - SPAWN_RAMP * float(score), SPAWN_INTERVAL_MIN)


## 苹果横向出生范围（留边，避免贴边出生接不到）。
func spawn_range() -> Vector2:
	return Vector2(PLAYFIELD_MARGIN, PLAYFIELD_WIDTH - PLAYFIELD_MARGIN)


func _set_state(new_state: State) -> void:
	if state == new_state:
		return
	state = new_state
	state_changed.emit(state)


## ── 最高分持久化 ──
func _load_best() -> int:
	if not FileAccess.file_exists(SAVE_PATH):
		return 0
	var file := FileAccess.open(SAVE_PATH, FileAccess.READ)
	if file == null:
		return 0
	var value := file.get_line().to_int()
	file.close()
	return maxi(value, 0)


func _save_best() -> void:
	var file := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if file == null:
		push_warning("最高分写入失败：%s（%s）" % [SAVE_PATH, error_string(FileAccess.get_open_error())])
		return
	file.store_line(str(best))
	file.close()
