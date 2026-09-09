---
name: godot-game-dev
description: "Godot 4 自主游戏开发技能包：脚手架（Godot 最小可运行模板工程）、GDScript/场景规范、无头验证协议（godot --headless 冒烟门禁）、前置一致性检查清单与「运行失败 → 定位 → 修复 → 重跑」迭代修复循环。当任务是开发、修复或验证 Godot 游戏工程时使用。"
---

# Godot 游戏开发技能包（godot-game-dev）

> 目标：让 agent 独立产出一个 **能跑** 的 Godot 游戏，而不是「看起来像游戏的代码」。
> 通用 agent 写游戏的三大死法——跨文件不一致、场景接线断裂、逻辑不闭环（黑屏）——全部靠
> **模板起步 + 静态前置检查 + 无头冒烟门禁 + 错误签名修复循环** 这条流水线拦住。

---

## 0. 何时用本技能 / 资产清单

**触发**：任务是创建 Godot 工程、实现玩法、修游戏 bug、或「让游戏能跑起来」。

**本技能目录**（注入到 `.myrd-platform/.claude/skills/godot-game-dev/`，或仓库内 `std-skills/godot-game-dev/`）：

| 资产 | 用途 |
|---|---|
| `templates/minimal-2d/` | Godot 4 最小可运行工程骨架（主场景/自动加载/信号/输入映射/最小资源/冒烟场景/中文字体） |
| `templates/minimal-2d/CLAUDE.md` | 随工程复制走的规则文件：钉死 Godot 4.x / GDScript 2.0 + 版本污染对照表 + 场景/脚本分工边界（防 Godot 3 退化比每轮提示重申更有效的手段，**不得删除**） |
| `scripts/preflight.py` | 13 类前置一致性静态检查，无需 Godot 即可机判 |
| `scripts/preflight_selftest.py` | preflight 自身的回归用例（19 例）：门禁自己的门禁，改完检查器必跑 |
| `scripts/smoke.sh` | 无头冒烟门禁：`godot --headless` + 退出码/日志双断言 |
| `scripts/resolve-godot.sh` | Godot 可执行文件解析的唯一实现（GODOT_BIN > PATH > 常见安装位置），routine 与 verify.sh 共用 |
| `references/preflight-checklist.md` | 前置一致性检查清单（含人工核对项） |
| `references/error-signatures.md` | 错误签名 → 根因 → 修复动作 对照表（**全部实测采集**） |
| `references/godot-smoke-routine.md` | `.myrd/routines.yaml` 的 `godot-smoke` 门禁 routine 片段 |

---

## 1. 脚手架：从模板起步，不要从零写

**规则：任何 Godot 工程都必须从 `templates/minimal-2d/` 复制起步。** 模板里每一条接线
（主场景、autoload、InputMap、信号连接、冒烟场景）都是经过 `godot --headless` 实测通过的，
从零手写几乎必然漏掉其中一条。

### 1.1 三步起步

```bash
# ① 复制模板（去掉模板的导入缓存；.godot/ 由本机 Godot 重新生成）
cp -R <技能目录>/templates/minimal-2d/ <目标工程目录>/
rm -rf <目标工程目录>/.godot

# ② 改工程名
#    <目标工程目录>/project.godot → config/name="你的游戏名"

# ③ 静态检查 + 无头冒烟（两条都必须过，顺序固定）
python3 <技能目录>/scripts/preflight.py <目标工程目录>
GODOT_BIN=<godot可执行文件> bash <技能目录>/scripts/smoke.sh <目标工程目录>
```

### 1.2 模板自带的五类接线（改动时不得破坏）

