# 《Soccer》目标与验收对照（goal cmtx73f9v0005m9zbikqyadww）

> 一句话玩法：实现一个 11 人足球游戏，需要有真实小人以及跑步的动作，能切换不同的球员。

## 验收标准 → 冒烟断言映射（tests/smoke.gd）

| 编号 | 验收标准（无头可判定项） | 冒烟断言 |
|---|---|---|
| A1 | 工程可直接运行主场景，加载球场、两队各 11 名球员与足球，控制台无脚本报错 | 静态接线断言（Main / 22 名 Footballer / Ball / HUD / 结算面板）+ smoke.sh PASS 分支零 SCRIPT ERROR |
| A2 | 键盘完成移动、带球、传球、射门与球员切换，游戏内有可见操作说明 | 注入 move_right 后受控球员真实位移 ≥20px 且 moved 信号到达；注入 pass 后球离脚并被拿走；注入 shoot 后进球；HUD HelpLabel 常驻键位说明；十一动作键位契约逐键核对 |
| A3 | 一场比赛完整跑通：计时结束显示最终比分，进球实时更新并重新开球，模拟时长可配置 | 注入 shoot 进球后断言 score_changed 到达且 phase 回 KICKOFF；时钟拨过全场终点后断言 match_finished + FINISHED + 终场结算文案 + 结算面板（比分 + 胜/平/负 + 重开提示）；注入 L 断言 match_real_seconds() 与 HUD 设置行随三档时长切换（`MATCH_LENGTH_OPTIONS`） |
| A4 | 规则事件正确：边线出界判界外球、底线判角球/球门球，由相应方恢复比赛 | 球抛出边线断言 phase=RESTART + 「界外球」文案 + 球被放回边线；守方最后触球出底线断言「角球」（负例探针实测：分支写反时本断言 FAIL）；攻方最后触球出底线断言「球门球」 |
| A5 | AI 正常攻防（跑位/推进/传球/射门、门将扑救），整场无卡死失控 | 可无头判定代理项：240 帧无头运行零脚本报错、自由球必被拿走（capture 断言）、传球后闭环、AI 数值按难度梯度取值（`DIFFICULTY_*` 表）。跑位/扑救为行为表现，留待人工试玩校准 |
| A6 | 重开入口 | 注入 restart 后断言比分清零、计时清零、球回中圈、phase 回 KICKOFF、结算面板收起 |
| A7 | 难度有梯度（核心循环可反复玩） | 注入 C 连切断言 GameState.difficulty / HUD 设置行 / 客队 AI 移速系数同步变化，回切「普通」后按默认梯度继续跑行为断言 |

## v2 迭代验收 → 冒烟断言映射（需求 cmtxva7ce000cm9birar86be2：音效 + 触摸）

| 编号 | 验收标准（无头可判定项） | 冒烟断言 |
|---|---|---|
| B1 | 音频系统首次交互前不发声不报错（Web 自动播放策略），交互后解锁 | AudioManager 初始 `unlocked=false`（静态断言）；借进球重开冻结窗注入 M 键 → `unlocked=true`；全程零音频报错（smoke PASS 分支扫零 SCRIPT ERROR） |
| B2 | 踢球/传球/抢断/哨声/进球事件各触发对应音效，进球与欢呼分层 | 全部事件驱动：开球后 `whistle_kickoff≥1`、传球闭环后 `pass≥1`、射门进球后 `kick≥1`+`goal≥1`+`crowd_cheer≥1`（分层叠加）、确定性贴身抢断后 `steal≥1`、终场后 `whistle_fulltime≥1`；半场哨无自然时间点，走 API 级断言。负例探针实测：移除 play_steal 触发后冒烟 FAIL（exit 1），还原复绿 |
| B3 | 静音开关立即生效 | M 键一按 `muted=true`（主总线静音）再按恢复（mute_changed 先后两次到达冒烟记录器）；HUD MuteButton 接线存在（P8 机判） |
| B4 | 触屏虚拟摇杆可控移动、幅度调速 | 传球窗口内按住摇杆右拖（ScreenTouch+ScreenDrag 注入，坐标经 final_transform 变换模拟 OS 层事件）→ `joystick_vector.x≥0.5` 且传球者真实位移 ≥10px |
| B5 | 射门/传球/切换按钮与键盘动作一致 | 触摸按在按钮圆内注入 InputEventAction 与键盘同路径：射门按钮直接驱动「射门→进球」全链断言、切换按钮在进球等待窗内换受控球员、传球按钮驱动传球闭环 |
| B6 | 多点触控：摇杆与按钮同时按压无事件丢失 | 双指（index 5 摇杆 + index 8 传球按钮）同时按压，摇杆驱动位移与传球踢球同时发生 |
| B7 | 触屏控件自动显示/桌面隐藏 | headless（无触屏）默认 `visible=false`（静态断言）；`force_visible` 可显式开启（冒烟即用此路径，亦为「设置中手动开启」入口）；控件布局均在 HUD 文本带之外 |

