# 《飞车 3D · QQ飞车同人还原》单文件源码逆向分析报告

> 逆向对象：`https://lf3-static.bytednsdoc.com/obj/eden-cn/nulojnulwlo/qqfeiche3d/index.html`
> 报告目的：拆解其「单文件 3D 竞速」的工程实现，重点回答三个问题——**程序化赛道怎么生成、漂移物理怎么写、氮气与道具系统怎么组织**，为 `games/` 下的复刻工程提供可直接落地的技术路线。
> 结论先行：**该游戏是一个零外部资源、零依赖安装的单 HTML 文件 3D 竞速游戏。Three.js r169 以压缩产物内联（B:L281–18814），游戏本体（B:L18815–23644）未做标识符混淆，命名可读（`track / nitroTime / smallBoost / drifting`），所有贴图、几何、音乐、音效全部程序化生成——整个游戏没有任何一次网络资源请求。赛道是「样条控制点 → 1.5m 重采样 → 解析曲率 → 自动倾斜」的管线；漂移是「车头角 h / 车身朝向 m 双角度 + 漂移角钳制 + 集气」的街机模型；道具赛是独立的 `ta` 类（20 个道具箱 + 按名次加权发牌 + 导弹比例导引追踪）。**

---

## 0. 证据文件与行号约定

| 文件 | 说明 |
| --- | --- |
| `qqfeiche3d.html` | 原始抓取文件（717,860 字节 ≈ 718KB / 4,361 行），未做任何修改 |
| `qqfeiche3d.beautified.js` | 从原文件第 281–4359 行提取的内联脚本，经 js-beautify 2.0.3 美化（23,644 行），**本报告所有代码引用行号均指该文件**，记作 `B:L<n>` |

原 HTML 结构（证据：`sed -n '278,282p' qqfeiche3d.html`）：

```html
</div>                                    <!-- H:280 大厅/结算等 DOM 屏 -->
<script>(()=>{var vf=0,eh=1,Mf=2;...      <!-- H:281 单个 IIFE，全部 JS -->
```

`B:L1–280` 为 HTML 头 + CSS（变量驱动的玻璃拟态面板）+ 大厅/暂停/结算 DOM 骨架（含 `<canvas id="gl">`、`<canvas id="minimap">`、`<canvas id="speedo">`、`<canvas id="fx">` 与 7 个触摸按钮）。
`B:L281–18814` 为内联 Three.js **r169**（版本证据：`B:L14278` `setAttribute("data-engine", "three.js r169")`、`B:L17930` `revision: "169"`），含核心库 + addons（EffectComposer / RenderPass / UnrealBloomPass / OutputPass / RoomEnvironment / ExtrudeGeometry 等）。
`B:L18815–23644` 为游戏本体，以 `window.game = new qc`（B:L23636）引导启动。

---

## 1. 引擎与模块拓扑

### 1.1 模块地图（游戏区按职责分块，以下为逆向命名 → 美化行号）

| 行号 | 职责 |
| --- | --- |
| B:L18825–18848 | 数学工具：`he` clamp / `Le` lerp / `Je` 指数阻尼 / `tr` smoothstep / `Ve` 角度归约 / `Ou` 角度阻尼 |
| B:L18850 / 18862 | `bn(seed)` mulberry32 种子随机（增量 0x6D2B79F5）/ `Dc(seed)` 柏林噪声（置换表 + 5 次淡入） |
| B:L18504 | `Bu` **赛道布局表**：4 张图的道路宽度 + 控制点 `[x, z, 拱高]` |
| B:L18625 / 18815 | `Bo` **主题表**（11城/爱琴海/金字塔/雪地）/ `Oo` 模式表（竞速/道具） |
| B:L19214 | `Ho` **赛道类**：样条 → 重采样 → 曲率/坡度/倾斜 → 空间哈希 → `build()` 全部路面网格 |
| B:L19861 / 19897 / 19940 | `ko` 几何批处理（材质×260m 瓦片合并）/ `ju` 渐变天空穹顶 / `tf` 程序化云 |
| B:L19959 / 20039 / 20097 | `ef` 地形（3200m 高度场挖路槽）/ `nf` 水面（3 波向解析法线）/ `sf` 远景天际线 |
| B:L20153–20177 | 资源缓存工厂：`rr`（键值缓存）/ `ht`（Standard 材质缓存）/ `Xn` flat 材质 / `lf` 辉光贴图 / `Vo` 贴图缓存 / `le` 惰性资产 |
| B:L20187–20371 | 程序化贴图/几何：`Wx` 看台人群 / `Xx` 树 / `qx` 棕榈 / `Yx` 松树 |
| B:L20376 | `Wo` **起跑门**（拱门 + 广告横幅 + 4 组红绿灯，`set(n)` 点灯） |
| B:L20669 / 20740 / 20844 / 20972 / 21097 / 21307 | `hf` 主题布景分发 → `e_` 城 / `s_` 爱琴海 / `r_` 金字塔 / `a_` 雪地（含动画 updater） |
| B:L21519 / 21532 / 21568 | `zc` 带倒角挤出（车壳）/ `l_` 车辆几何表（车身/座舱/裙边/轮胎/轮毂）/ `Hc` 车辆组装 |
| B:L21764 / 21785 | `qn` **车辆调参表**（19 个参数）/ `Yo` **玩家赛车**（漂移/集气/氮气/碰撞/腾空） |
| B:L21984 | `Zo` **AI 赛车**（赛道坐标 dist/lat 运动 + 弯道极限速度 + 橡皮筋） |
| B:L22052 / 22097 | `or` GPU 点粒子池（双池：普通/叠加）/ `Jo` 四边形带状池（胎痕/广告牌） |
| B:L22164 / 22217 | `ws` BGM 曲目表（4 首 chiptune）/ `Ko` WebAudio 引擎（音效合成 + 16 步音序器） |
| B:L22398 / 22458 | `Qo` 输入（键鼠+触摸同一 Intent）/ `pf` 道具元数据（emoji 图标） |
| B:L22480 | `jo` HUD（DOM 缓存直写 + 双层小地图 + Canvas 仪表） |
| B:L22631 / 22655 / 22663 | `Vc` 按名次加权道具表 / `u_` 加权抽样 / `ta` **道具系统**（道具箱/导弹/香蕉） |
| B:L22861–22890 | 存档键 `feiche3d.v1` / 难度表 `Wc`（skill+rubber）/ 画质表 `Xc` / 圈数 `ea` / 触摸判定 `Ni` / **固定步长 `na = 1/120`** |
| B:L22892 / 22913 / 22926 | `f_` 主题地形基准高度 / `d_` 地形着色 / `p_` 远景参数 |
| B:L22958 | `qc` **游戏主控**（装配/对局流/相机/结算/特效派发） |

### 1.2 启动与加载（B:L22959–22980、23057–23128）

`new qc` 同步完成设置恢复（localStorage `feiche3d.v1`）、WebGLRenderer 创建（ACES 色调映射、曝光 .92）、`RoomEnvironment` PMREM 环境贴图，随后 `loadMap()` 异步装配并进入菜单演示模式（AI 自动驾驶环绕展示，B:L23566–23572）。加载屏文案「正在生成赛道：11城…」（B:L23058）每 30ms 让出主线程：

```js
// B:L23057–23066（节选，async loadMap）
this.loading = !0, Xt("loading").classList.remove("hidden"),
Xt("loadtxt").textContent = `正在生成赛道：${Bo.find(m=>m.id===t).name}…`,
await new Promise(m => setTimeout(m, 30)),                // 让出主线程刷新进度
...
let r = new Ho(Bu[e.layout], { isBridge: e.isBridge }), // 赛道核心
    o = bn(t.length * 997 + 13),                        // 每张图固定种子 → 可复现布景
    l = r.halfW + (e.track.shoulder ? e.track.shoulder.width + 2.5 : 3.5),
    c = ef(r, { base: f_(t, o, r, a), flatR: l, texture: e.ground, colorAt: d_(t, o), repeat: ... });
n.add(c.mesh), n.add(r.build(e.track, c.heightAt));     // 地形挖槽 → 路面/护栏/隧道
...
try { this.renderer.compile(this.scene, this.camera) } catch {}   // 着色器预编译，避免开局掉帧
```

