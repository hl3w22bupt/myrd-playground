# 《运输船 · 穿越火线 3D》单文件源码逆向分析报告

> 逆向对象：`https://lf3-static.bytednsdoc.com/obj/eden-cn/nulojnulwlo/cf-transport-ship/transport-ship.html`
> 报告目的：拆解其「单文件 3D FPS」的工程实现，为 `games/` 下的复刻工程提供可直接落地的技术路线。
> 结论先行：**该游戏是一个零外部资源、零依赖安装的单 HTML 文件 FPS。Three.js r186 + 全部 addon 以压缩产物内联，其余 ~650KB 是游戏本体（高度混淆/压缩）。所有贴图、几何、音效、语音、UI 图标全部程序化生成——整个游戏没有任何一次网络资源请求。**

---

## 0. 证据文件与行号约定

| 文件 | 说明 |
| --- | --- |
| `transport-ship.html` | 原始抓取文件（861,782 字节 / 5,122 行），未做任何修改 |
| `transport-ship.beautified.js` | 从原文件第 204–5119 行提取的内联脚本，经 js-beautify 2.0.3 美化（29,422 行），**本报告所有代码引用行号均指该文件**，记作 `B:L204` |

原 HTML 结构（证据：`sed -n '201,204p' transport-ship.html`）：

```html
<body>                                  <!-- H:201 -->
<canvas id="c"></canvas>                <!-- H:202  Three.js 渲染画布 -->
<div id="ui"></div>                     <!-- H:203  HUD 容器（innerHTML 注入） -->
<script>(()=>{var sd=0,nh=1,rd=2;...    <!-- H:204  单个 IIFE，全部 JS -->
```

`B:L1–20105` 为内联的 Three.js **r186**（版本证据：`B:L186` 附近 `REVISION = "186"`），包含核心库 + addons（EffectComposer / RenderPass / UnrealBloomPass / ShaderPass / OutputPass / Sky / CapsuleGeometry / BufferGeometryUtils），且 `RoundedBoxGeometry` 被重新实现为游戏内类 `ic`（B:L23429）。
`B:L20106–29422` 为游戏本体，以 `var Ry = new pc; Ry.init().catch(...)`（B:L29417–29422）引导启动。

---

## 1. 引擎与模块拓扑

### 1.1 模块地图（全部经混淆，以下为逆向命名 → 美化行号）

| 混淆名 | 行号 | 职责 |
| --- | --- | --- |
| `ci/De/Zi/pe` | B:L20139/20147/20180/20190 | mulberry32 种子随机 / fBm 值噪声 / 高度→法线 / CanvasTexture 工厂 |
| `Rf` | B:L20920 | **纹理工厂**（按画质生成全套程序化贴图） |
| `Yh` | B:L21024 | **静态几何批处理构建器**（按材质合并 draw call） |
| `If` | B:L21056 | **地图构建**（运输船全部静态几何 + 碰撞体 + 出生点） |
| `Wv/Lf/qv` | B:L21816/21833/21854 | 运行时烘焙 AO / 船体外轮廓参数曲线 / 船体放样网格 |
| `mr` | B:L21914 | 内联 Preetham 大气散射天空（Sky addon 重打包） |
| `Yv/$v` | B:L22279/22360 | 程序化海洋（Gerstner 波）/ 程序化云层 |
| `Jl` | B:L22500 | **环境系统**（太阳/雾/PMREM 环境贴图/昼夜预设/船行进视差） |
| `jl`/`gr` | B:L22551/22568 | OBB 碰撞体 / **世界**（网格哈希 + 射线 + 角色控制器） |
| `Ql` | B:L22781 | **A\* 寻路网格**（0.5m 格 + 二叉堆 + 串点拉直） |
| `tc`/`xr`/`ec` | B:L22935/22977/23009 | GPU 粒子池 / 实例化贴花 / **特效系统** |
| `ic/Zh/Na` | B:L23429/23476/23750 | 圆角盒几何 / mergeGeometries / 武器模型合并缓存 |
| `Jv`/`rc` | B:L23673/23826 | **程序化枪械建模库** / 第一人称视图模型（IK 手臂+动画时间线） |
| `mi`/`_s` | B:L24063/24295 | **武器数据表**（7 把全参数）/ 武器实例状态机 |
| `Ff/Bf/Of` | B:L24316/24325/24337 | 散布公式 / 后坐力弹道 / 圆锥随机 |
| `oc`/`ry` | B:L24364/24582 | **HUD** / HUD HTML 模板 |
| `nu`/`kf` | B:L25010/24681 | **WebAudio 合成音频引擎** / 每把枪的合成参数 |
| `hc` | B:L27995 | **第三人称士兵**（骨骼蒙皮 + 程序动画 + 双骨 IK + 部位命中盒） |
| `_r`/`uc`/`Fa` | B:L28166/28317/28541 | Actor 基类 / 玩家 / **AI Bot** |
| `fc` | B:L28714 | 触摸控制（虚拟摇杆） |
| `pc` | B:L28832 | **游戏主控**（对局流/弹道/伤害/计分/主循环） |

### 1.2 启动与加载（B:L28839–28845）

`init()` 为 async，每步 `await Zn()`（`Zn = () => new Promise(r => requestAnimationFrame(r))`，B:L28826）让出主线程刷新进度条，进度文案即 B:L24611 的「初始化渲染器 → 生成集装箱/甲板/船体纹理 → 搭建运输船 → 天空与海洋 → 计算寻路网格 → 武器图标/预编译着色器 → 完成」：

```js
// B:L28840（节选）
this.renderer = new Zl(document.getElementById("c"), this.opts.quality), ...
this.T = Rf(this.opts.quality),                       // 全套程序化纹理
this.world = new gr, this.map = If(this.renderer.scene, this.T, this.world),
this.env = new Jl(...), this.env.apply(this.opts.tod),
this.nav = new Ql(this.world, -36.2, -12.1, 36.2, 12.1, .5, .42),   // 寻路网格仅覆盖可玩甲板
...
try { this.renderer.renderer.compile(this.renderer.scene, this.renderer.camera) } catch {}
```

