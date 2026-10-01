# 阻塞项黑板 — 《田园小院》

> 维护人：主策划 ｜ 规则：阻塞超过一轮解决不了 → 升级给主人，不空转

| id | 阻塞 | 影响 | 责任方 | 状态 |
|---|---|---|---|---|
| B1 | 前序「实现玩法」节点（产物 id `cmuiew3uo000tm9gc3cto2h1t`）**代码未 git 落盘**：`games/farm-yard/` 仅剩 `.godot` 导入缓存，无任何源码/场景/资产源文件 | 后续契约测试、QA 互查、试玩验收均无对象可测 | 实现玩法（需按 spec v1 重新落码并 commit 到功能线分支） | 🔴 未解（本轮升级） |
| B2 | 契约测试脚本 `scripts/contract-check.mjs` 在仓库中不存在，routine `game-contract`（`.myrd/routines.yaml`）引用了它 | 策划案一致性无法机判 | QA 互查 / 平台方 | 🟡 未解（spec v1 已就位，脚本一到即可跑） |
| B3 | 策划案最新 draft（**v2.0.0**，平台版本链 v3，id `cmupqpslc000zm9dhrojujz5u`，parent=v1 链）处于 **draft 待拍板**，尚无 approved 版；v1（`cmulah8f5002im9lfnzx1ycx7`）已 superseded | 契约测试与实现只认 approved 版；B1 重做应按 **v2**（画面品质 A1~A5 + 玩法深度 B1~B3 P0）执行 | **主人（人工拍板，机器不代行）** | 🟡 等 owner |

## 已解除

| id | 阻塞 | 解除方式 |
|---|---|---|
| — | `create_design_spec` 节点不受支持（3 次 failed） | 改由主策划 agent 产出：接口创建 v1（id `cmulah8f5002im9lfnzx1ycx7`）+ 仓库文档/机读件落盘 ✅ |

## 升级话术（给主人）

策划案已升级到 **v2.0.0**（平台链 v3，id `cmupqpslc000zm9dhrojujz5u`；文档 `docs/games/farm-yard/design-spec-v2.md`），内容 = owner 两条硬意见的规格化：**范围A 画面品质**（物件放大 1.5~2 倍 + 热区 ≥88px、消空白纯色块、m1~m12 动效清单、暖色手绘质感、桌面自适应 + 移动端缩放）+ **范围B 玩法深度**（B1 自动化帮工 / B2 一键订单生产链 / B3 划动批量操作 = P0 硬性必交付；B4 动物互动 / B5 休闲天地轻玩法 = P1 尽力项），新增验收 ac6~ac12，v1 经济数值只增不改。

需要您做两件事：① 在平台上对 **v2 draft（id `cmupqpslc000zm9dhrojujz5u`）拍板 approve**；② 对 B1 拍板——实现产物丢了，是让实现节点按 v2 重做，还是放弃该实现。