| 接线 | 位置 | 作用 |
|---|---|---|
| 主场景入口 | `project.godot` → `run/main_scene="res://scenes/main.tscn"` | 无头运行的入口；缺失 = 黑屏 |
| 自动加载单例 | `project.godot` → `[autoload]` `GameState="*res://autoload/game_state.gd"` | 跨场景状态；`*` 前缀 = 单例 |
| 输入映射 | `project.godot` → `[input]` `move_left/right/up/down`、`confirm` | 键位集中声明，代码只引用动作名 |
| 信号连接 | `scripts/main.gd` `_ready()` 里 `player.moved.connect(...)` | 发布方只 emit，订阅方集中连接 |
| 冒烟场景 | `tests/smoke.tscn` + `tests/smoke.gd` | 无头自检：实例化主场景 → 模拟按键 → 断言信号与位移 |

模板场景树（`main.tscn`）：

```
Main (Node2D, scripts/main.gd)
├── Player (player.tscn 实例, scripts/player.gd, class_name Player)
│   ├── Body (Polygon2D)
│   └── CollisionShape2D
└── UI (CanvasLayer)
    └── HudLabel (Label, unique_name_in_owner=true → 代码里用 %HudLabel)
```

### 1.3 找不到 Godot 可执行文件时

```bash
# macOS（cask 安装的编辑器 App 自带 CLI）
GODOT_BIN=/Applications/Godot.app/Contents/MacOS/Godot
# 或显式下载 headless 可执行文件后：
export GODOT_BIN=/path/to/Godot
```

`smoke.sh` 找不到 Godot 时以退出码 2 + 明确提示失败，此时**先装环境，不要改代码**。

---

## 1A. 策划案读取协议（spec 是单一事实源，动工前必读）

> 结构化策划案（GameDesignSpec：meta/world/entities/levels/numeric/acceptance 六段）是玩法、
> 关卡、数值、验收的唯一事实来源。**实现与 spec 冲突 = 缺陷** —— 先对齐再写代码，不许静默偏离。

1. **动工前先读当前 approved 版**：`GET /api/v1/game-design-specs/approved?goalId=<goal>`，
   或工程内导出件 `.myrd/spec/design-spec.json`。没有 approved 版 → 先走策划案流程（撰写 → 拍板），
   不要凭空发挥设计。
2. **落点与命名跟 spec 走**：`entities[].script/scene`、`levels[].scene`、`acceptance[].check`
   声明的相对路径必须真实建出；实体/关卡/元素 id 用 spec 里的编号（`l1/e3` 这类），不要私改 ——
   契约测试（`node scripts/contract-check.mjs`，routine id `game-contract`）会逐个断言。
3. **数值只认 `spec.numeric`**：速度/血量/得分等调参字段集中在 `autoload/game_state.gd`（或同级）
   并与 spec.numeric 键名对应；改数值 = 改 spec（修订产生新版本）→ 同步代码，禁止两头各改各的。
4. **修改产生新版本**：改策划案走 `POST /api/v1/game-design-specs/:id/revisions`（version+1，
   旧版自动 superseded），带 `sourceTrajectoryId` 溯源；拍板用 `POST /:id/approve`。
5. 目标卡片上策划案以 `design_spec` 产物条目呈现，点开可预览六段内容与版本。

---

## 2. GDScript 规范

1. **静态类型**：所有函数签名、成员变量、信号参数都写类型。`var direction := Input.get_vector(...)`
   用 `:=` 让编译器推导；禁止 `var x`（无类型）。
2. **命名**：文件名 = 类职责（`player.gd` ↔ `class_name Player`）；`class_name` 全工程唯一
   （preflight P9 会查）；autoload 单例用 PascalCase；信号用过去式/名词短语
   （`moved`、`score_changed`）；回调 `_on_<发布者>_<信号>`。
3. **输入只走 InputMap 动作名**：**游戏逻辑代码**里出现 `KEY_W` / `physical_keycode` 即违规，
   键位一律进 `project.godot [input]`，代码里只写 `Input.get_vector("move_left", ...)`。
   豁免：`tests/smoke.gd`（或其 `tests/contracts/` 键位契约家族）的键位契约断言层
   （`KEY_CONTRACT` + `_check_key_bindings`）必须用
   `physical_keycode` 反查键表（error-signatures E-12 的修复动作本身），属合法例外。
   ⚠️ 此禁令目前**没有机判**（preflight P11 只查 Godot 3 语法），别以为门禁会拦 —— 靠 review。