要点：
- **装配顺序即依赖顺序**：赛道 `Ho` → 地形 `ef`（拿到 `heightAt`）→ `track.build(theme, heightAt)`（桥墩落地）→ 天空/云/雾/双光源 → 水面 → 远景 → 主题布景（含起跑门与动画 updater）→ `ko` 批合并 → `renderer.compile()` 预编译 → `hud.setupMinimap()`（B:L23057–23128）。
- **每张图固定随机种子**：`bn(mapId.length * 997 + 13)`（B:L23062），布景可复现；道具系统另用 `bn(Date.now() & 65535)`（B:L23193，startRace 内）。
- 切图时 `disposeLevel()` 遍历 dispose 几何（B:L23129–23134），避免 GPU 内存泄漏。
- `beforeunload` 在 race/countdown/paused 状态 `preventDefault`（B:L22978–22980），防误关。

---

## 2. 渲染管线

### 2.1 渲染器与画质三档（B:L22963–22967、22996–23020）

```js
// B:L22964–22966
this.renderer = new ao({ canvas: this.canvas, antialias: !0, powerPreference: "high-performance" }),
this.renderer.toneMapping = Qs,                     // ACESFilmic
this.renderer.toneMappingExposure = .92,
this.renderer.outputColorSpace = Re,                // sRGB
this.renderer.shadowMap.type = pc,                  // PCFSoftShadowMap
Hu(Math.min(8, this.renderer.capabilities.maxTextures))  // 各向异性上限 8
```

画质表 `Xc`（B:L22878）三档 → `setupQuality()`（B:L22996）一次性决定全部开销：

| 档位 | pixelRatio | 阴影 | 后处理 |
| --- | --- | --- | --- |
| low 流畅 | 1 | 关闭（`shadowMap.enabled = !1`，B:L22999–23001） | 无（`t === "low"` 提前 return，B:L23006） |
| mid 均衡 | min(dpr, 1.5) | 1024 shadowmap | composer，RT samples 0（B:L23029） |
| high 极致 | min(dpr, 2) | 2048 | composer + HalfFloat RT samples 4 + Bloom（B:L23028–23031） |

切换画质时重建 composer（先 `scene.traverse` 强制 `material.needsUpdate`，再 dispose 旧 RT 重建 composer，B:L23006–23017）。

### 2.2 光照与阴影（B:L23072–23086、23619–23626）

每张图一套 `HemisphereLight`（天/地色 × 强度 .62）+ 平行光（`sunI * .82`），阴影相机为 ±75 正交盒、far 500、`bias -4e-4`、`normalBias .04`。**阴影像素对齐跟随**：每帧把太阳目标位置吸附到 `150 / mapSize.x` 的纹素网格，再沿 `sunDir` 回退 220m 放置光源（B:L23619–23626），消除相机移动时的阴影闪烁：

```js
// B:L23619–23626（节选）
let r = 150 / this.sun.shadow.mapSize.x,
    o = Math.round(i.x / r) * r,          // 世界坐标按纹素尺寸取整 → 阴影不抖
    a = Math.round(i.z / r) * r;
this.sun.target.position.set(o, i.y, a),
this.sun.position.set(o + this.sunDir.x * 220, i.y + this.sunDir.y * 220, a + this.sunDir.z * 220)
```

### 2.3 程序化环境：天空 / 云 / 水面 / 地形 / 远景

- **天空**：`ju(sky)` 生成渐变穹顶 shader（top/horizon/bottom 三段 + 太阳圆盘光晕，B:L19897–19939），每帧 `skyMesh.position.copy(camera.position)`（B:L23619）跟随相机。
- **云**：`tf(seed, center, 30)`（B:L19940）用噪声纹理在固定高度铺 30 朵 billboard 云。
- **水面**：`nf(water, sunDir, horizonColor, center, size)`（B:L20039）单平面 + 自定义 shader，片元里用 **3 个不同方向/频率/速度的余弦波解析求梯度**当作法线，再做菲涅尔混天空色 + 太阳高光（B:L20063–20078）：

```glsl
// B:L20064–20068（节选）
g += vec2(0.8,0.6)  * cos(dot(p, vec2(0.8,0.6)) *0.09 + uTime*1.3) * 0.09;
g += vec2(-0.5,0.85)* cos(dot(p, vec2(-0.5,0.85))*0.17 + uTime*1.9) * 0.06;
g += vec2(0.3,-0.95)* cos(dot(p, vec2(0.3,-0.95))*0.41 + uTime*2.7) * 0.035;
```

  金字塔图为「绿洲」模式：`water.local` 时按关卡给的 `[x, z, r]` 克隆缩放成 5 个小水塘（B:L23103–23111，`scale.setScalar((v + 12) / 30)`）。
- **地形**：`ef(track, opts)`（B:L19959）生成 3200m×3200m、320×320 格（10m/格）高度场，再对赛道每个采样点在 `flatR + f + 48` 半径内把地形**钳进 [路下挖槽, 路上封顶] 区间**（非桥段才封顶），使道路自然嵌入地形；导出 `heightAt` 双线性采样函数，供桥墩落地、道具摆放、相机防穿地共用（B:L20015–20036）。
- **远景**：`sf(seed, center, p_[theme])`（B:L20097）按主题放低模山体/楼群天际线。

### 2.4 相机与速度感（B:L23567–23614）

三档相机（C 键切换）：追近 `dist 8.2 / h 3`、追远 `12.5 / 4.6`、引擎盖 `5.2 / 1.9`。核心公式：

```js
// B:L23581–23588、23612–23613（节选）
u = l.s >= 0 ? l.m + Ve(l.h - l.m) * .35 : l.h,           // 看向点 = 车身朝向 + 35% 漂移偏角
this.camYaw = Ou(this.camYaw, u, l.drifting ? 4.5 : 7, t), // 漂移时相机横向跟随更慢 → 甩尾感
d = h.dist + Math.abs(l.s) * .018 + f,                     // 距离随速度拉远（f: 氮气 1.6 / 小喷 0.8）
...
let m = 66 + Math.abs(l.s) * .12 + (l.nitroTime > 0 ? 9 : 0) + (l.smallBoost > 0 ? 4 : 0);
e.fov = Je(e.fov, m, 4, t), e.updateProjectionMatrix()     // FOV 基础 66 + 速度×0.12 + 氮气 +9
```

速度感三件套：**FOV 拉伸**（B:L23612–23613）+ **HUD 速度线**（Canvas2D，强度 = `( |s| - 42 ) / 30`，氮气时改青色，B:L23630–23634）+ **Bloom 增强**（氮气时 `strength + 0.3`，B:L23635）。氮气时相机再加 ±0.06 抖动（B:L23611）；碰撞 `shake` 二次方衰减（B:L23605–23609）。相机 y 用 `groundAt + 1` 防穿地（B:L23604）。

---

## 3. 程序化赛道生成（任务重点 ①）

本作的赛道**不是**运行时随机生成，而是「**策划控制点 → 样条拟合 → 密集重采样 → 解析几何属性**」的确定性管线。所有玩法查询（投影、贴地、弯道前瞭望）都建立在重采样后的平行数组上，游戏内**零三角函数表、零物理引擎依赖**。

### 3.1 布局表：控制点即关卡（B:L18504–18624）

```js
// B:L18504–18512（11城，节选）
var Bu = {
    city: {
        width: 26,                       // 路宽 26m（halfW = 13）
        points: [
            [-300, -150, 0], [-140, -152, 0], [20, -150, 0],
            [185, -95, 1], [205, -40, 5], [205, 0, 6], ...   // [x, z, 拱高]
        ]
    },
```

