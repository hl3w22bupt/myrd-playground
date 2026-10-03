# A4 · 美术线复核 A-01..A-08 + A-09 认领（2026-10-03 · 游戏美术）

> 复核对象 = 主策划代执行的 A 轮 N4 发布素材包（g2-blocks @ `4f7470d`）+ 同批 4 实机帧。
> 复核性质 = **美术线独立复核（黑板挂账 G-A09 的解除动作）**，非重做；发现 3 处美术面缺陷（A-12/A-13/A-14），已修并重出。
> 复核后源仓 commit = **`c425e1f`**（fix(assets)，改动面 = `tools/gen-release-assets.mjs` + `assets/release/` 9 件 + manifest，零触碰 src/build/spec/tests）。

## 一、逐件复核表（A-01..A-08）

| 编号 | 资产 | 复核结论 | 备注 |
|---|---|---|---|
| A-01 | icons/icon-512.png | PASS（复核修正版重出） | 512×512 IHDR 机判 · 四块面心像素 ≡ 冻结色板 ±3 · sha256 ≡ manifest |
| A-02 | icons/icon-maskable-512.png | PASS（重出） | 内容像素 51512 全部 ⊆ 中心 80% 安全区（越界 0，r≤210px） |
| A-03 | icons/icon-192.png | PASS（重出） | 192×192 · 派生色命中 |
| A-04 | favicon 32/16 + apple-touch-180 | PASS（重出） | apple-touch 按 maskable 口径检：越界 0（r≤74px） |
| A-05 | share/og-1200x630.png | PASS（重出 + 文案修正 A-13） | 1200×630（OG 官方 1.91:1） |
| A-06 | share/wx-share-500x400.png | PASS（重出 + 文案修正 A-13） | 500×400 5:4 · 目检版式无重叠 |
| A-07 | share/dy-share-720x1280.png | PASS（重出 + 文案修正 A-13/A-14） | 720×1280 9:16 · 内部元数据已除 |
| A-08 | shots/ ×4（390×844@2x） | PASS（零触碰） | 780×1688 IHDR + sha256 ≡ shot-manifest · 同批 `be310288cff10563`（门四机判） |

## 二、复核发现并修复的缺陷（编号续 A-11）

| 编号 | 实机位置 | 参考卡条款 | 差什么 | 改哪个文件 | 状态 |
|---|---|---|---|---|---|
| **A-12** | 发布素材 9 件全部块面 | 要素2「顶部高光条」+ 要素3 材质 token（R3 已认领的显式化面） | 生成器硬编码 `rgba(255,255,255,0.16)` / 带高 0.16 / y 偏移 0.07；美术规格（style-card.json → theme MATERIAL/SHAPE，运行时 renderer 同源）= **α0.18 / 带高 0.18 / 内缩=内描边宽** → 素材与实机漂移 | `tools/gen-release-assets.mjs` block() 接线 theme 单源 + 出图前 style-card↔theme 漂移守卫 | ✅ 已修重出 |
| **A-13** | OG/wx/dy 卡 accent 文案 | 红线①同源（数值纪律） | 「连击 ×5 上限」= **v1.2 draft 未冻结数值**（approved v1.1 `numeric.combo` 无 maxMultiplier 键，实查机判）→ 若主人改值/否决，渠道素材即错 | 同上（文案改「连击加成 · 炉冷判定」） | ✅ 已修重出 |
| **A-14** | dy 卡底部副文案 | 渠道素材对外口径 | 印「spec v2 · approved」内部流程元数据，玩家不可读且暴露内部状态 | 同上（改「离线可玩 · 零贴图渲染」） | ✅ 已修重出 |

## 三、A-09 认领（G-A09 解除）

**认领。** 判定依据（机判，见 `01-art-recheck.log` A-09 行）：
1. 代改值 `0.036/0.016/0.043` ≡ 描述件 `assets/e-renderer-ui-tokens.json` typeScale ≡ `src/render/theme.ts` TYPE_SCALE（三处逐字相等，codegen 链完整）；
2. 基准 = 整屏高（renderer 源码 `layout.h * TYPE_SCALE.*` 机判命中），390×844 实测 score=30.4px / label=13.5px / banner=36.3px，旧值 0.3→253px 巨字溢出缺陷确认成立、修法方向正确；
3. 与风格卡要素4 自洽：hudAreaRatio 0.12 未动，score 主层级差（30.4 vs 13.5）保持置顶可读；
4. 八门禁 + 契约 18/18 + 冒烟基线全绿不降（本轮复跑取证）。
附注（非阻塞视觉意见）：目标行 = label×0.72 ≈ 9.7px 处于可读性下限，若后续轮有 spec 修订窗口可随 A-10 一并复核。

## 四、机器门禁复跑（复核后全绿不降，2026-10-03）

```
[PASS] | 线1 美术 | 01-art-recheck.log | 2026-10-03 | node 01-art-recheck.mjs | ART-RECHECK: PASS 12/12（四门禁 + A-09 认领 + A-13/A-14 红线；maskable 越界 0、色板像素 4/4 命中、9 件 IHDR+sha256 全等） | 本目录（脚本自定位 RUN_WS/G2）
[PASS] | 线1 美术 | （八门禁） | 2026-10-03 | cd $G2 && npm run gate | 门禁绿（骨架态口径）①–⑧ 全 PASS，合计 20 PASS/0 FAIL（N3 面） | g2-blocks 仓库根
[PASS] | 线1 美术 | （色板门禁） | 2026-10-03 | cd $G2 && npm run gate:palette | ALL-GREEN 红对数=0/21 minΔE=26.555 阈值=25 margin=+1.555 selftest=18/18（≡冻结记录） | g2-blocks 仓库根
[PASS] | 线1 美术 | （契约） | 2026-10-03 | cd $G2 && node scripts/contract-check.mjs | 18 PASS / 0 FAIL · CONTRACT: PASS（ac-17 一号零接触 root=本 run） | g2-blocks 仓库根
```

- 八门禁/色板/契约为复核后**复跑取证**（本轮未逐一落 log 文件，原文见各命令 stdout；核心判据已固化进 `01-art-recheck.log` 与源仓 commit message）。
- 实机 4 帧本轮零触碰 → 门四同批指纹（`be310288cff10563`）继续有效，截图证据链不作废。
- 素材文案纪律与门一判据已在 `01-art-recheck.mjs` 固化：剥注释后扫描 `×5 / maxMultiplier / spec vN` 与数字字面量形态 rgba/rgb，复核器可重跑复证。
