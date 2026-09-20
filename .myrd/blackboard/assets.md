# assets.md — Pixel Fives 资产清单（共享黑板）

> 更新时间：2026-09-20（N1 收口 + M1 冲刺日）
> 负责人：主策划（资产增减请在「清单」区追加行并注明来源/许可）
> 下一步：N1 终裁如立项新风格线，按参考卡成本项在本文件新增「候选资产」区，不先产任何素材

---

## 0. 风格卡（当前生效基线）

| 项 | 口径 |
|---|---|
| 风格线 | 极简几何（Polygon2D 色块），无外部贴图依赖 —— 与 godot-game-dev 技能「资产策略」一致：精灵图集/像素画为生成模型弱项，明确回避 |
| 色彩 | 深紫底板 `Color(0.13, 0.11, 0.24, 0.88)`；格子凹槽黑 22% 内嵌 + 白 5% 描边；棋盘格微条纹白 3% |
| 反馈色 | 金色系 `FX_COLOR_GOLD = Color(1.0, 0.85, 0.35)`：消除粒子环 + 飘分文字统一用色（board.gd 常量区） |
| 动效 | 新棋子 0.16s TRANS_BACK 缩放入场；无效交换 0.5s「缩小 0.08s → 抖动 4 步×0.07s（振幅 8/6/4/2 衰减）→ 回弹 0.14s」；FX 生命 0.5s |
| 字体 | `assets/fonts/NotoSansSC-Regular.otf`（子集化 Noto Sans CJK SC，OFL 许可；Web 导出防豆腐块的全局字体，preflight P13 机判其存在） |
| HUD 文案 | HUD 动态文本统一 ASCII（TEXT_* 常量）；操作提示含中文（字体覆盖）；触屏/桌面双提示按设备切换 |

## 1. 资产清单（现存，全部已入库并接线）

| 资产 | 路径 | 许可/来源 | 接线点 |
|---|---|---|---|
| 音效 ×8 | `games/game/assets/audio/*.wav`（swap/select/match/combo/win/lose/invalid/click） | CC0（逐条见 assets/audio/LICENSE.md） | GameAudio.SFX 表（audio_manager.gd），冒烟阶段 6 断言全量非空 |
| 中文字体 | `games/game/assets/fonts/NotoSansSC-Regular.otf` + OFL.txt | SIL OFL | project.godot `[gui] theme/custom_font` |
| 图标 | `games/game/icon.svg` | 工程自带 | project.godot config/icon |
| Web 导出壳 | `games/game/export/web/*`（index.html/wasm/pck + web-shell.html） | 构建产物 | export_presets.cfg |

## 2. 候选资产（N1 概念卡关联 —— 只登记，不产出）

| 关联卡 | 需求 | 成本项 | 状态 |
|---|---|---|---|
| snake-ghost（残影） | 残影视觉规格见 concept-pool-v1.md §A3 附注（帧数/透明度梯度/颜色偏移，锁 3s） | 新风格线成本：糖果运动残影需要 Candy 节点拖尾渲染层；预算未实证前不计入 | ⏳ 终裁待拍板（spike 证据未落 → 默认淘汰不保卡）；spike 工具资产已落盘 `games/game/qa/snake-ghost-spike/`（模拟器+运行脚本，非素材、不进主线，qa/ 区 .gdignore 隔离） |
| 其余三卡 | 原始征集文案缺失，视觉需求无法登记 | — | ⛔ 待主人回传原稿（blockers.md B-2） |

## 3. 变更记录

- 2026-09-20 主策划：建档；风格卡与清单按当日工程实况（代码常量 + LICENSE.md）整理，未新增任何素材。
- 2026-09-20 游戏程序（下午批次）：候选资产区 snake-ghost 行补注 spike 工具资产落盘（`games/game/qa/snake-ghost-spike/` 四件：spike_main.gd/.tscn/run-spike.sh/README.md；模拟器色板仅 spike 自用演示，非游戏素材，主游戏零新资产）。
