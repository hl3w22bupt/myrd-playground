---
name: webgame-prototype
description: "WebGame 原型技能包：用 Web 栈（静态站点 + Canvas/Phaser）把结构化策划案快速变成「浏览器里能点开玩」的可玩原型 —— LLM 知识最充分、代码即资产、浏览器即预览。覆盖目录语义、游戏循环骨架、数值与 spec 的一致性、契约测试与可玩性自检。当任务是做游戏原型、验证玩法、或把游戏策划案变成可玩版本时使用。"
---

# WebGame 原型技能包（webgame-prototype）

> 目标：让 agent 独立产出一个**能点开玩**的 Web 原型，而不是「看起来像游戏的代码」。
> 选 Web 栈的理由（调研结论）：20 年成熟度、模型知识最充分、代码即资产、**浏览器即预览** ——
> 原型阶段的沉没成本最低，玩法验证前参与人数最少。引擎移植（Godot/Unity/Cocos）是第二段，不在本包。

## 0. 何时用本包

- 任务是「做个原型验证玩法」「把策划案变成可玩版本」「给目标产出可玩链接」。
- 工程形态：**静态站点**（纯 HTML/CSS/JS 或 Phaser），零构建依赖优先 —— 原型阶段引入打包器是负资产。

## 1. 单一事实源：先读策划案再动手

1. 取 approved 版策划案（`GET /api/v1/game-design-specs/approved?goalId=<goal>`，或工程内
   `.myrd/spec/design-spec.json` 导出件）。
2. 目录语义（研发空间约定，禁止自创第二套）：

```
index.html          # 入口：canvas + 一屏内的开始界面
src/main.js         # 游戏循环（update/render 固定节奏）
src/entities/<id>.js  # 实体：与 spec.entities[].id 一一对应
src/levels/<id>.js    # 关卡：与 spec.levels[].id 一一对应；元素按 spec 编号（element.id）
src/numeric.js        # 数值：与 spec.numeric 段一一对应（唯一数值来源，禁止散落魔数）
tests/                # acceptance.check 指向的可执行检查
.myrd/spec/design-spec.json   # approved 版导出件（契约测试输入）
```

3. 实体/关卡/数值的命名与落点**必须**与 spec 声明一致 —— `scripts/contract-check.mjs` 会逐个断言。

## 2. 游戏循环骨架（三条硬规则）

- **固定节奏**：`requestAnimationFrame` + 时间步长（dt 上限钳制），掉帧不许改变游戏速度。
- **状态机显式**：`title → playing → paused → gameover` 四态起步，禁止用 if-else 布尔堆叠表达状态。
- **数值只读**：运行时只从 `src/numeric.js` 读数值，改数值 = 改 spec 的 numeric 段 → 新版本 spec → 同步代码。

## 3. 一致性契约（实现与 spec 的机器可判耦合）

```bash
node scripts/contract-check.mjs --spec .myrd/spec/design-spec.json --project .
```

- spec 声明的实体 `script`、关卡 `scene`、验收 `check` 落点文件必须存在；
- 关卡元素编号（`<level.id>/<element.id>`）稳定且关卡内唯一 —— 这是关卡可视化编辑页
  「编号 + 字段 + 期望值」精确落点修改的前提（D5）；
- acceptance 配了 check 的必须有可跑的检查文件。

改 spec 的路径/编号与改工程必须**同一次提交**内对齐，不许留中间态。

## 4. 可玩性自检（提交前逐条过）

1. `index.html` 直接打开（或任意静态服务器）就能进开始界面，无控制台报错。
2. 核心循环可复现：开始 → 按说明操作 → 得分/失败 → 重开，全程不卡死、无死屏。
3. 第一分钟引导：玩家打开页面 10 秒内知道「该按什么、目标是什么」（90% 测试者看不懂的教训）。
4. 数值来自 spec：改 `numeric` 必须先改策划案版本，不私调手感和难度。
5. 资产风格统一：引用黑板 `assets.md` 的风格卡，不逐图自创风格。

## 5. 交付协议

- 可玩链接：部署（apphost 静态托管）后把 URL 以 `[CHECKPOINT] {"op":"deploy_playable","artifactId":"<部署记录>","url":"<https URL>","title":"可玩原型"}` 落账 —— 目标卡片会出现「可玩」入口。
- 冒烟证据：黑板 `.myrd/blackboard/levels.md` 写「可核对状态」（哪关能玩、操作路径、截图/日志），不写「已完成」。