4 张图（`city 26m / aegean 24m / egypt / snow`）各 28~30 个控制点，第三个分量是**垂直抬升**（成环的爬坡段，如爱琴海盘山 0→18m 连续爬升）。主题表 `Bo`（B:L18625）则声明材质与玩法资产：路缘配色 `curbA/curbB`、加速带位置 `boostPads: [{at:[x,z], lat}]`、隧道区间 `tunnels`、路肩 `shoulder`、桥面判定 `isBridge(x, z, y)`、BGM 序号 `bgm`。

### 3.2 样条 → 1.5m 重采样（B:L19215–19222）

```js
// B:L19215–19221
let n = new Ti(t.points.map(m => new I(m[0], m[2] || 0, m[1])), !0, "centripetal");  // 闭合 CatmullRom(centripetal)
n.arcLengthDivisions = 6e3, n.updateArcLengths();
let i = n.getLength(), r = Math.round(i / 1.5),       // 每 1.5m 一个样本（全场约 2000+ 点）
    o = n.getSpacedPoints(r).slice(0, r);
this.N = r, this.px = new Float32Array(r), this.py = ..., this.pz = ...;
```

要点：`centripetal` 参数化避免控制点过近时打结；`getSpacedPoints` 得到**等弧长**样本，此后一切距离都是数组下标 × `ds`（1.5m），`sample(s)` 只需一次除法 + 一次线性插值（B:L19342–19352），**零分配**（复用传入/内置的 out 对象）。

### 3.3 解析几何属性：曲率 / 坡度 / 自动倾斜（B:L19222–19250）

重采样后一次性预计算 8 组平行数组：`hd` 航向、`tx/tz` 切向、`rx/rz` 右法向、`slope` 纵坡、`curv` 曲率、`bank` 倾斜、`vcurv` 垂直曲率、`sslope` 平滑坡度：

```js
// B:L19226–19248（节选）
let l = new Float32Array(r);
for (let m = 0; m < r; m++) l[m] = Ve(this.hd[(m + 1) % r] - this.hd[m]) / this.ds;  // 逐点曲率
let c = 7;
for (let m = 0; m < r; m++) {                       // ±7 样本箱式滤波 → curv（约 ±10.5m）
    let y = 0;
    for (let x = -c; x <= c; x++) y += l[(m + x + r) % r];
    this.curv[m] = y / (2 * c + 1)
}
let h = new Float32Array(r);
for (let m = 0; m < r; m++) h[m] = he(this.curv[m] * 5.5, -.13, .13);   // 曲率 → 目标倾角（±0.13rad ≈ 7.4°）
for (let m = 0; m < r; m++) {                       // ±12 样本再平滑 → bank（液压弯道过渡）
    let y = 0;
    for (let x = -12; x <= 12; x++) y += h[(m + x + r) % r];
    this.bank[m] = y / 25
}
```

- **自动倾斜（banking）**：倾角 ∝ 曲率（系数 5.5），钳制 ±0.13rad，再经 ±18m 窗口平滑——这就是「弯道自动内倾」的全部实现，无任何手调数据。
- **垂直曲率 `vcurv`**（B:L19244–19249）：先对高度 ±3 样本平滑得 `u`，再用前向/后向差分之差除以 `f·ds` 得到二阶量，专供**腾空判定**（见 §4.6）。
- **桥面**：逐样本调用主题的 `isBridge(x, z, y)` 得 `bridge` Uint8Array（B:L19251–19255），决定地形是否在该段挖槽、小地图画虚线（B:L22518 区段）、桥墩是否生成。

### 3.4 空间索引与投影查询（B:L19257–19394）

```js
// B:L19257–19261：网格哈希（16m 格，_key 为整型空间哈希）
this.cell = 16, this.grid = new Map;
for (let m = 0; m < r; m++) {
    let y = this._key(Math.floor(this.px[m] / this.cell), Math.floor(this.pz[m] / this.cell)), ...
}
// B:L19353–19382：project(x, y, z, hint, out)
project(t, e, n, i, r) {
    if (i < 0) for (let _ = 0; _ < o; _++) { ... 全量最近搜索（y 差 ×3 加权） }
    else for (let _ = -30; _ <= 30; _++) { ... 只在 hint ±30 样本（±45m）窗口内搜索 }
    ... // 找到最近样本后，把点投影到相邻线段上取分数 t，再 sample() 插值
    return g.lat = (t - g.x) * g.rx + (n - g.z) * g.rz,       // 横向偏移
           g.surfY = g.y + g.lat * Math.sin(g.bank), g        // 考虑倾斜的路面高度
}
```

**hint 窗口搜索**是本作性能关键：每车每物理步一次投影，从 O(N) 降为 O(61)；`reset` 时 `hint = -1` 触发一次全量搜索初始化。`nearest()`（B:L19303）与 `forEachNear()`（B:L19330 区段）同走该网格，供道具/布景按位置查询。

### 3.5 路面网格 `build()`：一条流水线生成全部静态几何（B:L19395–19585）

| 顺序 | 产物 | 关键实现 | 行号 |
| --- | --- | --- | --- |
| 1 | 路面 | 每样本 2 顶点条带，顶点 y 加 `±halfW · sin(bank)` 实现**倾斜路面**；`computeVertexNormals` | B:L19397–19417 |
| 2 | 护栏+侧裙 | 内/外两侧 1.25m 高护栏（UV 弧长/16m 出红白节奏）+ 下垂 1.6m 裙边，`side: DoubleSide` | B:L19417–19468 |
| 3 | 路缘石 | **只在 `curv[g] · -side > 0.011` 的弯道内侧**连续成段生成，UV v = 弧长/3.2m（红白节奏），polygonOffset -2 防 z-fight | B:L19470–19538 |
| 4 | 起终点格纹 | `roadDecal(0, 0, 2·halfW-0.6, 3.2, checker)`，通用贴地贴花函数 | B:L19540–19550 |
| 5 | 加速带 | 主题 `boostPads` 经 `dAt([x,z])` 换算成弧长，11m × halfW 2.8m 贴花 + 动画箭头材质（每帧 `map.offset.y = -time*1.2` 滚动，B:L23244 区段） | B:L19550–19562 |
| 6 | 隧道 | `buildTunnel`：14 段半圆拱（半径 halfW+0.6、高 9.5m），内外两层壳 | B:L19609–19650 |
| 7 | 路肩/桥墩 | `buildShoulders` / `buildPillars(heightAt)`——桥墩按 `heightAt` 落到地形 | B:L19584 |

`roadDecal(s, lat, w, len, mat)`（B:L19586–19607）值得复用：沿弧长每 1.5m 采样 `track.sample`，顶点 = 中心线 ± 法向 × (lat ± w/2)，y = 贴合倾斜路面 + 0.05 抬升，两条三角形组成贴花条。终点线、加速带全部由它生成。

### 3.6 程序化贴图与批处理

- 路面 `ku`（B:L18930）：Canvas 生成沥青噪声 + 车道线；护栏 `Wu`（B:L19016）红白条纹；路缘 `Gu`（B:L18996）双色渐变；格纹 `Vu`（B:L19004）棋盘；加速带 `qu`（B:L19148）发光箭头。全部走 `rr`/`Vo` 键值缓存（B:L20153–20177）。
- 静态几何 `ko` 批处理（B:L19861–19883）：`add(geo, mat, matrix, castShadow)` 以「**材质 uuid + 260m 瓦片坐标 + 是否投影**」为键归组，`build()` 时 `mergeGeometries` 成整 Mesh 并 `matrixAutoUpdate = !1`——主题布景（楼房/树/人群）无论多少个道具，最终只有每种材质×瓦片一个 draw call。

---

## 4. 漂移物理与竞速手感（任务重点 ②）

玩家车 `Yo`（B:L21785）是**纯解析街机模型**：标量车速 `s`（m/s，可负 = 倒车）+ 双角度 `h`（车头指向）/ `m`（车身实际运动朝向）+ 纵向 `vy`。漂移的本质是让 `h` 与 `m` 解耦并钳制夹角。没有刚体、没有轮胎模型，全部手感来自 19 个调参（表 `qn`）与几个指数阻尼。

