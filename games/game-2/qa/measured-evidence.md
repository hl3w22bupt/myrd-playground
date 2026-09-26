# 《星尘收集者》当前环境实测记录（可实测项证据）

配套：真机清单 `ios-checklist.md`（待真机执行）、试玩回填 `real-device-pending.md`。
本文件只收录**当前工作区与线上环境真正跑过/查过**的项，并如实标注证据等级；
桌面结论不冒充真机 —— 真机项一律写「待验」，见 `real-device-pending.md`。

实测时间：2026-09-27 00:49-00:57（+0800）；执行环境：本工作区（macOS，Godot 4.3.stable.official.77dcf97d8）。

## 证据等级定义

| 等级 | 含义 |
|---|---|
| `measured` | 本环境实跑命令 / 实际请求线上得到的原始输出 |
| `static-audit` | 对代码/配置的静态审查结论（读了代码，没运行真机） |
| `pending-real-device` | 只能在真机上得出结论的项 —— 本文件不给出结论 |

## 0. 结论速览

| 项 | 等级 | 结论 |
|---|---|---|
| 门禁（preflight/冒烟/fuzz） | measured | 三段全 PASS（含新增 F 段调参 URL 契约），见 §4 |
| 线上部署版本与调参面板 | measured | 线上 v7 部署含调参面板（pck 内 `tuning_panel.gd` ×5）；**仓库内 export/web 产物滞后于线上**，见 §1 |
| COOP/COEP 导出配置 vs 线上响应头 | measured | 单线程导出不需要跨源隔离头，线上实测也无 —— 配置与部署自洽，见 §2 |
| 触控代码路径（摇杆/确认钮/显示条件） | static-audit | 代码链路完整可复核，见 §3 |
| 调参 URL 回填闭环 | measured + fix | **曾断裂**（URL 只开面板、数值无人消费），已修复并由冒烟 F 段机判，见 §4.3 |
| 游戏内音效节点 | measured（grep） | **当前无任何 SFX 节点** —— 音频验收项按降级口径执行，见 §5 |
| 摇杆手感/手势解锁音频/安全区/真机帧率 | pending-real-device | 待真机，见 `ios-checklist.md` A-E 与 `real-device-pending.md` |

## 1. 构建与部署版本（measured）

| 事实 | 值 | 证据 |
|---|---|---|
| 工作区分支 | `myrd/game-2-goal-cmuiepudc001zm9gyyzqgztta` | `git branch --show-current` |
| 实测基线 commit | `be92732`（后续修复落在 `2c95a68`） | `git log --oneline` |
| 线上 App | 星尘收集者，slug `game-2`，status `ready`，**version 7**，更新于 2026-09-26T16:28:40Z（= +0800 00:28，晚于 be92732 23:45） | 平台 API `/api/v1/apps` |
| 线上健康 | `{"ok":true,"app":"star-dust-collector","env":"development","assets":"lazy/object-storage"}` | `GET /apps/game-2/gw/health`，HTTP 200 |
| 线上 pck | 2,521,520 字节，md5 `e772b98e046c1dd593650c2e78edaf18`，内含 `tuning_panel.gd` 引用 **5 处** | 下载 `api/public/assets/index.pck.gz.b64` → base64 → gunzip → `strings \| grep` |
| 仓库内 export/web pck | 2,497,600 字节，md5 `e2e1697e9f0a197faa0dfd3d7c6507a5`，`tuning_panel.gd` **0 处** | 同法探测本地文件 |

**差异解读（重要）**：线上 pck 与仓库内产物不同，且**线上含调参面板、仓库产物不含** —— 平台部署时从源码重建了导出产物，
而仓库里 `games/game-2/export/web/` 停留在更早构建（文件 mtime 23:14 早于 tuning_panel.gd 23:19）。
处置：仓库产物仅作参考快照，真机验收一律以**线上 v7** 为准；后续工程提交若包含新玩法代码，
建议同步重导出 `export/web` 或在提交说明里注明「产物由部署管线重建」。

## 2. 导出配置与 COOP/COEP（measured）

- `export_presets.cfg`（preset "Web"）：`variant/thread_support=false`、
  `progressive_web_app/ensure_cross_origin_isolation_headers=false`、`script_export_mode=2`（压缩二进制脚本）。
- 线上实测响应头（`curl -D -`）：
  - 落地页 `GET /apps/game-2/gw/`（跟随 308）→ `HTTP/2 200`，`content-type: text/html; charset=UTF-8`；
  - 资产 `GET /apps/game-2/gw/api/public/assets/index.pck` → `HTTP/2 200`，
    `cache-control: public, max-age=300`，`content-type: text/plain; charset=utf-8`（base64 文本通道）。
  - **两个响应均无 `Cross-Origin-Opener-Policy` / `Cross-Origin-Embedder-Policy`。**

**结论（static-audit 基于 measured 事实）**：当前是**单线程** Godot Web 导出，不依赖 SharedArrayBuffer，
**不需要也不依赖 COOP/COEP**；线上无这两个头与导出配置自洽，不构成缺陷。
红线：若未来打开 `thread_support=true`（换多线程模板），则**必须**同时给页面与资产响应加
`COOP: same-origin` + `COEP: require-corp`，否则 WASM 线程版在浏览器直接启动失败 —— 已列入工程回填检查项。

## 3. 触控代码路径（static-audit，真机手感另测）

