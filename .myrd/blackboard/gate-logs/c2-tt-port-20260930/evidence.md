# C 抖音移植轮 · N2 程序线门禁证据（2026-09-30）

> 执行人：游戏程序（N2）· repo 根 = run 工作区根（`git rev-parse --show-toplevel` = `/Users/leo/.myrd/workspaces/cmto0g28j0002m9sqnvjdy8o7/run-cmunesx300146m9lfeoyat8w7`）
> 基线：spec **v1.5 approved**（平台 v7 `cmunf6r1e014cm9lfamzllk2h`）· 分支 `myrd/pixel-fives-m0-m1-cmtpb66pe000rm9e2ozdurf8d`（开工 HEAD `df2550d` = N1 收口态）
> 黑板指针：`.myrd/blackboard/`（levels.md / assets.md / blockers.md）

## 门禁结果（六份原始日志同目录）

| # | 门禁 | 命令（repo 根执行） | 结果 | 日志 |
|---|---|---|---|---|
| 1 | tt 轨门禁聚合 | `node games/stack-tower/tests/tt/run-tt-gate.mjs` | **PASS 5/5**（55+25+29 项断言） | `01-tt-gate.log` |
| 2 | wx 轨门禁聚合 | `node games/stack-tower/tests/wx/run-wx-gate.mjs` | **PASS 6/6**（wx 零回归） | `02-wx-gate.log` |
| 3 | 根契约检查（提交前置） | `node scripts/contract-check.mjs` | **PASS**（A 段自动识别 v7 approved；39/40 实跑 + acc-a7 not-runnable 既有态单列；B–E 面零漂移） | `03-contract-check.log` |
| 4 | 冒烟门禁 | `node games/stack-tower/tests/smoke.mjs` | **PASS (browser)**（Chromium 打开 + 点击落块 + 计分 + R 重开 + 零页面错误） | `04-smoke.log` |
| 5 | tt 包体积分列 | `node games/stack-tower/scripts/check-tt-bundle-size.mjs` | **PASS**（主包 300,401B ≤ 4MB；子包 0B 分列；manifest 63 件零漂移） | `05-bundle-size.log` |
| 6 | web 契约全量 | `node games/stack-tower/tests/contract/run-all.mjs` | **PASS 39/39**（web 面零回归） | `06-web-contract.log` |

## 关键指纹与红线自查

- **numeric 零漂移**：`check-numeric-freeze` PASS——sha256(sortKeys numeric) = `c3af773b6483164c22ca0a039623967cb3b67ff9b2b658749f927baeee74957d` ≡ v1.3 唯一存档锚（只复算存档，未现场自算）。
- **wx 包零触碰**：`git status --porcelain export/wx wx/` = 空；wx 轨 6/6 全绿（B0 在案基线不动）。
- **web 行为零变化**：`src/platform/tt.ts` / `src/app/boot-tt.ts` 不被 browser/main 链路 import；`share.ts` 仅加法（wx 缺省卡片集字节不变）；web 契约 39/39 + 冒烟 browser PASS。
- **提审包指纹**：`export/tt/game.js` sha256 = `580991ccc8d76f4440e97493d3732271afb66137d04a391eb936f852a3d0c9d0`；主包 293.4KB / 4MB。
- **dy 素材 5 件**（确定性生成 `tools/gen-tt-assets.mjs`，重跑逐字节一致）：sha256 见 `games/stack-tower/assets/tt/manifest.json` 与 `games/stack-tower/docs/dy-submission-kit-c3.md` §2。
- **B-C-001 解除证据**：任务书前提「仓库根路径缺失」与本 run 工作区事实不符——`git rev-parse --show-toplevel` 在位且 `games/stack-tower/` 工程完整（src/tests/docs/tools/export/wx/assets 齐备，开工时工作区干净）；主人任务书同令「不等待人工审批，直接实现」+「路径一到位即放行并行段」→ N2 据此放行（明细见 `blockers.md` B-C-001 段）。
- **真实容器档位口径**：devtools 档 = 本机机跑（fake tt 宿主行为冒烟）；真机档 = 显式 `blocked`（AppID + 类目/资质 + IDE 工具未到位，不执行、不造假数据）。
