# 《我被AI女友包围了》视觉升级施工单（美术 → 编码实现）

> **依据**：四轮迭代需求《视觉审美与交互体验升级》（id=cmuc6ynmq001rm956r3szlnyd）四项范围。
> **风格单一事实源**：`.myrd/blackboard/assets.md` §一 风格卡（调色板 / 光照 / 线条 / 比例四要素）。
> **美术单一事实源（内容）**：各人设卡 `portrait_prompt`（禁止代码/美术另行脑补）。
> **本文用法**：每条 WO = 文件 → 现状（行号）→ 改造点（可照抄的参数/代码）→ 验收断言。
> **硬约束继承**：godot headless 三件套 0 error；数据驱动（排版/动效/手感只改 theme/JSON）；DPR 口径沿用知识库 649e691d §二；零回归红线。

---

## 〇、美术侧已交付（本单随包入库，无需重做）

| 交付物 | 落点 | 状态 |
|---|---|---|
| 6 角色立绘 288×384 + 表情差分 ×3 + 头像 96×96 | `games/ai/assets/art/{personas,player}/<id>/` | ✅ 共 42 张（746.9 KB） |
| 6 套精灵表（idle 4 帧 + walk 4 向 ×4 帧，96×96/帧） | 同上 `sheet-idle.png` / `sheet-walk.png` | ✅（walk 已配 mipmap） |
| UI 件 11 张（面板/按钮三态/状态条/摇杆/标题结局底图） | `games/ai/assets/art/ui/` | ✅ 43.8 KB |
| SpriteFrames 帧表 ×6（idle 6fps + walk×4 向 10fps） | `games/ai/assets/anim/<id>-anim.tres` | ✅ headless 加载校验 PASS |
| 人设卡 `art` 字段接线（PNG + `idle_sheet`/`walk_sheet` 扩展键） | `games/ai/data/personas/persona-*.json` | ✅（schema `additionalProperties:true`，契约测试已过） |
| UI 排版/配色/动效 token | `games/ai/data/spec/ui.json` | ✅ 新增（键名见各 WO） |
| 生成器（可再生，防风格漂移） | `tools/artgen/`（`generate.py` 入口） | ✅ `python3 tools/artgen/generate.py` 一键再生 |
| `.import` 导入参数 | 精灵表 `mipmaps/generate=true`，其余默认 Lossless | ✅ `godot --headless --import` 0 error |

**门禁基线（本单提交时已实测）**：`--headless --import` exit=0；`smoke.sh games/ai` PASS（素材契约按新 PNG 路径核对通过）；临时校验 `ART_ASSET_CHECK: PASS`（帧表口径 idle 4@6fps / walk 4×4@10fps / 96×96）。

---

## 一、需求范围 → 施工单映射

| 需求范围 | 施工单 |
|---|---|
| 一：PC 对话框字体不溢出 | WO-01（主题字号自适应）WO-05（面板九宫格） |
| 二：女友/主角精灵品质升级 | WO-02（已交付接线）WO-04（危机体/信物）WO-07（标题/结局） |
| 三：人物移动动画平滑 | WO-03（状态机 + 速度插值 + 转身） |
| 四：整体 UI 审美升级 | WO-05（样式 token）WO-06（摇杆）WO-07（转场）WO-08（动效规范） |

---

## WO-01 对话框文本自适应（字体不溢出）

**文件**：`games/ai/scenes/main.tscn`、`games/ai/scripts/main.gd`、读 `data/spec/ui.json`

**现状**：
- `main.tscn` L168-183：`DialogPanel` 固定 320×110（offset -160/-120..160/-10）；
- L203-210：`DialogText` 仅 `autowrap_mode=3`，无字号 override（默认 16），固定 84..312 宽、30..104 高；
- L185-193：`Portrait` 固定 68×96；
- 最长剧情文本（act3.json 最长 ~90 汉字）在窄窗（aspect=expand 竖长窗宽 ≈360 逻辑 px）下必然裁字/压选项。

**改造点**：
1. `DialogText` 补 theme 覆盖（来源 `ui.json.typography`，禁止硬编码）：
   `theme_override_font_sizes/font_size` = `typography.dialog_text_size`(15)；
   `theme_override_constants/line_spacing` = `typography.dialog_line_spacing`(4)；
   `autowrap_mode = 3 (AUTOWRAP_WORD_SMART)` 保持；
   `vertical_alignment = 0 (TOP)`；`clip_text = false`。
