# 实况足球 · GOAL RUSH（myrdplaygrou-3）

3D 小场实况足球：**5v5 两队、带球/传球/射门、90 秒一局**，竖屏手机优先（兼容键盘）。
three.js 单文件全程序化路线（模型/贴图/音频零外部资源），kernel/render 确定性内核架构。

- 策划案（唯一事实源）：`.myrd/spec/design-spec.json`（v2：方向键验收标准 + 多球员两队实况 + 人形建模规格）
- 风格卡：`.myrd/style-card.md`（football-flat-bright：#3498db / #2ecc71 / #f39c12）
- 数值唯一来源：`src/numeric.js`（spec.numeric 的代码镜像，调参 = 改 spec 再同步）

## 玩法与操作

| 动作 | 键盘 | 触屏 |
|---|---|---|
| 移动 | WASD / 方向键 | 左半屏虚拟摇杆 |
| 射门 | 空格 | 右下「射门」按钮 |
| 传球 | X | 右下「传球」按钮 |
| 暂停/继续 | P | 右上 Ⅱ |
| 确认（开球/重开） | 回车 | 右半屏点按 |
| 重开 | R | — |

规则：笼式小场（挡板反弹无出界死球），进球后中圈重开，90s 终场按比分判胜负。
受控球员自动切换（主队持球人/离球最近者）；闲置不动时受控人自动上抢（休闲向助攻）。

## 构建与门禁（顺序固定）

```bash
npm install --no-fund --no-audit
node tools/build.mjs          # 单文件 index.html（esbuild 全量内联，勿手改产物）
npm run stage                 # 同步 dist/web/index.html（AppHost assets_dir 部署产物）
node tests/run-all.mjs        # 门禁聚合：构建复现→单文件→确定性→状态机→方向语义→实况契约→冒烟payload
node std-skills/threejs-game-dev/scripts/preflight.mjs .                  # P1-P8 静态前置
node std-skills/threejs-game-dev/scripts/browser-smoke.mjs .              # CDP 双视口冒烟（证据落 qa/smoke/）
node std-skills/threejs-game-dev/scripts/asset-triple-check.mjs --game . --spec .myrd/spec/design-spec.json
```

无头冒烟协议：`index.html?smoke=<秒>` 跳过交互直接快进内核（足球自动驾驶），payload 写
`#ts-smoke` + `document.title`；含 `inputProbe`（方向键机判，缺陷单 sf-bug-controls 核销锚点）、
`playersOnField/teams`（5v5 数量）、`render.playerSegments`（关节人形段件数）。

## 架构（kernel / render 分离铁律）

```
src/
  numeric.js          # 数值唯一来源（spec.numeric 镜像）
  kernel/             # 确定性内核：零 three/零 DOM/零系统随机时钟（Node 可直接跑）
    rng.js loop.js world.js autopilot.js
  levels/pitch.js     # 开球阵型 + 球门几何（内核与渲染同源）
  render/             # three 表现层：scene/player(关节人形)/ball/textures/touch/keyboard/hud/audio
  main.js             # 装配根 + ?smoke= 协议
tests/                # run-all.mjs 聚合的契约测试家族（方向语义/实况机制/确定性/状态机/单文件/冒烟payload）
tools/                # build / src-sha / verify-reproducible / stage-dist
```

- 同 seed 同意图序列 → 同终局（`tests/kernel-determinism.spec.mjs`）；AI-vs-AI 10 种子基线：主 10:客 2、5 胜 5 平 0 负（平缓大众，玩家速度 7.2 > AI 6.4 是胜负手；手感参数需人工试玩校准）。
- 画质四件套：UnrealBloom（1/4 分辨率）+ ACESFilmic + FogExp2 + PCFSoft 阴影（512）；性能预算见 `qa/smoke/report.json`（drawCalls≈201，双视口 fps ≥12.5）。

## 部署

- `games/myrdplaygrou-3/apphost.toml`：`assets_dir=games/myrdplaygrou-3/dist/web`（单文件产物，勿改仓库根 apphost.toml）。
- 部署由平台宿主代行 `deploy_playable`（gitRef=本分支）；产物与部署锚定校验走 SRC_SHA。
- 已知线上取证协议：`window.__audioDebug`（音频解锁契约，mobile-web-smoke 硬检查）。

## 证据档案

- `qa/smoke/`：双视口截图 + report.json（含性能快照）
- `qa/mobile/`：移动端模拟门禁报告（mobile-web-smoke）
- `qa/playtest/`：三轮「改→玩→看」记录 + 截图（playtest-summary 装配 `qa/playtest-summary.json`）
- `qa/visual-ratchet/`：视觉棘轮（advisory 不拦截；本 run 为基线建立轮）
