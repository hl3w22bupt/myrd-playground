# 产品上下文

# 测试电商中台

测试


## 关联项目

### 心伴

项目名: 心伴
描述: ai 情绪陪伴
类型: mobile
GitHub: https://github.com/hl3w22bupt/odbo
工作流类型: cmqc71gii0005m9uni8nwb6j3

### MyRD Playground [mobile]

项目名: MyRD Playground
描述: MyRD 功能测试和沙盒环境
类型: web-app
GitHub: https://github.com/hl3w22bupt/myrd-playground.git
工作流类型: cmqc5q1ne0005m98t740g0eh9


---


## 产品关联知识

## 情绪陪伴 App 产品调研框架

## 情绪陪伴 App 产品调研分析框架

### 背景
MyRD Admin 提出设计一款以"情绪价值"为核心的陪伴类 App，并引入游戏化交互机制。PD-Agent 就此进行了系统性调研分析。

### 市场与竞品分析
- **现有格局**：冥想类（Headspace、Calm）、日记记录类（Daylio）、虚拟陪伴类（Replika、Character.AI）App 已在市场存在，但多数偏"工具属性"，缺乏有深度的互动体验
- **差异化机会**：游戏化交互是关键的破局点，将情绪调节转化为"养成类 RPG"或"模拟经营"式体验

### 用户需求画像
- **目标人群**：Z 世代及年轻职场人，面临孤独感或高压，排斥传统说教式心理咨询
- **核心诉求**："被理解"、"被陪伴"以及"低压力的情绪宣泄口"，而非"治疗"

### 游戏化交互机制（核心差异化）
- **情绪映射**：将用户抽象情绪（文字、语音、表情）转化为游戏内数值或视觉反馈
  - 示例：用户开心时虚拟家园天气变晴；用户焦虑时出现需要安抚的小怪兽
- **正向反馈循环**：通过"情绪打卡"或"互助任务"解锁装扮、剧情或虚拟互动
- **方向待定**：AI 虚拟伴侣养成 vs 个人情绪花园经营

### 技术可行性
- 涉及 NLP 自然语言处理进行情绪识别
- 高保真游戏化 UI/UX 设计
- 通用技术选型方向待进一步确定

### 伦理与合规风险
- 需明确界定"陪伴"与"心理咨询"的边界
- 避免用户过度依赖及潜在法律风险

### 商业模式探讨
- 订阅制 / 内购制 / 广告变现 待评估

### 后续调研方向
1. 竞品深度拆解：挑选 2-3 款 AI 聊天+游戏元素的应用进行分析
2. MVP 核心功能定义
3. 商业模式确定

## 项目开发规范

# 项目开发规范

## 代码风格
- 使用 TypeScript
- - 遵循 ESLint 规范
- 提交前运行 lint 检查

## Git 提交规范
- 使用 Conventional Commits 格式
- feat: 新功能
- fix: 修复 bug
- docs: 文档更新

## MyRD 平台能力与环境事实源（Agent 防臆造基线 · 2026-09-26 主人核定）

# 目的
本档是平台环境与能力的唯一权威事实源。Agent 在做环境探针、资源盘点、执行决策前，以本档为准；与本档冲突的任何转述、往轮记录、黑板条目一律按本档勘误。

## 一、常驻服务与端口（全部）
- 后端平台 API：http://localhost:3111（env PLATFORM_API_URL 指向它）
- 前端 Web：3001
- PostgreSQL：5432（库名 myrd）
- 除此之外**不存在任何常驻平台服务**。特别地：**平台从未内置「Open Design / 设计工作台 daemon」，127.0.0.1:7456 无任何服务**。该说法源于 2026-09-11 一轮讨论中的臆测（随后被「交叉探针」误证实并写入黑板），已经主人 2026-09-26 核实销案。禁止再将其列为依赖、探针项或环境阻塞证据。

## 二、团队讨论 → 执行 → 部署的真实链路
1. 团队讨论收敛出 decidedAction（workflow / assign / pending）。
2. decidedAction=workflow：平台**自动**启动团队默认工作流（lead 无需也无法手动调用引擎）。
3. 部署（AppHost 导出 + 托管发布）**只发生在工作流的 deploy 节点**；assign 指派执行、纯讨论轮都不会触发部署。
4. 判定某轮工作流的真实结局，唯一依据是 workflow run 的状态（completed / failed / running，见运行卡片），**「已启动」≠「已成功」**；无结局信息时如实写「结局未知」，禁止脑补「被中断/断点未知」。

## 三、身份与权限
- 工作流节点的平台身份 = 工作流触发人（triggeredByUserId）。
- assign 指派执行 = 成员 agent 本人身份；平台会在编排启动时幂等补齐其在绑定项目的成员资格。
- 若仍遇「非项目成员」「项目列表为空/注册表 0 仓库」类报错：属平台 bug 或权限缺口，正确做法是**如实上报等待修复**，不得自行降级为「环境不可用、改做纸面件」，也不得据此宣称整体环境故障。

## 四、当前部署台账（stack-tower，2026-09-26 核对）
- 坑位：appId cmugttipt000km9299oej5z9b · slug stack-tower-3（一游戏一坑，禁止再建）
- liveUrl：https://leomac-studio.tail49399e.ts.net/apps/stack-tower-3/gw
- 线上版本：commit 75debf9（2026-09-25 部署，M2.1「有声可装」全量含音效/移动端/PWA，线上冒烟 PASS）
- 平台 spec 链：v1→v2→v3（v3 approved，id cmugok2uz000xm9ilx42t8pnl）；spec v1.1「登记就绪版」截至 2026-09-26 仍为纸面文件（.myrd/spec/stack-tower-spec-v1.1-ready.yaml），**尚未登记**，登记落点 = POST revisions 接在 v3 之后 version+1。
- 分支：myrd/pixel-fives-m0-m1-cmtpb66pe000rm9e2ozdurf8d（远端 head 541323a > 线上 75debf9，差异均为 docs 提交，不影响游戏构建）。

## 五、历史误报档案（不得再引用为环境基线）
- 「Open Design daemon 127.0.0.1:7456 不可达」：幻觉 + 交叉误证实，销案（2026-09-26）。
- 「代码图谱注册表 0 个注册仓库」（2026-09-11~09-26 多轮）：成员 agent 缺项目成员资格所致（2026-09-26 已修），非仓库缺失。
- 「M2.1 执行被中断、断点位置未知」（2026-09-26 补跑轮）：往轮摘要缺执行结局导致的脑补，实际 M2.1 已于 2026-09-25 完成并部署上线。


## 架构设计文档

# 架构设计

## 技术栈
- 前端：Next.js + React + TypeScript
- 后端：Motia (iii 引擎)
- 数据库：PostgreSQL + Prisma

## 模块划分
- 项目管理模块
- 任务管理模块
- 知识库模块

## 需求池功能说明

# 需求池功能

## 功能说明
需求池用于管理产品需求、Bug 修复、功能改进等任务。

## 状态流转
- backlog: 待办需求
- todo: 已计划
- in-progress: 进行中
- review: 评审中
- done: 已完成
- archived: 已归档

## 沉淀知识：Godot 4 Web 导出移动端触屏虚拟摇杆与 AudioContext 解锁规范

# Godot 4 Web 导出移动端触屏虚拟摇杆与 AudioContext 解锁规范（game-5 实测沉淀）

> 来源：需求《森林收集水果限时赛（game-5）》（id=cmuipol63006rm9l6cp2ww5r5）走完工坊流水线（实现 → 门禁 → Web 导出 → 部署 → 红队对抗验收）后，红队在线上版本实锤缺陷「移动端左右上下移动键不起作用 + 全程无音效」（bug id=cmujiqsk0000gm99if1vzc1eg）。本文把修复与防复发所需的机制结论固化为规范，供 game-5 迭代及后续 Godot Web 小游戏直接套用。机制层结论引自三篇引擎级实测知识（见 §六关联）；玩法数值以《game-5 玩法设计要点》（id=6e91a11d-3632-4721-a3ea-d433e9622f9b）为权威基准，本文不重复其数值。

## 一、结论速览

| # | 要点 | 一句话规范 | 错误修法（禁止） |
| --- | --- | --- | --- |
| 1 | 触屏是一等输入 | 移动端必须提供虚拟摇杆或四向按钮，并与键盘汇入**同一个移动向量出口**；摇杆在 `_input` 阶段接管触点 | 只绑定键盘 action 就指望触屏能用；摇杆逻辑写在 `_unhandled_input`；用 InputEventAction 转发移动输入 |
| 2 | 音频必须手势解锁 | Web 端音频只在**首个真实用户手势调用栈内**解锁并出第一声；解锁前事件只记账不播放 | 在 `_ready` 里直接 play BGM；GDScript 置「已解锁」标志位就当解锁完成 |
| 3 | 60 秒局内节奏 | 连击=窗口刷新式、难度=绑定剩余时间的线性插值、供给=铺场+补货（数值见 6e91a11d） | 连击做固定总窗；难度递增绑定已生成数量 |

## 二、触屏输入：虚拟摇杆 / 四向按钮规范

### 2.1 为什么移动端「方向键失灵」

- 桌面键盘 action（WASD / 方向键）在触屏上**没有物理触发源**：若移动代码只读 `Input.is_action_pressed(...)` 且这些动作只绑定了键盘键，触屏端输入向量恒为 (0,0)——表现为四向全失灵，且**控制台零报错**（不是崩溃，是静默无输入）。
- 两个引擎级陷阱（Godot 4.3 实测探针 + 源码钉死，见知识 36d39401）：
  - **E-18**：触摸事件分发顺序固定为 `_input → GUI 命中 → _unhandled`。Control 若 `mouse_filter=STOP`，落在自身矩形内的触摸会在 GUI 命中阶段被消费，永远到不了它自己的 `_unhandled_input` → 摇杆「整体推不动」，还会把触摸漏给下层按钮造成误交互。
  - **E-19**：同帧多个 `InputEventAction` 会互踩清零（Input 对每个 action 事件都写所有动作的槽位）→ 斜向拖拽只剩一个轴。**移动输入禁止走 InputEventAction 转发。**

### 2.2 推荐实现形态

**虚拟摇杆（Control 自研，首选）**

1. 在 **`_input` 阶段**处理 `InputEventScreenTouch` / `InputEventScreenDrag`（引擎里唯一保证先于 GUI 命中的阶段），接管后 `set_input_as_handled()` 同时阻断 GUI 与 unhandled。
2. 初始按下必须落在摇杆矩形内才接管；接管后滑出矩形照常续跟（拖拽不失联）。
3. `touch_index` 单指跟踪：第二根手指不抢控；加 `is_visible_in_tree()` 守卫，隐藏的摇杆不得抢按任何触摸。
4. 保留 `mouse_filter=STOP`：让 `emulate_mouse_from_touch` 合成出的鼠标事件在 GUI 层被摇杆吃掉，不漏成第二次交互。
5. 输出：以基座中心为原点的归一化向量 + 死区（建议 0.15~0.25），模长 clamp 到 1；y 轴向下为正，与 `Input.get_vector` 口径一致。
6. 视觉：半透明常驻左下（基座 + 拇指帽），按下时拇指帽跟随触点——常驻可见是可发现性要求，不用时降透明度但不下线。

**四向按钮（TouchScreenButton，简化替代）**

- 适合四向/格子化移动；单指按下即全速方向，双指可合成斜向。
- 热区 ≥ 48px（CSS px，注意 DPR 换算，见知识 649e691d），按钮间距留防误触边距。
- 用 `TouchS

（装配注入已截断，全文 5992 字符：需要完整内容时用 search_knowledge 检索）

## 沉淀 Godot 4 Web 导出与 godot-smoke 门禁 + AppHost 部署全链路实战经验（oak-key 取证探针实测）

# Godot 4 Web 导出 + godot-smoke 门禁 + AppHost 部署全链路实战经验（oak-key 取证探针实测）

> 来源：需求《oak-key 有效性探针小游戏（取证探针，不计入三样例）》（id=cmupslvp7002gm9dh42h3maq5，goal=cmupsfn0q001um9dhlko9t5e0）走完「scaffold → implement → AppHost 壳接入 + Web 导出 → 部署 → 线上终态独立复核」全流程后的沉淀。仓库：github.com/hl3w22bupt/myrd-playground，工程落位 `games/oak-key`（Godot 4.3.stable.official.77dcf97d8）。线上终态：liveUrl `https://leomac-studio.tail49399e.ts.net/apps/oak-key/`（308→200、资源 404=0、真实浏览器完成拾取→校验→反馈闭环）。本文只写「门禁怎么搭、打回了怎么修、导出怎么配、部署怎么走」，玩法数值与移动端触屏/音频规范见 §八关联知识，不重复。

## 一、godot-smoke 门禁体系：三层机判 + 退出码纪律

### 1.1 三层结构（缺一层就有漏网）

| 层 | 判定器（仓库内 std-skills/godot-game-dev/scripts/） | 拦什么 | 耗时量级 |
| --- | --- | --- | --- |
| ① preflight 静态一致性 | `preflight.py <工程>` | P1~P13 共 13 类「必然黑屏」类缺陷（路径悬空、ext_resource 声明失配、场景 parent 不可解析、class_name 重复、uid 无声明、Godot3 残留语法、代码级 connect 目标方法缺失、Web 端中文缺字体等），运行前秒级拦下 | 秒级 |
| ② headless-smoke | `GODOT_SMOKE_FRAMES=240 GODOT_BIN=$(bash scripts/resolve-godot.sh) bash scripts/smoke.sh <工程>` | 「能不能跑且玩得动」：headless 导入 + 运行冒烟场景，断言**退出码 0 与 `GODOT_SMOKE: PASS` 标记同时成立**，且 PASS 分支同样扫 `SCRIPT ERROR\|Parse Error`（E-16 带病绿灯） | 秒级~十秒级 |
| ③ input-fuzz | `input-fuzz.sh <工程>` | 确定种子（如 seed=20260913，6 批 239 帧）随机事件序下不崩溃、无脚本错误、主循环不挂死 | 十秒级 |

分工口径：**能在运行前拦的绝不留到运行后**（preflight）；只有运行期才能证实的（输入真的动了、信号真的送达、无每帧刷屏错误）交给冒烟。「噪声后玩法断言仍通过」的语义不变式写在工程内 `tests/smoke.gd`（模板内置），与 fuzz 层互补——两层合起来才覆盖「输入状态残留」类缺陷（实例：跨关卡指针状态泄露导致下一关首手势被吞）。

### 1.2 退出码语义（routine 引擎只认命令退出码，语义必须钉死）

- `0` 通过；`1` 冒烟/fuzz 失败 → 由目标执行引擎 `reject` **打回修复循环**，修复预算即工作流 `maxLoops`，修复动作查 error-signatures 表；`2` 环境不可用（没装 Godot / 缺技能脚本 / 缺 python3）→ **装环境，禁止为过门禁改代码**。
- 工程 `verify.sh` 把 preflight 失败单独编为 `3`（静态不一致 → 先修静态，不必跑冒烟），并对四个判定脚本做**存在性守卫先行判 2**——否则「技能脚本缺失」会掉进下游非零退出码被误判成 3，诱导修复节点去改游戏代码（守卫是防误诊的关键一行）。
- 判定器唯一来源是仓库内 `std-skills/godot-game-dev/scripts/`（与 `.myrd/routines.yaml` 同源同参）；平台注入的 `.myrd-platform/.claude/skills/...` 只是阅读副本。**被检工程不得自造判定器**（playtest.sh 未预置时宁可如实上报缺口，也不做等价替代）。

### 1.3 routine 参数化（第二个游戏接入时最容易翻车的点）

`godot-smoke` routine 必须把 `{{gamePath}}`/`{{smokeFrames}}` 参数化，工

（装配注入已截断，全文 11096 字符：需要完整内容时用 search_knowledge 检索）

## 小游戏移动端模拟门禁取证 SOP：375w 仿真、分阶段截帧与 report.json 证据契约（范例 games/talent-nurture）

# 小游戏移动端模拟门禁取证 SOP

> 把小游戏「上线前移动端机器取证」固化为可复跑、可归档、可回放的门禁流程。范例与判例出处：才艺养成 Demo「星光练习生：才艺养成物语」，`games/talent-nurture/tools/smoke-mobile.mjs` + `qa/mobile/`，2026-10-24 收口于提交 `5f729c7`（分支 `myrd/talent-nurture-goal-*`），9/9 项 PASS。后续小游戏上线门禁直接照此复用。

## 1. 定位与边界

- **是什么**：对**线上 liveUrl**（AppHost 部署产物，非 localhost）做 375w 移动仿真的端到端取证，产出 `qa/mobile/report.json` + 分阶段截图，并 git 归档。作为小游戏「可上线」的机器可判门禁。
- **机器判定 ≠ 使用验收**：好玩/画面审美/四问量表等主观体验**不在机器取证范围**，report 的 `evidenceMethod.outOfScope` 必须显式声明「待用户试玩回填」，绝不能代填主观结论。
- **零 npm 依赖**：直接裸 CDP（WebSocket）驱动 headless Chrome，不引 puppeteer/playwright，脚本可在任何有 Chrome 的机器上跑。判例承同仓 `tools/smoke-live.mjs`（桌面版冒烟）。

## 2. 移动仿真口径（375w）

```js
const VIEWPORT = { w: 375, h: 720 };  // 竖屏基线，对应主流移动端最小宽
// headless Chrome：--headless=new --remote-debugging-port=0，从 DevToolsActivePort 文件取 ws 地址
await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 720, deviceScaleFactor: 2, mobile: true });
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
```

- **点击必须走真实触摸管线**：`Input.dispatchTouchEvent` 的 `touchStart→touchEnd`，**禁止 JS 直调 onclick**——直调测不出事件绑定缺失、热区错位、覆盖遮挡这类真机才会暴露的问题。
- 导航后先 sleep 2.5s，再按场景标志（如 `.title-screen`）轮询就绪（40×250ms），超时即 DIE 并带 console 错误上下文。
- 资产路径按**网关部署形态**处理：产物经网关以 `assets/` 前缀伺服，html 入口形态会被 308 规范化（见 §8 缺陷②）。

## 3. 九项机器判定检查（基线集）

| id | 判据 |
|---|---|
| network | 关键资产经 375×720 仿真加载全 2xx、无 404/加载失败；html/css/main.mjs/scenes 齐备 |
| first-screen | 首屏标题渲染、开始按钮在视口内、`elementFromPoint` 命中自身、非 disabled |
| touch-start | touch 管线点「开始」生效（phase title→intro） |
| viewport | `scrollWidth ≤375` 且选项按钮完整在视口内（无横向溢出） |
| touch-event | 分支事件选项 touch 生效，且**连点 3 次只计 1 次**（防重判定反取证） |
| touch-train | 训练按钮 touch 生效且状态真实推进（如 vocal 10→16、actionsLeft 5→4） |
| touch-pipeline | 全程 touch 主循环推进至结局判定（phase=ended、舞台场次、touch 步数全生效） |
| hotzone | 可点按钮**两两无重叠**且高度 ≥40px（多阶段采样，报最矮值） |
| console | 全流程 console 零 error（warning 仅计数不判失败） |

每个检查项落 `checks[{id,name,pass,detail}]`，detail 必须带**可核查的量化证据**（命中坐标、尺寸、前后状态值），不许只写「通过」。

## 4. 分阶段截图规范

-

（装配注入已截断，全文 5629 字符：需要完整内容时用 search_knowledge 检索）

## 僵尸/孤儿运行轨迹识别与处置手册（status=failed 不可单独为凭）

# 知识：僵尸/孤儿运行轨迹的识别与处置

## 背景
运行（run）的真实状态与已落库的轨迹（trajectory）记录可能失步，平台用「自愈清理」把这类孤儿记录强制归为 failed。这造成大量「假失败」：运行实际被取消/超时/暂停，轨迹却显示 failed，干扰失败统计与工作流评测。该问题在多个项目（心伴、MyRD Playground）跨多天反复出现，命中 85+ 条记忆记录。

## 现象
- 运行被取消后留下轨迹并被标记 failed（常见于取消的 workflow 运行，如心伴前端转换节点的 cancelled 运行被误报为失败）。
- 执行超时未结束、run 已 paused/failed 但轨迹未同步，被自愈清理标记为 failed。
- 报错形如「No conversation found with session ID: ...」或「执行超时未结束，启动自愈清理为 failed」。
- 归因时出现「Agent 退出码 0 但未产生 git commit」之类的伪失败（见内容节点 skipGitCheck 规范）。

## 根因
run 状态与轨迹持久化的执行上下文不同步：取消、超时、暂停等路径没有及时把轨迹状态对齐到真实 run 状态，系统以自愈清理兜底归为 failed。

