# playtest 第三轮独立复跑 —— PASS（主策划复核节点 · 2026-10-07）

- 复跑人/角色：主策划（goal cmuw2o88z018ricryvpr6v8wn 第三轮线上版复核）
- 被测代码：部署分支 `myrd/games-goal-cmuw2o88z018ricryvpr6v8wn` @ tip `0a45faa`
  （游戏代码与线上 AppHost v5 `cmuwqrrl70051m9lgj8v89gh9` 部署的 `2626927` 为同一文件，
  pck/js sha256 逐字节一致，见 `../ACCEPTANCE_REVIEW_ROUND3.md` §一）
- 方式：`games/game-9/verify.sh`（仓库自带判定器，零改动）；Godot v4.3.stable
- 结果：**PREFLIGHT PASS（14 类）+ GODOT_SMOKE PASS（240 帧）+ GODOT_FUZZ PASS
  （6 批 239 帧）+ GODOT_PLAYTEST: PASS（3 × 900 帧）→ verify: PASS**

## 与 round2 归档的一致性（确定性复现实证）

| 指标 | round2 归档（qa/playtest-round2/report.log） | 本轮复跑（verify-full-run.log） |
| --- | --- | --- |
| feedback_events（3 局） | 75 / 80 / 76 | **75 / 80 / 76（逐字一致）** |
| first_reward_seconds | 0.067 / 0.267 / 0.017 | 0.067 / 0.267 / 0.017 |
| max_feedback_gap_seconds | 1.317 / 1.167 / 0.950 | 1.317 / 1.167 / 0.950 |
| 阈值来源 | tests/playtest.json | tests/playtest.json |

同种子同事件流下指标完全复现 → GODOT_PLAYTEST: PASS 证据链跨轨迹可信。

## 文件

- `verify-full-run.log`：四门禁完整 stdout（含 GODOT_PLAYTEST_METRICS 单行 JSON）
- 移动端独立复跑证据：`../mobile-round6/`（report.json PASS 10/10 + 三张截图 + smoke-run.log）
