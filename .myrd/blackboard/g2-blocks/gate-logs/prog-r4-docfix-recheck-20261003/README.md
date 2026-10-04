# prog-r4-docfix-recheck-20261003 — 驳回修复 R4 后最终态复跑原文（程序线）

> 更新时间：2026-10-03 · 负责人：程序线
> 分工：`c425e1f-closeout-recheck-20261003/` = 驳回②要求的**美术复核收口态（c425e1f）**复跑原文；
> 本目录 = R4 文档/工具修复提交（`4f67806`）后的**最终态**复跑原文（黑板收口基线以本目录为准）。

## 归档对象

| 项 | 值 |
|---|---|
| g2-blocks 仓库 commit | 门禁实跑于 `4f67806`（R4①③④ 修复）；双清单重出随后落 `fe5fd38`（清单 `gitRef` 字段 = 生成时点真值 `4f67806`）· HEAD = `fe5fd38` |
| 钉值 | `G2_SPEC_PATH=<本run>/.myrd/spec/g2-blocks/design-spec.json` + `G2_REPO_ONE_ROOT=<本run>`（v1.2 条目改钉 `design-spec-v1.2-draft.json`） |
| 钉值与 R1 修复关系 | `repo-one.mjs` 已修（`2a5d480`），不设钉也锚本 run；钉值保留 = 与既有归档可比 |

## 文件与判定（原文）

| 文件 | 命令 | 判定 |
|---|---|---|
| `01-contract.log` | `node scripts/contract-check.mjs` | **18 PASS / 0 FAIL · EXIT=0**（锚 `302e6336…` 零漂移） |
| `02-v12-three-checks.log` | `G2_SPEC_PATH=<draft>` + `--only ac-19/20/21` | **3/3 PASS · 各 EXIT=0** |
| `03-gates-eight.log` | `npm run gate` | **①–⑧ 全 PASS**（⑧ = 20/20） |
| `04-smoke.log` | `node tools/smoke.mjs` | **SMOKE: PASS · EXIT=0 · J1=174.6ms ≤ 400ms** |
| `05-assembly-and-perf.log` | manifest 对账 + `assembly-entry.mjs` + `perf-report.mjs` | **同批 `be310288cff10563`**（buildSha256 相等 · **gitRef 双方同为 `4f67806`**）· **P95=16.7ms @ fps=60 · 卡顿 0** |

## 本目录专证：R4④ 歧义根除

```
assembly buildSha256 be310288cff10563 gitRef 4f67806
shot     buildSha256 be310288cff10563 gitRef 4f67806
sameBatch(buildSha256) true · gitRef identical true · sameBatchCriterion in both true
```

- 同批判据唯 `buildSha256`；两清单 `gitRef` 已重出为同一 commit（`4f67806`），历史歧义值
  （`bb4c836` vs `2a5d480`）不再存在。
- 即便未来两清单在不同 commit 生成，双方文件内 `sameBatchCriterion.gitRefRole=informational`
  已随件声明：gitRef 是各自动作时点真值，**不作同批判据**（QA 必核清单同步更正，见
  `docs/assembly-entry.md`「同批判据」表）。

## 红线核对

- ① v1.2 数值冻结前不写数值实现代码：ac-19/20/21 双态机判 PASS（工程面零 v1.2 实现痕迹）
- ② 契约测试零硬编码派生值：三条 check 全部现读草案 numeric 段
- ③ stack-tower 线零接触：ac-17 白名单机判 PASS；本轮提交只动 docs/ + tools/ + 两份 manifest
- ④ 性能口径只落 `docs/release-readiness.md`（§A/§B），未进 spec acceptance
- ⑤ 阻塞项零新增；B1/B2/B3 维持闭合
