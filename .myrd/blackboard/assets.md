# assets.md — 资产清单（共享黑板）

> 更新时间：2026-09-23（程序节点复验批次 · 游戏程序）
> 负责人：主策划（资产增减须同步 spec.assets 段走版本链，禁止实现侧私加资产源）
> 下一步：实现侧按风格卡产出程序化资产；QA 互查核对「资产引用与 spec.assets 一致」

---

## 风格卡（全团队唯一视觉基准）

| 维度 | 规定 | 依据（复刻样本） |
|---|---|---|
| 视角/画幅 | FPS 第一人称，横屏优先，canvas 全屏 | 运输船 B:L20108（世界 fov 78 / 武器 fov 58 双场景） |
| 色调 | 冷灰金属舰体（#6b7480 系）+ 军绿集装箱（#5a6b4a/#7a6a4a）+ 暖橙警示件（#c9762e），ACESFilmic 色调映射、曝光 0.95（复刻样本基准 0.75，QA 互查 Q7 因逆光死黑上调，见 qa-crosscheck.md） | 运输船 3.1/3.3 渲染封装 + qa-crosscheck Q7 |
| 光照 | 单方向光（暖白，带 PCFSoft 阴影）+ 半球环境光（天蓝/舰灰），雾用海雾色 | 运输船 B:L23828 灯光层 |
| 材质 | 全部 MeshStandardMaterial，贴图一律 Canvas 程序化生成（金属拉丝/集装箱波纹/甲板防滑纹/迷彩），同参数走键值缓存工厂，全场景唯一实例 | 知识文档 §1 四件套之「缓存工厂」 |
| 几何 | 圆角盒拼装（舰桥/集装箱/枪模/人形），禁止外部模型 | 运输船 RoundedBoxGeometry 重实现为游戏类 `ic` |
| HUD | DOM 直写：DIN 数字字体栈、clip-path 斜切面板、青蓝描边 + 半透明黑底；小地图/雷达用独立 canvas 预渲染 | 运输船 HUD 层 |
| 禁止 | 任何 http(s) 外链资源、图片/音频/模型文件落盘；「生成更多」不是成果，过验收才算 | 知识文档 §1「全文件唯一网络请求是 HTML 本身」 |

---

## 资产清单（与 spec.assets 段一一对应）

| id | 品类 | 落点（相对工作区根） | 来源/生成器 | 用途 |
|---|---|---|---|---|
| a01-textures | image | `games/transport-ship-3d/src/render/textures.js` | generated · procedural:canvas2d | 甲板防滑纹/舰体金属/集装箱波纹×2 色/迷彩/海面 |
| a02-geometry | model | `games/transport-ship-3d/src/render/geometry.js` | generated · procedural:rounded-box | 圆角盒工厂 + 枪模/舰桥/集装箱/人形拼装 |
| a03-sfx | sfx | `games/transport-ship-3d/src/render/audio.js` | generated · procedural:webaudio | 射击/命中/爆头/换弹/受伤/波次开始/击杀 |
| a04-style-card | doc | `.myrd/blackboard/assets.md` | manual | 本风格卡（资产风格唯一基准） |

> 音频不落 .wav 文件（零外部资源红线）：WebAudio 运行时合成，落点即合成器模块本身。
