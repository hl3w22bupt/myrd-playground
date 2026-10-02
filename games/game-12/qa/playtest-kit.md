# game-12 试玩验收包（playtest kit）

> 生成：试玩验收节点（run `cmur94roe001micbsbs788hga`，2026-10-03）
> 目标：`cmur8pnhn000kicbsvl0eoqx6` · AppHost `cmur8pm9j000iicbsmd25q04l`（slug `game-12`）
> 分支：`myrd/games-goal-cmur8pnhn000kicbsvl0eoqx6` · liveUrl：https://leomac-studio.tail49399e.ts.net/apps/game-12/
> 工程内无 `.myrd/spec/design-spec.json`，且平台侧该目标无 approved 版策划案（`GET /game-design-specs/approved` 404）——本指引按**实现说明**（`games/game-12/README.md` + `scripts/main.gd` 实读）编写。

---

## 一、试玩指引（怎么玩、看什么）

**入口**：浏览器（手机或桌面）打开 https://leomac-studio.tail49399e.ts.net/apps/game-12/ ，等加载条走完（约 2-5 秒，首次较慢）。

**目标**：把计数从 0 点到 **10** 即胜利。本游戏按需求为极简计数页，**没有失败态**。

**操作**（两条等价路径）：

| 环境 | 计数 | 重开 | 移动指针方块（脚手架保留，不影响计数） |
|---|---|---|---|
| 桌面 | 点中央「+1」大按钮 / 按 `空格` 或 `回车` | 点「重开」/ 按 `R` | `WASD` / 方向键 |
| 移动 | 点中央「+1」大按钮 或 右下角圆形触摸确认钮 | 点「重开」 | 左下角虚拟摇杆 |

**看什么（反馈对照表 —— 每次操作都应该能对上一行）**：

| 你做了什么 | 应该看到 | 说明 |
|---|---|---|
| 有效点击（距上次 >300ms） | 数字 +1，数字弹跳放大一下 | 计数生效 |
| 300ms 内快速连点 | 按钮**闪红** + 状态栏提示「连点已拦截（防重窗口 300ms，还需 Nms）」，数字不变 | 连点防重生效，多余点击被吃掉 |
| 拦截后等约 300ms 再点 | 数字在原基础上 +1，无跳变 | 防重窗口恢复正常累加 |
| 计到 10 | 状态栏「胜利！连点达标 10 次，点「重开」再来一局」，数字闪金色，「+1」按钮变灰不可点 | 胜利反馈 + 入口封禁 |
| 点「重开」/按 `R` / 刷新页面 | 数字归 0、状态回进行中、按钮恢复可点 | 重置无残留 |

**建议试玩路径（约 3 分钟，正好覆盖下面四问）**：
1. **第 1 分钟**：什么都不看提示，直接上手点 —— 检验「不看说明能不能看懂」（回答①）。
2. **第 2 分钟**：刻意测试防重 —— 手指快速连点 5 次，看是否只 +1、按钮是否闪红、提示是否说清还差多少毫秒；窗口结束再正常点几下，看有没有跳变或重复计数。
3. **第 3 分钟**：点到 10 拿一次胜利，看胜利反馈；然后重开，问自己「想不想马上再来一局」（回答②），并留意手感（③）与哪一段觉得无聊/等待（④）。
4. 移动端额外确认：375 宽竖屏下无横向滚动条；「+1」按钮和右下确认钮都好按（触控目标 ≥44×44px，实机按钮 560×240 / 半径 44 逻辑像素）。

---

## 二、结构化试玩量表（四问，逐条作答）

> **状态：待用户试玩（待回填）。** 试玩结论只能来自人，本包不代填、不给任何「好玩/通过」结论。

| # | 问题 | 作答格式 | 你的回答 |
|---|---|---|---|
| ① | 首分钟能否看懂目标与操作？ | 是 / 否 + 卡在哪一步（例：「不知道点哪里」「不知道 10 是什么意思」） | 待回填 |
| ② | 结束时想不想再来一局？ | 1-5 分 + 原因（1 = 完全不想，5 = 立刻重开） | 待回填 |
| ③ | 手感与反馈？ | 1-5 分（打击感 / 音效 / 画面响应，可拆开打）+ 一句话 | 待回填 |
| ④ | 节奏有没有明显断档或无聊段？ | 有 / 无 + 出现在第几秒（例：「点第 6-10 下时手酸且没新鲜感」） | 待回填 |

**回填方式**：直接把四条结论回复在目标对话/频道里即可；若附带调参 URL（见下节），会一并走数值回写。

---

## 三、调参工作台

**入口**：https://leomac-studio.tail49399e.ts.net/apps/game-12/?tuning=1

**当前能力（如实，不夸大）**：

