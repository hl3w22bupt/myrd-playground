---
name: threejs-game-dev
description: "Three.js 3D 网页游戏开发技能包：单文件全程序化路线（模型/贴图/音效全部代码生成，零外部资源）+ kernel/render 确定性内核架构 + 画质配方（Bloom/ACES/雾/重布光/软阴影）+ 双端输入一致 + 构建复现与 CDP 无头门禁。当任务是开发 3D 网页游戏、three.js 场景、或需要『浏览器点开就玩』的 3D 可玩链接时使用。"
---

# Three.js 3D 网页游戏开发技能包（threejs-game-dev）

> 目标：让 agent 独立产出一个**点开链接就能玩**的 3D 网页游戏，画面达到「商业化小游戏的下限」，
> 而不是「看起来像 demo 的 three.js 教程代码」。
> 路线来源：对两个成熟对标产物（CF 运输船复刻 / QQ飞车复刻，单文件 three.js）的全量逆向分析
> + 本仓 transport-ship-3d 工程的实战验证 —— **单文件 + 100% 程序化资产 + 确定性内核**。

---

## 0. 何时用本技能 / 与其它游戏技能的分流

| 任务形态 | 用哪个技能 |
|---|---|
| 2D 玩法原型、快速验证策划案（Canvas/Phaser） | `webgame-prototype` |
| **3D 网页游戏、3D 可玩链接交付、浏览器原生 3D 场景** | **本技能（threejs-game-dev）** |
| 完整游戏、原生桌面/移动分发、重物理与动画手感 | `godot-game-dev` |
| 微信小游戏生态 | `cocos-minigame` |

**触发**：任务要求 3D、three.js、WebGL，或交付形态是「给个 URL 点开玩」的 3D 游戏。
**为什么选 three.js 而不是引擎**：分发即 URL（无 30MB+ WASM 下载）、JS/TS 是 agent 知识最充分的
语言、全部产物是文本（PR diff 可审）、可嵌入现有 Web 前端。代价是没有引擎全家桶 —— 物理、
音频、场景管理自己拼（本技能给出已验证的拼法）。

**本技能目录**（`std-skills/threejs-game-dev/`）：

| 资产 | 用途 |
|---|---|
| `templates/minimal-3d/` | 最小可跑 3D 工程骨架（内核/表现分离 + 画质配方 + 程序化资产 + 构建复现 + 门禁），**实测通过** |
| `scripts/preflight.mjs` | 静态前置一致性检查（零依赖 Node，秒级）：依赖钉版/内核纯度/状态机/输入双端/单文件产物 |
| `scripts/browser-smoke.mjs` | CDP 真浏览器冒烟门禁：headless Chrome 打开产物 `?smoke=`，**桌面+移动双视口**逐视口断言零异常 + 循环推进 + **截图像素采样** + **性能快照证据** |
| `references/rendering-quality-recipe.md` | 画质配方：Bloom + ACES + 雾 + 重布光 + 软阴影的具体参数与坑 |
| `references/procedural-assets.md` | 程序化资产管线：几何拼装 / canvas 贴图 / WebAudio 合成的配方库 |
| `references/external-assets-optin.md` | 外部生成 opt-in 通道 + 资产来源台账：hero 资产的凭据探测 → 外部生成/程序化回退，产物登记台账 |
| `references/error-signatures.md` | 错误签名 → 根因 → 修复动作 对照表 |
| `references/threejs-preflight-routine.md` / `threejs-browser-smoke-routine.md` | 门禁 routine 片段模板（.myrd/routines.yaml 配置，判定器只引用不携带） |
| `scripts/asset-triple-check.mjs` / `playtest-summary.mjs` / `visual-ratchet.mjs` / `lib-png.mjs` | 工坊通用判定脚本（资产三核对 / 试玩证据聚合 / 视觉棘轮 / PNG+pHash 库；与 godot-game-dev 同源，字节一致性由平台单测锁定） |
| `schemas/playtest-summary.schema.json` | 试玩证据聚合视图的 JSON Schema（与 godot-game-dev 同源） |

---

## 1. 脚手架：从模板起步，不要从零写

**规则：任何 three.js 游戏工程都必须从 `templates/minimal-3d/` 复制起步。** 模板里的每条接线
（内核状态机、固定步长循环、画质链、构建指纹、门禁）都是实测通过的；从零手写几乎必然漏掉
其中一条（尤其是 OutputPass 与色调映射的顺序、touch-action 与手势冲突这类静默坑）。

