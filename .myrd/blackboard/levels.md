# 关卡状态黑板 — 《田园小院》

> 维护人：主策划 ｜ 关联 spec：`.myrd/spec/design-spec.json`（平台 id `cmulah8f5002im9lfnzx1ycx7`，v1，待拍板）

| 关卡/区域 | 落点 | spec 依据 | 状态 |
|---|---|---|---|
| l1 主庭院 | `games/farm-yard/scenes/main.tscn` | levels[0] | ⬜ 待实现（前序实现节点产物未落盘，见 blockers B1） |
| l2 首个闭环引导 | `games/farm-yard/scenes/main.tscn`（引导态） | levels[1] | ⬜ 待实现 |
| z1 菜园（4→16 格） | `scripts/plot.gd` + `scripts/crop.gd` | world.zones[0] | ⬜ 待实现 |
| z2 果园（2→4 株） | `scripts/orchard_tree.gd` | world.zones[1] | ⬜ 待实现 |
| z3 禽舍（3→8 鸡位） | `scripts/coop.gd` | world.zones[2] | ⬜ 待实现 |
| z4 小花园（2→8 格） | `scripts/flower_bed.gd` | world.zones[3] | ⬜ 待实现 |
| z5 休闲天地（3 设施） | `scripts/leisure_facility.gd` | world.zones[4] | ⬜ 待实现 |
| z6 工坊小屋（附属位） | `scripts/workshop.gd` | world.zones[5] | ⬜ 待实现 |
| HUD | `scenes/hud.tscn` | entities[e14] | ⬜ 待实现 |
| 任务五阶段 q1~q5 | `scripts/quest_manager.gd` | world.quests | ⬜ 待实现 |

状态图例：⬜ 待实现 ｜ 🔨 实现中 ｜ ✅ 已实现并通过冒烟 ｜ ✅✅ 契约测试通过
