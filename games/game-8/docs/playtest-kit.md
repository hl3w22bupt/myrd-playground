# 《牛牛打游戏》game-8 · 试玩验收包 v5（playtest 节点交付物）

> **定位**：把「好不好玩」的判定交还给人。本文是 v5 轮 playtest 节点的试玩验收包全文——试玩指引、结构化量表、调参工作台入口与结果回写协议。**量表结论只能来自用户**：未回填即如实标「待用户试玩」，任何人不许代填或伪造。
> **绑定**：v5 线上可玩性修复轮（需求 `cmv7skg01000km9tiuig8nyjx`）× v4 独立验收 REJECT（`docs/v4-acceptance-report.md`）× 策划案 v3 approved（GameDesignSpec `cmv7i4txk000zjofi5vrdcrvk`）。
> **权威基准**：风格卡 `games/game-8/.myrd/style-card.md`（扁平明快 #3498db/#2ecc71/#f39c12，触屏优先，竖屏，1-3 分钟/局，平缓大众，BGM+音效齐备；参考图：无）。
> **工程内无 `.myrd/spec/design-spec.json`** → 指引按实现说明（`games/game-8/autoload/game_state.gd` 数值区 + `scripts/main.gd`）与 approved 策划案口径编写（与 v4 版口径一致）。

> ## ⏸ 试玩暂不可开始（部署解阻后本包即生效）
> **2026-10-14 本节点实测：线上仍是 v4 不可玩包**——线上 `index.pck` 3,210,752 B，sha256 `7738850a…5d8502`，与 v4 部署锚点记录**逐字节一致**（v5 预期 2,613,856 B / `3ca34b43…`）。v5 修复（四缺陷 A/B/C/D）已在分支 HEAD 就绪且本地门禁全绿，但部署被平台授权身份错位 blocked（部署 API 403 第三次复现）。**此时把用户引到线上试玩 = 让人试玩一个已知零刷出、移动失效的版本**，故本轮不发起试玩；部署解阻路径与一键命令见 `docs/v5-release-handoff.md` §五/§六 与 `docs/v5-playtest-blocked-report.md`。**部署完成后**，按 §一 指引试玩、按 §二 回填量表、按 §三 调参。

## 〇、前置机判与线上实况（2026-10-14，试玩验收节点实测，全部一手）

### 0.1 硬约束核查（不触发模板资产 blocked）

| 项 | 结果 |
|---|---|
| 门禁判定脚本 | 七件套全部在仓库 `std-skills/godot-game-dev/scripts/`：preflight.py / smoke.sh / input-fuzz.sh / playtest.sh / resolve-godot.sh / mobile-web-smoke.mjs（+ gate-selftest.sh 等自测件）。判定只认仓库内路径，未用注入目录当判定来源，未改写仓库内脚本 |
| 门禁配置 | `.myrd/routines.yaml` 含 `id=godot-smoke`（5 步：availability/preflight/headless-smoke@320 帧/input-fuzz/playtest@3600 帧）与 `id=mobile-web-smoke`（liveUrl 必传参数） |
| references 参数化模板 | `std-skills/godot-game-dev/references/{godot-smoke-routine.md, mobile-smoke-routine.md}` 两份在位 |

### 0.2 本轮 preHook（mobile-web-smoke）核对 —— PASS 属实，但有适用边界

- 证据 `games/game-8/qa/mobile/report.json`：**verdict=PASS**，checkedAt 2026-10-14T09:43:07Z，10 项 pass + 1 warn；metrics：15 种量化色、idleDiff=400、fps=36、视口无溢出（390/390）、音频解锁器在位、console 零 error。部分 check 的 `detail` 带失败提示文案（低于良好阈值但高于失败阈值的提示语），判定以 status/verdict 为准——与 v4 轮注记同口径。
- **warn 如实注记**：`joystick-target` status=warn，`joystick.mode=legacy`（preHook 触发未带 `--project`）——摇杆热区校准断言本轮为「取证不断言」，`joyAreaDiff=0` 无断言意义。线上门禁应按模板带 `--project games/game-8`。
- **PASS 的适用边界（本轮新增实锤）**：mobile-web-smoke 的断言集（网络/console/canvas/渲染/动画/触摸管线/触摸响应/音频解锁/视口/FPS）**不覆盖 v4 缺陷 A/B/C/D**——本节点对 v4 线上包复跑同一门禁同样全绿。**该门禁单独不能自证「线上可玩」**，必须与工程探针 `tools/playability-probe.mjs`（P1 可收集物 / P2 键盘位移 / P3 摇杆位移）联用——这正坐实 v5 需求「禁止只以引擎级注入的门禁结果自证线上可玩」的必要性。

