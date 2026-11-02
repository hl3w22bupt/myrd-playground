# 试玩验收包 —《植物人大战僵尸-网页版》（playtest_kit · 线上 v14 重验版）

> 本包只交付「怎么玩、看什么、怎么把感受变成数值」；**好不好玩的结论只能来自你的试玩**。
> 四问量表全部处于「待用户试玩」状态，本包不含任何代答。

- 生成：2026-11-02，run `cmvyp0n86006zm9y0ysizzt2t` / playtest 节点
- 试玩入口（liveUrl）：**https://leomac-studio.tail49399e.ts.net/apps/myrdplaygrou/**
- 调参工作台：**https://leomac-studio.tail49399e.ts.net/apps/myrdplaygrou/?tuning=1**
- 权威策划案：平台 GameDesignSpec **v6 approved = `cmvyol366005wm9y0kzkdz57d`**（2026-11-02T03:10:07Z，链上 v1–v5 已 superseded）。工程内无 `.myrd/spec/design-spec.json`，本包按 **spec v6（meta / levels / content）+ 工程实现说明** 对照写实。
- 建议设备：手机或浏览器移动模拟（390×844 触屏优先）；桌面键盘完全等价可用。

---

## 0. 你将要玩到的版本（版本锚点，先读这段再打分）

| 项 | 值 | 依据 |
|---|---|---|
| 线上版本 | **v14 = commit `26c7b62`** | 线上 `api/public/assets/index.pck` 经资产通道解压 5,605,248 bytes，sha256 `32d79ee289bd5184cb6cc57264ffa20df7ac32bbe159b42bfd11ba1153f3562a`（本节点 2026-11-02 12:3x +0800 独立复算，与 v14 收口提交 7a535ee 记录一致） |
| 本地分支 | `myrd/pvz-web-goal-cmvxjycvn001zm905jnwpyliv`，HEAD `6a9c7f1`（工程内容 = `aa326d2`） | 本地导出 `export/web/index.pck` sha256 `bd90d979…`（5,607,360 bytes）≠ 线上 → **两处已修复尚未上线**（见下） |
| 已知线上可见缺陷（已修未上线） | ① 第 2 关起顶部同功能按钮可能重复、旧挂件文案冻结（HUD 挂件整行重建缺陷，修复 `df378c9` 冒烟断言 19）；② 结算浮层弹出后 400ms 内的触屏连点可能直接跳过结算（修复 `df378c9` 冒烟断言 20） | 修复在本地 HEAD，部署被平台鉴权链问题阻塞（`qa/gate-logs/20261102-release-blocked-identity/SUMMARY.md`） |

> 打分量表③（观感/排版）与④（节奏）时，如撞到上面两条，请如实计入 —— 它们是真实线上表现，不是你的操作问题。
> 本地分支上这两处已修复且四门禁全绿；上线只差一次有属主权限的重新部署。

---

## 1. 30 秒上手（怎么玩）

一句话：**消耗阳光 → 点卡片选植物 → 点草坪布防 → 植物自动射击 → 别让僵尸走进左边的房子**。

| 步骤 | 触屏（优先） | 键盘（等价） |
|---|---|---|
| 选植物 | 点顶栏出战卡（费用标在卡上） | 数字键 `1-5` |
| 布防 | 点草坪任意格子 | `WASD/方向键` 移动光标 + `空格/回车` 放置 |
| 收阳光 | **点**场上阳光圆盘（判定半径 44px，停留 8s 后 2s 淡出，不收不罚） | 同左（鼠标点击） |
| 推进波次 | 点「下一波」按钮（想快就提前叫波） | 同左 |
| 静音 | 右上角常驻静音按钮（选关/对局/结算全程可点） | 同左 |

- 生命 5 点：僵尸头部越过防线（左侧房子）-1，归零失败。
- 阳光只有三个来源且都须**点按收集**：天降（默认 12s/25）、向日葵产出（默认 10s/25）、击杀掉落。
- 第 1 关有引导：首波前建成「向日葵 ≥1 + 射手 ≥1」，完成后提示自动淡出；开局操作提示 3 秒自动淡出（`hint_show_seconds=3.0`，不常驻）。
- 资源不自动入账是**设计**（spec `clickCollect`）：阳光要自己点，别干等。

## 2. 看什么（对照 spec v6 的 meta / levels / content）

### 2.1 关卡与机制地图（spec levels 段 ↔ 实现逐关对照）

