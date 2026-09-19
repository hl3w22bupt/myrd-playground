# 我被ai女友包围了（games/ai）

剧情驱动生存挑战：2036 年召回协议启动前 72 小时，单身小伙小李被五位出走 AI 女友
（林小暖 / 薇 / 艾达 / 桃桃 / 瑟拉）包围。通过**剧情抉择 → 好感·威胁·生存结算 → 行动段求生**
的循环走向 4 个结局分支。人设卡、剧情幕、全局数值全部是数据 JSON，改表不改码。

## 玩法闭环（核心循环）

```
剧情节点选择（33 节点 / 10 抉择点）→ 好感/威胁/生存变化（trace 落账）
→ 行动段（追心动信物=互动 / 躲游走危机）→ 幕间结算 → 触发后续剧情与结局分支
```

- **剧情抉择**：对话框推进，选项支持 `W/S·↑/↓ + 空格` 与 `1-4` 直选；effects 全部为
  声明式键值（Δfavor/Δthreat/Δ生存轴/flag/goto），节点图闭合无死链
- **行动段**：接触心动信物 = 与该女友互动（好感 +12+人设卡修正，favor≥60 另理智+10）；
  闯入游走危机 = 该女友威胁+1、理智-12
- **幕间结算**：体力-8 / 饱食-15；饱食≤20 触发饥饿（理智-10）；威胁 ≥ 人设 crisis_threshold
  者触发升级被动（threat += escalation_per_phase）
- **结局（优先级链）**：清除 GAMEOVER（任一生存轴归零 / Σthreat≥300 / 单人≥95）→
  数据永生 TOGETHER（接瑟拉上传 + 全员 favor≥60 + 选上传）→
  带走一个 SAVE_ONE（最高 favor≥70 且其 threat≤60 + 选带走）→ 独活 ALONE（兜底）
- **重开**：结局后按 空格 / 回车（触屏点按画面）→ 人设卡初值复位、玩家回出生点、trace 清空

## 移动端触摸交互（竖屏 / 横屏双方向）

- **触屏操作**：左下虚拟摇杆移动（拖拽），画面内**点按**推进台词 / 开始 / 跳过幕间 / 重开，
  右下「推进」按钮等价于键盘确认；抉择相位必须点选项卡，点空白不结算（防误触）
- **桌面零回归**：触屏控件只在 `DisplayServer.is_touchscreen_available()` 时显示，
  键盘路径（WASD / 空格 / 1-4）与原布局完全不变（expand 拉伸下 16:9 窗口像素级一致）
- **触控参数可配置**：摇杆半径/死区、选项按钮热区（≥44 物理像素）等集中在
  `data/spec/touch.json`，改 JSON 即调手感，不改代码
- **视口自适应**：`stretch/aspect="expand"` 双方向占满无黑边；玩法边界 =
  max(可视画布, 640×360 设计分辨率)，旋转 / 拖拽窗口实时刷新
- **安全区避让**：刘海/打孔屏内缩量（`get_display_safe_area`）自动推移顶部信息簇与
  底部对话框、摇杆、按钮；无安全区 API 的环境（Web）退化为零位移
- **浏览器行为**：导出壳经 `html/head_include` 注入 viewport meta 与
  `touch-action:none / user-select:none / overscroll-behavior:none`，
  画布内禁双击缩放、长按菜单、文字选中与页面滚动回弹

## 操作按键（InputMap，全部注册在 project.godot [input]）

| 动作 | 按键 |
|---|---|
| 移动 / 选项光标 | WASD / 方向键 |
| 对话推进 / 确认 | 空格 / 回车 |
| 剧情选项直选 | 1 / 2 / 3 / 4 |

## 目录

```
games/ai/
├── project.godot            # 入口/单例/输入映射/全局中文字体（Web 导出必需，勿删）
├── autoload/game_state.gd   # 生存三轴+食物+每人 favor/threat+4 结局；声明式 effects 唯一结算口
├── scripts/
│   ├── persona_loader.gd    # 人设卡目录（schema v2 驱动，换卡免改码）
│   ├── story_engine.gd      # 三幕节点图装载 + 闭合/死链/效果键校验
│   ├── ending_resolver.gd   # 结局判定优先级链
│   ├── main.gd              # 相位机：TITLE/STORY/ARENA/CHECKPOINT/ENDING + 全部 UI
│   ├── player.gd / bond_token.gd / crisis_hazard.gd / json_io.gd
├── scenes/                  # main（对话框/选项/状态条/花名册/标题/结局）/ player / token / hazard
├── data/
│   ├── schema/persona.schema.json   # 人设卡契约 v2（11 必填）
│   ├── personas/persona-*.json      # 5 张人设卡（定名/主题色/规则/美术清单）
│   ├── story/act{1,2,3}.json        # 三幕节点图 + 行动段
│   └── spec/numeric.json            # 全局数值单一事实源（22 键 ↔ GameState 字段）
├── assets/
│   ├── fonts/               # 子集化 Noto Sans SC（浏览器沙箱里没有系统字体）
│   └── art/                 # 立绘/头像/表情差分（派生自 portrait_prompt）+ UI 套件（SVG）
├── tests/smoke.tscn|gd      # 无头冒烟自检（契约五件 + 演算三链 + 行为九组）
└── verify.sh                # 门禁入口：preflight + smoke（只调用技能包判定脚本）
```

## 冒烟断言覆盖（tests/smoke.gd）

契约五件：

1. 数值契约：numeric.json 键名 ↔ GameState 字段一一对应且值一致
2. 人设契约：≥5 卡、schema 必填 ≥9 字段（覆盖需求 5 字段）、swap 换卡免改码、
   美术清单齐全（立绘 1 + 头像 1 + 表情差分 ≥2 且文件存在）
3. 剧情契约：3 幕、幕链与节点图闭合无死链、无孤儿节点、每幕 ≥1 抉择、effects 声明式、
   5 位女友每幕有台词、落点边界内、出生净空
4. 结局契约：4 结局齐全 + resolver 优先级链四判
5. 素材契约：玩法层占位 Polygon2D 残留 = 0，玩家/信物/危机全部贴图化

演算三链（脚本驱动固定选择序列，AC「≥2 个不同结局」）：

- 链路A（逃跑）→ 独活；链路B（带走治愈系）→ 带走一个（favor 96 / threat 30）；
  链路C（全线强硬）→ 清除

行为九组：接线 / 移动 / 抉择 UI（真实按键注入）/ 互动 / 危机 / 边界钳制+幕推进 /
全程到结局 / 冻结不变量 / 重开可用

## 门禁复跑（与 CI 同源）

```bash
bash std-skills/godot-game-dev/scripts/resolve-godot.sh >/dev/null
python3 std-skills/godot-game-dev/scripts/preflight.py games/ai
GODOT_SMOKE_FRAMES=240 GODOT_BIN="$(bash std-skills/godot-game-dev/scripts/resolve-godot.sh)" \
  bash std-skills/godot-game-dev/scripts/smoke.sh games/ai
# 或一步：
bash games/ai/verify.sh
```

判定协议：退出码 0 且日志含 `GODOT_SMOKE: PASS` 才算通过；退出码 2 = 环境不可用。