- ✅ **调参桥已部署**：壳页在引擎加载前把 `?tuning=<urlencoded JSON>` 解析进 `window.__GAME_TUNING__`（§3C 硬契约，部署节点已校验）。
- ❌ **本构建未声明 `TUNING_META`（调参键集为空）**：本游戏把两个数值钉成了常量 —— `GameState.TARGET_COUNT = 10`（胜利目标）、`GameState.DEBOUNCE_MS = 300`（防重窗口），后者是需求的**验收项本身**（约 300ms）。
- ❌ **`?tuning=1` 不会出现调参面板**：面板由游戏侧 `scripts/tuning_panel.gd` 按 `TUNING_META` 生成；本构建未实现该脚本，因此打开入口后**正常进入游戏、无浮层面板**。
- ⚠️ 因此当前**任何 `?tuning=<JSON>` 键都会被忽略**（安全 no-op，不影响启动）。若收到带键的调参 URL，diff 时会把全部键标为「未声明键，未生效」。

**要开放浏览器内调参，需要下一轮做**（本节点不改代码默认值，spec 才是唯一事实源）：
1. 策划案 `spec.numeric` 声明键（如 `target_count`、`debounce_ms`，含 min/max/step —— 防重窗口若开放，需同时改验收口径）；
2. 实现节点给 `game_state.gd` 加变量 + `TUNING_META` + `apply_tuning()`，移植 `tuning_panel.gd`，补冒烟断言（`TUNING_META` 非空 / 应用已声明键 / 拒绝未声明键 / 超限钳制）；
3. 重导出 + 重部署 + 重跑 `mobile-web-smoke`。

**调参回写协议（收到用户调参 URL 才执行，严禁编造）**：解析 `?tuning=` JSON → 与现值 diff（未声明键标注忽略）→ `POST /api/v1/game-design-specs/:id/revisions` 写进 `spec.numeric`（新版本 + `sourceTrajectoryId` 溯源）→ `POST /:id/approve` 拍板 → 追加 `op=tuning_applied` 产物 → 下一轮按新 spec 重部署。

---

## 四、门禁证据（本节点实测，非转抄）

| 门禁 | 命令（判定脚本全部来自仓库 `std-skills/godot-game-dev/scripts/`） | 结果 |
|---|---|---|
| godot-availability | `bash std-skills/godot-game-dev/scripts/resolve-godot.sh` | exit 0（Godot 在 PATH） |
| preflight | `python3 std-skills/godot-game-dev/scripts/preflight.py games/game-12` | exit 0 · `PREFLIGHT: PASS`（13 类 / 44 文件） |
| headless-smoke | `GODOT_SMOKE_FRAMES=240 … smoke.sh games/game-12` | exit 0 · `godot-smoke: PASS` |
| input-fuzz | `… input-fuzz.sh games/game-12` | exit 0 · `GODOT_FUZZ: PASS`（seed=20260913，6 批 / 239 帧） |
| mobile-web-smoke | `node … mobile-web-smoke.mjs --url <liveUrl> --out games/game-12/qa/mobile` | exit 0 · `MOBILE_SMOKE: PASS` **10/10** |

移动端证据：`games/game-12/qa/mobile/report.json` + `phase-load.png` / `phase-tap.png` / `phase-joystick.png`
（390×844 iPhone 仿真；网络全通 / console 零错 / canvas / 非纯色首帧 / 画面在动 / 触摸到达 / 触摸响应 / `__audioDebug` 契约 / 无横向溢出 scrollWidth=390 / FPS 39）。

### 已知缺口（如实上报，不含糊）

1. **机器人试玩门禁未接入**：`std-skills/godot-game-dev/scripts/playtest.sh` 未随模板仓库预置
   （同目录现有 `gate-selftest.sh / input-fuzz.sh / input_fuzz_driver.gd / mobile-web-smoke.mjs /
   mobile_smoke_selftest.mjs / preflight.py / preflight_selftest.py / resolve-godot.sh / smoke.sh`）。
   判定器只能来自仓库，**不得自写等价脚本**，因此本包没有任何机器人试玩结论，也未引用注入目录
   `.myrd-platform/.claude/skills/godot-game-dev/scripts/playtest.sh`（阅读副本）。
   不阻塞两条门禁：`.myrd/routines.yaml` 的 `godot-smoke` / `mobile-web-smoke` 均不引用 `playtest.sh`，
   且目标验收标准第 2 条要求的脚本集（5 个）全部在位。**请运维补模板仓库技能资产。**
2. **调参面板未随本构建实现**：见第三节 —— `TUNING_META` 未声明，`?tuning=1` 现为安全 no-op。
3. **真机抽查未做**（目标验收第 6 条，可选不阻塞）：本环境建不上 iOS 会话（safari:useSimulator 能力不兼容）；
   移动端可玩性以模拟门禁机判为准，真机试玩留给用户顺带完成，发现问题走迭代回流。
