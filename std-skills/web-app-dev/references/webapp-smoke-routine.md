# `webapp-smoke` 门禁 routine 片段

> 用途：把「移动端能不能用」变成机器可判定的一条门禁，挂进 `.myrd/routines.yaml`。
> 无真机依赖：headless Chrome 以移动仿真（390×844 / DPR3 / 触摸 / iPhone UA）打开
> **部署后的 liveUrl**，机判网络全通 / console 零错误 / 首屏有内容 / 触摸管线 / 视口健康。
> 判定协议与 `godot-smoke` / `mobile-web-smoke` 同源：退出码 `0` 通过 / `1` 门禁失败
> （reject 打回修复循环）/ `2` 环境不可用（找不到 Chrome —— 装环境，不要改代码），
> stdout 打 `WEBAPP_SMOKE: PASS/FAIL`。

**为什么测部署后 URL**：M1 网关只透传文本（二进制资产走 asset-store 的 gzip+b64 文本通道、
页面资源必须相对路径）—— 白屏与资源 404 的高发根因（绝对路径 / 登录墙 / 网关 502
UNSUPPORTED_BINARY）只在真实部署链路上暴露，本地静态伺服测不到。与游戏侧的
`mobile-web-smoke` 互补但检查面不同：本门禁按 Web 应用裁剪（不要求 canvas / 渲染循环 /
FPS / 音频契约；新增「首屏有内容」硬检查；触摸响应降为告警 —— 静态页点击无视觉反馈合法）。

**这条 routine 必须参数化**：`{{liveUrl}}` 不给默认值（缺参时该 step 直接失败 ——
fail-closed，不静默测错应用），`{{appPath}}` 给默认值。工作流节点用
`preHookParams: { liveUrl, appPath }` 覆盖。入参值不能带 shell 元字符（`?` 也不行）——
liveUrl 是无 query 的纯路径 URL，天然合法。

## 片段（追加到 `.myrd/routines.yaml` 的 `routines:` 下）

```yaml
  - id: webapp-smoke
    name: Web 应用移动端可用性门禁
    description: headless Chrome 移动仿真（触摸/iPhone UA/390×844）打开部署后的 liveUrl，机判「移动端能不能用」—— 网络全通/零 console 错误/首屏有内容/触摸管线/视口健康
    gate: false   # 只该挂在有 Web 产物的工作流上（preHook: webapp-smoke 显式引用），不参与默认门禁
    # liveUrl 故意不给默认值：preHookParams 必传，缺参 = fail-closed 失败（列出可用入参），不会静默测错应用
    params:
      appPath: webapps/my-app   # 默认被测工程（相对仓库根），证据目录 <appPath>/qa/mobile/ 落在本仓
    steps:
      # 移动端可用性门禁 —— 退出码 0/1/2，证据（report.json + 分阶段截图）落 {{appPath}}/qa/mobile/
      # 诊断入口：先读 report.json 的 checks 数组与 networkFailures/consoleErrors，再看截图
      - name: webapp-smoke
        command: "node std-skills/web-app-dev/scripts/webapp-smoke.mjs --url {{liveUrl}} --out {{appPath}}/qa/mobile"
        target: host
        timeout: 180
```

要点：

1. `{{liveUrl}}` / `{{appPath}}` 是入参占位符，routine 引擎执行前替换（默认值取
   `params`，工作流节点用 `preHookParams` 覆盖）；值只能是路径/URL/数字类安全字符。
2. `gate: false` 有意为之：与 `godot-smoke` 同策略，只由工作流节点 `preHook: webapp-smoke`
   显式引用，不影响非 Web 应用目标的默认 e2e-gate。
3. 门禁失败后由执行引擎 `reject` 打回修复循环（修复预算 = 节点 `maxLoops`）。修复动作
   从证据出发：`report.json` 的 `networkFailures`（相对路径 / 资产清单 / 登录墙）、
   `consoleErrors`（JS 崩溃）、`metrics.colorCount`（=1 即白屏）、截图（加载 / tap 两阶段）。
4. 判定脚本零 npm 依赖（CDP 直驱 Chrome，Node ≥22），Chrome 缺失时退出码 2 = 环境问题
   （装 Chrome / `--chrome` 指路径），按「来源不可得」分支上报，不要改判定脚本。
5. 脚本判定力有配套自测：`node std-skills/web-app-dev/scripts/webapp_smoke_selftest.mjs`
   （好页必须全绿、坏页必须因**正确的检查项**失败 —— 负例验证，防止门禁自己坏了放行一切）。