4. **信号方向单向**：游戏对象（Player/敌人）只 `emit`，不持有 UI 节点；UI 场景在 `_ready()`
   里订阅。autoload 只放状态与纯逻辑，禁止反向持有场景节点。
5. **节点引用**：`@onready var player: Player = $Player` + 类型标注；跨层级用 `%唯一名`
   （节点需 `unique_name_in_owner = true`），禁止长路径字符串 `"UI/HudLabel"`。
6. **常量提常量**：魔数一律 `const SPEED: float = 220.0`；数值调参集中在一处。
7. **禁止 Godot 3 残留语法/类型名**：模型语料被 Godot 3 代码浸透，会稳定输出「自信、合理、
   但 Godot 4 跑不起来」的代码 —— 除语法外，**类型名与旧 API 签名同样会翻车**
   （`KinematicBody2D`、裸 `Spatial`/`RigidBody`、`Pool*Array`、带参 `move_and_slide`、
   `.instance()`、`Tween.new()`/`interpolate_property()`）。13 条高频对照见
   `references/error-signatures.md` §G，preflight P11 全部机判（在剥掉 `#` 注释后的
   代码里匹配，迁移对照写进注释不触发）。预防：模板根目录 `CLAUDE.md` 已钉死版本与
   对照表，随工程复制带走、不得删除。
8. **异步用 `await`**：`await get_tree().create_timer(1.0).timeout`；`await` 只能在协程里用。

---

## 3. 场景与工程组织规范

```
<工程>/
├── project.godot          # 入口/单例/输入映射（改动后必跑 preflight）
├── autoload/              # 自动加载单例（extends Node，无 class_name）
├── scenes/                # .tscn，一场景一职责；实例化用 ext_resource
├── scripts/               # .gd，与场景同名成对（main.tscn ↔ main.gd）
├── assets/                # 美术/音频资源
└── tests/smoke.tscn|gd    # 无头冒烟场景（必须保留）
```

- **场景接线四件事必须闭环**：`ext_resource` 声明 → 节点 `script = ExtResource("id")` →
  节点 `parent` 路径 → `[connection]` 的 `from/to/method`。断任何一环 = 黑屏
  （preflight P6/P7/P8 逐项机判）。
- **`res://` 引用零悬空**：任何 `res://` 路径（场景、脚本、贴图、`load()/preload()`）都必须真实存在
  （P5）；引用 `uid://` 的场景必须能在工程内找到该 uid 的声明（P10），**新写代码统一用 `res://` 路径**。
- **`.godot/` 不进版本库；`*.import` 必须提交**：`.godot/` 是本机导入缓存（`--import` 可再生，
  加入 `.gitignore`）；而 `*.import` 记录资源的 `uid` 声明 —— 它是 preflight P10 的声明源，
  且提交后全新 clone 才不会发生 uid 重排导致 diff 噪声（模板与本仓两个 `icon.svg.import` 都已入库）。
- **场景树与脚本的分工要拉开**：脚本（.gd）是纯文本、可静态检查、可无头验证，agent 生成
  没问题；`.tscn` 里全是 `[ext_resource]` id 与 `uid://` 引用，凭空生成错了会**静默损坏**
  （没有解析错误、运行期才黑屏）。所以：**新建场景一律从现有场景/模板场景复制后改，
  禁止凭空整段生成 `.tscn`**；结构大改拆成小步，每步跑 preflight（P5/P6/P7/P8/P10 逐环机判）。
- **改动 `.tscn` 时手写要克制**：只改必要的属性块；`load_steps` 要与资源数一致，否则解析告警。
- **UI 文案含中文 ⇒ 必须保留全局中文字体**：模板自带 `assets/fonts/NotoSansSC-Regular.otf`
  （子集化 Noto Sans CJK SC，GB2312 全集 + ASCII + 常用符号，OFL 许可），并已在 `project.godot`
  设 `[gui] theme/custom_font`。**删除或绕过它之前先想清楚**：Web 导出跑在浏览器沙箱里
  拿不到任何系统字体，引擎内置默认字体只含拉丁字形 —— 没有这份字体，场景文本、
  `draw_string`、对话框里的中文全部渲染成缺字方块（TextServer 画「字符 hex 码方块」占位，
  上线后用户看到的就是乱码）。新增第三方字体同样要内嵌进工程，禁止依赖 `SystemFont`。
  （preflight P13 机判：有中文文案但没字体/字体文件缺失 → FAIL）