2. `DialogPanel` 改**锚点自适应**：`anchor_left/right = 0.5` 保持，宽改 `offset_left = -w/2`，`w = min(视口宽 × 0.92, 480)`；高度按内容自适应（下沿锚死 `offset_bottom = -layout.dialog_bottom_offset`，上沿 `offset_top = -height`，height = clamp(内容最小高, `dialog_min_height`, 视口高 × `dialog_max_height_ratio`)）。
3. **字号自适应规则**（main.gd 新增 `_fit_dialog_text()`，在 `_enter_node()` 设完 `dialog_text.text` 后与 `Main` 的 viewport `size_changed` 信号里各调一次）：
   ```
   # 伪代码：measure → 缩字号 → 仍超再扩高
   var w := dialog_text.size.x
   var font := get_theme_font("font"); var size := ui.typography.dialog_text_size
   while font.get_multiline_string_size(text, ..., w, size, line_spacing).y > 可用高 and size > ui.typography.dialog_text_min_size:
       size -= 1
   ```
   最小字号钳制 `dialog_text_min_size`(12)：低于仍溢出则扩高，**绝不允许裁字**。
4. `SpeakerLabel` 字号 = `speaker_size`(13)，`ConfirmHint` = `hint_size`(11)，`ToastLabel` = `toast_size`(12)+`autowrap_mode=3`。
5. DPR 口径：如需 CSS 口径换算，沿用 `main.gd _min_option_height()` 既有路径（`JavaScriptBridge` 读 `window.devicePixelRatio`），**禁止用 `window_get_size()/get_viewport_rect()` 假比值**。

**验收断言**（进 smoke 或 QA 仿真）：在 1280×720 / 1920×1080 / 360×760 三档 × DPR 1/2/3，取 act3 最长文本渲染，像素断言：文本像素与面板边框重叠 = 0、无裁字（文本测量高 ≤ 面板内容高）、`DialogText.bottom + 8 ≤ OptionsBox.top`。

---

## WO-02 立绘 / 头像 / 表情差分接线（美术已交付，仅需显示侧微调）

**文件**：`games/ai/scripts/main.gd`、`games/ai/scenes/main.tscn`

**现状**：`persona_loader` 按 `art` 字段取路径（已指向 PNG），`_show_portrait()` 直接 `load()` 后赋 `portrait_rect.texture` —— **已可用**。

**改造点**（提升观感，非必需但强烈建议）：
1. `main.tscn` `Portrait` 改为 72×96（`offset_right - offset_left`），`expand_mode=1`、`stretch_mode=5 (KEEP_ASPECT_CENTERED)` 保持 → 288×384 源 3:4 与框 3:4 完全同比，零变形。
2. 表情切换加微动效（读 `ui.json.motion`）：`portrait_swap_duration`(0.12s) + `portrait_swap_offset_px`(6) —— 换表情时 Portrait 从右侧 6px 滑入 + alpha 0→1（Tween，函数内创建，不建常驻节点）。
3. `main.gd L461-466`（crisis 贴图选择）与 `_spawn_hazards()` 改用 `personas.avatar_path(persona_id)`（96×96 方形，见 WO-04）。

**验收**：花名册头像为圆形带主题色描边；对话框立绘无拉伸变形；表情三档随 `ExpressionKind` 切换。

---

## WO-03 玩家精灵多帧动画 + 移动平滑（范围三核心）

**文件**：`games/ai/scenes/player.tscn`、`games/ai/scripts/player.gd`、`games/ai/autoload/game_state.gd`、`data/spec/numeric.json`

**现状**：
- `player.tscn`：`Body` 为单帧 `Sprite2D`（xiaoli.svg）+ 24×24 碰撞；
- `player.gd _physics_process()`：`velocity = direction * GameState.move_speed` 恒速、无动画、无朝向插值。

**改造点**：
1. `player.tscn`：`Body` 换 `AnimatedSprite2D`，`sprite_frames = ExtResource("res://assets/anim/player-anim.tres")`，`animation = &"idle"`，`autoplay = "idle"`，`scale = Vector2(0.5, 0.5)`（96×96 帧 → 48px 显示，略大于 24×24 碰撞体，视觉脚底对齐：`offset = Vector2(0, -12)` 让足底贴碰撞框下沿）。**碰撞体 24×24 与 `Player.HALF_SIZE=12` 契约不动**（信物/危机距离复核依赖）。
2. 动画状态机（`player.gd`，键名来自帧表，禁止新造字符串）：
   ```
   var anim: AnimatedSprite2D = $Body
   var facing := Vector2.DOWN
   if direction != Vector2.ZERO:
       facing = _dominant_direction(direction)   # 取绝对值最大轴，避免斜向抖动
       anim.animation = &"walk_%s" % _dir_name(facing)
       if not anim.is_playing(): anim.play()
   else:
       anim.animation = &"idle"
   ```
