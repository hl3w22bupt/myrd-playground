# implement 节点复核证据 —— r3 门禁修复 @ 最终内容集（2026-11-01）

> 本目录是「实现玩法」（implement）节点对本轮 r3 门禁修复（Bug cmvxrs3fv005em905y4eouy35 /
> cmvxr1f1a004fm905ua2ua9ir）的**独立复核证据**：不复用上节点的日志，四门禁在本提交内容集上重跑。
> 逐关取证行口径见 `../20261101-r3-merge/SUMMARY.md`（修复摘要与三处实现缺陷的 root cause 在那里，不重复）。

## 本节点动作

1. **Bug cmvxrs3fv005em905y4eouy35 的 spec 侧收口**：工程侧四轴方向断言（scaffold 节点已落
   `tests/smoke.gd::_step_move_axis`）之外，spec.acceptance 的操控语义条目此前只落了镜像待入链
   （`docs/spec-acceptance-mirror.md` 旧版记「沙箱不可达 revisions API」）。本节点以平台身份
   （`design-spec:write`）走正式通道入链：
   `POST /api/v1/game-design-specs/cmvxrtp2z005gm9055alqx9md/revisions`
   → **spec v3 = `cmvxw290c000wm9z6cec4yg92`（approved，acceptance 13 → 14 条）**，
   新增 `acc-input-semantics`（check = `games/myrdplaygrou/tests/smoke.gd`，mode = auto），
   v2 自动 superseded（版本链保持唯一 approved）。镜像文档同步改为「已入链」。
2. **四门禁独立复核**（下方证据文件，全部退出码 0）。
3. **导出可复现性验证**：`godot --headless --export-release "Web"` 全新导出，
   `index.pck` sha256 = `19c6ae6ef9ea2c1425bdfed1c4c8b838e715f26d06bc6f3b0ae47c5684eb1f7c`，
   与仓库已提交产物（2cfea19 入库）**逐字节一致** —— 本提交相对 v10 导出只有 docs 变更，
   qa/ 证据有 `.gdignore` 不进包，pck 内容不受影响。部署节点可拿此哈希与线上资产通道解码值比对。

## 门禁判定（本目录日志）

| 门禁 | 结果 | 证据 |
|---|---|---|
| preflight | `PREFLIGHT: PASS`（15 类，2578 个工程文件） | preflight-r3.log |
| godot-smoke | `GODOT_SMOKE: PASS`（240 帧内；`[smoke]` 第 1/2/3 关通关 + 关卡推进证据行齐全） | smoke-raw-r3.log / smoke-wrapper.log |
| input-fuzz | `GODOT_FUZZ: PASS`（seed=20260913，6 批次 239 帧） | fuzz-r3.log |
| playtest | `GODOT_PLAYTEST: PASS`（3 局 ×900 帧；`[main] playtest run -> level 1/2/3` 三关轮换证据行） | playtest-raw-r3.log / playtest-wrapper.log |

试玩逐局指标（METRICS 行）：fb=227 / 245 / 240，最长无反馈窗 0.38s / 0.35s / 0.37s（阈值 ≤10s），
密度远超 ≥2/局下限 —— 阈值与校准披露见 `../20261101-r3-merge/SUMMARY.md` 与 `qa/mobile/ROUND-v9-SUMMARY.md`。

## 部署锚点（deploy 节点核对「部署的是不是这份代码」）

- 分支：`myrd/pvz-web-goal-cmvxjycvn001zm905jnwpyliv`（绝不用 main）
- `export/web/index.pck` sha256 = `19c6ae6ef9ea2c1425bdfed1c4c8b838e715f26d06bc6f3b0ae47c5684eb1f7c`
- liveUrl（部署后不变）：`https://leomac-studio.tail49399e.ts.net/apps/myrdplaygrou/`
- HostedApp：cmvxjyb8a001xm905cnip241e（slug: myrdplaygrou）