---

## 4. 无头验证协议（游戏能不能跑，机器说了算）

### 4.1 三条命令（顺序固定）

```bash
# ① 静态前置检查（不需要 Godot，秒级）——先拦「必然黑屏」的问题
python3 scripts/preflight.py <工程目录>

# ② 资源导入（首次/资源变更后必须；跳过会让 class_name 解析失败，见 error-signatures E-01）
godot --headless --path <工程目录> --import

# ③ 无头冒烟（退出码 + 日志双断言）
godot --headless --path <工程目录> --quit-after 120 tests/smoke.tscn
#   或直接用封装好的门禁（含 ①提示、②导入、③运行、断言、日志摘录）：
GODOT_BIN=<godot> bash scripts/smoke.sh <工程目录>
```

**退出码语义**：`0` 通过；`1` 冒烟失败（要修）；`2` 环境不可用（先装 Godot，不要改代码）。

### 4.2 判定协议（冒烟场景必须遵守）

- 通过：`print("GODOT_SMOKE: PASS ...")` 且进程 `get_tree().quit(0)`；
- 失败：`printerr("GODOT_SMOKE: FAIL <原因>")`（每条一行）且 `get_tree().quit(1)`；
- `smoke.sh` 断言两者：**日志标记 + 退出码必须一致**（只 PASS 不退出 0 也算失败）；
- `smoke.sh` 在 PASS 分支**同样扫日志**：`SCRIPT ERROR` / `Parse Error` 判 FAIL（E-16）——
  每帧刷屏型运行期错误不影响断言结果，却是真实缺陷；豁免用
  `GODOT_SMOKE_IGNORE_RUNTIME_ERRORS=1`（勿用于门禁）；
- 无标记默认 FAIL，两种原因分开诊断：没有 `tests/smoke.tscn`（弱判定需
  `GODOT_SMOKE_ALLOW_WEAK=1` 显式开启）vs 场景存在但帧预算内没跑完
  （提示 `Engine.max_fps = 60` 或加大 `GODOT_SMOKE_FRAMES`）。

### 4.3 冒烟场景必须断言什么（不要只 print 一句话）

模板 `tests/smoke.gd` 的五项断言是最低标准，移植到新游戏时逐项保留：

1. 主场景可实例化（场景接线没断）；
2. autoload 已注册且带约定信号；
3. InputMap 动作已注册、**物理键绑定正确（键位契约 `_check_key_bindings`，
   逐键核对 AND 语义，见下）**，且**注入输入后对象真的动了**（物理 + 脚本生效）；
4. 信号真的到达订阅方（`moved` / `score_changed` 被收到）；
5. 每项失败给出可读原因（对应 error-signatures 的修复动作）。

模拟按键的正确姿势（headless 下实测有效）：

```gdscript
Input.action_press(&"move_right")            # 改变动作强度 → Input.get_vector / _physics_process 生效
var ev := InputEventAction.new()             # 注入真实事件 → _unhandled_input 生效
ev.action = &"confirm"
ev.pressed = true
Input.parse_input_event(ev)
```

> ⚠️ 键位契约必须**逐键核对（AND）**，不能「命中键表中任意一个就算过（OR）」。
> 文档键表写「D / →」即承诺两个键都可用；OR 判定拦不住「D 被误改、只剩 →」的单键回归
> （探针实测漏拦，见 error-signatures E-12）。若键表本意是「二选一」，只写一个代表键。

> ⚠️ 实测坑（E-08）：`Input.parse_input_event()` 的缓冲冲刷会清掉 `Input.action_press()`
> 的按下状态。**两者必须分帧做**（模板用两阶段状态机：先移动 10 帧，再注入 confirm）。

