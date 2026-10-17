# inventory — line3-tower-defense（每文件一句职责 · inv-1-td-entity-file-alignment 机判输入）

> 更新时间：2026-10-17 · 负责人：游戏程序 · 对账口径：spec.entities[].script 落点 ⊆ 本表且路径逐条在盘

| 文件 | 职责（一句） |
|---|---|
| `package.json` | 工程声明：零 npm 依赖 + 脚本入口（build/contract） |
| `tsconfig.json` | TS 严格模式编译面（node 原生 TS strip 构建判例） |
| `src/kernel/loop.ts` | e-kernel-loop：mulberry32 种子随机 + fixed-step 常量（确定性之根） |
| `src/kernel/sim.ts` | e-kernel-sim：stepSim 纯函数步进接口占位（victoryWaves=8 镜像） |
| `src/world/grid.ts` | e-grid：20×12 网格常量（32px 格，路径/核心禁建面） |
| `src/world/core.ts` | e-core：核心据点常量（生命 10，归零=defeat） |
| `src/entities/turret.ts` | e-turret：炮塔等级常量（1..3，同位升级） |
| `src/entities/enemy.ts` | e-enemy：敌军三型类型（grunt/runner/brute） |
| `src/entities/projectile.ts` | e-projectile：弹丸直线离散结算占位 |
| `src/systems/waveDirector.ts` | e-wave-director：波次导演（首波×0.5 宽松常量） |
| `src/systems/economy.ts` | e-economy：军费闭环常量（起始 120/击杀 8） |
| `src/telemetry/emitter.ts` | e-telemetry：埋点八键定名常量+缓冲式发射器（fnd-1 机判锚，零外发） |
| `src/render/theme.ts` | 风格卡 v1 token 单源（8 色白名单+派生规则+描边/箭头/比例常量） |
| `src/render/renderer.ts` | e-render：Canvas 渲染层占位（只读 theme token） |
| `src/input/touch.ts` | e-input：操作路径 5 条 path id 常量（交互承接占位） |
| `src/scene/battlefield.ts` | battlefield 场景装配占位（单场景 20×12） |
| `src/game.ts` | game 装配入口占位（kernel×scene×input×telemetry 接线） |
| `src/main.ts` | main 启动入口占位（fail-closed NOT-IMPLEMENTED） |
| `tests/contract/run-all.mjs` | 契约 runner 占位（fail-closed：薄壳未转真前不可判绿） |
| `tools/build-spec-v1.mjs` | spec v1.0 载荷组装+六段机校验（B2/B5/B6 共用口径） |
| `tools/style-sketch.mjs` | 风格方向稿确定性生成器（3 张 SVG，重跑逐字节一致） |
| `qa/playtest-collection-round1.md` | a3 真人记录卡形制占位（0/5 未判定·待采） |
| `docs/inventory.md` | 本文件：逐文件一句职责对账表（inv-1 机判输入） |
| `docs/design-spec-v1.md` | spec v1.0 人读版（与链上 approved 版同源） |

| tests/contract/checks/（14 件薄壳占位） | 对应 spec acceptance auto 条目（id 同名），实现轮逐件转真 |
