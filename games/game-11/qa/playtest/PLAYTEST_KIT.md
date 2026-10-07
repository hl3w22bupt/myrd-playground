# 《线上抓娃娃机 game-11》试玩验收包 · 画质 v2（playtest kit）

- 生成：2026-10-07 · 试玩验收节点（playtest，画质 v2 重跑轮次）· 部署 version 7（deployment id=`cmuxl0nam001dm9oetz0i10xi`，commit `07bba07`）
- **试玩入口**：https://leomac-studio.tail49399e.ts.net/apps/game-11/
- **调参工作台**：https://leomac-studio.tail49399e.ts.net/apps/game-11/?tuning=1
- 策划案依据：GameDesignSpec **v2**（approved，id=`cmuxieos4000rm9oeoa9p7ux0`，version=2，含画质三专项 numeric.rendering/materials/modeling/ui_theme/performance 与 acc-v2-* 五条验收）；工程内无 `.myrd/spec/design-spec.json`，操作与名单按实现写实。
- v1 版验收包（2026-10-06）已被本文件取代，v1 差异披露中仍有效的条目继续列于 §3。

---

## 0. 前置机判门禁（非人工试玩结论）

| 门禁 | 结论 | 证据 |
| --- | --- | --- |
| 移动端模拟门禁 MOBILE_SMOKE（本节点 preHook，实跑于部署后的 liveUrl） | **PASS，10 项全绿** | `games/game-11/qa/mobile/report.json` + phase-load/tap/joystick 三张截图（checkedAt 2026-10-07T04:07:31Z = 本地 12:07，**晚于 version 7 部署创建 12:02:46Z**，测的确实是 v2 部署；iPhone 17.5 UA / 390×844 / DPR3 仿真；**实测 fps=17，阈值 ≥8 为 swiftshader 软渲染口径**——真机 GPU 帧率 ≥30fps 红线以真机体感为准，模拟门禁只能机判软渲染口径） |
| 本地四门禁 preflight / GODOT_SMOKE / GODOT_FUZZ / GODOT_PLAYTEST | 全绿 | GODOT_SMOKE 240 帧含**画质契约七断言**（Filmic/Glow/雾/颜色调整/MSAA/UI 主题矢量字体/降档看门狗）；复验记录 `.myrd/blackboard/game-11-deploy-v2.md`（复验命令 `bash games/game-11/verify.sh`） |
| 部署真实性（本节点独立复核） | 一致 | 线上 `api/public/assets/index.pck.gz.b64` 解码 sha256=`603865ed03dccfb3`（3,459,648 B）与本地 HEAD 构建**逐字节一致**；`/health` 200 且 `app=claw-machine-game-11`；gitRef=`myrd/games-goal-cmuwf19ee000xm9lg4v7bxybn`（非 main） |
| 门禁修复轨迹（本轮） | round1 FAIL → 修复 → round2 PASS | round1（12:02，存档 `qa/mobile-round1-fail/`）唯一 FAIL fps=5<8：门禁 runner 的 GL_RENDERER 被浏览器掩码致软渲染 LOW 档未生效；修复 `07bba07`（壳页 GPU 探测写 `window.__SOFT_RENDER__`，游戏经 JavaScriptBridge 桥读兜底）；复测 fps 5→17（3 倍+），LOW 档生效确认 |

「移动端能不能玩」已机判；**好不好玩只能由人试玩判定**——请按下面指引玩 1–2 局后回填第 4 节量表。

## 1. 一分钟上手（怎么玩）

**目标**：单局限时（默认 75s，spec 写 90s，可用调参键对齐）内抓够目标只数（默认 3 只）即获胜；每次下爪消耗 1 枚游戏币，开局默认 5 币；时间耗尽或币尽未达标判负。结算后点按画面 /「下爪」钮再来一局。

**桌面**：`WASD`/方向键移动爪子 · `空格` 下爪 · `Tab` 换爪型 · 拖动鼠标转视角 · 滚轮缩放。
**移动端**（门禁已验）：左下虚拟摇杆移动 · 点按画面或底部「下爪」钮下爪/重开 ·「换爪」钮切爪型 · 单指拖动画面转视角 · 双指捏合缩放。

**界面**：顶部 HUD=币 · 时间 · 目标进度 · 当前爪型 · 得分；底部=3 个爪型钮（当前爪型带 ▶）/「下爪」/「背包」/「音效:开」；抓中后背包行内联展示，结算弹窗列背包明细。

## 2. 看什么（对照 spec v2 验收的实测点）

### 2a. 画质 v2 三专项（本轮新增，spec v2 acc-v2-* 五条）

