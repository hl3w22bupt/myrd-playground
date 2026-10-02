# 《牛牛打游戏》game-8 · 试玩验收包（v2 手感调优轮）

> **节点状态：blocked（硬约束触发）**——门禁五件套缺 `playtest.sh`，试玩验收的机判判定器不可得。
> 本验收包（试玩指引 / 量表 / 调参工作台入口）照常产出供用户试玩；**四问量表全部「待用户试玩」，任何结论只能来自用户回填**。
>
> - 目标：`cmujpml1e006rm99i9hc33huu` · 托管应用：`cmujpmjsy006pm99ip9yws3wl`（slug: game-8）
> - 分支：`myrd/games-goal-cmujpml1e006rm99i9hc33huu`（部署 gitRef，未落 main）
> - liveUrl：`https://leomac-studio.tail49399e.ts.net/apps/game-8/`（v2 部署 v4，commit `1089e4b`，/health=200）
> - 设计唯一来源：策划案 v1 知识文档（doc `80b9c193-6807-43e4-b2b0-5789f2d9e35b`）。**工程内无 `.myrd/spec/design-spec.json`**，故本文按策划案 §〇~§五 + 实现说明编写。
> - 上位需求：v2 手感调优 `cmuqmej89000ym9gg6mom93o0`（体型 1.3~1.5x、移速 60~70%）

## 〇、阻塞上报（运维认领后解除）

| 门禁资产（仓库内权威路径） | 状态 |
|---|---|
| `std-skills/godot-game-dev/scripts/preflight.py` | ✓ 在位 |
| `std-skills/godot-game-dev/scripts/smoke.sh` | ✓ 在位 |
| `std-skills/godot-game-dev/scripts/input-fuzz.sh` | ✓ 在位 |
| `std-skills/godot-game-dev/scripts/resolve-godot.sh` | ✓ 在位 |
| `std-skills/godot-game-dev/scripts/playtest.sh` | **✗ 缺失（阻塞源）** |
| `.myrd/routines.yaml`（id=godot-smoke，4 步） | ✓ 在位 |
| `std-skills/godot-game-dev/references/godot-smoke-routine.md` | ✓ 在位 |

- **阻塞 detail**：模板仓库未预置门禁脚本：`std-skills/godot-game-dev/scripts/playtest.sh`；请运维把模板仓库补上技能资产。
- 已登记缺陷：bug `cmuktchmy000km97z6kj3r2ro`（Bug1 / D2 依赖）。平台注入目录 `.myrd-platform/.claude/skills/godot-game-dev/scripts/playtest.sh` 只是**阅读副本**，按硬纪律不得作判定来源、不得据此自造等价脚本。
- 解除条件：模板仓库出现 `playtest.sh` 且与 `verify.sh`「只调用仓库内脚本、不自实现检查逻辑」协议兼容；随后工程侧重跑 playtest 节点，按策划案 §六契约测试点逐条核对。
- 对照参考：同一知识体系 v6 已记录「工坊形态门禁四步全绿（resolve/preflight/smoke/input-fuzz）」与「playtest 判定器 blocked」并存的先例；本轮 v2 门禁四步实测全绿（preflight 13 类全过、GODOT_SMOKE: PASS 240 帧、GODOT_FUZZ: PASS），**缺的只是 playtest 判定器，不是游戏实现缺陷**。

## 一、试玩指引（怎么玩、看什么）

### 1.1 入口与加载
- 打开 <https://leomac-studio.tail49399e.ts.net/apps/game-8/>（建议 Chrome/Safari 最新版；iOS 请真机 Safari 实测，桌面模拟不能顶替）。
- 看什么：加载 ≤3 秒、无白屏/闪退/控制台未捕获异常（验收标准第 1 条）；首次点击/触摸后应有声音解锁手势（壳页含音频手势解锁器）。

### 1.2 怎么玩（一局 60 秒闭环）
1. **目标**：限时 60 秒内收集 20 个青草垛即通关（`TARGET_SCORE=20` / `TIME_LIMIT=60`）。
2. **操作**：PC 用 WASD 或方向键 8 向移动；移动端触摸拖动虚拟摇杆。
3. **收集**：牛牛碰到青草垛 → 物品当帧消失、计数 +1、UI 同帧刷新；**过期消失的物品不计分**（错过不算数）。
4. **节奏**：刷间隔 0.8s→0.45s、物品寿命 6s→3s 随已收集数线性收紧——越接近 20 个越紧张，这是设计预期，不是 bug。
5. **结算**：达标判「通关」、限时归零未达标判「未达成」；结算面板显示本局收集数 ÷ 目标与历史最高分（刷新高亮「新纪录」）。
6. **重开**：结算面板按钮或键盘 R 一键重开，立即开下一局（分数归零、计时重置 60s、刷点避开出生点 ≥96px）。
7. **存档**：退出页面重进，历史最高分 / 累计收集 / 累计局数应完整保留。

