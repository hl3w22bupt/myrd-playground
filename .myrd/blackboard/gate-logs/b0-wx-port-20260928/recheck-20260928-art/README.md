# B0 · 美术线收口复核证据（2026-09-28 · 游戏美术 · 只检不新做）

> 取证环境：本 run 工作区（仓库根）；取证对象 = N2 美术线已落树交付（`f5d13fb`）。
> 证据条款：每份日志含命令 + 时刻 + 输出全文 + exit 码（四要素）。

| 文件 | 命令 | 结果 |
|---|---|---|
| 1-gen-wx-assets-zerodrift.log | `node tools/gen-wx-assets.mjs` + 前后 sha256 diff | 7/7 逐字节一致 **ZERO-DRIFT**；`src/ assets/` 零触碰，exit 0 |
| 2-assets-wx-check.log | `node tests/wx/assets-wx-check.mjs` | **PASS 7/7**（sha256+尺寸+NEON 派生色 #0b1026 命中），exit 0 |
| 3-neon-check.log | `node tests/assets-neon-check.mjs` | PASS 13/13（r4 P0 资产面未被本轮触碰），exit 0 |
| 4-wx-gate.log | `node tests/wx/run-wx-gate.mjs` | **wx-GATE: PASS (6/6)**，exit 0 |
| 5-contract-check-root.log | `node scripts/contract-check.mjs`（仓库根） | RESULT: PASS（31/32 + acc-a7 not-runnable 具 spec 挂账背书，与基线口径一致），EXIT=0 |

## 复核结论

- **交付面零漂移**：`assets/wx/` 7 件平台素材重生成逐字节一致，manifest.json 独立复算 7/7 全等。
- **风格派生纪律**：manifest `derivedFrom` = 霓虹夜塔参考卡 v1.0 + theme.ts NEON 表唯一色源；查表器逐件精确像素命中派生色，零新编风格。
- **接线面**：`src/platform/share.ts` 两张分享卡常量引用（真源 manifest.json）；`tools/build-wx.mjs` 镜像 3 件运行时素材入 `export/wx/assets/wx/`；`wx-icon` 入组包配置面。
- **计数口径**：spec 定稿 id 7 项为准（任务书「8 项」差额已在 assets.md 挂账主人指认，未擅自新编）。
