# 资产清单黑板 — g2-blocks（N1 修复轮）

> 更新时间：2026-10-01（N1 修复轮开工 · 主策划）
> 负责人：游戏美术（资产面）/ 主策划（整合校对）
> 下一步：线1 色板定稿后本文件即为唯一色板真源；OD 恢复后同步参考卡（不构成新门禁）

## 风格卡（四要素 · 其余三要素本轮不动，仅色板一要素进入本轮修订）

| # | 要素 | 定稿口径 | 本轮是否修订 |
|---|---|---|---|
| 1 | 色板（block-01..07） | 见下节（本轮唯一修订面） | ✅ 修订中 |
| 2 | 形状语言 | 方角圆角块（8px 圆角）+ 1px 内描边 + 顶部高光条，零外部贴图依赖（极简几何） | ❌ 不动 |
| 3 | 材质/光效 | 无贴图采样，纯色块 + 内阴影；命中反馈用亮度脉冲（不用粒子贴图） | ❌ 不动 |
| 4 | 版式/UI | 深底（#171A21 系）浅块，分数/连击区置顶，提示条底部 | ❌ 不动 |

> **OD 依赖披露**：open-design 守护进程 `127.0.0.1:7456` 在本工作区历史多轮不可达；本轮沿用既有处置裁定
> ——风格卡/色板产物一律落 repo 文件 + 哈希为真源，不依赖 OD 画布承载验收物；OD 恢复后同步参考卡（不构成新门禁）。

## 色板（线1 定稿区 · 本轮唯一修订面）— **✅ 定稿（2026-10-01）**

- 状态：**定稿**。美术交付件 = `g2-blocks/assets/palette/palette-n1-final.json`
  （sha256 `7bc2ca033ee8d7f7a20e63810b174e8cbdabcb92560a0db8dc72a10d553cd2ff`，确定性工具重跑逐字节一致）
- 门禁：门 A HSL 三选二（ΔH≥25°/ΔL≥0.10/ΔS≥0.08）+ 门 B ΔE(CIEDE2000)≥**25**（冻结 6 对校准 floor(min/5)*5）
  → **21 对 ALL-GREEN**（minΔE 26.555，margin +1.555）
- 证据：`.myrd/blackboard/g2-blocks/gate-logs/n1-palette-20261001/`（5 log + README，四要素齐）

| id | 名称 | hex | HSL | L* | 冻结态 |
|---|---|---|---|---|---|
| block-01 | 深海蓝 | `#21458C` | 220,0.62,0.34 | 30.6 | 已冻结（本轮登记） |
| block-02 | 余烬金 | `#C89C19` | 45,0.78,0.44 | 66.6 | **本轮终值（弃 #FFC94A）** |
| block-03 | 翡翠绿 | `#38B279` | 152,0.52,0.46 | 65.0 | 已冻结（本轮登记） |
| block-04 | 赤陶红 | `#DB6B43` | 16,0.68,0.56 | 58.0 | 已冻结（本轮登记） |
| block-05 | 紫水晶 | `#A472CA` | 274,0.45,0.62 | 56.3 | 已冻结（本轮登记） |
| block-06 | 深余烬褐 | `#4B2B25` | 10,0.34,0.22 | 21.4 | **本轮新增（暖区第 6 色·暗锚）** |
| block-07 | 绯玫瑰 | `#E3B5BF` | 346,0.46,0.80 | 78.0 | **本轮新增（暖区第 7 色·亮暖）** |

- 弃用值 `#FFC94A`（如实留痕）：数值门禁**不构成否决**（同门禁复跑不红）；否决依据 = 语义 + 量化三条
  （S=1.00 R 通道裁切 / L*83.7 全板最亮 / 柠檬观感），详见证据目录 `04-rejected-ffc94a.log`。
- **前轮记录缺口披露**：本工作区无前轮色值记录，冻结 4 色基线值由本轮一次性登记冻结（检索留痕见 blockers.md）。
- 移交：① 策划线并入 spec `numeric.palette`（含 gate 判据 + thresholdDeltaE=25）；② 程序线注意
  block-06 暗块必须接线 1px 内描边 + 顶部高光条（风格卡要素 2/3），不得省略。

## 资产清单（登记制，spec assets 段派生 · 2026-10-01 与链上 v1 assets 段对齐）

| id | 落点 | 来源 | 说明 |
|---|---|---|---|
| a01-block-palette | `g2-blocks/src/render/theme.ts`（真源=spec numeric.palette） | generated:constant-table | 7 色常量表，运行时单源；**approve 后 codegen 产出**（现缺位 → AC-11 显式 PENDING-APPROVE） |
| a02-palette-artifact | `g2-blocks/assets/palette/palette-n1-final.json` | g2-blocks/tools/palette-design.mjs | 美术交付件，sha256 `7bc2ca03…`（= numeric.palette.sourceSha256）；**已产出** |
| a03-sfx-pack | `g2-blocks/assets/audio/` | procedural | 消除/连击/炉冷/重开四类；**approve 后产出** |

> **资产面本轮变动（线3 契约收口，2026-10-01）：无新增/无修改资产**。本轮只动测试与门禁面
> （`tests/kernel-purity.spec.mjs` / `tests/acceptance-map.spec.mjs` / run-all / CI），三件资产落点与
> 产出状态不变；AC-11 单源断言机已在 /tmp 合成树上实测会咬（证据
> `gate-logs/n1-prog-contract-20261001/README.md` §2），approve 后 codegen 生成 theme.ts 即被门禁覆盖。