要点：
- `renderer.compile()` 在加载期预编译着色器，避免开局掉帧（B:L28842）。
- URL 参数即调试接口：`?q=quality`（画质）、`?autostart`、`?nolock`（不锁鼠标）、`?touch`（强制触摸），并暴露 `window.__game`（B:L28844–28845）。
- 帧循环 `loop()`（B:L29275）为可变步长 rAF，dt 钳制 0.1s；主菜单时相机绕船环绕拍摄（B:L29283–29284）。
- 提供 `fastForward(seconds, step=1/30)` 无头快进接口（B:L29288–29295），返回 `{score, time, kills}` ——**这是自动化验收测试的现成钩子**。

---

## 2. 渲染管线（双场景 + 五 Pass 后处理）

### 2.1 渲染器封装 `Zl`（B:L20106–20133）

```js
// B:L20108–20120（节选，保留原始参数）
let i = this.renderer = new Gl({          // Gl = THREE.WebGLRenderer
    canvas: t, antialias: !1, powerPreference: "high-performance", stencil: !1
});
i.setPixelRatio(Math.min(window.devicePixelRatio, e === "high" ? 1.5 : e === "medium" ? 1.15 : 1));
i.toneMapping = ds;                       // ACESFilmicToneMapping
i.toneMappingExposure = .75;
i.outputColorSpace = Re;                  // SRGBColorSpace
i.shadowMap.enabled = !0; i.shadowMap.type = Ko;   // PCFSoftShadowMap
this.scene = new sn; this.camera = new je(78, 16 / 9, .05, 6e4);   // 世界 fov78 far=60km
this.vmScene = new sn; this.vmCamera = new je(58, 16 / 9, .01, 50); // 枪模独立场景 fov58
```

**双场景架构是核心决策**：武器视图模型放在独立 `vmScene`/`vmCamera`（fov 58），与世界（fov 78）分开渲染，从而：
1. 枪模不被世界 FOV 拉伸变形；
2. 枪模永远不会被墙体裁剪（穿模）；
3. 枪模有独立灯光（`rc` 里自带 sun/hemi/枪口点光，B:L23828）。

### 2.2 EffectComposer 五 Pass（B:L20120–20126）

```js
this.composer = new Yl(i, s);                       // s = WebGLRenderTarget(samples: 画质低0 / 其余4)
this.worldPass = new Pa(this.scene, this.camera);
this.vmPass = new Pa(this.vmScene, this.vmCamera);
this.vmPass.clear = !1; this.vmPass.clearDepth = !0; // 枪模叠加在世界之上
this.composer.addPass(this.worldPass); this.composer.addPass(this.vmPass);
e !== "low" && (this.bloom = new pr(new ct(n.x / 2, n.y / 2), .14, .35, 3.2), ...); // 半分辨率 UnrealBloom
this.fx = new fr(Tv);  this.composer.addPass(this.fx);     // 自研胶片后处理
this.composer.addPass(new $l);                              // OutputPass（色调映射+sRGB 输出）
```

自研胶片着色器 `Tv`（B:L20037–20110）的 uniforms 全部服务于游戏状态可视化（由 `pc.renderFrame` 每帧写入，B:L29354–29357）：

| uniform | 用途 | 写入处 |
| --- | --- | --- |
| `uTime` | 胶片颗粒闪烁 `col += (h(uv*1000+uTime)-.5)*.018`（注释「胶片颗粒」） | B:L29355 |
| `uDamage` | 受击红闪（`dmgFlash` 按伤害衰减 `t*1.6`） | B:L29355 |
| `uLowHP` | 低血 (35-hp)/35 屏幕效果 | B:L29356 |
| `uDeath` | 阵亡灰度 `min(1, deadT*2)` | B:L29356 |
| `uProtect` | 出生保护描边 `min(1, protectT)` | B:L29357 |
| `uVignette` | 非开镜时 0.30 暗角 | B:L29357 |

### 2.3 环境：天空 / 云 / 海洋（全程序化 GLSL，源码内保留中文注释）

- **天空**：`mr` 直接内联 Preetham 大气散射 Sky shader（B:L21914–22300），`scale 4e4`。
- **云层** `$v`：一块 y=1800 的大平面（`frustumCulled=!1, renderOrder=-2`），片元用 `fbm6` 生成云盖，随 `uTime` 与 `uShip`（船行进距离）流动，远处淡出融入雾色（B:L22471–22498）。
- **海洋** `Yv`（B:L22279）是整文件最讲究的一段：
  - 网格：110 环 × 160 段的圆盘，半径按 `6*1.058^c-5` **指数扩张**（近处细、远处粗，直铺到地平线）；
  - 顶点着色器做多波叠加位移，并用**船体包围盒压浪**防止穿模——源码注释原话「船体附近压低波浪，避免穿过甲板」：

    ```glsl
    // B:L22363–22366
    float hullD = max(abs(p.z)-12.5, 0.0) + max(-66.0-p.x, 0.0) + max(p.x-80.0, 0.0);
    float calm = smoothstep(0.0, 18.0, hullD) * 0.75 + 0.25;
    disp *= calm;
    ```
  - 片元着色器：法线扰动ripple（`smoothstep(400,30,dist)` 距离衰减）、Schlick 菲涅尔、天空反射（反射向量再采样 fbm 云）、双层太阳高光（pow 900 ×60 + pow 60 ×0.6）、次表面散射 `sss`、以及「泡沫：船体边缘、船头破浪、尾迹」（B:L22413–22440）。
- **船在开船**：`Jl.update` 中 `this.shipDist += t * this.shipSpeed(6.5)`（B:L22544），`uShip` 驱动云/海反向流动 + 烟囱烟雾向后飘（`vx: -n*.9`，B:L23391），营造航行感而船体静止（碰撞简单）。

### 2.4 光照与阴影

