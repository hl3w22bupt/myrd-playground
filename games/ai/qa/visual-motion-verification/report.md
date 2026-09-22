# 四轮视觉与交互升级 · 全链路复核取证（v2.3.0-visual-motion）

> 复核运行：工坊主通道开发节点重跑（工作区 run-cmuc8gojg0022m956fclsig33）。
> 复核基线：**HEAD = df0c3c9 = origin/myrd/games-goal-cmtoavt8w0008m9y6kclb4s19 = v16 部署 commitHash**（三者一致）。
> 本报告所有数据均为复核运行**亲跑实测**，非转录前次运行的输出。

## 一、门禁复跑（与 CI 同源，判定脚本 = 仓库内 std-skills/godot-game-dev/scripts/）

| 步骤 | 命令 | 结果 |
|---|---|---|
| 引擎解析 | `resolve-godot.sh` | Godot 4.3.stable.official.77dcf97d8（/opt/homebrew/bin/godot） |
| 预检 | `preflight.py games/ai` | `PREFLIGHT: PASS 13 类前置一致性检查全部通过（257 个工程文件）`，退出码 0 |
| 冒烟 | `GODOT_SMOKE_FRAMES=240 smoke.sh games/ai` | `godot-smoke: PASS 冒烟场景通过（退出码 0，断言标记齐全，日志无脚本错误）`，退出码 0 |
| 场景终标记（直跑诊断） | `godot --headless … tests/smoke.tscn --quit-after 240` | `GODOT_SMOKE: PASS 契约五件 + 演算三链（独活/带走一个/清除）+ 行为十组（含移动端触摸与虚拟摇杆）全部通过` |

判定协议核验：退出码 0 且原始日志含 `GODOT_SMOKE: PASS`；smoke.sh 内部已扫 `SCRIPT ERROR / Parse Error` 为零。

## 二、四范围验收矩阵（需求 id=cmuc6ynmq001rm956r3szlnyd）

| 范围 | 实现落点 | 冒烟断言（阶段） | 结果 |
|---|---|---|---|
| ① PC 字体不溢出 | `main.gd fit_dialog_text` 排版自适应引擎；排版参数 `data/spec/ui.json`（字号上下限/面板宽高/行距内容化）；resize/横竖实时重排 | 阶段 15：3 档画布（640×360 / 1280×720 / 390×844）× DPR 1/2/3 × 选项显隐 = 18 组合最长剧情文本 fits；真实场景像素级断言：`panel.get_global_rect().encloses(dialog_text.get_global_rect())`（文字不出框）、字体渲染高 ≤ 文本框高（无裁字）、对话框与选项列 `intersection` 面积 = 0（不遮挡选项）、实际字号 == 适配字号 | PASS |
| ② 精灵品质 | 5 位女友 + 主角各 6 帧 SVG@2x（idle×2 / walk×4，共 36 帧，`tools/gen_sprites.py` 派生自人设卡 `portrait_prompt`）；人设卡 `art` 声明 `arena_idle`/`arena_walk`，缺字段回落 avatar/表情差分（换卡免改码） | 素材契约：立绘 1 + 头像 1 + 表情差分 ≥2 文件存在；玩法层占位 Polygon2D 残留 = 0 | PASS |
| ③ 移动平滑 | `numeric.json` 六键：`move_speed / move_accel / move_decel / turn_speed / walk_anim_fps / walk_frame_threshold` | 阶段 14：位移上限、起步加速/松杆减速、walk 帧随实际速度切换、转身 facing 每帧变化 ≤ `turn_speed×dt+ε` 无硬跳（含突变验证） | PASS |
| ④ UI 审美 | `ui.json` 三级配色（palette_primary/secondary/accent/calm）+ 面板出入场/选项浮现/按钮反馈/状态条补间/标题浮动/结局淡入动效参数 | 场景接线契约 + 全程到结局链路（动效随相位实跑） | PASS |

## 三、线上部署指纹（AppHost HostedApp 链路）

- deployment：`cmucc2c9q002dm956u5vk2axz`（version=16，status=running，mode=bundle）
- gitRef：`myrd/games-goal-cmtoavt8w0008m9y6kclb4s19` @ `df0c3c9adbaec57f36ac302aa4c4b0c151a435d3`
- liveUrl：https://leomac-studio.tail49399e.ts.net/apps/ai/
- `/health` → HTTP 200 `{"ok":true,"app":"ai-girlfriend-siege","game":"我被ai女友包围了","env":"development","assets":5,"version":"2.3.0-visual-motion"}`
- 可玩页 `/` → HTTP 200，含 `<canvas id="canvas">`；`index.js` content-type `text/javascript; charset=utf-8`
- **产物逐字节核对（线上 base64→gunzip ↔ 本地 git 内导出物）**：
  - `index.pck`：md5 `8c536022be96cc43fde3a9f4dcd77610`（4,470,544 B）— **MATCH**
  - `index.wasm`：md5 `af4a8fc2925d992348eb30deeeb54360`（35,376,909 B）— **MATCH**
- 架构注记：M1 文本网关下 `.wasm/.pck` 以 gzip+base64 内联、浏览器端 DecompressionStream 还原，
  故 `.wasm.gz.b64` 响应为 text/plain 属既定设计；游戏逻辑仍走 Godot 单线程 Web 导出（无 COOP/COEP 依赖）。

## 四、非阻断观察（warning，非 error）

1. headless 冒烟日志出现多条 `Target object freed before starting, aborting Tweener`：
   冒烟以每帧多步强制推进相位，UI 动效补间的目标面板在补间首帧前被释放所致；
   正常游玩节奏（动效时长 0.1–0.6s）不会出现。判定协议只拦 `SCRIPT ERROR / Parse Error`，门禁不受影响。
2. 退出时 `ObjectDB instances leaked` 警告：Godot 场景树退出顺序固有提示，同上不构成错误。
3. 排版引擎仍保留 `clip_contents` 兜底（fit 失败时裁切优先于出框），与「不裁字」主断言并存不冲突：
   fits 断言保证正常路径不触发兜底。

## 五、结论

四范围全部落地且断言在位；门禁双绿（preflight 13 类 + smoke 240 帧）；
线上 v16 与 HEAD 提交、仓库内导出物三方指纹一致；健康检查 200。
本节点验收状态：**PASS（可玩、可复验、可回滚）**。
