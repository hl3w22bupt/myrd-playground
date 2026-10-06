# 《线上抓娃娃机 game-11》试玩验收包（playtest kit）

- 生成：2026-10-06 · 试玩验收节点（playtest）· 分支 `myrd/games-goal-cmuwf19ee000xm9lg4v7bxybn`
- **试玩入口**：https://leomac-studio.tail49399e.ts.net/apps/game-11/
- **调参工作台**：https://leomac-studio.tail49399e.ts.net/apps/game-11/?tuning=1
- 策划案依据：GameDesignSpec v1（approved，id=cmuwfezv40028m9lg07fd4zs3）meta/levels/content/numeric 段；工程内无 `.myrd/spec/design-spec.json`，操作与名单按实现写实。

---

## 0. 前置机判门禁（非人工试玩结论）

| 门禁 | 结论 | 证据 |
| --- | --- | --- |
| 移动端模拟门禁 MOBILE_SMOKE（本节点 preHook，实跑于部署后的 liveUrl） | **PASS，10 项全绿** | `games/game-11/qa/mobile/report.json` + phase-load/tap/joystick 三张截图（checkedAt 2026-10-06T10:29:10Z，iPhone 17.5 UA / 390×844 / DPR3 仿真；FPS=10 为 swiftshader 软渲染口径，阈值 ≥8） |
| 本地四门禁 preflight / GODOT_SMOKE / GODOT_FUZZ / GODOT_PLAYTEST | 全绿 | 实现与部署节点复验记录：`.myrd/blackboard/game-11-implement.md`、`.myrd/blackboard/game-11-deploy.md`（复验命令 `bash games/game-11/verify.sh`） |

「移动端能不能玩」已机判；**好不好玩只能由人试玩判定**——请按下面指引玩 1–2 局后回填第 4 节量表。

## 1. 一分钟上手（怎么玩）

**目标**（spec levels · level-starlight-arcade 的实现版）：单局限时内抓够目标只数的娃娃即获胜；每次下爪消耗 1 枚游戏币，开局默认 5 币；时间耗尽或币尽未达标判负。结算后点按画面 /「下爪」钮再来一局。

**桌面**：`WASD`/方向键移动爪子 · `空格` 下爪 · `Tab` 换爪型 · 拖动鼠标转视角 · 滚轮缩放。
**移动端**（门禁已验）：左下虚拟摇杆移动 · 点按画面或底部「下爪」钮下爪/重开 ·「换爪」钮切爪型 · 单指拖动画面转视角 · 双指捏合缩放。

**界面**：顶部 HUD=币 · 时间 · 目标进度 · 当前爪型 · 得分；底部=3 个爪型钮（当前爪型带 ▶）/「下爪」/「背包」/「音效:开」；抓中后背包行内联展示，结算弹窗列背包明细，按空格/「下爪」重开。

## 2. 看什么（对照 spec 验收的实测点）

1. **爪型差异可感知**（spec acc-claw-variety）：三爪=均衡 / 强力双爪=夹持稳(×1.5)但半径小(×0.9)移动慢 / 剪刀爪=快(×1.2)但夹持弱(×0.78)。建议同一只娃娃、同一位置，三爪各试 3–5 次下爪，对比成功率与空中晃动——差异应能用眼睛和手感分辨。
2. **娃娃库 8 款**（spec acc-plush-library）：普通=泰迪熊/长耳兔/奶油猫/豆豆蛙，稀有=企鹅墩墩/粉粉猪/黄鸭啾啾，隐藏=云朵独角兽（300 分）。单局 8 只全部布货、每局随机重摆；抓中进背包，「背包」面板逐只列出 名称·稀有度·分数。
3. **3D 与物理**（spec acc-3d-physics-performance）：机台/爪子/娃娃全 3D；下爪→闭合→提起→松爪全程刚体物理，蹭落/中途滑落有翻滚；视角限位环绕（偏航 ±24°/俯仰 18°–53°/距离 1.7–3.1m），转不出机台背面。
4. **音频契约**（spec acc-audio-contract）：BGM 1 首循环（首次交互后出声，符合浏览器自动播放策略）+ 7 种音效（move/claw_close/drop/score/fail/confirm/hit）；右上「音效:开」一键静音。留意音效与画面动作是否同步。
5. **闭环与账务**（spec acc-round-loop-accounting）：下爪扣 1 币、结算不重复扣；抓中入账+进背包；达标即胜、时间/币尽即负；重开重置本局账目。

## 3. spec ↔ 实现差异（如实披露，供判定是否接受）