| 关卡 | 机制看点（设计意图 → 你该感受到的差异化） | 起始阳光/波数 | 预计时长 |
|---|---|---|---|
| 1 前院晨光（教学） | 只有普僵、引导建 2 座布防；首个「能赢」的正反馈关 | 100 / 4 波 | ~132s |
| 2 后院黄昏（标准） | 疾跑僵尸登场（暗红束带、摆臂更急）；五张出战卡从第 1 关起全量可用（无逐关解锁），编制题靠阳光经济 | 150 / 6 波 | ~146s |
| 3 屋顶疾风（快速波次） | 波隔收紧到 12s、疾跑成群 —— 检验防线成型速度 | 150 / 7 波 | ~134s |
| 4 温室正午（阳光紧缩） | 天降节流 24s/15、**双发射手被移出战卡槽**（4 张卡）—— 资源规划压力 | 100 / 8 波 | ~164s |
| 5 后院深夜（夜幕迷雾） | 第 4 列起夜幕遮罩 + 剪影预显示（「有东西来了」但看不清种类） | 150 / 8 波 | ~161s |
| 6 屋顶风暴（混合高压） | 单波 ≥3 类混编；铁桶头开始成建制出现 | 200 / 9 波 | ~162s |
| 7 屋顶巨影（boss） | **坦克巨尸**（1.55× 体型、危险色巨锤）：接触植物即碾压、不进啃食循环 | 250 / 9 波 | ~161s |
| 8 终局夜幕（无尽压力） | 巨尸在第 7/10 波；通关后解锁**无尽模式** | 250 / 10 波 | ~169s |

- 单局时长设计带：**131.9–169.1 秒**（spec `difficulty.estimatedDurationSec`，全部落在用户拍板的 1-3 分钟内；`content.sessionSeconds=180`）。
- 难度曲线：hpScale 1.00→2.85、speedScale 1.00→1.42 逐关严格递增（spec `numeric.difficulty.curveRule`，机判见冒烟 `_check_level_table`）。
- 回环钩子（spec content.replayHooks）：星级（剩余生命 5/3/1 → ★3/2/1）、无尽模式（通关第 8 关解锁，强度 1.08^波 复合 + 巨尸混编）、速通计时、每日挑战（通关第 4 关解锁）、坦克猎人徽章。
- 五种僵尸识别件（style-card v3）：普僵无头饰 / 路障橙锥 / 铁桶深灰桶 / 疾跑暗红束带 + 前倾 / 巨尸 1.55× + 危险色巨锤。

### 2.2 音画契约（听什么、看什么）

- **音频解锁**：移动端首次点按后 BGM（≈55.4s 无缝循环）起播；首交互前静音是设计（spec `firstInteractionPolicy`）。机判证据：mobile-web-smoke `audio-unlock` PASS（`window.__audioDebug` 契约在位）。
- **音效 8 类绑定**（spec audio.sfxBindings）：射击/命中/僵尸倒地/放置/收集阳光/波次来袭（首波+末波）/通关/失败，工程内另补按钮、无效操作、防线受击、向日葵产出。
- **反馈三件套**：结果性事件（收集/命中/击杀/放置/波次/失败）应有 pop/flash/shake 之一 + 对应音效；收集有「+N」飘字。
- **扁平风格（style-card v3）核对点**：零渐变零写实；草坪低饱和深绿棋盘（#2B5436/#31603F）；前景主体 2px 深绿描边+投影；HUD 深底 #22313F 浅字 #ECF0F1、阳光数字 #F1C40F；四章节配色（晨绿/暮橙/正午暖黄/夜蓝）落在天空/檐口/提示条；字号三档（标题 32 / HUD 20 / 辅助 14）；可点按控件 ≥44×44px。

## 3. 结构化试玩量表（四问，逐条回填 —— 请勿合并作答）

> **状态：待用户试玩。** 以下只是「待回填的空表 + 打分参照」，不含任何预填结论。

```text
① 首分钟能否看懂目标与操作？
   回答：是 / 否
   卡点（若否，写在第几秒、卡在哪）：
   参照：开局 3s 内应看到操作提示；第 1 关有布防引导；阳光需点按收集是设计不是缺陷。

② 结束时想不想再来一局？
   打分：1 / 2 / 3 / 4 / 5（1=完全不想，5=立刻再来）
   原因：
   参照：可结合星级结算、下一关机制差异（§2.1 表）、无尽解锁是否构成「再开一局」的钩子。

③ 手感、反馈与观感（1-5 分，三个子项分开打）
   ③a 打击感/音效/画面响应（命中、击杀、收集、波次来袭的即时反馈）：__ /5
   ③b 风格统一（对照 .myrd/style-card.md v3：扁平零渐变、色板 #2ECC71/#3498DB/#F39C12 体系、
       四章节配色、僵尸头饰识别件、巨尸体型识别）：__ /5
   ③c 排版清晰（字号三档 32/20/14、HUD 深底浅字、顶栏无溢出/无重复挂件、控件 ≥44px）：
       __ /5
   备注（哪一秒、哪个元素偏离卡片或看不清）：
   参照：线上 v14 已知存在「同功能按钮重复 + 旧挂件文案冻结」与「结算 400ms 触屏连点可跳过」
   两个已修未上线缺陷（§0），撞到请在 ③c 或 ④ 如实计负分。

④ 节奏有没有明显断档或无聊段？
   回答：有 / 无
   若有：出现在第几秒、哪个关卡哪一波（例如「第 4 关第 3 波前后 20 秒只等阳光」）：
   参照：单关设计带 132–169s；波隔第 1 关最长 20s → 末两关最短 11s（逐关递减）；天降阳光默认 12s/发。
```

