# 《线上抓娃娃机》(game-11) 实现节点交接（2026-10-06）

## 分支与提交（重要：名义分支已对齐）

- **部署 gitRef 可用二者之一，同一提交**：
  - `myrd/games-goal-cmuwf19ee000xm9lg4v7bxybn`（任务锁定的名义分支，已补推）
  - `myrd/game-11-goal-cmuwf19ee000xm9lg4v7bxybn`（脚手架节点实际创建的分支）
- 实现提交：`5074b6c` feat(game-11): 3D 化抓娃娃机玩法（17 文件，+1182/−294）
- 严禁用 main 部署。

## 门禁结果（本地与门禁同源实跑）

| 门禁 | 结果 | 备注 |
| --- | --- | --- |
| preflight | PASS 14 类 | 52 个工程文件 |
| GODOT_SMOKE | PASS 240 帧 | 含新增断言：爪型参数差异/音频契约/3D 呈现与相机限位/物理落洞入账 |
| GODOT_FUZZ | PASS | seed=20260913，6 批 239 帧 |
| GODOT_PLAYTEST | PASS 3 局 | 首奖励 2.53/9.88/2.47s（种子确定性，非漂移）；反馈 215~252/局 |

复验命令：`bash games/game-11/verify.sh`（与 .myrd/routines.yaml godot-smoke 同源）。

## 实现要点（对照验收标准）

1. 3 种爪型（标准三爪/强力双爪/剪刀爪）：radius/power/speed 三维差异，Tab 或底部按钮切换，冒烟逐对断言参数不相同 —— 验收 1
2. 8 种 3D 娃娃（造型/体积/稀有度），单局 8 只全布货，背包+展示柜详情（名称·稀有度·分数）—— 验收 2
3. 全 3D：机台/爪子/娃娃均为 3D（代码建网格），娃娃为 RigidBody3D，落台/蹭落/落洞真实碰撞翻滚；CameraRig 限位环绕+缩放 —— 验收 3
4. BGM：程序化合成 20s 无缝循环（tools/gen_bgm.gd → assets/music/bgm_shop.wav，LOOP_FORWARD）；音效 7 种（含爪子移动 move）；静音开关（Master 总线）—— 验收 4
5. 闭环：币/时间限制 → 移动/下爪 → 闭合/提起/落洞 → 结算（胜负文案+背包）→ confirm 重开 —— 验收 5

## 已知事项（不阻塞）

- headless 下 `Parameter "m" is null` 刷屏为 Godot 4.3 哑渲染器固有日志（单 BoxMesh 即复现，源 servers/rendering/dummy），真机/Web 真渲染器无此问题；门禁只断言 SCRIPT ERROR/Parse Error，不受影响。
- playtest 种子 20260914 首奖励 9.88s 贴近 10s 阈值（确定性路径）；后续调参可用 `?tuning=` 工作台（claw_speed/drop_speed/grab_radius/grab_stability 等已接入 TUNING_META，米制）。
- Web 导出/部署节点注意：3D + gl_compatibility 已在 project.godot 配置；BGM 循环与音频手势解锁由壳契约负责。

## 给试玩验收节点

- 移动端门禁 preHookParams 需带 liveUrl（routines.yaml 故意无默认值）。
- 人工试玩量表建议覆盖：三爪型同一娃娃成功率差异、视角拖动/缩放、静音开关、背包详情、结算重开。