### 4.1 调参表（B:L21764–21784，复刻时直接照抄）

| 参数 | 值 | 含义 | 参数 | 值 | 含义 |
| --- | --- | --- | --- | --- | --- |
| vmax | 55 | 极速 198km/h | driftMinSpeed | 13 | 起漂最低速 |
| vmaxNitro | 76 | 氮气极速 274km/h | driftYaw | 1.5 | 按住漂移的甩尾角速度 |
| accel / nitroAccel | 24 / 40 | 加速度 | driftYawAlign | 0.85 | 反打方向对甩尾的修正系数 |
| brake / reverseMax | 45 / 12 | 刹车/倒车极速 | driftGrip / driftGripRelease | 2 / 5.2 | 漂移中/松开后 m 跟随 h 的刚度 |
| roll | 2.2 | 自然滚阻 | maxDriftAngle | 1.15rad | 最大漂移角（≈66°） |
| turnRate | 1.9 | 基础转向角速度 | smallWindow | 0.5s | 小喷完美窗口 |
| grip | 12 | 非漂移 m→h 刚度 | gaugeRate | 0.36 | 基础集气速率 |
| gravity | 30 | 重力 | nitroTime | 2.8s | 单瓶氮气时长 |

### 4.2 漂移状态机（B:L21849–21876）

```js
// 起漂：Shift + 有转向输入 + 速度>13m/s + 在地面 + 未眩晕（B:L21849）
if (!this.drifting && e.shift && l !== 0 && this.s > r.driftMinSpeed && u && !a)
    (this.drifting = !0, this.driftDir = l, this.driftTime = 0, this.releaseTime = 0,
     this.smallWindow = 0, this.h += this.driftDir * .07, this.emit("driftStart", {})),
// 漂移中：车头角速度 = 甩尾项（按住）× 速度因子 × 落地系数（B:L21850–21854）
let v = l * this.driftDir,                              // v>0 同向维持 / v<0 反打
    E = w ? r.driftYaw + r.driftYawAlign * v            // 按住：甩尾 + 反打修正
          : (.45 + .9 * v) * Math.exp(-2.2 * this.releaseTime);  // 松开：角速度指数回正
this.h += this.driftDir * E * he(this.s / 26, .35, 1) * t * (u ? 1 : .4);
// 车身朝向 m 向 h 阻尼（漂移中刚度 2，松开后 5.2）+ 最大漂移角钳制（B:L21855–21858）
let T = w ? r.driftGrip : r.driftGripRelease;
this.m += Ve(this.h - this.m) * (1 - Math.exp(-T * t));
Math.abs(R) > r.maxDriftAngle && (this.m = this.h - Math.sign(R) * r.maxDriftAngle, ...)
```

设计要点：
- **速度因子 `clamp(s/26, .35, 1)`**：低速漂移角速度打折，防止低速原地甩尾。
- **反打方向**（`v<0`）：按住 Shift 反打时 `driftYaw + (-0.85)` ≈ 0.65，仍维持漂移但不再加深——QQ飞车「漂移中微调车头」的手感来源；松开 Shift 后角速度按 `exp(-2.2·releaseTime)` 衰减，车头自动回正。
- **漂移滑移阻力**（B:L21860）：`s -= (2.5 + 11·|sin R|)·dt`——漂得越狠掉速越多，这是漂移的机会成本。
- **脱漂条件**（B:L21866）：松开 Shift 且（夹角 <0.1rad 或反打中夹角 <0.26rad）或速度 <7m/s → `endDrift`。

### 4.3 集气（漂移 → 氮气瓶）（B:L21860–21867）

```js
// B:L21860–21867
if (u && !i)
    for (this.gauge += t * r.gaugeRate * (.3 + D * 1.7) * he(this.s / 35, .3, 1.1);
         this.gauge >= 1;)
        if (this.nitroCount < 2) this.nitroCount++, this.gauge -= 1, this.emit("gaugeFull", {});
        else { this.gauge = 1; break }                  // 满瓶 + 满 1 格封顶
```

集气速率 = `0.36 × (0.3 + 1.7·|sin漂移角|) × clamp(s/35, .3, 1.1)`：**横着走（sin 角度大）+ 高速 = 集气快**，直行时也有 0.3 倍底速。上限 2 瓶 + 1 格，与原作「双氮气槽」一致。

### 4.4 小喷 / 落地喷 / 双喷：统一为「窗口 + 即时冲击」（B:L21815–21818、21830–21842）

```js
// 松 Shift 且漂移满 0.22s → 打开小喷窗口（B:L21815–21818）
endDrift(t = !0) {
    this.drifting && (this.drifting = !1,
        t && this.driftTime > .22 && (this.smallWindow = qn.smallWindow, this.windowKind = "drift"), ...)
}
// 窗口期内按 ↑（e.up）触发小喷（B:L21830–21841）
let w = (this.windowKind === "drift" ? r.smallWindow : .45) - this.smallWindow < .2,  // 窗口末 0.2s 内 = 完美小喷
    E = this.nitroTime > 0;
this.smallBoost = w ? 1 : .75, this.smallBoostPower = (w ? 11 : 8) + (E ? 5 : 0),
this.s += w ? 5.5 : 4,                                   // 即时提速
E && (this.nitroTime += .3), this.emit(..., { perfect: w, double: E }),
E && this.emit("double", {}),                            // 氮气中接小喷 = 双喷
```

同一套「窗口」机制覆盖三种原作操作：
| 操作 | 窗口来源 | 行号 |
| --- | --- | --- |
| 漂移小喷 | `endDrift` 给 `smallWindow=.5`，kind="drift" | B:L21818 |
| 落地喷 | 腾空 >0.3s 落地给 `smallWindow=.45`，kind="land" | B:L21922 |
| 双喷（W 喷） | 小喷触发时若氮气进行中 → 额外 `+0.3s` 氮气 + 发 `double` 事件 | B:L21838–21841 |

小喷生效期（`smallBoost > 0`）持续修改极速与加速度：`c += smallBoostPower`（完美 +11 / 普通 +8，氮气中 +5）、`h += 14`（B:L21825–21826）。

### 4.5 氮气与速度模型（B:L21805–21814、21843–21847）

```js
// B:L21809–21814
triggerNitro(t = !1) {
    if (!t) {                                            // t=true = 道具氮气（不扣瓶）
        if (this.nitroCount <= 0) return !1;
        this.nitroCount--
    }
    let e = this.smallBoost > .35;                       // 小喷进行中按氮气 = 双喷判定
    return this.nitroTime = Math.min(4.5, Math.max(0, this.nitroTime) + qn.nitroTime),
           this.s = Math.max(this.s, 20) + 4, ...        // 立即提到至少 24m/s
}
// B:L21843–21847：加速度按 (1 - (s/c)²·0.85) 二次衰减逼近极速，超速按 1.1/s 衰减回
this.s < c && (this.s += h * (1 - Math.pow(this.s / c, 2) * .85) * t),
this.s > c && (this.s -= (this.s - c) * 1.1 * t),
this.s -= o.slope[this.hint] * Math.cos(this.h - o.hd[this.hint]) * 6 * t   // 坡度沿车头分量
```

氮气可叠加（上限 4.5s），松氮气键不中断。坡度阻力把 `slope`（预计算纵坡）投影到车头方向 ×6——上坡自然掉速、下坡自然加速。

### 4.6 腾空 / 落地 / 贴地（B:L21894–21914）

```js
// B:L21925–21930：飞出条件 = 纵向速度 × 垂直曲率离心 > 重力
let v = this.s * Math.cos(this.m - p.hd);
v > 18 && v * v * -o.vcurv[p.i] > r.gravity
    ? (this.airborne = !0, this.vy = o.sslope[p.i] * v, ...)   // 起跳速度 = 坡度 × 速度
    : this.y = y;                                              // 否则贴地
```

腾空中 `vy -= 30·dt`，落地发 `land` 事件（>0.25s 播落地音 + 尘土 + 震屏）。`vcurv > 0`（坡顶凸起）时 `-v·v·vcurv` 为正离心加速度，超过重力即起飞——**这就是「飞坡」的全部实现**，只需要赛道预计算出一个二阶量。

