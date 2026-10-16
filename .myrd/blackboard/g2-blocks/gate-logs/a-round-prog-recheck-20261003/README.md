# a-round-prog-recheck-20261003 — 程序线独立复检原始输出（N2/N3 · 新 run 工作区）

> 更新时间：2026-10-03 · 负责人：程序线 · 下一步：QA round-2（N7）以此目录为对账输入之一
> 与 `deploy-20261002/`（N2③ · 10/2 发布 commit 归档）分工：本目录 = **本轮修复后**的复跑证据。

## 为什么有这个目录

上一轮的门禁证据产自 run `cmuq9pz86…` 工作区。本轮按「不沿用上轮证据」口径，在新 run
工作区（`run-cmurp7sfe000ticcx6ddkrvca`）实跑全部程序线门禁，**实测出 3 处缺陷并修复**
（R1 定位器误锚 / R2 `--only` 假绿 / R3 导出漂移，详见 blockers.md「程序线复检修复记录」），
然后复跑取证。归档 = 复跑 stdout 原文。

## 归档对象

| 项 | 值 |
|---|---|
| g2-blocks 源仓 commit | `aa929e3`（= `2a5d480` 复检修复 + `aa929e3` 证据重出，working-tree clean） |
| 一号仓库（本 run） | 未触碰 `games/stack-tower` 等禁区；黑板三件套另行提交 |
| 钉值 | `G2_SPEC_PATH=<本run>/.myrd/spec/g2-blocks/design-spec.json` + `G2_REPO_ONE_ROOT=<本run>`（与 deploy-20261002 同口径；R1 修复后**不设钉也锚本 run**，钉值仅为与已归档证据可比） |

## 文件与判定

| 文件 | 命令 | 判定 |
|---|---|---|
| `01-contract-approved-v11.log` | `node scripts/contract-check.mjs` | **18 PASS / 0 FAIL · EXIT=0**（numeric 锚 `302e6336…` 零漂移） |
| `02-v12-draft-three-checks.log` | `G2_SPEC_PATH=<draft>` + `--only ac-19/20/21` | **3/3 PASS · 各 EXIT=0**（工程面零 v1.2 实现痕迹 = 红线①机判；反例在案：裸跑 ac-19 → RED EXIT=1） |
| `03-gates-eight.log` | `npm run gate` | **①–⑧ 全 PASS**（⑧ = N3 工程前置面 20/20） |
| `04-smoke.log` | `node tools/smoke.mjs` | **SMOKE: PASS · EXIT=0 · J1=171.5ms ≤ 400ms** · 控制台零错误 |
| `05-assembly-and-perf.log` | `node tools/assembly-entry.mjs` + `node tools/perf-report.mjs` | **ASSEMBLY: PASS · 同批 `be310288cff10563`** · **P95=16.7ms @ fps=60 · 卡顿 0** |

## N2① 图注册表（本目录外证据）

`list_repos` → `{"alias":"g2-blocks","path":"<工作区>/g2-blocks"}`（1 条在册）。

## 红线核对

- **①** v1.2 数值冻结前不写数值实现代码：ac-19/20/21 双态机判 `v1.2=draft → 工程面零实现痕迹` PASS
- **②** 契约测试零硬编码派生值：ac-19/20/21 全部现读草案 numeric 段（`maxMultiplier/step/rounding`、`star/streakTrack/seedBasis`、`thresholds/unit`）
- **③** stack-tower 线零接触：ac-17 白名单机判 PASS（`root=run-cmurp7sf…` 本 run）
- **④** 性能口径只落 `docs/release-readiness.md`，spec acceptance 零新增
- **⑤** B1/B2/B3 本轮内闭合，未触发升级主人条款

## N9 触发前置（部署面提醒）

源仓 `build/` = 批次 `be310288cff10563`；一号仓库部署镜像 `games/g2-blocks/export/web` 仍是
10/2 发布批次（`8d40c39`）。**N9 必须重新导出镜像**，否则线上 ≠ 源仓当前批次。
