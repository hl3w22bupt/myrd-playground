# 《光路谜阵》试玩验收包（Playtest Kit）

> 试玩入口：<https://leomac-studio.tail49399e.ts.net/apps/game-4/gw>
> 量表状态：**待用户试玩（未回填）** —— 本包只交付指引与量表，不预设任何试玩结论；
> 结论只能来自试玩者回填（见 §五）。工程内对应关卡数据源：`scripts/levels.gd`（10 关）。

## 一、试玩指引（怎么玩、看什么）

### 玩什么

光束折射解谜：点击旋转管道块，把光束从**光源**一路接到**终点接收器**即过关；
步数越少星级越高；首发 10 关渐难（5×5 → 7×6，最优解 1 步 → 10+ 步）。

### 怎么操作

| 操作 | 桌面 | 触屏 |
|---|---|---|
| 光标移动 | `WASD` / 方向键 | 左下摇杆 |
| 旋转管道（顺时针 90°） | 点击格子，或光标对准后 `空格`/`回车` | 右下「旋转」按钮 |
| 撤销 | `Z` | 「撤销」按钮 |
| 重开本关 | `R` | 「重开」按钮 |
| 选关（仅已解锁） | `Q` / `E` | — |
| 下一关 | 通关后 `空格`/`回车` | 通关后按钮 |

### 看什么（观察点，与实现规则一一对应）

1. **目标可读**：进第 1 关 60 秒内能否看懂「把光接到接收器」。
2. **旋转即时反馈**：每次旋转后光束实时重算预览，无肉眼可见延迟。
3. **不穿透实体**：光束撞墙体即中断，绝不穿透（第 3 关起有墙）。
4. **分光三通**（第 5 关起）：一路进、两路出，两路都要接上接收器。
5. **星级结算**：3 星 = 最优解步数；2 星 = ≤⌈最优 × 1.5⌉；1 星 = 通关；
   星级与每关最少步数纪录只升不降（本地存档 `user://guanglu_save.cfg`）。
6. **解锁推进**：通关第 n 关才解锁第 n+1 关，未解锁的关进不去。
7. **撤销/重开**：撤销同时回退朝向与步数，通关后撤销被屏蔽；重开立即恢复初始。

## 二、结构化试玩量表（四问，逐条独立回填，不许合并）

> 回填方式：在 `[ ]` 里填 `x`、在 `___` 处写一句；每问独立作答。

### ① 首分钟能否看懂目标与操作？

- `[ ]` 能　`[ ]` 否
- 卡点（若「否」）：______（例：不知道要点哪 / 不知道光要接到哪 / 星级规则看不懂）
- 卡点出现时间：第 ___ 秒

### ② 结束时想不想再来一局？

- 1 ─ 2 ─ 3 ─ 4 ─ 5（1 = 完全不想，5 = 非常想）得分：___
- 原因：______

### ③ 手感与反馈（每维 1-5 分）

| 维度 | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| 旋转手感（点击 → 管件转动） |  |  |  |  |  |
| 光束点亮反馈（视觉） |  |  |  |  |  |
| 音效 |  |  |  |  |  |
| 画面响应（帧率/卡顿） |  |  |  |  |  |

### ④ 节奏有没有明显断档或无聊段？

- `[ ]` 无　`[ ]` 有
- 若「有」：第 ___ 关 / 第 ___ 秒，表现：______（例：重复点击太多 / 等待过长 / 难度陡增）

## 三、调参工作台入口

- 约定入口：`<liveUrl>?tuning=1` → <https://leomac-studio.tail49399e.ts.net/apps/game-4/gw?tuning=1>
- **当前状态：暂不可用（如实标注，不带病交付）**。调参面板依赖平台技能包的
  `GameState.TUNING_META` 调参协议（SKILL.md §3C），该协议资产与
  `std-skills/godot-game-dev/scripts/playtest.sh` 同属模板仓库未预置内容；
  仓库内（含其它游戏工程）均未实现，打开上述链接不会出现调参面板。
- 残余缺口与补救路径（二选一）：① 平台侧给技能包补 TUNING_META 协议资产；
  ② 后续节点按该契约为 game-4 实现面板（`?tuning=1` 打开右上角滑杆面板 + 「复制调参 URL」）。
- 当前用户回填通道：直接把 §二 四问答案发回目标会话即可；面板可用后，
  回填带 `?tuning=<JSON>` 的链接将自动走 spec.numeric revisions（见 §五）。

## 四、门禁与来源说明（为什么没有 GODOT_PLAYTEST）

| 项 | 判定 | 证据 |
|---|---|---|
| `std-skills/godot-game-dev/scripts/playtest.sh` 仓库自带？ | **否（模板未预置）** | `git ls-files` 全仓无 playtest 文件（含全历史）；`std-skills/godot-game-dev/scripts/` 实有 gate-selftest.sh / input-fuzz.sh / input_fuzz_driver.gd / preflight.py / preflight_selftest.py / resolve-godot.sh / smoke.sh |
| GODOT_PLAYTEST 补跑？ | **无法补跑（blocked 维持）** | 判定脚本只能来自仓库 `std-skills/`（硬纪律：不由 agent 现场编写、不用平台注入副本 `.myrd-platform/.claude/skills/godot-game-dev/scripts/playtest.sh` 替代） |
| playtest.sh 是否本目标必需门禁？ | 否 | `.myrd/routines.yaml` godot-smoke 四步（resolve/preflight/smoke/fuzz）不引用它；`games/game-4/verify.sh` 不调用它；AC#2 门禁清单 {preflight.py, smoke.sh, input-fuzz.sh, resolve-godot.sh} 不含它；仓库版 SKILL.md 无 playtest 章节 |
| 本工程可跑门禁（复跑实证） | **全绿** | `bash games/game-4/verify.sh` → 退出码 0：`PREFLIGHT: PASS`（13 类 38 文件）/ `GODOT_SMOKE: PASS`（240 帧）/ `GODOT_FUZZ: PASS`（seed=20260913） |

结论：playtest.sh 缺失属**模板仓库资产缺口**（需运维补模板），不阻塞试玩验收包本身交付；
试玩验收包按本文件 + 目标 artifacts 回写交付，GODOT_PLAYTEST 维持 blocked 并如实上报。

## 五、结论回填与 spec 调参（收到结果才做）

1. 用户回填 §二 量表 → 结论回写目标 artifacts（`op=playtest_result`），不改动工程代码。
2. 用户回填调参 URL（面板可用后）→ 解析 `?tuning=` 的 JSON 与现值 diff →
   `POST /api/v1/game-design-specs/:id/revisions` 写 `spec.numeric` → `approve` 拍板 →
   artifacts 追加 `op=tuning_applied` → 下一轮按新 spec 重部署。
3. 纪律：**严禁**在未收到用户结果时伪造「好玩 / 通过」类结论；未回填一律标「待用户试玩」。
