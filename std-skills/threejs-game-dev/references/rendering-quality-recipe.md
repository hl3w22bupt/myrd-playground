# 渲染质量配方（rendering-quality-recipe）

> 来源：对两个对标产物（CF 运输船复刻 three r186 / QQ飞车复刻 three r169）的全量逆向。
> 两局一致采用四件套 —— 这是「商业化画面下限」的固定配方，新工程照抄，不要自由发挥。

## 四件套与具体参数

### 1. 后期辉光：EffectComposer + UnrealBloomPass

```js
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(
  new THREE.Vector2(w, h),
  0.55,   // strength：0.4~0.8，霓虹感够用；>1 会糊成一片
  0.4,    // radius
  0.85,   // threshold：只让高光泛光，全屏泛光 = 廉价感
));
composer.addPass(new OutputPass()); // 链尾必须有：色调映射 + sRGB 输出都在这做
```

**坑（E-01）**：r155+ 起色彩管理重写 —— 走 composer 时 `renderer.outputColorSpace` 与
toneMapping 都由 OutputPass 执行，**链尾没有 OutputPass = 画面发灰发暗且怎么调都不对**。
每帧 `composer.render()` 替代 `renderer.render()`；resize 时两个都要 setSize。

### 2. 电影感色调映射

```js
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0; // 0.9~1.2 起步
```

对标两局都在 ACESFilmic —— 「高级感」与「demo 感」的分水岭就是它。
AgX/Neutral 可选（更中性），但同一工程内不要混。

### 3. 重布光（舞台感是布出来的，不是建模出来的）

对标产物引用了 30-44 个 SpotLight/PointLight。下限配置（模板已内置）：

```js
scene.fog = new THREE.FogExp2(bgColor, 0.02);          // 指数雾：吃掉远处廉价感 + 空间纵深
scene.add(new THREE.HemisphereLight(sky, ground, 0.5)); // 底光：防死黑
const key = new THREE.DirectionalLight(0xffffff, 1.2);  // 主光
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;       // 软阴影
// 点缀光 2-4 个彩色 PointLight/SpotLight：霓虹灯牌、舷窗、车灯 —— 画面记忆点全靠它们
```

技巧：点缀光不动模型、只动光 —— 一盏彩色点光扫过灰色几何体，画面立刻「贵」。

### 4. 分辨率与性能预算

```js
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // 上限 2，手机不烫
renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
```

- 抗锯齿开（开 MSAA 后可少依赖 FXAA pass）；
- 材质统一 MeshStandardMaterial（PBR 与灯光联动），纯发光件用 emissive 喂 Bloom；
- 移动端帧率下限见 browser-smoke 断言（headless ≥ 10fps，真机目标 30fps+）。

## 自检清单（交付前逐条过）

- [ ] 四件套全在（preflight P6 有 warning 级扫描）
- [ ] composer 链尾 OutputPass（否则发灰）
- [ ] bloom threshold ≥ 0.8（全屏泛光 = 重做）
- [ ] 阴影 mapSize ≥ 1024 且场景里真的有 castShadow/receiveShadow
- [ ] 雾色与背景色一致（穿帮最常见处）
- [ ] pixelRatio 有上限
- [ ] 同屏 draw call 粗查 < 200（`renderer.info.render.calls`）
