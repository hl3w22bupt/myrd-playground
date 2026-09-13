# 错误签名对照表（error-signatures）

> **全部签名为本机 Godot 4.3 实测采集**（构造破损工程 → 运行 `godot --headless` → 抄录真实输出），
> 不是凭记忆写的。修复循环（SKILL.md §6）按「签名 → 根因 → 修复动作」查表。
>
> 沉淀规则：遇到表里没有的签名，修复成功后按同格式追加；同类错误出现 ≥2 次，给 `preflight.py` 加对应检查。

日志颜色码（`\x1b[…m`）会干扰 grep，先清洗再匹配：

```bash
godot --headless --path <工程> tests/smoke.tscn 2>&1 | sed 's/\x1b\[[0-9;]*m//g'
```

---

## A. 解析期（Parse Error）—— 优先级最高，先修这类

### E-01 `Could not find type "X" in the current scope.`

```text
SCRIPT ERROR: Parse Error: Could not find type "Player" in the current scope.
          at: GDScript::reload (res://tests/smoke.gd:37)
ERROR: Failed to load script "res://tests/smoke.gd" with error "Parse error".
```

- **根因**：`class_name X` 尚未注册进全局类缓存 —— 几乎总是 **跳过了 `--import`**（`.godot/` 缓存不存在），
  或被引用的脚本本身有解析错误导致 `class_name` 没注册。
- **修复动作**：先 `godot --headless --path <工程> --import`；若仍报，去找 `class_name X` 所在脚本的解析错误
  （用 preflight P5/P9/P11 定位）。
- **关键**：报错位置（`smoke.gd:37`）**不是**根因文件，别改它。

### E-02 `Identifier "Y" not declared in the current scope.`（Y 是 autoload 单例名）

```text
SCRIPT ERROR: Parse Error: Identifier "GameState" not declared in the current scope.
ERROR: Failed to load script "res://scripts/main.gd" with error "Parse error".
```

- **根因**：`project.godot` 的 `[autoload]` 段没注册该单例（或注册的脚本路径不存在）。
- **修复动作**：`[autoload]` 里补 `GameState="*res://autoload/game_state.gd"`（`*` = 单例），再 `--import`。
- **关联检查**：preflight P4。

### E-03 `Cannot assign a value of type T2 to variable "x" with specified type T1.`

```text
SCRIPT ERROR: Parse Error: Cannot assign a value of type Vector2 to variable "direction" with specified type int.
SCRIPT ERROR: Parse Error: Value of type "float" cannot be assigned to a variable of type "Vector2".
SCRIPT ERROR: Parse Error: Invalid operands "int" and "Vector2" for "!=" operator.
SCRIPT ERROR: Compile Error:
```

- **根因**：显式类型标错（常见于 `var x: int = Input.get_vector(...)` 这类把 Vector2/float 标成标量）。
- **修复动作**：改成正确类型或改用 `:=` 推导（`var direction := Input.get_vector(...)`）；
  连带的 `Invalid operands` / `cannot be assigned` 是同一根因的连锁报错，修完第一行通常全部消失。

### E-04 `Failed to load script "res://….gd" with error "Parse error".`（连带黑屏）

- **根因**：该脚本（或它 `class_name` 依赖的脚本）解析失败。
- **修复动作**：先把 A 类全部清零再谈运行期问题；一个脚本报错会以 E-01 的形式蔓延到引用方。

---

## B. 资源与场景接线

### E-05 `[ext_resource] referenced non-existent resource`

```text
ERROR: Attempt to open script 'res://scripts/missing.gd' resulted in error 'File not found'.
ERROR: Failed loading resource: res://scripts/missing.gd. Make sure resources have been imported by opening the project in the editor at least once.
ERROR: res://scenes/main.tscn:7 - Parse Error: [ext_resource] referenced non-existent resource at: res://scripts/missing.gd
```

- **根因**：场景里挂的脚本/子场景路径不存在（改名、删除、复制工程后路径未更新）。
- **修复动作**：把 `path="..."` 改成真实存在的 `res://` 路径；新增节点后同步补 `ext_resource` 声明
  与 `load_steps`。
- **关联检查**：preflight P5 / P6（**运行前就能查出，别等运行**）。

### E-06 `The InputMap action "X" doesn't exist. Did you mean "ui_…"?`

```text
ERROR: The InputMap action "move_down" doesn't exist. Did you mean "ui_down"?
   at: action_get_deadzone (core/input/input_map.cpp:184)
```

- **根因**：代码里用了 `Input.get_vector("move_left", ...)` 之类的动作名，但 `project.godot [input]`
  没注册（或拼写不一致）。