3. **位移平滑**（起步加速 / 松杆减速）：
   ```
   var target := direction * GameState.move_speed
   var k := GameState.move_accel if direction != Vector2.ZERO else GameState.move_decel
   velocity = velocity.lerp(target, 1.0 - pow(k, delta))   # 指数平滑，帧率无关
   ```
   数值进 `numeric.json`（同步在 `game_state.gd` 增加 `move_accel`/`move_decel` 字段与默认值，键名契约一一对应）：
   `"move_accel": 0.0008, "move_decel": 0.00005`（指数系数，值越小越「滑」；起手建议 accel≈0.0008 / decel≈0.00005，手感调优只改表）。
4. **转身平滑**：`facing` 变化时 `anim.flip_h` 不再瞬跳（帧表已含 left/right 两行，无需 flip）；补一个 0.06s 的 `scale.x` 1→0.92→1 挤压过渡（读 `ui.json.motion.option_press_duration` 同源时长或新增 `turn_duration`），消除贴图硬跳。
5. **帧率与速度匹配**：walk 帧表 10fps 为基准；如需随速度缩放，`anim.speed_scale = clampf(velocity.length() / GameState.move_speed, 0.6, 1.4)`（静止时回落 1.0）。
6. `tests/smoke.gd` 补断言：行走时 `anim.animation.begins_with("walk_")` 且帧号随时间推进；松杆后 ≤0.5s 回 `idle`；任意 0.25s 位移 ≤ `move_speed × 0.25`（禁瞬移）。

**验收**：headless 注入移动输入断言帧切换 + 位移上限；桌面/移动端行走无「静止贴图滑行」、无瞬移、无转身硬跳。

---

## WO-04 危机体 / 心动信物贴图换新

**文件**：`games/ai/scripts/main.gd`、`games/ai/scripts/crisis_hazard.gd`、`games/ai/scripts/bond_token.gd`

**现状**：
- `main.gd L479-486`：危机体贴图取 `expression_paths()[EXPRESSION_CRISIS]`（288×384）；
- `crisis_hazard.gd setup()`：`body.scale = HALF_SIZE*2 / texture.get_width()` → 288×384 源按宽缩放后**高度溢出**（60→80px），且全身立绘当危机标记语义不对。

**改造点**：
1. `main.gd _spawn_hazards()`：改传 `personas.avatar_path(persona_id)`（96×96 方形头像，主题色描边即是「谁的危机」的可读标识）。
2. `crisis_hazard.gd`：缩放改**等比取短边**：`var s := HALF_SIZE * 2.0 / max(texture.get_width(), texture.get_height())`；并在 `_draw()`（若无则加一个子 `Node2D`）画主题色光晕：`draw_circle(Vector2.ZERO, HALF_SIZE + 6, Color(c.r, c.g, c.b, 0.22))`（色取人设卡 `color`，与 `bond_token.gd L65` 同款语言）。
3. `bond_token.gd`：`Body` 同理改用 `avatar_path`（现在是色块/圆），保留主题色光晕（L65 不动）。
4. 危机体呼吸动效：`Body` 加 `Tween` 循环 `scale ±4%`（时长 `ui.json.motion.speaker_bob_duration` 1.6s，SINE 往返）——「纠缠区在呼吸」的威胁感。

**验收**：危机体/信物显示为圆形头像 + 主题色光晕，无拉伸；威胁/好感归属一眼可辨；smoke 现有断言不回归。

---

## WO-05 UI 面板与按钮样式 token（范围四核心）

**文件**：`games/ai/scripts/main.gd`、`games/ai/scenes/main.tscn`、读 `data/spec/ui.json`

**现状**：
- `main.gd L22` `OPTION_TEXTURE` 常量 + L376-380：`StyleBoxTexture` **未设九宫格 margin** → 192×64 圆角贴图被拉伸到按钮实际尺寸，圆角变形；三态共用一张，仅靠 `modulate` 提亮；
- `main.tscn` L60-66/L86-95/L111-124：三个状态条 = `ColorRect` 纯色块 + `Frame` TextureRect（`stretch_mode=0` 直接拉伸 120×12）。

**改造点**：
1. **九宫格**（读 `ui.json.nine_slice`）：
   ```
   var style := StyleBoxTexture.new()
   style.texture = load("res://assets/art/ui/option-button.png")
   var m: Array = ui.nine_slice["option-button.png"]      # [l, t, r, b]
   style.texture_margin_left = m[0]; style.texture_margin_top = m[1]
   style.texture_margin_right = m[2]; style.texture_margin_bottom = m[3]
   style.content_margin_left = m[0] + 4 ...               # 文字内边距
   ```
   三态换三张贴图（`option-button.png` / `-hover.png` / `-active.png`），hover/pressed 分别在 `hover`/`pressed` 覆盖；`focus` 用 `StyleBoxEmpty`（触屏无焦点框）。