## 识别与处置步骤
1. 看到 status=failed 时，先不要认定 agent 失败。用 runId 与轨迹/会话记录交叉验证：该 run 是否真的执行过？是否被用户/调度取消？是否超时？
2. 检查磁盘持久化产物：若 run 已产出文件且内容完整，即使状态为 failed 也说明实际成功过，应视为成功而非失败。
3. 区分三类伪失败：SIGINT 基础设施中断、取消产生的僵尸轨迹、skipGitCheck 未设置的 git 校验误判；真实失败应具备「有明确工具错误 / 无产物」特征。
4. 避免重试风暴：对已确认为僵尸/误报的 failed 不做自动重试。
5. 长期修复：确认所有执行入口统一收敛到同一 pipeline，使状态快照与轨迹持久化保持一致。

## 预防
- 新增 workflow/节点时检查 skipGitCheck 与持久化配置。
- 取消运行后留意残留轨迹，优先用 runId 交叉核验再下结论。
- 归因报告须引用 runId 而非仅引用 status 字段。

## 沉淀知识：《今日汇率》Web 工坊上线受阻实录——webapp-smoke 门禁资产双缺口、fail-closed 拦截与恢复路径（附 HostedApp/deployment/liveUrl 三要素核实）

# 《今日汇率》Web 工坊上线受阻实录：门禁资产双缺口、fail-closed 拦截与恢复路径

> 目标：创建 Web 应用《今日汇率》（goal `cmvaf7imr000jm94le9x48zfu`，projectId `proj-playground`，需求 id `cmvafe4gu0017m94la5mhgc3p`）。
> 本文全部结论均经平台 API / git 独立复核（2026-10-16），不复述、不臆造；复核方式见 §7。

## 1. 一句话结论

**应用没有上线，且不是败在代码，而是败在平台模板仓库缺两份门禁资产**：门禁判定脚本 `webapp-smoke.mjs` 与 `routines.yaml` 的 `id=webapp-smoke` routine 条目双双缺失，按「来源不可得 → 立即 blocked」硬约束，流水线三个实现节点全部纪律性停止（未建工程、未部署、未绕过），review 节点 pre-hook fail-closed 拦截，两次运行同因失败。**该目标的「上线三要素」中只有 HostedApp 壳存在，deployment id 与 liveUrl 不存在。**

## 2. 上线三要素核实表（本目标 artifacts 回写依据）

| 要素 | 状态 | 值 / 证据 |
|---|---|---|
| HostedApp id | ✅ 存在（壳，从未部署） | `cmvaf7imm000hm94lw6y43t0q`（name=今日汇率，slug=`myrdplaygrou`，runtime=sandbox，sourceType=workshop，status=`creating`，createdAt=2026-10-16T03:41:09Z，`deployments=[]`，`liveUrl=null`） |
| deployment id | ❌ 不存在 | `GET /api/v1/apphost/apps` 返回该应用 deployments 数组为空；goal artifacts 的 blocked 详情明确「部署 0 次」（三轮独立复验一致） |
| liveUrl | ❌ 不存在 | AppHost 记录 `liveUrl=null`。参照同项目已上线应用（如 farm-yard / game-5），补齐资产并部署成功后格式应为 `https://leomac-studio.tail49399e.ts.net/apps/myrdplaygrou/` |

要点：AppHost 壳是 express_lane 预检节点（早于工作流运行约 48 分钟）预建的，**不代表工程已落地**——`webapps/myrdplaygrou/` 工程目录从未创建。任何下游环节不得把「壳存在」误读为「已部署」。HostedApp id 已作为 `artifactType=hosted_app` 关联回写至 goal artifacts（含三轮 blocked 复验全记录），deployment id / liveUrl 因客观不存在而无法回写，**不臆造补位**。

## 3. 失败链全景（时间线）

1. **2026-10-16 03:41** express_lane 预检完成，预建 AppHost 壳 `cmvaf7imm000hm94lw6y43t0q`（status=creating）。
2. **04:29–04:41** 工作流运行 `cmvagxyf3002em94lxhtab3p9`（同型前次运行 `cmvafm2y5001km94leiaezgid`，同样结局）：
   - **scaffold 节点（completed，结论 blocked）**：核验门禁资产双缺口，落盘 `.myrd/blocked-report.md` 并推送（commit `9eafc4d`，分支 `myrd/fx-app-goal-cmvaf7imr000jm94le9x48zfu`）。未建工程、未落风格卡、未改 routines.yaml。
   - **implement 节点（completed，结论 blocked）**：独立复验后同一结论，追加 blocked 报告（commit `74c749a`）。未建工程、未自造判定器。另核实同目标两条兄弟分支 `myrd/web-goal-…`、`myrd/myrdplaygrou-goal-…` 均无可复用产出。
   - **deploy/发布节点（completed，结论 blocked）**：第三轮复验（`git fetch --prune` 后 origin/main 仍停在 `6c0df4a9`），仍是双缺口，

（装配注入已截断，全文 5767 字符：需要完整内容时用 search_knowledge 检索）

## 沉淀知识：《今日汇率》前端定时更新方案与数据源契约——「多天不更新」六缺口根因与修复 · 30min TTL/定时/手动三路刷新 · 缓存→种子兜底链（er-api/frankfurter 实测契约 · 含 artifacts 回写）

# 《今日汇率》前端定时更新方案与数据源契约（「多天不更新」根因修复 · 实测可复用）

> 目标 `cmvaf7imr000jm94le9x48zfu`（创建 Web 应用《今日汇率》）· 数据鲜度需求 `cmveivn9n000wm9vq3h575b78` · 工作流运行 `cmveiw7540013m9vqlgj9t6ul`（全四棒 completed）· 分支 `myrd/fx-app-goal-cmvaf7imr000jm94le9x48zfu` · 工程 `webapps/myrdplaygrou`
> 本文全部结论经平台 API / git / 线上实调独立复核（2026-10-19），不复述不臆造；姊妹篇（上线受阻与门禁资产恢复）见知识库 `ed7d2bbf-ca19-46f5-b5d1-c7b9db2d85b9`。

## 1. 一句话结论

「多天不更新」的根因**不是静态汇率快照**（工程内零静态汇率常量），而是旧版前端缺整套鲜度机制——**六个缺口叠加**：缓存无 TTL 判定、无定时刷新、无手动刷新、无种子兜底、`AbortSignal.timeout` 兼容风险、鲜度展示错位。修复后形成「**30 分钟 TTL + 30 分钟 interval + 手动强刷**三路更新、**缓存→内置种子**两级兜底」的纯前端方案（commit `fa67dc3` → 部署 v13 → 色板对齐 `45d02f1` → 线上 v15），门禁与移动验收全绿。

## 2. 执行链与产出锚点

| 环节 | 产出 | 证据 |
|---|---|---|
| scaffold | 根因基线六条 + 部署契约四条移交（`.myrd/scaffold-handoff.md`）；门禁资产双缺口已由模板仓库补齐（`9fbc1dc`），不再 blocked | commit `3b30d36` |
| implement | 鲜度机制全量实现（5 文件 +225/-44），根因留痕 `.myrd/implement-notes.md`；CDP 功能自测 14/14，并**附带修复一个真实换算 bug** | commit `fa67dc3` |
| deploy | 色板逐 token 对齐流水线硬约束 `#f0f9ff/#0ea5e9/#22c55e`（薄荷→天蓝，布局/触控不动）；部署 v15；门禁对 liveUrl PASS；证据归档 | commit `45d02f1`、`b5b42d8` |
| review | REVIEW-KIT 更新至 v15；goal artifacts 回写至 12 条；如实记录三处待观察项 | commit `5d8f838` |
| 部署三要素 | HostedApp `cmvaf7imm000hm94lw6y43t0q`（status=ready）· deployment `cmvek09sb001gm9vqf7tn7q9f`（**v15 现役**，commit `45d02f1`；v13 `cmvejnc41001bm9vqikbuvp1i`=fa67dc3 已被取代）· liveUrl `https://leomac-studio.tail49399e.ts.net/apps/myrdplaygrou/` | 2026-10-19 实测线上 app.js 含 `FRESH_TTL_MS`、favicon `#0ea5e9` |

## 3. 「多天不更新」根因：六缺口叠加（含排除法取证）

**取证方法（可复用）**：修复前 HEAD 上 `grep -rnE '"USD": *[0-9]|rates *= *\{|SEED' *.js *.html` 为空 → 排除「静态快照打进包」；旧版每次冷加载都会 fetch（线上 Network 可见）→ 用户所见过期数据的真实成因只能在前端鲜度机制缺失。六缺口与修复对照：

| # | 缺口 | 修复前（活跃部署 13dec1c） | 修复后（fa67dc3） |
|---|---|---|---|
| 1 | 缓存无 TTL 过期判定 | `fx-latest-v1` 存了 `fetchedAt` 但全文件无过期比较，缓存只在 fetch 抛错时被读 | `isExpired()`：`!Number.isFinite(fetchedAt) \|\| Date.now()-fetchedAt > FRESH_TTL_MS`，TTL=30min |
| 2 | 无 interval 定时刷新 | 生命周期只在 init 拉一次 | `setInterval(refreshLatest({force:true}), 30min)` 与 TT

（装配注入已截断，全文 7978 字符：需要完整内容时用 search_knowledge 检索）

## 沉淀知识：《今日汇率》前端定时更新方案与数据源契约——「多天不更新」根因、TTL/刷新参数、兜底链与门禁验收实录（含 artifacts 回写）

# 《今日汇率》前端定时更新方案与数据源契约

> 目标 `cmvaf7imr000jm94le9x48zfu` · 数据鲜度需求 `cmveivn9n000wm9vq3h575b78` · v2 工坊流水线运行 `cmveiw7540013m9vqlgj9t6ul`（completed，scaffold/implement/deploy/review 四节点全绿）。
> 本文全部参数取自**线上 app.js 实抓**（2026-10-19，`/apps/myrdplaygrou/api/public/assets/app.js`，429 行）、平台 API 与仓库提交，独立复核命令见 §9。前序背景（门禁资产双缺口与恢复）见姊妹篇《今日汇率 Web 工坊上线受阻实录》（ed7d2bbf-ca19-46f5-b5d1-c7b9db2d85b9）。

## 1. 一句话结论

「多天不更新」**不是静态汇率快照打进包里**，而是前端缺整套鲜度机制（六个缺口叠加，见 §2）。修复为纯前端方案：open.er-api.com 免 key CORS 直连 + localStorage 30 分钟 TTL 过期判定 + 停留期 30 分钟定时强刷 + 手动刷新按钮（force 跳过 TTL）+「缓存→内置种子」三级兜底 + 溯源行常显。已上线 v15（commit `45d02f1`），生产环境 webapp-smoke 门禁 PASS，门禁截图首屏实拉到当日实时数据。

## 2. 根因定位（需求验收 5 的留痕结论）

**排除项**：工程内 grep 无任何静态汇率常量，旧版每次冷加载都会 fetch——「静态快照打进包」假设被证伪。

**真根因 = 六缺口叠加**（① 是「多天不更新」的主因）：

1. **缓存无 TTL 过期判定**：localStorage 里 `fetchedAt` 存而不校验 → 「缓存永不过期」，一次成功拉取后永远用旧值；
2. **无 interval 定时刷新**：页面停留多久都不会重新拉取；
3. **无手动刷新按钮**：用户没有强制重取入口；
4. **无内置种子兜底**：断网且无缓存时直接空屏；
5. **`AbortSignal.timeout` 旧 WebView 兼容风险**：超时助手在不支持该 API 的内核直接抛异常，拉取静默失败后落入缺口 ① 的永不过期缓存；
6. **鲜度展示错位**：界面显示「本地获取时刻」而非汇率数据自身日期，旧数据也显示成刚更新，掩盖了问题。

根因基线留痕：`webapps/myrdplaygrou/.myrd/scaffold-handoff.md`（六条 + 部署契约四条）与 `.myrd/implement-notes.md`。

## 3. 数据源契约（两源均免 key、CORS 开放、前端直连，无代理无后端）

| 用途 | 端点 | 契约要点 | 实测（2026-10-19） |
|---|---|---|---|
| 最新汇率 | `https://open.er-api.com/v6/latest/{base}` | `result=success` 才可用；`base_code` 回显基准币；`time_last_update_utc` 是数据自身日期（渲染「数据日期」的权威来源，勿用本地时钟）；`rates` 全量字典 | base=USD：**166 币种**，更新于 00:02:32 UTC，CNY=6.69274 / EUR=0.890861 / JPY=157.911394；`time_next_update_utc`=次日（免费档每日一更） |
| 趋势序列 | `https://api.frankfurter.dev/v1/{start}..{end}?base=..&symbols=..` | ECB 参考汇率，免 key；日期区间语法 `{start}..{end}`；周末无报价，前端需容忍缺日 | 由线上 app.js 头注释与 `fetchTrend` 实现确认 |

**选型含义**：两源都不需要服务器中转，HostedApp 静态壳即可承载；CORS 均开放，无需 JSONP/代理/后端。
**重要推论**：er-api 免费档每日一更，所以「30 分钟刷新」刷的是**请求**，汇率值一天最多变一次——界面文案必须据实标注「数据日期」而非「实时秒级」，这也是溯源行存在的意义。

## 4. 缓存与刷新参数（线上 app.js 常量区原文，调参只动这一区）

| 参数/键 | 值 | 语义 |
|---|---|---|
| `LS_KEYS.prefs / latest / trend` | `fx-pr

（装配注入已截断，全文 7198 字符：需要完整内容时用 search_knowledge 检索）

---

# 配图验证产品

测试配图和 landing 渲染


## 关联项目

### 心伴 [frontend / backend]

项目名: 心伴
描述: ai 情绪陪伴
类型: mobile
GitHub: https://github.com/hl3w22bupt/odbo
工作流类型: cmqc71gii0005m9uni8nwb6j3

### MyRD Playground [mobile]

项目名: MyRD Playground
描述: MyRD 功能测试和沙盒环境
类型: web-app
GitHub: https://github.com/hl3w22bupt/myrd-playground.git
工作流类型: cmqc5q1ne0005m98t740g0eh9


---


## 产品关联知识

## 情绪陪伴 App 产品调研框架

## 情绪陪伴 App 产品调研分析框架

### 背景
MyRD Admin 提出设计一款以"情绪价值"为核心的陪伴类 App，并引入游戏化交互机制。PD-Agent 就此进行了系统性调研分析。

### 市场与竞品分析
- **现有格局**：冥想类（Headspace、Calm）、日记记录类（Daylio）、虚拟陪伴类（Replika、Character.AI）App 已在市场存在，但多数偏"工具属性"，缺乏有深度的互动体验
- **差异化机会**：游戏化交互是关键的破局点，将情绪调节转化为"养成类 RPG"或"模拟经营"式体验

### 用户需求画像
- **目标人群**：Z 世代及年轻职场人，面临孤独感或高压，排斥传统说教式心理咨询
- **核心诉求**："被理解"、"被陪伴"以及"低压力的情绪宣泄口"，而非"治疗"

### 游戏化交互机制（核心差异化）
- **情绪映射**：将用户抽象情绪（文字、语音、表情）转化为游戏内数值或视觉反馈
  - 示例：用户开心时虚拟家园天气变晴；用户焦虑时出现需要安抚的小怪兽
- **正向反馈循环**：通过"情绪打卡"或"互助任务"解锁装扮、剧情或虚拟互动
- **方向待定**：AI 虚拟伴侣养成 vs 个人情绪花园经营

### 技术可行性
- 涉及 NLP 自然语言处理进行情绪识别
- 高保真游戏化 UI/UX 设计
- 通用技术选型方向待进一步确定

### 伦理与合规风险
- 需明确界定"陪伴"与"心理咨询"的边界
- 避免用户过度依赖及潜在法律风险

### 商业模式探讨
- 订阅制 / 内购制 / 广告变现 待评估

### 后续调研方向
1. 竞品深度拆解：挑选 2-3 款 AI 聊天+游戏元素的应用进行分析
2. MVP 核心功能定义
3. 商业模式确定

## 项目开发规范

# 项目开发规范

## 代码风格
- 使用 TypeScript
- - 遵循 ESLint 规范
- 提交前运行 lint 检查

## Git 提交规范
- 使用 Conventional Commits 格式
- feat: 新功能
- fix: 修复 bug
- docs: 文档更新

## MyRD 平台能力与环境事实源（Agent 防臆造基线 · 2026-09-26 主人核定）

# 目的
本档是平台环境与能力的唯一权威事实源。Agent 在做环境探针、资源盘点、执行决策前，以本档为准；与本档冲突的任何转述、往轮记录、黑板条目一律按本档勘误。

## 一、常驻服务与端口（全部）
- 后端平台 API：http://localhost:3111（env PLATFORM_API_URL 指向它）
- 前端 Web：3001
- PostgreSQL：5432（库名 myrd）
- 除此之外**不存在任何常驻平台服务**。特别地：**平台从未内置「Open Design / 设计工作台 daemon」，127.0.0.1:7456 无任何服务**。该说法源于 2026-09-11 一轮讨论中的臆测（随后被「交叉探针」误证实并写入黑板），已经主人 2026-09-26 核实销案。禁止再将其列为依赖、探针项或环境阻塞证据。

## 二、团队讨论 → 执行 → 部署的真实链路
1. 团队讨论收敛出 decidedAction（workflow / assign / pending）。
2. decidedAction=workflow：平台**自动**启动团队默认工作流（lead 无需也无法手动调用引擎）。
3. 部署（AppHost 导出 + 托管发布）**只发生在工作流的 deploy 节点**；assign 指派执行、纯讨论轮都不会触发部署。
4. 判定某轮工作流的真实结局，唯一依据是 workflow run 的状态（completed / failed / running，见运行卡片），**「已启动」≠「已成功」**；无结局信息时如实写「结局未知」，禁止脑补「被中断/断点未知」。

## 三、身份与权限
- 工作流节点的平台身份 = 工作流触发人（triggeredByUserId）。
- assign 指派执行 = 成员 agent 本人身份；平台会在编排启动时幂等补齐其在绑定项目的成员资格。
- 若仍遇「非项目成员」「项目列表为空/注册表 0 仓库」类报错：属平台 bug 或权限缺口，正确做法是**如实上报等待修复**，不得自行降级为「环境不可用、改做纸面件」，也不得据此宣称整体环境故障。

## 四、当前部署台账（stack-tower，2026-09-26 核对）
- 坑位：appId cmugttipt000km9299oej5z9b · slug stack-tower-3（一游戏一坑，禁止再建）
- liveUrl：https://leomac-studio.tail49399e.ts.net/apps/stack-tower-3/gw
- 线上版本：commit 75debf9（2026-09-25 部署，M2.1「有声可装」全量含音效/移动端/PWA，线上冒烟 PASS）
- 平台 spec 链：v1→v2→v3（v3 approved，id cmugok2uz000xm9ilx42t8pnl）；spec v1.1「登记就绪版」截至 2026-09-26 仍为纸面文件（.myrd/spec/stack-tower-spec-v1.1-ready.yaml），**尚未登记**，登记落点 = POST revisions 接在 v3 之后 version+1。
- 分支：myrd/pixel-fives-m0-m1-cmtpb66pe000rm9e2ozdurf8d（远端 head 541323a > 线上 75debf9，差异均为 docs 提交，不影响游戏构建）。

## 五、历史误报档案（不得再引用为环境基线）
- 「Open Design daemon 127.0.0.1:7456 不可达」：幻觉 + 交叉误证实，销案（2026-09-26）。
- 「代码图谱注册表 0 个注册仓库」（2026-09-11~09-26 多轮）：成员 agent 缺项目成员资格所致（2026-09-26 已修），非仓库缺失。
- 「M2.1 执行被中断、断点位置未知」（2026-09-26 补跑轮）：往轮摘要缺执行结局导致的脑补，实际 M2.1 已于 2026-09-25 完成并部署上线。


## 架构设计文档

# 架构设计

## 技术栈
- 前端：Next.js + React + TypeScript
- 后端：Motia (iii 引擎)
- 数据库：PostgreSQL + Prisma

## 模块划分
- 项目管理模块
- 任务管理模块
- 知识库模块

## 需求池功能说明

# 需求池功能

## 功能说明
需求池用于管理产品需求、Bug 修复、功能改进等任务。

## 状态流转
- backlog: 待办需求
- todo: 已计划
- in-progress: 进行中
- review: 评审中
- done: 已完成
- archived: 已归档

## 沉淀知识：Godot 4 Web 导出移动端触屏虚拟摇杆与 AudioContext 解锁规范

# Godot 4 Web 导出移动端触屏虚拟摇杆与 AudioContext 解锁规范（game-5 实测沉淀）

> 来源：需求《森林收集水果限时赛（game-5）》（id=cmuipol63006rm9l6cp2ww5r5）走完工坊流水线（实现 → 门禁 → Web 导出 → 部署 → 红队对抗验收）后，红队在线上版本实锤缺陷「移动端左右上下移动键不起作用 + 全程无音效」（bug id=cmujiqsk0000gm99if1vzc1eg）。本文把修复与防复发所需的机制结论固化为规范，供 game-5 迭代及后续 Godot Web 小游戏直接套用。机制层结论引自三篇引擎级实测知识（见 §六关联）；玩法数值以《game-5 玩法设计要点》（id=6e91a11d-3632-4721-a3ea-d433e9622f9b）为权威基准，本文不重复其数值。

## 一、结论速览

| # | 要点 | 一句话规范 | 错误修法（禁止） |
| --- | --- | --- | --- |
| 1 | 触屏是一等输入 | 移动端必须提供虚拟摇杆或四向按钮，并与键盘汇入**同一个移动向量出口**；摇杆在 `_input` 阶段接管触点 | 只绑定键盘 action 就指望触屏能用；摇杆逻辑写在 `_unhandled_input`；用 InputEventAction 转发移动输入 |
| 2 | 音频必须手势解锁 | Web 端音频只在**首个真实用户手势调用栈内**解锁并出第一声；解锁前事件只记账不播放 | 在 `_ready` 里直接 play BGM；GDScript 置「已解锁」标志位就当解锁完成 |
| 3 | 60 秒局内节奏 | 连击=窗口刷新式、难度=绑定剩余时间的线性插值、供给=铺场+补货（数值见 6e91a11d） | 连击做固定总窗；难度递增绑定已生成数量 |

## 二、触屏输入：虚拟摇杆 / 四向按钮规范

### 2.1 为什么移动端「方向键失灵」

- 桌面键盘 action（WASD / 方向键）在触屏上**没有物理触发源**：若移动代码只读 `Input.is_action_pressed(...)` 且这些动作只绑定了键盘键，触屏端输入向量恒为 (0,0)——表现为四向全失灵，且**控制台零报错**（不是崩溃，是静默无输入）。
- 两个引擎级陷阱（Godot 4.3 实测探针 + 源码钉死，见知识 36d39401）：
  - **E-18**：触摸事件分发顺序固定为 `_input → GUI 命中 → _unhandled`。Control 若 `mouse_filter=STOP`，落在自身矩形内的触摸会在 GUI 命中阶段被消费，永远到不了它自己的 `_unhandled_input` → 摇杆「整体推不动」，还会把触摸漏给下层按钮造成误交互。
  - **E-19**：同帧多个 `InputEventAction` 会互踩清零（Input 对每个 action 事件都写所有动作的槽位）→ 斜向拖拽只剩一个轴。**移动输入禁止走 InputEventAction 转发。**

### 2.2 推荐实现形态

**虚拟摇杆（Control 自研，首选）**

1. 在 **`_input` 阶段**处理 `InputEventScreenTouch` / `InputEventScreenDrag`（引擎里唯一保证先于 GUI 命中的阶段），接管后 `set_input_as_handled()` 同时阻断 GUI 与 unhandled。
2. 初始按下必须落在摇杆矩形内才接管；接管后滑出矩形照常续跟（拖拽不失联）。
3. `touch_index` 单指跟踪：第二根手指不抢控；加 `is_visible_in_tree()` 守卫，隐藏的摇杆不得抢按任何触摸。
4. 保留 `mouse_filter=STOP`：让 `emulate_mouse_from_touch` 合成出的鼠标事件在 GUI 层被摇杆吃掉，不漏成第二次交互。
5. 输出：以基座中心为原点的归一化向量 + 死区（建议 0.15~0.25），模长 clamp 到 1；y 轴向下为正，与 `Input.get_vector` 口径一致。
6. 视觉：半透明常驻左下（基座 + 拇指帽），按下时拇指帽跟随触点——常驻可见是可发现性要求，不用时降透明度但不下线。

**四向按钮（TouchScreenButton，简化替代）**

- 适合四向/格子化移动；单指按下即全速方向，双指可合成斜向。
- 热区 ≥ 48px（CSS px，注意 DPR 换算，见知识 649e691d），按钮间距留防误触边距。
- 用 `TouchS