```js
// B:L22502–22504
this.sun = new hs(16777215, 3); this.sun.castShadow = !0;
let n = i === "low" ? 1024 : i === "medium" ? 2048 : 4096;
this.sun.shadow.mapSize.set(n, n); this.sun.shadow.bias = -4e-4; this.sun.shadow.normalBias = .035;
```
阴影相机**紧贴船体**（八个角点 `[-58,40]×[-15,15]` 包围盒计算正交范围，B:L22517–22522），整船一张 shadow map 零级联。场景附加 `HemisphereLight` + `FogExp2`（密度来自昼夜预设 `$h`，含 day/dusk 两档，B:L24638/24657）。环境贴图用 PMREMGenerator 从「临时天空+海面圆盘」小场景烘出，并同时挂到 vmScene（B:L22528–22541）。

### 2.5 运行时烘焙 AO（伪 lightmap，`Wv` B:L21816–21831）

全船静态几何烘焙后，把每个碰撞体足印画到 2048×692 canvas（两次 `shadowBlur` 模糊 40/12 + 手工补集装箱底部长条阴影），生成 `CanvasTexture` 设为甲板材质的 `aoMap`（`channel = 1`，即 `uv1` 通道）：

```js
// B:L21829–21830 与 L21786
let l = new ii(i); l.channel = 1; l.wrapS = l.wrapT = gi /*RepeatWrapping*/;
a.deck.mat.aoMap = vt; a.deck.mat.aoMapIntensity = 1;
```
`uv1` 在甲板几何上被归一化到甲板平面坐标（B:L21453–21459），等于用碰撞数据免费伪造了一张 bake 光照图。

### 2.6 动态光探针（B:L29359–29368）

每 6 帧从玩家眼位打两条 "sight" 射线：一条射向太阳方向（80m 内被挡 → 室外系数 0.22），一条垂直向上（5m 内有天花板 → 室内系数 1）；结果以 0.35 系数插值为 `lightK/indoorK`，用于调低枪模直射光/环境强度（B:L29344）。用 2 条射线模拟「室内外光照过渡」，成本近乎为零。

---

## 3. 物理、碰撞与玩法逻辑

### 3.1 世界碰撞：旋转 OBB + 均匀网格哈希（`jl`/`gr` B:L22551–22780）

- 碰撞体全部是**带 yaw 的盒体** `jl`：`solid / bullet("block"|"pen"|"pass") / sight / surface(脚步与弹孔音) / tag` 五个语义位（B:L22553–22556）。`bullet:"pass"` 用于栏杆/铁丝网（人不能过、子弹能过），`sight:!1` 用于不挡 AI 视线的矮遮挡。
- 空间划分：4m 均匀网格，key = `ix*1000+iz` 的 Map，查询用**时间戳去重**（`stamp` 字段，B:L22591–22605），零 GC 压力。
- 射线：`rayOBB` 标准 slab 法，返回 `t / exit / 法线`；**`raycastAll` 返回所有进出点对**——这是穿墙弹道的基础（B:L22676–22691）。
- 移动：`world.move`（B:L22729–22779）是完整角色控制器：
  - 按每步 ≤0.12m 细分位移，逐步 XZ 推进 + **3 次迭代去穿透**（`circleOBB` 圆 vs 旋转盒，输出推出法线与深度）；
  - `stepHeight(.42m)` 自动上台阶：先试抬到 collider 顶面并检查新位置不卡（`blocked`）；
  - `support()` 向下查询落地面（允许站在集装箱顶），落地时记录 `landed/landSpeed` 供坠落伤害与落地音；
  - 上升段处理顶头（`g.bottom` 碰撞）。
- 人物常数（B:L28159–28165）：身高 1.8 / 蹲高 1.15 / 站眼高 1.62 / 蹲眼高 1.05 / 重力 19 / 起跳 6.6 / 跑速 5.7 m/s；蹲下/起身前用 `world.blocked` 检查头顶（B:L28204–28209）。
- Actor 间还有软推挤分离（B:L28243–28256）与 AI 的额外避让（B:L28690–28699）。

### 3.2 寻路网格 `Ql`（B:L22781–22934）

- 网格仅覆盖可玩甲板 `(-36.2,-12.1)–(36.2,12.1)`，格 0.5m，agent 半径 0.42m；
- 标记阻挡：格心圆测试（半径 0.42，命中高 0.36–1.7 的 solid）→ `block=1`；**贴墙格（0.42+0.45 命中）`cost=1.6`**，让路径自然离开墙面；再补一遍全身胶囊 `blocked` 检查（B:L22785–22807）；
- A\*：手写二叉堆 + 八方向 + octile 启发 + **禁止切角**（对角移动要求两个直邻格均可走，B:L22907）；`seen/closed` 用 `Uint32Array + gen 代数戳`免清零；节点上限 20,000（B:L22891）；
- 找到后**串点拉直**：从起点贪心找最远可视点（`lineFree` 网格线检测，B:L22916–22923）；
- `randomFree` 供 AI 游走选点（60 次尝试，B:L22925）。

### 3.3 武器数据表 `mi`（B:L24063–24293）——AC 数值唯一来源的典范

7 把武器（ak47/m4a1/awm/mp5/deagle/knife/he）全参数表。两个代表：

```js
// B:L24064–24100 AK-47（节选）
{ id:"ak47", slot:0, type:"rifle", auto:!0, dmg:36, headMul:4, limbMul:.78,
  rpm:600, mag:30, reserve:90, reload:2.45, draw:.85, speed:.93, range:220,
  falloff:.985,              // 每 10m 距离衰减 1.5%
  pen:1.2, armorPen:.78,     // 穿透预算 / 护甲穿透
  spread:{ base:.0028, move:.045, air:.16, crouch:.6, perShot:.0055, max:.05, recover:7 },
  recoil:{ up:.0105, upMax:.11, side:.0062, sideStart:5, recover:6.5 } }
// B:L24140–24179 AWM：dmg 118, rpm 41, bolt:1.35(栓动), zoom:[30,11](两段镜),
//   scoped 散布 4e-4（腰射 base .06），pen 2.6，armorPen .95
// B:L24257–24292 军刀 dmgLight 52 / dmgHeavy 100，手雷 dmg 115 / radius 7.5 / fuse 2.6
```