2. **对话框面板**：`DialogPanel.texture` 换 `res://assets/art/ui/dialog-panel.png`，`stretch_mode = 1 (TILE)` 不需要 —— 直接用 `NinePatchRect` 替换 `TextureRect`（patch_margin_* 同上九宫格值），半透明深底 + 描边 + 外投影即自带。
3. **状态条**：`Frame` 换 `bar-frame.png`（`stretch_mode=0` 保持，或 NinePatch），`Fill` 由 `ColorRect` 换 `TextureProgressBar`（`texture_progress = bar-fill.png`，`tint_progress` 取 `ui.json.color.bar_*`）或保留 ColorRect 但外套 frame 圆角；`_set_bar_fill()` 改设 `TextureProgressBar.value/ratio`。
   三轴配色（`ui.json.color`）：体力 `#5fc46f`、饱食 `#e0b04f`、理智 `#6f8fd8`；favor/threat 用主题色/`#d9414f`（新加的两个条如复用同结构）。
4. **选项选中态**：`_highlight_option()` 的魔数 `Color(1.35,1.3,1.1)` / `Color(0.75,0.75,0.8)` 改读 `ui.json.color.select_bright/select_dim`。
5. **布局 token**：选项列宽 `option_width_ratio`(0.78)×视口宽、`option_min_height`(44)/`option_max_height`(96)、`option_separation`(6)、`option_box_bottom_offset`(120) 全部改读 `ui.json.layout`（替换 `main.gd` 里的散落魔数与 `main.tscn` 固定 offset）。
6. **安全区**：顶部信息簇（HudLabel/ActLabel/状态条）整体下移 `layout.safe_area_top_pad` + 既有安全区避让量（沿用现有 `DisplayServer.get_display_safe_area()` 换算，Web 退化为 0 不报错）。

**验收**：任意窗口尺寸按钮圆角不变形、文字内边距一致；三态可辨识；状态条有框+渐变填充层次；`grep` 确认样式值无 `.gd` 硬编码（全部来自 `ui.json`）。

---

## WO-06 虚拟摇杆视觉换新

**文件**：`games/ai/scripts/virtual_joystick.gd`

**现状** L152-156：`draw_circle/draw_arc` 白色半透明圆 —— 与整体风格脱节。

**改造点**：`_draw()` 改为贴图绘制（输入管线逻辑**一行不动**，E-18/E-19 修复成果零回归）：
```
var _ring: Texture2D = preload("res://assets/art/ui/joystick-ring.png")
var _knob: Texture2D = preload("res://assets/art/ui/joystick-knob.png")
func _draw() -> void:
    if not _active: return
    var r := _base_radius * 2.0
    draw_texture_rect(_ring, Rect2(_center - Vector2(r, r) / 2.0, Vector2(r, r)), false)
    var k := _stick_radius * 2.0
    draw_texture_rect(_knob, Rect2(_center + _output * _base_radius - Vector2(k, k) / 2.0, Vector2(k, k)), false)
```
注意贴图尺寸（ring 128 / knob 64）与 `touch.json` 的 `joystick_base_radius=56` / `joystick_stick_radius=26` 对应：绘制直径 = 半径×2，贴图自带留白约 ±8%，视觉即对位。

**验收**：摇杆显示环形底座 + 立体球帽；拖拽时球帽跟随、松手归位；headless 触摸断言（E-19 双轴同帧）不回归。

---

## WO-07 标题 / 结局界面与转场动效

**文件**：`games/ai/scenes/main.tscn`、`games/ai/scripts/main.gd`

**现状**：`TitleScreen`/`EndScreen` 引用 `title-bg.svg`/`ending-bg.svg`（纯色块 + 光斑，L5/L8 与 L221-309）；切换为瞬时 visible 翻转。

**改造点**：
1. 换 `res://assets/art/ui/title-bg.png` / `ending-bg.png`（640×360，带城市剪影 + 5 主题色光晕 + 星尘，`expand_mode=1, stretch_mode=6` 保持 → 任意窗口比例自适应）。
2. 入场动效（读 `ui.json.motion`）：标题 `title_fade_duration`(0.45s) alpha 0→1 + `TitleTitle` 从 y+12 上浮；结局 `ending_fade_duration`(0.6s)；实现用 `create_tween()`，相位切换处（`_phase` 赋值点）调用，不建常驻动画节点。
3. 标题字号 token 化：`TitleTitle` 34 → `typography.title_size`，`TitleSub` → `title_sub_size`(13)，`TitleHint` → `hint_size`；结局 `EndLabel` → `ending_size`(30)，`EndReason`/`EndBasis` → `ending_body_size`(13)。
4. 结局界面加当前结局主色的氛围光（`modulate` 一层 `soft-shadow.png` 着色，色取 `ending_resolver` 结局枚举映射表 —— 映射表放 `ui.json.color` 或结局内容 JSON，不硬编码在 .gd）。

