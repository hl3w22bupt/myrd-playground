# 关卡状态黑板 — line3-tower-defense（单场景塔防 · 第三产品线）

> 更新时间：2026-10-17（双轨轮 · B 轨：spec v1 六件套起草至 approve）· 负责人：主策划（整合）/ 游戏策划（spec）/ 游戏程序（骨架）/ 游戏美术（风格卡）/ 游戏 QA（预审）
> 下一步：B2 六件套 → 三合一包 → B4 风格卡 v1 → B5 QA 预审 → B6 主策划 approve

**B 轨程序线复核一行**（2026-10-17 · 游戏程序 · 独立实查 @ HEAD `476090c`）：**B3 三件与 B6 approve 复核成立**——① 图谱：`.code-review-graph/graph.db` 实查含 **line3-tower-defense 节点 45 个**（File/Class/Function 入图，full build @ `0ac1fcf`，build_state=complete）；口径披露：库内实查 File=667/节点总数=6135，与 B3 行构建时点 stdout 口径「669 文件/6385 节点」存在小幅出入（统计口径差，注册事实不受影响，如实登记）；② `docs/inventory.md` 24 文件逐条一句职责在盘 ✓；③ 埋点桩 `src/telemetry/emitter.ts` + `fnd-1-td-telemetry-fieldnames.mjs` 在盘 ✓，且 0ac1fcf 时点 src 16 文件共 **105 行纯占位常量 fail-closed**（`git show 0ac1fcf --stat` 实证）——「approve 前零玩法」合规 ✓；④ B6：`gate-logs/b6-six-criteria.md` 六判据全 PASS + approve 动作 POST 200（01:44:41Z）+ 链上 v2 `cmvbqgzbl0029m9ax64foxd37` approved 在档 ✓。

## B 轨节点状态（2026-10-17 双轨轮 · **B 轨收口：approve 完成**）

| 节点 | 负责人 | 状态 | 产物落点 |
|---|---|---|---|
| B1 源校验（只读） | 游戏策划 | ✅ 完成 | ①调研简报 `research/line3-research-brief-20261016.md`（D15-D28 带出处+日期，QA 抽查环境限制如实）在盘 ✓ ②选型拍板 `line3-memo-v1.md`（差异点三列=§一.④ 品类查重表 3 行；不同品类声明=零机制复用）在盘 ✓ ③拍板已落黑板 ✓ → 可动笔 |
| B2 spec v1 六件套 | 游戏策划 | ✅ 完成 | `.myrd/spec/line3-tower-defense/spec-v1-payload.json`（六段 · builder 六段校验 PASS）+ fragments + 复现链 `tools/build-spec-v1.mjs` + 人读版 `games/line3-tower-defense/docs/design-spec-v1.md` |
| 三合一包（world 草稿+entities id+首屏文案） | 游戏策划→美术 | ✅ 一次发齐 | `.myrd/blackboard/line3-tower-defense/tri-pack-v1.md`（美术回执在档） |
| B3 骨架三件 | 游戏程序 | ✅ 完成 | ①工程注册入图谱：669 文件/6385 节点 @ `0ac1fcf` ✓ ②`docs/inventory.md` 逐文件一句职责 ✓ ③埋点八键桩（四件定名逐字符常量+缓冲式发射器，零外发）✓ —— spec approve 前零玩法（全占位 fail-closed） |
| B4 风格卡草案 | 游戏美术 | ✅ 完成 | `.myrd/blackboard/line3-tower-defense/assets.md`（四要素锁定 + 视觉签名映射表 + 美术回执「对得上」）+ 3 张方向稿（`games/line3-tower-defense/assets/style-sketch/`，确定性重跑 hash 不变实证）· palette 8 色已冻结进 spec numeric.palette |
| B5 QA 预审（六条口径） | 游戏 QA | ✅ PASS | `qa-preaudit-v1.log`（QA-L3-SPECV1-PREAUDIT-20261017-01 · 机检脚本两次过严断言修正留痕，spec 内容零改动） |
| B6 主策划 approve（六判据） | 主策划 | ✅ **approved** | 六判据核签 `gate-logs/b6-six-criteria.md` · `POST /revisions`→v2 draft（`cmvbqgzbl0029m9ax64foxd37`）→ `POST /approve`→200 approved（2026-10-17T01:44:41Z）· 父版 v1 superseded 回查 ✓ · 导出件 `.myrd/spec/line3-tower-defense/design-spec.json` 零漂移 PASS · README 索引+REVISIONS 台账三处登记 |

## 链上实况（2026-10-17 实查）

- 链 id `cmvabm4kh001jm92c4qtjy9a7` · platform version **1** · **status=approved**（2026-10-16T02:34:48Z）· spec.meta.version=0.1（骨架版）
- 骨架 acceptance 7 条（det-1/a1/a2/a3/a4/tex-1/perf-1，check 为规划落点）；本轮 v1.0 六件套承其 id 连续性（a1/a2/a3/a4/det-1/tex-1/perf-1 不改名，新增 8 条）
- 埋点四件定名（本轮 approve 后锁定，rename 一次性收口）：`first_tap` / `first_loop_complete` / `restart_clicked` / `hint_shown`（与线 2 逐字符一致）

## 关卡结构（v1.0 口径）

| 关卡 | 结构 | 判据锚 |
|---|---|---|
| level-1 首潮（教学波次） | 3 波 · 首波编成 ×0.5 宽松（前 10 秒敌量减半）· 路径箭头常显 | a1 首布防 ≤20s（5 种子） |
| level-2 涨潮（波次爬升） | victoryWaves=8 波通关即胜利结算 · 敌量/血量 1.35×/波爬升 · 核心生命 10 · 漏怪 -1 | a2 P50∈[240,420]s · P90≤600s（20 模拟局） |