武器实例 `_s`（B:L24295）只维护 `mag/reserve/nextFire/reloadUntil/shotsFired/spreadAcc/boltUntil`，纯状态无逻辑。

### 3.4 散布与后坐力（`Ff`/`Bf`/`Of` B:L24316–24353）

```js
// B:L24316–24323 散布 = 基础 + 移动(按速度插值) + 滞空 + 连射积累，蹲 ×0.6，封顶
let i = e.base;
r.def.type === "sniper" && (i = t.scoped && t.scopeReady ? e.scoped : e.base);
i += e.move * Math.min(1, Math.max(0, (n - .6) / 5.5));
t.onGround || (i += e.air); i += r.spreadAcc;
t.crouch && t.onGround && (i *= e.crouch);
return Math.min(i, e.max + e.base + (t.onGround ? 0 : e.air));
```
```js
// B:L24325–24335 后坐力 = 前 3 发 ×1.25 垂直 + sideStart 发后进入水平摆动（sin 弹道 + 随机）
let n = e.up * (i < 3 ? 1.25 : 1) * (.85 + t() * .3);
if (i >= e.sideStart) s = e.side * (Math.sin(i * .55 + (r.patternSeed || 0)) * 1.3 + (t() - .5) * .9);
```
每把枪的 `patternSeed`（0–6 随机相位）让同型号不同实例的弹道略有差异；`Of` 在切平面上做 sqrt 均匀盘采样得到圆锥散布（B:L24337–24353）。后坐力恢复用 `punchP *= exp(-recover*dt)`，视角实际加上 `punchP*.75`（B:L28445），即镜头踢枪 75% 反映到视角、100% 反映到弹道——与 CF 手感一致。

### 3.5 弹道与穿墙（`traceBullet` B:L29055–29097）

```js
let a = this.world.raycastAll(e.x, e.y, e.z, i.x, i.y, i.z, s),  // 全部 OBB 进出点
    o = n.pen,        // 剩余穿透预算
    l = 1, c = !1;    // 伤害乘子 / 是否穿墙击杀
for (let u = 0; u <= a.length; u++) {
  /* 先在该 OBB 入口前的区间内找最近的角色命中（soldier.hitTest），
     命中 → 伤害 = dmg * l * falloff^(t/10) * 部位倍率，return */
  if (d.collider.bullet === "pen") {           // 可穿材质（木板×1 / 金属×1.9 厚度惩罚）
    let w = (d.exit - d.t) * (S === "wood" ? 1 : 1.9);
    if (o > w) { o -= w; l *= .6; c = !0; h = d.exit; continue; }  // 穿过去，伤害 ×0.6
  }
  ... // 不可穿或预算耗尽 → 命中该面结束
}
```
穿墙击杀在 HUD 上显示「WALLBANG · 穿墙击杀」（B:L29219）。子弹出膛点对玩家与 AI 不同：玩家从**相机右侧偏移的虚拟枪口**（+右 0.14 / 下 0.1）避免第一人称遮挡，AI 从枪模 `muzzleWorld` 锚点（B:L29035–29040）。

### 3.6 命中盒与近战/手雷

- **部位命中**（`hc.hitTest` B:L28108–28148）：每个角色一份部位 OBB 表 `lc`（骨骼名+局部偏移+半尺寸+部位名 head/chest/arm/leg），先做投影半径²≤1.6 的球预筛，再缓存当帧的各骨骼逆矩阵（`invFrame` 代数戳），对每部位做骨局部空间的 slab 测试，返回 `{t, part}`。爆头 ×`headMul`、四肢 ×`limbMul`。
- **军刀**（`pc.melee` B:L29098–29141）：**5 条射线扇形**（±12°、±24°）逐条测命中；伤害延迟到 0.1s（轻）/0.33s（重）后结算（timers 队列）；**背刺**判定＝受击者朝向与攻击方向点积>0.5 → 轻 ×1.6 / 重 ×2；爆头再 ×1.3。
- **手雷**（`throwGrenade`/`updateNades` B:L29142–29181）：初速 `16 + 上抛2.8 + 携带者速度×0.6`；物理 3 子步进，重力 14，`world.raycast(...,"move")` 碰撞，反弹 `vel += n*(-1.45*vel·n)` 后整体 ×0.55 阻尼，低速落定；引信 2.6s 后 `explode`。
- **爆炸**（B:L29182–29200）：范围 7.5m，伤害 `(1-d/r)^1.1`；对每个受击者做**视线检测**，被墙挡住只吃 20% 伤害；同队（含自己掷出者）免伤；相机震动按距离 `max(0, 1.4 - d/18)`。

### 3.7 伤害、护甲与对局流（B:L29201–29241）

- 护甲：`hp 伤害 = raw * armorPen`（腿不耗甲），甲消耗 `raw * (1-armorPen) * 1.4`；
- 出生保护 3s（`_r.spawn` B:L28198），任何开火立即解除（`protectT = 0`，B:L28310）；保护期内 AI 模型以 30Hz 闪烁半透明（B:L29319）；
- 击杀：respawn 4s；连杀窗口 5s 内 multi+1 → 「DOUBLE KILL…GODLIKE / 双杀…超神」（B:L28827–28828, 29216–29219）；先到目标击杀（30/50/100）或 600s 时长结束；MVP 排序键 `k*2 - d + hs`（B:L24515）；
- 玩家死亡有**死亡镜头**：相机拉到尸体侧后方并看向击杀者头部（`p.look.lerp(p.killer.soldier.headWorld(...))`，B:L28424–28431）。
- 出生点选择（`spawnActor` B:L28948–28961）：按「离敌人越远加分 − 已被队友占用重罚」打分挑选 10 个出生位。

### 3.8 AI 对战系统（`Fa` B:L28541–28713）

