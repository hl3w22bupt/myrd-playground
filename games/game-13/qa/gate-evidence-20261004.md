# 《测试预算边界》game-13 · 双门禁执行留证（2026-10-04 02:47 CST）

- 执行人：直通车子 agent（复核线上版并回写产物标识）
- 引擎：4.3.stable.official.77dcf97d8
- 分支：myrd/run-goal-cmusp1pjb001vic7qpt4udw7i @ a592ea2
- 依据：需求 cmuspeeva004nic7qz5v0j4zz（双门禁约束）+ GameDesignSpec v0 cmuspmbqb006wic7q6wwpeabk

## 门禁一（工程校验）tools/gates/gate1_project_check.sh
```
== 门禁一（工程校验）：《测试预算边界》games/game-13 ==
  ✓ project.godot config_version=5（Godot 4.x 配置格式）
  ✓ config/features 声明为 Godot 4.x
  ✓ 主场景指向 res://scenes/main.tscn
  ✓ 全部 14 个 .gd 脚本静态解析零报错
  ✓ 场景/脚本/导出预设引用的资源全部存在，无缺失
GATE1: PASS project.godot 可解析 / 脚本静态零报错 / 引用完整无缺失
```
→ 退出码 0（0=通过）

## 门禁二（运行冒烟）tools/gates/gate2_smoke_check.sh
```
== 门禁二（运行冒烟）：《测试预算边界》games/game-13 ==
  | · 用例 1：主场景启动 + InputMap
  |   ✓ InputMap 已注册动作 collect_click
  |   ✓ InputMap 已注册动作 pause
  |   ✓ InputMap 已注册动作 restart
  |   ✓ 主场景已装配关卡（main.current_level 非空）
  |   ✓ 启动后状态机已进入 PLAYING（实际 PLAYING）
  |   ✓ 第 1 关已铺 6 枚星光结晶（实际 6 枚）
  |   ✓ 预算 HUD 已显示初始预算 8（实际「剩余预算：8」）
  |   ✓ 计数 HUD 已显示目标 6（实际「收集进度：0 / 6」）
  |   ✓ 教学提示非空（休闲定位零学习成本引导）
  | · 用例 2：核心收集循环 + 误触计费
  |   ✓ 点击结晶后计数 +1（实际 1）
  |   ✓ 收集后预算 -1 变 7（实际 7）
  |   ✓ 被收集的结晶已标记消散
  |   ✓ 计数 HUD 已实时刷新（实际「收集进度：1 / 6」）
  |   ✓ 预算 HUD 已实时刷新（实际「剩余预算：7」）
  |   ✓ 点空处误触扣 1 点预算（实际剩余 6）
  |   ✓ 误触不计入收集（实际 1）
  | · 用例 3：边界分支 CLEARED（集齐且剩余 > 0 → 2 星）
  |   ✓ 集齐且剩余>0 结算为 CLEARED（实际 CLEARED）
  |   ✓ CLEARED 给 2 星（实际 2 星）
  |   ✓ 状态机已到 CLEARED（实际 CLEARED）
  |   ✓ 结算面板已出现（完成反馈）
  | · 用例 4：边界分支 PERFECT（集齐且剩余 == 0 → 3 星）
  |   ✓ 第 3 关布点为 8 结晶 + 2 诱饵石
  |   ✓ PERFECT 路线收满 8（实际 8）
  |   ✓ PERFECT 路线预算恰好归零（实际 0）
  |   ✓ 集齐且预算归零结算为 PERFECT（实际 PERFECT）
  |   ✓ PERFECT 给 3 星（实际 3 星）
  | · 用例 5：边界分支 FAILED（归零未集齐 → 0 星）
  |   ✓ 第 3 关已铺 2 块诱饵石（实际 2 块）
  |   ✓ 点诱饵石扣 1 点预算（实际剩余 7）
  |   ✓ 诱饵石不计入收集（实际 0）
  |   ✓ 预算归零仍未集齐应 FAILED（实际 FAILED，收集 7/8 预算 0）
  |   ✓ FAILED 给 0 星（实际 0 星）
  |   ✓ FAILED 已给出明确结算反馈
  | · 用例 6：暂停/继续 + 进度持久化
  |   ✓ 暂停后状态机为 PAUSED
  |   ✓ 暂停后场景树已冻结
  |   ✓ 暂停层已显示
  |   ✓ 继续后场景树已恢复
  |   ✓ 继续后回到 PLAYING
  |   ✓ 暂停时已写入存档
  |   ✓ 重进后收集进度还原为 1（实际 1）
  |   ✓ 重进后剩余预算还原为 7（实际 7）
  |   ✓ 重进后场上只剩 5 枚结晶（实际 5 枚）
  | GODOT_SMOKE: PASS 启动/输入/收集循环/边界三分支/暂停存档 全部通过
GATE2: PASS 启动至主场景并完整跑通 收集→计数→完成反馈（含边界三分支与暂停存档）
```
