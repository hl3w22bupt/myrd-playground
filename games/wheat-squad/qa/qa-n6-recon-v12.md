# QA 互查回执 — spec v1.2 轮（QA-WS-N6-20261013-01）

> 互查人：游戏 QA（主策划工作室内代行节点，产物独立落盘）· 日期：2026-10-13
> **四件同包（同一 HEAD sha 绑定）**：
> ① approved spec revision = 链 **v4 `cmv60scie003hm9qqu91foe7v`**（approved 唯一，v1..v3 superseded，导出件 `.myrd/spec/wheat-squad/design-spec.json` --expect-version 4，链上内容≡payload 深比 True）
> ② 实现 = **HEAD `c4348e1`**（树净：verify.sh 自检含 committed-check 通过）
> ③ 契约输出 = `gate-logs/n0-rebaseline-20261013/08`（入链后统一 56/0 + 自有 16/0/1PEND）+ `10`（HEAD 树净 verify.sh 五步全 PASS VERIFY_EXIT=0）
> ④ 冒烟输出 = `gate-logs/n0-rebaseline-20261013/09`（入链后 WS-SMOKE PASS 四事件）+ `10` 内 ③ 步
> sha 不符不审：①..④ 全部绑 `c4348e1` ✅

## 按序互查（任务书五线）

### 1. A1–A5 可判定性 — ✅ 通过

| 条款 | mode | 机判证据 |
|---|---|---|
| ac-a1 | auto | ac-02 PASS（首反馈 1.71s ≤10s · 5 种子首杀 ≤30s · 回归预算保持） |
| ac-a2 | auto | ac-03 PASS（20 种子 P50=168.096s ∈[90,180] · P90 ≤300 · victory 20/20）+ duration-log 落档 |
| ac-a3 | manual+auto | ac-04 机制面 PASS（重开 0ms 全复位 + 三信息 + 量表 schema）· 结论面 PEND 0/5 如实（run-all 三态 ALL_GREEN=false 口径） |
| ac-a4 | auto | ac-05 PASS（延迟 0ms ≤100ms · 通道 min=4 ≥2 · flash=90ms） |
| **ac-a5（新）** | auto | ac-16 PASS（hint_shown@0ms + first_core_action_at 差 2.6s ≤5000ms 窗）+ 冒烟四事件行（first_tap@2624ms 窗内） |
| **ac-a4b（新）** | auto | ac-16⑤ PASS（count 1→2 递增）+ 冒烟真实 pointerdown 后 restart_clicked×1 count=1 |

### 2. entities/levels 账实 — ✅ 通过

- ac-08 机判：entities 13/13 + levels 2/2 落点在盘非空。
- 逐条锚对齐 `inventory-line2.md`「spec 实体锚」列（13 锚核对，e-telemetry=game.ts#telemetry 含遥测结构化 9 键升级）。
- spec assets 2 件（style-card-v0 + guidance-hint-banner）与工程 manifest v2（10 件）双落点一致（ac-art-2 机判绿）。

### 3. 断言↔验收对应 — ✅ 通过

- 16 条 acceptance.check 全部 `checks/<acceptance-id>.mjs`，薄壳由 `build-checks-shims.mjs` 从 spec 单源生成，**SHIM_MAP↔spec 完全一致守卫**（fail-closed：对 v3 跑即红的红证据在案）。
- 薄壳零断言复制（真实转发实体件 / loop-1 spawn 冒烟 exit 透传）——无「第二份断言」漂移面。
- 统一门禁 56/0：16 条依赖存在全 PASS（新 check 路径形态兼容实证）。

### 4. 核心循环可复现路径 — ✅ 通过

- 打开→拖动（first_core_action_at）→击杀（first_kill）→拾取→升级（first_loop_complete）→波次爬升→victory 结算（run_duration_ms）→重开（restart_clicked）：冒烟全程真实事件驱动（CDP Input 事件，非旁路改状态），victory 167s 与上轮零漂移。
- det-1 同 seed 双局逐字节一致（确定性总闸）；duration-log 20 种子全 victory。

### 5. 首分钟引导 — ✅ 通过

- hint_shown@0ms（首局 running 起始）→ first_core_action_at@2624ms：**2624ms ≤ 5000ms 窗（ac-a5 达）**。
- 引导浮层 4s 窗渲染（drawGuidance）+ 文案三方同名（GUIDANCE_TEXT ≡ spec assets.copy ≡ manifest.copy「拖动队长移动 · 队员自动作战」）。
- 视觉权重规则定稿入参考卡（style-card-v1 §v1.2），禁 accentRed 纪律在卡。

## 结论与放行

**互查通过（RECON-PASS），放行 deploy**。随件披露：
1. PEND 1 件（ac-a3 结论面 0/5 待真人）——ALL_GREEN=false 口径在 run-all 输出明示，不虚报全绿。
2. Q-1 已知缺陷（offerIfNeeded 旁路，上轮既有）不阻塞本版（行为面沿 approved 实测），升级项在黑板。
3. checks/ 薄壳窗口纪律执行到位（入链后生成 → 门禁复跑后才 commit，窗口内零部署）。
