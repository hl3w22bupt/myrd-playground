# game-11 画质升级 v2：渲染决策记录（gl_compatibility 支持面 × 实际落地）

对应需求：《game-11 画质升级 v2：画面精美度 / 字体清晰度 / 3D 表现力三专项》（cmuxi89i3000km9oeyc2y2mle）。
本工程钉死 `gl_compatibility` 渲染器（Godot 4.3，Web 唯一务实选择），以下每项都按兼容渲染器
的真实支持面取舍；**不可用项全部给出等效替代并在此记录，不做无声降级**。

## 专项一：字体清晰

| 决策 | 落点 | 说明 |
|---|---|---|
| hidpi 高分渲染 | `project.godot` `display/window/dpi/allow_hidpi=true`（显式声明） | canvas 背板按 devicePixelRatio 渲染，iPhone 390×844@3x → 1170×2532 背板 |
| 矢量重排不位图拉伸 | stretch `mode=canvas_items`（保留）+ `aspect=keep→expand` | expand 让任意窗口占比铺满无黑边，字体按最终分辨率光栅化 |
| 全矢量中文 | 保留 `gui/theme/custom_font`（NotoSansSC 子集）+ 新增代码构建 UI 主题 `scripts/ui_theme.gd` | 主题统一 Button/Panel/Label 样式与字号；`main.gd::_apply_ui_theme()` 挂到两个 CanvasLayer 的全部顶层 Control |
| 字号加大 | `main.tscn` 各控件 font_size +2~8；灯箱 Label3D 挂同一矢量字体，font_size 96→256 / pixel_size 同比缩小（文字纹理密度 ≈5×） | 修复 v1 遗留：Label3D 未挂中文字体（Web 沙箱下灯箱中文有缺字风险）+ 小字号纹理拉伸发糊 |

## 专项二：画面精美

| 效果 | 兼容渲染器支持面（实测/文档） | 落地 |
|---|---|---|
| MSAA 3D | ✔️ 多重采样帧缓冲 | `anti_aliasing/quality/msaa_3d=1`（2×；hidpi 3x DPR 背板已达 1170×2532，2× 边际成本可控） |
| Filmic 色调映射 | ✔️ `Environment.tonemap_mode` | `TONE_MAPPER_FILMIC`，exposure 1.05 / white 4.0，灯泡自发光 3.2 energy 高光滚落不死白 |
| Glow 辉光 | ✔️（4.3 起支持；glow levels 在兼容渲染器无效，用默认单级） | `glow_enabled`，intensity 0.55 / bloom 0.08 / hdr_threshold 1.05 / SOFTLIGHT |
| 雾效 | ✔️ 深度/高度雾；❌ 体积雾（Forward+ 专属） | `FOG_MODE_DEPTH`，begin 1.6 / end 7.0 / curve 1.4，暗蓝雾色拉开机台空气层次；**体积雾不可用 → 深度雾等效替代** |
| 颜色调整 | ✔️ adjustments | contrast 1.06 / saturation 1.10 / brightness 0.98，去除软渲染灰蒙感 |
| 反射 | ❌ SSR；⚠️ ReflectionProbe 支持面在 4.3 存版本边界（每网格 ≤2 探针是后期版本文档口径），不敢依赖 | **等效替代**：玻璃 metallic 0.55/roughness 0.04/specular 0.9、金属件 metallic 1.0 + 新增两盏彩色补光（暖金/冷青 OmniLight），光源镜面高光沿玻璃罩与金属件拉出可感知反光条 |
| 软阴影 | ✔️ shadow_blur/shadow_opacity；❌ PCSS（`light_angular_distance` 兼容渲染器忽略，仅声明无副作用） | 主光 `shadow_blur=1.6` + `shadow_opacity=0.72`；玻璃/自发光件 `cast_shadow=OFF`，柜内不被透明体投死黑影 |

## 专项三：3D 表现力

- **PBR 材质体系**：机身=烤漆金属（metallic 0.78/rough 0.38/specular 0.62）、包边/导轨=镀铬金（metallic 1.0/rough 0.18）、
  绒布娃娃=哑光绒面（rough 0.95/specular 0.25）、灯罩灯泡=自发光（2.4/3.2）、玻璃=透明高光、独角=亮面金属。
  注：Godot 4.3 的 `BaseMaterial3D` **没有 sheen 属性**（ClassDB 实测），绒面以高 roughness+低 specular 表达。
- **夹爪精细化**：滑车（滚轮/螺栓）→ 吊缆 → 爪头（缆夹/颈柱/环座/圆盘）→ 每臂（胶囊上臂→肘关节球→锥形下指→指尖胶垫），
  剪刀爪下指压扁成刃、双爪上臂加粗；曲面件全部 Capsule/Sphere/Cylinder，无硬棱。
- **娃娃精细化**：细分 20/10→26/13；新增手臂/脚掌/口鼻（按耳型分支）；眼睛改亮面（rough 0.12）+ 高光点；
  材质仍按 `色值|粗糙度` 静态缓存，8 只共享，控 DrawCall。

## 移动端性能红线（≥30fps）与质量看门狗

基线：v1 移动门禁（SwiftShader 软渲染，1170×2532）实测 10 fps（阈值 ≥8，`qa/mobile/report.json`）。
画质全开会吃掉这 2 fps 余量，因此 `main.gd` 内置**质量看门狗**：

- 开局 HIGH 档全效果；暖身 90 帧后按 60 帧滑动窗口算平均帧率，`< 24 fps` 逐级降档：
  MEDIUM（摘 MSAA+Glow）→ LOW（再摘雾+颜色调整）；
- 档位暴露为 `Main.quality_tier`，冒烟断言 headless 不降档；降档是显式契约，不是无声降级；
- 达标设备（真机/桌面）保持全效果 —— 验收标准里「Web 预览验证 MSAA/Glow/雾生效」以桌面/真机预览为准。