### 4.4 与平台门禁打通

`.myrd/routines.yaml` 里加一条 `godot-smoke` routine（现成片段见
`references/godot-smoke-routine.md`），作为目标 DAG 的 gate：`reject` 打回修复循环，
`maxLoops` 即修复预算上限。

---

## 5. 前置一致性检查清单（写完就查，别等运行）

**先跑 `python3 scripts/preflight.py <工程目录>`**（13 类，逐条机判；语义见脚本 docstring）。
机器查不了的三项，人工核对：

| 项 | 怎么核对 |
|---|---|
| 玩法闭环 | 从「游戏启动」到「达成一个目标」的每一步，都能在代码里指出来（谁 emit、谁订阅、谁改状态） |
| 键位 ↔ 动作 ↔ 行为 | 目标描述里的每个按键，都能对应到 `[input]` 的一个动作和一个行为函数 |
| 验收标准可无头判定 | 每条验收标准都能翻译成冒烟场景里的一条断言；翻译不出来的要改写成能判定的 |

**编码前置检查（写之前问自己）**：新节点挂到哪个场景？挂哪个脚本？信号谁发谁收？
资源路径是否存在？是否需要新 InputMap 动作？——五个问题答不全，先别写。

---

## 6. 迭代修复循环（Reactive + Proactive）

```
        ┌────────────────────────────────────────────┐
        │  preflight（静态，秒级）──不过→ 按 P 编号修   │
        ▼                                            │
  写/改代码 ──► smoke（无头冒烟）──PASS──► 交付（[CHECKPOINT]+[PR]）
        ▲                │
        │             FAIL
        │                ▼
        │     对照 error-signatures.md 定位签名
        │                ▼
        └────── 修复（最小改动，一次只修一类）◄── 超过 maxLoops 仍不过 → 升级人工
```

**执行纪律**：

1. **一次只修一类错**：先修解析错误（Parse Error），再修运行期 SCRIPT ERROR，最后修断言失败。
   解析错误会让后续所有报错失真（一个脚本报错会以 `Could not find type "X"` 的形式
   蔓延到引用它的其它脚本——先修根因文件，别盯着报错行改）。
2. **每修一轮必须重跑 preflight + smoke**，不许凭感觉认为修好了。
3. **循环预算**：受目标/工作流的 `maxLoops` 约束；连续 3 轮同类失败 → 停下来换思路
   （换实现路径 / 拆小任务），不要在同一处反复试探。
4. **把新错误沉淀进对照表**：遇到 `error-signatures.md` 没有的签名，修复成功后按
   `签名 → 根因 → 修复动作` 三段追加进去（OpenGame Generalizer 思路：重复错误升级为自动校验规则；
   若同一类错误出现 ≥2 次，同时考虑给 `preflight.py` 加一条对应检查）。

---

## 7. 目标描述模板与验收标准

### 7.0 接目标先判品类可行性：规则 vs 手感

AI 能造出机器，但调不出手感 —— 而在游戏里，调校本身就是产品。一个 2D 平台跳跃游戏
大约是 200 行移动代码加上数月调常量（土狼时间、跳跃缓冲、空中控制、相机前瞻、命中顿帧）：
这些既无法用提示词表达，也无法用测试验证，唯一判据是**一个人真的玩了一遍**。
所以接到目标先估算「规则占多少、手感占多少」，它直接决定验收标准怎么写、哪些必须留人工：

| 品类 | AI 杠杆 | 验收出口 |
|---|---|---|
| 回合制 / Roguelike / 卡牌 / 解谜 / 放置 | 高 | 规则确定，逐条翻译成冒烟断言（无头全判） |
| 模拟经营 / 系统类 | 高 | 产品就是规则集，平衡是数据（进 `spec.numeric`），无头可判 |
| 叙事 / 视觉小说 | 参半 | 分支逻辑/工具链无头可判；文案质量留人工评审 |
| 2D 平台跳跃 / 动作 | 中低 | 位移/碰撞/通关条件无头可判；**移动手感必须人工试玩** |
| 联机多人 | 中低 | 确定性/预测回滚难测，协议层用契约断言兜一部分 |
| 3D 角色动作 | 最低 | 动画融合/IK/镜头全是手感且互相牵连，几乎全部人工试玩 |