### 4.7 撞墙反弹（B:L21882–21907）

```js
// B:L21882–21907（节选）
let m = o.halfW - 1.1;                                   // 车宽半 1.1m 的可动范围
if (Math.abs(p.lat) > m) {
    let T = Math.abs(p.lat) - m;
    this.x -= w * T, this.z -= E * T;                    // 位置钳回路面
    let R = g * w + _ * E;                               // 速度在墙法向的分量
    if (R > 0) {
        g -= w * R * 1.25; _ -= E * R * 1.25;            // 去除法向分量（反弹系数 1.25）
        let b = 1 - .45 * M;                             // 撞击越正，切向速度损失越多（45%）
        g *= b; _ *= b;
        this.s = N;                                      // 标量速度 = 反弹后合速度
        this.h += Ve(L - this.h) * Math.min(1, .6 * M + .05)   // 车头被"扶正"到贴墙方向
        this.impact = M * D, M > .3 && this.drifting && this.endDrift(!1),
        M * D > 6 ? this.emit("crash", {...}) : D > 8 && this.emit("scrape", {...})
    }
}
```

撞墙不是简单反弹：法向分量按 1.25 削去、切向按撞击角度最多损失 45%、速度标量改写为反弹后合速度、车头向墙切向拉回（撞击越正拉得越快）、并中断漂移。`impact × speed > 6` 记 crash（火花+震屏），否则记 scrape（摩擦火花概率 30%）。

### 4.8 加速带 / 逆行 / 表现层（B:L21931–21962）

- **加速带**（B:L21929–21933）：把车的弧长 `d` 与 `pad.d ± len/2` 环形比较 + 横向 `|lat - pad.lat| < halfW + .6` 且在地面 → `padTime` 生效，并即时 `s += 6`。
- **逆行检测**（B:L21928）：`cos(h - hd) < -.35 && s > 4` 累计 `wrongWay`，HUD 超 1.2s 报警（B:L23477）。
- **表现层 `syncModel`**（B:L21934–21962）：俯仰 = `-atan(坡度·cos(车头-航向))`（腾空时 `-vy·0.012` 钳 ±0.3）、侧倾 = `-bank`；车体横滚 = 漂移 0.07 / 转向 `0.045·clamp(s/30)`；车轮自转 `s·t/0.47`（轮半径 0.47m），前轮转向 ±0.38rad（漂移时反打 0.3rad）；`kc()`（B:L21954–21960）驱动尾部喷焰——氮气蓝色 `0x39A1FF`、小喷橙色 `0xFF9E6A`，scale 以 60Hz 抖动。

---

## 5. 氮气与道具系统（任务重点 ③）

道具赛与竞速赛共用同一辆车的手感层（`Yo`/`Zo`），道具全部由独立类 `ta`（B:L22663）持有与结算，主控只暴露 `hitRacer / racerAhead / sfx / fx` 四个回调——**道具系统不侵入物理层，是可整体摘除的模块**。

### 5.1 道具箱：布设 / 拾取 / 复活（B:L22676–22700、22796–22816）

```js
// B:L22676–22687：4 排 × 5 道 = 20 箱
for (let c of [.1, .35, .6, .85]) {                       // 弧长分数 10%/35%/60%/85%
    let h = c * e.length, u = e.sample(h, {});
    for (let f of [-.6, -.3, 0, .3, .6]) {                // 横向 5 条车道（halfW 系数）
        let d = f * l, g = new $t,
            _ = new k(new Tt(1.8, 1.8, 1.8), o);          // 1.8m 发光立方体（5622015 青）
        g.add(_);
        for (let p of [0, Math.PI / 2]) {                 // 两张交叉的 "?" 贴图
            let m = new k(new Se(1.5, 1.5), a); m.rotation.y = p, g.add(m)
        }
        g.position.set(u.x + u.rx * d, u.y + d * Math.sin(u.bank) + 1.6, u.z + u.rz * d), ...
    }
}
// B:L22805–22812：拾取判定（水平距离² < 6.5 ≈ 2.55m，垂直 |Δy| < 3m）→ 隐藏 + 2.5s 复活
if (a * a + l * l < 6.5 && Math.abs(c) < 3) {
    r.g.visible = !1, r.respawn = 2.5;
    let h = n.indexOf(o) + 1;
    this.giveRandom(o, h, e.length), this.game.fx.burst(r.x, r.y, r.z, 5622015)
}
```

箱子待机动画（B:L22803–22806）：绕 y 自旋 1.6rad/s、绕 x 摇摆 ±0.25rad、悬浮 ±0.2m，全部用同一个 `performance.now()` 时钟驱动。

### 5.2 按名次加权发牌（B:L22631–22659）

```js
// B:L22650–22657：第一名吃「保命组」，最后一名吃「进攻组」
giveRandom(t, e, n) {
    if (t.items.length >= 2) return;                       // 手持上限 2 件
    let i = e === 1 ? Vc.lead : e >= n - 1 ? Vc.back : Vc.mid,   // 按当前名次选权重表
        r = u_(i, this.rnd);
    t.items.push(r), t.isPlayer && this.game.onItemGet(r)
}
```

| 名次 | nitro | missile | banana | shield | magnet |
| --- | --- | --- | --- | --- | --- |
| lead（第 1） | 20 | 10 | 35 | 30 | 5 |
| mid | 25 | 25 | 20 | 15 | 15 |
| back（垫底） | 30 | 32 | 3 | 10 | 25 |

这是原作道具赛「落后补偿」的核心数值——香蕉皮对领先者几乎无用（防守道具 shield 才有用），垫底者几乎拿不到香蕉。`u_`（B:L22655）为标准加权抽样。`swap()`（B:L22659）允许手持两件时 Alt 交换顺序。

### 5.3 五种道具的使用效果（B:L22661–22800）

| 道具 | 效果 | 关键实现 | 行号 |
| --- | --- | --- | --- |
| 🔥 nitro 氮气 | 玩家 `triggerNitro(true)`（免瓶），AI `nitroTime = 2.6` | 复用 §4.5 氮气通道 | B:L22666–22669 |
| 😇 shield 天使 | `shield = 7s`，期间被导弹/香蕉命中只消耗护盾（HUD「天使护体!」） | `hitRacer` 前置判定 | B:L22670–22671、23398–23401 |
| 🧲 magnet 磁铁 | `magnet = 3s`，极速 +10、吸向 `racerAhead`（连线闪电 FX） | AI 极速同样 +10 | B:L22672–22675、21994 区段 |
| 🍌 banana 香蕉皮 | 丢在车后 3.2m：`TorusGeometry(0.55,0.22,8,16,1.3π)` 果身 + 3 个小圆柱脚 | 命中半径² 4.4，主人 1.2s 免疫，存活 90s | B:L22676–22738 区段、22817–22831 |
| 🚀 missile 导弹 | 白圆柱 + 红锥尾，初速 `max(80, 车速+30)`，追踪前车 | 比例导引 `dir.lerp(瞄准向, min(1, 6·dt))`，命中 2.6m，寿命 6s | B:L22739–22792 区段 |

命中结算 `hitRacer`（B:L23398–23404）：

```js
t.spin = e === "missile" ? 1.3 : 1,      // 眩晕时长（导弹 1.3s / 香蕉 1s）
t.s *= .35,                               // 速度砍到 35%
e === "missile" && (t.airborne = !0, t.vy = 8),   // 导弹把车崩上天
t.isPlayer && (t.endDrift(!1), this.hud.message(...), this.hud.flash(), this.shake = .8)
```

眩晕期间 `Yo.update` 强制空输入且车头以 9rad/s 自旋（B:L21820–21823、21867），AI 则把目标速度压到 5（B:L22000 区段）——**同一字段 `spin` 同时驱动玩家与 AI 的失控表现**。

### 5.4 导弹的比例导引（B:L22786–22800 区段）

