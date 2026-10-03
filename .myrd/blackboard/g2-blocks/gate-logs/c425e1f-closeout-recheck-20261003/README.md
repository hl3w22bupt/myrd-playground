# c425e1f-closeout-recheck-20261003 — 收口态（c425e1f）复跑原文（驳回修复 R4②）

> 更新时间：2026-10-03 · 负责人：程序线 · 触发：驳回反馈②「收口态复跑无原文归档，违『归档=复跑 stdout 原文』纪律（B3 同判据）」

## 为什么有这个目录

blockers.md「收口复跑基线」（契约 18/18 · 八门禁全 PASS · SMOKE J1 · v1.2 3/3）原先**无 stdout 原文在档**
（旧值 `171.3ms` 取自上一轮 run 的工作区输出，未随黑板归档）。本目录在 **c425e1f（美术线复核收口 commit）**
上实跑复跑并归档原文，基线数字改以本目录实测为准。

## 归档对象

| 项 | 值 |
|---|---|
| g2-blocks 仓库 commit | `c425e1f5f81f11818201495b0e459863c88afeb3`（美术复核收口：A-12/A-13/A-14 修复 + A-09 认领） |
| 复跑方式 | `git worktree add /tmp/g2b-c425e1f c425e1f` → 干净树上实跑（不扰动收口后文档修复的工作区） |
| 钉值 | `G2_SPEC_PATH=<本run>/.myrd/spec/g2-blocks/design-spec.json` + `G2_REPO_ONE_ROOT=<本run>`（v1.2 条目改钉 `design-spec-v1.2-draft.json`） |
| 复跑时间 | 2026-10-03（UTC 时间戳在各文件 `# at:` 行） |

## 文件与判定（原文）

| 文件 | 命令 | 判定 |
|---|---|---|
| `01-contract.log` | `node scripts/contract-check.mjs` | **18 PASS / 0 FAIL · EXIT=0** |
| `02-v12-three-checks.log` | `G2_SPEC_PATH=<draft>` + `--only ac-19/20/21` | **3/3 PASS · 各 EXIT=0** |
| `03-gates-eight.log` | `npm run gate` | **①–⑧ 全 PASS**（⑧ = 20/20） |
| `04-smoke.log` | `node tools/smoke.mjs` | **SMOKE: PASS · EXIT=0 · J1=172ms ≤ 400ms** |

## 基线数字更正（驳回连带更正）

| 项 | 旧黑板写法 | 本目录实测（有档） |
|---|---|---|
| SMOKE J1 | `171.3ms`（无档，取自上轮 run） | **`172ms`**（`04-smoke.log`，c425e1f 态） |

J1 为墙钟实测值，跑间存在毫秒级抖动；以归档原文为准，不再跨 run 转抄。
