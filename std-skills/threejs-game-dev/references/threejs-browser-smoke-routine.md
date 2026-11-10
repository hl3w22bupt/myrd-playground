# `threejs-browser-smoke` 门禁 routine 片段

> 用途：three.js 产物的「浏览器能不能跑」门禁 —— CDP 真 headless Chrome 打开构建产物
> `?smoke=`，**桌面 + 移动双视口**逐视口断言零异常 + 循环推进 + 截图像素采样 + 性能快照证据。
> 判定器本体是仓库内 `std-skills/threejs-game-dev/scripts/browser-smoke.mjs`
>（对构建产物本地伺服取证：先 `node tools/build.mjs` 再跑，工程没有产物会 FAIL(2)）；
> routine 只引用，**绝不携带判定器**。

## 片段（追加到 `.myrd/routines.yaml` 的 `routines:` 下）

```yaml
  - id: threejs-browser-smoke
    name: Three.js 浏览器冒烟
    description: headless Chrome 双视口（桌面+移动仿真）打开构建产物 ?smoke=，机判零异常/循环推进/像素采样/性能快照
    gate: false   # 只该挂在 three.js 目标的工作流上（preHook: threejs-browser-smoke 显式引用），不参与默认门禁
    params:
      gamePath: games/my-3d-game   # 默认被测工程（相对仓库根），工作流节点用 preHookParams 按工程覆盖
    steps:
      - name: browser-smoke
        command: "node std-skills/threejs-game-dev/scripts/browser-smoke.mjs {{gamePath}}"
        target: host
        timeout: 240
```

要点：
1. 判定协议：退出码 0 且日志含 `BROWSER-SMOKE: PASS`；非零列出未过项。
2. 部署后的移动端取证**不用本 routine**（它验的是构建产物基线）：部署 URL 的截图 / FPS / console
   证据由 experience-harness 的 `pack.mjs --url <liveUrl>` 采集（只留证不判定），打磨轮的
   `qa/playtest-summary.json` 完整性校验由 `scripts/playtest-summary.mjs` 装配判定（R3 同一协议）。