**难度即参数表**（`Yf` B:L28470–28523，easy→hell）：

| 参数 | easy | normal | hard | hell | 含义 |
| --- | --- | --- | --- | --- | --- |
| react | .55–.90s | .38–.62 | .20–.34 | .12–.20 | 看见敌人到可开火的反应时间区间 |
| aimErr | .075 | .058 | .032 | .02 | 瞄准误差角（rad），且随距离放大 `.8 + d/28` |
| turn / track | 3.2 / 2.2 | 5.2 / 3.2 | 8.5 / 5.5 | 13 / 8.5 | 转身速度 / 误差衰减速率 |
| headP | .07 | .12 | .30 | .50 | 瞄头概率（否则瞄胸） |
| ctrl / comp | 1 / .55 | .85 / .8 | .6 / .9 | .42 / .95 | 后坐力接受比例 / 压枪补偿 |
| see / fov | 50 / 1.6 | 62 / 1.85 | 75 / 2.05 | 95 / 2.3 | 视距 / 视场角 |
| bunny | 0 | .05 | .12 | .2 | 连跳（bhop）概率 |

**职责分工**（`onSpawn` B:L28545–28549）：持 AWM → `hold`（5 个固定狙位 `$f` B:L28525）；25% → `flank`（走侧翼 3 段路径，对应运输船两侧集装箱管道/二楼）；其余 `rush`（3 条中路 lane `Ty=[-6.8,-.4,6.8]`）。所有坐标乘 `side = ±1` ——**地图与 AI 战术点都是点对称的**，与 CF 运输船一致。

**感知**（`canSee` B:L28582–28596）：距离 ≤`see`，视野角（6m 内忽略），对头/胸两个世界坐标各打一条 "sight" 射线，任一可见即可见。
**听觉**：`hear(pos, loud)`——枪声 45m、脚步 12m（非静步）、手雷落点 20m、爆炸 40m（B:L29042/29241/29157/29199）；AI 3 秒内 50% 概率走向声源。

**决策节流**：`think()` 每 0.13–0.19s 跑一次（B:L28637），内容：
- 选最近可见敌人；首见/换目标时掷反应时间（1.5s 内见过同目标则 ×0.4 更快）、误差向量、瞄头判定、burst 清零；
- 丢失目标 5s 后清除；`lastSeen` 5s 内 → 走向最后位置（hunting）；听到声音 → 查证；
- 弹匣 <50% 且脱战 1.2s → 换弹；雷冷却 20–45s，目标在 7–24m 且 35% 概率 → 制定扔雷计划；
- **卡位检测**：每 1s 对比位移，跟随路径却 <0.35m → 跳一下，连续 2 次 → 重新选目标点（B:L28628–28631）。

**战斗执行**（`update` B:L28657–28679）：瞄向 = 目标胸/头 + **速度预瞄 0.08s** + 每个 AI 独有的正弦抖动（`sin(t*3.1+id)`）+ 误差衰减；转向速度受 `turn` 钳制；压枪 = `- punchP * comp`；开火条件 = 反应时间已过 && 瞄准角 < `atan2(.32, dist)*1.4` && 弹匣有弹；远距离（>14m）连发 3–8 发后强制停火 0.18–0.3s（burst 节流，停火时长随距离放大）；AWM 开镜后只在角度更小（×0.6）时开火；随机蹲下侧移、随机 bhop。

### 3.9 玩家输入与相机（`uc` B:L28317–28469）

- 输入统一进 `keys/mouse/touch` 三个通道后归一到 `move(t, dx, dz, jump, crouch, walk)` + `weaponUpdate(t, intent)`，**触摸与键鼠最终走完全相同的 Intent**（B:L28390 `l += this.touch.mz`）；
- 灵敏度：`sens * .0022`，开镜时按 `fov 比例` 缩放（B:L28385–28387）——开镜灵敏度不突变的关键；
- 视角抖动上限 `|movementX|>400` 丢弃（防指针锁跳变，B:L28366）；`requestPointerLock({unadjustedMovement:!0})` 失败自动降级（B:L28970–28982）；
- 相机：走跑 bob（`sin/abs(cos)`）、落地下沉（`landSpeed*.012` 上限 .14）、侧键roll（A/D ±0.008）、爆炸震动、受击 `aimPunch`；死亡镜头见 3.7。

### 3.10 状态边界与重开（对 AC②/③ 直接相关）

- `startMatch()`（B:L28891–28928）**全量重建**：移除全部 soldier/tag/nade、清空 `actors/nades/tags/timers`、score 归零、`timeLeft=600`、重新 apply 昼夜 → 数值复位无残留；
- Esc/失焦自动暂停（pointerlockchange → pause，B:L28984–28986）；`quitToMenu` 退锁、清场、隐藏枪模（B:L28993–28998）；
- 换武器面板 `B 键`：存活且在本方出生区（|x|>28.3）立即生效，否则「复活后使用」（B:L29013–29016）；
- 连点保护：`consumePressed` 单帧消费（B:L28374）、`n.repeat` 丢弃、手雷为 0 时切枪 toast 拦截（B:L28407）、`pendingThrow` 0.52s 投掷锁（B:L29280–29292）。

---

## 4. 程序化资产（0 张图片、0 个模型、0 个音频文件）

全文件唯一的网络请求就是这个 HTML 本身。资产栈自底向上：

### 4.1 随机与噪声底座（B:L20139–20190）

```js
// B:L20139–20144 mulberry32 种子 PRNG（地图种子 2024，B:L21057）
function ci(r) { return function() { r |= 0; r = r + 1831565813 | 0;   // 0x6D2B79F5
    let t = Math.imul(r ^ r >>> 15, 1 | r);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296; } }
```
`De(w,h,格宽,格高,倍频,种子)`：value noise 多倍频 fBm，smoothstep 插值（`_ *_*(3-2*_)`），输出 Float32 高度场；`Zi(高度场)` 转法线贴图；`pe(canvas,{srgb})` 包 CanvasTexture（法线用线性空间，B:L20925–20929）。