（装配注入已截断，全文 5992 字符：需要完整内容时用 search_knowledge 检索）

## 沉淀 Godot 4 Web 导出与 godot-smoke 门禁 + AppHost 部署全链路实战经验（oak-key 取证探针实测）

# Godot 4 Web 导出 + godot-smoke 门禁 + AppHost 部署全链路实战经验（oak-key 取证探针实测）

> 来源：需求《oak-key 有效性探针小游戏（取证探针，不计入三样例）》（id=cmupslvp7002gm9dh42h3maq5，goal=cmupsfn0q001um9dhlko9t5e0）走完「scaffold → implement → AppHost 壳接入 + Web 导出 → 部署 → 线上终态独立复核」全流程后的沉淀。仓库：github.com/hl3w22bupt/myrd-playground，工程落位 `games/oak-key`（Godot 4.3.stable.official.77dcf97d8）。线上终态：liveUrl `https://leomac-studio.tail49399e.ts.net/apps/oak-key/`（308→200、资源 404=0、真实浏览器完成拾取→校验→反馈闭环）。本文只写「门禁怎么搭、打回了怎么修、导出怎么配、部署怎么走」，玩法数值与移动端触屏/音频规范见 §八关联知识，不重复。

## 一、godot-smoke 门禁体系：三层机判 + 退出码纪律

### 1.1 三层结构（缺一层就有漏网）

| 层 | 判定器（仓库内 std-skills/godot-game-dev/scripts/） | 拦什么 | 耗时量级 |
| --- | --- | --- | --- |
| ① preflight 静态一致性 | `preflight.py <工程>` | P1~P13 共 13 类「必然黑屏」类缺陷（路径悬空、ext_resource 声明失配、场景 parent 不可解析、class_name 重复、uid 无声明、Godot3 残留语法、代码级 connect 目标方法缺失、Web 端中文缺字体等），运行前秒级拦下 | 秒级 |
| ② headless-smoke | `GODOT_SMOKE_FRAMES=240 GODOT_BIN=$(bash scripts/resolve-godot.sh) bash scripts/smoke.sh <工程>` | 「能不能跑且玩得动」：headless 导入 + 运行冒烟场景，断言**退出码 0 与 `GODOT_SMOKE: PASS` 标记同时成立**，且 PASS 分支同样扫 `SCRIPT ERROR\|Parse Error`（E-16 带病绿灯） | 秒级~十秒级 |
| ③ input-fuzz | `input-fuzz.sh <工程>` | 确定种子（如 seed=20260913，6 批 239 帧）随机事件序下不崩溃、无脚本错误、主循环不挂死 | 十秒级 |

分工口径：**能在运行前拦的绝不留到运行后**（preflight）；只有运行期才能证实的（输入真的动了、信号真的送达、无每帧刷屏错误）交给冒烟。「噪声后玩法断言仍通过」的语义不变式写在工程内 `tests/smoke.gd`（模板内置），与 fuzz 层互补——两层合起来才覆盖「输入状态残留」类缺陷（实例：跨关卡指针状态泄露导致下一关首手势被吞）。

### 1.2 退出码语义（routine 引擎只认命令退出码，语义必须钉死）

- `0` 通过；`1` 冒烟/fuzz 失败 → 由目标执行引擎 `reject` **打回修复循环**，修复预算即工作流 `maxLoops`，修复动作查 error-signatures 表；`2` 环境不可用（没装 Godot / 缺技能脚本 / 缺 python3）→ **装环境，禁止为过门禁改代码**。
- 工程 `verify.sh` 把 preflight 失败单独编为 `3`（静态不一致 → 先修静态，不必跑冒烟），并对四个判定脚本做**存在性守卫先行判 2**——否则「技能脚本缺失」会掉进下游非零退出码被误判成 3，诱导修复节点去改游戏代码（守卫是防误诊的关键一行）。
- 判定器唯一来源是仓库内 `std-skills/godot-game-dev/scripts/`（与 `.myrd/routines.yaml` 同源同参）；平台注入的 `.myrd-platform/.claude/skills/...` 只是阅读副本。**被检工程不得自造判定器**（playtest.sh 未预置时宁可如实上报缺口，也不做等价替代）。

### 1.3 routine 参数化（第二个游戏接入时最容易翻车的点）

`godot-smoke` routine 必须把 `{{gamePath}}`/`{{smokeFrames}}` 参数化，工

（装配注入已截断，全文 11096 字符：需要完整内容时用 search_knowledge 检索）

## 小游戏移动端模拟门禁取证 SOP：375w 仿真、分阶段截帧与 report.json 证据契约（范例 games/talent-nurture）

# 小游戏移动端模拟门禁取证 SOP

> 把小游戏「上线前移动端机器取证」固化为可复跑、可归档、可回放的门禁流程。范例与判例出处：才艺养成 Demo「星光练习生：才艺养成物语」，`games/talent-nurture/tools/smoke-mobile.mjs` + `qa/mobile/`，2026-10-24 收口于提交 `5f729c7`（分支 `myrd/talent-nurture-goal-*`），9/9 项 PASS。后续小游戏上线门禁直接照此复用。

## 1. 定位与边界

- **是什么**：对**线上 liveUrl**（AppHost 部署产物，非 localhost）做 375w 移动仿真的端到端取证，产出 `qa/mobile/report.json` + 分阶段截图，并 git 归档。作为小游戏「可上线」的机器可判门禁。
- **机器判定 ≠ 使用验收**：好玩/画面审美/四问量表等主观体验**不在机器取证范围**，report 的 `evidenceMethod.outOfScope` 必须显式声明「待用户试玩回填」，绝不能代填主观结论。
- **零 npm 依赖**：直接裸 CDP（WebSocket）驱动 headless Chrome，不引 puppeteer/playwright，脚本可在任何有 Chrome 的机器上跑。判例承同仓 `tools/smoke-live.mjs`（桌面版冒烟）。

## 2. 移动仿真口径（375w）

```js
const VIEWPORT = { w: 375, h: 720 };  // 竖屏基线，对应主流移动端最小宽
// headless Chrome：--headless=new --remote-debugging-port=0，从 DevToolsActivePort 文件取 ws 地址
await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 720, deviceScaleFactor: 2, mobile: true });
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
```

- **点击必须走真实触摸管线**：`Input.dispatchTouchEvent` 的 `touchStart→touchEnd`，**禁止 JS 直调 onclick**——直调测不出事件绑定缺失、热区错位、覆盖遮挡这类真机才会暴露的问题。
- 导航后先 sleep 2.5s，再按场景标志（如 `.title-screen`）轮询就绪（40×250ms），超时即 DIE 并带 console 错误上下文。
- 资产路径按**网关部署形态**处理：产物经网关以 `assets/` 前缀伺服，html 入口形态会被 308 规范化（见 §8 缺陷②）。

## 3. 九项机器判定检查（基线集）

| id | 判据 |
|---|---|
| network | 关键资产经 375×720 仿真加载全 2xx、无 404/加载失败；html/css/main.mjs/scenes 齐备 |
| first-screen | 首屏标题渲染、开始按钮在视口内、`elementFromPoint` 命中自身、非 disabled |
| touch-start | touch 管线点「开始」生效（phase title→intro） |
| viewport | `scrollWidth ≤375` 且选项按钮完整在视口内（无横向溢出） |
| touch-event | 分支事件选项 touch 生效，且**连点 3 次只计 1 次**（防重判定反取证） |
| touch-train | 训练按钮 touch 生效且状态真实推进（如 vocal 10→16、actionsLeft 5→4） |
| touch-pipeline | 全程 touch 主循环推进至结局判定（phase=ended、舞台场次、touch 步数全生效） |
| hotzone | 可点按钮**两两无重叠**且高度 ≥40px（多阶段采样，报最矮值） |
| console | 全流程 console 零 error（warning 仅计数不判失败） |

每个检查项落 `checks[{id,name,pass,detail}]`，detail 必须带**可核查的量化证据**（命中坐标、尺寸、前后状态值），不许只写「通过」。

## 4. 分阶段截图规范

-

（装配注入已截断，全文 5629 字符：需要完整内容时用 search_knowledge 检索）

## 僵尸/孤儿运行轨迹识别与处置手册（status=failed 不可单独为凭）

# 知识：僵尸/孤儿运行轨迹的识别与处置

## 背景
运行（run）的真实状态与已落库的轨迹（trajectory）记录可能失步，平台用「自愈清理」把这类孤儿记录强制归为 failed。这造成大量「假失败」：运行实际被取消/超时/暂停，轨迹却显示 failed，干扰失败统计与工作流评测。该问题在多个项目（心伴、MyRD Playground）跨多天反复出现，命中 85+ 条记忆记录。

## 现象
- 运行被取消后留下轨迹并被标记 failed（常见于取消的 workflow 运行，如心伴前端转换节点的 cancelled 运行被误报为失败）。
- 执行超时未结束、run 已 paused/failed 但轨迹未同步，被自愈清理标记为 failed。
- 报错形如「No conversation found with session ID: ...」或「执行超时未结束，启动自愈清理为 failed」。
- 归因时出现「Agent 退出码 0 但未产生 git commit」之类的伪失败（见内容节点 skipGitCheck 规范）。

## 根因
run 状态与轨迹持久化的执行上下文不同步：取消、超时、暂停等路径没有及时把轨迹状态对齐到真实 run 状态，系统以自愈清理兜底归为 failed。

## 识别与处置步骤
1. 看到 status=failed 时，先不要认定 agent 失败。用 runId 与轨迹/会话记录交叉验证：该 run 是否真的执行过？是否被用户/调度取消？是否超时？
2. 检查磁盘持久化产物：若 run 已产出文件且内容完整，即使状态为 failed 也说明实际成功过，应视为成功而非失败。
3. 区分三类伪失败：SIGINT 基础设施中断、取消产生的僵尸轨迹、skipGitCheck 未设置的 git 校验误判；真实失败应具备「有明确工具错误 / 无产物」特征。
4. 避免重试风暴：对已确认为僵尸/误报的 failed 不做自动重试。
5. 长期修复：确认所有执行入口统一收敛到同一 pipeline，使状态快照与轨迹持久化保持一致。

## 预防
- 新增 workflow/节点时检查 skipGitCheck 与持久化配置。
- 取消运行后留意残留轨迹，优先用 runId 交叉核验再下结论。
- 归因报告须引用 runId 而非仅引用 status 字段。

## 沉淀知识：《今日汇率》Web 工坊上线受阻实录——webapp-smoke 门禁资产双缺口、fail-closed 拦截与恢复路径（附 HostedApp/deployment/liveUrl 三要素核实）

# 《今日汇率》Web 工坊上线受阻实录：门禁资产双缺口、fail-closed 拦截与恢复路径

> 目标：创建 Web 应用《今日汇率》（goal `cmvaf7imr000jm94le9x48zfu`，projectId `proj-playground`，需求 id `cmvafe4gu0017m94la5mhgc3p`）。
> 本文全部结论均经平台 API / git 独立复核（2026-10-16），不复述、不臆造；复核方式见 §7。

## 1. 一句话结论

**应用没有上线，且不是败在代码，而是败在平台模板仓库缺两份门禁资产**：门禁判定脚本 `webapp-smoke.mjs` 与 `routines.yaml` 的 `id=webapp-smoke` routine 条目双双缺失，按「来源不可得 → 立即 blocked」硬约束，流水线三个实现节点全部纪律性停止（未建工程、未部署、未绕过），review 节点 pre-hook fail-closed 拦截，两次运行同因失败。**该目标的「上线三要素」中只有 HostedApp 壳存在，deployment id 与 liveUrl 不存在。**

## 2. 上线三要素核实表（本目标 artifacts 回写依据）

| 要素 | 状态 | 值 / 证据 |
|---|---|---|
| HostedApp id | ✅ 存在（壳，从未部署） | `cmvaf7imm000hm94lw6y43t0q`（name=今日汇率，slug=`myrdplaygrou`，runtime=sandbox，sourceType=workshop，status=`creating`，createdAt=2026-10-16T03:41:09Z，`deployments=[]`，`liveUrl=null`） |
| deployment id | ❌ 不存在 | `GET /api/v1/apphost/apps` 返回该应用 deployments 数组为空；goal artifacts 的 blocked 详情明确「部署 0 次」（三轮独立复验一致） |
| liveUrl | ❌ 不存在 | AppHost 记录 `liveUrl=null`。参照同项目已上线应用（如 farm-yard / game-5），补齐资产并部署成功后格式应为 `https://leomac-studio.tail49399e.ts.net/apps/myrdplaygrou/` |

要点：AppHost 壳是 express_lane 预检节点（早于工作流运行约 48 分钟）预建的，**不代表工程已落地**——`webapps/myrdplaygrou/` 工程目录从未创建。任何下游环节不得把「壳存在」误读为「已部署」。HostedApp id 已作为 `artifactType=hosted_app` 关联回写至 goal artifacts（含三轮 blocked 复验全记录），deployment id / liveUrl 因客观不存在而无法回写，**不臆造补位**。

## 3. 失败链全景（时间线）

1. **2026-10-16 03:41** express_lane 预检完成，预建 AppHost 壳 `cmvaf7imm000hm94lw6y43t0q`（status=creating）。
2. **04:29–04:41** 工作流运行 `cmvagxyf3002em94lxhtab3p9`（同型前次运行 `cmvafm2y5001km94leiaezgid`，同样结局）：
   - **scaffold 节点（completed，结论 blocked）**：核验门禁资产双缺口，落盘 `.myrd/blocked-report.md` 并推送（commit `9eafc4d`，分支 `myrd/fx-app-goal-cmvaf7imr000jm94le9x48zfu`）。未建工程、未落风格卡、未改 routines.yaml。
   - **implement 节点（completed，结论 blocked）**：独立复验后同一结论，追加 blocked 报告（commit `74c749a`）。未建工程、未自造判定器。另核实同目标两条兄弟分支 `myrd/web-goal-…`、`myrd/myrdplaygrou-goal-…` 均无可复用产出。
   - **deploy/发布节点（completed，结论 blocked）**：第三轮复验（`git fetch --prune` 后 origin/main 仍停在 `6c0df4a9`），仍是双缺口，

（装配注入已截断，全文 5767 字符：需要完整内容时用 search_knowledge 检索）

## 沉淀知识：《今日汇率》前端定时更新方案与数据源契约——「多天不更新」六缺口根因与修复 · 30min TTL/定时/手动三路刷新 · 缓存→种子兜底链（er-api/frankfurter 实测契约 · 含 artifacts 回写）

# 《今日汇率》前端定时更新方案与数据源契约（「多天不更新」根因修复 · 实测可复用）

> 目标 `cmvaf7imr000jm94le9x48zfu`（创建 Web 应用《今日汇率》）· 数据鲜度需求 `cmveivn9n000wm9vq3h575b78` · 工作流运行 `cmveiw7540013m9vqlgj9t6ul`（全四棒 completed）· 分支 `myrd/fx-app-goal-cmvaf7imr000jm94le9x48zfu` · 工程 `webapps/myrdplaygrou`
> 本文全部结论经平台 API / git / 线上实调独立复核（2026-10-19），不复述不臆造；姊妹篇（上线受阻与门禁资产恢复）见知识库 `ed7d2bbf-ca19-46f5-b5d1-c7b9db2d85b9`。

## 1. 一句话结论

「多天不更新」的根因**不是静态汇率快照**（工程内零静态汇率常量），而是旧版前端缺整套鲜度机制——**六个缺口叠加**：缓存无 TTL 判定、无定时刷新、无手动刷新、无种子兜底、`AbortSignal.timeout` 兼容风险、鲜度展示错位。修复后形成「**30 分钟 TTL + 30 分钟 interval + 手动强刷**三路更新、**缓存→内置种子**两级兜底」的纯前端方案（commit `fa67dc3` → 部署 v13 → 色板对齐 `45d02f1` → 线上 v15），门禁与移动验收全绿。

## 2. 执行链与产出锚点

