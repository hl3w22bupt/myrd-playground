# qa-crosscheck.md — QA 互查记录（transport-ship-3d）

> 更新时间：2026-09-23 · 门禁侧补跑批次（c083db7 开火链路落地后对游戏工程提交重跑全套门禁）
> 执行方式说明：本执行环境未暴露 `assign_agent` 工具，无法派活独立 QA 成员（见 blockers.md B-3）。
> 互查以「**独立机判脚本（qa-audit.mjs，实现侧不可绕过）+ 第二遍交叉走查（对照 spec 逐条核对实现）**」替代，
> 全部证据为可复现命令与原文日志，不伪造「另一人已查」。
> 下一步：主人人工试玩验收（好不好玩最终裁决）——机判全绿不代表验收通过。

---

## 一、互查发现与处置（第二遍走查实际抓到的问题）

| # | 发现 | 严重度 | 处置 | 复现/证据 |
|---|---|---|---|---|
| Q1 | 关卡数据缺陷：spawn-north 出生点落在舰桥掩体 AABB 内 → 敌兵出生即在遮挡里，永不可命中（对轴射击 172 发 0 命中） | P0 | 出生点移出掩体（z=-24→-21.5），舰桥盒缩短（maxZ -22→-24） | kernel 冒烟：修复后同轴射击立刻出命中 |
| Q2 | 玩家移动绕过碰撞（loop.js 直接写 x/z，没走 moveWithCollision）→ 玩家可穿掩体/出围栏 | P0 | 改走 moveWithCollision（掩体滑移 + bounds 钳制） | ac-2 快照含 px/pz；围栏钳制由 clampToDeck 断言 |
| Q3 | 数值过载：四种子一致的基线 bot 第 3 波 ~46s 阵亡，达不到 content.sessionSeconds=180 节奏目标 | P1 | 走版本链调参（v3）：敌压下调 + 波休 6→8s + 清波回血 WAVE_CLEAR_HEAL=35 | 复跑四种子：46s→86s（静态 bot），移动玩家余量充足 |
| Q4 | tick 口径混用：combat.js 里硬编码 `0.016666666666666666` 换算，未走 FIXED_STEP | P2 | 统一 TICKS() 助手 | qa-audit 数值键扫描 + 代码评审 |
| Q5 | 弹匣打空不自动换弹（要等下一次死扣扳机） | P2 | tryFire 内 ammo==0 当 tick 触发 startReload | combat.spec「换弹时长/备弹记账」三条转绿 |
| Q6 | 冒烟模式空意图把玩家 yaw 归零 → 截图朝向错误（差点误判成相机数学 bug） | P2 | smoke 意图携带 PLAYER_START.yaw | 截图对比：舰桥入画 |
| Q7 | 逆光导致甲板死黑、天空橙色过溢、枪模比例偏大 | P2 | 曝光 0.75→0.95、半球光抬升 + 相机侧补光、天空渐变收窄、枪模 0.8x + 位姿修正 | smoke-frame.png（黑板 gate-logs） |
| Q8 | 测试侧两类自伤：①kernel-determinism 用「每 tick 不同意图」去比「单帧单意图」（实验不等价）；②wave.spec 把 ticks 当 seconds 传 fastForward（479s≠479tick），且清波前提没含「出兵完毕」 | P2 | 修正测试设计；kernel 行为经独立复跑证实无缺陷 | 全套复跑 0 FAIL |

## 二、互查基线（机判门禁，全部可复现）

> 基线锚定：**游戏工程提交 = `368d242`**（美术批三：低血量暗角 + 阵亡灰度 + 阴影口径修正，产物重建 SRC_SHA=`ee80886c8f6fd33a`），
> 实跑时间 2026-09-23 22:59，原文 `gate-logs/transport-ship-3d/full-suite-225944-head-368d242.log`
> （契约 71 PASS / 0 FAIL + ac-1~ac-4、ac-6 全 PASS + smoke 8 断言全 PASS 含 `?fire=` 开火链路 shotsFired=17）。
> 沿革：22:18 补跑锚定 043e8ab（驳回点③④修复，未提交）→ 22:20 终验 56a6d58 → c083db7 22:41 补跑 → 368d242 22:59 补跑，即本表。
> 纪律：**任何游戏工程提交（src/ assets/ tools/ tests/ index.html）之后必须补跑全套门禁并落盘，否则本表视为失效。**

### 互查基线增量（2026-09-24 部署就绪批次 · 锚定 c3ad2cb，原文 `full-suite-004131-head-c3ad2cb-apphost-prep.log`）