手感主导的品类，验收协议拆成两段，不许混：

1. **无头可判的代理断言照常写**（能跳起、能落地、能通关、不穿墙）；
2. **手感参数清单单独交付**：土狼时间/跳跃缓冲/空中控制/相机前瞻/命中顿帧等常量
   集中外置到 `autoload/game_state.gd` 调参区（键名与 `spec.numeric` 对应，改参数不改代码），
   并在交付说明里明确「这些参数**不可**被冒烟判定，需要人工试玩校准」——
   禁止用「手感好」「画面好看」这类不可判定描述伪装成已验收（见下文 ✅/❌ 示例）。

接到 Godot 目标时，先把它补齐成五段结构（缺哪段先补哪段再动手）：

```
类型：2D 俯视收集 / 平台跳跃 / 弹幕 / 解谜 / 离散网格
美术风格：极简几何（Polygon2D 色块）/ 像素 / 占位贴图
核心玩法：一句话说清「玩家做什么、怎么赢」
操作按键：WASD 移动 / 空格跳跃 / 回车确认（每个按键都要落到 InputMap 动作）
验收标准：必须可无头判定（逐条可翻译成冒烟断言）
```

可无头判定的验收标准示例（✅ vs ❌）：

- ✅ 「游戏无头运行退出码为 0，冒烟断言全过」
- ✅ 「玩家按住 D 一秒后 x 坐标增加 ≥100px」（`Input.action_press` + 位移断言）
- ✅ 「收集 3 个金币后出现胜利文本」（直接调用加分函数 + 断言状态/UI 文本）
- ❌ 「手感好」「画面好看」（不可判定 → 改写成可判定的代理断言，或放到人工评审）

### 7A 资产策略：AI 产能分级（美术风格栏选「像素」前先读）

| 资产类型 | 结论 | 本技能的默认动作 |
|---|---|---|
| 音效 SFX | 真能用，含上线 | 可直接生成/引入 |
| 音乐 | 占位与氛围可以；有辨识度的主题曲还不行 | 占位循环先顶上，主题曲留人工 |
| 2D 背景 / 概念图 | 能用 | 可生成 |
| 精灵图集 | 差：帧间一致性与统一调色板恰是生成模型守不住的 | 避免；用极简几何（Polygon2D 色块，模板默认）替代 |
| 像素画 | 最差：不尊重像素网格，也不尊重固定调色板 | 避免；美术风格栏别轻易选「像素」 |
| 3D | 静态道具几何勉强，动画拓扑不可用 | 本技能（2D）不涉及 |

默认路线 = 模板的「极简几何」：不依赖任何生成资产即可成立，美术后补不阻塞可玩性。
**上架 Steam 须在内容调查表中披露 AI 生成内容**（Valve 2024-01 起；预生成资源披露后允许，
实时生成需额外防护）——交付说明里要带上这句提醒，别到提交时才发现。

与「规则 vs 手感」互补的最优分工：存档系统、背包、UI 接线、数据表、编辑器插件这类
「无聊基础设施」AI 几乎白送，优先交给 agent；决定游戏好不好玩的部分（手感、节奏、
难度曲线）留给人调。

---

## 8. 交付物回写

目标推进到「可跑」之后：

1. `[CHECKPOINT]` 记录：`preflight` 结果（N 类检查通过 / 修了哪几条 P）、`smoke` 退出码与
   `GODOT_SMOKE: PASS` 日志、冒烟断言覆盖了哪些验收标准。
2. `[PR]` 提交工程代码；PR 描述里附 `godot --headless` 的真实运行输出（不要虚构）。
3. `.godot/` 不入库；模板的 `tests/smoke.tscn|gd` 必须随工程一起交付。
