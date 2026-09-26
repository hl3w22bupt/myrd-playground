# QA 轮次记录 · GameDesignSpec 新 revision 落库与数值一致性核验（2026-09-27 第 6 轮，只读）

## 结论（TL;DR）

**核验通过。** `revise_design_spec` 编排通道 3 次失败后，由游戏策划经 GameDesignSpec
revisions 通道追加的新版本**确已落库**，且 `spec.numeric` 与 `games/game-2/qa/` 的
WebKit 线上实测结论 **17 键逐项一致、零偏差**：

- **新 revision id = `cmuirbfs8009ym9l64y4ybqw2`**（version 2，status=draft，
  parentSpecId=cmuinva4t002xm9l6bwjcnyy6，createdAt=2026-09-26T19:02:34.664Z）
- 旧版 v1 `cmuinva4t002xm9l6bwjcnyy6` 已自动置 **superseded**（updatedAt 同一时刻）
- goal artifacts 含对应条目（artifactId=新 revision id），detail 以 **`op=tuning_applied`** 开头

## 核验证据（全部为平台 API / 仓库只读实测）

```
GET /api/v1/game-design-specs/cmuinva4t002xm9l6bwjcnyy6 → v1, status=superseded
GET /api/v1/game-design-specs/cmuirbfs8009ym9l64y4ybqw2 → v2, status=draft, 17 键 numeric
GET /api/v1/goals/cmuiepudc001zm9gyyzqgztta             → artifacts 条目含 op=tuning_applied 全文
```

### 1. op 与变更说明（artifacts 条目 detail 实测全文要点）

- **op=tuning_applied** ✅（detail 首句即「op=tuning_applied：把 WebKit 线上实测…固化进 spec.numeric」）
- **来源** ✅：明确「来源=WebKit 线上实测（liveUrl `?tuning=1` 调参工作台）」，并附证据链
  v8 独立复核全通过 → v9 线上=HEAD（pck 逐字节一致 sha256=4434bed1…）→ a9b4e2e 数值对齐后
  终态重导出部署 v10（线上=HEAD）→ 红队终态对抗验收通过
- **qa/ commit** ✅：`a9b4e2e97d452f7fc2ef3cc1c5ae22ab90b302f5`
  （games/game-2/qa/ 最后变更提交，含 measured-evidence.md / real-device-pending.md 实测记录）
- **不伪造声明** ✅：如实注明 playtest 四问量表因模板缺 `playtest.sh` 全程 blocked、无真人量表回填，
  本修订数值全部取自线上实测通过的 cfg 默认值，未引入未实测新数值

### 2. spec.numeric v2 逐项 diff（v1 → v2，程序化比对）

| 类别 | 键 | 值 | 与 qa/ WebKit 实测基准 |
|---|---|---|---|
| 未变 ×15 | asteroid_speed_max | 110 | 一致 |
| | asteroid_speed_min | 40 | 一致 |
| | damage_per_hit | 1 | 一致 |
| | difficulty_asteroids_cap | 10 | 一致 |
| | difficulty_asteroids_per_level | 1 | 一致 |
| | difficulty_speed_cap_scale | 2 | 一致 |
| | difficulty_speed_per_level | 0.12 | 一致（a9b4e2e 由 0.15 对齐） |
| | difficulty_step | 8 | 一致 |
| | initial_shield | 3 | 一致（需求口径） |
| | invincibility_seconds | 0.8 | 一致 |
| | max_asteroids | 5 | 一致 |
| | max_crystals | 6 | 一致 |
| | player_speed | 240 | 一致 |
| | respawn_delay_seconds | 1.5 | 一致 |
| | score_per_crystal | 1 | 一致（需求口径 +1） |
| 新增 ×2 | **score_target** | 20 | 一致（补录面板实测键） |
| | **milestone_step** | 10 | 一致（补录面板实测键） |

- **修改项：无**（15 键采纳值与 v1 完全相同，无静默改数）
- `meta.tunableKeys` 12 → 17 键：新增 difficulty_speed_per_level、difficulty_speed_cap_scale、
  score_target、milestone_step、invincibility_seconds（对齐面板实际暴露的全部滑杆）

### 3. 一致性的四个独立来源交叉比对（17 键全等）

| 来源 | 键数 | 与 spec.numeric v2 |
|---|---|---|
| 平台 spec v2 `cmuirbfs8009ym9l64y4ybqw2` | 17 | 基准 |
| `games/game-2/config/gameplay.cfg`（HEAD=890a634） | 17 | 逐键相等 ✅ |
| `games/game-2/autoload/game_config.gd` 内置默认 | 17 | 逐键相等 ✅ |
| `games/game-2/qa/real-device-pending.md` §三「当前值」列（面板 17 键滑杆基准） | 17 | 逐键相等 ✅ |
| `games/game-2/qa/round-20260927-tuning-applied-revision.md` 记录的 v2 采纳值 | 17 | 逐键相等 ✅ |

面板滑杆量程另与 `tuning_panel.gd` `KEY_RANGES` 17 键一致（qa 文档「量程」列 = KEY_RANGES）。

## 边界声明（如实）

- v2 当前 status=**draft**，尚未 approve；按 spec `meta.writebackProtocol`，拍板动作
  （`POST /api/v1/game-design-specs/:id/approve`）留给上级决策，本核验不代行。
- playtest 真人量表缺口维持已录 Bug `cmuimz29u0014m9l6t0cp1hpt`，交平台运维补模板。
- 线上健康实测：`GET /apps/game-2/gw/health` → `{"ok":true,…}`；`/?tuning=1` → HTTP 308（跟随即 200，
  与既有轮次记录一致）。
