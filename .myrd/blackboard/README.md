# 黑板组合全景索引（2026-10-12 · 可玩基线轮收口 · 主策划整合）

> 口径：一游戏一子目录判例（顶层三件套属 game-9 存量，零触碰）；本索引 = 全线一页视图。

## 组合全景

| 线 | 状态 | 本轮动作 | 关键产物 |
|---|---|---|---|
| **game-9《汽车连连看》**（一线已交付） | 维持：等主人试玩拍板（B1，2026-10-07 起） | **零接触**（本轮未动其任何文件/部署） | 顶层三件套 + `games/game-9/`（存量） |
| **g2-blocks《熔炉方块》** | 维持：提审就绪 · 被动触发器（主人发布拍板→提审流程；数据回流→下轮评估 v1.3） | **零接触**（仅从其工作区原样平移 guard 脚本一件，检测规则零改动） | 兄弟 run 工作区（不在本仓） |
| **wheat-squad《麦浪小队》**（第二产品线） | **可玩基线轮收口**：spec v1.1 approved + 契约/冒烟/扫描三绿 + QA 对抗审查结论在档 + 部署 v7 running（**页面路由平台层串线 W-3 升级中**，试玩入口暂缓交付） | 差异点三列表 → spec v1.0/v1.1 入链 approve → 风格卡 v1+资产 9 件 → A1-A4 实现+埋点 → 对抗审查 → 部署 | 见下「本轮决策与产物」 |
| **第三产品线** | 调研简报落盘（不开题不立项不写 spec v0） | 候选池互斥初筛 4→3 + 三轴初判 | `.myrd/blackboard/research/line3-candidates-20261012.md` |

## 本轮决策台账（wheat-squad · 按时间序）

