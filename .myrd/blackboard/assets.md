# 资产清单黑板 — stack-tower（M2 首卡 → M2.1「有声可装」→ 正式发布轮）

> 更新时间：2026-09-26（**正式发布轮开工**：本轮资产面**只检不新做**——发布素材终检（maskable 安全区 / 首屏对齐风格卡 / 资产零缺失 / 无未压缩大图拖慢冷启动）由 T3 美术线执行，终检记录落 `gate-logs/release-m21-20260926/art-final-check.md`；资产核对状态 = 待终检（N3），`sfx-<事件id>` 注册表与程序双签随 N1/N3 完成）
> 前轮纪要：2026-09-25（M2.1 复验轮·终证）：资产面五道门禁干净 shell 全量复跑——assets:check **PASS (browser)**（9/9 运行时 200 + 404 负面用例可玩）/ contract A–E 22/22 / run-all 22/0/0 / smoke PASS (browser)；gen-audio 确定性口径：PNG 逐字节确定 ✓，音频内容稳定但容器元数据非字节稳定
> 负责人：主策划（整合人）· T3 美术线维护资产段，T4 程序线维护实现段
> 下一步：N3 素材终检 → N1 sfx 注册表双签；B6 真机三项仍挂主人排期；主人试玩后如对色板/构图给方向性意见 → 风格卡 30 分钟升 v1

## M2.1 新增资产段（D2 交付）

| 资产 | 落点 | 规格 | 生成复现 | 核对 |
|---|---|---|---|---|
| a06-sfx-restart | assets/sfx/sfx-restart.{m4a,ogg} | 198ms（≤200 红线 ✓）440/587Hz triangle，critical=true | `node games/stack-tower/tools/gen-audio.mjs` | manifest.json events.restart.durationMs=198 |
| （声道实测口径） | 同上 6 个 .ogg | Vorbis ID 头实测 channels=1 / sampleRate=44100（6/6，python3 解析 `\x01vorbis` 包头） | 复验轮 2026-09-25 抽证 | m4a 侧 afconvert 写 stsd channelcount=2 元数据（流实为 1ch），机判以 ogg 头为准（qa-m21 §语义裁决留档） |
| sfx-pack-v1（12 文件） | assets/sfx/sfx-{place,perfect,miss,game-over,restart,level-clear}.{m4a,ogg} | 6 事件 × 双格式，44.1kHz 单声道 16-bit；事件 ≤400ms（最大 level-clear 398ms ✓）；共 66.74KB | 同上（音色表唯一真源 = src/audio/voices.ts，运行时降级同表合成） | `assets/sfx/manifest.json` = acc-a1 注册表断言点 |
| a07-pwa-icons（3 件） | assets/icons/{icon-192-maskable,icon-512-maskable,apple-touch-icon-180}.png | maskable 安全区内构图（塔块三层意象同风格卡）；共 4.68KB | `node games/stack-tower/tools/gen-assets.mjs`（新增 drawIcon 三 job） | PNG 签名 + 色值抽样已验（琥珀块/冷蓝天天空） |

### M2.1 缺陷修复记录（美术线，随 D2 一并落盘）
- **pnglib.mjs `blend()` 通道缺陷**：三通道循环误写 `r`（g/b 解构未用）→ 此前所有生成 PNG 的 R=G=B（全图灰度），琥珀塔块/冷蓝天空全部失色。M2 门禁只查 PNG 签名与可达性，未抽色值——盲区已记入 QA 台账；本轮修复 + 12 件全量重生成 + 色值抽样核对（e01 块面 = amber 0.78 阶 (154,84,43)）。
- 工具链备忘：本机 ffmpeg 无 libvorbis（原生 vorbis 编码器拒单声道）→ .ogg 用 `oggenc`（vorbis-tools 1.4.3，已 brew 安装）；.m4a 用 `afconvert`（系统自带）。生成器已固化该路径。

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
- `node scripts/contract-check.mjs` E 段 → spec 登记 assets **7/7**（spec v3：a01–a05 + a06-sfx-restart + a07-pwa-icons，全部 source=generated，零外部资源；M2.1 复验轮终证 2026-09-25 复跑 PASS，取证 `gate-logs/m21-reverify-20260925-art-final/`）。
- 实体贴图 a06–a14 登记于本表（spec assets 段不动，属 T3 资产段管辖）：
  - 生成复现：`cd games/stack-tower && npm run assets:generate`（PNG **逐字节确定**，复验零漂移；单资产 >50KB 或总量 >300KB 即非零退出）。音频 `npm run audio:generate` 为**内容稳定、字节不稳定**（容器时间戳/序列号），复验 12 文件零内容漂移；无内容变化不重生成入库。
  - 接线复现：`cd games/stack-tower && npm run assets:check` → 三态门禁：浏览器级（运行时 9/9 请求 200 + 「贴图就绪 9/9」+ 零页面错误 + **资产全 404 负面用例核心循环仍可玩**）/ 降级（静态可达 + PNG 签名）/ FAIL。复验轮终证 **PASS (browser)**（playwright 装载器已统一自动发现，无需手工注入环境变量）。
  - 降级纪律：`src/render/assets.ts` 无加载器（Node 契约测试）→ 空清单走程序化；加载失败 → 单项 null → 程序化绘制；任何情况不抛错、不刷 console.error。

## 红线
- 零外部资源（不引入 http(s) 外链、不下载素材包）；assets/ 全部由仓库内生成器产出并入库。
- 任一资产超预算 → 先砍表现层细节，不动玩法数值。
