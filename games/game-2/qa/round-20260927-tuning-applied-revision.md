# QA 轮次记录 · tuning_applied 回写 GameDesignSpec 成功（2026-09-27 第 5 轮）

## 结论（TL;DR）

编排层 `revise_design_spec` 操作类型未支持（3 次失败：「未支持的操作类型」），本轮改由游戏策划
**直接调用 GameDesignSpec revisions 通道**完成同一意图，**成功**：

- **新 revision id = `cmuirbfs8009ym9l64y4ybqw2`**（version 2，status=draft，parentSpecId=cmuinva4t002xm9l6bwjcnyy6）
- 旧版 v1 `cmuinva4t002xm9l6bwjcnyy6` 自动置 **superseded**
- goal artifacts 新增条目（artifactId=新 revision id，detail=变更说明全文）

## 调用明细

```
POST /api/v1/game-design-specs/cmuinva4t002xm9l6bwjcnyy6/revisions
body: { op: "tuning_applied", spec: { meta, numeric, acceptance }, detail: <变更说明> }
→ 201（首次 422：spec 内不允许 schemaVersion 字段，移除后通过）
```

- 变更说明（detail）已由平台持久化到 goal artifacts 条目，注明来源=WebKit 线上实测
  （liveUrl `?tuning=1` 调参工作台；v8 独立复核全通过 + v9 线上=HEAD pck 逐字节一致 + 终态 v10 线上=HEAD a9b4e2e + 红队终态对抗验收通过），
  并附 qa/ 取证 commit hash = `a9b4e2e97d452f7fc2ef3cc1c5ae22ab90b302f5`。

## spec.numeric v2 采纳值（17 键，逐项）

15 键与 v1 一致（即线上实测通过的 `config/gameplay.cfg@a9b4e2e`，a9b4e2e 已把实现数值对齐 spec）：
asteroid_speed_max=110、asteroid_speed_min=40、damage_per_hit=1、difficulty_asteroids_cap=10、
difficulty_asteroids_per_level=1、difficulty_speed_cap_scale=2、difficulty_speed_per_level=0.12、
difficulty_step=8、initial_shield=3、invincibility_seconds=0.8、max_asteroids=5、max_crystals=6、
player_speed=240、respawn_delay_seconds=1.5、score_per_crystal=1。

修订项=补录 spec.numeric 此前缺失的 2 个面板实测键：**score_target=20、milestone_step=10**
（TUNING_META 17 键滑杆在线上 `?tuning=1` 实测确认）；meta.tunableKeys 同步由 12 键对齐为 17 键。

## 边界声明（不伪造）

- playtest 四问量表因模板缺 `playtest.sh` 全程 blocked，**无真人量表回填**；本修订数值全部取自
  线上实测通过的 cfg 默认值，未引入任何未实测的新数值。
- `playtest.sh` 模板缺口维持已录 Bug（`cmuimz29u0014m9l6t0cp1hpt`）交平台运维跟进，未现场自造判定器。
- v2 现为 draft，待上级拍板（`POST /api/v1/game-design-specs/:id/approve`）后生效为 approved 版。
