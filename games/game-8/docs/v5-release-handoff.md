# 《牛牛打游戏》game-8 · v5 线上可玩性修复轮 发布交接

> **修复日期**：2026-10-14 ｜ **分支**：`myrd/game-8-goal-cmujpml1e006rm99i9hc33huu` @ `db8b9ce`
> **需求绑定**：v5 修复轮（需求 cmv7skg01000km9tiuig8nyjx）× v4 独立验收 REJECT（`docs/v4-acceptance-report.md`）
> **本文定位**：四缺陷根因/修复/证据落账 + **部署就绪状态**（部署卡点见 §五，一键部署命令见 §六）。

## 一、四缺陷根因与修复（全部实锤，非猜测）

### A（致命）可收集物零刷出 —— 根因：Web 导出下 `static var` packed array 数据丢失

- **现象**：线上三局全程五类收集物像素零命中；headless 门禁（节点数/位置/计分断言）全绿。
- **取证**（CDP 真机仿真 + 引擎内探针）：物品节点在树、`is_visible_in_tree()=true`、颜色/动画正常，但
  `visual.polygon` 读出 **`[(0,0) × n]` 全零坐标**；`static var KIND_POLYGONS` 直读同样全零。
- **根因**：**Godot 4.3 Web 导出（script_export_mode=2 bytecode）下，GDScript `static var` 持有的
  `PackedVector2Array` 字面量初始化数据整体丢失**——size 保留、坐标全 (0,0)，Polygon2D 画成
  退化多边形 = 视觉消失。v3 引入 static var 造型表起生效，与「v2 线上物品可见（`docs/evidence/v2-live/`）、
  v3/v4 不可见」时间线吻合。渲染二分实验：纯代码 Polygon2D 可见、摘脚本实例可见、
  带脚本实例不可见 → 锁定脚本内 static var 路径。
- **修复**：`KIND_POLYGONS` static var → `static func kind_polygon(kind)`（函数内字面量构造）。
- **验证**：本地壳链路五类色像素命中峰值 **1272**（修复前恒 0）。

### B（致命）移动全失效 —— 根因：摇杆触摸处理写错事件阶段（平台无关的代码 bug）

- **取证**：`InputEventScreenTouch(pressed)` 被挂载时**引擎 100% 收到**（探针 `_input` 计数递增、
  坐标换算正确），但摇杆 `_touch_index` 恒 -1；同时 `Input.parse_input_event(InputEventAction)`
  注入直测**完全生效**（牛牛被推到边界）。
- **根因**：**Godot 4 的 Viewport 在 GUI 阶段按位置把 ScreenTouch 消费给命中的 Control**（摇杆自己是
  Control），转成模拟鼠标进 `_gui_input`——写在 `_unhandled_input` 的分支**永远收不到「按下」**。
  headless 门禁用 `Input.actionPress` 引擎级注入，此路径从未被覆盖（v4 验收 §五.4 盲区）。
- **修复**：`virtual_joystick.gd` 处理上移到 `_input`（接管后 `set_input_as_handled` 阻断 GUI 误消费）+
  判定区外扩 40px（原热区在移动视口仅 ≈74 CSS px，边缘 3px 即脱靶——这也是验收/门禁 swipe 起点失效的次因）。
- **勘误（对 v4 验收报告）**：**键盘 WASD 在 Web 上一直有效**（本次线上实测 D 键长按位移 118px、方向正确）；
  v4 §三.B「桌面键盘 W×6/D×6 连按零位移」系连按口径下物理帧采样不到 pressed 的测量伪影。
  真实缺陷只有摇杆一条路径。
- **验证**：本地壳链路摇杆拖动牛牛位移 **172px**（修复前 0）。

### C（严重）结算面板文字与按钮重叠 —— 根因：结论行无自动换行溢出 label 区

- **根因**：结论行 ≈28 字 × 24px 在 528px 宽内不换行，`Label` 默认不裁剪 → 画出 104px 高的结论区
  压在「一键重开」按钮上。
- **修复**：`autowrap_mode = AUTOWRAP_WORD_SMART` + 字号 20；结论(16..134)/新纪录(138..172)/
  按钮(180..244) 三段重排互不重叠，面板加高至 320px。

### D（中等）触屏 UI 泄漏桌面 —— 根因：触屏判定单一（is_touchscreen_available）

- **根因**：开了触摸能力的桌面视口（如 CDP 仿真/触屏笔记本）也会显示摇杆/确认；「确认」与壳页底部
  提示条同屏重叠。
- **修复**：显示条件改为 `is_touchscreen_available() AND pointer:coarse`（Web 下 `matchMedia` 精确判定
  设备形态）；桌面键盘环境完全不可见，重叠随之消除（playtest kit §1.2 口径）。

## 二、产物与门禁证据（全绿）

