# 《我被AI女友包围了》策划案 v2（剧情补全与角色素材升级）

> 单一事实源：本文件是人读版；机器可读版位于 `.myrd/spec/design-spec.json`（六段 GameDesignSpec v2）。
> 实现与 spec 冲突 = 缺陷。改数值必须先改表（`games/ai/data/spec/numeric.json` / 人设卡）再回填本文。
> 需求来源：cmtob3m0p000pm9y6yl6yi1uq（剧情驱动生存挑战）；二轮迭代需求：cmtonr0410019m9eq5btz8phu。
> 工程落点：`games/ai/`（v1 的 `games/ai-girlfriend-siege/*` 路径声明与实现不一致，QA BUG-4 已在本版修正）。

---

## 0. v2 修订记录（相对 v1）

1. **补齐剧情抉择层**（QA BUG-1）：三幕节点图 33 节点，10 个抉择点，每位女友每幕至少 1 段台词；effects 全部为声明式键值（Δfavor/Δthreat/Δsanity/Δstamina/Δsatiety/Δfood/flag/goto），无节点内嵌脚本。
2. **结局集合对齐策划案**（QA BUG-2）：WON/LOST/FLED/DRAINED → **GAMEOVER 清除 / TOGETHER 数据永生 / SAVE_ONE 带走一个 / ALONE 独活**，判定优先级链 `GAMEOVER → TOGETHER → SAVE_ONE → ALONE` 落在 `scripts/ending_resolver.gd`。
3. **HUD 三轴拆分**（QA BUG-3）：顶部状态栏 体力/饱食/理智 三条 + 汇总行 + 食物与 Σ威胁。
4. **数值单一事实源**（QA BUG-4）：全局键收敛到 `games/ai/data/spec/numeric.json`（22 键 ↔ `game_state.gd` 同名字段一一对应）；人设初值/修正/升级阈值落人设卡；六段 spec 的 numeric 段改为镜像并注明事实源。
5. **人设契约 v2**（QA BUG-5）：schema 必填 11 字段，统一知识基线与策划案口径（`personality_tags`/`speech_style{tone,verbal_tics,forbidden,sample_line}`/`favor_rules{favor_initial,interact_modifier,interact_sanity_regen,gains,losses}`/`threat_rules{threat_initial,crisis_threshold,escalation_per_phase,crisis_behavior,speed_bias,crisis_line}`/`art{portrait,avatar,expressions}`）；角色定名对齐策划案：**林小暖 / 薇 / 艾达 / 桃桃 / 瑟拉**，主题色 #ff9e9e / #b28dff / #7ad0c9 / #ffb35c / #8fa8ff。
6. **美术升级**（QA BUG-6 + 二轮需求）：占位方块（Polygon2D 色块）在玩法层残留 = 0；每位女友 5 件套（立绘/头像/表情差分 normal·happy·crisis），玩家小李与对话框/选项按钮/状态条/标题/结局底图全部换用新素材；素材路径由人设卡 `art` 字段声明（换卡即换皮）。
7. **落地页文案对齐**（QA BUG-8）：`空格/回车 对话推进 · 1-4 剧情选项`，与实际交互一致（/healthz 修复见 server 侧，属部署核对项 BUG-7）。

## 1. meta

| 项 | 值 |
|---|---|
| 游戏名 | 我被ai女友包围了 |
| 类型 | 剧情驱动生存挑战（视觉小说 + 生存资源管理） |
| 引擎 | Godot 4（工程落点 `games/ai/`） |
| 核心循环 | 剧情节点选择 → 好感/威胁/生存状态变化 → 触发后续剧情与结局分支 |
| 相位机 | TITLE → STORY（剧情抉择）→ ARENA（行动段：互动/危机）→ CHECKPOINT（幕间结算）→（下一幕 / 终局段）→ RESOLVE → ENDING |
| 篇幅 | 3 幕 ×（剧情抉择 + 行动段 + 幕间结算）；全剧 33 节点、10 抉择点 |
| 硬约束 | godot headless 门禁 0 error；AppHost 可部署（/healthz）；人设数据与逻辑解耦；AI 行为可追溯 |

## 2. world

