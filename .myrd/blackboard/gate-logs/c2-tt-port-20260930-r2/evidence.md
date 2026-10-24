# C 轮 · N2 驳回收口轮（r2）门禁证据（2026-09-30）

> 执行人：游戏程序（N2）· 对应 QA 驳回三项（kit 文书失真 / 门禁输出可见存档缺失 / D3 四要素缺档）
> repo 根 = run 工作区根（`git rev-parse --show-toplevel`）；基线：spec **v1.5 approved**（平台 v7 `cmunf6r1e014cm9lfamzllk2h`）
> 黑板指针：`.myrd/blackboard/`（levels.md / assets.md / blockers.md）；上一轮证据：`gate-logs/c2-tt-port-20260930/`（r1，历史保留）；N3 覆写证据：`gate-logs/c3-art-overwrite-20260930/`

## 三项修复对照

| # | QA 驳回 | 修复 | 复核方式 |
|---|---|---|---|
| ① | kit 文书 §1/§2 为 N2 初版值（300,401B + 5 件旧 sha），与 N3 覆写后磁盘真源不符 | `docs/dy-submission-kit-c3.md` §1 主包体积→**300,222B**、§2 五件 sha256→**N3 覆写版**（≡ `assets/tt/manifest.json`）；`tests/tt/tt-submission-kit.spec.mjs` 增补两条防漂移断言（文书 sha256 ≡ manifest 逐件相等 / 文书主包体积 ≡ export/tt/manifest.json） | `01-tt-gate.log` 内 dy-submission-kit 段 **31 项断言全绿**（含 2 条新断言 PASS） |
| ② | 聚合器只留 RESULT 行，`DY_FRIEND_RANK` 三行未进留档；blockers.md 指认失实 | `tests/tt/run-tt-gate.mjs` 子门 stdout **全量透传**；`tt-runtime-surface.spec.mjs` 补 `DY_FRIEND_RANK=cloud` 行打印；blockers.md 指认更正为 r2 档 | `01-tt-gate.log` 实测三行在档：`DY_FRIEND_RANK=degraded reason=missing-api` / `reason=no-tt-container` / `DY_FRIEND_RANK=cloud`（`grep '\[gate\] DY_FRIEND_RANK' 01-tt-gate.log` 可复现） |
| ③ | `c3-art-overwrite-20260930/02b-root-contract.log` 无四要素头、与 02-contract.log 全同对应不明；N3 重建包无独立 bundle-size 留档 | r2 轮日志统一**四要素头**（文件名/日期/命令/执行目录 + 输出摘要尾注）；`02b-root-contract.log` 重写（头部显式声明 = 根分发器 `scripts/contract-check.mjs`，与 02-contract.log（游戏工程版直呼）dispatch 同源对应）；新增 `c3-art-overwrite-20260930/04-bundle-size.log`（重建包 300,222B 独立留档） | 各日志头部即四要素；`03-bundle-size.log` RESULT: PASS（300,222B ≤ 4MB） |

## 门禁结果（本目录四份原始日志，四要素齐备）

| # | 门禁 | 命令（repo 根执行） | 结果 | 日志 |
|---|---|---|---|---|
| 1 | tt 轨门禁聚合（含子门 stdout 透传） | `node games/stack-tower/tests/tt/run-tt-gate.mjs` | **PASS 5/5**（55+25+31 项断言；DY_FRIEND_RANK 三行在档） | `01-tt-gate.log` |
| 2 | 根契约检查（根分发器独立留档） | `node scripts/contract-check.mjs` | **PASS**（39/40 + acc-a7 not-runnable 单列） | `02-root-contract.log` |
| 3 | tt 包体积分列（N3 重建包） | `node games/stack-tower/scripts/check-tt-bundle-size.mjs` | **PASS**（主包 300,222B ≤ 4MB；子包 0B；manifest 63 件零漂移） | `03-bundle-size.log` |
| 4 | 工程冒烟 | `node games/stack-tower/tests/smoke.mjs` | **PASS (browser)**（核心循环可玩，零页面错误） | `04-smoke.log` |

## 红线自查（本轮零新增触碰面）

- 变更面 = kit 文书数值刷新 + `tests/tt/` 三文件（断言/透传/打印）+ 黑板 + 日志；**零 src/ 变更、零 spec 变更、零 `export/wx/` 变更**。
- numeric ≡ `c3af773b6483164c22ca0a039623967cb3b67ff9b2b658749f927baeee74957d` 存档锚（`01-tt-gate.log` 内 check-numeric-freeze PASS）。
- optional 能力（录屏分享/高光封面卡）四处显式标注在位，未产件不判缺陷（spec 口径③）。
- 提审包指纹：`export/tt/game.js` sha256 = `580991ccc8d76f4440e97493d3732271afb66137d04a391eb936f852a3d0c9d0`（骨架件未变，kit §1 包指纹仍有效）。
