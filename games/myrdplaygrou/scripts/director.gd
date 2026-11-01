class_name WaveDirector
extends Node
## 波次导演：出怪节奏（波内按编制 + spawn_interval 逐个出怪 → 清场 → 波间休整 → 下一波），
## 以及天降阳光的定时投放（spec.economy.skyDrop：阳光只经三途径，细流产出废除）。
## 波次编制 = GameState.LEVELS[].waves[]（脚本化：每波若干 {kind, count} 组，顺序展开）。

enum Phase { WAIT, SPAWNING, DRAIN }

## 本波出怪开始（含首波与最后一波；波次来袭提示音 sfx-wave 挂这里，spec audio.sfxBindings）。
signal wave_started(wave: int)
## 等待态切换（true = 波间等待中，「下一波」按钮可见可点）。
signal waiting_changed(waiting: bool)

var field: Field
var _phase: Phase = Phase.WAIT
var _timer: float = 0.0
## 天降阳光计时。
var _sky_timer: float = 0.0
## 当前波剩余出怪队列（StringName 种类，顺序展开自波次编制）。
var _queue: Array[StringName] = []


## 开局（选关进入或重开）：首波前有准备窗口（spec difficulty.firstWaveDelaySec）。
func begin_level() -> void:
	_phase = Phase.WAIT
	_timer = float(GameState.level().get("first_wave_delay", 15.0))
	_sky_timer = GameState.sky_drop_interval
	_queue.clear()
	waiting_changed.emit(true)


## 当前是否处于「可提前召唤下一波」的等待态（HUD「下一波」按钮的可见条件）。
func can_skip_wait() -> bool:
	return _phase == Phase.WAIT


## 提前召唤下一波（spec input.next-wave，可选操作）：等待态立即转入出怪；返回是否生效。
func next_wave() -> bool:
	if not can_skip_wait() or not GameState.running:
		return false
	_timer = 0.0
	return true


func _physics_process(delta: float) -> void:
	if field == null or not GameState.running:
		return
	_tick_sky_drop(delta)
	_tick_waves(delta)


## 天降阳光（阳光三途径之一，须点按收集）。
func _tick_sky_drop(delta: float) -> void:
	_sky_timer -= delta
	if _sky_timer <= 0.0:
		_sky_timer += GameState.sky_drop_interval
		field.spawn_sun_token()


func _tick_waves(delta: float) -> void:
	match _phase:
		Phase.WAIT:
			_timer -= delta
			if _timer <= 0.0:
				_begin_spawning()
		Phase.SPAWNING:
			_timer -= delta
			if _timer <= 0.0 and not _queue.is_empty():
				field.spawn_zombie(randi() % field.GRID_ROWS, Field.SPAWN_X, _queue[0])
				_queue.remove_at(0)
				_timer = float(GameState.level().get("spawn_interval", 5.0))
			if _queue.is_empty():
				_phase = Phase.DRAIN
				waiting_changed.emit(false)
		Phase.DRAIN:
			if field.zombie_count() == 0:
				GameState.complete_wave()
				if GameState.running:
					_phase = Phase.WAIT
					_timer = float(GameState.level().get("wave_gap", 18.0))
					waiting_changed.emit(true)
				# running=false = 最后一波守完，GameState 已广播 game_ended(true)


## 展开当前波编制并转入出怪态。
func _begin_spawning() -> void:
	_queue.clear()
	var script: Dictionary = GameState.wave_script(GameState.wave_index)
	for group: Dictionary in script.get("groups", []):
		for i in int(group.get("count", 0)):
			_queue.append(group.get("kind", &"walker") as StringName)
	_phase = Phase.SPAWNING
	_timer = 0.0
	wave_started.emit(GameState.wave_index)


## 冒烟 / 调参钩子：跳到最后一波并把该波视作「已全部出场」——胜负判定路径不变
## （仍要清场才触发 complete_wave），只是省去逐波出怪的等待；
## tests/smoke.gd 用它在帧预算内验证「胜利可达」。
func debug_jump_to_final_wave() -> void:
	GameState.wave_index = GameState.wave_count() - 1
	_queue.clear()
	_phase = Phase.DRAIN
	waiting_changed.emit(false)
	GameState.wave_changed.emit(GameState.wave_index, GameState.wave_count())
