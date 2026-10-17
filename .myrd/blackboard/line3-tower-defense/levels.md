# 关卡状态黑板 — line3-tower-defense（单场景塔防 · 第三产品线）

> 更新时间：2026-10-17（双轨轮 · B 轨：spec v1 六件套起草至 approve）· 负责人：主策划（整合）/ 游戏策划（spec）/ 游戏程序（骨架）/ 游戏美术（风格卡）/ 游戏 QA（预审）
> 下一步：B2 六件套 → 三合一包 → B4 风格卡 v1 → B5 QA 预审 → B6 主策划 approve

## B 轨节点状态（2026-10-17 双轨轮）

| 节点 | 负责人 | 状态 | 产物落点 |
|---|---|---|---|
| B1 源校验（只读） | 游戏策划 | ✅ 完成 | ①调研简报 `research/line3-research-brief-20261016.md`（D15-D28 带出处+日期，QA 抽查环境限制如实）在盘 ✓ ②选型拍板 `line3-memo-v1.md`（差异点三列=§一.④ 品类查重表 3 行；不同品类声明=零机制复用）在盘 ✓ ③拍板已落黑板 ✓ → 可动笔 |
| B2 spec v1 六件套 | 游戏策划 | 🔄 本轮 | `.myrd/spec/line3-tower-defense/spec-v1-payload.json`（六段 meta/world/entities/levels/numeric/acceptance）+ 人读版 `games/line3-tower-defense/docs/design-spec-v1.md` |
| 三合一包（world 草稿+entities id+首屏文案） | 游戏策划→美术 | 🔄 本轮一次发齐 | `.myrd/blackboard/line3-tower-defense/tri-pack-v1.md` |
| B3 骨架三件（工程注册入图谱+inventory+埋点四件桩） | 游戏程序 | 🔄 并行 | `games/line3-tower-defense/`（spec approve 前只建结构与占位不写玩法；技术栈=TS+Canvas 拍板） |
| B4 风格卡草案 | 游戏美术 | 🔄 等三合一包 | `.myrd/blackboard/line3-tower-defense/assets.md`（四要素锁定，与线 2 风格卡分文件）+ 方向稿 2-3 张 |
| B5 QA 预审（六条口径） | 游戏 QA | ⏳ 等 draft | 预审记录落本目录 `qa-preaudit-v1.md` |
| B6 主策划 approve（六判据） | 主策划 | ⏳ 等 QA | `POST /:id/revisions` → 六判据核 → `POST /:newId/approve` → 导出件 `.myrd/spec/line3-tower-defense/design-spec.json` + README 索引登记 |

## 链上实况（2026-10-17 实查）

- 链 id `cmvabm4kh001jm92c4qtjy9a7` · platform version **1** · **status=approved**（2026-10-16T02:34:48Z）· spec.meta.version=0.1（骨架版）
- 骨架 acceptance 7 条（det-1/a1/a2/a3/a4/tex-1/perf-1，check 为规划落点）；本轮 v1.0 六件套承其 id 连续性（a1/a2/a3/a4/det-1/tex-1/perf-1 不改名，新增 8 条）
- 埋点四件定名（本轮 approve 后锁定，rename 一次性收口）：`first_tap` / `first_loop_complete` / `restart_clicked` / `hint_shown`（与线 2 逐字符一致）

## 关卡结构（v1.0 口径）

| 关卡 | 结构 | 判据锚 |
|---|---|---|
| level-1 首潮（教学波次） | 3 波 · 首波编成 ×0.5 宽松（前 10 秒敌量减半）· 路径箭头常显 | a1 首布防 ≤20s（5 种子） |
| level-2 涨潮（波次爬升） | victoryWaves=8 波通关即胜利结算 · 敌量/血量 1.35×/波爬升 · 核心生命 10 · 漏怪 -1 | a2 P50∈[240,420]s · P90≤600s（20 模拟局） |
