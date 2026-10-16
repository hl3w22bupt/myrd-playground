# 证据目录 — R2 复证轮 · 美术线独立复跑（2026-10-02）

> 线1 美术 · 口径 = `evidence-one-line-template.md`（四要素：结果/文件/日期/命令/摘要/目录）
> 背景：R2 轮已 N1–N5 收口（QA round-3 APPROVE-READY，blockers 清零，等主人拍板）；本目录为美术线
> 在本 run 工作区（`run-cmuq9pz86001vm9zrmqyfm59c`）的独立复证，**零新增/零修改资产**，只重跑门禁留新鲜证据。
> 路径变量：`G2` = g2-blocks 仓库根（`/Users/leo/.myrd/workspaces/cmto0g28j0002m9sqnvjdy8o7/g2-blocks`）；
> `RUN_WS` = 本 run 工作区根。下表命令均可用 `cd $G2` + 环境变量重跑。

## 一行式台账

```
[PASS] | 线1 美术 | 01-gate-palette.log | 2026-10-02 | cd $G2 && npm run gate:palette | ALL-GREEN 0红/21对 minΔE=26.555 阈值=25 margin=+1.555 selftest=18/18（≡冻结记录逐字一致） | g2-blocks 仓库根
[PASS] | 线1 美术 | 02-gate-six-pinned.log | 2026-10-02 | cd $G2 && G2_REPO_ONE_PATH=$RUN_WS npm run gate | 六门禁全绿：①②④⑤⑥ PASS；③ theme 单源 ac-11/a–c = PASS=3 RED=0 PENDING-APPROVE=0（theme.ts 已生成接线，骨架态转绿）；ac-17 一号零接触自检 PASS（钉本 run，非装绿） | g2-blocks 仓库根
[PASS] | 线1 美术 | 03-mapping-g5-and-wiring.log | 2026-10-02 | cd <本目录> && node 03-mapping-g5-and-wiring.mjs | ALL-GREEN 7/7：G5/a–d 四项 + 接线 theme.ts 含 7/7 冻结 hex + 色板交付件 sha256=7bc2ca03… ≡ spec sourceSha256 锚 | 本证据目录（脚本自定位 RUN_WS，env G2_REPO/G2_RUN_WS 可覆盖）
```

## 复证范围与结论

- **复证而非重做**：三批交付件（`e-board-block-tiles.json` / `style-card.json` / `e-renderer-ui-tokens.json` /
  `e-renderer-backdrop.json` / `a03-sfx-plan.json` / `palette-n1-final.json`）+ `MAPPING.md` 全部零触碰；
  交付态与 QA round-3 verdict 锚（g2-blocks 仓库 commit `8249249`）一致。
- **锚定关系**：`palette-n1-final.json` sha256 `7bc2ca033ee8d7f7…` ≡ 链 v2（`cmuqa2mu50023m9zr8mh60uph` approved）
  `numeric.palette.sourceSha256`，色板定稿零漂移。
- **一处口径披露（非缺陷）**：门 ④ 若不显式钉 `G2_REPO_ONE_PATH`，`tests/framework.spec.mjs` 兄弟目录扫描
  会取到首个 `run-*`（本轮实测取到他线 `run-channel-cmulajp5g002km9lf73o99y95`，其白名单外改动致自检红）。
  复证按既定口径显式钉本 run 后 5/5 PASS；建议下轮 spec 修订时由程序线把 env 钉值写进门禁 README（登记制，非本轮动作）。
- **美术线挂账不变**：intent 更正案（block-02 注记 ≈64→66.6，随 `sourceSha256` 一并更正）继续顺延，
  触发条件 = approve 后首轮 spec 修订，6 步执行序见 `assets.md` 色板节。
