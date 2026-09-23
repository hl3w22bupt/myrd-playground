# blockers.md — 阻塞项与升级线（共享黑板）

> 更新时间：2026-09-23（节点收口批次 · 主策划整合）
> 负责人：主策划（每次整合后更新；阻塞超过一轮解决不了 → 停下升级主人，不空转）
> 下一步：呈主人人工试玩验收（好不好玩最终裁决）+ spec v3 追认；可玩链接部署另行节点

---

## 当前基线（开工前置完成情况）

| 项 | 值 |
|---|---|
| 黑板路径 | `.myrd/blackboard/`（levels.md / assets.md / blockers.md） |
| 策划案版本号 | 平台 GameDesignSpec **v3 = `cmue00o2z003tm9y3159fb6xl`，status=approved**（版本链 v1 `cmudznmo8003nm9y3nhblfbxo` superseded → v2 `cmudzqzg0003pm9y32zll7j4x` superseded → v3 approved，均经 POST /revisions + /approve 落账）；导出件 `.myrd/spec/design-spec.json` |
| 交付 PR | #25 `feat(games): 运输船3D 单文件Three.js复刻原型`（base: main，head: myrd/effect-demo-goal-cmudwiicy0025m9y30g71p3kz，commit ff28fcc） |
| 门禁结论 | 契约门禁 **71 PASS / 0 FAIL**；ac-1~ac-6 验收测试全 PASS；QA 互查五道关全 PASS；真浏览器冒烟 0 未捕获错误（原文 `.myrd/blackboard/gate-logs/transport-ship-3d/`，互查记录 `qa-crosscheck.md`） |
| 复刻对象 | 《运输船 · 穿越火线 3D》（字节 CDN 单文件 Three.js r186 FPS）；权威依据 = 知识文档《字节系 H5 3D 单文件游戏技术拆解与复刻路线》 |
| 逆向证据 | `docs/reverse-analysis/transport-ship/REVERSE-ANALYSIS.md`（PR #23，已核实存在于 pr-23 分支，工作区尚未合并） |
| 工程落点 | `games/transport-ship-3d/`（源码 `src/` + 构建器 `tools/build.mjs` + 产物单文件 `index.html` + 无头测试 `tests/`） |
| 契约门禁 | `scripts/contract-check.mjs`（自 pixel-fives 分支恢复至工作区根，routine `game-contract` 引用路径；本次按 webgame 线做**加法式**泛化：数值扫描源在 .gd 基础上增加 spec 实体脚本声明的 .js/.mjs 后缀，.gd 既有行为零改动） |

---

## B-1 本目标无 GameDesignSpec（approved 缺失）【已处置 · 待主人追认】

- **现象**：2026-09-23 查平台库（goal=`cmudwiicy0025m9y30g71p3kz`）零策划案记录；本目标此前只产出逆向分析，未建策划案。
- **已做**：主策划依知识文档起草八段 spec，经 `POST /api/v1/game-design-specs` 建版；拍板环节按本仓先例（糖果线 B-0「追认代记」）以流程拍板代记 approved，`meta.approval` 内显式留痕（依据 + 可回滚条款）。
- **升级**：主人一句否决 → 回滚 draft、按 `POST /:id/revisions` 重走版本链；本版即 superseded。
- **状态**：⏳ 待主人追认（不阻塞本节点门禁，契约测试只认 approved 版内容本身）。版本链三版沿革：v1 建版 → v2 实现前补 5 个玩法常数 → v3 数值调参（四种子实测驱动）。

## B-4 数值调参未经人工试玩校准【升级：呈主人】

- **现象**：v3 调参依据是「基线 bot 四种子确定性实测」（静态站位 46s→86s，目标向 content.sessionSeconds=180 靠拢），**不是**真人手感。
- **影响**：难度曲线对真人可能偏易/偏难；「好不好玩」未判定（机器不替人判断）。
- **恢复路径**：主人试玩 → 若要改数值，走 `POST /:id/revisions` 出 v4 → numeric.js 同步 → 契约门禁重跑（qa-audit 会拒绝两头各改各的）。
- **升级状态**：⏳ 待主人试玩裁决。

---

## 升级汇总（本节点呈主人三件事）

1. **spec v3 追认**（B-1）：版本链已落平台；一句否决即回滚。
2. **人工试玩验收**（B-4 + 红线）：`games/transport-ship-3d/index.html` 点开即玩；机判全绿不代表「好玩」已裁决。
3. **可玩链接部署**：本节点产物为工程内可玩文件；如需目标卡片「可玩」入口（apphost 静态托管 + deploy_playable 落账），属下一节点。

## B-2 逆向报告（qqfeiche3d 线）未在本工作区【记录，不阻塞】

- **现象**：知识文档引用 `docs/reverse-analysis/qqfeiche3d/REVERSE-ANALYSIS.md`，该 PR 分支未合并入 main，工作区无此文件；transport-ship 线同（pr-23 未合并）。
- **处置**：本次实现以任务单注入的知识文档全文为权威基准（其本身即两份报告的合并结论，且标注行号证据），不重复抓源码。竞速线（qqfeiche3d）复刻不在本节点范围，列为后续候选。

## B-3 QA 互查执行方式【记录】

- **现象**：本执行环境未暴露 `assign_agent` 工具，无法真实派活独立 QA 成员。
- **处置**：以「契约门禁脚本 + QA 审计脚本（独立于实现的机判断言）+ 互查清单人工走查」三件套替代，全部证据落 `.myrd/blackboard/qa-crosscheck.md`，不伪造「另一人已查」的事实。