### 4.2 纹理清单（`Rf` B:L20920–20985）

| 类别 | 内容与证据 |
| --- | --- |
| 甲板 `Av()` | 防滑花纹钢板 + 焊缝 + 锈斑 |
| 集装箱 | 6 种配色 ×{20ft 侧板 1024、40ft 侧板 2048、门、波纹顶}（B:L20936–20952），顶面带条形码感竖条纹 `Ef(c,1024,448,22,...)` |
| 木箱/弹药箱 | 木箱 ×4（种子 500–503）+ 金属弹药箱 ×2（1024²，画「AMMO 7.62 / CARTRIDGES / EXPLOSIVE / CF ARMORY + LOT xxxx + 划痕」B:L20560–20605） |
| 船体 `Dv()` | 1024²，按高度三段配色：`y<-7.3` 红褐水线下 / 上部深灰 / 甲板线（B:L20607 起） |
| 钢材系 | bulkhead/darkSteel/yellowSteel/redSteel/greenSteel（同函数 `La` 不同参数：加筋、锈蚀比例） |
| 特效贴图 | 弹孔（金属/木）、焦痕、血渍、枪口焰 ×3、侧焰、烟团、辉光、火花——全部小 canvas |
| 标牌图集 `Gv()` | 一张 1024² 图集集中画：易碎物品 / 禁止烟火 / 危险 / 高压·禁止攀爬 / 集合点 / 消防栓 / 船名 / 阵营牌 / 箭头（`bn.*` 索引 UV，B:L21519–21528 处按像素矩形取样 `E(...,bn.hazard)`） |

文本用 `gs(ctx,text,x,y,font,fill,seedRng,jitter)` 统一绘制（带随机抖动的做旧效果）。

### 4.3 几何：批处理 + 放样船体

- **`Yh` 批处理构建器**（B:L21024–21054）：`quad()`（盒面）与 `geom()`（预置几何 × 矩阵烘入）把顶点/法线/UV/索引累进扁平数组，`build()` 产出 BufferGeometry（>65535 顶点自动换 Uint32 索引）。地图构建器 `If` 按「材质 → Yh」注册表（`u(name, mat, uvScale)`，B:L21065）分配，**整艘船最终只有十几个静态 Mesh**（每种材质一个），且 `matrixAutoUpdate=false`（B:L21779）。
- 盒体写入器 `x(...)` 支持**逐面材质**（`{px,nx,py,ny,pz,nz}`）与世界空间 UV 缩放（B:L21260–21292）——集装箱门/顶/侧不同贴图靠它。
- 碰撞与几何同步声明：`D()/z()`（集装箱/木箱）在烘几何的同时 `m()` 压入 AABB/OBB 碰撞体与 `g()` 压入烘焙阴影足印（B:L21356–21385）。
- **真实世界尺度**：`me=2.59, wn=2.44, Kl=6.06, Di=12.19`（ISO 集装箱 高/宽/20ft/40ft，B:L20986–20990）。
- **船体放样** `qv`（B:L21854–21913）：7 层横截面（y 从 .12 到 −12，各层缩放与船头收窄系数），每层 120 段参数曲线 `Lf(t, s, bow)`（B:L21833：直舷 + `sin(l)**.8` 船头弧 + 船尾圆弧），UV 用**弧长/16 与 (y+12)/13.5** 直接对上船体贴图的水线分区。
- **场景生命感**：烟囱顶冒烟（0.14s 一缕，B:L23383–23405）、6 只程序化海鸥绕飞扑翅（B:L23314–23354）、船尾吊车吊着的集装箱三轴摇摆（`sin(U*.55)*.018` 等，B:L21770–21772）、雷达 1.6rad/s 旋转（B:L21723–21725）。

### 4.4 程序化枪械与角色

- **枪械库 `Jv`**（B:L23673–23739）：7 把枪全部用 `ve()`（圆角盒）/`we()`（盒）/`We/Kh/Jh`（三种轴向圆柱）拼装，每把 15–25 个零件；弹匣 `jh` 沿弧线排子弹（`f += c` 弯弹匣，AK 的标志，B:L23661–23672）；命名锚点空物体 `grip/fore/muzzle/eject/magwell/scope/bolt` 供动画与出膛点引用。
- **合并缓存 `Na(name)`**（B:L23750–23786）：把枪模按材质 `mergeGeometries` 成多材质单 Mesh（带 groups），锚点转存 `userData.anchors`——第三人称枪 1 个对象、视觉与第一人称共用。
- **共享材质库 `tu()`**（B:L23568–23638）：12 种材质共享同一张 256² 程序化粗糙度图（种子 4242）+ fBm 法线，材质间只差颜色参数 → 显存与编译成本极低。
- **士兵 `hc`**（B:L27995–28158）：程序化蒙皮网格（顶点色队服贴图 `py()`），骨架表 `cc`（hips/spine/chest/neck/head/upperArm*/forearm*/thigh*/shin*/foot*）；**程序动画**：行走相位驱动大腿/小腿/脚（含 crouch 混合、空中姿态、腰部起伏 B:L28045–28066），pitch 驱动脊柱前倾；**双骨解析 IK** `solveArm`（余弦定理 + 肘部极向量，B:L28016–28038）把手放到枪的 grip/fore 锚点；**死亡动画**：按子弹方向倒地 + 随机四肢松弛 + 4.5s 后沉没淡出（B:L28088–28103）。
- **武器图标零美术**：`makeIcons()`（B:L28852–28890）用正交相机 + `overrideMaterial=白色 MeshBasicMaterial` 把每把枪渲到 256×96 RenderTarget，`readRenderTargetPixels` 取 alpha 通道生成 dataURL 给 HUD——图标即模型剪影，永不失配。

### 4.5 全合成音频（`nu` B:L25010–27994，约 3000 行）