> **档位前提（重要）**：游戏按 GPU 能力三级分层——HIGH=全效果；真机/桌面浏览器（真 GPU）默认 HIGH；**headless 门禁 runner 与软渲染设备自动进 LOW 档**（quality_tier=2，显式关闭 MSAA/Glow/雾/颜色调整/补光/软阴影，运行时 <24fps 看门狗也会逐级降档——这是性能契约不是缺陷）。**下表效果一律以真机或桌面 GPU 预览为准**；门禁截图（软渲染 LOW 档）只能证明「能玩、文字清晰、画面正常」，不能证明辉光/雾效。桌面 Chrome 直接打开即为 HIGH 档。

| 专项 | 怎么看 | spec v2 依据 |
| --- | --- | --- |
| 字体清晰 | 手机（3x DPR）打开：标题「娃娃星球」、HUD、操作提示、结算弹窗、背包文字边缘应锐利无糊边（矢量 NotoSansSC，标题 28px/正文 20px + 2px 描边，面板圆角 12px 渐变）；桌面可在 URL 后加 `?dpr=3` 强制 3x 对比 `?dpr=1` | acc-v2-font-clarity / ui_theme |
| 渲染管线 | 桌面 GPU 打开：①娃娃与机台边缘无锯齿楼梯（MSAA 2×）②明暗过渡有层次不死黑（Filmic 色调映射）③顶部灯罩/灯泡有柔和光晕（Glow）④机台内远景有空气感（深度雾，密度 0.015）⑤对比/饱和增强（颜色调整）⑥主光为软阴影无硬边 | acc-v2-render-pipeline / rendering |
| PBR 材质 | 同一画面内三类材质质感可辨：金属爪镜面高光（chrome metallic=1/rough=0.15）、机身烤漆（metallic 0.2/rough 0.35）、娃娃绒布哑光（rough 0.9）+ 自发光眼睛、玻璃罩透明双面 + 掠射反光（alpha 0.16/rough 0.05）、地毯绒面（rough 0.95） | acc-v2-material-pbr / materials |
| 建模精细 | 夹爪≥5 部件（爪臂/关节/连杆，三爪联动开合连续）；每只娃娃≥8 部件（身体/肚皮/头/耳型/眼鼻腮红）弧面圆滑无硬棱、有立体装饰 | acc-v2-model-detail / modeling |

### 2b. 玩法契约（v1 承接，回归看点）

1. **爪型差异可感知**（acc-claw-variety）：标准三爪=均衡 / 强力双爪=夹持稳(×1.5)但半径小(×0.9)移动慢 / 剪刀爪=快(×1.2)但夹持弱(×0.78)。同一只娃娃、同一位置，三爪各试 3–5 次下爪，对比成功率与空中晃动。
2. **娃娃库 8 款**（acc-plush-library）：普通=泰迪熊/长耳兔/奶油猫/豆豆蛙，稀有=企鹅墩墩/粉粉猪/黄鸭啾啾，隐藏=云朵独角兽（300 分）。单局 8 只全部布货、每局随机重摆；抓中进背包，「背包」面板逐只列出 名称·稀有度·分数。
3. **3D 与物理**（acc-3d-physics-performance）：下爪→闭合→提起→松爪全程刚体物理，蹭落/中途滑落有翻滚；视角限位环绕（偏航 ±24°/俯仰 18°–53°/距离 1.7–3.1m），转不出机台背面。
4. **音频契约**（acc-audio-contract）：BGM 1 首循环（首次交互后出声）+ 7 种音效（move/claw_close/drop/score/fail/confirm/hit）；右上「音效:开」一键静音。留意下爪/闭合/成功/掉落音效与画面是否同步。
5. **闭环与账务**（acc-round-loop-accounting）：下爪扣 1 币、结算不重复扣；抓中入账+进背包；达标即胜、时间/币尽即负；重开重置本局账目。

## 3. spec ↔ 实现差异（如实披露，供判定是否接受）

**画质 v2 相关（本轮新核对）**

1. **hidpi 上限**：spec rendering.dpr_max=3；实现壳页真 GPU 默认钳 2（功耗/发热取舍），URL `?dpr=3` 可显式到 3x（上限同为 3）。软渲染设备恒钳 1（门禁 runner 即此路径）。
2. **MSAA 档位**：spec 区分 desktop 4x / mobile 2x；实现统一 msaa_3d=2×（project.godot 单值，gl_compatibility 下 4x 代价高），桌面/移动同为 2x。
3. **渲染数值的生效面**：spec numeric.rendering/materials/modeling/ui_theme 的具体数值（雾密度、辉光强度、材质 metallic/roughness、部件数、字号描边等）已按 spec 落进代码，但不进 `?tuning=` 调参面板（调参面板只覆盖 7 个**游玩**键，见 §5）；画质数值的修订走 spec revisions，不做运行时滑杆。
4. **效果分档可见性**：辉光/雾/软阴影在软渲染（部分老设备/无 GPU 环境）被 LOW 档显式关闭——spec「不得无声降级」的等效替代即此显式档位契约（quality_tier 可断言 + 本节披露），真机/桌面不受影响。

**v1 承接、v2 spec 未改、仍然有效的差异**

