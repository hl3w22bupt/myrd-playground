# `godot-smoke` 门禁 routine 片段

> 用途：把「游戏能不能跑」变成机器可判定的一条门禁，挂进 `.myrd/routines.yaml`。
> schema 与现有 routine 完全一致（`params` + `steps[].name/command/target/cwd/timeout` + 顶层 `gate`；
> 引擎不读 step 级 `description`，说明文字用 YAML 注释写在 step 上方），
> routine 引擎对 step 的判定就是 **命令退出码**，而 `scripts/smoke.sh` 的退出码语义已经对齐：
> `0` 通过 / `1` 冒烟失败（reject 打回修复循环）/ `2` 环境不可用（提示装 Godot，而不是改代码）。

**这条 routine 必须参数化**：工程路径写成 `{{gamePath}}`、帧数写成 `{{smokeFrames}}`，
在 `params` 里给默认值；工作流节点用 `preHookParams` 按工程覆盖。写死路径的版本在第二个
游戏接入时会让门禁静默跑去测别的工程（本仓 dogfood = `games/godot-coin-rush`）——
看起来 PASS，被检的却不是它。这与 `.myrd/routines.yaml` 里已落地的同名 routine 保持同源。

## 片段（追加到 `.myrd/routines.yaml` 的 `routines:` 下）

```yaml
  - id: godot-smoke
    name: Godot 无头冒烟
    description: 对 Godot 工程跑前置一致性检查 + 无头运行冒烟（退出码与 GODOT_SMOKE 标记双断言），作为「游戏能不能跑」的门禁
    gate: false   # 按需：仅 Godot 目标的工作流用 preHook: godot-smoke 显式引用，不参与默认门禁
    # 工程路径已参数化：params 是默认值，工作流节点用 preHookParams 按工程覆盖
    params:
      gamePath: games/my-game      # 默认被测工程（相对仓库根），接入新工程时改这里或用 preHookParams 覆盖
      smokeFrames: "240"           # --quit-after 帧数兜底，必须与该工程 verify.sh 的预算同值
      playtestFrames: "900"        # 机器人试玩每局帧数（60 tick = 1 秒；建议 ≈ 60 × spec.content.sessionSeconds）
    steps:
      # 环境前置 —— 没有 Godot 直接给明确失败原因，避免 agent 误改代码
      - name: godot-availability
        command: "bash std-skills/godot-game-dev/scripts/resolve-godot.sh >/dev/null"
        target: host
        timeout: 30
      # 12 类前置一致性静态检查（无需 Godot，秒级，先拦「必然黑屏」）
      - name: preflight
        command: "python3 std-skills/godot-game-dev/scripts/preflight.py {{gamePath}}"
        target: host
        timeout: 120
      # 无头导入 + 冒烟场景运行，断言退出码 0 且日志含 GODOT_SMOKE: PASS
      # GODOT_SMOKE_FRAMES 必须带：冒烟场景要跑完「移动 + 探测 + 交互 + 胜负 + 重开」全部协程，
      # smoke.sh 默认 120 帧兜底会在协程跑完前杀进程 → 既无 PASS 也无 FAIL → 健康游戏被误判失败
      - name: headless-smoke
        command: "GODOT_SMOKE_FRAMES={{smokeFrames}} GODOT_BIN=\"$(bash std-skills/godot-game-dev/scripts/resolve-godot.sh)\" bash std-skills/godot-game-dev/scripts/smoke.sh {{gamePath}}"
        target: host
        timeout: 300
      # 输入鲁棒性 fuzz —— 确定种子随机事件序（动作/触摸/鼠标 + 悬挂手势/孤儿释放/双指抢控）
      # 下的存活判定：不崩溃、无脚本错误、主循环不挂死。玩法语义不变式（如「任意输入序后
      # 标准滑动必须生效」）由各工程 tests/smoke.gd 的噪声相位覆盖（模板内置），与本层互补。
      - name: input-fuzz
        command: "GODOT_BIN=\"$(bash std-skills/godot-game-dev/scripts/resolve-godot.sh)\" bash std-skills/godot-game-dev/scripts/input-fuzz.sh {{gamePath}}"
        target: host
        timeout: 180
      # 机器人试玩 —— bot 以确定种子多局游玩，机判节奏类代理指标下限：首次得分时间 /
      # 最长无反馈窗口 / 反馈密度 / 局间结果方差。阈值可被工程内 tests/playtest.json 覆盖
      # （对齐 spec.content.sessionSeconds）。每局 900 帧 × 3 局，wall time 约 45 秒 ——
      # 把 timeout 给足。判定协议 GODOT_PLAYTEST: PASS/FAIL，指标明细在 METRICS 行（单行 JSON）。
      - name: playtest
        command: "GODOT_PLAYTEST_FRAMES={{playtestFrames}} GODOT_BIN=\"$(bash std-skills/godot-game-dev/scripts/resolve-godot.sh)\" bash std-skills/godot-game-dev/scripts/playtest.sh {{gamePath}}"
        target: host
        timeout: 600
```

要点：

1. `{{gamePath}}` / `{{smokeFrames}}` 是**入参占位符**，由 routine 引擎在执行前替换
   （默认值取 `params`，工作流节点可用 `preHookParams` 覆盖）。值只能是路径 / 数字类安全字符，
   引擎会拒绝带 shell 元字符的入参。
2. `gate: false` 是有意为之：Godot 门禁只该挂在 Godot 目标的工作流上，用 `preHook: godot-smoke`
   显式引用，避免影响非游戏目标的默认 e2e-gate。
3. `GODOT_BIN` 的解析**只有一份实现**（`scripts/resolve-godot.sh`），availability 与
   headless-smoke 都从这里取。此前两步各自维护候选清单，出现过「availability 说环境就绪、
   smoke 却退出码 2」的自相矛盾——不要再往 step 里写第二份候选清单。
4. 门禁 fail 之后由目标执行引擎 `reject` 打回修复循环；修复预算就是工作流的 `maxLoops`
   （对应 OpenGame 的 maxIterations）。修复动作查 `error-signatures.md`。
5. `[CHECKPOINT]` 里回写：preflight 结论、smoke 退出码、`GODOT_SMOKE` 日志摘录、fuzz 结论（种子 + 是否触发脚本错误）。
6. `input-fuzz` 是确定种子的随机事件序鲁棒性门禁（scripts/input-fuzz.sh）：拦「崩溃 / 脚本错误 /
   主循环挂死」。「噪声后玩法断言仍通过」的语义不变式在 tests/smoke.gd 的噪声相位里（模板内置）——
   两层合起来才覆盖「输入状态残留」类缺陷（实例：跨关卡指针状态泄露导致下一关首手势被吞）。

## 目标描述模板（配合本门禁使用）

```
类型 / 美术风格 / 核心玩法 / 操作按键 / 验收标准
```

验收标准必须可无头判定（能翻译成冒烟断言），否则门禁只能给出「能跑」而不能给出「做对了」。
