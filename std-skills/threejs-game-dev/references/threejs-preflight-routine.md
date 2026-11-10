# `threejs-preflight` 门禁 routine 片段

> 用途：three.js 工程的「静态前置一致性」门禁 —— 依赖钉版（three/esbuild 精确版本，P1）、
> 内核纯度（kernel 零 three/零 DOM/零系统随机）、状态机、输入双端、单文件产物契约。
> 判定器本体是仓库内 `std-skills/threejs-game-dev/scripts/preflight.mjs`（零依赖 Node，秒级）；
> routine 只引用，**绝不携带判定器**（门禁独立性红线，被检方不得自造/改写）。

## 片段（追加到 `.myrd/routines.yaml` 的 `routines:` 下）

```yaml
  - id: threejs-preflight
    name: Three.js 静态前置检查
    description: 零依赖 Node 静态机判 three.js 工程 —— 依赖钉版 / 内核纯度 / 状态机 / 输入双端 / 单文件产物契约
    gate: false   # 只该挂在 three.js 目标的工作流上（preHook: threejs-preflight 显式引用），不参与默认门禁
    params:
      gamePath: games/my-3d-game   # 默认被测工程（相对仓库根），工作流节点用 preHookParams 按工程覆盖
    steps:
      - name: preflight
        command: "node std-skills/threejs-game-dev/scripts/preflight.mjs {{gamePath}}"
        target: host
        timeout: 120
```

要点：
1. `{{gamePath}}` 是入参占位符（routine 引擎执行前替换；值只能是路径类安全字符）。
2. 退出码语义：0 通过 / 1 发现问题（reject 打回修复）/ 2 环境或用法错误（不要改判定脚本）。
3. 配套的浏览器冒烟与资产三核对见 `threejs-browser-smoke-routine.md` 与工作流节点内的本地自检命令
   （`node std-skills/threejs-game-dev/scripts/asset-triple-check.mjs --game {{gamePath}} --spec .myrd/spec/design-spec.json`）。