| 环节 | 产出 | 证据 |
|---|---|---|
| scaffold | 根因基线六条 + 部署契约四条移交（`.myrd/scaffold-handoff.md`）；门禁资产双缺口已由模板仓库补齐（`9fbc1dc`），不再 blocked | commit `3b30d36` |
| implement | 鲜度机制全量实现（5 文件 +225/-44），根因留痕 `.myrd/implement-notes.md`；CDP 功能自测 14/14，并**附带修复一个真实换算 bug** | commit `fa67dc3` |
| deploy | 色板逐 token 对齐流水线硬约束 `#f0f9ff/#0ea5e9/#22c55e`（薄荷→天蓝，布局/触控不动）；部署 v15；门禁对 liveUrl PASS；证据归档 | commit `45d02f1`、`b5b42d8` |
| review | REVIEW-KIT 更新至 v15；goal artifacts 回写至 12 条；如实记录三处待观察项 | commit `5d8f838` |
| 部署三要素 | HostedApp `cmvaf7imm000hm94lw6y43t0q`（status=ready）· deployment `cmvek09sb001gm9vqf7tn7q9f`（**v15 现役**，commit `45d02f1`；v13 `cmvejnc41001bm9vqikbuvp1i`=fa67dc3 已被取代）· liveUrl `https://leomac-studio.tail49399e.ts.net/apps/myrdplaygrou/` | 2026-10-19 实测线上 app.js 含 `FRESH_TTL_MS`、favicon `#0ea5e9` |

## 3. 「多天不更新」根因：六缺口叠加（含排除法取证）

**取证方法（可复用）**：修复前 HEAD 上 `grep -rnE '"USD": *[0-9]|rates *= *\{|SEED' *.js *.html` 为空 → 排除「静态快照打进包」；旧版每次冷加载都会 fetch（线上 Network 可见）→ 用户所见过期数据的真实成因只能在前端鲜度机制缺失。六缺口与修复对照：

| # | 缺口 | 修复前（活跃部署 13dec1c） | 修复后（fa67dc3） |
|---|---|---|---|
| 1 | 缓存无 TTL 过期判定 | `fx-latest-v1` 存了 `fetchedAt` 但全文件无过期比较，缓存只在 fetch 抛错时被读 | `isExpired()`：`!Number.isFinite(fetchedAt) \|\| Date.now()-fetchedAt > FRESH_TTL_MS`，TTL=30min |
| 2 | 无 interval 定时刷新 | 生命周期只在 init 拉一次 | `setInterval(refreshLatest({force:true}), 30min)` 与 TT

（装配注入已截断，全文 7978 字符：需要完整内容时用 search_knowledge 检索）

## 沉淀知识：《今日汇率》前端定时更新方案与数据源契约——「多天不更新」根因、TTL/刷新参数、兜底链与门禁验收实录（含 artifacts 回写）

# 《今日汇率》前端定时更新方案与数据源契约

> 目标 `cmvaf7imr000jm94le9x48zfu` · 数据鲜度需求 `cmveivn9n000wm9vq3h575b78` · v2 工坊流水线运行 `cmveiw7540013m9vqlgj9t6ul`（completed，scaffold/implement/deploy/review 四节点全绿）。
> 本文全部参数取自**线上 app.js 实抓**（2026-10-19，`/apps/myrdplaygrou/api/public/assets/app.js`，429 行）、平台 API 与仓库提交，独立复核命令见 §9。前序背景（门禁资产双缺口与恢复）见姊妹篇《今日汇率 Web 工坊上线受阻实录》（ed7d2bbf-ca19-46f5-b5d1-c7b9db2d85b9）。

## 1. 一句话结论

「多天不更新」**不是静态汇率快照打进包里**，而是前端缺整套鲜度机制（六个缺口叠加，见 §2）。修复为纯前端方案：open.er-api.com 免 key CORS 直连 + localStorage 30 分钟 TTL 过期判定 + 停留期 30 分钟定时强刷 + 手动刷新按钮（force 跳过 TTL）+「缓存→内置种子」三级兜底 + 溯源行常显。已上线 v15（commit `45d02f1`），生产环境 webapp-smoke 门禁 PASS，门禁截图首屏实拉到当日实时数据。

## 2. 根因定位（需求验收 5 的留痕结论）

**排除项**：工程内 grep 无任何静态汇率常量，旧版每次冷加载都会 fetch——「静态快照打进包」假设被证伪。

**真根因 = 六缺口叠加**（① 是「多天不更新」的主因）：

1. **缓存无 TTL 过期判定**：localStorage 里 `fetchedAt` 存而不校验 → 「缓存永不过期」，一次成功拉取后永远用旧值；
2. **无 interval 定时刷新**：页面停留多久都不会重新拉取；
3. **无手动刷新按钮**：用户没有强制重取入口；
4. **无内置种子兜底**：断网且无缓存时直接空屏；
5. **`AbortSignal.timeout` 旧 WebView 兼容风险**：超时助手在不支持该 API 的内核直接抛异常，拉取静默失败后落入缺口 ① 的永不过期缓存；
6. **鲜度展示错位**：界面显示「本地获取时刻」而非汇率数据自身日期，旧数据也显示成刚更新，掩盖了问题。

根因基线留痕：`webapps/myrdplaygrou/.myrd/scaffold-handoff.md`（六条 + 部署契约四条）与 `.myrd/implement-notes.md`。

## 3. 数据源契约（两源均免 key、CORS 开放、前端直连，无代理无后端）

| 用途 | 端点 | 契约要点 | 实测（2026-10-19） |
|---|---|---|---|
| 最新汇率 | `https://open.er-api.com/v6/latest/{base}` | `result=success` 才可用；`base_code` 回显基准币；`time_last_update_utc` 是数据自身日期（渲染「数据日期」的权威来源，勿用本地时钟）；`rates` 全量字典 | base=USD：**166 币种**，更新于 00:02:32 UTC，CNY=6.69274 / EUR=0.890861 / JPY=157.911394；`time_next_update_utc`=次日（免费档每日一更） |
| 趋势序列 | `https://api.frankfurter.dev/v1/{start}..{end}?base=..&symbols=..` | ECB 参考汇率，免 key；日期区间语法 `{start}..{end}`；周末无报价，前端需容忍缺日 | 由线上 app.js 头注释与 `fetchTrend` 实现确认 |

**选型含义**：两源都不需要服务器中转，HostedApp 静态壳即可承载；CORS 均开放，无需 JSONP/代理/后端。
**重要推论**：er-api 免费档每日一更，所以「30 分钟刷新」刷的是**请求**，汇率值一天最多变一次——界面文案必须据实标注「数据日期」而非「实时秒级」，这也是溯源行存在的意义。

## 4. 缓存与刷新参数（线上 app.js 常量区原文，调参只动这一区）

| 参数/键 | 值 | 语义 |
|---|---|---|
| `LS_KEYS.prefs / latest / trend` | `fx-pr

（装配注入已截断，全文 7198 字符：需要完整内容时用 search_knowledge 检索）

---

# 换行验证产品

验证 summary 每项换行


## 关联项目

### 心伴 [frontend]

项目名: 心伴
描述: ai 情绪陪伴
类型: mobile
GitHub: https://github.com/hl3w22bupt/odbo
工作流类型: cmqc71gii0005m9uni8nwb6j3

### MyRD Playground [mobile]

项目名: MyRD Playground
描述: MyRD 功能测试和沙盒环境
类型: web-app
GitHub: https://github.com/hl3w22bupt/myrd-playground.git
工作流类型: cmqc5q1ne0005m98t740g0eh9


---


## 产品关联知识

## 情绪陪伴 App 产品调研框架

## 情绪陪伴 App 产品调研分析框架

### 背景
MyRD Admin 提出设计一款以"情绪价值"为核心的陪伴类 App，并引入游戏化交互机制。PD-Agent 就此进行了系统性调研分析。

### 市场与竞品分析
- **现有格局**：冥想类（Headspace、Calm）、日记记录类（Daylio）、虚拟陪伴类（Replika、Character.AI）App 已在市场存在，但多数偏"工具属性"，缺乏有深度的互动体验
- **差异化机会**：游戏化交互是关键的破局点，将情绪调节转化为"养成类 RPG"或"模拟经营"式体验

### 用户需求画像
- **目标人群**：Z 世代及年轻职场人，面临孤独感或高压，排斥传统说教式心理咨询
- **核心诉求**："被理解"、"被陪伴"以及"低压力的情绪宣泄口"，而非"治疗"

### 游戏化交互机制（核心差异化）
- **情绪映射**：将用户抽象情绪（文字、语音、表情）转化为游戏内数值或视觉反馈
  - 示例：用户开心时虚拟家园天气变晴；用户焦虑时出现需要安抚的小怪兽
- **正向反馈循环**：通过"情绪打卡"或"互助任务"解锁装扮、剧情或虚拟互动
- **方向待定**：AI 虚拟伴侣养成 vs 个人情绪花园经营

### 技术可行性
- 涉及 NLP 自然语言处理进行情绪识别
- 高保真游戏化 UI/UX 设计
- 通用技术选型方向待进一步确定

### 伦理与合规风险
- 需明确界定"陪伴"与"心理咨询"的边界
- 避免用户过度依赖及潜在法律风险

### 商业模式探讨
- 订阅制 / 内购制 / 广告变现 待评估

### 后续调研方向
1. 竞品深度拆解：挑选 2-3 款 AI 聊天+游戏元素的应用进行分析
2. MVP 核心功能定义
3. 商业模式确定

## 项目开发规范

# 项目开发规范

## 代码风格
- 使用 TypeScript
- - 遵循 ESLint 规范
- 提交前运行 lint 检查

## Git 提交规范
- 使用 Conventional Commits 格式
- feat: 新功能
- fix: 修复 bug
- docs: 文档更新

## MyRD 平台能力与环境事实源（Agent 防臆造基线 · 2026-09-26 主人核定）

# 目的
本档是平台环境与能力的唯一权威事实源。Agent 在做环境探针、资源盘点、执行决策前，以本档为准；与本档冲突的任何转述、往轮记录、黑板条目一律按本档勘误。

## 一、常驻服务与端口（全部）
- 后端平台 API：http://localhost:3111（env PLATFORM_API_URL 指向它）
- 前端 Web：3001
- PostgreSQL：5432（库名 myrd）
- 除此之外**不存在任何常驻平台服务**。特别地：**平台从未内置「Open Design / 设计工作台 daemon」，127.0.0.1:7456 无任何服务**。该说法源于 2026-09-11 一轮讨论中的臆测（随后被「交叉探针」误证实并写入黑板），已经主人 2026-09-26 核实销案。禁止再将其列为依赖、探针项或环境阻塞证据。

## 二、团队讨论 → 执行 → 部署的真实链路
1. 团队讨论收敛出 decidedAction（workflow / assign / pending）。
2. decidedAction=workflow：平台**自动**启动团队默认工作流（lead 无需也无法手动调用引擎）。
3. 部署（AppHost 导出 + 托管发布）**只发生在工作流的 deploy 节点**；assign 指派执行、纯讨论轮都不会触发部署。
4. 判定某轮工作流的真实结局，唯一依据是 workflow run 的状态（completed / failed / running，见运行卡片），**「已启动」≠「已成功」**；无结局信息时如实写「结局未知」，禁止脑补「被中断/断点未知」。

## 三、身份与权限
- 工作流节点的平台身份 = 工作流触发人（triggeredByUserId）。
- assign 指派执行 = 成员 agent 本人身份；平台会在编排启动时幂等补齐其在绑定项目的成员资格。
- 若仍遇「非项目成员」「项目列表为空/注册表 0 仓库」类报错：属平台 bug 或权限缺口，正确做法是**如实上报等待修复**，不得自行降级为「环境不可用、改做纸面件」，也不得据此宣称整体环境故障。

## 四、当前部署台账（stack-tower，2026-09-26 核对）
- 坑位：appId cmugttipt000km9299oej5z9b · slug stack-tower-3（一游戏一坑，禁止再建）
- liveUrl：https://leomac-studio.tail49399e.ts.net/apps/stack-tower-3/gw
- 线上版本：commit 75debf9（2026-09-25 部署，M2.1「有声可装」全量含音效/移动端/PWA，线上冒烟 PASS）
- 平台 spec 链：v1→v2→v3（v3 approved，id cmugok2uz000xm9ilx42t8pnl）；spec v1.1「登记就绪版」截至 2026-09-26 仍为纸面文件（.myrd/spec/stack-tower-spec-v1.1-ready.yaml），**尚未登记**，登记落点 = POST revisions 接在 v3 之后 version+1。
- 分支：myrd/pixel-fives-m0-m1-cmtpb66pe000rm9e2ozdurf8d（远端 head 541323a > 线上 75debf9，差异均为 docs 提交，不影响游戏构建）。

## 五、历史误报档案（不得再引用为环境基线）
- 「Open Design daemon 127.0.0.1:7456 不可达」：幻觉 + 交叉误证实，销案（2026-09-26）。
- 「代码图谱注册表 0 个注册仓库」（2026-09-11~09-26 多轮）：成员 agent 缺项目成员资格所致（2026-09-26 已修），非仓库缺失。
- 「M2.1 执行被中断、断点位置未知」（2026-09-26 补跑轮）：往轮摘要缺执行结局导致的脑补，实际 M2.1 已于 2026-09-25 完成并部署上线。


## 架构设计文档

# 架构设计

## 技术栈
- 前端：Next.js + React + TypeScript
- 后端：Motia (iii 引擎)
- 数据库：PostgreSQL + Prisma

## 模块划分
- 项目管理模块
- 任务管理模块
- 知识库模块

## 需求池功能说明

# 需求池功能

## 功能说明
需求池用于管理产品需求、Bug 修复、功能改进等任务。

## 状态流转
- backlog: 待办需求
- todo: 已计划
- in-progress: 进行中
- review: 评审中
- done: 已完成
- archived: 已归档

## 沉淀知识：Godot 4 Web 导出移动端触屏虚拟摇杆与 AudioContext 解锁规范

# Godot 4 Web 导出移动端触屏虚拟摇杆与 AudioContext 解锁规范（game-5 实测沉淀）

> 来源：需求《森林收集水果限时赛（game-5）》（id=cmuipol63006rm9l6cp2ww5r5）走完工坊流水线（实现 → 门禁 → Web 导出 → 部署 → 红队对抗验收）后，红队在线上版本实锤缺陷「移动端左右上下移动键不起作用 + 全程无音效」（bug id=cmujiqsk0000gm99if1vzc1eg）。本文把修复与防复发所需的机制结论固化为规范，供 game-5 迭代及后续 Godot Web 小游戏直接套用。机制层结论引自三篇引擎级实测知识（见 §六关联）；玩法数值以《game-5 玩法设计要点》（id=6e91a11d-3632-4721-a3ea-d433e9622f9b）为权威基准，本文不重复其数值。

## 一、结论速览

| # | 要点 | 一句话规范 | 错误修法（禁止） |
| --- | --- | --- | --- |
| 1 | 触屏是一等输入 | 移动端必须提供虚拟摇杆或四向按钮，并与键盘汇入**同一个移动向量出口**；摇杆在 `_input` 阶段接管触点 | 只绑定键盘 action 就指望触屏能用；摇杆逻辑写在 `_unhandled_input`；用 InputEventAction 转发移动输入 |
| 2 | 音频必须手势解锁 | Web 端音频只在**首个真实用户手势调用栈内**解锁并出第一声；解锁前事件只记账不播放 | 在 `_ready` 里直接 play BGM；GDScript 置「已解锁」标志位就当解锁完成 |
| 3 | 60 秒局内节奏 | 连击=窗口刷新式、难度=绑定剩余时间的线性插值、供给=铺场+补货（数值见 6e91a11d） | 连击做固定总窗；难度递增绑定已生成数量 |

## 二、触屏输入：虚拟摇杆 / 四向按钮规范

### 2.1 为什么移动端「方向键失灵」

- 桌面键盘 action（WASD / 方向键）在触屏上**没有物理触发源**：若移动代码只读 `Input.is_action_pressed(...)` 且这些动作只绑定了键盘键，触屏端输入向量恒为 (0,0)——表现为四向全失灵，且**控制台零报错**（不是崩溃，是静默无输入）。
- 两个引擎级陷阱（Godot 4.3 实测探针 + 源码钉死，见知识 36d39401）：
  - **E-18**：触摸事件分发顺序固定为 `_input → GUI 命中 → _unhandled`。Control 若 `mouse_filter=STOP`，落在自身矩形内的触摸会在 GUI 命中阶段被消费，永远到不了它自己的 `_unhandled_input` → 摇杆「整体推不动」，还会把触摸漏给下层按钮造成误交互。
  - **E-19**：同帧多个 `InputEventAction` 会互踩清零（Input 对每个 action 事件都写所有动作的槽位）→ 斜向拖拽只剩一个轴。**移动输入禁止走 InputEventAction 转发。**

### 2.2 推荐实现形态

**虚拟摇杆（Control 自研，首选）**

1. 在 **`_input` 阶段**处理 `InputEventScreenTouch` / `InputEventScreenDrag`（引擎里唯一保证先于 GUI 命中的阶段），接管后 `set_input_as_handled()` 同时阻断 GUI 与 unhandled。
2. 初始按下必须落在摇杆矩形内才接管；接管后滑出矩形照常续跟（拖拽不失联）。
3. `touch_index` 单指跟踪：第二根手指不抢控；加 `is_visible_in_tree()` 守卫，隐藏的摇杆不得抢按任何触摸。
4. 保留 `mouse_filter=STOP`：让 `emulate_mouse_from_touch` 合成出的鼠标事件在 GUI 层被摇杆吃掉，不漏成第二次交互。
5. 输出：以基座中心为原点的归一化向量 + 死区（建议 0.15~0.25），模长 clamp 到 1；y 轴向下为正，与 `Input.get_vector` 口径一致。
6. 视觉：半透明常驻左下（基座 + 拇指帽），按下时拇指帽跟随触点——常驻可见是可发现性要求，不用时降透明度但不下线。

**四向按钮（TouchScreenButton，简化替代）**

- 适合四向/格子化移动；单指按下即全速方向，双指可合成斜向。
- 热区 ≥ 48px（CSS px，注意 DPR 换算，见知识 649e691d），按钮间距留防误触边距。
- 用 `TouchS

（装配注入已截断，全文 5992 字符：需要完整内容时用 search_knowledge 检索）

## 沉淀 Godot 4 Web 导出与 godot-smoke 门禁 + AppHost 部署全链路实战经验（oak-key 取证探针实测）

# Godot 4 Web 导出 + godot-smoke 门禁 + AppHost 部署全链路实战经验（oak-key 取证探针实测）

> 来源：需求《oak-key 有效性探针小游戏（取证探针，不计入三样例）》（id=cmupslvp7002gm9dh42h3maq5，goal=cmupsfn0q001um9dhlko9t5e0）走完「scaffold → implement → AppHost 壳接入 + Web 导出 → 部署 → 线上终态独立复核」全流程后的沉淀。仓库：github.com/hl3w22bupt/myrd-playground，工程落位 `games/oak-key`（Godot 4.3.stable.official.77dcf97d8）。线上终态：liveUrl `https://leomac-studio.tail49399e.ts.net/apps/oak-key/`（308→200、资源 404=0、真实浏览器完成拾取→校验→反馈闭环）。本文只写「门禁怎么搭、打回了怎么修、导出怎么配、部署怎么走」，玩法数值与移动端触屏/音频规范见 §八关联知识，不重复。

## 一、godot-smoke 门禁体系：三层机判 + 退出码纪律

### 1.1 三层结构（缺一层就有漏网）

| 层 | 判定器（仓库内 std-skills/godot-game-dev/scripts/） | 拦什么 | 耗时量级 |
| --- | --- | --- | --- |
| ① preflight 静态一致性 | `preflight.py <工程>` | P1~P13 共 13 类「必然黑屏」类缺陷（路径悬空、ext_resource 声明失配、场景 parent 不可解析、class_name 重复、uid 无声明、Godot3 残留语法、代码级 connect 目标方法缺失、Web 端中文缺字体等），运行前秒级拦下 | 秒级 |
| ② headless-smoke | `GODOT_SMOKE_FRAMES=240 GODOT_BIN=$(bash scripts/resolve-godot.sh) bash scripts/smoke.sh <工程>` | 「能不能跑且玩得动」：headless 导入 + 运行冒烟场景，断言**退出码 0 与 `GODOT_SMOKE: PASS` 标记同时成立**，且 PASS 分支同样扫 `SCRIPT ERROR\|Parse Error`（E-16 带病绿灯） | 秒级~十秒级 |
| ③ input-fuzz | `input-fuzz.sh <工程>` | 确定种子（如 seed=20260913，6 批 239 帧）随机事件序下不崩溃、无脚本错误、主循环不挂死 | 十秒级 |