### 1.3 本轮（v2）重点观察项 —— 手感调优是否到位
| 观察点 | v2 现值 | 怎么判 |
|---|---|---|
| 体型 | `PLAYER_SCALE=1.4`（v1=1.0，需求区间 1.3~1.5） | 牛牛是否「一眼找到自己」；放大后有无「贴脸即收」的越界判定感 |
| 移速 | `PLAYER_SPEED=145`（v1=220 的 65.9%，需求区间 60~70%） | 追物品是否跟得上、转向是否拖沓；方向是否不反向（A/← 左移、D/→ 右移） |
| 判定一致性 | 判定距离 36px 不变 | 连续收集 50 次抽查：计数与 UI 是否 100% 一致、无误判/漏判 |

### 1.4 契约核对表（试玩时可顺手核对，机判版见策划案 §六）
- [ ] 计分正确：触碰才 +1，UI 与实际一致，过期/静置不加分
- [ ] 拾取生效：物品当帧消失，36px 判定无「贴脸白捡」
- [ ] 胜负触发：达标即停表判通关；归零未达标判未达成；重开双入口（按钮 + R）
- [ ] 单局闭环：进入→收集→结算→重开→二局立即可玩，全程无阻断
- [ ] 持久化：重进后档案数据不丢

## 二、结构化试玩量表（四问逐条回填，未回填一律「待用户试玩」）

> **状态：待用户试玩。** 以下四问必须由真实试玩者逐条作答；agent 不得代答、不得合并、不得推测。

| # | 问题 | 回填格式 | 状态 |
|---|---|---|---|
| ① | 首分钟能否看懂目标与操作？ | 是 / 否 + 卡点（哪个界面/哪一步没看懂） | 待用户试玩 |
| ② | 结束时想不想再来一局？ | 1-5 分 + 原因（1=完全不想，5=立刻再来） | 待用户试玩 |
| ③ | 手感与反馈（打击感/音效/画面响应）？ | 1-5 分 + 分项说明（收集反馈/移动跟手/音效有无） | 待用户试玩 |
| ④ | 节奏有没有明显断档或无聊段？ | 有 / 无 + 出现在第几秒（例：第 35~50 秒刷太密追不上） | 待用户试玩 |

已知实锤缺陷（供试玩时留意，不代下结论）：v5 门禁经验记录过 game-8「零音效」——若本轮仍无音效，请在第 ③ 问中如实扣分并注明。

## 三、调参工作台入口（把「不好玩」变成数值）

- **入口**：<https://leomac-studio.tail49399e.ts.net/apps/game-8/?tuning=1> —— 打开后画面右上角出现调参面板。
- **用法**：拖滑杆即时改数值（立即生效，改时限会重置本局剩余时间）→ 点「复制调参 URL」得到带 `?tuning=<JSON>` 的链接 → **把链接发回来就是一次完整的调参结果**。
- **只认以下 9 个声明键**（`games/game-8/autoload/game_state.gd` `TUNING_META`；未声明键一律忽略并在 diff 说明中标注）：

| 键 | 现值（v2） | 范围 | 步长 | v1 回滚口径 |
|---|---|---|---|---|
| TARGET_SCORE | 20 | 5~60 | 1 | 20 |
| TIME_LIMIT | 60 | 15~180 | 5 | 60 |
| MAX_COLLECTIBLES | 6 | 1~20 | 1 | 6 |
| SPAWN_INTERVAL_START | 0.8 | 0.3~3.0 | 0.05 | 0.8 |
| SPAWN_INTERVAL_MIN | 0.45 | 0.2~2.0 | 0.05 | 0.45 |
| LIFETIME_START | 6.0 | 2.0~15.0 | 0.5 | 6.0 |
| LIFETIME_MIN | 3.0 | 1.0~10.0 | 0.5 | 3.0 |
| **PLAYER_SCALE** | **1.4** | 0.5~2.0 | 0.05 | 1.0 |
| **PLAYER_SPEED** | **145** | 60~300 | 5 | 220 |

## 四、试玩结果回写路径（收到结果才执行，严禁编造）

1. 收到用户的**四问量表结论** + **调参 URL** → 解析 `?tuning=` 中 JSON，与上表现值 diff（未声明键忽略并标注）。
2. 数值经 `POST /api/v1/game-design-specs/:id/revisions` 写进 spec.numeric（新版本，带 sourceTrajectoryId 溯源）→ `POST /api/v1/game-design-specs/:id/approve` 拍板。
3. 拍板结论 + 数值 diff 回写目标 artifacts（追加 `op=tuning_applied` 产物）；**下一轮工作流按新 spec 重部署**，不在本节点散点改代码默认值（spec 才是唯一事实源；策划案 v1 明令「禁止散点改代码对数值」）。
4. 未收到用户结果 → 量表保持「待用户试玩」，第 1~3 步整体跳过。