5. **娃娃名单与布货**：spec=可可熊/奶昔兔/柠檬鸭（普通3）+云朵猫/蓝莓企鹅/草莓猪（稀有3）+莓果龙/鎏金招财猫（传说2），按 70/25/5 权重混布 25 只；实现=普通4/稀有3/隐藏1（名单见 §2b-2），单局 8 只全布货。数量同为 8 款，名单/分档/布货策略不同。
6. **单局时长**：spec round.time_limit_seconds=90；实现默认 75s（调参键 `round_seconds`，30–180 可调）。
7. **开局币**：spec coin.start_balance=10；实现默认 5（调参键 `coins_start`，1–12 可调）。
8. **解锁/回访钩子未实现**：spec.entities 的爪型收集解锁条件（如「收集3只普通解锁双爪」）与 content 的每日登录/每周轮换为长线设计；本版三爪开局全开、无持久化图鉴，展示柜=本局背包面板。
9. **视角限位口径**：spec numeric.camera（±45°/15–65°/2.2–8.0）与实现（±24°/18–53°/1.7–3.1m）不一致，均满足需求「有限旋转/缩放」。
10. **物理参数口径**：spec physics（gravity -9.81 / restitution 0.2 / friction 0.65 / mass 0.4–1.2 / win_detect_radius 0.35）与实现（bounce 0.12 / friction 0.9 / mass=0.22×weight / 落洞 Area3D 判定）数值不同，均为「低弹高摩擦、堆叠稳定、真实落洞」的等向实现，体感以试玩为准。

以上若需对齐：时长/币走调参回写（§5）；名单/解锁/相机/物理口径属 spec 修订或下轮迭代，不在本节点改代码默认值。

## 4. 结构化试玩量表（四问逐条回填；状态：**待用户试玩**）

> 试玩结论只能来自用户。以下任何一问回填前，本游戏不得被描述为「好玩/试玩通过」。

| # | 问题 | 回填 | 说明 |
| --- | --- | --- | --- |
| ① | 首分钟能否看懂目标与操作？ | ☐ 是 ☐ 否；卡点：＿＿＿ | 看 HUD 目标进度与提示行（移动端：摇杆移动·点按下爪）是否自解释 |
| ② | 结束时想不想再来一局？ | ＿＿ / 5 分；原因：＿＿＿ | 1=不想，5=立刻再来；可结合爪型差异、娃娃收集欲与画质观感评价 |
| ③ | 手感与反馈？ | ＿＿ / 5 分 | 打击感（下爪/闭合/提起）/音效与画面同步/移动与视角响应；v2 可加评画面质感（辉光/材质/清晰度）是否加分 |
| ④ | 节奏有没有明显断档或无聊段？ | ☐ 无 ☐ 有；出现在第＿＿秒 | 例如「等爪子回到位太久」「结算后停顿」——填秒数便于对调参键下刀 |

**回传方式**：直接按 ①②③④ 把勾选/分数/原因发回（对话或工单均可）＋ 可选附带第 5 节的调参 URL。

## 5. 调参工作台（把「不好玩」变成可回写的数值）

- 入口：<https://leomac-studio.tail49399e.ts.net/apps/game-11/?tuning=1>——打开后画面右上角浮出调参面板，拖滑杆即时生效；点「复制调参 URL」得到带 `?tuning=<JSON>` 的链接，**把它发回来就是一次完整的调参结果**。
- 可调键 = `GameState.TUNING_META` 声明的 7 键（URL 里出现未声明键会被忽略并在 diff 说明中标注）：

| 键 | 含义 | 范围（min/max/step） | 当前默认 |
| --- | --- | --- | --- |
| `claw_speed` | 爪子移动速度倍率 | 0.4 / 2.4 / 0.05 | 1.15 |
| `drop_speed` | 下爪速度倍率 | 0.8 / 6.0 / 0.1 | 2.6 |
| `grab_radius` | 抓取判定半径（米） | 0.10 / 0.40 / 0.01 | 0.28 |
| `grab_stability` | 夹持稳定（越高越不容易中途滑落） | 0.2 / 1.0 / 0.05 | 0.8 |
| `round_seconds` | 单局时长（秒） | 30 / 180 / 5 | 75 |
| `target_dolls` | 获胜目标只数 | 1 / 8 / 1 | 3 |
| `coins_start` | 开局币数 | 1 / 12 / 1 | 5 |

- 收到调参 URL 后的处理（本节点契约）：解析 JSON → 只认上表 7 键 → 与现值 diff → 经 `POST /api/v1/game-design-specs/:id/revisions` 写进 spec.numeric（产生新版本，带 sourceTrajectoryId 溯源）→ `approve` 拍板 → artifacts 追加 `op=tuning_applied` → **下一轮工作流按新 spec 重部署**（本节点不直接改代码默认值，spec 是唯一事实源）。
- 画质数值（rendering/materials/modeling/ui_theme）不在调参面板范围，如需调整走 spec 修订（见 §3-3）。