### 0.3 线上实况实锤（部署未完成，blocked 复现）

| 项 | 本轮实测 | 结论 |
|---|---|---|
| 线上 `index.pck` | 3,210,752 B，sha256 `7738850ae98ff92f1893024e337f38c8dd43bcc2ec4443a62a4985fecc5d8502` | **= v4 包**（与 v4 部署锚点逐字节一致）；非 v5 预期 `3ca34b43…`/2,613,856 B |
| 部署 API 干跑 | 403「仅应用所有者或系统管理员可操作」，requestId `req_1791971169333` | 身份错位**第三次独立复现**（v5 第二轮 req_1791968912360、第三轮 req_1791969367365、本轮） |
| goal 读/回写 API | GET 403 `req_1791971123121`；列表接口不可见该 goal | 本节点 **artifacts 回写无法完成**（HTTP 通道不通，与 v5 第三轮复核一致） |
| 线上 `playability.json` | 不存在 | 原因：部署未完成，探针无 v5 可验 |

解阻路径（二选一，见 handoff §五）：① 从目标 `cmujpml1e006rm99i9hc33huu` 会话**委派发起**工作流（goal 委派 run 的节点 token 带actFor=owner，天然过 assertAppAccess，且部署带 goalId 平台自动回写产物）；② app owner（`cmuimu6w…`）或 admin 手动执行 handoff §六 一键部署 curl。

### 0.4 v5 本地证据（分支 HEAD `1d4b5b6`，全绿）

| # | 项 | 结果 | 证据 |
|---|---|---|---|
| 1 | preflight / smoke@320 / input-fuzz / playtest@3600 | PASS ×4 | v5 开发轮实测（handoff §二；playtest 3 局 fb=185/222/213） |
| 2 | 产物自跑冒烟 | PASS | C 补刀后新 pck `--main-pack export/web/index.pck --quit-after 320` → `GODOT_SMOKE: PASS` |
| 3 | 本地壳链路 P1/P2/P3 | **PASS** | `qa/local-v5-verify/playability.json`：P1=1365 命中 / P2=117px / P3=173px（CDP 真实事件驱动，非引擎级注入） |
| 4 | C/D 浏览器级取证 | PASS | `qa/local-v5-verify/cd-mobile-result.png`（结算三段零重叠）、`cd-desktop-{ingame,result}.png`（桌面视口无摇杆/无触屏确认钮） |

## 一、试玩指引（部署解阻后按此玩 · 看什么）

### 1.1 入口与环境
- **线上入口**：https://leomac-studio.tail49399e.ts.net/apps/game-8/ ——加载 ≤3 秒、无白屏/闪退/报错。
- **桌面**：浏览器直接打开（**v5 修复后**桌面视口完全不显示虚拟摇杆与触屏确认按钮——D 修复，`pointer:coarse` 精确判定）；**移动端**：手机浏览器竖屏打开。
- 进入后先见**开始面板**（READY 阶段），文案即目标说明：「60 秒内收集 20 分 / 青草垛 +1 · 金铃铛 +3 · 时钟 +2 并加时 / 连击高分物有加成 · 磁铁 / 加速帮你冲刺」。点按钮或按 Enter/Space 开始。

### 1.2 操作
| 环境 | 移动 | 暂停 | 重开 |
|---|---|---|---|
| 键盘 | WASD + 方向键双套 8 向（v5 勘误：键盘在 Web 上一直有效） | P | 结算面板 R / 按钮 |
| 触屏 | 左下**虚拟摇杆**拖动 8 向（v5：热区外扩 40px，边缘不再脱靶；按下即接管，不再被 GUI 吞事件） | 触屏暂停按钮 | 结算面板「再玩一局」按钮 |

方向直觉自检：**按 A 牛牛应向屏幕左移动**（v4 REJECT 的 B 项验收口径）；摇杆向左拖同理。

### 1.3 局内看点（对照策划案 content；v5 修复后应有的表现加粗）
1. **五类目标物**（触碰即消失、得分与类型一致、UI 同帧刷新）：**v5 修复后物品必须可见**（开局 10 秒内同屏可收集物 > 0——A 修复；若仍看不见任何物品，立即停止试玩并报告）。
   | 类型 | 分值/效果 | 视觉 |
   |---|---|---|
   | 青草垛 normal | +1（恒 +1，吃不到 Combo 加成） | 草绿菱形 |
   | 金铃铛 rare | +3（吃 Combo 加成） | 亮金十点星 |
   | 时钟 clock | +2 且加时 +4s | 天蓝八边形 |
   | 磁铁 magnet | 道具：5s 内半径 100px 内计分物被吸来（拉速 170px/s） | 品红 U 形 |
   | 加速 boost | 道具：4s 内移速 ×1.5 | 青碧闪电 |
