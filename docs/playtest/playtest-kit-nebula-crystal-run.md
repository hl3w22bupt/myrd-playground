# 试玩验收包 · 星云飞船收集（nebula-crystal-run）

> 目标：`cmujp7b1d005lm99ixrbqj7tz` ｜ AppHost：`cmujp79aj005jm99ix8wvjmeu`（slug: app）
> 本包由 playtest 节点产出。「好不好玩」的判定权在试玩人（你），agent 不代答。

## 0. 入口

| 入口 | URL | 用途 |
|---|---|---|
| 正常游玩 | https://leomac-studio.tail49399e.ts.net/apps/app/ | 直接开玩 |
| **调参工作台** | https://leomac-studio.tail49399e.ts.net/apps/app/?tuning=1 | 右上角浮出调参面板，拖滑杆即时改数值 |

- 部署：gitRef=`myrd/games-goal-cmujp7b1d005lm99ixrbqj7tz`（本游戏功能分支，绝不部署 main）。
- 移动端：触摸可用时自动显示左下虚拟摇杆 + 右下确认按钮；建议手机浏览器也开一遍。

## 1. 试玩指引：怎么玩、看什么

（工程内无 `.myrd/spec/design-spec.json`、平台无 approved 策划案，本节按实现 + 知识基准
`85f04063-8cf2-40f7-84f6-3b57e7ed9a6c`〈玩法设计基准〉口径撰写。）

### 怎么玩
- **移动**：`A/D` 或 `←/→` 横移，`W/S` 微调（横移速度 300px/s）；触屏拖左下摇杆。
- **目标**：在流动星云中穿行，躲开彩色陨石，收集青色能量水晶。
- **陨石三色**（颜色即语义）：红=普通直线漂移；蓝=高速直穿；黄=远端分裂成 2 子体。
- **收集与加速**：每颗水晶 +10 分（加速态 2x=20 分）；4 秒内连收 5 颗触发**加速态**——
  速度 +35%、得分 2x、屏周拉丝 + 105% 变焦 + 环形倒计时；加速态内每再收 1 颗 +2 秒（上限 15 秒）。
- **护盾制**：3 格；撞陨石 −1 并清空连击，1 秒无敌闪烁；归零即结算。
- **结算页**：得分 / 水晶数 / 存活时长 / 历史最高分 + 一键重开（回车确认或点按钮）。
- **难度**：每 30 秒升 1 档（封顶 6 档），只作用于陨石的速度与密度，飞船基础速度恒定 100px/s。

### 看什么（对照基准的关键体验点）
1. 前 30 秒：不看说明能否明白「躲红蓝黄、收青色」？
2. 第一次触发加速态（5 连击）时：提速感与 ×2 反馈是否明确？
3. 连续收集的节奏：水晶是否总在「够得着」的范围，有没有长时间空窗？
4. 被撞后的惩罚感：护盾 UI 与无敌闪烁是否清楚？
5. 6 档难度（3 分钟后）是否开始感到压迫但仍可躲？

## 2. 结构化试玩量表（逐条打分/勾选，请勿合并作答）

> 状态：**待用户试玩**（未回填。试玩结论只能来自用户，agent 不得代填。）

| # | 问题 | 作答格式 | 你的回答 |
|---|---|---|---|
| ① | **首分钟能否看懂目标与操作** | 是 / 否 + 卡点（哪一步不明白） | ☐ 待回填 |
| ② | **结束时想不想再来一局** | 1–5 分 + 原因 | ☐ 待回填 |
| ③ | **手感与反馈**（打击感 / 音效 / 画面响应） | 1–5 分（可分三项各打） | ☐ 待回填 |
| ④ | **节奏有没有明显断档或无聊段** | 有 / 无 + 出现在第几秒 | ☐ 待回填 |

回填方式：把四条回答直接发回给 agent（频道/工单均可），有调参 URL 一并附上。

## 3. 调参工作台（把「不好玩」变成可直接回写的数值）