1. **N0** 实证勘察：本 run 种子无 wheat-squad → 自兄弟 run 分支 6d59bef 窄路径移植真源/契约/黑板（判例披露：spec 落点 `.myrd/spec/wheat-squad/`（一游戏一文件），黑板 `.myrd/blackboard/wheat-squad/`（一游戏一子目录），不采任务书字面顶层路径——防撞 game-9 存量与糖果线冻结件）
2. **N1** 图谱注册：code-review-graph 全量建图 177 文件/3271 节点，锚定 commit 1652974
3. **N2** 主策划差异点三列表 6 行（对标/差异/是否需视觉可观察），逐行落 spec 条款
4. **N3** spec v1.0 入链（cmv4pqezm·v2 draft）：A1-A4 四件套条目化（fv-1..4 退役映射）+ 埋点三方同名 + entities 符号锚对齐（修 11 处）+ 总则/范式/反馈协议入 meta + 美术四条款
5. **N4** 风格卡 v1 主策划拍板开产：四要素冻结 + manifest 9 件（≤封顶 13）+ 提审素材占位模板（止步清单红线）
6. **N5** QA 四要素联审 PASS → **approve（机械合规审放行；好玩终裁仍归主人）** → v1.1 单点修订（e-settlement 锚修正，反馈接入协议首次实际执行）→ v3 approved（cmv4q8bng，链上唯一 approved）
7. **N6** 实现补全：victory 终局 + 埋点接线 + 裸 hex 收口 + 机型档 perf + 扫描框架平移——契约 13/0 + 统一门禁 53/0 + WS-SMOKE 全链路（**顺修 2 个 latent 缺陷**：CDP 盲打坐标/零持按拖拽）
8. **N7** QA 对抗审查（三输入四门禁新鲜取证）：14 条逐条对账 + 5 缺口如实列明 + 扫描清单七类防缩水确认 + 冻结计数器 0/3
9. **N8** 部署：v3 事故（漏 manifestPath，如实披露）→ v4/v5/v7 正确清单重部署；**v7 running@46cce20 资产面全等；页面路由平台层串线 W-3 升级运维**（两坑页面字节全等 abb7c87b 为决定性证据）
10. **B 线**：第三线简报落盘——放置挂机互斥排除（同 idle 轴）；候选 ≤3（跑酷/模拟经营/io 对战·高风险标注）；全部带出处
11. **N9** 游戏程序 verify-claims 独立复核（当前 HEAD）：N1–N8 全部复现成立（53/0 + 13/0 + 冒烟 + 扫描四绿）；**抓到守卫模式 2 latent 崩溃并策略单源修复**（先红后绿，脚本/规则零改动）；图谱刷到 20a1a9d · 重建与仓内 build 逐字节全等。证据 `wheat-squad/gate-logs/n9-verify-20261012/`
12. **N10** 游戏程序驳回修复：routine「游戏契约测试」FAIL 属实（默认参数指向已不存在的顶层 spec 件——routines.yaml 未随 N0 一游戏一子目录判例更新）；修复 = 参数单源对齐 wheat 线，检查器零改动；字面命令连跑 2 轮 53/0 绿 + 冒烟绿。证据 `wheat-squad/gate-logs/n10-routine-contract-fix-20261012/`
13. **N11** 同因驳回二次处置：字面 specPath 薄壳入口（`.myrd/spec/design-spec.json` 相对符号链接 → approved 单源，零拷贝零漂移，thin-proxy 判例）；规范口径连跑 2 轮 53/0 绿；`projectDir=.` 弱面 fail-closed 2 项如实披露不弱化（平台参数存量升级项 W-4）。证据 `wheat-squad/gate-logs/n11-legacy-specpath-symlink-20261012/`
14. **N12** 驳回三到案收口：v3『契约不一致』= 弱面丢契约镜像层（W-4 预判命中）；root `tests/contract` 薄壳链接（→ wheat 契约镜像）使检查器 `tests/contract` 解析位任意 projectDir 单源命中；插桩实证规范面 21 源纯 wheat 独立 53/0、弱面 27 源为合法超集（糖果线遗留 c3 命中 games/game 冻结件）非假绿；两口径各 2 轮 4/4 EXIT=0；**W-4 仓内闭环降为知情项**。证据 `wheat-squad/gate-logs/n12-root-contract-thin-entry-20261012/`
15. **N13** 受测游戏身份门禁收口（破案：平台门禁日志落点=顶层 gate-logs/，原始驳回日志在档）：新建 **wheat verify.sh**（五步真门禁薄壳，2 轮全 PASS）+ `.myrd/spec/wheat-squad-spec.json` slug 命名薄壳 + routines.yaml 陈旧 gamePath 纠正；两处守卫拦截均显式登记后转绿，冻结线零触碰。证据 `wheat-squad/gate-logs/n13-game-identity-verify-sh-20261012/`
16. **N14** 对抗审查 D1/D2 修复（先红后绿）：埋点定名 `run_duration_ms` 真达成（接线载荷键改名 + 冒烟经 telemetryEntries 直读真实载荷，弃自算）；`overrun`→`defeat` 按 approved 单源对齐；新增 **ac-14** 剥注释机判 5 键三方同名+结局势 spec 同源+placementOffline 行为锁定（D2）；14/0 + 53/0 + verify.sh 2 轮全绿；D3 措辞归策划 revision（W-5）。证据 `wheat-squad/gate-logs/n14-telemetry-naming-20261012/`

## 待主人裁决清单

| # | 事项 | 入口/载体 |
|---|---|---|
| 1 | W-3 页面路由平台层串线转发运维（证据 gate-logs/n8-deploy-20261012/01-deploy-incident.log） | 黑板 blockers.md 升级项 |
| 2 | A3 5 名试玩组织与回填（W-3 解除后；量表已备，含「重开理由原文」列） | games/wheat-squad/qa/playtest-record-template.md |
| 3 | 四件套 manual 面终裁（好玩判定归主人；本轮 3 达 1 未达，不虚报全达） | 试玩入口（W-3 解除后 = https://leomac-studio.tail49399e.ts.net/apps/wheat-squad-2/gw） |
| 4 | 第三线是否点名开题（本简报不自动触发） | .myrd/blackboard/research/line3-candidates-20261012.md |
