# 资产清单黑板 — stack-tower（M2 首卡）

> 更新时间：2026-09-25（M2 冲刺开工）
> 负责人：主策划（整合人）· T3 美术线维护资产段，T4 程序线维护实现段
> 下一步：T3 风格卡 v0 落盘 → 资产重量预算复核（<300KB 程序化优先）→ T4 程序化生成器对号入座

## 顶部：风格卡（v0 摘要）
- 主题锚点：stack-tower（叠塔 · 落块），主题项零编造，全部派生自 T1 锚定的「叠塔/塔/切面」意象与 spec world 段文本
- 光照逻辑：单顶光（正午顶光 + 底部冷色反弹），塔层自上而下亮度递减 8%/层，制造「越叠越高」的读数感
- 对比度策略：塔块高饱和（暖色系）vs 天空低饱和（冷灰蓝），HUD 白字 + 深色描边，切面高亮描边 1px
- 构图脚本模板：见 `games/stack-tower/docs/style-card-v0.md` §3（首屏构图脚本）
- 资产重量预算：单卡总预算 <300KB，程序化优先（Canvas2D 生成贴图 + WebAudio 合成音效），零外部下载
- 归档不投入：snake-ghost / merge-td 情绪板（T1 终裁落选卡，不再投入工时）

## 资产清单

| 资产 id | 类型 | 落点 | 生成方式 | 状态 |
|---|---|---|---|---|
| a01-block-palette | 色板 | games/stack-tower/src/render/palette.ts | 程序化常量表（8 色，见风格卡） | scaffold |
| a02-block-face | 贴图 | games/stack-tower/src/render/textures.ts | procedural:canvas2d（切面高亮描边） | scaffold |
| a03-bg-sky | 背景层 | games/stack-tower/src/render/backdrop.ts | procedural:canvas2d（冷灰蓝渐变 + 远景塔影） | scaffold |
| a04-sfx-place | 音效 | games/stack-tower/src/audio/sfx.ts | procedural:webaudio（落块闷响） | scaffold |
| a05-sfx-perfect | 音效 | games/stack-tower/src/audio/sfx.ts | procedural:webaudio（完美叮 + ripple 呼应） | scaffold |

## 红线
- 零外部资源（不引入 http(s) 外链、不下载素材包），对齐 M1 单文件可玩基线。
- 任一资产超预算 → 先砍表现层细节，不动玩法数值。