| 链路 | 代码事实（文件:行为） |
|---|---|
| 摇杆显示 | `scripts/main.gd` `_ready()`：`DisplayServer.is_touchscreen_available()` ⇒ `$TouchUI.visible = true`，提示文案切「摇杆移动」；桌面隐藏 TouchUI |
| 摇杆输入 | `scripts/virtual_joystick.gd`：`_unhandled_input` 收 `InputEventScreenTouch/Drag`（滑出控件矩形不丢轨迹）；按下须落在控件矩形内才接管（`_touch_index` 独占）；死区 `DEADZONE_RATIO=0.25`；半径钳制 `BASE_RADIUS=56`；向量分解为 4 方向 `InputEventAction`（带 strength）经 `Input.parse_input_event` 注入 |
| 游戏侧消费 | `scripts/player.gd` 只读 `Input.get_vector(...)` 动作 —— 触控与键盘同一条移动通路 |
| 确认按钮 | `scripts/touch_confirm_button.gd`：`TouchScreenButton` + 圆形热区 r=44 → `pressed` 信号注入 `confirm` 动作；`TouchScreenButton` 在无触摸屏设备自动不响应（桌面不干扰） |
| 结算重开 | `scenes/main.tscn` `RestartButton`（普通 Button，GUI 触摸路径）→ `_on_restart_pressed`；与 confirm 动作等效 |
| 布局锚点 | `scenes/main.tscn` `TouchUI`（layer 10）：摇杆锚左下 offset (24,-160)-(160,-24)；确认钮锚右下 (-140,-140)-(-24,-24)，圆心距右/底 82 逻辑像素 |
| 防误触 | `server/src/game-page.ts`：`body { touch-action: none }` + `user-scalable=no` 视口 |

冒烟覆盖面声明：`tests/smoke.gd` 只注入 `InputEventScreenTouch/Drag` **噪声帧**验证鲁棒性，
headless 无触摸屏 ⇒ **不**验证摇杆控件可见性与真实拖动手感 —— 这部分只能真机（见 ios-checklist A 段）。

## 4. 门禁实测输出（measured）

### 4.1 命令与环境

```
$ bash games/game-2/verify.sh        # 只调用 std-skills/godot-game-dev/scripts/ 判定脚本
GODOT_BIN=godot                       # godot 4.3.stable.official.77dcf97d8（resolve-godot.sh 解析）
```

### 4.2 修复前基线（HEAD=be92732）与修复后（含 2c95a68）均为三段全 PASS：

```
PREFLIGHT: PASS 13 类前置一致性检查全部通过（50 个工程文件，不含 .godot/ 导入缓存）
godot-smoke: PASS 冒烟场景通过：tests/smoke.tscn（退出码 0，断言标记齐全，日志无脚本错误）   # 240 帧预算
GODOT_FUZZ: PASS seed=20260913 batches=6 total_frames=239
godot-fuzz: PASS 输入鲁棒性 fuzz 通过（退出码 0，日志无脚本错误）
verify.sh：全部门禁通过 ✅   （两次实测退出码均 0）
```

### 4.3 本轮修复：调参 URL 回填闭环断裂（measured 发现 → 已修 + 机判）

**缺陷**：调参面板「复制调参链接」生成 `?tuning=1&key=value…`，但打开该链接时游戏侧只有
`?tuning=1` 开面板的逻辑（`_should_open_from_url`），`key=value` **无任何消费代码**；
壳页注释声称的 `GameConfig.apply_tuning_bridge()` 并不存在 ⇒ 试玩调好的数值无法用 URL 复现，回填闭环断裂。

**修复**（2c95a68）：`scripts/tuning_panel.gd` 新增静态纯函数 `parse_tuning_query(search)`
（只认 TUNABLE_KEYS、钳制 KEY_RANGES 量程、吸附步长、忽略未知/非数值键）+ `apply_parsed_tuning`
（int/float 收敛、数量键触发重铺、同步行 UI）；URL 打开时先应用数值再构建滑杆。
`tests/smoke.gd` 新增 **F 段断言**（headless 机判）：`score_target=99` 钳到 60、`0.123` 吸附到 0.10、
`bogus=7`/`max_asteroids=abc` 忽略、float 写 int 键收敛为 int —— 修复后冒烟 PASS（见 4.2）。
`server/src/game-page.ts` 注释同步对齐实际消费者。

## 5. 音频现状（measured，grep 全量）

`grep -rni "audio|sound|AudioStream" games/game-2/{scripts,scenes,project.godot}` → **0 命中**：
游戏内当前没有任何 SFX / AudioStreamPlayer 节点（需求里的「音效反馈」尚未实现，只有飘字 + 震屏）。
壳页侧手势解锁器已就位（`server/src/game-page.ts`：AudioContext 构造器包裹 + 五类手势同步 resume +
`window.__audioDebug()` 取证口），Godot 引擎自身的 audio worklet 由壳页改写加载路径。
因此真机音频验收按 `ios-checklist.md` C 段的**降级口径**执行（AudioContext running + 无报错），
**加音效后必须复测 C4 听感项**。

## 6. 不冒充声明

本文件不含任何真机结论。摇杆触控手感、首手势解锁、安全区/横屏、真机帧率四类问题只能在
`real-device` 等级得出结论 —— 全部待验，入口见 `real-device-pending.md`。