- **修复动作**：在 `[input]` 注册动作并绑定按键；代码只引用动作名，禁止硬编码 keycode。
- **关联检查**：冒烟场景 `InputMap.has_action()` 断言会在运行期给出中文原因。

### E-07 冒烟断言失败：`信号 X 未到达订阅方` / `玩家 N 帧内位移 0.00px`

```text
# 模板版（templates/minimal-2d/tests/smoke.gd）
GODOT_SMOKE: FAIL 玩家 10 帧内位移 0.00px < 1.00px：InputMap 动作未生效或 _physics_process 未驱动 velocity
GODOT_SMOKE: FAIL 信号 Player.moved 未到达订阅方：连接断裂或从未 emit

# MVP 版（games/godot-coin-rush/tests/smoke.gd，带验收标准编号前缀）
GODOT_SMOKE: FAIL A3 移动：按住 move_right 30 帧位移 0.00px < 100.00px（InputMap 动作未生效或 _physics_process 未驱动 velocity）
GODOT_SMOKE: FAIL A3 移动：信号 Player.moved 未到达订阅方（连接断裂或从未 emit）
GODOT_SMOKE: FAIL A4 收集：金币未被销毁（Area2D body_entered 未触发，检查碰撞层/掩码）
GODOT_SMOKE: FAIL A5 胜利：分数 4 != WIN_SCORE 5（有金币没被收掉）
```

- **根因**（按顺序排查）：
  1. `connect()` 目标方法名拼错 / 方法被改名（preflight P12 查场景级与自连接）；
  2. 发布方从未 `emit`（条件分支根本没走到）；
  3. 订阅时机太晚（`_ready` 之后才连接，错过了早期 emit）。
- **修复动作**：先跑 preflight 看有没有 P8/P12；再确认 emit 与 connect 的先后；最后加一条
  `print` 验证 emit 路径确实执行。

### E-08（**隐蔽坑**）`Input.action_press()` 状态被清掉 → 移动断言假失败

- **现象**：冒烟里 `Input.action_press(&"move_right")` 之后又调用了 `Input.parse_input_event(...)`，
  下一帧 `Input.get_action_strength("move_right")` 变回 0，玩家不再移动。
- **根因**：headless 下 `parse_input_event()` 的缓冲冲刷会清掉 `action_press()` 设置的按下状态
  （本机 4.3 实测复现）。
- **修复动作**：两类注入**分帧做**——先按住方向键跑 N 帧测位移，再注入 `InputEventAction`
  测 `_unhandled_input`（模板 `tests/smoke.gd` 的两阶段状态机就是这么写的）。

---

## C. 运行方式（环境类）

### E-09 不加 `--quit-after` 且场景没退出 → 永久挂起

- **现象**：无头命令一直不返回，CI/门禁超时。
- **根因**：脚本解析失败时冒烟场景里的 `get_tree().quit()` 永远执行不到。
- **修复动作**：无头运行**必须带** `--quit-after N`（`smoke.sh` 默认 120 帧兜底）；
  冒烟场景自身也要在有限帧内主动 quit。

### E-10 冒烟打印了 `GODOT_SMOKE: PASS` 但退出码 ≠ 0

- **根因**：断言分支里 `get_tree().quit(1)` 与 PASS 分支共存 / 打印后没 quit。
- **修复动作**：以 `smoke.sh` 的判定为准（它断言「标记 + 退出码一致」）；冒烟场景改成
  `PASS → quit(0)`、`FAIL → quit(1)` 两条互斥路径。

### E-11 `godot-smoke: FAIL 找不到 Godot 可执行文件`（退出码 2）

- **根因**：环境没装 Godot 或 `GODOT_BIN` 没指对。
- **修复动作**：装环境（`brew install --cask godot`）或 `export GODOT_BIN=/path/to/Godot`；
  **这是环境问题，不要为了过门禁去改代码**。

## D. 逻辑与契约类（静态全绿、运行期才暴露）

### E-12 键位错绑：动作注册了、物理键绑错了 → 冒烟全绿但真机无响应

- **现象**：preflight 全 PASS、冒烟位移/重开断言全过，但真机按 WASD/空格没反应。
- **根因**：`InputMap.has_action()` 只证明**动作注册了**；冒烟的 `Input.action_press()` /
  `InputEventAction` 是**动作级注入**，绕过键码匹配。两层都拦不住 `move_right` 被误绑到 F。
- **修复动作**：冒烟场景加「键位契约」断言 —— 逐动作核对
  `InputMap.action_get_events(action)` 里的 `physical_keycode` 是否命中目标键表。
  两处现成实现（`KEY_CONTRACT` + 键位契约断言 + `_key_labels()`）：
  模板 `templates/minimal-2d/tests/smoke.gd`（`_check_key_bindings()`，移植新游戏时保留）、
  MVP `games/godot-coin-rush/tests/contracts/wiring_contract.gd`
  （`WiringContract.check_key_bindings()`，2026-09-04 T-8 起从 `tests/smoke.gd` 拆出；
  键表带 GOAL.md 验收编号语义）。
