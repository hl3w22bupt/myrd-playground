# 资产清单黑板 — stack-tower（M2 首卡）

> 更新时间：2026-09-25（资产实体化：a01–a05 程序化生成器 + a06–a14 assets/ 实体贴图接线，门禁全绿）
> 负责人：主策划（整合人）· T3 美术线维护资产段，T4 程序线维护实现段
> 下一步：主人试玩后如对色板/构图给方向性意见 → 风格卡 30 分钟升 v1（落点不变）

## 顶部：风格卡（v0 摘要）
- 主题锚点：stack-tower（叠塔 · 落块），主题项零编造，全部派生自 T1 锚定的「叠塔/塔/切面」意象与 spec world 段文本
- 光照逻辑：单顶光（正午顶光 + 底部冷色反弹），塔层自上而下明度 −2%/层（下限 0.55，`LAYER_SHADE_STEP/LAYER_SHADE_MIN`），制造「越叠越高」的读数感
- 对比度策略：塔块高饱和（暖色系）vs 天空低饱和（冷灰蓝），HUD 白字 + 深色描边，切面高亮描边 1px
- 构图脚本模板：见 `games/stack-tower/docs/style-card-v0.md` §3（首屏构图脚本）；实体素材命名映射见同文 §6.1
- 资产重量预算：单卡总预算 <300KB，程序化优先（Canvas2D 生成贴图 + WebAudio 合成音效），零外部下载；实体化实测 9 件共 29.19KB
- 归档不投入：snake-ghost / merge-td 情绪板（T1 终裁落选卡，不再投入工时）

## 资产清单

| 资产 id | 类型 | 落点 | 生成方式 | 状态 | 核对 |
|---|---|---|---|---|---|
| a01-block-palette | 色板 | games/stack-tower/src/render/palette.ts | 程序化常量表（8 色，与情绪板 §二逐条同源） | **implemented** | renderer/palette 同源，无散落色值；assets/ 生成器解析本文件取值（私设色值即拒生成） |
| a02-block-face | 贴图 | games/stack-tower/src/render/textures.ts | procedural:canvas2d（三面明度 100:78:55 + 切面白描边，缓存复用） | **implemented（fallback 态）** | 无 document 时返回 null，渲染层降级纯色；tileset 就绪时切片优先 |
| a03-bg-sky | 背景层 | games/stack-tower/src/render/backdrop.ts | procedural:canvas2d（冷灰蓝渐变 + 3 道塔吊剪影 α0.18 + 暮色线） | **implemented** | 构图脚本 L0/L1 对号 |
| a04-sfx-place | 音效 | games/stack-tower/src/audio/sfx.ts | procedural:webaudio（120Hz 短闷响 90ms） | **implemented** | 无 AudioContext 环境静音不抛错 |
| a05-sfx-perfect | 音效 | games/stack-tower/src/audio/sfx.ts | procedural:webaudio（880/1320Hz 双音叮 180ms，一次性） | **implemented** | 与 tower-ripple 呼应、不随 duration 循环 |
| a06-e01-block-base | 贴图 | games/stack-tower/assets/sprites/e01-spawn-first-block.png | tools/gen-assets.mjs（120×28，塔基块三面光照） | **implemented（已接线）** | renderer.drawBlock 塔基块分支；缺图回 a02 程序化 |
| a07-e02-block-move | 贴图 | games/stack-tower/assets/sprites/e02-swing-motion.png | tools/gen-assets.mjs（120×28，提亮 + 下缘反弹光烘焙） | **implemented（已接线）** | renderer.drawBlock 摆块分支（反弹光随图烘焙）；缺图回程序化 + drawBounceLight |
| a08-e03-guide-line | 贴图 | games/stack-tower/assets/sprites/e03-drop-input.png | tools/gen-assets.mjs（2×48 落点虚线，α0.3，L4 引导层） | **implemented（已接线）** | renderer.drawGuide（layers<2 显示）；缺图回 setLineDash 虚线 |
| a09-e04-cut-debris | 贴图 | games/stack-tower/assets/sprites/e04-overlap-cut.png | tools/gen-assets.mjs（120×28 错口碎块，失败黑 α0.25） | **implemented（已接线）** | renderer.drawDebris；缺图回 DEBRIS 纯色矩形 |
| a10-e05-perfect-pulse | 贴图 | games/stack-tower/assets/sprites/e05-perfect-window.png | tools/gen-assets.mjs（120×28 切面白脉冲框，§1 特殊时刻光） | **implemented（已接线）** | renderer 波纹期切面脉冲；缺图不加脉冲（保持「完美=克制」） |
| a11-e06-ripple-ring | 贴图 | games/stack-tower/assets/sprites/e06-tower-ripple.png | tools/gen-assets.mjs（240×96 三圈椭圆环） | **implemented（已接线）** | renderer 波纹分支（α (1−t)·0.9）；缺图回 ctx.ellipse 描边 |
| a12-e07-hud-scrim | 贴图 | games/stack-tower/assets/ui/e07-score-hud.png | tools/gen-assets.mjs（480×56 顶部渐隐衬底，无底板） | **implemented（已接线）** | renderer 帧末绘制；缺图不绘衬底 |
| a13-e08-restart-skin | 贴图 | games/stack-tower/assets/ui/e08-fail-recover.png | tools/gen-assets.mjs（96×32 圆角按钮皮肤） | **implemented（已接线）** | hud.applyRestartSkin（app/main 预载回调）；缺图保持 CSS 底 |
| a14-block-tileset | tileset | games/stack-tower/assets/tileset/blocks-tower.png | tools/gen-assets.mjs（360×28，暖色三循环 A/B/C cell） | **implemented（已接线）** | textures.sliceTileset（blockFace 切片优先）；缺图回程序化画布 |

落盘核对：
- `node scripts/contract-check.mjs` E 段 → spec 登记 assets 5/5（a01–a05，全部 source=generated，零外部资源）。
- 实体贴图 a06–a14 登记于本表（spec assets 段不动，属 T3 资产段管辖）：
  - 生成复现：`cd games/stack-tower && npm run assets:generate`（确定性，重复运行逐字节一致；单资产 >50KB 或总量 >300KB 即非零退出）。
  - 接线复现：`cd games/stack-tower && npm run assets:check` → 三态门禁：浏览器级（运行时 9/9 请求 200 + 「贴图就绪 9/9」+ 零页面错误 + **资产全 404 负面用例核心循环仍可玩**）/ 降级（静态可达 + PNG 签名）/ FAIL。
  - 降级纪律：`src/render/assets.ts` 无加载器（Node 契约测试）→ 空清单走程序化；加载失败 → 单项 null → 程序化绘制；任何情况不抛错、不刷 console.error。

## 红线
- 零外部资源（不引入 http(s) 外链、不下载素材包）；assets/ 全部由仓库内生成器产出并入库。
- 任一资产超预算 → 先砍表现层细节，不动玩法数值。
