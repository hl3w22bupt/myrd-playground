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
const VIEWPORT_WIDTH: float = 640.0           # 与 project.godot 视口宽一致
const VIEWPORT_HEIGHT: float = 360.0          # 与 project.godot 视口高一致
const PLAYFIELD_MARGIN: float = 40.0          # 苹果/果篮左右留白（不贴边）
const BASKET_HALF_WIDTH: float = 30.0         # 果篮碰撞矩形半宽（= player.tscn RectangleShape2D size.x × 0.5）
const BASKET_HEIGHT: float = 26.0             # 果篮碰撞矩形高（= player.tscn RectangleShape2D size.y）
const APPLE_RADIUS: float = 13.0              # 苹果碰撞半径（= apple.tscn CircleShape2D.radius）
const CATCH_MARGIN: float = 20.0              # 苹果出生点向内收的接住余量（见 spawn_range 注释）
const BASKET_SPEED: float = 340.0             # 果篮水平速度（键盘/触屏摇杆）
const BASKET_Y: float = 320.0                 # 果篮固定高度
# 漏接线：苹果中心滚出视口底部，再让它整体（2 × 半径）离屏并留 10px 缓冲后才判漏接，
# 玩家能看到苹果落地离场，而不是半途凭空消失。推导：360 + 13 × 2 + 10 = 396。
const FLOOR_Y: float = VIEWPORT_HEIGHT + APPLE_RADIUS * 2.0 + 10.0
const APPLE_FALL_SPEED: float = 150.0         # 苹果初始下落速度
const APPLE_FALL_RAMP: float = 14.0           # 每得 1 分下落速度增量（难度曲线）
const APPLE_FALL_SPEED_MAX: float = 460.0     # 下落速度上限
# 隧穿安全上限：苹果每帧位移必须小于「碰撞重叠带的一半」，否则一步就能跨过果篮矩形
# 而不触发 body_entered（高速下漏接假阳性）。重叠带 = 苹果直径 + 果篮碰撞高
# = 13 × 2 + 26 = 52px，取一半 26px/帧，按物理固定 60Hz 折算 = 1560px/s。
# 调参红线：APPLE_FALL_SPEED_MAX 必须小于本值（tests/smoke.gd 有对应断言）。
const APPLE_FALL_SPEED_TUNNEL_SAFE: float = (APPLE_RADIUS * 2.0 + BASKET_HEIGHT) * 0.5 * 60.0
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


## 果篮中心可达范围（player.gd 边界钳制的唯一事实来源）：
## 左右各留 PLAYFIELD_MARGIN，再让出一个 BASKET_HALF_WIDTH —— 果篮边缘最多贴到留白线，
## 不会越过画面边缘；推导：40 + 30 = 70，640 - 40 - 30 = 570。
func basket_clamp_range() -> Vector2:
	return Vector2(PLAYFIELD_MARGIN + BASKET_HALF_WIDTH,
			VIEWPORT_WIDTH - PLAYFIELD_MARGIN - BASKET_HALF_WIDTH)


## 苹果横向出生范围：比果篮可达范围再向内收 CATCH_MARGIN。
## 不收这一段时，出生在 40 / 600 的苹果只能靠果篮边缘擦到（果篮中心极限在 70 / 570），
## 属于「零余量死角苹果」。收 CATCH_MARGIN 后出生点 [60, 580] 落在果篮正面覆盖区内，
## 每个苹果都留有 ≥ CATCH_MARGIN + APPLE_RADIUS = 33px 的接住余量。
func spawn_range() -> Vector2:
	return Vector2(PLAYFIELD_MARGIN + CATCH_MARGIN,
			VIEWPORT_WIDTH - PLAYFIELD_MARGIN - CATCH_MARGIN)


## 本局结算是否刷新了历史最高分（结算界面「新纪录」标记用）。
func is_new_record() -> bool:
	return state == State.GAME_OVER and score > 0 and best == score


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


## 从磁盘重新读最高分。冒烟测试用它模拟「页面刷新后重新加载」：
## Web 导出时 user:// 落在浏览器 IndexedDB，刷新后进程重建、内存里的 best 归零，
## 唯有这条重读路径能证明最高分真的持久化在了引擎外部。
func reload_best() -> void:
	best = _load_best()
	best_changed.emit(best)
