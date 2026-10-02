# `mobile-web-smoke` 门禁 routine 片段

> 用途：把「移动端能不能玩」变成机器可判定的一条门禁，挂进 `.myrd/routines.yaml`。
> 无真机依赖：headless Chrome 以移动仿真（390×844 / DPR3 / 触摸 / iPhone UA）打开
> **部署后的 liveUrl**，机判网络全通 / console 零错误 / 画面真渲染 / 触摸管线 / 音频解锁
> 契约 / 视口健康 / FPS。判定协议与 `godot-smoke` 同源：退出码 `0` 通过 / `1` 门禁失败
> （reject 打回修复循环）/ `2` 环境不可用（找不到 Chrome —— 装环境，不要改代码），
> stdout 打 `MOBILE_SMOKE: PASS/FAIL`。

**为什么测部署后 URL**：M1 网关只透传文本（wasm/pck 走 base64 文本通道、壳端
DecompressionStream 解压、子资源必须相对路径）——移动端黑屏的三大根因（壳解压失败 /
绝对路径 404 / 网关 502 UNSUPPORTED_BINARY）只在真实部署链路上暴露，本地静态伺服测不到。
与 `godot-smoke`（无头 Godot，引擎层「能不能跑」）互补，本门禁测 Web 产物在移动 viewport
+ 触摸语义下「能不能玩」。

**这条 routine 必须参数化**：`{{liveUrl}}` 不给默认值（缺参时该 step 直接失败 ——
fail-closed，不静默测错应用），`{{gamePath}}` 给 dogfood 默认值。工作流节点用
`preHookParams: { liveUrl, gamePath }` 覆盖。入参值不能带 shell 元字符（`?` 也不行）——
liveUrl 是无 query 的纯路径 URL，天然合法。

## 片段（追加到 `.myrd/routines.yaml` 的 `routines:` 下）

```yaml
  - id: mobile-web-smoke
    name: 移动端模拟可玩性门禁
    description: headless Chrome 移动仿真（触摸/iPhone UA/390×844）打开部署后的 liveUrl，机判「移动端能不能玩」—— 网络全通/零 console 错误/画面渲染/触摸响应/音频解锁契约/视口/FPS
    gate: false   # 只该挂在有 Web 产物的工作流上（preHook: mobile-web-smoke 显式引用），不参与默认门禁
    # liveUrl 故意不给默认值：preHookParams 必传，缺参 = fail-closed 失败（列出可用入参），不会静默测错应用
    params:
      gamePath: games/my-game   # 默认被测工程（相对仓库根），证据目录 <gamePath>/qa/mobile/ 落在本仓
    steps:
      # 移动端模拟门禁 —— 退出码 0/1/2，证据（report.json + 三张分阶段截图）落 {{gamePath}}/qa/mobile/
      # 诊断入口：先读 report.json 的 checks 数组与 networkFailures/consoleErrors，再看截图
      - name: mobile-web-smoke
        command: "node std-skills/godot-game-dev/scripts/mobile-web-smoke.mjs --url {{liveUrl}} --out {{gamePath}}/qa/mobile"
        target: host
        timeout: 180
```

要点：

1. `{{liveUrl}}` / `{{gamePath}}` 是入参占位符，routine 引擎执行前替换（默认值取
   `params`，工作流节点用 `preHookParams` 覆盖）；值只能是路径/URL/数字类安全字符。
2. `gate: false` 有意为之：与 `godot-smoke` 同策略，只由工作流节点 `preHook: mobile-web-smoke`
   显式引用，不影响非游戏目标的默认 e2e-gate。
3. 门禁失败后由执行引擎 `reject` 打回修复循环（修复预算 = 节点 `maxLoops`）。修复动作
   从证据出发：`report.json` 的 `networkFailures`（相对路径/资产清单/base64 通道）、
   `consoleErrors`（引擎崩溃）、`metrics`（帧差/FPS）、三张截图（黑屏定位）。
4. `touch-response` 判 FAIL 但游戏确为开局静止画面时：在 `<gamePath>/qa/mobile/` 放
   `EXEMPTION.md` 写明依据并在产物 detail 注明 —— 不得无据豁免。
5. 判定脚本零 npm 依赖（CDP 直驱 Chrome，Node ≥22），Chrome 缺失时退出码 2 = 环境问题
   （装 Chrome / `--chrome` 指路径），按「来源不可得」分支上报，不要改判定脚本。
6. 脚本判定力有配套自测：`node std-skills/godot-game-dev/scripts/mobile_smoke_selftest.mjs`
   （好页必须全绿、坏页必须因**正确的检查项**失败 —— 负例验证，防止门禁自己坏了放行一切）。
