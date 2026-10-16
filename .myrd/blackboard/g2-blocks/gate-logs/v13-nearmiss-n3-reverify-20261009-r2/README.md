# V1.3 首批 · N3 美术线对「QA 驳回修复轮」亲审 + 复证 r2（2026-10-09 · 复证不新做）

> 执行：游戏美术（线1）· 对象 = `g2-blocks-v13` 工作树（分支 `feat/v1.3-nearmiss-settlement` @ **`ded8e8f`**，树净，`git status --porcelain` = 0 行）
> 背景：上轮 N3 复证（对象 `2738599`）之后发生 QA 驳回修复轮（源仓 `ded8e8f`，程序线执行，spec 为 SSOT）。
> **修复面中 `a10 六张截图重摄`（新批 `e3481537…`）属美术交付物 G-05 的连带变更**——按「N2 程序线初版 → N3 美术线亲审」判例
> （stack-tower C 轮同构），本轮美术线对涉变资产亲审 + 三门禁对新 HEAD 复证。
> 结论：**新批六张亲审 PASS · 三门禁全绿 EXIT=0 · ART-RECHECK-V13 27/27（判据零改动）· 复证后 v13 树仍净**。

## 证据一行式（口径 = `../evidence-one-line-template.md`）

```
[PASS] | 线1 美术 | 01-check-v13-three-state.log | 2026-10-09 | cd $V13 && node scripts/check-v13.mjs | 三态 18 / 25 / 29+1PEND 计数全符 · EXIT=0（驳回修补③的 ac-32 C 节归因矩阵在内全绿） | g2-blocks-v13 工作树 @ ded8e8f
[PASS] | 线1 美术 | 02-gates-eight.log | 2026-10-09 | cd $V13 && G2_SPEC_PATH=<run-ws approved v1.1> npm run gate | 门①–⑧ 全 PASS 74/0 · 色板 ALL-GREEN 0红/21对 minΔE=26.555 margin=+1.555 selftest=18/18（≡冻结记录）· EXIT=0 | g2-blocks-v13 工作树 @ ded8e8f
[PASS] | 线1 美术 | 03-art-recheck-v13.log | 2026-10-09 | node 03-art-recheck-v13.mjs $V13 | ART-RECHECK-V13: PASS 27/27 · 新批 buildSha256=e3481537… 全符（D/b）· 六张字节量 ≡ manifest 逐张相等（D/e）· 生成器确定性重跑零漂移（E/det）· EXIT=0 | 本证据目录（复证器 = r1 同件拷贝，判据零改动）
[PASS] | 线1 美术 | （亲审 · 涉变四张实机截图） | 2026-10-09 | 美术眼检 settle-nomoves ×2（新构造）+ nm-hit ×2（重摄） | settle-nomoves：分数槽 0→160 · record 路径通用归因行「棋盘无可消除，炉冷收场」语义正确 · 两档同构自适应；nm-hit：构图与读感与原批一致（抖动面=脉冲相位，不损伤读感）；settle-nm ×2 与原批逐字节全等免检 | g2-blocks-v13 工作树 @ ded8e8f
```

## 亲审明细（对程序线重摄的美术面认定）

| 件 | 亲审结论 | 依据 |
|---|---|---|
| settle-nomoves-390/430（**新**） | PASS——「先手得分 160 → PB=score 走 record 路径 → 通用归因行」构图成立；PB=0 的 edge 降级文案改由契约机判（ac-32 C 节矩阵），截图不再承载歧义态，**留证语义保真** | 目检两档 + manifest `stateMapping` 三态留证口径 |
| nm-hit-390/430（重摄） | PASS——边行冷带 + 冷横幅构图与原批一致；`determinismNote` 披露的脉冲相位抖动属动画面，三 run 三值为预期行为（同批判据 = buildSha256），读感无损伤 | 目检 + manifest 披露面复核 |
| settle-nm-390/430 | 免检——与原批**逐字节全等**（未涉态零漂移交叉验证，字节量 124124/139838 相等） | `04-shot-v13-reshoot.log` + 磁盘字节量比对 |
| shot-manifest.json | PASS——新增 `stateMapping`（三态 ↔ 归因文案留证口径）+ `determinismNote`（抖动面如实披露）两字段，新增不断言面兼容，判据零改动 | 复证器 D 组 5 断言全 PASS |

## 观察项（1 条 · 非阻塞 · 登记制）

- **HUD 分数标签-数值间距随位数压缩**：三位数时读作「分数160」（一位数时「分数 0」有空隙），两机型档一致存在；无 spec 条款约束最小间距，不构成缺陷。若下轮打磨：`src/render/renderer.ts` HUD 分数区加 min-gap（呈现层单点改动，零数值面）。**本轮不动**（驳回修复面之外的零触碰纪律）。

## 红线核销

- stack-tower 零接触 ✓ / spec 与 numeric 冻结面零写入 ✓ / 玩法逻辑与数值零改动（本轮对源仓零写入，复证前后树净）✓
- 本轮产出仅：本证据目录（3 log + 复证器同件拷贝 + 本 README）+ 黑板 `assets.md` r2 台账登记，全部落 run 工作区黑板。
