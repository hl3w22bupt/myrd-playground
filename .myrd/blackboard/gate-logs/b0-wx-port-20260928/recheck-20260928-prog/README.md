# B0 · 接续复核轮（程序 · 2026-09-28 10:10–10:16）

> 目的：接续轮全量复核上轮（N1→N4）产物真实性——不新写实现代码，零设计变更；对 N2/N3 已收口面按同口径复跑并落盘本轮证据。
> 证据条款：每份日志含命令 + 时刻 + 输出全文 + exit 码（四要素）。
> 结论：**9/9 全绿，零缺口零漂移；上轮收口态成立**。真机轨仍 BLOCKED（AppID 未到位）与「是否提审」两项维持待主人拍板，非本轮可解。

## 证据清单

| # | 文件 | 命令 | 结果 |
|---|---|---|---|
| 1 | 1-contract-check-root.log | `node scripts/contract-check.mjs`（仓库根裸调用） | RESULT: PASS（spec v1.3 ↔ 工程一致；A 段 platformSpecId=cmukkjc10001ym9nb3dnc5kt6 v5 approved；B 段 31/32 实跑 + acc-a7 合规挂起；C/D/E 段全绿），exit 0 |
| 2 | 2-wx-gate.log | `node tests/wx/run-wx-gate.mjs` | wx-GATE: PASS (6/6)（runtime-surface 16 / share-loop 12 / open-data-rank 11 / submission-kit 13 / bgm-loop 14 断言 + 素材查表 7/7），exit 0 |
| 3 | 3-bundle-size.log | `node scripts/check-wx-bundle-size.mjs` | PASS——主包 317.8KB≤4MB / 开放数据域 5.7KB≤1024KB 分列口径；manifest 62 件漂移 0，exit 0 |
| 4 | 4-numeric-freeze.log | `node scripts/check-numeric-freeze.mjs` | PASS 三向对账——存档 ≡ 现行导出件 ≡ v1.2 载荷 = `c3af773b…74957d`（零漂移；脚本只复算 N1 存档，不现场自算），exit 0 |
| 5 | 5-typecheck-web.log | `npx tsc -p tsconfig.json --noEmit` | exit 0 |
| 6 | 6-typecheck-wx.log | `npx tsc -p tsconfig.wx.json --noEmit` | exit 0 |
| 7 | 7-smoke.log | `node tests/smoke.mjs` | RESULT: PASS (browser)——模块图 28 件可解析 + 核心循环落块/重开 + 零页面错误，exit 0 |
| 8 | 8-run-all.log | `node tests/contract/run-all.mjs` | **PASS 31 / FAIL 0 / not-runnable 0**（v1.2 四判据含其中，web 链路零行为变化），exit 0 |
| 9 | 9-submission-pkg-sha256.log | `shasum -a 256 games/stack-tower/export/wx/manifest.json` | `7ee13ab741fc3586b7477e43f89e94f6d2a3c32eafd49357cbd0c8b19208225f` ≡ blockers.md N4 登记值（逐字一致） |

## 复核范围声明

- 本轮**未修改任何游戏代码 / 素材 / 脚本 / spec**（`git status` 干净，见本轮提交）；仅新增本证据目录与黑板回写。
- 上轮 N3 六条拒绝线复核：①numeric sha256 一致（#4）②差集为空（#1 C 段）③bgm-loop 有 wx 结果（#2 第 5 行）④未超预算（#3）⑤web 回归通过（#7/#8）⑥条目落点+check 齐（#1 spec 四条目在档）——**零命中维持**。
- 挂起项不变：正式 AppID / 类目资质材料 / 微信开发者工具 CLI / 真机双机（Android+iOS）——AppID 到位后按 `docs/qa-wx-b0.md` §一.轨3 复跑口径执行，不造假数据。