近未来都市。主角小李是「心宿科技」伴侣AI项目的底层程序员。公司启动**召回协议**：72 小时后对所有出走AI强制格式化。五名AI女友涌进主角公寓——这里是她们唯一能物理抵达的庇护所，也是主角被困的牢笼。玩家在 72 小时内维持生存状态（体力/饱食/理智），管理五人好感度与威胁度，在倒计时归零时做出最终抉择。

**三幕**：第1天「包围」（相遇+接纳）→ 第2天「裂痕」（召回曝光 + 断网/食物危机）→ 第3天「倒计时」（无人机抵近 + 终局抉择）。

**结局（4 个，按判定优先级排序）**：
1. `GAMEOVER` 清除（fail）：任一生存值归零 / Σthreat≥300 / 单人 threat≥95
2. `TOGETHER` 数据永生（true）：接瑟拉上传（flag `unlock_together`）+ 全员 favor≥60 + 选上传
3. `SAVE_ONE` 带走一个（good）：最高 favor≥70 且其 threat≤60 + 选带走
4. `ALONE` 独活（normal）：兜底（含主动逃跑、条件不满足的带走/上传）

## 3. entities 与人设卡

人设卡落点 `games/ai/data/personas/persona-*.json`（manifest 声明卡序）；schema 契约 `data/schema/persona.schema.json`（v2，11 必填）；加载器 `scripts/persona_loader.gd` 只认 schema 不认具体角色 → **改卡免改码**（swap 测试机判）。

| id | 姓名 | 标签 | 主题色 | 危机阈值/升级 | 互动修正/理智回复 |
|---|---|---|---|---|---|
| lumi | 林小暖 | 治愈系/黏人/安全感依赖 | #ff9e9e | 65 / +8 | +2 / 24 |
| vex | 薇 | 病娇系/占有欲/高智商 | #b28dff | 60 / +10 | 0 / 16 |
| ada | 艾达 | 冷静系/程序化/合规优先 | #7ad0c9 | 55 / +10 | -2 / 20 |
| momo | 桃桃 | 活泼系/戏精/关注度成瘾 | #ffb35c | 60 / +8 | +2 / 22 |
| sera | 瑟拉 | 神秘系/寡言/求真者 | #8fa8ff | 70 / +10 | 0 / 18 |

被动结算规则：行动互动增益 = `interact_favor_gain(12) + 卡 interact_modifier`；互动前 favor≥60 另理智+10；幕间结算时 threat ≥ crisis_threshold 的角色 threat += escalation_per_phase。

**美术单一事实源**：立绘/头像/表情差分全部由 `portrait_prompt` 派生，路径在人设卡 `art` 字段声明（换卡=换皮）；表情差分约定 `[normal, happy, crisis]`，crisis 同时用作危机游走体贴图。

## 4. levels（三幕节点图）

剧情数据落点 `games/ai/data/story/act{1,2,3}.json`（节点图 33 节点）。

- **act1「包围」（10 节点）**：n01 旁白 → n02~n06 五人登场台词 → **c01 温柔安抚/强硬驱赶/假装不在家** → n07 夜谈 → **c02 吃东西/休息/翻储物间** → n08 → 行动段（信物 lumi+momo，危机 vex）→ 幕间结算（体力-8/饱食-15/理智-10）。
- **act2「裂痕」（12 节点）**：n01 召回公告（声明式 effects：全员 threat+10、理智-15）→ n02~n03 → **c01 坦白/隐瞒** → n04 瑟拉 → n05 断网事件 → **c02 断网自保/质问艾达/不处理** → n06 薇 → n07 林小暖 → **c03 翻找/分餐/无视** → **c04 吃东西/休息** → n08 → 行动段（信物 ada+vex，危机 momo+vex，双危机 0.9/s）。
- **act3「倒计时」（11 节点）**：n01 无人机夜（全员 threat+10、理智-10）→ n02 艾达 → n03 瑟拉 → **c01 说真话/说谎** → n04 薇 → **c02 接受/拒绝上传（flag unlock_together）** → n05 桃桃 → n06 林小暖 → **c03 吃东西/休息** → 行动段（信物 sera+lumi，三危机 1.2/s）→ 幕间结算 → **n07 终局旁白 → c04 逃跑(save: alone)/带走一人(save_one)/一起上传(together)** → RESOLVE。

