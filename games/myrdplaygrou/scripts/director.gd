class_name WaveDirector
extends Node
## 波次导演 + 阳光经济：出怪节奏（波内间隔出怪 → 波间休整 → 清场推进），
## 以及「时间产出」（阳光细流 + 天降阳光）——资源闭环的时间侧由这里驱动。

enum Phase { WAIT, SPAWNING, DRAIN }

## 开局到第一波的准备时间（给玩家布防窗口）。
const FIRST_WAVE_DELAY: float = 4.0
## 波间休整。
const WAVE_REST: float = 3.0

var field: Field
var _phase: Phase = Phase.WAIT
var _timer: float = FIRST_WAVE_DELAY
var _spawned_this_wave: int = 0
var _trickle_timer: float = 0.0
var _sky_timer: float = 0.0


## 开局（选关进入或重开）。
func begin_level() -> void:
	_phase = Phase.WAIT
	_timer = FIRST_WAVE_DELAY
	_spawned_this_wave = 0
	_trickle_timer = GameState.sun_trickle_interval
	_sky_timer = GameState.sky_sun_interval


func _physics_process(delta: float) -> void:
	if field == null or not GameState.running:
		return
	_tick_economy(delta)
	_tick_waves(delta)


## 时间产出：细流阳光（HUD 订阅 sun_changed 挂反馈）+ 定时天降阳光。
func _tick_economy(delta: float) -> void:
	_trickle_timer -= delta
	if _trickle_timer <= 0.0:
		_trickle_timer += GameState.sun_trickle_interval
		GameState.add_sun(int(GameState.sun_trickle_amount))
	_sky_timer -= delta
	if _sky_timer <= 0.0:
		_sky_timer += GameState.sky_sun_interval
		field.spawn_sun_token()


func _tick_waves(delta: float) -> void:
	match _phase:
		Phase.WAIT:
			_timer -= delta
			if _timer <= 0.0:
				_phase = Phase.SPAWNING
				_spawned_this_wave = 0
				_timer = 0.0
		Phase.SPAWNING:
			_timer -= delta
			if _timer <= 0.0 and _spawned_this_wave < GameState.zombies_per_wave():
				_spawned_this_wave += 1
				field.spawn_zombie(randi() % field.GRID_ROWS, Field.SPAWN_X)
				_timer = float(GameState.level().get("spawn_interval", 3.0))
			if _spawned_this_wave >= GameState.zombies_per_wave():
				_phase = Phase.DRAIN
		Phase.DRAIN:
			if field.zombie_count() == 0:
				GameState.complete_wave()
				if GameState.running:
					_phase = Phase.WAIT
					_timer = WAVE_REST
					_spawned_this_wave = 0
				# running=false = 最后一波守完，GameState 已广播 game_ended(true)


## 冒烟 / 调参钩子：跳到最后一波并把该波视作「已全部出场」——胜负判定路径不变
## （仍要清场才触发 complete_wave），只是省去逐波出怪的等待；
## tests/smoke.gd 用它在帧预算内验证「胜利可达」。
func debug_jump_to_final_wave() -> void:
	GameState.wave_index = GameState.wave_count() - 1
	_spawned_this_wave = GameState.zombies_per_wave()
	_phase = Phase.DRAIN
	GameState.wave_changed.emit(GameState.wave_index, GameState.wave_count())