分工口径：**能在运行前拦的绝不留到运行后**（preflight）；只有运行期才能证实的（输入真的动了、信号真的送达、无每帧刷屏错误）交给冒烟。「噪声后玩法断言仍通过」的语义不变式写在工程内 `tests/smoke.gd`（模板内置），与 fuzz 层互补——两层合起来才覆盖「输入状态残留」类缺陷（实例：跨关卡指针状态泄露导致下一关首手势被吞）。

### 1.2 退出码语义（routine 引擎只认命令退出码，语义必须钉死）

- `0` 通过；`1` 冒烟/fuzz 失败 → 由目标执行引擎 `reject` **打回修复循环**，修复预算即工作流 `maxLoops`，修复动作查 error-signatures 表；`2` 环境不可用（没装 Godot / 缺技能脚本 / 缺 python3）→ **装环境，禁止为过门禁改代码**。
- 工程 `verify.sh` 把 preflight 失败单独编为 `3`（静态不一致 → 先修静态，不必跑冒烟），并对四个判定脚本做**存在性守卫先行判 2**——否则「技能脚本缺失」会掉进下游非零退出码被误判成 3，诱导修复节点去改游戏代码（守卫是防误诊的关键一行）。
- 判定器唯一来源是仓库内 `std-skills/godot-game-dev/scripts/`（与 `.myrd/routines.yaml` 同源同参）；平台注入的 `.myrd-platform/.claude/skills/...` 只是阅读副本。**被检工程不得自造判定器**（playtest.sh 未预置时宁可如实上报缺口，也不做等价替代）。

### 1.3 routine 参数化（第二个游戏接入时最容易翻车的点）

`godot-smoke` routine 必须把 `{{gamePath}}`/`{{smokeFrames}}` 参数化，工

（装配注入已截断，全文 11096 字符：需要完整内容时用 search_knowledge 检索）

## 小游戏移动端模拟门禁取证 SOP：375w 仿真、分阶段截帧与 report.json 证据契约（范例 games/talent-nurture）

# 小游戏移动端模拟门禁取证 SOP

> 把小游戏「上线前移动端机器取证」固化为可复跑、可归档、可回放的门禁流程。范例与判例出处：才艺养成 Demo「星光练习生：才艺养成物语」，`games/talent-nurture/tools/smoke-mobile.mjs` + `qa/mobile/`，2026-10-24 收口于提交 `5f729c7`（分支 `myrd/talent-nurture-goal-*`），9/9 项 PASS。后续小游戏上线门禁直接照此复用。

## 1. 定位与边界

- **是什么**：对**线上 liveUrl**（AppHost 部署产物，非 localhost）做 375w 移动仿真的端到端取证，产出 `qa/mobile/report.json` + 分阶段截图，并 git 归档。作为小游戏「可上线」的机器可判门禁。
- **机器判定 ≠ 使用验收**：好玩/画面审美/四问量表等主观体验**不在机器取证范围**，report 的 `evidenceMethod.outOfScope` 必须显式声明「待用户试玩回填」，绝不能代填主观结论。
- **零 npm 依赖**：直接裸 CDP（WebSocket）驱动 headless Chrome，不引 puppeteer/playwright，脚本可在任何有 Chrome 的机器上跑。判例承同仓 `tools/smoke-live.mjs`（桌面版冒烟）。

## 2. 移动仿真口径（375w）

```js
const VIEWPORT = { w: 375, h: 720 };  // 竖屏基线，对应主流移动端最小宽
// headless Chrome：--headless=new --remote-debugging-port=0，从 DevToolsActivePort 文件取 ws 地址
await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 720, deviceScaleFactor: 2, mobile: true });
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
```

- **点击必须走真实触摸管线**：`Input.dispatchTouchEvent` 的 `touchStart→touchEnd`，**禁止 JS 直调 onclick**——直调测不出事件绑定缺失、热区错位、覆盖遮挡这类真机才会暴露的问题。
- 导航后先 sleep 2.5s，再按场景标志（如 `.title-screen`）轮询就绪（40×250ms），超时即 DIE 并带 console 错误上下文。
- 资产路径按**网关部署形态**处理：产物经网关以 `assets/` 前缀伺服，html 入口形态会被 308 规范化（见 §8 缺陷②）。

## 3. 九项机器判定检查（基线集）

| id | 判据 |
|---|---|
| network | 关键资产经 375×720 仿真加载全 2xx、无 404/加载失败；html/css/main.mjs/scenes 齐备 |
| first-screen | 首屏标题渲染、开始按钮在视口内、`elementFromPoint` 命中自身、非 disabled |
| touch-start | touch 管线点「开始」生效（phase title→intro） |
| viewport | `scrollWidth ≤375` 且选项按钮完整在视口内（无横向溢出） |
| touch-event | 分支事件选项 touch 生效，且**连点 3 次只计 1 次**（防重判定反取证） |
| touch-train | 训练按钮 touch 生效且状态真实推进（如 vocal 10→16、actionsLeft 5→4） |
| touch-pipeline | 全程 touch 主循环推进至结局判定（phase=ended、舞台场次、touch 步数全生效） |
| hotzone | 可点按钮**两两无重叠**且高度 ≥40px（多阶段采样，报最矮值） |
| console | 全流程 console 零 error（warning 仅计数不判失败） |

每个检查项落 `checks[{id,name,pass,detail}]`，detail 必须带**可核查的量化证据**（命中坐标、尺寸、前后状态值），不许只写「通过」。

## 4. 分阶段截图规范

-

（装配注入已截断，全文 5629 字符：需要完整内容时用 search_knowledge 检索）

## 僵尸/孤儿运行轨迹识别与处置手册（status=failed 不可单独为凭）

# 知识：僵尸/孤儿运行轨迹的识别与处置

## 背景
运行（run）的真实状态与已落库的轨迹（trajectory）记录可能失步，平台用「自愈清理」把这类孤儿记录强制归为 failed。这造成大量「假失败」：运行实际被取消/超时/暂停，轨迹却显示 failed，干扰失败统计与工作流评测。该问题在多个项目（心伴、MyRD Playground）跨多天反复出现，命中 85+ 条记忆记录。

## 现象
- 运行被取消后留下轨迹并被标记 failed（常见于取消的 workflow 运行，如心伴前端转换节点的 cancelled 运行被误报为失败）。
- 执行超时未结束、run 已 paused/failed 但轨迹未同步，被自愈清理标记为 failed。
- 报错形如「No conversation found with session ID: ...」或「执行超时未结束，启动自愈清理为 failed」。
- 归因时出现「Agent 退出码 0 但未产生 git commit」之类的伪失败（见内容节点 skipGitCheck 规范）。

## 根因
run 状态与轨迹持久化的执行上下文不同步：取消、超时、暂停等路径没有及时把轨迹状态对齐到真实 run 状态，系统以自愈清理兜底归为 failed。

## 识别与处置步骤
1. 看到 status=failed 时，先不要认定 agent 失败。用 runId 与轨迹/会话记录交叉验证：该 run 是否真的执行过？是否被用户/调度取消？是否超时？
2. 检查磁盘持久化产物：若 run 已产出文件且内容完整，即使状态为 failed 也说明实际成功过，应视为成功而非失败。
3. 区分三类伪失败：SIGINT 基础设施中断、取消产生的僵尸轨迹、skipGitCheck 未设置的 git 校验误判；真实失败应具备「有明确工具错误 / 无产物」特征。
4. 避免重试风暴：对已确认为僵尸/误报的 failed 不做自动重试。
5. 长期修复：确认所有执行入口统一收敛到同一 pipeline，使状态快照与轨迹持久化保持一致。

## 预防
- 新增 workflow/节点时检查 skipGitCheck 与持久化配置。
- 取消运行后留意残留轨迹，优先用 runId 交叉核验再下结论。
- 归因报告须引用 runId 而非仅引用 status 字段。

## 沉淀知识：《今日汇率》Web 工坊上线受阻实录——webapp-smoke 门禁资产双缺口、fail-closed 拦截与恢复路径（附 HostedApp/deployment/liveUrl 三要素核实）

# 《今日汇率》Web 工坊上线受阻实录：门禁资产双缺口、fail-closed 拦截与恢复路径

> 目标：创建 Web 应用《今日汇率》（goal `cmvaf7imr000jm94le9x48zfu`，projectId `proj-playground`，需求 id `cmvafe4gu0017m94la5mhgc3p`）。
> 本文全部结论均经平台 API / git 独立复核（2026-10-16），不复述、不臆造；复核方式见 §7。

## 1. 一句话结论

**应用没有上线，且不是败在代码，而是败在平台模板仓库缺两份门禁资产**：门禁判定脚本 `webapp-smoke.mjs` 与 `routines.yaml` 的 `id=webapp-smoke` routine 条目双双缺失，按「来源不可得 → 立即 blocked」硬约束，流水线三个实现节点全部纪律性停止（未建工程、未部署、未绕过），review 节点 pre-hook fail-closed 拦截，两次运行同因失败。**该目标的「上线三要素」中只有 HostedApp 壳存在，deployment id 与 liveUrl 不存在。**

## 2. 上线三要素核实表（本目标 artifacts 回写依据）

| 要素 | 状态 | 值 / 证据 |
|---|---|---|
| HostedApp id | ✅ 存在（壳，从未部署） | `cmvaf7imm000hm94lw6y43t0q`（name=今日汇率，slug=`myrdplaygrou`，runtime=sandbox，sourceType=workshop，status=`creating`，createdAt=2026-10-16T03:41:09Z，`deployments=[]`，`liveUrl=null`） |
| deployment id | ❌ 不存在 | `GET /api/v1/apphost/apps` 返回该应用 deployments 数组为空；goal artifacts 的 blocked 详情明确「部署 0 次」（三轮独立复验一致） |
| liveUrl | ❌ 不存在 | AppHost 记录 `liveUrl=null`。参照同项目已上线应用（如 farm-yard / game-5），补齐资产并部署成功后格式应为 `https://leomac-studio.tail49399e.ts.net/apps/myrdplaygrou/` |

要点：AppHost 壳是 express_lane 预检节点（早于工作流运行约 48 分钟）预建的，**不代表工程已落地**——`webapps/myrdplaygrou/` 工程目录从未创建。任何下游环节不得把「壳存在」误读为「已部署」。HostedApp id 已作为 `artifactType=hosted_app` 关联回写至 goal artifacts（含三轮 blocked 复验全记录），deployment id / liveUrl 因客观不存在而无法回写，**不臆造补位**。

## 3. 失败链全景（时间线）

1. **2026-10-16 03:41** express_lane 预检完成，预建 AppHost 壳 `cmvaf7imm000hm94lw6y43t0q`（status=creating）。
2. **04:29–04:41** 工作流运行 `cmvagxyf3002em94lxhtab3p9`（同型前次运行 `cmvafm2y5001km94leiaezgid`，同样结局）：
   - **scaffold 节点（completed，结论 blocked）**：核验门禁资产双缺口，落盘 `.myrd/blocked-report.md` 并推送（commit `9eafc4d`，分支 `myrd/fx-app-goal-cmvaf7imr000jm94le9x48zfu`）。未建工程、未落风格卡、未改 routines.yaml。
   - **implement 节点（completed，结论 blocked）**：独立复验后同一结论，追加 blocked 报告（commit `74c749a`）。未建工程、未自造判定器。另核实同目标两条兄弟分支 `myrd/web-goal-…`、`myrd/myrdplaygrou-goal-…` 均无可复用产出。
   - **deploy/发布节点（completed，结论 blocked）**：第三轮复验（`git fetch --prune` 后 origin/main 仍停在 `6c0df4a9`），仍是双缺口，

（装配注入已截断，全文 5767 字符：需要完整内容时用 search_knowledge 检索）

## 沉淀知识：《今日汇率》前端定时更新方案与数据源契约——「多天不更新」六缺口根因与修复 · 30min TTL/定时/手动三路刷新 · 缓存→种子兜底链（er-api/frankfurter 实测契约 · 含 artifacts 回写）

# 《今日汇率》前端定时更新方案与数据源契约（「多天不更新」根因修复 · 实测可复用）

> 目标 `cmvaf7imr000jm94le9x48zfu`（创建 Web 应用《今日汇率》）· 数据鲜度需求 `cmveivn9n000wm9vq3h575b78` · 工作流运行 `cmveiw7540013m9vqlgj9t6ul`（全四棒 completed）· 分支 `myrd/fx-app-goal-cmvaf7imr000jm94le9x48zfu` · 工程 `webapps/myrdplaygrou`
> 本文全部结论经平台 API / git / 线上实调独立复核（2026-10-19），不复述不臆造；姊妹篇（上线受阻与门禁资产恢复）见知识库 `ed7d2bbf-ca19-46f5-b5d1-c7b9db2d85b9`。

## 1. 一句话结论

「多天不更新」的根因**不是静态汇率快照**（工程内零静态汇率常量），而是旧版前端缺整套鲜度机制——**六个缺口叠加**：缓存无 TTL 判定、无定时刷新、无手动刷新、无种子兜底、`AbortSignal.timeout` 兼容风险、鲜度展示错位。修复后形成「**30 分钟 TTL + 30 分钟 interval + 手动强刷**三路更新、**缓存→内置种子**两级兜底」的纯前端方案（commit `fa67dc3` → 部署 v13 → 色板对齐 `45d02f1` → 线上 v15），门禁与移动验收全绿。

## 2. 执行链与产出锚点

| 环节 | 产出 | 证据 |
|---|---|---|
| scaffold | 根因基线六条 + 部署契约四条移交（`.myrd/scaffold-handoff.md`）；门禁资产双缺口已由模板仓库补齐（`9fbc1dc`），不再 blocked | commit `3b30d36` |
| implement | 鲜度机制全量实现（5 文件 +225/-44），根因留痕 `.myrd/implement-notes.md`；CDP 功能自测 14/14，并**附带修复一个真实换算 bug** | commit `fa67dc3` |
| deploy | 色板逐 token 对齐流水线硬约束 `#f0f9ff/#0ea5e9/#22c55e`（薄荷→天蓝，布局/触控不动）；部署 v15；门禁对 liveUrl PASS；证据归档 | commit `45d02f1`、`b5b42d8` |
| review | REVIEW-KIT 更新至 v15；goal artifacts 回写至 12 条；如实记录三处待观察项 | commit `5d8f838` |
| 部署三要素 | HostedApp `cmvaf7imm000hm94lw6y43t0q`（status=ready）· deployment `cmvek09sb001gm9vqf7tn7q9f`（**v15 现役**，commit `45d02f1`；v13 `cmvejnc41001bm9vqikbuvp1i`=fa67dc3 已被取代）· liveUrl `https://leomac-studio.tail49399e.ts.net/apps/myrdplaygrou/` | 2026-10-19 实测线上 app.js 含 `FRESH_TTL_MS`、favicon `#0ea5e9` |

## 3. 「多天不更新」根因：六缺口叠加（含排除法取证）

**取证方法（可复用）**：修复前 HEAD 上 `grep -rnE '"USD": *[0-9]|rates *= *\{|SEED' *.js *.html` 为空 → 排除「静态快照打进包」；旧版每次冷加载都会 fetch（线上 Network 可见）→ 用户所见过期数据的真实成因只能在前端鲜度机制缺失。六缺口与修复对照：

| # | 缺口 | 修复前（活跃部署 13dec1c） | 修复后（fa67dc3） |
|---|---|---|---|
| 1 | 缓存无 TTL 过期判定 | `fx-latest-v1` 存了 `fetchedAt` 但全文件无过期比较，缓存只在 fetch 抛错时被读 | `isExpired()`：`!Number.isFinite(fetchedAt) \|\| Date.now()-fetchedAt > FRESH_TTL_MS`，TTL=30min |
| 2 | 无 interval 定时刷新 | 生命周期只在 init 拉一次 | `setInterval(refreshLatest({force:true}), 30min)` 与 TT

（装配注入已截断，全文 7978 字符：需要完整内容时用 search_knowledge 检索）

## 沉淀知识：《今日汇率》前端定时更新方案与数据源契约——「多天不更新」根因、TTL/刷新参数、兜底链与门禁验收实录（含 artifacts 回写）

# 《今日汇率》前端定时更新方案与数据源契约

> 目标 `cmvaf7imr000jm94le9x48zfu` · 数据鲜度需求 `cmveivn9n000wm9vq3h575b78` · v2 工坊流水线运行 `cmveiw7540013m9vqlgj9t6ul`（completed，scaffold/implement/deploy/review 四节点全绿）。
> 本文全部参数取自**线上 app.js 实抓**（2026-10-19，`/apps/myrdplaygrou/api/public/assets/app.js`，429 行）、平台 API 与仓库提交，独立复核命令见 §9。前序背景（门禁资产双缺口与恢复）见姊妹篇《今日汇率 Web 工坊上线受阻实录》（ed7d2bbf-ca19-46f5-b5d1-c7b9db2d85b9）。

## 1. 一句话结论

「多天不更新」**不是静态汇率快照打进包里**，而是前端缺整套鲜度机制（六个缺口叠加，见 §2）。修复为纯前端方案：open.er-api.com 免 key CORS 直连 + localStorage 30 分钟 TTL 过期判定 + 停留期 30 分钟定时强刷 + 手动刷新按钮（force 跳过 TTL）+「缓存→内置种子」三级兜底 + 溯源行常显。已上线 v15（commit `45d02f1`），生产环境 webapp-smoke 门禁 PASS，门禁截图首屏实拉到当日实时数据。

## 2. 根因定位（需求验收 5 的留痕结论）

**排除项**：工程内 grep 无任何静态汇率常量，旧版每次冷加载都会 fetch——「静态快照打进包」假设被证伪。

**真根因 = 六缺口叠加**（① 是「多天不更新」的主因）：

1. **缓存无 TTL 过期判定**：localStorage 里 `fetchedAt` 存而不校验 → 「缓存永不过期」，一次成功拉取后永远用旧值；
2. **无 interval 定时刷新**：页面停留多久都不会重新拉取；
3. **无手动刷新按钮**：用户没有强制重取入口；
4. **无内置种子兜底**：断网且无缓存时直接空屏；
5. **`AbortSignal.timeout` 旧 WebView 兼容风险**：超时助手在不支持该 API 的内核直接抛异常，拉取静默失败后落入缺口 ① 的永不过期缓存；
6. **鲜度展示错位**：界面显示「本地获取时刻」而非汇率数据自身日期，旧数据也显示成刚更新，掩盖了问题。

根因基线留痕：`webapps/myrdplaygrou/.myrd/scaffold-handoff.md`（六条 + 部署契约四条）与 `.myrd/implement-notes.md`。

## 3. 数据源契约（两源均免 key、CORS 开放、前端直连，无代理无后端）

| 用途 | 端点 | 契约要点 | 实测（2026-10-19） |
|---|---|---|---|
| 最新汇率 | `https://open.er-api.com/v6/latest/{base}` | `result=success` 才可用；`base_code` 回显基准币；`time_last_update_utc` 是数据自身日期（渲染「数据日期」的权威来源，勿用本地时钟）；`rates` 全量字典 | base=USD：**166 币种**，更新于 00:02:32 UTC，CNY=6.69274 / EUR=0.890861 / JPY=157.911394；`time_next_update_utc`=次日（免费档每日一更） |
| 趋势序列 | `https://api.frankfurter.dev/v1/{start}..{end}?base=..&symbols=..` | ECB 参考汇率，免 key；日期区间语法 `{start}..{end}`；周末无报价，前端需容忍缺日 | 由线上 app.js 头注释与 `fetchTrend` 实现确认 |

**选型含义**：两源都不需要服务器中转，HostedApp 静态壳即可承载；CORS 均开放，无需 JSONP/代理/后端。
**重要推论**：er-api 免费档每日一更，所以「30 分钟刷新」刷的是**请求**，汇率值一天最多变一次——界面文案必须据实标注「数据日期」而非「实时秒级」，这也是溯源行存在的意义。

## 4. 缓存与刷新参数（线上 app.js 常量区原文，调参只动这一区）

