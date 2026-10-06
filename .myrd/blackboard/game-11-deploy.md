# 《线上抓娃娃机》(game-11) 部署节点交接（2026-10-06）

## 部署结果

- **liveUrl**：https://leomac-studio.tail49399e.ts.net/apps/game-11/（/health 与 / 均 200）
- **deploymentId**：cmuwj6mze0037m9lgdwigdpli（gitRef=`myrd/games-goal-cmuwf19ee000xm9lg4v7bxybn`，commit `155e442`）
- **可玩形态**：assets_dir 出 bundle —— index.wasm(35MB)/index.pck(3.4MB) 对象存储懒加载，
  壳页 gzip+b64 文本通道 → DecompressionStream → instantiate；资源全相对路径
- **产物已回写**：goal artifacts 第 3 条 hosted_app / completed

## 门禁结果（全部与仓库内判定脚本同源实跑）

| 门禁 | 结果 |
| --- | --- |
| preflight / GODOT_SMOKE / GODOT_FUZZ / GODOT_PLAYTEST | 全绿（点按下爪改动后复验） |
| 移动端模拟门禁 MOBILE_SMOKE | **PASS 10 项全绿**（3 轮收敛），证据 `games/game-11/qa/mobile/` |

## 移动端门禁修复轨迹（给后续调参/迭代参考）

1. 第 1 轮 FAIL(touch-response/fps)：根因=门禁 DPR=3 → 画布 2.95MP 全走 swiftshader（3fps），
   且静态 canvas 让采样窗落在引擎启动 stall 内。
   修复=壳页 devicePixelRatio 钳制≤1 + canvas 引擎就绪时挂载（fps 3→10）。
2. 第 2 轮 FAIL(touch-response)：根因=中央裸 tap 无绑定动作 + idle 动画幅度低于 400 点采样感知。
   修复=main.gd 点按画布=下爪/重开（`_confirm_primary` 三路共用；is_input_handled 守卫 +
   24px 拖动阈值 + 触屏屏蔽模拟鼠标防双触发）→ tapDiff 0→45，第 3 轮 PASS。
3. 经验：3D 游戏 + swiftshader 门禁，别让壳在引擎启动期暴露静止画面；tap 类门禁需要
   「点哪都有可见反馈」的移动端主操作路径。

## 给试玩验收节点

- 人工试玩入口即 liveUrl；移动端体验路径：摇杆移动 → 点按画面/底部「下爪」钮下爪 →
  「换爪」切爪型 → 拖动转视角 → 结算后点按重开。
- 调参工作台可用：URL 带 `?tuning=<JSON>`（键：claw_speed/drop_speed/grab_radius/grab_stability/
  round_seconds/target_dolls/coins_start，均按 TUNING_META 钳制）。
- 音频取证：真机控制台 `window.__audioDebug()` 返回 {state, addModules, log}。
- 已知事项（不阻塞）：headless `Parameter "m" is null` 刷屏为 Godot 4.3 哑渲染器固有日志；
  playtest 种子 20260914 首奖励 9.88s 贴近 10s 阈值（确定性路径，如需放宽走调参回写 spec 流程）。
