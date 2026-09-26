# 《光路谜阵》spec.numeric 拍板记录（tuning_applied = true）

> 拍板日期：2026-09-27。本文是 spec.numeric 的**拍板结论**（decision record）；
> 机判数据在 `qa/tuning-data.json`，逐关数值表在 `qa/spec-numeric.json`（v2），
> 拍板前的原始采集结论保留在 `qa/TUNING_NOTES.md`（数据溯源）。

## 一、平台侧权威版本（已落账）

| 项 | 值 |
|---|---|
| GameDesignSpec | v2 `cmuiwi0va00eum9l6m9r6aapt`（**approved**，parent = v1 `cmuiqdanr007pm9l6j4j3lere` 已 superseded） |
| 通道 | `POST /api/v1/game-design-specs/cmuiqdanr007pm9l6j4j3lere/revisions` → `POST /api/v1/game-design-specs/:id/approve`（平台 API 直写，绕开 goal DAG 中不被支持的 `revise_design_spec` 节点类型） |
| 目标 artifacts | 追加 `op=tuning_applied` 条目（目标卡片可见） |
| 校验 | 平台 `validateGameDesignSpec`（schemaVersion v0）通过，HTTP 201 / 200 |

`approved` 版是契约测试与下游派生的唯一取数口径：
`GET /api/v1/game-design-specs/approved?goalId=cmuieqj7o0031m9gyf4pbwptg`。

## 二、事实源（全部机器可复核，无手填）

1. **已落地实现**：`scripts/puzzle_logic.gd#min_clicks_between`（直管按 180° 等效朝向 `mod 2` 计步）+
   `scripts/levels.gd#par_of` + LEVELS L4/L5/L8 `init_rot` 微调。
2. **headless 通关采集**：`bash games/game-4/qa/collect_tuning_data.sh`（Godot 4.3 无头，
   判定全部由生产代码机判；本轮拍板前重跑，exit 0，硬契约断言全过：
   10 关可解 / 未提前通关 / 星级规则一致 / 解锁链完整 / 声明 par 非递减）。

## 三、拍板结论

### 拍板项 ①（已在工程落地）：par 口径修真

- 直管元件有 180° 对称，`par_of` 原按精确 `target_rot` 计步，8/10 关虚高（声明合计 91 步 vs 真最优 67 步）。
- 修法：`min_clicks_between` 直管改 `(target - init) mod 2`；同步微调 L4/L5/L8 `init_rot` 把 par 曲线抬回非递减。
- 结果：**par 序列 [1, 2, 8, 8, 8, 8, 10, 10, 11, 12]（合计 78 步，非递减）**，星级规则契约断言全过。

### 拍板项 ②（本轮拍板）：以已落地 par 为星级基准，BFS 残余虚高记录在案

- 3 星线 = 已落地 `par_of`；2 星带 = `⌈par × 1.5⌉`；1 星 = 通关。规则本身不变
  （`PuzzleLogic.stars_for` 机判，三档画像 × 10 关无一例失真）。
- 有界 BFS 在 3 关证实存在更短替代走法（保守上界）：

  | 关 | 名称 | 已落地 par | BFS 证实真最优 | 差 |
  |---|---|---|---|---|
  | L5 | 分光三通 | 8 | 6 | −2 |
  | L7 | 分光择路 | 10 | 9 | −1 |
  | L8 | 回环折阵 | 10 | 7 | −3 |

  其余 6 关 BFS 预算耗尽、无可断言的更短解（L1 已证 par=1 即最优）。
- **决定：本轮不改值**。理由：玩家找到更短解仍得 3 星，星级公平性不受影响；
  把 par 压到真最优需改 `target_rot` 语义并重导出重部署，收益小、风险大；
  该 3 项作为**四问量表回填后的备选微调项**记录在 `spec.numeric.bfs_optimality`。

### 逐关拍板数值（详见 qa/spec-numeric.json）

| 关 | 名称 | 网格 | 元件(直/弯/通/墙) | par | 3星 | 2星带 | BFS 真最优 |
|---|---|---|---|---|---|---|---|
| 1 | 初试光线 | 5x5 | 1/0/0/0 | 1 | 1 | 2 | 1（已证最优） |
| 2 | 三连直道 | 5x5 | 3/0/0/2 | 2 | 2 | 3 | 未证 |
| 3 | 转角初见 | 5x5 | 1/4/0/1 | 8 | 8 | 12 | 未证 |
| 4 | 绕墙而行 | 5x5 | 5/2/0/3 | 8 | 8 | 12 | 未证 |
| 5 | 分光三通 | 5x5 | 2/2/1/2 | 8 | 8 | 12 | 6 |
| 6 | 双折回廊 | 6x5 | 4/4/0/2 | 8 | 8 | 12 | 未证 |
| 7 | 分光择路 | 6x5 | 5/4/1/3 | 10 | 10 | 15 | 9 |
| 8 | 回环折阵 | 7x5 | 3/3/1/4 | 10 | 10 | 15 | 7 |
| 9 | 长蛇引光 | 7x6 | 7/3/0/4 | 11 | 11 | 17 | 未证 |
| 10 | 终局光阵 | 7x6 | 7/5/1/6 | 12 | 12 | 18 | 未证 |

机制引入：L2 墙体阻挡、L5 分光三通、L6 网格扩容(6x5)。「机制首关」与「步数梯度」解耦评价。

## 四、与用户试玩回填的关系（后续微调通道）

- 机判数值（本文 / spec.numeric）与用户主观感受**分开记录**，未回填前不代填。
- 四问量表入口：<https://leomac-studio.tail49399e.ts.net/apps/game-4/gw?tuning=1>
  （指引：`qa/PLAYTEST_KIT.md` §二；真机自检：`?qa=1`）。
- 回填后：解析结论 → 与本文件合并 →
  `POST /api/v1/game-design-specs/cmuiwi0va00eum9l6m9r6aapt/revisions`（或当时最新版）微调并重新拍板。

## 五、复现

```bash
# 1) 重跑机判采集（约 10s，Godot 无头）
bash games/game-4/qa/collect_tuning_data.sh
# 2) 取平台 approved 版核对
curl -s -H "Authorization: Bearer $MYRD_TOKEN" \
  "$PLATFORM_API_URL/api/v1/game-design-specs/approved?goalId=cmuieqj7o0031m9gyf4pbwptg"
```