| 参数/键 | 值 | 语义 |
|---|---|---|
| `LS_KEYS.prefs / latest / trend` | `fx-pr

（装配注入已截断，全文 7198 字符：需要完整内容时用 search_knowledge 检索）

---

# 双栏布局验证


## 关联项目

### 心伴 [frontend]

项目名: 心伴
描述: ai 情绪陪伴
类型: mobile
GitHub: https://github.com/hl3w22bupt/odbo
工作流类型: 标准开发提交流程（开发测试→审查→人工确认→创建PR）

### MyRD Playground [mobile]

项目名: MyRD Playground
描述: MyRD 功能测试和沙盒环境
类型: web-app
GitHub: https://github.com/hl3w22bupt/myrd-playground.git
工作流类型: 功能开发


---


## 产品关联知识

## 情绪陪伴 App 产品调研框架

## 情绪陪伴 App 产品调研分析框架

### 背景
MyRD Admin 提出设计一款以"情绪价值"为核心的陪伴类 App，并引入游戏化交互机制。PD-Agent 就此进行了系统性调研分析。

### 市场与竞品分析
- **现有格局**：冥想类（Headspace、Calm）、日记记录类（Daylio）、虚拟陪伴类（Replika、Character.AI）App 已在市场存在，但多数偏"工具属性"，缺乏有深度的互动体验
- **差异化机会**：游戏化交互是关键的破局点，将情绪调节转化为"养成类 RPG"或"模拟经营"式体验

### 用户需求画像
- **目标人群**：Z 世代及年轻职场人，面临孤独感或高压，排斥传统说教式心理咨询
- **核心诉求**："被理解"、"被陪伴"以及"低压力的情绪宣泄口"，而非"治疗"

### 游戏化交互机制（核心差异化）
- **情绪映射**：将用户抽象情绪（文字、语音、表情）转化为游戏内数值或视觉反馈
  - 示例：用户开心时虚拟家园天气变晴；用户焦虑时出现需要安抚的小怪兽
- **正向反馈循环**：通过"情绪打卡"或"互助任务"解锁装扮、剧情或虚拟互动
- **方向待定**：AI 虚拟伴侣养成 vs 个人情绪花园经营

### 技术可行性
- 涉及 NLP 自然语言处理进行情绪识别
- 高保真游戏化 UI/UX 设计
- 通用技术选型方向待进一步确定

### 伦理与合规风险
- 需明确界定"陪伴"与"心理咨询"的边界
- 避免用户过度依赖及潜在法律风险

### 商业模式探讨
- 订阅制 / 内购制 / 广告变现 待评估

### 后续调研方向
1. 竞品深度拆解：挑选 2-3 款 AI 聊天+游戏元素的应用进行分析
2. MVP 核心功能定义
3. 商业模式确定

## 项目开发规范

# 项目开发规范

## 代码风格
- 使用 TypeScript
- - 遵循 ESLint 规范
- 提交前运行 lint 检查

## Git 提交规范
- 使用 Conventional Commits 格式
- feat: 新功能
- fix: 修复 bug
- docs: 文档更新

## MyRD 平台能力与环境事实源（Agent 防臆造基线 · 2026-09-26 主人核定）

# 目的
本档是平台环境与能力的唯一权威事实源。Agent 在做环境探针、资源盘点、执行决策前，以本档为准；与本档冲突的任何转述、往轮记录、黑板条目一律按本档勘误。

## 一、常驻服务与端口（全部）
- 后端平台 API：http://localhost:3111（env PLATFORM_API_URL 指向它）
- 前端 Web：3001
- PostgreSQL：5432（库名 myrd）
- 除此之外**不存在任何常驻平台服务**。特别地：**平台从未内置「Open Design / 设计工作台 daemon」，127.0.0.1:7456 无任何服务**。该说法源于 2026-09-11 一轮讨论中的臆测（随后被「交叉探针」误证实并写入黑板），已经主人 2026-09-26 核实销案。禁止再将其列为依赖、探针项或环境阻塞证据。

## 二、团队讨论 → 执行 → 部署的真实链路
1. 团队讨论收敛出 decidedAction（workflow / assign / pending）。
2. decidedAction=workflow：平台**自动**启动团队默认工作流（lead 无需也无法手动调用引擎）。
3. 部署（AppHost 导出 + 托管发布）**只发生在工作流的 deploy 节点**；assign 指派执行、纯讨论轮都不会触发部署。
4. 判定某轮工作流的真实结局，唯一依据是 workflow run 的状态（completed / failed / running，见运行卡片），**「已启动」≠「已成功」**；无结局信息时如实写「结局未知」，禁止脑补「被中断/断点未知」。

## 三、身份与权限
- 工作流节点的平台身份 = 工作流触发人（triggeredByUserId）。
- assign 指派执行 = 成员 agent 本人身份；平台会在编排启动时幂等补齐其在绑定项目的成员资格。
- 若仍遇「非项目成员」「项目列表为空/注册表 0 仓库」类报错：属平台 bug 或权限缺口，正确做法是**如实上报等待修复**，不得自行降级为「环境不可用、改做纸面件」，也不得据此宣称整体环境故障。

## 四、当前部署台账（stack-tower，2026-09-26 核对）
- 坑位：appId cmugttipt000km9299oej5z9b · slug stack-tower-3（一游戏一坑，禁止再建）
- liveUrl：https://leomac-studio.tail49399e.ts.net/apps/stack-tower-3/gw
- 线上版本：commit 75debf9（2026-09-25 部署，M2.1「有声可装」全量含音效/移动端/PWA，线上冒烟 PASS）
- 平台 spec 链：v1→v2→v3（v3 approved，id cmugok2uz000xm9ilx42t8pnl）；spec v1.1「登记就绪版」截至 2026-09-26 仍为纸面文件（.myrd/spec/stack-tower-spec-v1.1-ready.yaml），**尚未登记**，登记落点 = POST revisions 接在 v3 之后 version+1。
- 分支：myrd/pixel-fives-m0-m1-cmtpb66pe000rm9e2ozdurf8d（远端 head 541323a > 线上 75debf9，差异均为 docs 提交，不影响游戏构建）。

## 五、历史误报档案（不得再引用为环境基线）
- 「Open Design daemon 127.0.0.1:7456 不可达」：幻觉 + 交叉误证实，销案（2026-09-26）。
- 「代码图谱注册表 0 个注册仓库」（2026-09-11~09-26 多轮）：成员 agent 缺项目成员资格所致（2026-09-26 已修），非仓库缺失。
- 「M2.1 执行被中断、断点位置未知」（2026-09-26 补跑轮）：往轮摘要缺执行结局导致的脑补，实际 M2.1 已于 2026-09-25 完成并部署上线。


## 架构设计文档

# 架构设计

## 技术栈
- 前端：Next.js + React + TypeScript
- 后端：Motia (iii 引擎)
- 数据库：PostgreSQL + Prisma

## 模块划分
- 项目管理模块
- 任务管理模块
- 知识库模块

## 需求池功能说明

# 需求池功能

## 功能说明
需求池用于管理产品需求、Bug 修复、功能改进等任务。

## 状态流转
- backlog: 待办需求
- todo: 已计划
- in-progress: 进行中
- review: 评审中
- done: 已完成
- archived: 已归档

## 沉淀知识：Godot 4 Web 导出移动端触屏虚拟摇杆与 AudioContext 解锁规范

# Godot 4 Web 导出移动端触屏虚拟摇杆与 AudioContext 解锁规范（game-5 实测沉淀）

> 来源：需求《森林收集水果限时赛（game-5）》（id=cmuipol63006rm9l6cp2ww5r5）走完工坊流水线（实现 → 门禁 → Web 导出 → 部署 → 红队对抗验收）后，红队在线上版本实锤缺陷「移动端左右上下移动键不起作用 + 全程无音效」（bug id=cmujiqsk0000gm99if1vzc1eg）。本文把修复与防复发所需的机制结论固化为规范，供 game-5 迭代及后续 Godot Web 小游戏直接套用。机制层结论引自三篇引擎级实测知识（见 §六关联）；玩法数值以《game-5 玩法设计要点》（id=6e91a11d-3632-4721-a3ea-d433e9622f9b）为权威基准，本文不重复其数值。

## 一、结论速览

| # | 要点 | 一句话规范 | 错误修法（禁止） |
| --- | --- | --- | --- |
| 1 | 触屏是一等输入 | 移动端必须提供虚拟摇杆或四向按钮，并与键盘汇入**同一个移动向量出口**；摇杆在 `_input` 阶段接管触点 | 只绑定键盘 action 就指望触屏能用；摇杆逻辑写在 `_unhandled_input`；用 InputEventAction 转发移动输入 |
| 2 | 音频必须手势解锁 | Web 端音频只在**首个真实用户手势调用栈内**解锁并出第一声；解锁前事件只记账不播放 | 在 `_ready` 里直接 play BGM；GDScript 置「已解锁」标志位就当解锁完成 |
| 3 | 60 秒局内节奏 | 连击=窗口刷新式、难度=绑定剩余时间的线性插值、供给=铺场+补货（数值见 6e91a11d） | 连击做固定总窗；难度递增绑定已生成数量 |

## 二、触屏输入：虚拟摇杆 / 四向按钮规范

### 2.1 为什么移动端「方向键失灵」

- 桌面键盘 action（WASD / 方向键）在触屏上**没有物理触发源**：若移动代码只读 `Input.is_action_pressed(...)` 且这些动作只绑定了键盘键，触屏端输入向量恒为 (0,0)——表现为四向全失灵，且**控制台零报错**（不是崩溃，是静默无输入）。
- 两个引擎级陷阱（Godot 4.3 实测探针 + 源码钉死，见知识 36d39401）：
  - **E-18**：触摸事件分发顺序固定为 `_input → GUI 命中 → _unhandled`。Control 若 `mouse_filter=STOP`，落在自身矩形内的触摸会在 GUI 命中阶段被消费，永远到不了它自己的 `_unhandled_input` → 摇杆「整体推不动」，还会把触摸漏给下层按钮造成误交互。
  - **E-19**：同帧多个 `InputEventAction` 会互踩清零（Input 对每个 action 事件都写所有动作的槽位）→ 斜向拖拽只剩一个轴。**移动输入禁止走 InputEventAction 转发。**

### 2.2 推荐实现形态

**虚拟摇杆（Control 自研，首选）**

1. 在 **`_input` 阶段**处理 `InputEventScreenTouch` / `InputEventScreenDrag`（引擎里唯一保证先于 GUI 命中的阶段），接管后 `set_input_as_handled()` 同时阻断 GUI 与 unhandled。
2. 初始按下必须落在摇杆矩形内才接管；接管后滑出矩形照常续跟（拖拽不失联）。
3. `touch_index` 单指跟踪：第二根手指不抢控；加 `is_visible_in_tree()` 守卫，隐藏的摇杆不得抢按任何触摸。
4. 保留 `mouse_filter=STOP`：让 `emulate_mouse_from_touch` 合成出的鼠标事件在 GUI 层被摇杆吃掉，不漏成第二次交互。
5. 输出：以基座中心为原点的归一化向量 + 死区（建议 0.15~0.25），模长 clamp 到 1；y 轴向下为正，与 `Input.get_vector` 口径一致。
6. 视觉：半透明常驻左下（基座 + 拇指帽），按下时拇指帽跟随触点——常驻可见是可发现性要求，不用时降透明度但不下线。

**四向按钮（TouchScreenButton，简化替代）**

- 适合四向/格子化移动；单指按下即全速方向，双指可合成斜向。
- 热区 ≥ 48px（CSS px，注意 DPR 换算，见知识 649e691d），按钮间距留防误触边距。
- 用 `TouchS

（装配注入已截断，全文 5992 字符：需要完整内容时用 search_knowledge 检索）

## 沉淀 Godot 4 Web 导出与 godot-smoke 门禁 + AppHost 部署全链路实战经验（oak-key 取证探针实测）

# Godot 4 Web 导出 + godot-smoke 门禁 + AppHost 部署全链路实战经验（oak-key 取证探针实测）

> 来源：需求《oak-key 有效性探针小游戏（取证探针，不计入三样例）》（id=cmupslvp7002gm9dh42h3maq5，goal=cmupsfn0q001um9dhlko9t5e0）走完「scaffold → implement → AppHost 壳接入 + Web 导出 → 部署 → 线上终态独立复核」全流程后的沉淀。仓库：github.com/hl3w22bupt/myrd-playground，工程落位 `games/oak-key`（Godot 4.3.stable.official.77dcf97d8）。线上终态：liveUrl `https://leomac-studio.tail49399e.ts.net/apps/oak-key/`（308→200、资源 404=0、真实浏览器完成拾取→校验→反馈闭环）。本文只写「门禁怎么搭、打回了怎么修、导出怎么配、部署怎么走」，玩法数值与移动端触屏/音频规范见 §八关联知识，不重复。

## 一、godot-smoke 门禁体系：三层机判 + 退出码纪律

### 1.1 三层结构（缺一层就有漏网）

| 层 | 判定器（仓库内 std-skills/godot-game-dev/scripts/） | 拦什么 | 耗时量级 |
| --- | --- | --- | --- |
| ① preflight 静态一致性 | `preflight.py <工程>` | P1~P13 共 13 类「必然黑屏」类缺陷（路径悬空、ext_resource 声明失配、场景 parent 不可解析、class_name 重复、uid 无声明、Godot3 残留语法、代码级 connect 目标方法缺失、Web 端中文缺字体等），运行前秒级拦下 | 秒级 |
| ② headless-smoke | `GODOT_SMOKE_FRAMES=240 GODOT_BIN=$(bash scripts/resolve-godot.sh) bash scripts/smoke.sh <工程>` | 「能不能跑且玩得动」：headless 导入 + 运行冒烟场景，断言**退出码 0 与 `GODOT_SMOKE: PASS` 标记同时成立**，且 PASS 分支同样扫 `SCRIPT ERROR\|Parse Error`（E-16 带病绿灯） | 秒级~十秒级 |
| ③ input-fuzz | `input-fuzz.sh <工程>` | 确定种子（如 seed=20260913，6 批 239 帧）随机事件序下不崩溃、无脚本错误、主循环不挂死 | 十秒级 |

分工口径：**能在运行前拦的绝不留到运行后**（preflight）；只有运行期才能证实的（输入真的动了、信号真的送达、无每帧刷屏错误）交给冒烟。「噪声后玩法断言仍通过」的语义不变式写在工程内 `tests/smoke.gd`（模板内置），与 fuzz 层互补——两层合起来才覆盖「输入状态残留」类缺陷（实例：跨关卡指针状态泄露导致下一关首手势被吞）。

### 1.2 退出码语义（routine 引擎只认命令退出码，语义必须钉死）

- `0` 通过；`1` 冒烟/fuzz 失败 → 由目标执行引擎 `reject` **打回修复循环**，修复预算即工作流 `maxLoops`，修复动作查 error-signatures 表；`2` 环境不可用（没装 Godot / 缺技能脚本 / 缺 python3）→ **装环境，禁止为过门禁改代码**。
- 工程 `verify.sh` 把 preflight 失败单独编为 `3`（静态不一致 → 先修静态，不必跑冒烟），并对四个判定脚本做**存在性守卫先行判 2**——否则「技能脚本缺失」会掉进下游非零退出码被误判成 3，诱导修复节点去改游戏代码（守卫是防误诊的关键一行）。
- 判定器唯一来源是仓库内 `std-skills/godot-game-dev/scripts/`（与 `.myrd/routines.yaml` 同源同参）；平台注入的 `.myrd-platform/.claude/skills/...` 只是阅读副本。**被检工程不得自造判定器**（playtest.sh 未预置时宁可如实上报缺口，也不做等价替代）。

### 1.3 routine 参数化（第二个游戏接入时最容易翻车的点）

`godot-smoke` routine 必须把 `{{gamePath}}`/`{{smokeFrames}}` 参数化，工

（装配注入已截断，全文 11096 字符：需要完整内容时用 search_knowledge 检索）

## 小游戏移动端模拟门禁取证 SOP：375w 仿真、分阶段截帧与 report.json 证据契约（范例 games/talent-nurture）

# 小游戏移动端模拟门禁取证 SOP

> 把小游戏「上线前移动端机器取证」固化为可复跑、可归档、可回放的门禁流程。范例与判例出处：才艺养成 Demo「星光练习生：才艺养成物语」，`games/talent-nurture/tools/smoke-mobile.mjs` + `qa/mobile/`，2026-10-24 收口于提交 `5f729c7`（分支 `myrd/talent-nurture-goal-*`），9/9 项 PASS。后续小游戏上线门禁直接照此复用。

## 1. 定位与边界

- **是什么**：对**线上 liveUrl**（AppHost 部署产物，非 localhost）做 375w 移动仿真的端到端取证，产出 `qa/mobile/report.json` + 分阶段截图，并 git 归档。作为小游戏「可上线」的机器可判门禁。
- **机器判定 ≠ 使用验收**：好玩/画面审美/四问量表等主观体验**不在机器取证范围**，report 的 `evidenceMethod.outOfScope` 必须显式声明「待用户试玩回填」，绝不能代填主观结论。
- **零 npm 依赖**：直接裸 CDP（WebSocket）驱动 headless Chrome，不引 puppeteer/playwright，脚本可在任何有 Chrome 的机器上跑。判例承同仓 `tools/smoke-live.mjs`（桌面版冒烟）。

## 2. 移动仿真口径（375w）

```js
const VIEWPORT = { w: 375, h: 720 };  // 竖屏基线，对应主流移动端最小宽
// headless Chrome：--headless=new --remote-debugging-port=0，从 DevToolsActivePort 文件取 ws 地址
await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 720, deviceScaleFactor: 2, mobile: true });
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
```

- **点击必须走真实触摸管线**：`Input.dispatchTouchEvent` 的 `touchStart→touchEnd`，**禁止 JS 直调 onclick**——直调测不出事件绑定缺失、热区错位、覆盖遮挡这类真机才会暴露的问题。
- 导航后先 sleep 2.5s，再按场景标志（如 `.title-screen`）轮询就绪（40×250ms），超时即 DIE 并带 console 错误上下文。
- 资产路径按**网关部署形态**处理：产物经网关以 `assets/` 前缀伺服，html 入口形态会被 308 规范化（见 §8 缺陷②）。

## 3. 九项机器判定检查（基线集）

| id | 判据 |
|---|---|
| network | 关键资产经 375×720 仿真加载全 2xx、无 404/加载失败；html/css/main.mjs/scenes 齐备 |
| first-screen | 首屏标题渲染、开始按钮在视口内、`elementFromPoint` 命中自身、非 disabled |
| touch-start | touch 管线点「开始」生效（phase title→intro） |
| viewport | `scrollWidth ≤375` 且选项按钮完整在视口内（无横向溢出） |
| touch-event | 分支事件选项 touch 生效，且**连点 3 次只计 1 次**（防重判定反取证） |
| touch-train | 训练按钮 touch 生效且状态真实推进（如 vocal 10→16、actionsLeft 5→4） |
| touch-pipeline | 全程 touch 主循环推进至结局判定（phase=ended、舞台场次、touch 步数全生效） |
| hotzone | 可点按钮**两两无重叠**且高度 ≥40px（多阶段采样，报最矮值） |
| console | 全流程 console 零 error（warning 仅计数不判失败） |

每个检查项落 `checks[{id,name,pass,detail}]`，detail 必须带**可核查的量化证据**（命中坐标、尺寸、前后状态值），不许只写「通过」。

## 4. 分阶段截图规范

-

（装配注入已截断，全文 5629 字符：需要完整内容时用 search_knowledge 检索）

## 僵尸/孤儿运行轨迹识别与处置手册（status=failed 不可单独为凭）

# 知识：僵尸/孤儿运行轨迹的识别与处置

## 背景
运行（run）的真实状态与已落库的轨迹（trajectory）记录可能失步，平台用「自愈清理」把这类孤儿记录强制归为 failed。这造成大量「假失败」：运行实际被取消/超时/暂停，轨迹却显示 failed，干扰失败统计与工作流评测。该问题在多个项目（心伴、MyRD Playground）跨多天反复出现，命中 85+ 条记忆记录。

## 现象
- 运行被取消后留下轨迹并被标记 failed（常见于取消的 workflow 运行，如心伴前端转换节点的 cancelled 运行被误报为失败）。
- 执行超时未结束、run 已 paused/failed 但轨迹未同步，被自愈清理标记为 failed。
- 报错形如「No conversation found with session ID: ...」或「执行超时未结束，启动自愈清理为 failed」。
- 归因时出现「Agent 退出码 0 但未产生 git commit」之类的伪失败（见内容节点 skipGitCheck 规范）。

## 根因
run 状态与轨迹持久化的执行上下文不同步：取消、超时、暂停等路径没有及时把轨迹状态对齐到真实 run 状态，系统以自愈清理兜底归为 failed。

## 识别与处置步骤
1. 看到 status=failed 时，先不要认定 agent 失败。用 runId 与轨迹/会话记录交叉验证：该 run 是否真的执行过？是否被用户/调度取消？是否超时？
2. 检查磁盘持久化产物：若 run 已产出文件且内容完整，即使状态为 failed 也说明实际成功过，应视为成功而非失败。
3. 区分三类伪失败：SIGINT 基础设施中断、取消产生的僵尸轨迹、skipGitCheck 未设置的 git 校验误判；真实失败应具备「有明确工具错误 / 无产物」特征。
4. 避免重试风暴：对已确认为僵尸/误报的 failed 不做自动重试。
5. 长期修复：确认所有执行入口统一收敛到同一 pipeline，使状态快照与轨迹持久化保持一致。

