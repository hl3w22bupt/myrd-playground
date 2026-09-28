# B0 微信小游戏移植轮 · N3 门禁证据索引（2026-09-28）

> 取证环境：本 run 工作区（仓库根）；playwright chromium-headless-shell 153.0.8010.12 当轮安装。
> 证据条款：每份日志含命令 + 时刻 + 输出全文 + exit 码（四要素）。

## web-regression/（轨1 · 全绿）

| 文件 | 命令 | 结果 |
|---|---|---|
| 1-run-all.log | `node tests/contract/run-all.mjs`（10:0x–10:05） | **PASS 31 / FAIL 0 / not-runnable 0**，exit 0 |
| 2-typecheck.log | `tsc -p tsconfig.json --noEmit`（10:06:10） | exit 0 |
| 3-assets-neon-check.log | `node tests/assets-neon-check.mjs` | exit 0（霓虹 13 件查表） |
| 4-smoke.log | `node tests/smoke.mjs`（10:06:20） | PASS (browser)，零页面错误，exit 0 |

## wx-track/（轨2 可机跑面 · 全绿）

| 文件 | 命令 | 结果 |
|---|---|---|
| 1-wx-runtime-surface.log | `node tests/wx/wx-runtime-surface.spec.mjs` | RESULT: PASS（16 断言），exit 0 |
| 2-wx-share-loop.log | `node tests/wx/wx-share-loop.spec.mjs` | RESULT: PASS（12 断言），exit 0 |
| 3-wx-open-data-rank.log | `node tests/wx/wx-open-data-rank.spec.mjs` | RESULT: PASS（11 断言），exit 0 |
| 4-wx-submission-kit.log | `node tests/wx/wx-submission-kit.spec.mjs` | RESULT: PASS（13 断言），exit 0 |
| 5-bgm-loop-wx.log | `node tests/wx/bgm-loop-wx.spec.mjs` | RESULT: PASS（14 断言），exit 0 |
| 6-assets-wx-check.log | `node tests/wx/assets-wx-check.mjs` | RESULT: PASS 7/7，exit 0 |
| 7-bundle-size.log | `node scripts/check-wx-bundle-size.mjs` | RESULT: PASS（分列双 PASS），exit 0 |
| 8-numeric-freeze.log | `node scripts/check-numeric-freeze.mjs` | RESULT: PASS（三向对账），exit 0 |
| 0-run-wx-gate.log | `node tests/wx/run-wx-gate.mjs` | **wx-GATE: PASS (6/6)**，exit 0 |

## 真机轨（轨3 · 未执行，无证据不造假）

- 缺口：正式 AppID（touristappid 占位）/ 微信开发者工具 CLI 未安装 / 真机设备。
- 挂起清单与复跑口径见 `games/stack-tower/docs/qa-wx-b0.md` §一.轨3。

## 本轮记录在案的测试夹具/断言修正（均非判据放松）

1. `bgm-loop-wx.spec.mjs`：pump sink 夹具的 `isAudible` 由死值改为按 mutedProvider 实时计算（对齐 wx 真件 volume=0 语义）。
2. `wx-share-loop.spec.mjs`：分享接线断言落点由 wx.js 修正为 boot-wx.js（installShareMenu 实际调用处）+ wx.js registrar 导出。
3. `wx-open-data-rank.spec.mjs`：查表器揪出 rank.js 自带 hex 兜底字面量（违反 token 单源纪律）→ 修 rank.js 后复跑 PASS（真缺陷修复，非测试让步）。
4. `wx-submission-kit.spec.mjs`：材料落盘断言路径基准由游戏根修正为仓库根（spec 落点为仓库根相对）。