2. **Combo**：2 秒窗口内连续收集递增，断连/超时/重开清零；加成每级 +1 封顶 5，只作用于 ≥2 分高分物；连击音高逐级上行、飘字与粒子同帧。
3. **三波次**（波间停顿 1.2s + 横幅提示）：0-6 / 7-13 / 14-19 分切波，副标题「青草垛大量刷出」→「金铃铛变多」→「最后冲刺连击冲分」；越往后稀有物与道具占比越高、刷得越快（间隔 0.8s→0.45s、寿命 6s→3s）。
4. **同屏上限** 6 件；物品临期 1.5s 内闪烁警示；过期自动回收**不计分**。
5. **反馈三件套**：收集=音效+粒子+飘字同帧；关键事件（连击里程碑/道具生效/波次切换/结算）各有专属音效 + 震屏。
6. **画面**：牛牛多帧动画 3 组，面朝转向翻转；分层背景 + 风格卡配色（主 #3498db / 辅 #2ecc71 / 强调 #f39c12；无像素风/黑描边/纯黑底）。

### 1.4 结算与闭环
- **通关**（≥20 分未超时）/ **失败**（时限归 0 未达标，保留累计进度）。
- **v5 修复后结算页排版**：结论行（自动换行）、新纪录高亮、「一键重开」按钮**三段分层互不重叠**（C 修复——若文字仍压按钮，立即报告）。
- 重开立即可玩（得分归零、计时 60s 重置、场上重铺、刷点避开出生点）；存档持久化（`user://niuniu_game8_save.json`），历史最高分/最高连击/累计收集重进不丢。

### 1.5 重点观察清单（v5 轮：四缺陷修复是否可感 + 体验四维）
1. **A 可见性**：开局 10 秒内同屏是否有可收集物？全程是否零「空屏」段？
2. **B 移动**：键盘 WASD 长按与触屏摇杆拖动，牛牛是否都动、方向是否符合屏幕直觉（按 A 向左）？
3. **C 结算排版**：结算页文字与按钮是否完全无重叠？
4. **D 桌面触屏 UI**：桌面视口内是否完全看不到虚拟摇杆与触屏确认按钮？
5. 首分钟：开始面板文案能否不看说明就懂目标与操作？
6. 玩法深度：金铃铛/时钟是否「值得追」？磁铁/加速是否改变走位决策？Combo 冲分有无紧张感？
7. 反馈：每次收集是否音效+粒子+飘字齐发？音量是否舒适（iOS 真机音效仍是待实测项）？
8. 节奏：60 秒一局内有没有明显断档/无聊段？波间停顿 1.2s 是节奏点还是打断感？

## 二、结构化试玩量表（四问逐条，不合并）

> **状态：待用户试玩（未回填）。** 试玩结论只能来自用户；以下各项交付时全部为空，严禁 agent 代填。**且试玩本身以部署解阻为前提**（见文首横幅）。

| # | 问题 | 回填格式 | 状态 |
|---|---|---|---|
| ① | 首分钟能否看懂目标与操作 | 是/否 + 卡点（卡在哪一步、哪句文案没看懂） | **待回填** |
| ② | 结束时想不想再来一局 | 1-5 分 + 原因（1=完全不想，5=立刻再来） | **待回填** |
| ③ | 手感、反馈与观感 | 1-5 分，分项：打击感 / 音效 / 画面响应 / 风格统一与排版清晰（后两项对照风格卡 `games/game-8/.myrd/style-card.md`：字号档 40-48/24-28/16-18px、色板 #3498db/#2ecc71/#f39c12、触达区 ≥44px、无溢出遮挡——偏离卡片即在分值中体现） | **待回填** |
| ④ | 节奏有没有明显断档或无聊段 | 有/无 + 出现在第几秒（如「30-40s 金铃铛等刷期」） | **待回填** |

回填方式（任选其一）：直接把四问结论发给 agent；或连同调参 URL 一起发回（见 §三），数值与结论一次交付。

## 三、调参工作台

- **入口**：https://leomac-studio.tail49399e.ts.net/apps/game-8/?tuning=1 （部署解阻后有效）
- 打开后画面右上角出现「调参工作台」面板，拖滑杆**即时生效**（下一物理帧应用，无需重开）；点「复制调参 URL」得到带 `?tuning=<JSON>` 的链接，**发回来就是一次完整的调参结果**。
- 只认 `game_state.gd` 数值区 `TUNING_META` 声明的 **17 个键**（URL 里未声明键忽略并在 diff 说明中标注；v5 修复未动任何数值默认值，下表与 v4 版一致）：