| # | 项 | 结果 | 证据 |
|---|---|---|---|
| 1 | preflight（仓库判定脚本） | PASS | 15 类 × 1014 文件 |
| 2 | smoke @320 帧 | PASS | exit 0 + `GODOT_SMOKE: PASS` + 零 SCRIPT ERROR |
| 3 | input-fuzz | PASS | seed=20260913，6 批 239 帧 |
| 4 | playtest @3600 帧 | PASS | 3 局 fb=185/222/213（阈值内） |
| 5 | 产物自跑冒烟 | PASS | `--main-pack export/web/index.pck --quit-after 320 res://tests/smoke.tscn` → `GODOT_SMOKE: PASS` 全断言 |
| 6 | 产物规模 | 2,612,896 B | `exclude_filter="qa/*, docs/*"`（v5 起 qa 证据不入产物；tests/ 保留供自跑冒烟） |
| 7 | 本地壳链路可玩性三项 | **PASS** | `tools/playability-probe.mjs` @ 壳页模拟：P1=1272 命中 / P2=118px / P3=172px |
| 8 | 线上 v4 现状对照 | FAIL（P1=5 / P3=0px） | `qa/pre-deploy-live/playability.json`——坐实「线上必须换 v5 包」 |

## 三、门禁盲区闭合（v4 验收 §五.4 建议的落地）

新增工程侧观测探针 `games/game-8/tools/playability-probe.mjs`（**不改动任何仓库判定脚本**）：

- **P1**（对 A）：开局 10s 内五类收集物特征色像素检测 ≥200 命中；
- **P2**（对 B-键盘）：真实 CDP 键盘长按，牛牛像素质心位移 >30px；
- **P3**（对 B-摇杆）：真实 CDP 触屏摇杆拖动，牛牛像素质心位移 >30px；
- 口径：CDP `Input.dispatchKeyEvent/dispatchTouchEvent` 真实事件驱动 + 截图像素检测
  （v4 验收同款方法脚本化），**非引擎级 `Input.actionPress` 注入**；
- 产出 `qa/mobile/playability.json`，与 mobile-web-smoke 的 `report.json` 构成双证。

## 四、部署前状态

- 分支已推送：`db8b9ce`（玩法修复 + 产物重导出 + 探针 + 本交接）。
- 线上现状：仍是 v4 包（pck sha256 `7738850a…`，不可玩）；`qa/pre-deploy-live/` 为部署前基线证据。
- 部署后核对：线上 pck sha256 应 = 本地 `2a27c8b86d8220d9c5332d29e2cfb9032bda22d1998183f98bc4c04424a17f63`
  （2,612,896 B）；随后跑 mobile-web-smoke（判定脚本）+ playability-probe（工程探针）双验。

## 五、⚠️ 部署卡点（blocked，需有权限方执行）

本节点无 AppHost 部署凭据（沿用 v3/v4 已知约束）：`POST /api/v1/apphost/apps/cmujpmjsy006pm99ip9yws3wl/deployments`
要求「应用所有者（`cmuimu6w…`）或系统管理员」，本执行环境无 `MYRD_TOKEN`、无平台登录凭据、
无内部免鉴权通道（本地网关实测 401）。**未绕过、未自造判定、未直改平台库。**

## 六、一键部署（有权限身份执行后，本工作流恢复复验与回写）

```bash
# ① 干跑验证权限（403 则需换 app owner / admin 身份）
curl -s -X POST -H "Authorization: Bearer $MYRD_TOKEN" -H "Content-Type: application/json" \
  "http://localhost:3111/api/v1/apphost/apps/cmujpmjsy006pm99ip9yws3wl/deployments" \
  -d '{"mode":"bundle","dryRun":true,"deployedBy":"agent","gitRef":"myrd/game-8-goal-cmujpml1e006rm99i9hc33huu","sourceId":"cmujpml1e006rm99i9hc33huu","goalId":"cmujpml1e006rm99i9hc33huu"}'
# ② 正式部署：同体去掉 "dryRun":true（gitRef 红线：功能分支，绝不落 main）
# ③ 部署受理后自动复验链：
node std-skills/godot-game-dev/scripts/mobile-web-smoke.mjs --url "https://leomac-studio.tail49399e.ts.net/apps/game-8/" --out games/game-8/qa/mobile
node games/game-8/tools/playability-probe.mjs --url "https://leomac-studio.tail49399e.ts.net/apps/game-8/" --out games/game-8/qa/mobile
```

复验通过（mobile-web-smoke PASS + playability 三项 PASS + 线上 pck sha256 对齐）即回写
HostedApp `cmujpmjsy006pm99ip9yws3wl` / deployment id（部署响应返回）/ liveUrl
`https://leomac-studio.tail49399e.ts.net/apps/game-8/` 三要素到 goal artifacts。
