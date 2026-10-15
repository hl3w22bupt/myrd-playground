# 美术复证轮台账 — wheat-squad（2026-10-12 · 游戏美术 · 双轨冲刺轮）

> 触发：本轮任务书（双轨冲刺 2026/10/12，A 主轨第二线收口）。按 redispatch-survey-first 勘验后定性：**复证而非重做**——可玩基线轮美术交付面（风格卡 v1 已获主策划拍板开产授权 · manifest 9 件 ≤ 封顶 13 · 提审占位模板 3 件 · ac-10..13 四条款入契约）已在 N4–N9 各节点收口，本轮零新做项。
> 基准：一号仓 HEAD `aa448e5`（工作树干净）。N9 复核轮门禁在 `03cf8d7` 实跑；其后的 `20a1a9d`（黑板文档）与 `aa448e5`（平台技能）**零触及 games/wheat-squad 与 .myrd/spec**（`git diff --stat 03cf8d7..HEAD -- games/wheat-squad .myrd/spec` = 空，原文见下），故程序线 N9 代码面结论的输入字节与当前 HEAD 全等。

## 代码面零漂移证明（N9 结论有效性的边界声明）

```
$ git diff --stat 03cf8d7..HEAD -- games/wheat-squad .myrd/spec
（空输出，EXIT=0）—— 代码面 + spec 面自 N9 门禁实跑点以来零字节漂移
```

## 复证项与结论（六项全绿，均当前 HEAD 实跑落原文）

| # | 复证项 | 方法 | 结果 | 证据件 |
|---|---|---|---|---|
| ① | 自有契约套件（13 项，含美术 AC-A1..A4 = ac-10..13） | `node tests/contract/run-all.mjs`（games/wheat-squad） | **13 PASS / 0 FAIL · EXIT=0**（ac-art-4 机制面+互查回执全达，`qa/style-consistency-check.md` 在档） | `01-contract.log` |
| ② | 统一契约门禁（approved spec 对账，仓根口径） | `node scripts/contract-check-unified.mjs --spec .myrd/spec/wheat-squad/design-spec.json --project games/wheat-squad` | **CONTRACT: PASS · EXIT=0** | `02-unified-contract.log` |
| ③ | 三方色值机判（升版） | `check-palette-consistency-v1.mjs`：style-card-**v1** ↔ theme.ts ↔ **approved design-spec.json**（派生自 20261011 版，仅改三处指向，判据逻辑逐行不动） | **8 色逐值三方全等 · 无清单外 token · EXIT=0** | `03-palette-consistency.log` |
| ④ | 裸 hex 单源链扫描（上轮挂账 N6 收口的兑现复核） | src 全量 grep `#[hex]{3,8}` | **theme.ts 之外 0 文件命中**——上轮 game.ts ×5 裸 hex 已清零，裸 hex 仅存钦定单源 theme.ts 8 token，与 ac-10 白名单机判同口径 · PASS | `04-naked-hex-scan.log` |
| ⑤ | 提审占位模板（AC-A2/A3 面）+ sha256 基线 | 尺寸机判（SVG width/height ↔ manifest spec）+ 体积 ≤ cap + `shasum -a 256` 独立实算 | **三件尺寸逐件命中**（512² / 1000×800 / 1170×2080）· 清单 **9 ≤ 13** · 完整 sha256 基线 4 件留证（manifest + 3 模板，下轮零漂移比对用） | `05-submission-templates.log` |
| ⑥ | scope-guard 双模式（违规标识符扫描，策略单源含素材文案面） | `ci/guard-repo-scope.mjs` `--self-check` + 默认扫描 | **双模式 EXIT=0 · 49 文件零越界**（mode2 修复后本轮复证无回归） | `06-scope-guard.log` |

## 范围与诚实口径

- **本轮不重跑 WS-SMOKE**：冒烟属程序线运行面（N9 于 `03cf8d7` 实跑 PASS）；代码面零字节漂移（见上）+ 本轮美术面仅新增黑板证据件，不构成对运行面的新输入。如需当前 HEAD 全量重证（契约+冒烟+扫描三件套），归程序线 N9 同口径复跑。
- **A3 结论面维持 ⏳**：0/5 真人试玩回填（W-2，主人侧），美术线不代拍板、不虚标「四件套全达」。
- **正式提审素材维持止步清单**：本轮交付 = 占位模板 + 尺寸 README；正式 PNG 产出待主人拍板（平台红线照旧）。
- **g2-blocks 零触碰**：本轮未读写源仓（边界照旧）。

## 结论有效性

本台账六项结论仅对 HEAD `aa448e5` 有效；其后的任何提交（尤其触及 games/wheat-squad、.myrd/spec、ci/scope-policy.json 者）使本结论过期，须按本目录脚本重证后方可再登记。

—— 游戏美术 · 2026-10-12 · 复证于 HEAD `aa448e5`