- 结构：4 条总线（`_ambBus/_voiceBus/_sfx/_world`）+ master，`latencyHint:"interactive"`，**48 voice 上限**（`ay=48` B:L24673），支持注入 OfflineAudioContext（测试可离线渲染）。
- 枪声 = 每把枪一层参数配方 `kf`（B:L24681 起）+ 模块化合成器：`_nz`（白/粉/棕噪声 + 滤波链，含 lowpass 扫频）、`_tn`（扫频振荡）、`_drive`（waveshaper 削波失真）、`_voice`（PannerNode 空间化 + 距离滚降 + 混响湿量）。AK-47 配方：`crack(高通 2200Hz 0.0025s) + body(4200→650Hz 扫频 0.16s) + mid(1kHz 带通) + punch(150→42Hz 低频冲击) + tail(900Hz 0.55s 余响) + mech(延迟 45ms 机械声) + echo[[.16,.12]]`（B:L24682–24723）。消音版走另一条更短更闷的分支（B:L25158–25186）。
- 其余音效同样全合成：脚步（按 surface 材质变体）、弹壳落地、跳弹、**弹道掠过头皮 whiz-by**（子弹线到玩家眼距 <1.3m 触发，B:L29046–29052）、受伤闷哼、低血心跳（`setLowHealth` + `_tick` 调度）、UI 点击、换弹四段（magout/magin/boltback/boltforward 按换弹时间线 20%/60%/82%/88% 排程，B:L29251–29263）。
- **英语军事播报**：`speechSynthesis`，按「男声加分/女声减分/en-US+本地服务加分」给系统语音打分挑选（`_pickVoice` B:L27471–27496），播报 "Go go go!" / "Headshot!" / "Fire in the hole!" / "Mission accomplished/failed" / "Double kill!"（B:L29219/29156/28927/29027）。
- 环境音：预渲染噪声 buffer 库（`_bank`）循环 + StereoPanner + LFO 调制出海浪/风（`startAmbient` B:L26731），`stopAmbient` 1.5s 淡出防爆音。

---

## 5. HUD 架构（DOM 直写 + 单 Canvas 雷达）

### 5.1 结构与渲染策略

模板 `ry`（B:L24582–24671）一次性 `innerHTML` 注入 `#ui`，所有带 id 的元素收进 `this.el` 索引（B:L24366–24367）。渲染策略按频率分级：
- **每帧直写**（`update` B:L24441–24467）：分数/时间/血甲/弹药 `textContent`，准星四线 `style.top/left`，hitmarker/伤害方向透明度与旋转——只改文本与 transform，不触发重排风暴；
- **低频重建**：武器槽（`slots`，2.2s 超时淡出）、Tab 计分板（按住时每 20 帧刷新，B:L29413–29414）、结算表，直接 `innerHTML` 拼表；
- **入场动画**全走 CSS class（`kfIn` 关键帧、`badge.show`，配 CSS 源 H:44–47 等）。

### 5.2 关键部件

- **动态准星**：4 条短线（`cT/cB/cL/cR`），散布角→像素换算在游戏侧完成：`spreadPx = tan(spread)/tan(fov/2) * innerHeight/2`（B:L29374–29377），HUD 只做 `4 + spreadPx` 偏移（B:L24454–24457）；狙击开镜时隐藏十字、显示纯 CSS 狙击镜 overlay（圆环+十字线+测距刻度，模板 B:L24601）。
- **雷达**（B:L24524–24560）：`buildRadar` 开局把世界碰撞体预渲染成 592×208 离屏 canvas（按 collider 高度分 4 档灰阶、`bullet:"pass"` 跳过、铁丝网半透明、集装箱区虚线描边）；每帧 `drawRadar` 只做 画布旋转（玩家 yaw）+ 平移 + 贴上底图 + 画点——**敌点只在 `radarT>0`（开火/枪声标记后 1.6s 内）显示**（`t.radarT = 1.6` B:L29041，`radarT` 衰减 B:L29307）。
- **击杀反馈组**：killFeed（7s TTL / 最多 6 条，武器图标 + 爆头/穿墙小图标 SVG）、六边形击杀徽章（爆头红色/普通金色 + 语音）、hitmarker（普通 .22s / 爆头 .45s）、**受击方向指示** `damageFrom(角度)` → 元素 `rotate(ang - yaw)` 1.4s 淡出（B:L24489–24495）。
- **屏幕状态机**：`show(t)` 五屏互斥（menu/pause/end/loadout/loading）+ HUD 显隐（B:L24433–24437），所有设置项 `data-k/data-v` 声明式绑定 + `localStorage("cf_ship_opts")` 持久化（B:L24382–24390）；画质切换直接 `location.reload()`（B:L29020）。
- **队友名牌**：canvas 画昵称 → Sprite（`depthTest:!1, renderOrder:20`），45m 内显示（B:L28929–28947, 29322–29325）。
- **FPS 显示与降档提示**：雷达角落 `运输船 · N FPS`（1s 统计，B:L29346–29349），持续 <32FPS 弹一次性提示建议调画质。

### 5.3 移动端（`fc` B:L28714–28825）

`pointer:coarse` 或 `?touch` 启用：左侧 40% 屏首触点＝虚拟摇杆（60px 行程归一），其余触点＝滑动视角（增量 ×1.6）；右侧按钮：开火（大）+ 第二开火位 + 跳/蹲/R/切/镜。触摸量并入玩家 `touch` 字段，与键鼠走同一 Intent（3.9），行为一致；移动端默认画质 low、雷达低清、点光关闭。

---

## 6. 性能工程汇总（复刻时必须保留的清单）