**验收**：标题/结局有层次底图与淡入转场；文字不溢出（WO-01 同一自适应规则）；桌面/移动首帧无白屏闪烁。

---

## WO-08 动效规范统一（全项目动效只认 token）

**规则**（进 `ui.json.motion`，禁止 .gd 内散落 Tween 时长魔数）：
- 出入场：`panel_in 0.18s CUBIC/EASE_OUT`、`panel_out 0.12s CUBIC/EASE_IN`；
- 反馈：按钮按下 `0.06s`（scale 1→0.96→1）；
- 数值条：`bar_tween 0.25s SINE/EASE_OUT`（favor/threat 变化时条平滑过渡，顺带把数值变化「演出化」）；
- 待机呼吸：`speaker_bob 1.6s SINE` 往返，幅度 `speaker_bob_amplitude_px=2`（对话框立绘轻浮动，增强「活着」的感觉）；
- 实现侧统一封装 `main.gd _tween(node, prop, to, token_name)`，从 token 表取时长/ease，便于全局调节奏。

**验收**：`grep -n "create_tween" games/ai/scripts/*.gd` 每处时长均来自 token 表；QA 观感「动效节奏一致」。

---

## WO-09 导出与体积预算（Web 规范不放松）

1. 新增美术合计 **790.7 KB**（角色 746.9 + UI 43.8），pck 预期 2.8MB → ~3.6MB，**低于 4MB 红线**；导出后实测值回填知识库《设计基线》§七与 `.myrd/blackboard/assets.md` §三。
2. `.import` 已配：精灵表 `mipmaps/generate=true`（游戏内缩小绘制不发糊）；全部 Lossless（`compress/mode=0`）；`premult_alpha=false`。**不要**把 UI 半透明件转 VRAM 压缩（会糊边）。
3. 字体已子集化（2.9MB otf，全工程共用一份），本轮**不新增字体**；如后续加字重，必须同步子集化并把体积差回填基线文档。
4. 导出仍锁单线程；`.wasm` MIME `application/wasm`、同源部署、`/healthz` 不变。
5. 导出后浏览器冒烟：canvas 出现、console 无 error、`assets/art/**` 无 404。

---

## WO-10 门禁补强建议（让「素材到位」机器可验证）

建议在 `tests/smoke.gd` 素材契约段（L213-223 现状）追加三条断言：
1. **占位残留 = 0**：`persona.art` 指向的路径后缀必须为 `.png`（`.svg`/`.import` 即失败）—— 锁死「占位方块回归」；
2. **多帧到位**：`art.idle_sheet`/`art.walk_sheet` 存在，且对应 `assets/anim/<id>-anim.tres` 可加载、`idle` 帧数 ≥ 2、`walk_*` 帧数 ≥ 2（AC「多帧动画」的机器口径）；
3. **动画帧表口径**：idle fps=6、walk fps=10（与黑板风格卡一致，防止后续随便改节奏）。

---

## 验收标准对照（需求四 → 本单）

| AC | 验收点 | 本单落点 |
|---|---|---|
| 1 | 字体不溢出（3 档窗口 × DPR 1/2/3 像素断言） | WO-01 + WO-05 |
| 2 | 5 女友 + 主角高清资产、立绘 1 + idle/walk ≥2 类多帧、占位残留 0 | 已交付资产 + WO-03 + WO-10 |
| 3 | 行走帧随速度切换、位移 ≤ move_speed、转身平滑 | WO-03 |
| 4 | 配色层次/面板质感/动效 token 化 | WO-05 + WO-06 + WO-07 + WO-08 |
| 硬约束 | 三件套 0 error、数据驱动、零回归、Web 规范 | WO-09 + 各 WO 验收段 |

**红线提醒（实现侧）**：① 任何 `.gd` 不得新增角色名/数值/颜色字面量（调色板唯一来源 = 人设卡 `color` + `ui.json`）；② 改手感/排版只改 JSON；③ 改完必须跑 `bash std-skills/godot-game-dev/scripts/smoke.sh games/ai` + `godot --headless --import`（0 error）方可提交。