- **⚠️ 必须逐键核对（AND），不能「命中其一即过」（OR）**：文档键表写「D / →」
  就是承诺这两个键都该能用；若只判「绑了其中一个」，「D 被误改、只剩 →」这类
  **单键回归**照样冒烟全绿 —— 本机探针实测：`move_right` 把 `D(68)` 改成 `F(70)`、
  保留 `→(4194321)`，OR 判定放行、AND 判定拦下。键表若本意是「二选一」，
  就只写一个代表键，让契约与文档始终一一对应。

### E-13（**隐蔽坑**）隔空吃币：Area2D 重叠回调携带陈旧刚体变换

- **现象**：重开一局后 `score` 多了 1、金币少了 1（冒烟 A6 断言失败）；或玩家传送后
  与没碰到的金币发生了收集。
- **根因**：玩家被传送/重置后的一两帧内，`Area2D.body_entered` 仍会带着**上一帧的重叠状态**
  触发（本机 4.3 实测：玩家已回起点 2 帧，新金币仍收到接触回调）。
- **修复动作**：金币收到重叠回调后，用**当前坐标**复核真实圆心距（半径 + 对方半边 + 余量），
  超出即忽略；重开逻辑先把玩家送回起点、再重生金币。

### E-17（**隐蔽坑**）实例化静默减员：`instantiate()` 失败 `push_error + continue`，实体悄悄少几个

- **现象**：游戏能启动、能玩，但场上实体（金币/敌人/道具）比目标数少 —— 本局**永远达不到
  胜利条件**，玩家卡关且 UI 毫无提示；日志里只有一行容易被翻页淹没的 `ERROR:`。
- **根因**：资源路径被误改 / 根节点脚本被摘（`as 类名` 得 null）时，`instantiate()` 路径
  静默失败；`push_error` 只打 `ERROR:` 前缀，**不命中冒烟门禁的 `SCRIPT ERROR` 扫描**，
  也不影响退出码 —— 与 E-16 同族的「带病可跑」，且数量断言（`coins.size() == WIN_SCORE`）
  只在门禁层变红，运行期玩家不可见。
- **修复动作**：失败必须是「三通道」—— ①`push_error`（日志可查）②错误文案写进玩家可见的
  UI（sticky，不被后续 HUD 刷新冲掉）③headless 下 `get_tree().quit(1)`，让**进程退出码**
  成为不伪装的失败信号（通用模板用 `DisplayServer.get_name() == &"headless"` 判定，不影响真机游玩；
  若失败本局**必然不可玩**——如金币数少于 WIN_SCORE——也可无条件 quit(1)，真机继续运行没有玩家价值，
  coin-rush MVP 的 `_spawn_fatal()` 即此口径，并额外把「可收集数 < WIN_SCORE」也纳入同判）。
  判别力负例见 `scripts/gate-selftest.sh` D7（摘脚本绑定 → 必须进程退出码非零且根因可读）。

---

## E. 门禁自身（验证器缺陷 —— 门禁说谎比游戏挂了更危险）

### E-14 弱判定假通过：工程能启动但没有任何行为断言

- **现象**：一个「能启动、零报错、但玩家不能动也收不到币」的工程，门禁判 **PASS**。
- **根因**：退出码对这类静默逻辑 bug 恒为 0、日志零报错（见可行性验证报告 §3）；
  「退出码 0 且无脚本错误 = 通过」的弱判定必然放行。
- **修复动作**：`tests/smoke.tscn` 行为断言是唯一能拦它的层。`smoke.sh` 已改为
  **缺断言场景默认 FAIL** 并给修复指引；`GODOT_SMOKE_ALLOW_WEAK=1` 只是显式逃生门，**不得用于门禁**。

### E-15 preflight 对「编辑器保存过的场景」集体失效 / P8 从未生效

- **现象**：健康工程被 preflight 误报 P6「使用了未声明的 ExtResource」，或场景级
  `[connection]` 挂了却查不出来。
- **根因**（两类，均已修复并有回归用例 `scripts/preflight_selftest.py`）：
  1. 按**属性顺序**硬编码的正则（`type="…" path="…" id="…"`）——编辑器保存时会写入
     `uid="…"`、调整顺序，正则随即失配（漏报 + 误报）；现改为按 `key=value` 解析、键序无关。
  2. 场景级连接检查里，ext_resource 取到的是 `res://…` 形态、而脚本体按工程相对路径作键，
     两者永不相等 → P8 整段成了死代码。