## 预防
- 新增 workflow/节点时检查 skipGitCheck 与持久化配置。
- 取消运行后留意残留轨迹，优先用 runId 交叉核验再下结论。
- 归因报告须引用 runId 而非仅引用 status 字段。

## 沉淀知识：《今日汇率》Web 工坊上线受阻实录——webapp-smoke 门禁资产双缺口、fail-closed 拦截与恢复路径（附 HostedApp/deployment/liveUrl 三要素核实）

# 《今日汇率》Web 工坊上线受阻实录：门禁资产双缺口、fail-closed 拦截与恢复路径

> 目标：创建 Web 应用《今日汇率》（goal `cmvaf7imr000jm94le9x48zfu`，projectId `proj-playground`，需求 id `cmvafe4gu0017m94la5mhgc3p`）。
> 本文全部结论均经平台 API / git 独立复核（2026-10-16），不复述、不臆造；复核方式见 §7。

## 1. 一句话结论

**应用没有上线，且不是败在代码，而是败在平台模板仓库缺两份门禁资产**：门禁判定脚本 `webapp-smoke.mjs` 与 `routines.yaml` 的 `id=webapp-smoke` routine 条目双双缺失，按「来源不可得 → 立即 blocked」硬约束，流水线三个实现节点全部纪律性停止（未建工程、未部署、未绕过），review 节点 pre-hook fail-closed 拦截，两次运行同因失败。**该目标的「上线三要素」中只有 HostedApp 壳存在，deployment id 与 liveUrl 不存在。**

## 2. 上线三要素核实表（本目标 artifacts 回写依据）

| 要素 | 状态 | 值 / 证据 |
|---|---|---|
| HostedApp id | ✅ 存在（壳，从未部署） | `cmvaf7imm000hm94lw6y43t0q`（name=今日汇率，slug=`myrdplaygrou`，runtime=sandbox，sourceType=workshop，status=`creating`，createdAt=2026-10-16T03:41:09Z，`deployments=[]`，`liveUrl=null`） |
| deployment id | ❌ 不存在 | `GET /api/v1/apphost/apps` 返回该应用 deployments 数组为空；goal artifacts 的 blocked 详情明确「部署 0 次」（三轮独立复验一致） |
| liveUrl | ❌ 不存在 | AppHost 记录 `liveUrl=null`。参照同项目已上线应用（如 farm-yard / game-5），补齐资产并部署成功后格式应为 `https://leomac-studio.tail49399e.ts.net/apps/myrdplaygrou/` |

要点：AppHost 壳是 express_lane 预检节点（早于工作流运行约 48 分钟）预建的，**不代表工程已落地**——`webapps/myrdplaygrou/` 工程目录从未创建。任何下游环节不得把「壳存在」误读为「已部署」。HostedApp id 已作为 `artifactType=hosted_app` 关联回写至 goal artifacts（含三轮 blocked 复验全记录），deployment id / liveUrl 因客观不存在而无法回写，**不臆造补位**。

## 3. 失败链全景（时间线）

1. **2026-10-16 03:41** express_lane 预检完成，预建 AppHost 壳 `cmvaf7imm000hm94lw6y43t0q`（status=creating）。
2. **04:29–04:41** 工作流运行 `cmvagxyf3002em94lxhtab3p9`（同型前次运行 `cmvafm2y5001km94leiaezgid`，同样结局）：
   - **scaffold 节点（completed，结论 blocked）**：核验门禁资产双缺口，落盘 `.myrd/blocked-report.md` 并推送（commit `9eafc4d`，分支 `myrd/fx-app-goal-cmvaf7imr000jm94le9x48zfu`）。未建工程、未落风格卡、未改 routines.yaml。
   - **implement 节点（completed，结论 blocked）**：独立复验后同一结论，追加 blocked 报告（commit `74c749a`）。未建工程、未自造判定器。另核实同目标两条兄弟分支 `myrd/web-goal-…`、`myrd/myrdplaygrou-goal-…` 均无可复用产出。
   - **deploy/发布节点（completed，结论 blocked）**：第三轮复验（`git fetch --prune` 后 origin/main 仍停在 `6c0df4a9`），仍是双缺口，

（装配注入已截断，全文 5767 字符：需要完整内容时用 search_knowledge 检索）

## 沉淀知识：《今日汇率》前端定时更新方案与数据源契约——「多天不更新」六缺口根因与修复 · 30min TTL/定时/手动三路刷新 · 缓存→种子兜底链（er-api/frankfurter 实测契约 · 含 artifacts 回写）

# 《今日汇率》前端定时更新方案与数据源契约（「多天不更新」根因修复 · 实测可复用）

> 目标 `cmvaf7imr000jm94le9x48zfu`（创建 Web 应用《今日汇率》）· 数据鲜度需求 `cmveivn9n000wm9vq3h575b78` · 工作流运行 `cmveiw7540013m9vqlgj9t6ul`（全四棒 completed）· 分支 `myrd/fx-app-goal-cmvaf7imr000jm94le9x48zfu` · 工程 `webapps/myrdplaygrou`
> 本文全部结论经平台 API / git / 线上实调独立复核（2026-10-19），不复述不臆造；姊妹篇（上线受阻与门禁资产恢复）见知识库 `ed7d2bbf-ca19-46f5-b5d1-c7b9db2d85b9`。

## 1. 一句话结论

「多天不更新」的根因**不是静态汇率快照**（工程内零静态汇率常量），而是旧版前端缺整套鲜度机制——**六个缺口叠加**：缓存无 TTL 判定、无定时刷新、无手动刷新、无种子兜底、`AbortSignal.timeout` 兼容风险、鲜度展示错位。修复后形成「**30 分钟 TTL + 30 分钟 interval + 手动强刷**三路更新、**缓存→内置种子**两级兜底」的纯前端方案（commit `fa67dc3` → 部署 v13 → 色板对齐 `45d02f1` → 线上 v15），门禁与移动验收全绿。

## 2. 执行链与产出锚点

| 环节 | 产出 | 证据 |
|---|---|---|
| scaffold | 根因基线六条 + 部署契约四条移交（`.myrd/scaffold-handoff.md`）；门禁资产双缺口已由模板仓库补齐（`9fbc1dc`），不再 blocked | commit `3b30d36` |
| implement | 鲜度机制全量实现（5 文件 +225/-44），根因留痕 `.myrd/implement-notes.md`；CDP 功能自测 14/14，并**附带修复一个真实换算 bug** | commit `fa67dc3` |
| deploy | 色板逐 token 对齐流水线硬约束 `#f0f9ff/#0ea5e9/#22c55e`（薄荷→天蓝，布局/触控不动）；部署 v15；门禁对 liveUrl PASS；证据归档 | commit `45d02f1`、`b5b42d8` |
| review | REVIEW-KIT 更新至 v15；goal artifacts 回写至 12 条；如实记录三处待观察项 | commit `5d8f838` |
| 部署三要素 | HostedApp `cmvaf7imm000hm94lw6y43t0q`（status=ready）· deployment `cmvek09sb001gm9vqf7tn7q9f`（**v15 现役**，commit `45d02f1`；v13 `cmvejnc41001bm9vqikbuvp1i`=fa67dc3 已被取代）· liveUrl `https://leomac-studio.tail49399e.ts.net/apps/myrdplaygrou/` | 2026-10-19 实测线上 app.js 含 `FRESH_TTL_MS`、favicon `#0ea5e9` |

## 3. 「多天不更新」根因：六缺口叠加（含排除法取证）

**取证方法（可复用）**：修复前 HEAD 上 `grep -rnE '"USD": *[0-9]|rates *= *\{|SEED' *.js *.html` 为空 → 排除「静态快照打进包」；旧版每次冷加载都会 fetch（线上 Network 可见）→ 用户所见过期数据的真实成因只能在前端鲜度机制缺失。六缺口与修复对照：

| # | 缺口 | 修复前（活跃部署 13dec1c） | 修复后（fa67dc3） |
|---|---|---|---|
| 1 | 缓存无 TTL 过期判定 | `fx-latest-v1` 存了 `fetchedAt` 但全文件无过期比较，缓存只在 fetch 抛错时被读 | `isExpired()`：`!Number.isFinite(fetchedAt) \|\| Date.now()-fetchedAt > FRESH_TTL_MS`，TTL=30min |
| 2 | 无 interval 定时刷新 | 生命周期只在 init 拉一次 | `setInterval(refreshLatest({force:true}), 30min)` 与 TT

（装配注入已截断，全文 7978 字符：需要完整内容时用 search_knowledge 检索）

## 沉淀知识：《今日汇率》前端定时更新方案与数据源契约——「多天不更新」根因、TTL/刷新参数、兜底链与门禁验收实录（含 artifacts 回写）

# 《今日汇率》前端定时更新方案与数据源契约

> 目标 `cmvaf7imr000jm94le9x48zfu` · 数据鲜度需求 `cmveivn9n000wm9vq3h575b78` · v2 工坊流水线运行 `cmveiw7540013m9vqlgj9t6ul`（completed，scaffold/implement/deploy/review 四节点全绿）。
> 本文全部参数取自**线上 app.js 实抓**（2026-10-19，`/apps/myrdplaygrou/api/public/assets/app.js`，429 行）、平台 API 与仓库提交，独立复核命令见 §9。前序背景（门禁资产双缺口与恢复）见姊妹篇《今日汇率 Web 工坊上线受阻实录》（ed7d2bbf-ca19-46f5-b5d1-c7b9db2d85b9）。

## 1. 一句话结论

「多天不更新」**不是静态汇率快照打进包里**，而是前端缺整套鲜度机制（六个缺口叠加，见 §2）。修复为纯前端方案：open.er-api.com 免 key CORS 直连 + localStorage 30 分钟 TTL 过期判定 + 停留期 30 分钟定时强刷 + 手动刷新按钮（force 跳过 TTL）+「缓存→内置种子」三级兜底 + 溯源行常显。已上线 v15（commit `45d02f1`），生产环境 webapp-smoke 门禁 PASS，门禁截图首屏实拉到当日实时数据。

## 2. 根因定位（需求验收 5 的留痕结论）

**排除项**：工程内 grep 无任何静态汇率常量，旧版每次冷加载都会 fetch——「静态快照打进包」假设被证伪。

**真根因 = 六缺口叠加**（① 是「多天不更新」的主因）：

1. **缓存无 TTL 过期判定**：localStorage 里 `fetchedAt` 存而不校验 → 「缓存永不过期」，一次成功拉取后永远用旧值；
2. **无 interval 定时刷新**：页面停留多久都不会重新拉取；
3. **无手动刷新按钮**：用户没有强制重取入口；
4. **无内置种子兜底**：断网且无缓存时直接空屏；
5. **`AbortSignal.timeout` 旧 WebView 兼容风险**：超时助手在不支持该 API 的内核直接抛异常，拉取静默失败后落入缺口 ① 的永不过期缓存；
6. **鲜度展示错位**：界面显示「本地获取时刻」而非汇率数据自身日期，旧数据也显示成刚更新，掩盖了问题。

根因基线留痕：`webapps/myrdplaygrou/.myrd/scaffold-handoff.md`（六条 + 部署契约四条）与 `.myrd/implement-notes.md`。

## 3. 数据源契约（两源均免 key、CORS 开放、前端直连，无代理无后端）

| 用途 | 端点 | 契约要点 | 实测（2026-10-19） |
|---|---|---|---|
| 最新汇率 | `https://open.er-api.com/v6/latest/{base}` | `result=success` 才可用；`base_code` 回显基准币；`time_last_update_utc` 是数据自身日期（渲染「数据日期」的权威来源，勿用本地时钟）；`rates` 全量字典 | base=USD：**166 币种**，更新于 00:02:32 UTC，CNY=6.69274 / EUR=0.890861 / JPY=157.911394；`time_next_update_utc`=次日（免费档每日一更） |
| 趋势序列 | `https://api.frankfurter.dev/v1/{start}..{end}?base=..&symbols=..` | ECB 参考汇率，免 key；日期区间语法 `{start}..{end}`；周末无报价，前端需容忍缺日 | 由线上 app.js 头注释与 `fetchTrend` 实现确认 |

**选型含义**：两源都不需要服务器中转，HostedApp 静态壳即可承载；CORS 均开放，无需 JSONP/代理/后端。
**重要推论**：er-api 免费档每日一更，所以「30 分钟刷新」刷的是**请求**，汇率值一天最多变一次——界面文案必须据实标注「数据日期」而非「实时秒级」，这也是溯源行存在的意义。

## 4. 缓存与刷新参数（线上 app.js 常量区原文，调参只动这一区）

| 参数/键 | 值 | 语义 |
|---|---|---|
| `LS_KEYS.prefs / latest / trend` | `fx-pr

（装配注入已截断，全文 7198 字符：需要完整内容时用 search_knowledge 检索）

---

# 多选测试产品


## 关联项目

### MyRD Playground [frontend]

项目名: MyRD Playground
描述: MyRD 功能测试和沙盒环境
类型: web-app
GitHub: https://github.com/hl3w22bupt/myrd-playground.git
工作流类型: 功能开发


---


## 产品关联知识

## 项目开发规范

# 项目开发规范

## 代码风格
- 使用 TypeScript
- - 遵循 ESLint 规范
- 提交前运行 lint 检查

## Git 提交规范
- 使用 Conventional Commits 格式
- feat: 新功能
- fix: 修复 bug
- docs: 文档更新

## 僵尸/孤儿运行轨迹识别与处置手册（status=failed 不可单独为凭）

# 知识：僵尸/孤儿运行轨迹的识别与处置

## 背景
运行（run）的真实状态与已落库的轨迹（trajectory）记录可能失步，平台用「自愈清理」把这类孤儿记录强制归为 failed。这造成大量「假失败」：运行实际被取消/超时/暂停，轨迹却显示 failed，干扰失败统计与工作流评测。该问题在多个项目（心伴、MyRD Playground）跨多天反复出现，命中 85+ 条记忆记录。

## 现象
- 运行被取消后留下轨迹并被标记 failed（常见于取消的 workflow 运行，如心伴前端转换节点的 cancelled 运行被误报为失败）。
- 执行超时未结束、run 已 paused/failed 但轨迹未同步，被自愈清理标记为 failed。
- 报错形如「No conversation found with session ID: ...」或「执行超时未结束，启动自愈清理为 failed」。
- 归因时出现「Agent 退出码 0 但未产生 git commit」之类的伪失败（见内容节点 skipGitCheck 规范）。

## 根因
run 状态与轨迹持久化的执行上下文不同步：取消、超时、暂停等路径没有及时把轨迹状态对齐到真实 run 状态，系统以自愈清理兜底归为 failed。

## 识别与处置步骤
1. 看到 status=failed 时，先不要认定 agent 失败。用 runId 与轨迹/会话记录交叉验证：该 run 是否真的执行过？是否被用户/调度取消？是否超时？
2. 检查磁盘持久化产物：若 run 已产出文件且内容完整，即使状态为 failed 也说明实际成功过，应视为成功而非失败。
3. 区分三类伪失败：SIGINT 基础设施中断、取消产生的僵尸轨迹、skipGitCheck 未设置的 git 校验误判；真实失败应具备「有明确工具错误 / 无产物」特征。
4. 避免重试风暴：对已确认为僵尸/误报的 failed 不做自动重试。
5. 长期修复：确认所有执行入口统一收敛到同一 pipeline，使状态快照与轨迹持久化保持一致。

## 预防
- 新增 workflow/节点时检查 skipGitCheck 与持久化配置。
- 取消运行后留意残留轨迹，优先用 runId 交叉核验再下结论。
- 归因报告须引用 runId 而非仅引用 status 字段。

## MyRD 平台能力与环境事实源（Agent 防臆造基线 · 2026-09-26 主人核定）

# 目的
本档是平台环境与能力的唯一权威事实源。Agent 在做环境探针、资源盘点、执行决策前，以本档为准；与本档冲突的任何转述、往轮记录、黑板条目一律按本档勘误。

## 一、常驻服务与端口（全部）
- 后端平台 API：http://localhost:3111（env PLATFORM_API_URL 指向它）
- 前端 Web：3001
- PostgreSQL：5432（库名 myrd）
- 除此之外**不存在任何常驻平台服务**。特别地：**平台从未内置「Open Design / 设计工作台 daemon」，127.0.0.1:7456 无任何服务**。该说法源于 2026-09-11 一轮讨论中的臆测（随后被「交叉探针」误证实并写入黑板），已经主人 2026-09-26 核实销案。禁止再将其列为依赖、探针项或环境阻塞证据。

## 二、团队讨论 → 执行 → 部署的真实链路
1. 团队讨论收敛出 decidedAction（workflow / assign / pending）。
2. decidedAction=workflow：平台**自动**启动团队默认工作流（lead 无需也无法手动调用引擎）。
3. 部署（AppHost 导出 + 托管发布）**只发生在工作流的 deploy 节点**；assign 指派执行、纯讨论轮都不会触发部署。
4. 判定某轮工作流的真实结局，唯一依据是 workflow run 的状态（completed / failed / running，见运行卡片），**「已启动」≠「已成功」**；无结局信息时如实写「结局未知」，禁止脑补「被中断/断点未知」。

## 三、身份与权限
- 工作流节点的平台身份 = 工作流触发人（triggeredByUserId）。
- assign 指派执行 = 成员 agent 本人身份；平台会在编排启动时幂等补齐其在绑定项目的成员资格。
- 若仍遇「非项目成员」「项目列表为空/注册表 0 仓库」类报错：属平台 bug 或权限缺口，正确做法是**如实上报等待修复**，不得自行降级为「环境不可用、改做纸面件」，也不得据此宣称整体环境故障。

## 四、当前部署台账（stack-tower，2026-09-26 核对）
- 坑位：appId cmugttipt000km9299oej5z9b · slug stack-tower-3（一游戏一坑，禁止再建）
- liveUrl：https://leomac-studio.tail49399e.ts.net/apps/stack-tower-3/gw
- 线上版本：commit 75debf9（2026-09-25 部署，M2.1「有声可装」全量含音效/移动端/PWA，线上冒烟 PASS）
- 平台 spec 链：v1→v2→v3（v3 approved，id cmugok2uz000xm9ilx42t8pnl）；spec v1.1「登记就绪版」截至 2026-09-26 仍为纸面文件（.myrd/spec/stack-tower-spec-v1.1-ready.yaml），**尚未登记**，登记落点 = POST revisions 接在 v3 之后 version+1。
- 分支：myrd/pixel-fives-m0-m1-cmtpb66pe000rm9e2ozdurf8d（远端 head 541323a > 线上 75debf9，差异均为 docs 提交，不影响游戏构建）。

## 五、历史误报档案（不得再引用为环境基线）
- 「Open Design daemon 127.0.0.1:7456 不可达」：幻觉 + 交叉误证实，销案（2026-09-26）。
- 「代码图谱注册表 0 个注册仓库」（2026-09-11~09-26 多轮）：成员 agent 缺项目成员资格所致（2026-09-26 已修），非仓库缺失。
- 「M2.1 执行被中断、断点位置未知」（2026-09-26 补跑轮）：往轮摘要缺执行结局导致的脑补，实际 M2.1 已于 2026-09-25 完成并部署上线。


## 架构设计文档

# 架构设计

## 技术栈
- 前端：Next.js + React + TypeScript
- 后端：Motia (iii 引擎)
- 数据库：PostgreSQL + Prisma

## 模块划分
- 项目管理模块
- 任务管理模块
- 知识库模块

## 需求池功能说明

# 需求池功能

## 功能说明
需求池用于管理产品需求、Bug 修复、功能改进等任务。

## 状态流转
- backlog: 待办需求
- todo: 已计划
- in-progress: 进行中
- review: 评审中
- done: 已完成
- archived: 已归档

## 沉淀知识：Godot 4 Web 导出移动端触屏虚拟摇杆与 AudioContext 解锁规范

# Godot 4 Web 导出移动端触屏虚拟摇杆与 AudioContext 解锁规范（game-5 实测沉淀）

> 来源：需求《森林收集水果限时赛（game-5）》（id=cmuipol63006rm9l6cp2ww5r5）走完工坊流水线（实现 → 门禁 → Web 导出 → 部署 → 红队对抗验收）后，红队在线上版本实锤缺陷「移动端左右上下移动键不起作用 + 全程无音效」（bug id=cmujiqsk0000gm99if1vzc1eg）。本文把修复与防复发所需的机制结论固化为规范，供 game-5 迭代及后续 Godot Web 小游戏直接套用。机制层结论引自三篇引擎级实测知识（见 §六关联）；玩法数值以《game-5 玩法设计要点》（id=6e91a11d-3632-4721-a3ea-d433e9622f9b）为权威基准，本文不重复其数值。

## 一、结论速览

| # | 要点 | 一句话规范 | 错误修法（禁止） |
| --- | --- | --- | --- |
| 1 | 触屏是一等输入 | 移动端必须提供虚拟摇杆或四向按钮，并与键盘汇入**同一个移动向量出口**；摇杆在 `_input` 阶段接管触点 | 只绑定键盘 action 就指望触屏能用；摇杆逻辑写在 `_unhandled_input`；用 InputEventAction 转发移动输入 |
| 2 | 音频必须手势解锁 | Web 端音频只在**首个真实用户手势调用栈内**解锁并出第一声；解锁前事件只记账不播放 | 在 `_ready` 里直接 play BGM；GDScript 置「已解锁」标志位就当解锁完成 |
| 3 | 60 秒局内节奏 | 连击=窗口刷新式、难度=绑定剩余时间的线性插值、供给=铺场+补货（数值见 6e91a11d） | 连击做固定总窗；难度递增绑定已生成数量 |

## 二、触屏输入：虚拟摇杆 / 四向按钮规范

### 2.1 为什么移动端「方向键失灵」

- 桌面键盘 action（WASD / 方向键）在触屏上**没有物理触发源**：若移动代码只读 `Input.is_action_pressed(...)` 且这些动作只绑定了键盘键，触屏端输入向量恒为 (0,0)——表现为四向全失灵，且**控制台零报错**（不是崩溃，是静默无输入）。
- 两个引擎级陷阱（Godot 4.3 实测探针 + 源码钉死，见知识 36d39401）：
  - **E-18**：触摸事件分发顺序固定为 `_input → GUI 命中 → _unhandled`。Control 若 `mouse_filter=STOP`，落在自身矩形内的触摸会在 GUI 命中阶段被消费，永远到不了它自己的 `_unhandled_input` → 摇杆「整体推不动」，还会把触摸漏给下层按钮造成误交互。
  - **E-19**：同帧多个 `InputEventAction` 会互踩清零（Input 对每个 action 事件都写所有动作的槽位）→ 斜向拖拽只剩一个轴。**移动输入禁止走 InputEventAction 转发。**

### 2.2 推荐实现形态

**虚拟摇杆（Control 自研，首选）**

1. 在 **`_input` 阶段**处理 `InputEventScreenTouch` / `InputEventScreenDrag`（引擎里唯一保证先于 GUI 命中的阶段），接管后 `set_input_as_handled()` 同时阻断 GUI 与 unhandled。
2. 初始按下必须落在摇杆矩形内才接管；接管后滑出矩形照常续跟（拖拽不失联）。
3. `touch_index` 单指跟踪：第二根手指不抢控；加 `is_visible_in_tree()` 守卫，隐藏的摇杆不得抢按任何触摸。
4. 保留 `mouse_filter=STOP`：让 `emulate_mouse_from_touch` 合成出的鼠标事件在 GUI 层被摇杆吃掉，不漏成第二次交互。
5. 输出：以基座中心为原点的归一化向量 + 死区（建议 0.15~0.25），模长 clamp 到 1；y 轴向下为正，与 `Input.get_vector` 口径一致。
6. 视觉：半透明常驻左下（基座 + 拇指帽），按下时拇指帽跟随触点——常驻可见是可发现性要求，不用时降透明度但不下线。

**四向按钮（TouchScreenButton，简化替代）**

- 适合四向/格子化移动；单指按下即全速方向，双指可合成斜向。
- 热区 ≥ 48px（CSS px，注意 DPR 换算，见知识 649e691d），按钮间距留防误触边距。
- 用 `TouchS

