# 程序化资产管线（procedural-assets）

> 对标产物的硬结论：模型/贴图/音效 **零外部文件**，全部代码生成。这不是权宜之计，是路线本身：
> 无版权风险、无加载失败、无体积膨胀、agent 纯代码即可产出完整游戏、git 里全是可审的文本。

## 1. 模型：几何体拼装 + Extrude 拉伸

对标两局的几何用法（全在代码里）：Box/Cylinder/Sphere/Torus/Icosahedron 基础件 +
**ExtrudeGeometry 把 2D 轮廓拉成 3D** —— 船体、车型都是这一招：

```js
// 车体/船体：Shape 画侧面轮廓 → 沿宽度拉伸
const shape = new THREE.Shape();
shape.moveTo(0, 0); shape.lineTo(4, 0.3); shape.lineTo(3.6, 1.1); shape.lineTo(0.4, 1.0);
shape.closePath();
const hull = new THREE.ExtrudeGeometry(shape, { depth: 1.8, bevelEnabled: true, bevelSize: 0.08 });
hull.center();
```

拼装纪律：复杂物体 = 多个 mesh 组成 `THREE.Group`（一个逻辑对象），材质数量控制在个位数
（材质是 draw call 的根源）；圆角用 `bevelEnabled`，别用高分段球体硬凑。

## 2. 贴图：离屏 canvas 绘制 → CanvasTexture

```js
function gridTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 512;
  const g = c.getContext("2d");
  g.fillStyle = "#10151b"; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = "rgba(96,202,224,.25)"; g.lineWidth = 2;
  for (let i = 0; i <= 512; i += 64) {           // 网格线
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.moveTo(0, i); g.lineTo(512, i); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(8, 8);
  t.colorSpace = THREE.SRGBColorSpace;           // 别忘：否则贴图发白
  return t;
}
```

常用配方：网格地板、径向渐变（发光贴图喂 Bloom）、噪点（金属/磨损感）、简单几何徽标
（贴在船身/车身当阵营标识）。**配色收口到一张调色板**（CSS 变量 + 场景同源），全工程
不出现第二个色值来源。

## 3. 音效：WebAudio 合成（零音频文件）

```js
// 两音上行「收集」音：oscillator + gain 包络 + 总线压缩器
function blip(ctx, t0, f0, f1, dur = 0.12, vol = 0.25) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = "square";
  o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g).connect(bus); o.start(t0); o.stop(t0 + dur);
}
// bus = createGain() → createDynamicsCompressor() → destination（对标两局同款总线）
```

配方思路：**结果性事件各给一个可辨识的音**（收集=上行双音、受击=噪声脉冲、暂停=单音、
结算=下行三连音）；噪声用 `createBufferSource` 塞白噪声段 + 滤波。
**AudioContext 必须在首次用户手势里创建/resume**（E-07），headless 环境整个 no-op。

## 4. 物理：不引入物理引擎

对标两局都没有 cannon/rapier/ammo。自写运动模型的够用三件套：

1. **圆/圆 + 圆/AABB 碰撞**：中心距 < r1+r2 → 沿法线推出（内核纯函数，可无头断言）；
2. **速度/摩擦/转向**用帧率无关公式（`v *= Math.exp(-k * dt)`，不用 `v *= 0.95` 这种帧率耦合写法）；
3. **边界加固**：意图数值 `Number.isFinite` 过滤 + 范围钳制在内核入口做 —— 对抗注入的
   NaN/±1e9（transport-ship-3d 验收口径 C 的实战教训）。

真需要布娃娃/载具悬挂/复杂碰撞时再议 rapier —— 但默认先自写，别为原型引 2MB 物理库。

## 5. 与资产治理协议的衔接

程序化生成器是 webgame-prototype §7B assets 段的 `generator` 插件：

```json
{ "id": "tex-ground", "kind": "image", "file": "(inline)",
  "source": "generated", "generator": "procedural:src/render/textures.js", "license": "工程内生成" }
```

生成产物内联进单文件构建，无需落盘 asset 文件；若未来换成生图 API，协议不变、只换
generator 标识，且产物必须内联或随包分发（保持「单文件零外链」契约）。
