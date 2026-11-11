# 打磨轮收口记录：polish 节点 round-14~17（polish-v16-closeout，2026-11-11）

- 分支：`myrd/myrdplaygrou-3-goal-cmwaqvrng002lm9m2nftdd20h`；HEAD=94a6648；**v16=cmwc5dhrd0031m9bh58t9v2s1** running @ 94a6648（线上 607,064B 与 dist/web/index.html 逐字节一致，sha16=97adfc85）
- 本节点 run：cmwbusk2s0019m9bbvj1h07sq（implement/deploy/playtest 由前序重跑轮完成 v14 收口；本节点为 polish 打磨轮）

## ① 上轮 stalled run 处置（任务步骤 1）

- GET /api/v1/workflows/runs/cmwbl6h6e008am97aetlijmmv → **status=completed**（completedAt=2026-11-11T08:16:52.513Z）→ 免 cancel，无双 run 并飞（与 implement/deploy/playtest 重跑轮结论一致）。
- 本 run 节点态：scaffold/implement/deploy/playtest=completed（重跑轮完成）→ 本会话执行 polish 节点。

## ② 具名改进点与改动（三轮 改→玩→看）

- **IP-P1 切换抖振稳定化**（world.js）：线上 v14 基线实锤 switchCount=82/44.4s → 受控人切换三分支化（持球离散事件/飞行窗冻结/迟滞重算，复用 CONTROL_RADIUS 零新增数值）→ 线上 19/40.6s（-75%）。契约 +5 用例。
- **IP-P3 客队出手通道**（world.js）：5 种子逐队统计客队 0 射门 → 小禁区起脚门槛 distPress 1.2→0.5（远射 1.8 保留）→ 契约双断言钉死。契约 +2 用例。
- **IP-P5 冒烟证据面**（main.js）：v15 后 ?smoke=69 取证面 0:0 回归归因（1Hz 意图失养）→ 意图粒度 1s→0.1s → v16 线上进球庆祝恢复在链。
- **IP-P4 中场胶水**：登记不动（spec.numeric 域，spec 修订通道候选，待用户打分卡回填）。

## ③ 收尾门禁（全部实跑）

- tests/run-all 7/7 PASS（football-contract 含本轮 +8 用例）；preflight PASS 0 WARN；asset-triple-check PASS；browser-smoke 双视口 PASS（14.4/13.3 fps）；线上 mobile-web-smoke PASS。
- playtest-summary：rounds=17/screenshots=50/actions=86/consoleErrors=0/versionSha=94a6648 → **FAIL 唯一 C4**（平台级 schema 漂移，两判定器红线禁改；本轮修齐 C2 全部 13 条格式缺口，round-13 补协议壳原文逐字保留）。
- visual-ratchet（advisory）OK：polish-cycle-v14-to-v16 同序列步 2 对 0 回归（sim 0.8438/0.75）。

## ④ 环境事故留痕（如实）

- 宿主 jetsam per-process-limit 杀 headless Chrome renderer → 3 次 CDP 会话中断（CDP 会话已关闭），重启续跑完成，无证据缺口。
- 截图 tmp 回收失误 2 处（r14 首轮 / r15 本地轮），round-14/15 如实记录；基线证据以同构建同序列线上复跑（r14b）重建，非补拍伪造。
- world-old-tmp.js 调试残留误入库 → 94a6648 清理并重建产物（7/7 复跑绿）。

## ⑤ artifacts 回写（PATCH 合并，GET 复核）

- hosted_app（op=run_workflow 更新）：HostedApp id=cmwaqvrnc002jm9m2nqwfsoie；deployment id=cmwc5dhrd0031m9bh58t9v2s1（v16）；liveUrl=https://leomac-studio.tail49399e.ts.net/apps/myrdplaygrou-3/
- polish_record（round-14~17 汇总）+ playtest_summary（ADVISORY 单行 JSON，C4 如实归因）
