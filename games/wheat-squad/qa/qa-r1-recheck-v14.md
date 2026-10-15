# QA 复审回执 — R1 复测收口轮（QA-WS-R1RE-20261015-01）

> 日期：2026-10-15 · 审签：游戏 QA（主策划工作室代行节点）· 判定依据：spec **v1.4（链 v6 `cmv8xcexk0009m9dj6ev1dj0r` · approved）** 含 meta.retestProtocol 判读纪律
> 三份输入核验：① v1.4 生效版 = `.myrd/spec/wheat-squad/design-spec.json`（链 v6 回读，锚核零漂移）✅ ② 代码只读访问 = 工作区树 @ `813fa38`（采样断言面 ≡ 报告绑定 `7b45b44`，diff 实证）✅ ③ 绑 sha 报告+门禁输出 = `games/wheat-squad/docs/r1-recheck-report.md` + `.myrd/blackboard/wheat-squad/gate-logs/r2-recheck-20261015/00..11` ✅

## 唯一结论（JSON）

```json
{
  "receiptId": "QA-WS-R1RE-20261015-01",
  "round": "R1-复测收口轮",
  "specVersion": { "chain": "cmv8xcexk0009m9dj6ev1dj0r", "revision": 6, "metaVersion": "1.4", "status": "approved" },
  "evidenceBoundSha": {
    "samplingHead": "7b45b44072747ca17af96f81dd109b926745f3d4",
    "releaseCommit": "813fa38bf1240e1ec261806ccbc248fdbb5346f5",
    "liveDeployment": { "version": 17, "id": "cmv8xviav000em9djqh", "embeddedGitSha": "7b45b44072747ca17af96f81dd109b926745f3d4", "specAnchor": "cmv8xcexk0009m9dj6ev1dj0r@v6:approved" }
  },
  "verdict": "证据型·样本不足（A3 结论面 0/5 待真人）→ R1 维持「未判定·挂起」，不烧冻结余量",
  "routing": "非缺陷型（零数值超阈零机判红）；非全绿（A3 未判定）；冻结计数器按 baselineProtocol 不前移（A1/A2/A4 部分达标即重置 0/3）",
  "criteria": [
    { "id": "ac-a1-first-core-feedback", "state": "绿", "threshold": "≤10s / 5种子≤30s", "measured": "1.71s · 5/5", "evidence": "gate-logs/r2-recheck-20261015/05 + docs/r1-recheck-report.md#A1" },
    { "id": "ac-a2-run-duration-band", "state": "绿", "threshold": "P50∈[90,180]s · P90≤300s · victory|timeout", "measured": "P50=168.1s · P90=168.1s · victory 20/20（样本 20/20 满）", "evidence": "gate-logs/r2-recheck-20261015/06 + report#A2（模拟局口径，retestProtocol②）" },
    { "id": "ac-a3-restart-willingness", "state": "未判定·待采", "threshold": "5名≥3人自然重开≥2局且理由原文非空（结论面）+ 机制面在档", "measured": "机制面 PASS · 结论面 0/5 无真人回填", "evidence": "gate-logs/r2-recheck-20261015/08 PEND 行 + qa/playtest-collection-round1.md（0 行）" },
    { "id": "ac-a4-feedback-channels", "state": "绿", "threshold": "≤100ms · 通道≥2", "measured": "max 0ms · min 4 通道 · fx 全绑 · 帧 P95=0.002ms", "evidence": "gate-logs/r2-recheck-20261015/07 + report#A4" },
    { "id": "ac-a5-guidance-first-action", "state": "绿", "threshold": "≤5000ms 窗", "measured": "48ms", "evidence": "gate-logs/r2-recheck-20261015/08 ac-16 行" },
    { "id": "ac-a4b-restart-click-counter", "state": "绿", "threshold": "真实点击计数 1 起递增", "measured": "1→2", "evidence": "同上" },
    { "id": "配套(det/perf/tex/anchor/loop/fv-pend/art-1..4/ac-14/ac-15)", "state": "绿", "threshold": "各条款", "measured": "run-all 16 PASS / 0 FAIL / 1 PEND（PEND=A3 结论面）", "evidence": "gate-logs/r2-recheck-20261015/08·11" }
  ],
  "feedback": [
    { "ref": "spec.ac-a3-restart-willingness（结论面）", "file": "games/wheat-squad/qa/playtest-collection-round1.md", "severity": "blocking-for-verdict", "note": "记录 0/5 回填为空——判定被样本不足阻塞而非实现缺陷；采集面 = v17 LIVE（证据绑 sha），主人圈定 5 名试玩后回填复跑 ac-a3 check 转 PASS 才可升「全绿」" },
    { "ref": "spec.assets[fx-hit-shock].note（v1.3 冻结字面）", "file": "games/wheat-squad/assets/manifest.json + .myrd/blackboard/wheat-squad/style-card-v1.md §R2.0", "severity": "info", "note": "冻结 spec note 的「invuln 外圈呼吸」声称与实现不符（W-7）——已按 B 案在 repo 面（manifest v4 + 风格卡勘误）真实态化；spec 冻结字面的修订留待 R2 随 A 案决策一并走 revision，不阻塞本轮判定" },
    { "ref": "spec.meta.retestProtocol（v1.4 新增）", "file": "games/wheat-squad/tools/build.mjs + gate-logs/r2-recheck-20261015/README-deploy.md", "severity": "info", "note": "sha 绑定纪律①已落地验证：部署物内嵌 gitSha ≡ 报告绑定点（sha 对账闭环）；A2/A3 口径②已用于本判定（模拟局/真人局不混算）" },
    { "ref": "process（程序线操作缺陷，已修复）", "file": ".myrd/blackboard/wheat-squad/gate-logs/r2-recheck-20261015/README-deploy.md", "severity": "info", "note": "v16 坏部署（漏 manifestPath）已由 v17 同 commit 覆盖修复；LIVE 三点+冒烟全过，无残留影响" }
  ],
  "funCriteriaStatus": { "round": "第 1 轮（好玩判据）", "met": false, "reason": "A3 结论面缺真人证据——按 baselineProtocol 达标口径「任一 manual 项缺真人结论 = 本轮未达标」如实登记不粉饰", "freezeCounter": "0/3 维持（部分达标不计数）" },
  "humanGate": "「好不好玩」终裁与 A3 试玩组织方式归主人——机器不替人判好玩"
}
```

## 判读路径（按 v1.4 retestProtocol 逐款执行）

1. **纪律①（sha 绑定）**：复测报告绑全长 sha + LIVE 部署物内嵌同 sha → 判定可采，非「未判定·待采」。
2. **纪律②（A2/A3 不混算）**：A2 判定只取 20 模拟局机判；A3 结论面只认真人回填（0/5）——不互相抵充。
3. **纪律③（连击）**：A1/A2/A4 上轮绿本轮绿（无连红，无查判据触发）；A3 为「未判定」不计红；冻结计数器沿 baselineProtocol 单源 = 0/3 维持。
4. **分流**：证据型 → R1 维持「未判定·挂起」；采集窗继续开启（v17 LIVE 为采集字节）。