| 键 | 默认 | 钳制/步长 | 语义 |
|---|---|---|---|
| TARGET_SCORE | 20 | 5~60 / 1 | 通关分数线 |
| TIME_LIMIT | 60 | 15~180 / 5 | 单局时限（秒） |
| MAX_COLLECTIBLES | 6 | 1~20 / 1 | 同屏上限 |
| SPAWN_INTERVAL_START | 0.8 | 0.3~3.0 / 0.05 | 第 1 波刷间隔起点 |
| SPAWN_INTERVAL_MIN | 0.45 | 0.2~2.0 / 0.05 | 第 3 波刷间隔下限 |
| LIFETIME_START | 6.0 | 2.0~15.0 / 0.5 | 物品寿命起点 |
| LIFETIME_MIN | 3.0 | 1.0~10.0 / 0.5 | 物品寿命下限 |
| PLAYER_SCALE | 1.4 | 0.5~2.0 / 0.05 | 牛牛体型倍率（v1 回滚 1.0 口径） |
| PLAYER_SPEED | 145 | 60~300 / 5 | 移速 px/s（v1 回滚 220 口径） |
| COMBO_WINDOW | 2.0 | 0.5~5.0 / 0.1 | 连击窗口（秒） |
| COMBO_BONUS_MAX | 5 | 0~10 / 1 | 连击加成封顶 |
| TIME_BONUS_CLOCK | 4.0 | 0~10 / 0.5 | 时钟加时（秒） |
| MAGNET_RADIUS | 100 | 60~200 / 5 | 磁铁半径（px） |
| MAGNET_DURATION | 5.0 | 1~10 / 0.5 | 磁铁时长（秒） |
| BOOST_MULT | 1.5 | 1.1~2.5 / 0.05 | 加速倍率 |
| BOOST_DURATION | 4.0 | 1~10 / 0.5 | 加速时长（秒） |
| WAVE_BREAK_SECONDS | 1.2 | 0~3 / 0.1 | 波间停顿（秒） |

- **红线**：数值改动唯一事实源是策划案 revisions（禁止散点改代码默认值）；若调参意图跨出 smoke 断言区间（v2 手感 [1.3,1.5]×[132,154]），须三处同步（smoke.gd 常量、需求区间、策划案 revisions），否则门禁以清晰签名 FAIL——设计行为非误报。
- **取证技巧（v5 实证）**：调参桥可打快进局——`?tuning={"TIME_LIMIT":15,"TARGET_SCORE":60}` 即可 15 秒内打到失败结算，是浏览器里看结算面板（验证 C 修复）唯一现实的路径。

## 四、试玩结果回写协议（收到结果才做）

1. 解析 `?tuning=` 里的 JSON，与现值 diff（未声明键忽略并标注）；
2. `POST $PLATFORM_API_URL/api/v1/game-design-specs/cmv7i4txk000zjofi5vrdcrvk/revisions` 写进 spec.numeric（产生新版本，带 sourceTrajectoryId 溯源）→ `POST …/approve` 拍板；
3. 拍板结论与数值 diff 追加一条 `op=tuning_applied` 产物回写 goal artifacts（回写通道按 blocked 报告最新指引；部署路由带 goalId 的自动合并优先）；**下一轮工作流按新 spec 重部署**——不在节点内直接改代码默认值。
4. 未收到用户结果 → 本步整体跳过，量表维持「待用户试玩」，由人机回环后续回流处理。

## 五、版本锚点

- 实现基线：`myrd/game-8-goal-cmujpml1e006rm99i9hc33huu` @ `1d4b5b6`（v5 修复 `db8b9ce` + C 补刀 `3889674` + 模板同步 `311f1d2`）
- 线上：**仍是 v4**（deployment `cmv7oa022000im9700bqwktfj` @ `9bda2c1`，pck sha `7738850a…5d8502`）；v5 部署待解阻，完成后线上 pck 预期 ≈2,613,856 B / `3ca34b43…`（哈希仅参考，权威口径=线上 pck 自跑冒烟含 v5 断言 + playability 三项 PASS）
- liveUrl：https://leomac-studio.tail49399e.ts.net/apps/game-8/（HostedApp `cmujpmjsy006pm99ip9yws3wl`）
- 本文交付：playtest 节点（run `cmv7snbpq000nm9tiuyizp98o`），2026-10-14