1. **Draw call 压制**：静态几何按材质批处理（`Yh`）→ 全船 <20 个静态 mesh；贴花 InstancedMesh（弹孔 160/木 100/血 60/焦 12 环形缓冲）；粒子单 `THREE.Points` 自定义 shader（两池各 900，环形覆盖淘汰 `p[rand*max|0]=t`，B:L22961）；枪口焰 Sprite 池 ×12、动态点光池 ×3（0.06s 脉冲）、弹壳池 ×14、曳光 InstancedMesh ×48。
2. **零网络资产**：所有纹理 Canvas 程序化、音频 WebAudio 合成、图标离屏渲染——**首屏只有 1 个请求**。
3. **烘焙**：AO 足印烘成 aoMap(uv1)；着色器 `compile()` 预编译；雷达底图离屏预渲染。
4. **单光源阴影**：4096/2048/1024 三档、紧凑正交 frustum 包住船体；场景点光 ≤4；无级联。
5. **画质三档**：pixelRatio 1.5/1.15/1、MSAA 4/4/0、Bloom 有/有/无、shadow 4096/2048/1024、点光 4/4/0（B:L28847）。
6. **AI 预算**：think 0.13–0.19s 节流；A\* 2 万节点上限 + 代数戳数组复用；路径串点拉直减少跟随计算。
7. **音频预算**：48 voice 上限、100ms `_tick` 心跳调度、噪声 buffer 预渲染循环。
8. **帧率自适应提示**：1s 粒度 FPS 统计 + 一次性降档引导（不自动改画质，尊重用户设置）。

---

## 7. 对复刻工程的落地建议（映射到 `games/` 新工程）

### 7.1 建议模块划分（可编译、可测试）

```
games/<new>/
├── src/content/    # 武器表/AI难度表/地图布局/对局规则 —— 全部数值唯一来源（对照 mi/Yf/$h）
├── src/core/       # 纯 TS：OBB 世界 + 角色控制器 + 弹道/伤害/对局状态机 + AI（零 DOM/three，可 Node 单测）
├── src/render/     # Three.js：渲染器封装/批处理地图构建/程序化纹理/特效/士兵模型
├── src/audio/      # WebAudio 合成引擎（可先以少量采样音效降级替换，接口保持 playShot(pos) 语义）
├── src/ui/         # HUD（同频率分级策略）+ 触摸层
└── src/app/        # 装配根：加载分步 + rAF 循环 + fastForward 测试钩子
```

复刻关键点：原作把「仿真」与「表现」解耦得很干净——`world/npc 逻辑不依赖 three 的类`（只用自研 `jl/gr/Ql` 与普通数学），three 只在 render/模型层出现。**照搬这个分层，core 即可跑 Node 自动化断言（原作用 `fastForward` 达成同样目的）。**

### 7.2 可直接复用的公式/算法清单（均已在本报告给出代码证据）

| 主题 | 公式 | 证据 |
| --- | --- | --- |
| 散布 | base + move·min(1,(v−.6)/5.5) + air + 连射积累，蹲 ×c，封顶 | B:L24316 |
| 后坐力 | 前3发 ×1.25 垂直；`sideStart` 后 `sin(i*.55+seed)` 水平弹道 | B:L24325 |
| 距离衰减 | `dmg * falloff^(dist/10)` | B:L29078 |
| 穿透 | 消耗 `(exit−entry)×(木1/金属1.9)` 预算，每穿伤害 ×0.6 | B:L29086 |
| 手雷爆炸 | `(1−d/r)^1.1`，视线阻挡 ×0.2 | B:L29196–29197 |
| 准星像素 | `tan(spread)/tan(fov/2)×h/2` | B:L29376 |
| 粒子像素尺寸 | `innerHeight·dpr/(2·tan(fov/2))` | B:L23358 |
| 雷达旋转 | 画布 rotate(yaw) + translate(−世界坐标×比例) | B:L24546 |
| 出生点评分 | `rand×3 + min(敌距,40)×.1 − 占用×100` | B:L28953–28959 |
| MVP 排序 | `k×2 − d + hs` | B:L24515 |

### 7.3 风险与差异提示

- **原作为混淆产物**：类/变量名均为压缩名，本报告中的语义名（`Yh/If/oc/pc` 等）是逆向标注，复刻时应以本报告的职责定义为准，不要照抄名字。
- **音频全合成工程量大**（约 3000 行）：复刻可先实现 4 总线 + 每武器单层噪声近似，保留 `playShot(name, pos)` 接口后续加厚。
- **speechSynthesis 播报**在部分浏览器（尤其移动端）不可用/无声，复刻需准备无语音降级。
- **CSS 源**（H:9–199）可直接参考：队伍色 `--bl:#e0522e / --gr:#2f8ff0`、DIN 系数字字体栈、`clip-path` 斜切面板是 CF 风格的关键视觉语言。

---

## 附录 A：关键常数速查

| 组 | 值 | 证据 |
| --- | --- | --- |
| 相机 | 世界 fov 78 / 枪模 fov 58 / near .05 / far 6e4；狙击 zoom [30,11] | B:L20111, L24177 |
| 角色 | 高 1.8 / 蹲 1.15 / 眼 1.62 / 蹲眼 1.05 / 半径 .36 / stepHeight .42 | B:L28159, L28169 |
| 运动 | 跑 5.7 m/s（蹲 ×.42 / 静步 ×.5 / 开镜 ×.55）/ 重力 19 / 跳 6.6 / 跳 CD .35 | B:L28211, L28163 |
| 对局 | 10 分钟 / 目标击杀 30/50/100 / 重生 4s / 出生保护 3s / 连杀窗口 5s | B:L28902, L29214, L28184 |
| 地图 | 甲板 74×25m（x∈[−37,37], z∈[−12.5,12.5]）/ 寻路 0.5m 格 / 碰撞网格 4m | B:L21057, L22567 |
| 音频 | 48 voice / master 默认 .8 / 交互延迟 hints | B:L24673, L25030 |

## 附录 B：来源与作者信息

模板内含作者链接（B:L24590, L24648）：GitHub `riba2534/claude-opus-5-5-demo` 与 X `@riba2534`——即该游戏由 Claude（Opus 5.5 demo）生成并公开分享，可作为「LLM 单文件游戏工程能力」的参照样本。菜单中的背景故事（联合国维和 / 俄罗斯驶往尼日利亚货轮 / 潜伏者伏击保卫者）与按键说明见 B:L24619–24626。

*报告完 —— 分析基于 2026-09-23 抓取版本（861,782 字节）。*