```js
if (o.target && !o.target.finished) {
    let l = new I(o.target.x - a.x, o.target.y + .8 - a.y, o.target.z - a.z), c = l.length();
    if (l.normalize(), o.dir.lerp(l, Math.min(1, t * 6)).normalize(),    // 每 0.167s 完成一次转向
        o.v = Math.max(o.v, Math.abs(o.target.s) + 35), c < 2.6) {      // 追不上就逐步提速
        this.game.hitRacer(o.target, "missile"), this.game.fx.explode(...)
    }
}
a.addScaledVector(o.dir, o.v * t), o.mesh.lookAt(...)                   // 弹体朝速度方向
```

被锁定者提前 1.6s 收到「⚠ 导弹锁定！」HUD 警告（B:L23413、23477），有反应窗口——天使/漂移规避都来得及。

### 5.5 AI 用道具（B:L22847–22857）

```js
aiThink(t, e, n) {
    if (!t.items.length || (t.itemTimer -= e, t.itemTimer > 0)) return;
    t.itemTimer = 1 + this.rnd() * 3;                     // 每 1~4s 决策一次
    let i = t.items[0], r = this.game.racerAhead(t),
        o = r ? r.progress - t.progress : 1e9;            // 与前车的进度差
    if (i === "missile" && (!r || o > 350)) { t.items.length > 1 && this.swap(t); return }
    i === "magnet" && (!r || o > 150) || this.use(t)      // 导弹射程 350m / 磁铁 150m，否则留/换
}
```

AI 的道具决策只有三条规则（射程内才用、否则与第二件交换、定时器节流），却产生了「前车被追着打、后车合理留牌」的效果——**道具 AI 的复杂度应该花在发牌权重上，而不是行为树上**。

---

## 6. AI 车手与对局流程（状态边界）

### 6.1 AI 车手 `Zo`：赛道坐标下的轻量物理（B:L21984–22036）

AI 与玩家不同构：玩家在世界坐标积分（可撞墙、可腾空），AI 直接在**赛道坐标 `(dist, lat)`** 中运动，天然永不脱轨、永不卡死：

```js
// B:L21990–22007（节选）
let o = qn.vmax * (.8 + .2 * this.skill) * i,          // skill 缩放极速 × 橡皮筋因子 i
    a = this.dist, l = r.curvAhead(a, 8),              // 近处 8m 曲率（用于漂移表现）
    c = 18 + this.s * 1.25,                            // 前瞭距离随速度（≥18m）
    h = r.curvAhead(a, c),                             // 前⽅最大曲率
    f = Math.sqrt(u / Math.max(Math.abs(h), 1e-4)),    // ★ 弯道极限速度 v=√(a_lat/κ)，u=16+30·skill
    d = Math.min(o, f + (this.nitroTime > 0 ? 6 : 0)); // 目标速度 = min(极速, 过弯极限)
...
let p = -Math.sign(h) * he(Math.abs(h) * 45, 0, 1) * _ * .8,  // 走线目标：贴弯道内侧 80%
    m = he(p + this.personal * _ * .8, -_, _),                 // personal: 出厂随机 ±0.3 走线偏好
    y = he((m - this.lat) * 2.2 - this.latV * 2.4, -14, 14);   // 横向 PD 控制器
this.latV += y * t, this.lat += this.latV * t,
Math.abs(this.lat) > _ && (this.lat = Math.sign(this.lat) * _, this.latV *= -.3);   // 出界反弹 -0.3
```

- **弯道极限速度** `v = √((16+30·skill)/κ)` 是唯一的「驾驶技术」来源：车神（skill 1.2~1.38）过同弯比新手（0.55~0.75）快 40%+。
- **`curvAhead(s, dist)`**（B:L19384–19393）：从弧长 s 起以 2 样本步长取前方 dist 内最大曲率——AI 的「看路」只需读预算好的数组。
- 漂移只有表现：`|κ前⽅| > 0.012 && s > 26` 时置 `drifting` 并给 `yawOff = min(0.62, |κ|·22)` 的视觉偏航（B:L22009–22015），轮胎痕/烟雾共用玩家的 FX 管线。
- 腾空/落地与玩家同公式（B:L22008–22011），发射台（vcurv）同样有效。

### 6.2 橡皮筋（B:L23246–23251）

```js
rubber(t) {
    if (!this.player || this.state === "menu") return 1;
    let e = Wc[this.settings.diff], n = t.progress - this.player.progress;
    return n > 0 ? Math.max(e.rubber[0], 1 - n * 45e-5)      // AI 领先 1m 减速 0.0045%，下限 rubber[0]
                 : Math.min(e.rubber[1], 1 - n * 4e-4);      // AI 落后 1m 提速 0.04%，上限 rubber[1]
}
```

难度表 `Wc`（B:L22862）同时给 skill 区间与 rubber 区间：新手 `[.88, 1.03]` / 熟练 `[.93, 1.06]` / 车神 `[.97, 1.1]`。**领先惩罚比落后补偿弱一个数量级**（45e-5 vs 4e-4），保证高手不会被明显拖累、新手又能追上。

### 6.3 对局流程与状态机（B:L23192–23343）

状态集合：`menu → countdown → race → (paused) → finish → result`。关键边界处理：

- **倒计时与起步喷**（B:L23207–23213、23215、23252–23255）：倒计时 3-2-1-GO，`gate.set(0..4)` 同步点亮起跑门红绿灯（全绿 = 出发，B:L20485–20490）；GO 后 **0.28s 内按 ↑ 判定起步加速**（`startBoost = 1.4s, s ≥ 16`，B:L23311–23314）——原作「 Perfect Start 」的等价物。
- **固定步长双循环**（B:L23229–23240）：渲染帧 `loop()` 钳 dt ≤ 0.05，`step()` 里 `acc += dt; while (acc >= 1/120) { 物理子步 }`。**玩家真实输入只在第一个子步注入**，其余子步用剥离边缘标志的副本：

```js
// B:L23229–23238（节选）
let h = { ...o, upPressed: !1, wPressed: !1, nitroPressed: !1 };   // 边缘触发信号只消费一次
for (; this.acc >= na;) {
    this.acc -= na,
    r && r.update(na, c ? o : h, a, this.itemMode), c = !1,        // 玩家
    for (let u of this.racers) u.isPlayer || u.update(na, l, this.raceTime, this.rubber(u));
    this.collide()                                                  // 车车碰撞每子步
}
```

- **输入 Intent 统一两端**（B:L22418–22431）：键盘（↑↓←→ / Shift 漂移 / Space-Ctrl 氮气 / Alt 换位 / R 复位）与触摸按钮（`#t-drift / #t-nitro / #t-boost / #t-swap`…）都归一到同一个 `{up,down,left,right,shift,upPressed,nitroPressed,...}`，`pressed` 集合每帧清空。`blur` 时清空按键（B:L22411）防止切窗后幽灵前进。触摸端还有「未开始比赛时自动按住油门」的辅助（B:L23219–23220）。
- **车车碰撞**（B:L23348–23369）：半径 3.1m 球对，位置各推开 50%，相对法向速度对半交换（`kick`），玩家重算 `s/m`，AI 改 `s/latV/pushD`；相对冲量 >3 播碰撞音 + 震屏。
- **圈数记账防作弊/防抖**（B:L23280–23303）：玩家进度用 `lastD / owed / half` 三个字段记录半圈穿越——**逆行穿过终点线会记 `owed`（欠一圈），再正向穿过时先抵消**，杜绝「来回蹭线刷圈」；AI 直接用 `lapsDone = floor(dist / L)`。完赛 `firstFinish` 后给未完赛玩家 10s 倒计时（B:L23304–23317），4s 转场 + (全员完赛 | 首个完赛 10s | 硬上限 12s) 触发结算（B:L23304–23311）。
- **复位保状态**（B:L23256–23268）：R 键复位把车放回自身弧长、横向钳 ±4m，**保留 `lapsDone/owed/half/gauge/nitroCount`** 再覆盖——重置位置但不清进度。
- **完赛后自动驾驶**（B:L23269–23279）：`autopilot` 用 `sample(d + 18)` 瞄准 18m 前方点生成 Intent（速度 <38 就踩油门），玩家车继续在场上跑，观感自然。
- **菜单演示**：`startDemo()` 用 AI 阵容自动驾驶 + 环绕相机（9s 切一位车手，B:L23572），大厅即游戏内实机录像，零额外资产（`startDemo` B:L23189）。

