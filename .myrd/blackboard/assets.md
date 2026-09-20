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
| snake-ghost（残影） | 残影视觉规格见 concept-pool-v1.md §A3 附注（帧数/透明度梯度/颜色偏移，锁 3s）；规格状态见 §A3.1a | 新风格线成本：糖果运动残影需要 Candy 节点拖尾渲染层；**桌面口径已实证**（`qa/snake-ghost-spike/data/20260921-010743/`，verdict=能），移动端真机两项待核；池容修订建议 30→31 随 spec 期调参走 | 🔼 补证窗内证据已落（24:00 条款加验成立）→ **随卡进终裁（桌面条件冻结）**；完整性挑明三条见 §A3.1a（移动端无数据 / pool_exhausted=19 临界池 / 色板轮换未生效）。美术复核（9/20 下午）：spike_main.gd 与 §A3.1 规格逐项对齐，无规格漂移；§A3.2 参考卡四要素齐备 |
| 其余三卡 | 原始征集文案缺失，视觉需求无法登记 | — | ⛔ 待主人回传原稿（blockers.md B-2） |

## 3. 变更记录

- 2026-09-20 主策划：建档；风格卡与清单按当日工程实况（代码常量 + LICENSE.md）整理，未新增任何素材。
- 2026-09-20 游戏程序（下午批次）：候选资产区 snake-ghost 行补注 spike 工具资产落盘（`games/game/qa/snake-ghost-spike/` 四件：spike_main.gd/.tscn/run-spike.sh/README.md；模拟器色板仅 spike 自用演示，非游戏素材，主游戏零新资产）。
- 2026-09-20 游戏美术（下午批次，A3 复核 + 接线核查）：
  ① **§A3.2 参考卡补全**——初版缺「光照/比例」明示行，已按工程实况补齐（光照=candy.gd 程序化假光照现行参数 vs 残影平面色块；比例=格 96px/半径 38），共 7 行仍 ≤10 行；见 concept-pool-v1.md §A3.2。
  ② **spike 实现规格核对**——spike_main.gd 与 §A3.1 逐项对齐（10Hz 采样/3.0s 存活/30 节点池/α 0.35→0 线性/H−24°/V+10% 封顶 1.0），**无规格漂移**；其 CELL×0.8 色块为 spike 自用简化，不作为主线比例依据（主线口径=半径 38）。
  ③ **素材接线核查（零缺口）**——audio ×8（SFX 表 preload，audio_manager.gd）、字体（project.godot [gui] theme/custom_font + .import）、图标（config/icon）三项接线完好，与 §1 清单一一对应，无待补缺口。
  ④ **「本次无可产新素材」判定**——执行要求「按 approved 版策划案产出素材」前提当前不成立：spec 为 DRAFT 未 approved（B-0，禁止动码红线）；world.art_style 写死「无外部贴图依赖」，sprites/tileset 落盘与 spec 直接冲突；候选资产区主策划口径「只登记不产出」。为产而产即破风格统一（美术红线），故本批次落盘物为零，判定依据如上可核对。
  ⑤ **门禁实况（如实登记，不伪造）**——本美术会话无 shell 工具，`bash games/game/verify.sh` 与 `node scripts/contract-check.mjs`（权威版在仓库根；`games/game/scripts/` 已转转发器）物理不可执行；脚本存在性已确认。实跑输出按 blockers.md B-1 恢复路径由有 shell 执行者回填，本会话不代产出「全绿」结论。
- 2026-09-20 游戏美术（第三批次，缺口补位）：§A3.2 尾部补「三卡参考卡回填模板」块——§A1.3/§A2.4/§A4.3 均有显式模板而美术侧缺位，补位后四职能模板齐套（B-2「≤30 分钟齐套」对美术交付成立）；模板含命名规则预置（文件名 = spec 元素 id 派生、kebab-case、终裁立项后才落盘）。
- 2026-09-20 游戏美术（第四批次，B-0 解锁响应）：spec v1 代记追认 approved 后重审全部美术判定——「零贴图素材」**结论不变、依据升级**：approved 版 `world.art_style` 实体条款「极简几何，无外部贴图依赖」即执行要求「按 approved 版策划案产出素材」的答案本身（贴图类 = 0；上条④的「DRAFT 未 approved」依据已失效，就地更正由本条承接）；门禁路径更正见上条⑤；风格卡与 approved art_style 逐字一致零改动。9/21 追认若回滚，素材结论与 art_style 条款同生共死。
- 2026-09-21 游戏美术（spike 证据响应批次）：**snake-ghost spike 证据于补证窗内落盘**（`qa/snake-ghost-spike/data/20260921-010743/` 三件套，verdict=桌面口径 能）→ §A3.1 规格状态改为**桌面条件冻结、随卡进终裁**；判定与三条完整性挑明落 concept-pool-v1.md §A3.1a（移动端两项无数据待真机核 / pool_exhausted=19 临界池缺陷由美术规格认领、修订建议池容 31 / 色板轮换未生效待录屏补验）；候选资产区状态同步更新；§A2.3/B-4/run.md 综合结论回填仍归跑者，美术不代出。本批次另发现本文件变更记录区曾被并发覆盖（第三/四批次条目丢失），已恢复；请各职能写黑板前先重读最新版。
- 2026-09-21 游戏美术（第八批次，证据可核对性勘误）：① §A2.3 数据路径笔误就地更正（`010252`→`010743`，结论零改动，联署文本仅动路径一行并留痕）——R4「黑板有证据路径」要求路径指向真实三件套；② **gate log 历史性挑明**：`gate-logs/contract-gate-20260921-012610.log` 的 preflight P5/P6 FAIL 系修复前历史记录——当前 `spike_main.tscn`（`res://qa/snake-ghost-spike/spike_main.gd`）与 `run-spike.sh`（镜像目录 cp）已自洽（时序：01:07 spike 旧组合跑通 → 01:26 gate 报旧版悬空 → 之后完成镜像修复）；**修复后 verify.sh/contract-check 复跑尚未发生**（gate-logs 无新 log），全绿确认仍待有 shell 执行者复跑回填，9/21 呈批请以复跑输出为准、勿以该 FAIL 断言当前态。
