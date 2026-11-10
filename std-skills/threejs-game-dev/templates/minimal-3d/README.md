# minimal-3d · threejs-game-dev 最小可跑模板

「星尘收集 GEM RUSH」：俯视角收集 8 颗宝石，60 秒限时。**kernel/render 分离 + 单文件构建复现
+ 画质四件套**的参考实现 —— 从本模板派生新 3D 游戏时，全部接线与门禁直接复用。

## 玩

```bash
npm install --no-fund --no-audit
node tools/build.mjs        # 产出单文件 index.html（零外部资源，双击即可玩）
```

- WASD / 方向键移动 · 空格暂停 · R 重开 · 回车开始
- 触屏：左半屏虚拟摇杆移动 · 右半屏点按确认（touch-action:none 兜底）

## 结构

```
index.template.html   # 入口模板（CSS 风格卡 + canvas + #ui；<!--BUNDLE--> 注入位）
index.html            # 构建产物：单文件、零外部资源（勿手改，node tools/build.mjs 生成）
src/
  numeric.js          # 数值唯一来源（spec.numeric 的代码镜像）
  kernel/             # 确定性内核：零 three / 零 DOM / 零系统随机 / 零系统时钟（Node 可直接跑）
    rng.js            #   mulberry32 种子随机（唯一随机源）
    world.js          #   世界状态 + 移动碰撞 + 收集判定（纯函数 + 边界加固）
    loop.js           #   固定步长累加器 + 显式状态机（守卫转移）+ fastForward 无头钩子
  levels/level-01.js  # 关卡布局：障碍固定 + 宝石种子拒绝采样（内核与渲染共享真源）
  render/             # 表现层：scene（画质四件套）/ textures / audio（WebAudio 合成）/ hud / touch
  main.js             # 装配根：状态机 ↔ DOM/输入/渲染循环；?smoke= 无头冒烟协议
tests/                # 门禁：目录扫描式聚合（run-all.mjs），新增 *.spec.mjs 自动纳入
tools/                # build（esbuild 单文件）+ src-sha（源码指纹）+ verify-reproducible（双构建哈希）
```

## 门禁（三层，顺序固定）

```bash
node ../../scripts/preflight.mjs .        # ① 静态前置检查（零依赖，秒级）
node tests/run-all.mjs                    # ② 构建复现 → 单文件契约 → 内核确定性 → 状态机边界
node ../../scripts/browser-smoke.mjs .    # ③ CDP 真浏览器冒烟（需本机 Chrome）
```

无头冒烟协议：`index.html?smoke=<秒>` 跳过交互直接快进内核，结果 JSON 写 `#ts-smoke` +
`document.title`（`SMOKE {...}`）—— 含 state/score/collected/timeLeft/fps/exceptions +
viewport（宽高/dpr）+ render 性能快照（drawCalls/triangles/geometries/textures/programs，
取自 `renderer.info`，已关 autoReset 按整帧全 pass 统计）。

browser-smoke 以**桌面（1280×720）+ 移动（720×1280）双视口各跑一遍**，逐视口断言
payload/零异常/渲染开始/帧率/状态机推进/**截图 400 点采样非纯色**；证据落盘 `qa/smoke/`
（双视口截图 + report.json，`.gitignore` 已排除）。`render` 字段是证据记录不做硬门禁 ——
headless SwiftShader 软渲染测不出真实性能，阈值待采集基线；触发纪律见 SKILL.md §7：
**画面/资产/shader/后处理变更时必跑**。

## 派生新游戏时

1. 改玩法 = 改 kernel（世界模型/事件）+ render（表现映射）+ numeric（数值）；
2. 状态机四态与守卫转移保留（边界测试依赖它）；
3. 画质四件套（Bloom/ACES/雾/软阴影）不要拆 —— 拆了画面立刻回退到 demo 感；
4. 新增门禁 = 新增 `tests/*.spec.mjs` 文件，聚合器自动纳入；
5. spec 声明了移动 Web 就必须双端输入一致（preflight P5 机判）。
