# 运输船 3D · 单文件 Three.js FPS 复刻原型

以《运输船 · 穿越火线 3D》复刻路线为输入的**可运行原型**：单 HTML 文件、Three.js 全量内联、
资产全程序化（Canvas 贴图 / 圆角盒几何 / WebAudio 合成）、确定性内核可无头测试。

玩法：登上运输船甲板，敌兵从舰桥、左右舷三个方向一波强过一波地涌来；击杀得分、爆头加成、清波拿奖励并回血；血量归零结算。

## 玩

直接双击打开 `index.html`（或任意静态服务器）。点击「开始」锁定鼠标。

- WASD 移动 · Shift 疾跑 · 鼠标瞄准 · 左键射击 · R 换弹 · Esc 暂停/释放鼠标

## 工程结构（逻辑/表现分离 + 数值唯一来源）

```
index.template.html   # 入口模板（CSS 风格卡 + canvas + #ui）
index.html            # 构建产物：单文件、零外部资源（勿手改，node tools/build.mjs 生成）
tools/build.mjs       # esbuild 打包 src/main.js + three → 单文件；带 SRC_SHA 源码指纹
src/
  numeric.js          # 数值唯一来源（spec.numeric v3 的代码镜像）
  kernel/             # 确定性内核：零 three / 零 DOM / 零系统随机 / 零系统时钟（Node 可直接跑）
    rng.js world.js wave.js combat.js loop.js
  levels/level-01-deck.js  # 关卡布局数据（内核碰撞/出生点 与 表现层拼装共享同一份真源）
  render/             # 表现层：three 场景映射 + 程序化资产（textures/geometry/map/player/enemy/hud/audio）
  main.js             # 装配根：状态机 title→playing→paused→gameover；内核事件→HUD/音效/后坐
tests/                # 验收测试（Node 零依赖，对应 spec.acceptance[].check）
```

## 测试与门禁

```bash
node tools/build.mjs                                                  # 构建单文件产物
node scripts/contract-check.mjs --spec .myrd/spec/design-spec.json --project .   # 契约门禁（game-contract routine）
node games/transport-ship-3d/tests/singlefile.contract.mjs            # ac-1 单文件零外部资源
node games/transport-ship-3d/tests/kernel-determinism.spec.mjs        # ac-2 内核确定性
node games/transport-ship-3d/tests/combat.spec.mjs                    # ac-3 武器数值与 spec 一致
node games/transport-ship-3d/tests/wave.spec.mjs                      # ac-4 波次确定性递增
node games/transport-ship-3d/tests/qa-audit.mjs                       # ac-6 QA 互查审计（六道关）
```

无头冒烟（真浏览器跑内核 + 渲染统计）：`index.html?smoke=<秒>` → DOM/标题写回结果 JSON。
真浏览器冒烟门禁（CDP 驱动，断言打开即玩/循环推进/零未捕获异常/重玩钩子落账）：
`node games/transport-ship-3d/tools/smoke.mjs`（需本机 Chrome，`--chrome` 可指定路径）。

## 构建复现（验收口径 A）

构建关键依赖已显式钉死精确版本（`three@0.185.1`、`esbuild@0.28.2`，其余由 `package-lock.json` 锁定），
从基线 **pr-25（commit `0659452`）** 起三步复现，产物逐字节一致：

```bash
git fetch origin pull/25/head && git checkout 0659452   # ① 回基线
npm ci --no-fund --no-audit                             # ② 按 lockfile 精确装依赖（不解析新版本）
npm run game:verify                                     # ③ 连构两次 → sha256 比对 + SRC_SHA 源指纹复核
```

- `npm run game:verify`（`tools/verify-reproducible.mjs`）机判：主产物与 `export/web/index.html`
  两次构建 sha256 一致、主产物 ↔ 导出拷贝一致、`SRC_SHA` 与 `tools/src-sha.mjs` 复算一致；
  末行输出单行 JSON 证据 `REPRODUCIBLE-BUILD {...}`，失败非零退出。
- `npm run game:test`（`tests/run-all.mjs`）为全量门禁聚合入口（含上项与全部验收测试），CI 常驻。

## 复刻要点对照（与知识文档的映射）

| 知识文档范式 | 本工程落点 |
|---|---|
| 零外部资源（唯一网络请求是 HTML 本身） | three 内联 + 程序化资产 + WebAudio 合成；`tests/singlefile.contract.mjs` 机判 |
| 数据表驱动（代码零魔法数） | `src/numeric.js` ↔ `spec.numeric`（41 键双向一致，qa-audit 机判） |
| 确定性内核 + 事件上抛 | `src/kernel/*`（seeded RNG + 固定 1/60 累加器 + fastForward）；main 统一翻译事件 |
| 双场景武器视图模型（fov 58 / 78） | `render/player.js` vmScene/vmCamera，`clearDepth` 叠加 |
| 缓存工厂 | `render/geometry.js` roundedBox/standardMat 键值缓存；`render/textures.js` cached() |
| 装配顺序即依赖顺序 + compile 预编译 | `main.js` 渲染器→布景→装配→HUD/音频→输入→主循环 |
| URL 参数即调试接口 + window.__game | `?smoke=<秒>` 无头冒烟 + `window.__game.fastForward(seconds)` |

## AppHost 部署形态（单文件游戏 × 底座 A）

```bash
node tools/build.mjs               # 一步产出两份：主产物 index.html + 部署产物 export/web/index.html（同一字符串，勿手改后者）
bash server/tools/verify-local.sh  # 壳端到端门禁：tsc → esbuild bundle（平台同款 runner 胶水）→ 起服 → 伪对象存储喂 assets_dir
```

- `apphost.toml`：`name="transport-ship-3d"`、`assets_dir="games/transport-ship-3d/export/web"`（对齐 soccer 线惯例 `games/<slug>/export/web`）。
- 壳（仓库根 `server/`，Node20 + Hono）：本游戏是**单 HTML**（引擎+资产全内联），所以与 Godot 壳不同 —— `/` 直接把 assets_dir 里的 `index.html` 当响应体回出去，没有 wasm/pck 的 base64 中转，也没有子资源路径改写；资产不可得 → `503` 诊断页；`/health` 不依赖资产就绪。
- 平台资产口径：`.html` 以 raw + `text/html` 上传（只有 `.wasm`/`.pck` gzip），壳内保留 gzip+b64 兼容分支（口径变化时显式降级，不回乱码）。
- 部署调用（目标应用就位后）：`POST /api/v1/apphost/apps/<appId>/deployments`，body `{"mode":"bundle","deployedBy":"workflow","gitRef":"<本分支>"}`。
- 当前部署状态：blocked 于平台无本目标 hostedApp —— 见 `.myrd/blackboard/blockers.md` B-6。
