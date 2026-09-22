# 美术黑板 · 《我被AI女友包围了》

> 本文件是本项目美术资产的**风格单一事实源（风格卡）+ 资产清单**。
> 任何立绘/头像/表情差分/精灵表/UI 素材的提示词与产出，一律引用本卡，禁止逐图另编形容词。
> 美术单一事实源（内容层）= 各人设卡 `portrait_prompt`（`games/ai/data/personas/persona-*.json`）；本卡负责把 5 张提示词**收敛为同一套视觉四要素**。

---

## 一、风格卡（四要素，一次定死）

| 要素 | 规定 | 落地口径 |
|---|---|---|
| **调色板** | 三级层次：①主色 = 各女友人设卡 `color` 字段（唯一取色来源，禁止代码/美术另配色）；②辅色 = 主色同色相降饱和 35%、降亮度 20%（背景渐变、面板底）；③强调色 = 暖白逆光 `#fff3e6` + 全局深底 `#17131c → #241c2b` | 立绘背景 = 辅色渐变 + 主色辉光；UI 面板 = 深底 72% 不透明 + 主色 1.5px 描边 |
| **光照** | 柔和逆光（rim light）：主光左上 135°，暖白轮廓光勾剪影；暗部只做**单层 cel 阴影**（不做多层写实阴影）；主题色 halo 辉光垫底 | `rim = 暖白 #fff3e6`，`shadow = 主色 × 0.62`，halo 半径 = 头宽 × 2.2 |
| **线条** | 细描边 cel 风格：立绘 2px、精灵表 1px、头像 1.5px（均按源分辨率计）；描边色 = 主色同色相加深 60%，**禁用纯黑 `#000`** | `outline = shade(main, 0.40)` |
| **比例** | 立绘 3:4（288×384，6.5 头身胸像构图）；头像 1:1（96×96 圆形裁切 + 主色描边）；精灵表 chibi 2.5 头身（96×96/帧）；UI 面板九宫格圆角 12px | 见 §三 导出规格 |

**统一动画参数**（与 `data/spec/numeric.json` 同一层级的内容化参数）：
- `idle`：4 帧 / 6 fps 呼吸（躯干 ±1px、头发 ±2px、眨眼在第 4 帧）；
- `walk`：4 方向 × 4 帧 / 10 fps（下肢摆幅 ±6px，手臂反相摆动）；
- 表情三档：`normal / happy / crisis`（crisis 档附带红色边缘晕影 + 汗滴，禁止加文字）。

---

## 二、资产清单与命名（小写 kebab-case，落点已定）

```
games/ai/assets/art/
  personas/<persona-id>/          # persona-id ∈ lumi | vex | ada | momo | sera
    portrait.png                  # 立绘 288×384，主展示于对话框 Portrait 位（68×96 逻辑 px）
    avatar.png                    # 头像 96×96，花名册 + 心动信物
    expr-normal.png               # 表情差分 ×3（与立绘同构图同分辨率，仅脸部与光效差分）
    expr-happy.png
    expr-crisis.png
    sheet-idle.png                # 待机精灵表 384×96（4 帧 × 96×96，横向排布）
    sheet-walk.png                # 行走精灵表 384×384（4 行方向 × 4 列帧：下/右/左/上）
  player/
    portrait.png | avatar.png     # 主角小李（同上规格）
    sheet-idle.png | sheet-walk.png
  ui/
    dialog-panel.png              # 192×128 九宫格，圆角 12，深底 72% + 主色描边 + 外投影
    option-button.png             # 192×64 九宫格 ×3 态（normal / hover / active）
    option-button-hover.png
    option-button-active.png
    bar-frame.png                 # 128×20 九宫格槽体（内凹描边）
    bar-fill.png                  # 96×12 填充条（按 favor/threat/生存三轴 tint 上色）
    soft-shadow.png               # 128×128 径向软投影/辉光通用件
    joystick-ring.png | joystick-knob.png
    title-bg.png | ending-bg.png  # 640×360 全屏底（标题/结局界面）
  anim/
    player-anim.tres              # SpriteFrames：idle + walk(4 向)，帧表引用 sheet-*.png
    <persona-id>-anim.tres        # 同上 ×5（供剧情段女友登场复用）
```

**接线规则**：立绘/头像/表情路径写入人设卡 `art` 字段（`persona_loader` 只认卡片，不认代码）；精灵表路径写入 `art.idle_sheet / art.walk_sheet`（schema `additionalProperties: true`，扩展不破契约）。

---

## 三、导出规格（给实现节点的硬口径）

| 项 | 规格 |
|---|---|
| 格式 | PNG-8 调色板（≤128 色，无抖动）；全屏底 `title-bg/ending-bg` 用 PNG-8 256 色 |
| 位深/通道 | RGBA，透明区域预乘关闭（Godot `process/premult_alpha=false`） |
| 导入参数 | 精灵表与 UI 九宫格：`mipmaps/generate=true`（游戏内缩小绘制）、`detect_3d/compress_to=0`；立绘/头像：mipmaps 关（按原尺寸或放大显示，避免模糊） |
| 压缩模式 | `compress/mode=0`（Lossless）；`.webp` 禁用（扁平 cel 色块下 PNG-8 更小且无振铃） |
| 体积预算 | 全部新增美术 ≤ **1.2 MB**（现 pck 2.8 MB，红线 = 总 pck ≤ 4 MB）；超线先降表情差分分辨率至 240×320，再减色至 64 色 |
| 命名 | 小写 kebab-case，文件名与 spec 实体 id / persona id 一一对应（`expr-*` ↔ `ExpressionKind.NORMAL/HAPPY/CRISIS`） |

---

## 四、生成器（可再生，防止风格漂移）

- 生成器：`tools/artgen/`（`artcore.py` 基元 / `artportrait.py` 立绘 / `artchibi.py` 精灵表 / `artui.py` UI 件 / `artanim.py` SpriteFrames 帧表 / `generate.py` 角色规格表 + 入口）。
- **改风格 = 改风格卡 + 改生成器参数，禁止手修单张 PNG**（手修即漂移，下次再生全部回退）。
- 2× 超采样 + LANCZOS 降采样；所有形状走贝塞尔平滑，不用逐像素硬编码。

---

## 五、blockers（视觉意见，回给主策划/编码实现）

| 编号 | 事项 | 建议 |
|---|---|---|
| A-1 | `main.tscn` DialogPanel 固定 320×110，长文本必然溢出 | 已出施工单 `docs/art-upgrade-workorder.md` WO-01（锚点自适应 + 字号自适应 + 最小字号钳制） |
| A-2 | 玩家为单帧 Sprite2D 恒速位移，无 idle/walk 状态机 | 已出施工单 WO-03（SpriteFrames 已备好，需 AnimatedSprite2D 接线 + 数值进 `numeric.json`） |
| A-3 | 三个状态条为纯色 ColorRect，无层次 | 已出施工单 WO-05（`bar-frame/bar-fill` 已产出，需九宫格 + tint 接线） |
| A-4 | 危机体/信物仍用表情差分整图按宽缩放（288×384 → 高度溢出） | 已出施工单 WO-04（改用 96×96 方形头像 + 等比短边缩放） |
| A-5 | 虚拟摇杆为纯 `draw_circle`，与整体风格脱节 | 已出施工单 WO-06（`joystick-ring/knob` 已产出，输入管线零改动） |