### 6.4 事件总线与统计（B:L23415–23451）

`Yo` 的所有 gameplay 事件（driftStart / smallBoost / landBoost / double / nitro / gaugeFull / crash / scrape / land / pad）通过 `events` 数组上抛，主控 `handleEvents` 统一翻译成 **HUD 提示 + 音效 + 粒子 + 震屏 + 统计**（`stats.drift/small/perfect/double/nitro/top/crash`，结算页展示，B:L23326–23343）。物理层零 UI/音频依赖——**复刻时应保持这条单向数据流**。

---

## 7. 程序化资产与音频（零外部资源）

### 7.1 资源缓存三件套（B:L20148–20183）

```js
// B:L20151–20156：全局键值缓存（材质/贴图/几何共用）
function rr(s, t) { return Nc.has(s) || Nc.set(s, t()), Nc.get(s) }
// B:L20156：材质缓存——同色同参数永远一个实例
var ht = (s, t = {}) => rr("std" + s + JSON.stringify(t), () => new Dt({ color: s, roughness: .8, ...t })),
// B:L20179：惰性资产工厂（人群贴图、树、车壳等首次用到才构建）
function le(s, t) { return Fc.has(s) || Fc.set(s, t()), Fc.get(s) }
```

### 7.2 车辆：2D 轮廓 → 倒角挤出（B:L21532–21782）

```js
// B:L21532–21545：车壳 = 一条带两个轮拱圆弧的 2D 轮廓，挤出 2m + 0.14m 倒角
s.moveTo(-2.18, .34), ..., s.absarc(-1.38, .3, .54, Math.PI, 0, !0), ..., s.quadraticCurveT...
let t = zc(s, 2, .14)      // zc: ExtrudeGeometry{ depth, bevelThickness, bevelSize, bevelSegments:4 }
```

一辆车 = 车身/座舱/裙边三块挤出壳 + 圆柱轮胎/轮毂/辐条（`l_` 缓存为单例几何），按 `skin.body / accent` 上色；`bodyGeo+cabinGeo+skirtGeo` 复用给全部车手（玩家与 5 个 AI 共享几何，只换材质），车漆 `MeshPhysicalMaterial{ clearcoat:1, clearcoatRoughness:.08 }`（B:L21580–21581）。

### 7.3 主题布景与动画 updater（B:L20669–21511）

`hf(theme, ctx)` 分发到 4 个布景器（城 `e_` L20740 / 爱琴海 `s_` L20972 / 金字塔 `r_` L21097 / 雪地 `a_` L21307）。共性结构：

1. 沿赛道用 `Di(track, interval, cb)`（B:L20679）按弧长间隔摆道具（护栏灯、看台、彩旗）。
2. 散点摆放用 `sr(track, rnd, cx, cz, spread, count)`（B:L20835–20843）：`we(track, x, z, minDist)`（B:L20183）保证离赛道足够远。
3. **把动画闭包 push 进 `ctx.updaters`**，主循环每帧 `u(t, time, camPos)`（B:L23239–23243）——如城市摩天楼顶的飞艇环绕 + 热气球浮动（B:L20840–20845 区段）。
4. 最后 `return Wo(track, ctx, { text: "START · 11城", ... })`——每个布景器都附带一座**起跑门**：拱门 + 横幅文案 + 4 组灯（`set(n)`：n<4 逐个点红，n=4 全绿，B:L20458–20464）。

主题专属程序化模型示例：金字塔图用 `Jx`（B:L20467）生成 3:24:18 段四棱锥并按高度缩放出阶梯感；雪地布景 `a_` 里 `_` 形松树 + 雪人 + 飘雪粒子（`snowfall: !0` 主题开关，B:L18810）。

### 7.4 特效：双 GPU 点粒子池 + 胎痕带（B:L22052–22160）

- `or(max, additive)`（B:L22052）：SoA Float32Array（pos/vel/col/size/life/drag/grav），环形光标 emit，CPU 积分（`vel *= exp(-drag·dt)`，`vy -= grav·dt`），自定义 shader `gl_PointSize = aSize·uScale/depth`（B:L22038–22048），按用途分普通/叠加两池（桌面各 1800，移动端 900，B:L23480–23482）。
- `Jo(2600)`（B:L22097）：胎痕/广告牌用四边形带状网格——`add(wheelId, x, y, z, rx, rz, halfW, alpha)` 把上一触地点与当前触地点连成 2 三角形条带（间距 >5m 自动断带），`alpha × 0.55` 渐隐，`cut(wheelId)` 抬轮断带；polygonOffset -4 防与路面 z-fight（B:L22147–22156）。
- 漂移烟按**距离 LOD**：离相机 >250m 的车完全不发粒子，玩家 55 粒/s、AI 22 粒/s（B:L23518–23526）；集气满时漂移火花从蓝变金（B:L23527–23533）。

### 7.5 音频：全合成 SFX + chiptune 音序器（B:L22164–22396）

- **引擎声**（B:L22242–22248）：双锯齿振荡器（第 2 个半频）→ 低通 → 增益。`setEngine(rpmFrac, speed, nitro, …)` 模拟 6 挡变速箱：`freq = 55 + h·130 + (nitro?35:0)`、`filter = 500 + h·1600 + (boost?500:0)`，h = 挡内转速分数——**换挡顿挫 = 频率锯齿回绕**，零采样。
- **持久噪声层**：共享 2s 白噪 buffer，经带通 2300/Q3 → 胎漂摩擦，带通 700 → 风噪，各自 gain 随状态包络（B:L22249–22255 区段）。
- **SFX 全合成**（B:L22275–22340）：倒计时方波 660Hz、出发 1320Hz、氮气低通扫频噪声 + 锯齿降调、集气完成三连音 1047/1319/1568、碰撞 400Hz 噪声 + 70Hz 正弦等。
- **BGM 音序器**（B:L22347–22396）：曲目表 `ws`（4 首，B:L22164）给出 `{bpm, root, prog[4 小节和弦], lead[8 步旋律], bassPat[8 步]}`；`schedule()` 以 `60/bpm/4` 的 16 分音符步进、前瞻 0.12s 调度 WebAudio 时钟；每步依次合成：底鼓（每 4 步，150→40Hz 正弦扫频）、军鼓（4/12 步带通噪声）、踩镲（奇数步高通短噪声）、贝斯（偶数步按 bassPat，锯齿+低通）、铺底和弦（每小节首步，15 拍长音）、主旋律（每 2 步查 lead 数组，方波/三角按 style 切换）。**整套 BGM = 1 张数据表 + 1 个调度循环**。

---

## 8. HUD 架构（B:L22480–22859）

- **DOM 缓存直写**（B:L22515–22518）：`set(key, el, value)` 只有值变化才写 `textContent`——名次/圈数/时间在 60fps 循环里零无效 DOM 操作。道具槽与集气条按模式 `setItemMode` 切换显隐（B:L22519–22521）。
- **双层小地图**（B:L22524–22565）：底层一次性预渲染（赛道描边两遍：黑底 16px + 白面 9px、桥段虚线、终点格纹）存成 `mmBase` 离屏 canvas；每帧只画动态层——AI 彩色圆点（车身色）+ 玩家三角箭头（按航向旋转），`drawImage(mmBase)` 一次贴底。坐标换算 `mmT(x,z)` 用 `bounds` 归一化。
- **Canvas 仪表**（B:L22566–22590）：225° 弧形表，量程 300km/h、10 刻度，渐变从青→黄→红，**氮气时整条渐变换成青→白**；`drawSpeedo(kmh, nitroOn)` 每帧重绘（小画布，代价可忽略）。
- **速度线**（B:L23630–23634）：全屏 `#fx` canvas（DPR 钳 1.5），强度 = `clamp((|s|-42)/30)·0.6 + 氮气 0.6 + 小喷 0.25`。
- **提示系统**：`hud.message(text, color, sticky?)` 事件驱动（漂移/小喷/双喷/集气完成/加速带/被导弹锁定…），`finalCount` 用于冲线倒计时（B:L23322 区段）。
- **触摸热区**（B:L22439–22455）：7 个按钮 `touchstart/touchend/touchcancel` 三事件全覆盖 + `preventDefault`，按下加 `.on` 类反馈；`Ni = ontouchstart in window || maxTouchPoints > 0` 判定（B:L22889），PC 隐藏整块面板。

