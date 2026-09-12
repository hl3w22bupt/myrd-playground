# 前置一致性检查清单（preflight checklist）

> 对应 `scripts/preflight.py`（13 类，全部机判）+ 三项只能人工核对的内容。
> 原则（OpenGame M4 / Proactive Check）：**能在运行前拦下的，绝不留到运行后**；
> 反过来，只有运行期才能证实的（输入真的生效、信号真的送达），交给无头冒烟门禁。

## 1. 机器检查（`python3 scripts/preflight.py <工程目录>`）

| 编号 | 检查内容 | 不通过的典型后果 |
|---|---|---|
| P1 | `project.godot` 存在 | 根本不是 Godot 工程 |
| P2 | `run/main_scene` 已设置且场景存在 | 无头运行没有入口 → 黑屏 |
| P3 | `config/icon` 资源存在 | 启动告警/资源缺失 |
| P4 | 每个 autoload 的脚本存在；单例名不与 `class_name` 冲突 | `Identifier "X" not declared` / `hides an autoload singleton` |
| P5 | 所有 `.tscn/.gd/.tres` 里引用的 `res://` 路径真实存在 | `referenced non-existent resource` |
| P6 | `.tscn` 的 `ext_resource` 声明与 `ExtResource("id")` 引用一一对应 | 场景解析失败、脚本没挂上 |
| P7 | `.tscn` 节点 `parent` 路径能在场景树里解析 | 接线断裂、节点挂错层级 |
| P8 | `.tscn [connection]` 的 `from/to/method` 存在（方法在目标脚本里；`to="."` 根节点、实例化子场景根脚本都查） | 信号连接静默失效 |
| P9 | `class_name` 全工程唯一 | 类型解析失败（连带 `Could not find type`） |
| P10 | `uid://` 引用在工程内有声明 | 资源加载失败（uid 与路径混用是常见根因） |
| P11 | 无 Godot 3 残留语法（`onready var` / `export(...)` / `yield()` / 旧式 `connect("sig", …)`） | 解析错误 |
| P12 | `.gd` 里 `connect(方法名)` 的目标方法在同文件中存在（`queue_free`/`hide` 等内建 callable 豁免） | 信号连接静默失效（实测盲区：场景级能查、代码级只有运行期才暴露） |
| P13 | 工程含会渲染的中文文案（`.gd` 剥注释后 / `.tscn` / `.tres`）时，`[gui] theme/custom_font` 已设置且字体文件存在 | Web 导出沙箱拿不到系统字体，中文全部渲染成缺字方块（上线后用户看到乱码） |

**退出码**：`0` 通过；`1` 有不一致（逐条打印 `PREFLIGHT: FAIL [Pn] …`）；`2` 不是 Godot 工程。

> 改完 `preflight.py` 必须跑 `python3 scripts/preflight_selftest.py`：19 个合成工程用例，
> 同时断言「该拦的拦下」与「不该拦的不误报」。审查实测发现过两类验证器自身缺陷——
> 按属性顺序硬编码的正则在「编辑器保存过一次」后集体失效、场景级连接检查因路径形态
> 不一致整段死代码 —— 都是被这类用例按住的（见 `error-signatures.md` E-15）。

**用法要求**：写完代码先跑这个，再跑冒烟；两条都过才算「能跑」。

## 2. 人工核对（机器判不了，但要逐条回答）

1. **玩法闭环**：从「游戏启动」到「达成一个目标」的每一步，都能在代码里指出来——
   谁接收输入、谁改状态、谁 `emit`、谁订阅、谁渲染。指不出来的一环就是要补的一环。
2. **键位 ↔ 动作 ↔ 行为**：目标描述里的每个按键，都能对应到 `[input]` 里的一个动作，
   以及一个被 `_physics_process` / `_unhandled_input` 消费的行为。
3. **验收标准可无头判定**：每条验收标准都能翻译成冒烟场景里的一条断言
   （状态断言 / 位移断言 / 文本断言 / 退出码）。翻译不出来就改写，别留着。

## 3. 编码前置五问（动手前先答）

- 新节点挂在哪个场景、哪个父节点下？
- 挂哪个脚本？脚本与场景是否同名成对？
- 它发出什么信号、订阅谁的信号？订阅方在哪个场景、何时连接？
- 用到的资源 `res://` 路径是否已存在？
- 是否需要新的 InputMap 动作？键位是否已在目标描述里明确？

五个问题答不全 → 先补设计，再写代码。

## 4. 与冒烟门禁的分工

| 只能静态查（preflight） | 只能运行期查（smoke） |
|---|---|
| 路径悬空、声明缺失、uid 无声明 | 输入注入后对象真的移动了 |
| 场景树 parent 路径可解析 | 信号真的到达订阅方（emit 数量 > 0） |
| `class_name` 唯一、autoload 注册 | 物理步进不报错、无每帧刷屏的 SCRIPT ERROR |
| 方法名拼写（连接目标） | 退出码 0 + `GODOT_SMOKE: PASS` 标记齐全 |

> 「无每帧刷屏的 SCRIPT ERROR」由 `smoke.sh` 的 **PASS 分支**兜底（E-16）：断言全过也不放行
> 带病日志，扫 `SCRIPT ERROR|Parse Error` 判 FAIL；豁免用 `GODOT_SMOKE_IGNORE_RUNTIME_ERRORS=1`
> （勿用于门禁）。早期版本只扫「无标记」分支，实测 `_process` 每帧字典越界的工程被判 PASS。

> 实测案例：把 `main.gd` 的 `func _on_player_moved(` 改名后，P8（场景级连接）不报、
> 但 P12（代码级 connect）能报；若两处都查不到，运行期冒烟会以
> `GODOT_SMOKE: FAIL 信号 … 未到达订阅方` 收口。**三层互补，缺一层就有漏网。**