- **修复动作**：改完 preflight 必须跑 `python3 scripts/preflight_selftest.py`（14 例），
  「该拦的拦下 + 不该拦的放行」两侧都要绿。

### E-16（**隐蔽坑**）带病的绿灯：冒烟断言全过，但日志每帧刷 SCRIPT ERROR

- **现象**：`tests/smoke.gd` 断言全过、退出码 0，日志里却每帧打印
  `SCRIPT ERROR: Invalid get index ...`（如 `_process` 里字典越界）。玩法表面正常，
  实则每帧都在抛错 —— 门禁曾直接放行。
- **根因**：运行期错误不影响断言变量，`smoke.sh` 早期只在「无标记」分支扫
  `SCRIPT ERROR`，PASS 分支不扫 → 每帧刷屏型缺陷必然漏网（实测：`_process` 每帧字典越界、
  玩法逻辑完好 → PASS 且退出码 0）。
- **修复动作**：`smoke.sh` PASS 分支同样扫 `SCRIPT ERROR|Parse Error` 并判 FAIL（现版本）；
  确属外部噪声才用 `GODOT_SMOKE_IGNORE_RUNTIME_ERRORS=1` 显式豁免（勿用于门禁）。
  修复代码时优先看 `_process` / `_physics_process` 里的索引与空引用。

---

## F. 修复循环的速度技巧

| 场景 | 做法 |
|---|---|
| 只想知道「能不能跑」 | `bash scripts/smoke.sh <工程>`（内部含导入 + 运行 + 断言，一条命令出结论） |
| 没装 Godot / 想秒级反馈 | `python3 scripts/preflight.py <工程>`（12 类静态检查，能拦下大部分黑屏） |
| 报错信息乱码/带颜色码 | 先 `sed 's/\x1b\[[0-9;]*m//g'` 清洗再 grep |
| 报错行不在根因文件 | 解析错误会蔓延（E-01/E-04）：先修 `class_name` / autoload 的根因文件 |
| 同一处反复修不好 | 连续 3 轮同类失败 → 换实现路径或拆小任务，不要原地试探（受 `maxLoops` 约束） |

---

## G. Godot 3 → 4 版本污染（模型最爱犯的「自信但跑不起来」）

> 模型语料被 Godot 3 代码浸透，会稳定输出「自信、合理、但 Godot 4 跑不起来」的代码。
> 下表是高频翻车点（对照官方迁移指南 *Upgrading from Godot 3 to Godot 4*）；
> 「P11」列打勾的已由 `preflight.py` P11 机判（2026-09 扩展后共 13 条模式），其余靠 review。

| Godot 3（模型爱写的） | Godot 4（真能跑的） | P11 |
|---|---|:--:|
| `onready var hp` | `@onready var hp` | ✅ |
| `export var speed` / `export(int) var speed` | `@export var speed: int` | ✅ |
| `yield(get_tree().create_timer(1), "timeout")` | `await get_tree().create_timer(1).timeout` | ✅ |
| `connect("pressed", self, "_on_x")` | `pressed.connect(_on_x)` | ✅ |
| `KinematicBody2D` / `KinematicBody` | `CharacterBody2D` / `CharacterBody3D` | ✅ |
| 裸 `Spatial` / 裸 `RigidBody`（无 2D/3D 后缀） | `Node3D` / `RigidBody3D` | ✅ |
| `move_and_slide(vel, Vector2.UP)` | `velocity = …` 后无参调用 `move_and_slide()` | ✅ |
| `load("res://x.tscn").instance()` | `.instantiate()` | ✅ |
| `PoolVector2Array` / `Pool*Array` | `PackedVector2Array` / `Packed*Array` | ✅ |
| `Tween` 节点 / `Tween.new()` / `interpolate_property()` | `create_tween()` + `tween_property()` | ✅ |

- **修复动作**：按表逐项替换后重跑 `preflight.py` + 冒烟；报错形态通常是
  E-01 `Could not find type "KinematicBody2D"`，别去改报错行，改类型名本身。
- **预防（比修复便宜得多）**：新工程必须从模板复制起步 —— 模板根目录的
  `templates/minimal-2d/CLAUDE.md` 已钉死「Godot 4.x / GDScript 2.0」并附上表，
  随工程复制带走、**不得删除**。项目级规则文件比在每轮提示里重复「请用 Godot 4」
  更能阻止模型退回 Godot 3。
- **P11 匹配口径**：只在剥掉 `#` 注释后的代码里匹配 —— 迁移对照表写在注释里不触发
  （写「不要用 KinematicBody2D」这类注释是合法的防退化手段）。