---

## 9. 性能与工程化手法清单

| 手法 | 证据 | 说明 |
| --- | --- | --- |
| 等弧长重采样 + 平行数组 | B:L19215–19250 | 所有赛道查询退化为数组下标运算，无对象分配 |
| hint 窗口投影（±30 样本） | B:L19362–19366 | 每车每子步一次 O(61) 投影代替全量 O(N) |
| 网格哈希空间索引 | B:L19257–19261 | 道具/布景/最近查询统一走 16m 格 |
| 固定步长 120Hz + 累加器 | B:L22890、23229–23238 | 物理稳定且与帧率解耦；边缘输入只注入首子步 |
| SoA + 环形光标粒子池 | B:L22052–22095 | 零 GC；离相机 >250m 的车不发粒子 |
| 几何批合并（材质×瓦片） | B:L19861–19883 | 全场景静态几何 draw call 数 ≈ 材质数×瓦片数 |
| 材质/贴图/几何键值缓存 | B:L20148–20183 | 同参数材质全场景唯一实例 |
| 车手几何共享、材质分色 | B:L21532–21782 | 6 辆车共享 1 套挤出几何 |
| 阴影纹素对齐跟随 | B:L23618–23623 | 平行光贴车移动且不抖 |
| 着色器预编译 | B:L23125 | `renderer.compile()` 消除开局着色器卡顿 |
| HUD DOM 差分直写 + 离屏小地图 | B:L22515–22565 | 文本仅变化时写、底图只渲染一次 |
| 画质三档一键降载 | B:L22996–23020 | pixelRatio/阴影/后处理三开关，mid/high 用 MSAA RT |
| localStorage 设置 + `beforeunload` 保护 | B:L22978–22996 | 设置持久化 `feiche3d.v1`；对局中防误关 |
| 零网络请求、全程序化资产 | 全文无 `fetch/XHR/<img src>` | 首屏即全部资源，离线可跑 |

---

## 10. 复刻路线（可直接指导 `games/` 新工程）

### 10.1 建议模块划分（对应本报告行号）

```
src/
├── content/      # Bu 布局表 + Bo 主题表 + qn 调参表 + Vc 道具权重 + Wc 难度表 + ws 曲目表（纯数据）
├── core/         # 纯 TS 确定性内核（Node 可跑、可无头测试）
│   ├── rng.ts noise.ts        # bn mulberry32 / Dc 柏林噪声
│   ├── track.ts               # Ho：样条→重采样→curv/bank/vcurv→空间索引→sample/project/curvAhead
│   ├── car.ts                 # Yo：漂移/集气/氮气/碰撞/腾空（事件上抛，零 UI 依赖）
│   ├── ai.ts                  # Zo：赛道坐标运动 + v=√(a/κ) + 走线 PD + rubber
│   ├── items.ts               # ta：道具箱/发牌/导弹/香蕉（依赖注入 hitRacer/sfx/fx 回调）
│   └── race.ts                # 对局流：倒计时/起步喷/圈数 owed+half/名次/结算
├── render/       # Three.js：track.build 网格 + ef 地形 + ju 天空 + nf 水 + ko 批处理 + or/Jo 粒子
├── ui/           # jo：DOM 差分 HUD + 双层小地图 + Canvas 仪表 + 触摸按钮
└── app/          # qc：rAF + 120Hz 累加器双循环、状态机 menu/countdown/race/paused/finish
```

依赖方向建议与 `games/` 既有规范一致：`core → content`，`three` 仅 `render/` 可用，UI 只订阅 `core` 事件。

### 10.2 必须照抄的公式（含出处）

| 公式 | 出处 | 用途 |
| --- | --- | --- |
| `bank = box(±12)(clamp(curv·5.5, ±0.13))` | B:L19237–19247 | 弯道自动倾斜 |
| `gauge += dt·0.36·(0.3 + 1.7·|sin driftAngle|)·clamp(s/35, .3, 1.1)` | B:L21860 | 漂移集气 |
| `yawE = driftYaw + align·反打`，松开 `(.45+.9v)·e^(-2.2t)` | B:L21850–21854 | 甩尾角速度 |
| `s -= (2.5 + 11·|sin R|)·dt` | B:L21860 | 漂移掉速 |
| `s += h·(1 - (s/c)²·0.85)·dt`，超速 `-（s-c)·1.1·dt` | B:L21843–21847 | 二次逼近极速 |
| 腾空：`v>18 && v²·(-vcurv) > g`，`vy = sslope·v` | B:L21925–21929 | 飞坡 |
| 过弯极限：`v = √((16+30·skill)/κ前⽅)` | B:L21995–21997 | AI 目标速度 |
| 橡皮筋：领先 `1-n·45e-5` / 落后 `1-n·4e-4`，钳 `[rubber[0], rubber[1]]` | B:L23246–23251 | 难度自适应 |
| 导弹：`dir.lerp(瞄准向, min(1, 6·dt))`，`v = max(v, |目标速|+35)` | B:L22790 区段 | 比例导引 |
| FOV：`66 + |s|·0.12 + (氮气?9:0)`，阻尼 4/s | B:L23612–23613 | 速度感 |

### 10.3 验收测试钩子建议

- `core/` 纯函数化 + seeded RNG → 可直接做确定性快进测试（模拟 60s 步进，断言圈数/名次/无 NaN）。
- 状态边界测试点（对应验收 ②③）：GO 前 0.28s 连按 ↑ 只触发一次起步喷（`startTried`）；漂移中按 R 复位后 `gauge/nitroCount` 保留；道具箱 2.5s 复活期不可重复拾取；被导弹命中 `spin` 期间输入被剥离。
- 双端一致性（对应验收 ④）：`Qo.frame()` 返回统一 Intent，触摸与键盘映射同一结构（B:L22418–22431），测试只需断言 Intent 相等。

### 10.4 与《运输船》逆向结论的合并要点（供知识库汇总）

| 维度 | 运输船（FPS） | 飞车 3D（竞速） |
| --- | --- | --- |
| 引擎 | Three.js r186，全混淆 | Three.js r169，未混淆 |
| 世界表示 | OBB 网格 + 角色控制器 | 样条重采样平行数组 + 赛道坐标 |
| 物理步长 | 可变步长 + 子步进 | 固定 1/120 累加器 |
| 程序化资产 | Canvas 贴图 + 程序几何 + 圆角盒枪械 | Canvas 贴图 + 挤出车壳 + 参数化布景 |
| 音频 | WebAudio 分层合成 + speechSynthesis | WebAudio 合成 + 16 步 chiptune 音序器 |
| HUD | DOM 直写 + 预渲染雷达 | DOM 差分 + 双层小地图 + Canvas 仪表 |
| 测试钩子 | `fastForward(seconds)` 无头接口 | 无显式钩子，但 core 纯函数化 + seeded RNG 等价可测 |

> 复刻共性结论：**单文件 3D 游戏的可维护性来自「数据表 + 缓存工厂 + 确定性内核 + 事件上抛」四件套**；表现层（Three.js 场景、粒子、音频）全部围绕这四件套组织，且零外部资源是刻意设计（首屏零等待、离线可跑、体积可控）。

---

*报告完 · 证据基线见同目录 `qqfeiche3d.beautified.js`（23,644 行）*