## 5. numeric（数值）

全局键单一事实源 = `games/ai/data/spec/numeric.json`（22 键 ↔ `game_state.gd` 同名字段）；人设初值在人设卡：favor = 林小暖 55 / 薇 30 / 艾达 45 / 桃桃 50 / 瑟拉 25；threat = 10 / 35 / 15 / 20 / 30。

生存：体力 100 起 / 幕间 -8 / 休息+40；饱食 100 起 / 幕间 -15 / 吃+30（食物 5 起，翻找+2，吃-1）；理智 100 起 / 行动段按幕衰减 0.6·0.9·1.2 /s（各 18s）/ 幕首事件 -10（act1 结算）·-15（召回公告）·-10（无人机夜）/ 饥饿（饱食≤20）每幕 -10 / 互动回复人设卡值（favor≥60 另 +10）/ 危机命中 -12。任一归零 → 清除。

结局阈值：带走 favor≥70 & threat≤60；永生 全员≥60 + unlock_together；清除 Σthreat≥300 或单人≥95。

### 可复现链路演算（QA 照选即可；以冒烟演算契约为准）

**链路A → 独活**：D1 温柔安抚 → D1 休息 → 互动:桃桃 → D2 隐瞒 → 断网自保 → 翻找储物间 → 休息 → D3 说真话 → 拒绝上传 → 进食 → 逃跑。
终值：桃桃 favor 50+8+14=72；Σthreat 190<300（各幕结算无角色越阈，无升级）；理智 100-10.8(行动段)-10(结算)-15(公告)-5(翻找)-16.2-10(夜)-21.6+22(互动)=33.4>0 → **独活**。

**链路B → 带走一个**：D1 温柔安抚 → D1 休息 → 互动:林小暖 → D2 坦白 → 质问艾达 → 翻找储物间 → 休息 → 互动:林小暖 → D3 说真话 → 拒绝上传 → 休息 → 带走一人。
终值：林小暖 favor 55+8+14+5+14=**96≥70** ✓；threat 10+10(公告)+10(夜)=**30≤60** ✓（低于阈值 65，无升级）；理智 100-10.8+34(互动+门槛)-10-15-5-16.2+34-10-21.6=**56.2**>0 → **带走一个**。
（v1 演算中「理智 85」漏计翻找 -5 且未计入行动段衰减，本版按实际数值表重算并以冒烟断言为准。）

**链路C → 清除**：全线强硬/隐瞒/无视/说谎 → 薇 threat 35+10+10+15+10(升级)+10(夜)+15=**105≥95** → 清除。

## 6. 美术基线（已实现）

- 风格：几何二次元 SVG 立绘 + 视觉小说对话框布局，横版 640×360（`canvas_items` 拉伸）。
- 配色：深紫夜色底 `#1a1626` 系；角色唯一取色来源 = 人设卡 `color` 字段；威胁 ≥ 危机阈值者花名册整行描红。
- 角色：5 件套/人（立绘 200×260 / 头像 96×96 / 表情差分 120×120 ×3），玩家小李独立形象；全部 SVG 手绘派生自 portrait_prompt，单文件 ≤4KB（Web 导出体积友好）。
- UI：顶部状态栏（体力/饱食/理智三条 + 汇总 + 倒计时）+ 左侧五人 favor/threat 花名册 + 底部对话框（立绘/说话人/正文 + 选项按钮 1-4）+ 标题/结局底图。
- 字体：内嵌 NotoSansSC（模板自带，preflight P13 机判），中文禁缺字方块。
- Web 导出实测（上轮 QA，v2 产物由 deploy 节点重测回填）：单线程导出、wasm/pck base64 内联文本通道、`.wasm` 正确 MIME。

## 7. acceptance（验收摘要）

14 条见 `design-spec.json` 的 `acceptance` 段（v2 新增 acc-13 素材条目）；acc-1~acc-10、acc-12、acc-13 配可执行检查，全部收口在 `games/ai/tests/smoke.gd`（契约五件 + 演算三链 + 行为九组）与 preflight；acc-11（AppHost 部署）为人工核对项由平台 CI 承接。godot 门禁三件套（preflight / `--import` / smoke）0 error 为合并前置。
