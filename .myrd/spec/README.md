# .myrd/spec/ — 策划案导出件索引（本仓库两线并存口径）

> 更新时间：2026-09-22（M1 收口验证 + M2 立项冲刺 · 主策划）
> 负责人：主策划（版本链唯一看护；任何内容修订必须走版本链 version+1，禁止覆盖旧版）
> 下一步：足球线 v1.3 M2 段草案今日挂 draft（不走 approve）；糖果线 spec v1 冻结不动

## 两份导出件（契约测试的共同输入）

| 文件 | 游戏 | 版本/状态 | 契约测试调用 |
|---|---|---|---|
| `design-spec.json` | 糖果粉碎传奇（代号 Pixel Fives，`games/game/`） | v1 · **approved**（2026-09-20 追认代记） | `node scripts/contract-check.mjs --spec .myrd/spec/design-spec.json --project .`（双口径见 runbook §1） |
| `design-spec-pixel-fives.json` | 像素街机足球 Pixel Fives（`pixel-fives/`） | v1.2 · **approved**（2026-09-12 主策划盖章） | `node pixel-fives/tools/contract-check.mjs`（acc-07 落点，默认读本文件） |

## 为什么有两份（合并撞车事故记录）

本仓库两条产物线共用分支（`myrd/pixel-fives-m0-m1-cmtpb66pe000rm9e2ozdurf8d`）。2026-09-21 晚合并
（d0487cf，两段历史无共同祖先）时，两条线各自把导出件写在同一路径 `.myrd/spec/design-spec.json`：
**糖果版胜出，足球版被覆盖丢失**（足球线 contract-check.mjs 同批丢失，从未入库）。本次冲刺已按以下方式处置：

- 足球 v1.2 导出件自合并父提交 d9f2f13 **字节级还原**至 `design-spec-pixel-fives.json`
  （sha256 见当日 gate-log；六段内容零改动，版本链 v1.2 approved 原样，非新版本）；
- 足球线 contract-check 按其 spec acc-07 落点声明**重建**于 `pixel-fives/tools/contract-check.mjs`
  （规格依据 = evidence-prog-m1 §2：双模式，approved→全量强制 / 未批准→pending 降级 warning）；
- 糖果线 `design-spec.json` 与 `scripts/contract-check.mjs` 一字未动。

## 红线重申

1. 两份导出件各自的 approved 版都是**唯一断言依据**；禁止把一个游戏的 acceptance 拿去核另一个游戏。
2. 任何内容修订 → 走 `POST /api/v1/game-design-specs/:id/revisions`（version+1）；旧版不覆盖。
3. approve 只有一个；draft（如足球 v1.3 M2 段草案）不作为契约测试依据。