## 4. 调参工作台（把「不舒服」变成可回写数值）

- 入口：**https://leomac-studio.tail49399e.ts.net/apps/myrdplaygrou/?tuning=1**
- 打开后画面**右上角**出现调参面板：16 根滑杆 = `GameState.TUNING_META` 全键，拖动即时生效；
  点「复制调参 URL」得到带 `?tuning=<JSON>` 的链接，**把它发回来就是一次完整的调参结果**
  （解析 → 与现值 diff → 经 `POST /api/v1/game-design-specs/:id/revisions` 写入 spec.numeric 新版本 → approve 拍板；不改代码默认值，spec 是唯一事实源）。
- 只认下表 16 键；URL 里出现未声明键会被忽略并在 diff 说明中标注；数值按 min/max 钳制。

| 键 | 现值 | 范围 [min, max] / step | 对应 spec.numeric |
|---|---|---|---|
| projectile_damage | 20.0 | 5–60 / 1 | combat.pea.damage |
| projectile_speed | 480.0 | 120–900 / 20 | combat.pea.speedPxPerSec |
| fire_interval | 1.5 | 0.15–3 / 0.05 | plants.*.fireIntervalSec（repeater ×0.5） |
| bite_interval | 1.0 | 0.4–3 / 0.1 | combat.bite.intervalSec |
| bite_damage | 30.0 | 10–90 / 5 | combat.bite.damagePerBite |
| freeze_duration | 2.0 | 0.5–5 / 0.5 | combat.freeze.durationSec |
| freeze_factor | 0.6 | 0.2–0.95 / 0.05 | combat.freeze.speedFactor |
| sky_drop_interval | 12.0 | 4–24 / 1 | economy.skyDrop.intervalSec |
| sky_drop_yield | 25.0 | 5–60 / 5 | economy.skyDrop.yield |
| sunflower_interval | 10.0 | 1–20 / 1 | economy.sunflower.intervalSec |
| sunflower_yield | 25.0 | 5–60 / 5 | economy.sunflower.yield |
| sun_expire_sec | 8.0 | 3–15 / 1 | clickCollect.expireSec |
| sun_fade_sec | 2.0 | 0.5–4 / 0.5 | clickCollect.fadeOutSec |
| sun_tap_radius | 44.0 | 24–80 / 4 | clickCollect.hitRadiusPx |
| cursor_move_speed | 520.0 | 120–900 / 20 | 键盘布防光标速度（工程校准项） |
| hint_show_seconds | 3.0 | 0.5–6 / 0.5 | 开局操作提示停留时长 |

（不在滑杆面板的固定项：生命 5、网格 9×5、波次/难度倍率逐关锚定 spec —— 这些动 spec 才动，调参 URL 不覆盖。）

## 5. 本包机判底座（判定器全部来自仓库内 std-skills/godot-game-dev/scripts/，未自写未改写）

| 门禁 | 结论 | 证据 |
|---|---|---|
| preHook `mobile-web-smoke`（降级口径，未带 --project） | **PASS**（joystick-target 仅 warn 取证） | `qa/gate-logs/20261102-playtest-v14-rerun/prehook-report-legacy.json`（checkedAt 2026-11-02T04:23:52Z，verdict=PASS，fps=38） |
| 本节点复跑 `mobile-web-smoke --project`（完全口径） | **MOBILE_SMOKE: PASS 11/11**（joystick 按工程无虚拟摇杆裁撤；fps=39、tapDiff=5、console 零 error、视口无溢出、音频解锁契约在位） | `qa/mobile/report.json`（checkedAt 2026-11-02T04:34:51Z）+ phase-load/tap/joystick.png |
| 本地四门禁 `bash games/myrdplaygrou/verify.sh`（HEAD 6a9c7f1） | **verify exit=0**：PREFLIGHT 15 类 / GODOT_SMOKE（240 帧）/ GODOT_FUZZ（seed=20260913）/ GODOT_PLAYTEST 3 局 ×900 帧（fb=227/245/248，最长无反馈窗 ≤0.38s） | `qa/gate-logs/20261102-playtest-v14-rerun/verify-full.log` |
| 线上一致性 | 线上 pck sha256 `32d79ee2…` = v14（26c7b62）；本地 HEAD 导出 `bd90d979…` 尚未上线 | 本节点 2026-11-02 12:3x 独立复算（§0） |

> 结论口径：以上全部是**机器判定**（能不能跑、移动端能不能玩、节奏代理指标在阈值内）。
> 「好不好玩 / 想不想再来」只能来自你的试玩 —— 量表未回填前，本游戏验收状态 = 「自动化达成、试玩待回填」。

## 6. 结果怎么交回来

1. 把 §3 四问量表按原样逐条回填（别合并）；
2. 若调了参：把「复制调参 URL」得到的 `?tuning=<JSON>` 链接一并交回；
3. 收到后：解析 diff → spec revisions 新版本（带溯源）→ approve 拍板 → 回写 `op=tuning_applied` 产物 → 下一轮工作流按新 spec 重部署。
