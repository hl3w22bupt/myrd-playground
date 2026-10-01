# N1 修复轮 · QA round-2 复检回执（approve-ready）

- 回执编号：QA-G2-N1-R2-20261001-01
- 日期：2026-10-01（UTC+8）
- 复检人：游戏 QA（独立实查，不信任各线自述）
- 结论：**approve-ready（无红）**——27 断言无红；**approve 是主人拍板位，团队不代拍**
- 复检时机：线1（色板定稿）+ 线2（spec v1 入链）齐备后即时复检（远早于 24h 上限）

## 一、逐条核对（五项关闭 + 无新红，一行式证据，模板见 `../evidence-one-line-template.md`）

```
[PASS] | 线1 | r1-palette-recheck.txt | 2026-10-01 | node tools/palette-gate.mjs matrix --palette assets/palette/palette-n1-final.json --threshold 25 --pairs 21 | ALL-GREEN 0红/21对 minΔE=26.555 阈值=25(现读 spec) margin=+1.555 selftest=18/18 | g2-blocks 仓库根
[PASS] | 线2 | r2-spec-chain.log | 2026-10-01 | node tools/qa-round2.mjs | 27 断言无红：v1 draft 唯一(id cmuovwra0004gm97tinha15zq)/导出件≡链上/5+1 逐字锚 9 项/el-hint reason 132 字/链上 21 对全绿/锚 302e6336… | g2-blocks 仓库根
[PASS] | 线3 | r3-n3-gates.log | 2026-10-01 | node tests/run-all.mjs | ①守卫 PASS ②色板 ALL-GREEN ③theme 框架 PENDING-APPROVE ④零冻结值面 6/6 PASS | g2-blocks 仓库根
[PASS] | 线4 | r4-repo-one-zero-touch.log | 2026-10-01 | node ci/guard-repo-scope.mjs --self-check <一号根> + git -C <一号根> diff --stat | status 3 行全白名单内；tracked diff 仅平台预置 SKILLS.md（开工前已存在，非本轮产物） | g2-blocks 仓库根
[PASS] | 线4 | gate-logs/n1-palette-20261001/ | 2026-10-01 | （5 log + README，四要素齐） | 色板证据链完整，含 #FFC94A 弃用反证 | 一号仓库黑板
```

## 二、五项关闭判定

| # | 关闭项 | 判定 | 依据 |
|---|---|---|---|
| 1 | B1 色板未定稿 | **✅ 解除** | 7 色齐（余烬金 `#C89C19` 弃 `#FFC94A` + 暖区 06/07），21 对双门禁全绿（门 A 三选二 + 门 B ΔE00≥25） |
| 2 | B2 spec 未入链 | **✅ 解除** | v1 一次成链（version 1，零 v1→v2 空转，幂等防线实测生效），5+1 修法逐字在链 |
| 3 | spec v1 含全部冻结值 | **✅ 达成** | numeric 冻结锚 `302e6336…a2d89`；palette/gate/阈值/combo/炉冷/J1/spawn 全部冻结段在链 |
| 4 | N3 前置件就位且门禁绿 | **✅ 达成** | 脚手架 + AC-18 守卫 + CI job + harness + seededRng 骨架 + theme 断言框架；run-all 绿（theme 为显式 PENDING-APPROVE） |
| 5 | 一号巡检零红 | **✅ 达成** | 零 tracked 工程文件改动；一号 spec/导出包/游戏工程零触碰 |

## 三、QA 判据自纠留痕（非 spec 缺陷）

- 首跑出现 1 条 RED：`R3 el-hint 不出现在 level-2`。定位 = **QA 判据写错**（对 level-2 全文做子串匹配，而 level-2 的 expect 文本合法写着「el-hint 仅 level-1」）；spec 本身无 el-hint 元素。判据已改为「只扫元素 id」并复跑 → 无红。此条留痕不改判据历史，供 N4/N5 审阅。

## 四、PENDING-APPROVE 清单（approve 后才能写/跑，非红）

- 冻结值相关实现与门禁：ac-01..ac-10、ac-13、ac-15、ac-16（棋盘/消除/连击/炉冷/结算顺序/重开/J1 perf/无贴图/音频/存档）
- `src/render/theme.ts`（由 spec 冻结块 codegen 生成）→ AC-11 值断言届时激活
- 团队本轮零越界：`src/kernel/` 仅 RNG 钩子骨架 + spec 装载器（seed 从 spec 现读，零硬编码）

## 五、披露项（主人拍板时请一并知悉）

1. **前轮记录缺口**：本工作区与全部兄弟 run 目录未检索到 g2-blocks 前轮台账 → 「已冻结 4 色（01/03/04/05）」的数值原文不可恢复，本轮由美术线一次性登记冻结（检索词与结论见 `../../blockers.md`「前轮记录缺口」）。
2. **`#FFC94A` 的否决依据**：数值门禁**不构成否决**（同门禁复跑不红）；否决 = 美术语义 + 量化三条（S=1.00 R 通道裁切 / L\*83.7 全板最亮 / 柠檬观感）。语义裁决归人工。
3. **导出件落点偏差（显式记录）**：任务书要求导出到 `.myrd/spec/design-spec.json`，该路径是一号仓库（stack-tower v1.5 approved 镜像）在用件 → 按红线「一号零接触」改落 `.myrd/spec/g2-blocks/design-spec.json`（沿正式发布轮 B4 冻结撞车件判例，记显式偏差）。
4. **黑板落点偏差（显式记录）**：顶层 `blockers.md/levels.md/assets.md` 是一号线在用台账 → g2 线落 `.myrd/blackboard/g2-blocks/`（同结构独立目录）。
5. **门 A 判据为策划定值**（ΔH≥25°/ΔL≥0.10/ΔS≥0.08 三选二）：已随 spec 冻结；首轮试用 0.18/0.15 过严（冻结 4 色自身不可过）→ 重定为可判别且有裕度的档位，全程留痕于工具与 spec。

## 六、门禁复跑索引（R2 驳回备忘项 · 程序线补记，不改上文 QA 判定）

- 本回执出具于线3 契约收口 commit `05a644e` **之前**；经核 `05a644e` 及其后续 R2 修 commit
  **未改链上 spec 内容**（链上仍 v1 draft `cmuovwra0004gm97tinha15zq`，numeric 冻结锚 `302e6336…` 不变）
  → 本回执 27 断言判定继续有效。
- `05a644e` 后六件门禁复跑留证：`../n1-prog-contract-20261001/01-run-all-six-gates.log`
  （①守卫 ②色板 21 对 ③theme PENDING-APPROVE ④零冻结值面 ⑤ac-14 ⑥acmap，全绿）。
- R2 修后复跑：`05-kernel-purity.log` 8/8 PASS（含新增 ac-14/h 零硬编码自证）；实跑时点与命令见该目录 README §1。
- 本节为程序线对备忘项的索引补记，回执 §一–§五 的 QA 判定原文维持不变。