```bash
# ① 复制模板（node_modules 不带走，按 lockfile 重装）
cp -R <技能目录>/templates/minimal-3d/ <目标工程目录>/
cd <目标工程目录> && npm install --no-fund --no-audit

# ② 构建 + 门禁（顺序固定，全部通过再写玩法）
node tools/build.mjs                          # 产出单文件 index.html
node tests/run-all.mjs                        # 门禁聚合器：构建复现 → 单文件契约 → 内核确定性 → 状态机
node <技能目录>/scripts/preflight.mjs .       # 静态前置检查（FAIL 不许进玩法开发）
```

版本口径：`three` 与 `esbuild` 在 `package.json` **精确钉版**（不带 `^`/`~`，preflight P1 机判）。
对标产物用 r169 / r186，模板实测 0.185.1 —— 升级 three 先跑全部门禁再动玩法。

---

## 2. 架构铁律：kernel / render 分离

```
src/
  numeric.js          # 数值唯一来源（spec.numeric 的代码镜像；禁止散落魔数）
  kernel/             # 确定性内核：零 three / 零 DOM / 零系统随机 / 零系统时钟 —— Node 可直接跑
    rng.js            #   mulberry32 种子随机（内核唯一随机源，禁 Math.random）
    world.js          #   世界状态 + 移动碰撞 + 收集判定（纯函数）
    loop.js           #   固定步长累加器 + 显式状态机 + fastForward 无头钩子
  levels/             # 关卡布局数据：内核碰撞与表现层拼装共享同一份真源
  render/             # 表现层：three 场景映射 + 程序化资产（textures/geometry/audio/hud/touch）
  main.js             # 装配根：内核状态机 ↔ DOM/输入/渲染循环
```

1. **内核可无头测试**：`src/kernel/` 禁止 import three、禁止 `document/window`、禁止
   `Math.random/Date.now/performance.now`（preflight P3 机判）。测试直接 `import` 内核跑
   tick 序列断言 —— 这是不起浏览器就能验玩法的前提。
2. **确定性**：同 seed 同输入序列 → 同最终状态。关卡布局由种子驱动；表现层可以做非确定性
   装饰（粒子抖动），但**不得回写内核状态**。
3. **固定步长**：`requestAnimationFrame` 只负责采样 dt，内核按 `FIXED_STEP` 累加器推进；
   dt 钳制 `MAX_DT`（切后台回来不许瞬移）。
4. **显式状态机**：`title → playing → paused → gameover` 四态起步，转移全部有守卫
   （非法转移 no-op + warning 事件），放在内核里（可无头断言）；边界对抗（连按暂停、
   结算瞬间继续输入、中途重开复位）是常驻测试，不是一次性的。
5. **输入意图归一**：键盘/触摸都只产出一个 `{ moveX, moveZ, ... }` intent 喂内核 ——
   严禁游戏逻辑直接监听原始事件，那会造出两套平行的输入路径。

---

## 3. 资产政策：100% 程序化，零外部资源

对标产物的硬结论：**模型、贴图、音效全部由代码生成** —— 单 HTML 打开即玩、无加载失败、
无版权风险、agent 纯代码即可产出完整游戏。配方见 `references/procedural-assets.md`：

| 资产类型 | 生成方式 |
|---|---|
| 3D 模型 | 基本几何体拼装 + `ExtrudeGeometry` 拉伸成型（船体/车型都是这么做的） |
| 贴图 | 离屏 `canvas` 2D 绘制 → `CanvasTexture`（网格/渐变/噪点/徽标） |
| 音效 | WebAudio 合成：`oscillator + biquad 滤波 + gain 包络 + DynamicsCompressor` |
| 物理 | **不引入物理引擎**：AABB/圆碰撞 + 自写运动模型足够（对标两局都没有物理库） |

**禁止**：CDN importmap、`http(s)://` 外链资源、加载 GLTF/FBX/音频文件（确需外部资产走
spec 的 assets 段治理，见 webgame-prototype §7B，且构建后必须内联）。
`tests/singlefile.contract.mjs` 机判产物零外链。

**唯一的例外通道（opt-in）**：hero 资产（主角/载具/Boss/宣传图/主题曲）允许走外部生成
（Tripo/Gemini/ElevenLabs 类）——凭据探测、缺 key 回退程序化、产物一律进来源台账，
红线与门禁全部不变。完整协议见 `references/external-assets-optin.md`。