本批**游戏本体零改动**（src/ assets/ index.template.html 未动），改动只在部署链路：
①`tools/build.mjs` 增加同批次写出 `export/web/index.html`（AppHost assets_dir 产物）；②`apphost.toml` 由糖果模板改为本游戏；③壳 `server/src/game-page.ts` 改为伺服单文件游戏；④`tests/qa-audit.mjs` 增第⑥关（五道关 → 六道关）；⑤新增壳门禁 `server/tools/verify-local.sh`。实跑结果：
契约 71 PASS / 0 FAIL + ac 五套 exit 0 + smoke 8 断言全 PASS（shotsFired=17 开火链路照旧）+ 壳端到端 7 断言全 PASS（`/` 响应体与游戏产物**逐字节一致**）。
互查动作：qa-audit ⑥ **正/负向双向验证**（一致 → PASS；向导出拷贝追加 1 字节 → FAIL(exit 1)；重建 → PASS），`/health` 不依赖资产就绪单独验证（未配置资产 env 时 503 诊断页 + health 200）。
自纠缺陷一笔：⑥ 关初版用 `===` 比较 Buffer（恒 false，正例也 FAIL），门禁落盘前抓出改为 `.equals()` 内容比较——教训：**Buffer 比较必须看内容，先跑正例再跑负例**。

| 门禁 | 命令 | 结果（@c083db7） |
|---|---|---|
| 契约门禁 | `node scripts/contract-check.mjs --spec .myrd/spec/design-spec.json --project .` | **71 PASS / 0 FAIL**（exit 0） |
| ac-1 单文件 | `node games/transport-ship-3d/tests/singlefile.contract.mjs` | PASS（零外链/零 CDN/three 内联） |
| ac-2 确定性 | `node games/transport-ship-3d/tests/kernel-determinism.spec.mjs` | PASS（2441+2700 tick 逐字段一致、大 dt 钳制等价、fastForward 等价） |
| ac-3 武器数值 | `node games/transport-ship-3d/tests/combat.spec.mjs` | PASS（射速/弹匣/换弹/伤害/爆头/得分/承伤口径） |
| ac-4 波次 | `node games/transport-ship-3d/tests/wave.spec.mjs` | PASS（规模公式/封顶/轮转/休整/清波奖励与回血） |
| ac-6 QA 审计 | `node games/transport-ship-3d/tests/qa-audit.mjs` | PASS（内核纯净 / 数值 41 键双向零偏差 / HUD 16 id / 产物 SRC_SHA 同步〔stamp=8c562f1d… ↔ 指纹范围 src + assets + index.template.html + tools/build.mjs + tools/src-sha.mjs〕/ 元素编号 11 个**双向集合相等**） |
| 真浏览器冒烟 | `node games/transport-ship-3d/tools/smoke.mjs`（headless Chrome + SwiftShader，CDP） | 8 断言全 PASS、exit 0：打开出结果 / 渲染出画（drawCalls 9·triangles 2700）/ 循环推进 / **开火链路（?fire= → shotsFired=17，shotsHit=0）** / gameover / replayHooks 落账 / 重载回显 / **0 未捕获异常**（截图仅可选存证，不计入断言） |

门禁侧修复记录（驳回点③④，56a6d58 已确认修复到位）：SRC_SHA 指纹算法收口到 `tools/src-sha.mjs`（构建器与审计共用同一模块）；
`qa-audit ⑤` 增加 code→spec 方向断言，负向验证：美术批 1e61157 的 13 编号实现会被打回（私加 container-a-2/container-b-2），
收敛后 11 ↔ 11 相等。关卡收敛口径：同一 spec 元素多体块时，后续体块只带 `group` 指回元素编号，不另造编号。

fire 链路取证口径（c083db7 起）：以 **机判断言日志** 为准（`?fire=3` 驱动扳机 3 秒 → `world.shotsFired` 必须 > 0），
不以截图存证（截图与画面状态易错位，原 `smoke-frame-fire-chain.png` 实为标题屏、已删除）。

## 三、互查遗留（不阻塞，呈主人）

1. **人工试玩未做**（主人裁决项）：手感/难度/好玩与否。机判只能保证「与 approved spec 一致且数值按 spec 曲线」。
2. **移动端触控未做**：spec.meta platform 写「桌面/移动 Web」，本版仅键鼠（世界提示口径已注明）；若主人要触控版，走 spec 修订 + 增量实现。
3. **静态 bot 命中率 33%** 主要打掩体后目标（bot 不绕位），非命中判定问题；真人体验待验证。
4. 竞速线（qqfeiche3d）复刻不在本节点，见 blockers.md B-2。