（装配注入已截断，全文 5992 字符：需要完整内容时用 search_knowledge 检索）

## 沉淀 Godot 4 Web 导出与 godot-smoke 门禁 + AppHost 部署全链路实战经验（oak-key 取证探针实测）

# Godot 4 Web 导出 + godot-smoke 门禁 + AppHost 部署全链路实战经验（oak-key 取证探针实测）

> 来源：需求《oak-key 有效性探针小游戏（取证探针，不计入三样例）》（id=cmupslvp7002gm9dh42h3maq5，goal=cmupsfn0q001um9dhlko9t5e0）走完「scaffold → implement → AppHost 壳接入 + Web 导出 → 部署 → 线上终态独立复核」全流程后的沉淀。仓库：github.com/hl3w22bupt/myrd-playground，工程落位 `games/oak-key`（Godot 4.3.stable.official.77dcf97d8）。线上终态：liveUrl `https://leomac-studio.tail49399e.ts.net/apps/oak-key/`（308→200、资源 404=0、真实浏览器完成拾取→校验→反馈闭环）。本文只写「门禁怎么搭、打回了怎么修、导出怎么配、部署怎么走」，玩法数值与移动端触屏/音频规范见 §八关联知识，不重复。

## 一、godot-smoke 门禁体系：三层机判 + 退出码纪律

### 1.1 三层结构（缺一层就有漏网）

| 层 | 判定器（仓库内 std-skills/godot-game-dev/scripts/） | 拦什么 | 耗时量级 |
| --- | --- | --- | --- |
| ① preflight 静态一致性 | `preflight.py <工程>` | P1~P13 共 13 类「必然黑屏」类缺陷（路径悬空、ext_resource 声明失配、场景 parent 不可解析、class_name 重复、uid 无声明、Godot3 残留语法、代码级 connect 目标方法缺失、Web 端中文缺字体等），运行前秒级拦下 | 秒级 |
| ② headless-smoke | `GODOT_SMOKE_FRAMES=240 GODOT_BIN=$(bash scripts/resolve-godot.sh) bash scripts/smoke.sh <工程>` | 「能不能跑且玩得动」：headless 导入 + 运行冒烟场景，断言**退出码 0 与 `GODOT_SMOKE: PASS` 标记同时成立**，且 PASS 分支同样扫 `SCRIPT ERROR\|Parse Error`（E-16 带病绿灯） | 秒级~十秒级 |
| ③ input-fuzz | `input-fuzz.sh <工程>` | 确定种子（如 seed=20260913，6 批 239 帧）随机事件序下不崩溃、无脚本错误、主循环不挂死 | 十秒级 |

分工口径：**能在运行前拦的绝不留到运行后**（preflight）；只有运行期才能证实的（输入真的动了、信号真的送达、无每帧刷屏错误）交给冒烟。「噪声后玩法断言仍通过」的语义不变式写在工程内 `tests/smoke.gd`（模板内置），与 fuzz 层互补——两层合起来才覆盖「输入状态残留」类缺陷（实例：跨关卡指针状态泄露导致下一关首手势被吞）。

### 1.2 退出码语义（routine 引擎只认命令退出码，语义必须钉死）

- `0` 通过；`1` 冒烟/fuzz 失败 → 由目标执行引擎 `reject` **打回修复循环**，修复预算即工作流 `maxLoops`，修复动作查 error-signatures 表；`2` 环境不可用（没装 Godot / 缺技能脚本 / 缺 python3）→ **装环境，禁止为过门禁改代码**。
- 工程 `verify.sh` 把 preflight 失败单独编为 `3`（静态不一致 → 先修静态，不必跑冒烟），并对四个判定脚本做**存在性守卫先行判 2**——否则「技能脚本缺失」会掉进下游非零退出码被误判成 3，诱导修复节点去改游戏代码（守卫是防误诊的关键一行）。
- 判定器唯一来源是仓库内 `std-skills/godot-game-dev/scripts/`（与 `.myrd/routines.yaml` 同源同参）；平台注入的 `.myrd-platform/.claude/skills/...` 只是阅读副本。**被检工程不得自造判定器**（playtest.sh 未预置时宁可如实上报缺口，也不做等价替代）。

### 1.3 routine 参数化（第二个游戏接入时最容易翻车的点）

`godot-smoke` routine 必须把 `{{gamePath}}`/`{{smokeFrames}}` 参数化，工

（装配注入已截断，全文 11096 字符：需要完整内容时用 search_knowledge 检索）

## 沉淀知识：《今日汇率》Web 工坊上线受阻实录——webapp-smoke 门禁资产双缺口、fail-closed 拦截与恢复路径（附 HostedApp/deployment/liveUrl 三要素核实）

# 《今日汇率》Web 工坊上线受阻实录：门禁资产双缺口、fail-closed 拦截与恢复路径

> 目标：创建 Web 应用《今日汇率》（goal `cmvaf7imr000jm94le9x48zfu`，projectId `proj-playground`，需求 id `cmvafe4gu0017m94la5mhgc3p`）。
> 本文全部结论均经平台 API / git 独立复核（2026-10-16），不复述、不臆造；复核方式见 §7。

## 1. 一句话结论

**应用没有上线，且不是败在代码，而是败在平台模板仓库缺两份门禁资产**：门禁判定脚本 `webapp-smoke.mjs` 与 `routines.yaml` 的 `id=webapp-smoke` routine 条目双双缺失，按「来源不可得 → 立即 blocked」硬约束，流水线三个实现节点全部纪律性停止（未建工程、未部署、未绕过），review 节点 pre-hook fail-closed 拦截，两次运行同因失败。**该目标的「上线三要素」中只有 HostedApp 壳存在，deployment id 与 liveUrl 不存在。**

## 2. 上线三要素核实表（本目标 artifacts 回写依据）

| 要素 | 状态 | 值 / 证据 |
|---|---|---|
| HostedApp id | ✅ 存在（壳，从未部署） | `cmvaf7imm000hm94lw6y43t0q`（name=今日汇率，slug=`myrdplaygrou`，runtime=sandbox，sourceType=workshop，status=`creating`，createdAt=2026-10-16T03:41:09Z，`deployments=[]`，`liveUrl=null`） |
| deployment id | ❌ 不存在 | `GET /api/v1/apphost/apps` 返回该应用 deployments 数组为空；goal artifacts 的 blocked 详情明确「部署 0 次」（三轮独立复验一致） |
| liveUrl | ❌ 不存在 | AppHost 记录 `liveUrl=null`。参照同项目已上线应用（如 farm-yard / game-5），补齐资产并部署成功后格式应为 `https://leomac-studio.tail49399e.ts.net/apps/myrdplaygrou/` |

要点：AppHost 壳是 express_lane 预检节点（早于工作流运行约 48 分钟）预建的，**不代表工程已落地**——`webapps/myrdplaygrou/` 工程目录从未创建。任何下游环节不得把「壳存在」误读为「已部署」。HostedApp id 已作为 `artifactType=hosted_app` 关联回写至 goal artifacts（含三轮 blocked 复验全记录），deployment id / liveUrl 因客观不存在而无法回写，**不臆造补位**。

## 3. 失败链全景（时间线）

1. **2026-10-16 03:41** express_lane 预检完成，预建 AppHost 壳 `cmvaf7imm000hm94lw6y43t0q`（status=creating）。
2. **04:29–04:41** 工作流运行 `cmvagxyf3002em94lxhtab3p9`（同型前次运行 `cmvafm2y5001km94leiaezgid`，同样结局）：
   - **scaffold 节点（completed，结论 blocked）**：核验门禁资产双缺口，落盘 `.myrd/blocked-report.md` 并推送（commit `9eafc4d`，分支 `myrd/fx-app-goal-cmvaf7imr000jm94le9x48zfu`）。未建工程、未落风格卡、未改 routines.yaml。
   - **implement 节点（completed，结论 blocked）**：独立复验后同一结论，追加 blocked 报告（commit `74c749a`）。未建工程、未自造判定器。另核实同目标两条兄弟分支 `myrd/web-goal-…`、`myrd/myrdplaygrou-goal-…` 均无可复用产出。
   - **deploy/发布节点（completed，结论 blocked）**：第三轮复验（`git fetch --prune` 后 origin/main 仍停在 `6c0df4a9`），仍是双缺口，

（装配注入已截断，全文 5767 字符：需要完整内容时用 search_knowledge 检索）

## 沉淀知识：《今日汇率》前端定时更新方案与数据源契约——「多天不更新」六缺口根因与修复 · 30min TTL/定时/手动三路刷新 · 缓存→种子兜底链（er-api/frankfurter 实测契约 · 含 artifacts 回写）

# 《今日汇率》前端定时更新方案与数据源契约（「多天不更新」根因修复 · 实测可复用）

> 目标 `cmvaf7imr000jm94le9x48zfu`（创建 Web 应用《今日汇率》）· 数据鲜度需求 `cmveivn9n000wm9vq3h575b78` · 工作流运行 `cmveiw7540013m9vqlgj9t6ul`（全四棒 completed）· 分支 `myrd/fx-app-goal-cmvaf7imr000jm94le9x48zfu` · 工程 `webapps/myrdplaygrou`
> 本文全部结论经平台 API / git / 线上实调独立复核（2026-10-19），不复述不臆造；姊妹篇（上线受阻与门禁资产恢复）见知识库 `ed7d2bbf-ca19-46f5-b5d1-c7b9db2d85b9`。

## 1. 一句话结论

「多天不更新」的根因**不是静态汇率快照**（工程内零静态汇率常量），而是旧版前端缺整套鲜度机制——**六个缺口叠加**：缓存无 TTL 判定、无定时刷新、无手动刷新、无种子兜底、`AbortSignal.timeout` 兼容风险、鲜度展示错位。修复后形成「**30 分钟 TTL + 30 分钟 interval + 手动强刷**三路更新、**缓存→内置种子**两级兜底」的纯前端方案（commit `fa67dc3` → 部署 v13 → 色板对齐 `45d02f1` → 线上 v15），门禁与移动验收全绿。

## 2. 执行链与产出锚点

| 环节 | 产出 | 证据 |
|---|---|---|
| scaffold | 根因基线六条 + 部署契约四条移交（`.myrd/scaffold-handoff.md`）；门禁资产双缺口已由模板仓库补齐（`9fbc1dc`），不再 blocked | commit `3b30d36` |
| implement | 鲜度机制全量实现（5 文件 +225/-44），根因留痕 `.myrd/implement-notes.md`；CDP 功能自测 14/14，并**附带修复一个真实换算 bug** | commit `fa67dc3` |
| deploy | 色板逐 token 对齐流水线硬约束 `#f0f9ff/#0ea5e9/#22c55e`（薄荷→天蓝，布局/触控不动）；部署 v15；门禁对 liveUrl PASS；证据归档 | commit `45d02f1`、`b5b42d8` |
| review | REVIEW-KIT 更新至 v15；goal artifacts 回写至 12 条；如实记录三处待观察项 | commit `5d8f838` |
| 部署三要素 | HostedApp `cmvaf7imm000hm94lw6y43t0q`（status=ready）· deployment `cmvek09sb001gm9vqf7tn7q9f`（**v15 现役**，commit `45d02f1`；v13 `cmvejnc41001bm9vqikbuvp1i`=fa67dc3 已被取代）· liveUrl `https://leomac-studio.tail49399e.ts.net/apps/myrdplaygrou/` | 2026-10-19 实测线上 app.js 含 `FRESH_TTL_MS`、favicon `#0ea5e9` |

## 3. 「多天不更新」根因：六缺口叠加（含排除法取证）

**取证方法（可复用）**：修复前 HEAD 上 `grep -rnE '"USD": *[0-9]|rates *= *\{|SEED' *.js *.html` 为空 → 排除「静态快照打进包」；旧版每次冷加载都会 fetch（线上 Network 可见）→ 用户所见过期数据的真实成因只能在前端鲜度机制缺失。六缺口与修复对照：

| # | 缺口 | 修复前（活跃部署 13dec1c） | 修复后（fa67dc3） |
|---|---|---|---|
| 1 | 缓存无 TTL 过期判定 | `fx-latest-v1` 存了 `fetchedAt` 但全文件无过期比较，缓存只在 fetch 抛错时被读 | `isExpired()`：`!Number.isFinite(fetchedAt) \|\| Date.now()-fetchedAt > FRESH_TTL_MS`，TTL=30min |
| 2 | 无 interval 定时刷新 | 生命周期只在 init 拉一次 | `setInterval(refreshLatest({force:true}), 30min)` 与 TT

（装配注入已截断，全文 7978 字符：需要完整内容时用 search_knowledge 检索）

## 沉淀知识：《今日汇率》前端定时更新方案与数据源契约——「多天不更新」根因、TTL/刷新参数、兜底链与门禁验收实录（含 artifacts 回写）

# 《今日汇率》前端定时更新方案与数据源契约

> 目标 `cmvaf7imr000jm94le9x48zfu` · 数据鲜度需求 `cmveivn9n000wm9vq3h575b78` · v2 工坊流水线运行 `cmveiw7540013m9vqlgj9t6ul`（completed，scaffold/implement/deploy/review 四节点全绿）。
> 本文全部参数取自**线上 app.js 实抓**（2026-10-19，`/apps/myrdplaygrou/api/public/assets/app.js`，429 行）、平台 API 与仓库提交，独立复核命令见 §9。前序背景（门禁资产双缺口与恢复）见姊妹篇《今日汇率 Web 工坊上线受阻实录》（ed7d2bbf-ca19-46f5-b5d1-c7b9db2d85b9）。

## 1. 一句话结论

「多天不更新」**不是静态汇率快照打进包里**，而是前端缺整套鲜度机制（六个缺口叠加，见 §2）。修复为纯前端方案：open.er-api.com 免 key CORS 直连 + localStorage 30 分钟 TTL 过期判定 + 停留期 30 分钟定时强刷 + 手动刷新按钮（force 跳过 TTL）+「缓存→内置种子」三级兜底 + 溯源行常显。已上线 v15（commit `45d02f1`），生产环境 webapp-smoke 门禁 PASS，门禁截图首屏实拉到当日实时数据。

## 2. 根因定位（需求验收 5 的留痕结论）

**排除项**：工程内 grep 无任何静态汇率常量，旧版每次冷加载都会 fetch——「静态快照打进包」假设被证伪。

**真根因 = 六缺口叠加**（① 是「多天不更新」的主因）：

1. **缓存无 TTL 过期判定**：localStorage 里 `fetchedAt` 存而不校验 → 「缓存永不过期」，一次成功拉取后永远用旧值；
2. **无 interval 定时刷新**：页面停留多久都不会重新拉取；
3. **无手动刷新按钮**：用户没有强制重取入口；
4. **无内置种子兜底**：断网且无缓存时直接空屏；
5. **`AbortSignal.timeout` 旧 WebView 兼容风险**：超时助手在不支持该 API 的内核直接抛异常，拉取静默失败后落入缺口 ① 的永不过期缓存；
6. **鲜度展示错位**：界面显示「本地获取时刻」而非汇率数据自身日期，旧数据也显示成刚更新，掩盖了问题。

根因基线留痕：`webapps/myrdplaygrou/.myrd/scaffold-handoff.md`（六条 + 部署契约四条）与 `.myrd/implement-notes.md`。

## 3. 数据源契约（两源均免 key、CORS 开放、前端直连，无代理无后端）

| 用途 | 端点 | 契约要点 | 实测（2026-10-19） |
|---|---|---|---|
| 最新汇率 | `https://open.er-api.com/v6/latest/{base}` | `result=success` 才可用；`base_code` 回显基准币；`time_last_update_utc` 是数据自身日期（渲染「数据日期」的权威来源，勿用本地时钟）；`rates` 全量字典 | base=USD：**166 币种**，更新于 00:02:32 UTC，CNY=6.69274 / EUR=0.890861 / JPY=157.911394；`time_next_update_utc`=次日（免费档每日一更） |
| 趋势序列 | `https://api.frankfurter.dev/v1/{start}..{end}?base=..&symbols=..` | ECB 参考汇率，免 key；日期区间语法 `{start}..{end}`；周末无报价，前端需容忍缺日 | 由线上 app.js 头注释与 `fetchTrend` 实现确认 |

**选型含义**：两源都不需要服务器中转，HostedApp 静态壳即可承载；CORS 均开放，无需 JSONP/代理/后端。
**重要推论**：er-api 免费档每日一更，所以「30 分钟刷新」刷的是**请求**，汇率值一天最多变一次——界面文案必须据实标注「数据日期」而非「实时秒级」，这也是溯源行存在的意义。

## 4. 缓存与刷新参数（线上 app.js 常量区原文，调参只动这一区）

| 参数/键 | 值 | 语义 |
|---|---|---|
| `LS_KEYS.prefs / latest / trend` | `fx-pr

（装配注入已截断，全文 7198 字符：需要完整内容时用 search_knowledge 检索）