1. 打开 `?tuning=1` 入口，画面右上角出现面板：每行一个可调键（滑杆 + 当前值），**拖动即时生效**，不用重开局。
2. 调到满意后点 **「复制调参 URL」**，得到形如 `…?tuning=<JSON>` 的链接；
3. 把该链接发回来 = 一次完整调参结果。agent 会解析 JSON 与现值 diff，经策划案 `revisions` API 写入 `spec.numeric`（带溯源）→ `approve` 拍板 → 下一轮按新 spec 重部署。**不要直接改代码默认值——spec 是唯一事实源。**
4. 面板只认下表 29 个声明键（`GameState.TUNING_META`）；URL 里未声明的键会被忽略并在 diff 说明中标注。

### 可调键与当前默认值（min ~ max）

| 键 | 默认 | 范围 | 说明 |
|---|---|---|---|
| speed.base | 100 | 40~400 | 基础前进速度 px/s |
| speed.boostMul | 1.35 | 1.0~3.0 | 加速态速度倍率 |
| speed.easeOutSec | 1.5 | 0~5 | 加速退出缓动秒数 |
| combo.windowSec | 4.0 | 1~10 | 连击窗口秒数 |
| combo.trigger | 5 | 2~20 | 触发加速的连击数 |
| boost.durationSec | 8.0 | 1~30 | 加速初始时长 |
| boost.extendSec | 2.0 | 0~10 | 加速态内每颗水晶续时 |
| boost.capSec | 15.0 | 1~60 | 加速总时长上限 |
| boost.scoreMultiplier | 2 | 1~10 | 加速态得分倍率 |
| score.crystal | 10 | 1~100 | 单颗水晶分值 |
| shield.max | 3 | 1~9 | 护盾格数 |
| shield.invincibleSec | 1.0 | 0~5 | 受击无敌时长 |
| meteor.spawnIntervalBase | 2.0 | 0.3~10 | 陨石基础生成间隔秒 |
| meteor.spawnDecay | 0.88 | 0.5~1.0 | 每档生成间隔系数 |
| meteor.spawnJitter | 0.2 | 0~0.5 | 生成间隔抖动幅度 |
| meteor.capBase | 3 | 1~20 | 同屏上限基数 |
| meteor.capStep | 2 | 0~10 | 每档上限增量 |
| meteor.boostCapAdd | 2 | 0~10 | 加速态上限修正 |
| meteor.boostIntervalMul | 0.85 | 0.3~1.0 | 加速态间隔修正 |
| difficulty.stepSec | 30 | 5~120 | 每档秒数 |
| difficulty.max | 6 | 1~20 | 档位封顶 |
| crystal.intervalSec | 1.1 | 0.2~5 | 水晶生成间隔秒 |
| crystal.jitterSec | 0.4 | 0~2 | 水晶间隔抖动 |
| crystal.maxOnScreen | 4 | 1~20 | 水晶同屏上限 |
| crystal.minOnScreen | 1 | 0~10 | 水晶同屏保底 |
| crystal.forceSpawnAfterSec | 3.0 | 0.5~15 | 无水晶强制刷新秒数 |
| player.lateralSpeed | 300 | 50~900 | 横移速度 px/s |
| spawn.avoidShipBand | 80 | 0~300 | 生成避开飞船判定带 px |
| spawn.minGapRadiusMul | 1.5 | 1~4 | 实体生成间距系数 |

## 4. 机器门禁记录（robot 侧事实，与人工量表互补、不替代）

| 门禁 | 结果 |
|---|---|
| preflight（仓库内 std-skills 脚本） | PASS（13 类检查，57 文件） |
| smoke（GODOT_SMOKE_FRAMES=240，同 routines.yaml 口径） | PASS（退出码 0，断言标记齐全，无脚本错误） |
| input-fuzz | PASS（seed=20260913，6 批次 239 帧） |
| playtest（机器人 3 局 × 900 帧） | PASS（节奏代理指标在阈值内；明细见 GODOT_PLAYTEST_METRICS） |

> 机器人门禁只判「好玩的下限」，不判「好不好玩」——后者见第 2 节量表，等你回填。

## 5. 回填后会发生什么

1. agent 解析你的调参 URL 与现值 diff（未声明键标注忽略）；
2. 数值经 `POST /api/v1/game-design-specs/:id/revisions` 写入 spec.numeric（新版本 + sourceTrajectoryId 溯源）→ `approve` 拍板；
3. artifacts 追加 `op=tuning_applied` 产物（拍板结论 + 数值 diff）；
4. 下一轮工作流按新 spec 重部署，公网版本随之更新。
