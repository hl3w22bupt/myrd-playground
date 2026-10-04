# 发布素材终检记录 — stack-tower M2.1 正式发布轮（N3）

> 终检人：T3 游戏美术（主策划派单）· 日期 2026-09-26 · 性质：**发布素材终检，只检不新做**
> 检对象：release tag `stack-tower-m2.1-release` @ `5a3284fa137a3926fabb5f7b4fcdd098bd075df3` 的 `games/stack-tower/export/web/assets/`（发布面）
> 结论：**四项全 PASS，零新增工时零新做**；本记录即 `sfx-<事件id>` 注册表双签之**美术侧会签**（程序侧签见 `games/stack-tower/docs/release-healthcheck-m21.md` §5）

## ① maskable 安全区 — PASS

- 方法：只读 PNG 解码（zlib + unfilter，脚本 `/tmp/art-check-png2.mjs`，临时不入库）逐像素核验：安全圆（中心圆 d=80%）外像素必须为背景（逐行左右边缘参照，适配渐变底），圆内必须有内容。
- 证据（2026-09-26 实测输出）：
  - `icon-192-maskable.png` 192×192 → `outsideCircleNonBgPx=0` · `rowEdgeMismatch=0` · 圆内内容 5565px → **MASKABLE-SAFE-PASS**
  - `icon-512-maskable.png` 512×512 → `outsideCircleNonBgPx=0` · `rowEdgeMismatch=0` · 圆内内容 39592px → **MASKABLE-SAFE-PASS**
  - `apple-touch-icon-180.png` 180×180 → `outsideCircleNonBgPx=0` · `rowEdgeMismatch=0` → **PASS**（apple-touch 无 maskable 语义，按全出血底核对）
- 备注：初版检查器误报 FAIL（单均值背景 vs 垂直渐变底），已修正为逐行边缘参照后复检——误报过程留档于此，防后人重踩。

## ② 首屏对齐风格卡 — PASS

- 色板真源链：`src/render/palette.ts` 八色 = 情绪板 `moodboard-stack-tower.md` §二逐条对应（文件头注释声明「改色先改情绪板」）；`tools/gen-assets.mjs` 解析 palette.ts 取值、解析失败拒生成——私设色值结构性不可能。
- 图标像素证据（512 图标圆内内容色 top）：`#9d572e`（=陶土橙 #c96f3b × 0.78 层明度）、`#833a27`（砖红 #a84a32 系）、`#a98033`（沙黄 #d9a441 × 0.78）——与风格卡 §1 三面明度比（100:78:55）正面系数 0.78 精确吻合；天空底色实测 `#8a97a8` = palette `SKY_BOTTOM` 逐位一致；顶色为同族冷灰蓝提亮（小尺寸可读性），系图标介质惯例，不违风格卡（其约束对象为画布首屏）。
- 画布首屏：风格卡 §0 主题锚点（冷灰蓝黄昏天空 + 暖色系塔块循环 + 白切面高亮）在 smoke 门禁（`4-smoke.log` 画布 480×720 就绪 + 零 pageerror）与历史色值抽样（e01 块面 amber (154,84,43)，见 assets.md 缺陷修复记录）双证下成立。

## ③ 资产零缺失 — PASS

- 运行时贴图 9/9（sprites 6 + tileset 1 + ui 2）HTTP 200（`5-assets-check.log` RESULT: PASS (browser)）+ 资产全 404 负面用例核心循环可玩。
- sfx 注册表 12/12（6 事件 × m4a+ogg）+ manifest.json；icons 3/3（192/512 maskable + apple-touch 180）。
- SW precache 清单含 assets 全量（`sw.js` 55 项，gen-sw 从 build 目录真实扫描生成）。

## ④ 无未压缩大图拖慢冷启动 — PASS

- 发布面全量最大单文件 = `assets/tileset/blocks-tower.png` **16.7KB**；次大 = `build/render/renderer.js` 7.7KB。
- `export/web/assets/` 总量 **168KB** < 风格卡预算 300KB；贴图全为程序化生成 PNG（零照片级未压缩图），音频全为 44.1kHz 单声道压缩格式（m4a/ogg 单件 ≤7.4KB）。
- 冷启动面：precache 55 项全部小文件（SW install 一次拉满后离线零网络），首屏无网络瀑布。

## 美术侧会签

- `sfx-<事件id>` 资产注册表：命名 `sfx-{place,perfect,miss,game-over,restart,level-clear}.{m4a,ogg}` 与 spec `content.sfxPack.naming` 一致、六事件音色与风格卡「克制反馈」哲学一致（perfect 一次性短叮 / critical 三事件短促）→ **美术侧会签通过**（2026-09-26）。
- 双签合成：程序侧（healthcheck §5）+ 美术侧（本节）→ 注册表核对**双签完成**。