---

## 4. 画质配方（对标产物逆向出的四要素）

这是「看起来高级」和「看起来像 demo」的分水岭，四件套缺一不可
（具体参数与坑见 `references/rendering-quality-recipe.md`）：

1. **UnrealBloomPass 后期辉光**（EffectComposer 链尾必须 OutputPass）；
2. **ACESFilmicToneMapping** 电影感色调映射；
3. **重布光**：HemisphereLight 底光 + 主 DirectionalLight（软阴影 PCFSoft, mapSize ≥ 1024）
   + 2-4 个彩色 PointLight/SpotLight 点缀 + `FogExp2` 指数雾；
4. **pixelRatio 上限 2**（`min(devicePixelRatio, 2)`）—— 不设上限手机必烫。

preflight P6 对四件套做 warning 级扫描（新手最容易忘的就是 OutputPass 和雾）。

---

## 5. 单文件构建与复现

构建器 `tools/build.mjs`：esbuild 打包 `src/main.js`（three 全量内联，minify + iife）
注入 `index.template.html` → 产物 `index.html`（**勿手改**）。配套两条硬规矩：

1. **源码指纹**：`tools/src-sha.mjs` 对「实际决定产物的全部输入」（src/ + 模板 + 构建器）
   算 sha256 写进产物注释；QA 审计复算比对，防「产物与源码对不上」。
2. **构建可复现**：`tools/verify-reproducible.mjs` 连续两次构建逐字节比对（门禁第一环）。
   新检出 `npm install && npm run build` 必须成功 —— 构建关键依赖全部显式声明并钉版
   （这是 transport-ship-3d 验收口径 A 的实战教训：esbuild 未声明 → 新检出直接失败）。

---

## 6. 输入双端一致（桌面键鼠 ↔ 移动触摸）

spec 声明了移动 Web 就不存在豁免 —— 双端必须同一套行为口径：

- **CSS 兜底**：`html/body/#gl` 全部 `touch-action:none` + `overscroll-behavior:none` +
  viewport `maximum-scale=1` —— 不做这个，浏览器手势（滚动/双击缩放/300ms 延迟）会吞事件；
- **触摸控件**：虚拟摇杆（左半屏）/ 滑动视角（右半屏）/ 固定按钮热区 ≥ 44px；
  `touchstart` 直响应（不走 click），事件只注入 intent，不直改游戏状态；
- **preflight P5 机判**：有 keydown 处理就必须有 touch 处理（或显式豁免声明）；
- **移动端实测证据**：CDP 移动仿真（viewport 390×844 + touch + dpr）跑通
  开局→触摸移动→交互→暂停→重开 全链路再交付（transport-ship-3d 的 `cdp-mobile-chain.mjs`
  是参考实现：Input.dispatchTouchEvent 真输入管线 + 分环截图 + 帧率采样）。

---

## 7. 验证协议（三层，顺序固定）

```bash
# ① 静态前置检查（零依赖，秒级）—— 先拦「必然白屏/不可复现」的问题
node <技能目录>/scripts/preflight.mjs <工程目录>

# ② 内核门禁（Node 零依赖）—— 构建复现 + 单文件契约 + 内核确定性 + 状态机边界
node tests/run-all.mjs        # 目录扫描式聚合器，新增 *.spec.mjs 自动纳入

# ③ 真浏览器冒烟（CDP，需本机 Chrome）—— 打开即玩、零异常、循环推进、帧率下限
node <技能目录>/scripts/browser-smoke.mjs <工程目录> [--seconds 5] [--chrome <path>]
```

- 产物支持 `index.html?smoke=<秒>` 协议：跳过交互直接快进内核，把结果 JSON 写进
  `#ts-smoke` 与 `document.title`（`SMOKE {...}`）供无头断言 —— 模板已内置。
- **双视口**：桌面（1280×720）+ 移动（720×1280，触摸仿真 + 移动 UA）各跑一遍，逐视口独立断言
  ——「移动端会不会坏」不能靠桌面视口代言（构图/裁剪/帧率都随视口变）。