v2 非无头判定项（人工试玩清单，不冒充已验收）：音色/音量平衡（`autoload/audio_manager.gd`
调参区 `*_VOLUME_DB`）；摇杆手感（基座半径/拖动跟随）；真机浏览器自动播放策略实测
（headless 无法模拟 AudioContext 挂起，DevTools 触摸模拟 + 真机各验一轮）。

## v2.1 修复验收 → 冒烟断言映射（需求 cmty5jely000cm9cyvtcd86jq：移动端 Web 无声）

| 编号 | 验收标准（无头可判定项） | 冒烟断言 / 实现落点 |
|---|---|---|
| C1 | 解锁前有可见「开启音效」指引，解锁后隐藏（移动端无声时玩家知道原因） | 静态断言：HUD `UnlockHint` 接线存在且 `unlocked=false` 时可见；行为断言：M 键解锁后提示隐藏（`unlocked_changed` 订阅闭环，寄生 OOB 冻结窗，零额外帧） |
| C2 | GDScript 解锁联动真实 AudioContext resume | F3：`unlock_audio()` 末尾在 web 平台经 `JavaScriptBridge.eval` 调壳页 `window.__soccerUnlock`（`OS.has_feature("web")` 门控，headless 零影响）；落地 `autoload/audio_manager.gd` |

壳页（`server/src/shell-page.ts`）F1/F2 不入 Godot 门禁，由 `npx tsc --noEmit`（server/）+ 部署后
WebKit 实测把关：F1 手势解锁器（AudioContext 包装捕获 + document 级
touchstart/touchend/pointerdown/keydown/click capture+passive 同步 `resume()`，覆盖
suspended 与 WebKit interrupted，附 visibilitychange 恢复提示与 `window.__soccerAudioDebug()`
取证出口）；F2 worklet 弃 Blob URL 改资产通道真实 URL + Blob 降级重试 + 失败显式
`console.error`（Godot 对该 promise 无 catch，position worklet 门控全部 WAV 起播）。
AudioContext 挂起/interrupted 无法在 headless 模拟 —— 真机与 WebKit 自动化按
`qa/MOBILE_AUDIO_ROOT_CAUSE.md` §四.验证方案执行。F5 明确不做项（不转码音频格式、
不动导出预设/隔离头、不动触摸层）见取证报告。

## v3 迭代验收 → 冒烟断言映射（需求 cmtz8v2yz000om93dungmq5yw：结算「再来一局」触摸按钮）

| 编号 | 验收标准（无头可判定项） | 冒烟断言 |
|---|---|---|
| D1 | 终场/结算画面提供触摸可点「再来一局」按钮，触达区域 ≥ 44x44，不遮挡比分/结果文字 | 静态断言：`Main.result_controls` 接线存在、进行中默认隐藏；终场断言：按钮可见、`button_size()` 两维 ≥44、按钮矩形与结算面板矩形不相交、ResultHint 含「再来一局」入口提示 |
| D2 | 点击按钮立即开新局：比分归零、计时重置、回开球状态，效果与键盘重开一致 | 鼠标点击（InputEventMouseButton）与触摸点击（InputEventScreenTouch）各驱动一轮完整重开断言：比分清零、phase 回 KICKOFF、球回中圈、计时清零、结算面板与按钮收起 —— 与键盘 R 重开共用同一 `restart` 动作路径 |
| D3 | 鼠标与触摸走同一入口；键盘快捷键（R / Enter / 空格）全部保留 | `ResultControls` 是 InputMap 生产者：命中即注入 `InputEventAction(&"restart")`，与键盘 R 同一条 `Main._unhandled_input` 路径；键位契约断言（restart→R、confirm→Enter/Space）零改动照旧核对 |
| D4 | 按钮仅终场结算出现/可交互，不干扰比赛进行中触摸控件 | 隐藏态探针：重开回 PLAYING 后点原按钮位置（鼠标 + 触摸双注入），断言不触发重开（phase 保持 PLAYING、计时不清零）；比赛进行中按钮 `visible=false` 静态断言 |

负例探针实测（断言有效性两头验证）：① `_press_at` 置空（按钮失灵）→ 冒烟 FAIL
`鼠标点击「再来一局」未触发重开`（exit 1）；② 删除 `if not visible` 门卫（可见性纪律失效）→
冒烟 FAIL `隐藏态点击原按钮位置触发了重开`（exit 1）。还原后复绿 PASS（208/240 帧）。

## 非无头判定项（人工试玩清单，不冒充已验收）

- 跑步动画步频/摆幅的手感（`scripts/footballer.gd` 调参区 `RUN_CYCLE_RATE` / `RUN_SWING`）。
- AI 攻防节奏、射门/传球倾向的平衡性（`scripts/main.gd` 数值调参区 + `game_state.gd` 梯度表）。
- 三档难度的体感差距是否合适（客队移速/上抢/扑救反应的手感校准）。
- 门将扑救反应的合理范围（`GK_CHASE_RANGE` / 站位跟随系数）。

## 门禁

```bash
bash games/soccer/verify.sh   # preflight(13 类) + smoke(240 帧无头断言)
```

判定来源（不得改写）：`std-skills/godot-game-dev/scripts/{preflight.py,smoke.sh,resolve-godot.sh}`。