- **引擎栈**：spec.meta.engine 写 Three.js + cannon-es；实际按工坊流水线以 **Godot 4.3 Web 导出**实现（物理=Godot Physics 3D）。
- **娃娃名单**：数量均 8 款，但名单与稀有度分档与 spec 不同（spec：普通3/稀有3/传说2+皮肤；实现：普通4/稀有3/隐藏1）。
- **单局时长**：spec round.time_limit_seconds=90；实现默认 75s（调参键 `round_seconds`，30–180 可调）。
- **开局币**：spec coin.start_balance=10；实现默认 5（调参键 `coins_start`，1–12 可调）。
- **解锁/回访钩子未实现**：spec.content 的每日登录+3 币、收集里程碑解锁爪型、每周轮换均为长线设计，本版三爪开局即可切换、无持久化图鉴；展示柜=本局背包面板。
- **视角限位口径**：spec numeric.camera（±45°/15–65°/2.2–8.0）与实现（±24°/18–53°/1.7–3.1m）不一致，均满足需求「有限旋转/缩放」。
- 以上若需对齐，走调参回写（时长/币）与下一轮迭代（名单/解锁/相机口径），不在本节点改代码默认值。

## 4. 结构化试玩量表（四问逐条回填；状态：**待用户试玩**）

> 试玩结论只能来自用户。以下任何一问回填前，本游戏不得被描述为「好玩/试玩通过」。

| # | 问题 | 回填 | 说明 |
| --- | --- | --- | --- |
| ① | 首分钟能否看懂目标与操作？ | ☐ 是 ☐ 否；卡点：＿＿＿ | 看 HUD 目标进度与提示行（移动端：摇杆移动·点按下爪）是否自解释 |
| ② | 结束时想不想再来一局？ | ＿＿ / 5 分；原因：＿＿＿ | 1=不想，5=立刻再来；可结合爪型差异与娃娃收集欲评价 |
| ③ | 手感与反馈？ | ＿＿ / 5 分 | 打击感（下爪/闭合/提起）/音效与画面同步/移动与视角响应，可分项写 |
| ④ | 节奏有没有明显断档或无聊段？ | ☐ 无 ☐ 有；出现在第＿＿秒 | 例如「等爪子回到位太久」「结算后停顿」——填秒数便于对调参键下刀 |

**回传方式**：直接按 ①②③④ 把勾选/分数/原因发回（对话或工单均可）＋ 可选附带第 5 节的调参 URL。

## 5. 调参工作台（把「不好玩」变成可回写的数值）

**入口**：https://leomac-studio.tail49399e.ts.net/apps/game-11/?tuning=1 —— 打开后画面右上角浮出「调参工作台」面板，拖滑杆**即时生效**（无需重开浏览器，重开一局即可体验新数值）；点「复制调参 URL」得到带 `?tuning=<JSON>` 的链接，**把它发回来就是一次完整的调参结果**。

可调键（=GameState.TUNING_META，与 spec.numeric 对接面；只认这 7 个键，URL 里其余键忽略）：

| 键 | 含义 | 当前默认 | 范围 | 步长 |
| --- | --- | --- | --- | --- |
| claw_speed | 爪子平移速度（m/s） | 1.15 | 0.4–2.4 | 0.05 |
| drop_speed | 下爪速度（m/s） | 2.6 | 0.8–6.0 | 0.1 |
| grab_radius | 抓取判定半径（m） | 0.28 | 0.10–0.40 | 0.01 |
| grab_stability | 夹持稳定度（0–1，越高越稳） | 0.8 | 0.2–1.0 | 0.05 |
| round_seconds | 单局时长（s） | 75 | 30–180 | 5 |
| target_dolls | 达标所需娃娃数（只） | 3 | 1–8 | 1 |
| coins_start | 开局币数 | 5 | 1–12 | 1 |

调参 URL 数值定稿后的处理流程（收到 URL 才做）：解析 `?tuning=` JSON → 与现值 diff → `POST /api/v1/game-design-specs/cmuwfezv40028m9lg07fd4zs3/revisions` 写进 spec.numeric（新版本，带 sourceTrajectoryId 溯源）→ `POST .../approve` 拍板 → 回写 artifacts（op=tuning_applied）→ 下一轮工作流按新 spec 重部署。**不在本节点改代码默认值，spec 是唯一事实源。**

## 6. 已知事项（不阻塞试玩）

- headless 门禁日志中 `Parameter "m" is null` 刷屏为 Godot 4.3 哑渲染器固有输出，真机/Web 无此问题。
- 移动端门禁 FPS=10 为 headless swiftshader 软渲染口径（阈值 ≥8）；真机 GPU 表现请以第 4 题③的手感反馈为准。
- 剪刀爪 9.88s 首奖励贴近 playtest 门禁 10s 阈值为种子确定性路径；若试玩觉得「下爪节奏偏慢」，正是 `drop_speed`/`grab_speed` 调参键的用武之地。