- 断言口径（逐视口）：payload 可解析、`exceptions === 0`、渲染确已开始（frames > 0）、
  状态机按快进时长推进到 gameover、帧率 ≥ 10fps（headless SwiftShader 下限）、
  **截图 400 点 16 级量化采样非纯色**（纯色 = 黑屏/白屏/没渲染出来，移植自 cocos smoke 的
  像素断言）。
- **性能快照进证据链（不做硬门禁）**：payload 的 `render` 字段（drawCalls / triangles /
  geometries / textures / programs，整帧全 pass 统计——EffectComposer 下必须关
  `renderer.info.autoReset` 否则只读到链尾 OutputPass 的 1 次 drawCall）。headless SwiftShader
  是软件渲染，测不出真实性能，阈值待采集基线；证据落盘 `qa/smoke/`（双视口截图 + report.json）。
  **触发纪律：画面、资产、shader 或后处理变更时必跑本门禁** —— 让每次视觉变更都留一份
  性能与截图证据，而不是只在交付前跑一次。
- 门禁不过 → 按 `references/error-signatures.md` 的签名修；新签名修复成功后按
  `签名 → 根因 → 修复动作` 三段沉淀进该表。

---

## 8. 策划案对齐与交付

- **spec 单一事实源**：策划案读取协议、目录语义、契约测试（`game-contract` routine）与
  webgame-prototype 共用 —— 实体/关卡/数值落点跟 spec 走，改数值 = 改 spec 再同步
  `src/numeric.js`，禁止两头各改各的。
- **交付协议**：
  1. 门禁三层全绿（preflight / run-all / browser-smoke）；
  2. 部署后 `[CHECKPOINT] {"op":"deploy_playable","artifactId":"<部署记录>","url":"<https URL>","title":"可玩原型"}`
     落账（目标卡片出现「可玩」入口）；
  3. 移动端链路取证落 `.myrd/blackboard/gate-logs/`（截图 + 帧率 + JSON 断言），
     不写「已完成」，写「可核对状态」。
- **验收标准可判定**：手感类参数（灵敏度、阻尼、bloom 强度）集中到 `src/numeric.js` 并在
  交付说明里标注「需人工试玩校准」，禁止用「手感好」「画面好看」伪装成已验收。


---

## 9. 工坊量产闭环接入（R1-R4 · Three.js 小游戏工坊流水线）

> 本技能是「Three.js 小游戏工坊」（`threejs_game` 垂类包）的主技能：工坊统一流水线
> `scaffold → implement → deploy → playtest → polish`（Three.js 小游戏工坊流水线）按本技能的
> 架构铁律与门禁执行。机制与 Godot 小游戏工坊同构（资产三核对 / 试玩证据链 / 视觉棘轮 /
> 自动放行 ADVISORY），判定器只认**仓库内** `std-skills/threejs-game-dev/scripts/` 副本。

- **资产供给默认化（R1）**：spec 资产清单（assets + assetBudget 段）+ `asset-triple-check.mjs`
  四向核对。单文件契约下的生成资产走 base64 内联或 asset-store 文本通道
  （见 `references/external-assets-optin.md` 体积预算）；three.js 的程序化路线可以全
  `source=programmatic + reason` 显式声明 —— 写清为什么程序化更优也是合法选择，但清单段必须存在。
- **试玩证据链（R3/M2）**：打磨轮次记录 `qa/playtest/round-N.md` 按 `## 观察 / ## 动作 / ## 截图`
  机器可解析段协议落盘（截图持久化 `qa/playtest/steps/`）；收尾由
  `node std-skills/threejs-game-dev/scripts/playtest-summary.mjs --game <gamePath> --version-sha "$(git rev-parse HEAD)"`
  装配 `qa/playtest-summary.json` 并做完整性校验（缺证据不得判 PASS）。schema 见 `schemas/`。
- **视觉棘轮（R3/M3，advisory）**：`node std-skills/threejs-game-dev/scripts/visual-ratchet.mjs
  --game <gamePath> --scenario polish-<runId> --before <上一证据目录> --after qa/playtest/steps`
  —— pHash 相邻证据包 diff，报告落 `qa/visual-ratchet/`，**绝不拦截 verdict**。
- **自动放行（R3/M4，ADVISORY）**：playtest / polish 回写 `op=playtest_summary` 产物
  （detail=单行 JSON 摘要），平台按 `GET /api/v1/app-creation/auto-pass-stats` 统计；
  ENFORCE 受金标校准与人工拍板门控，本技能不提供任何 enforce 开关。
