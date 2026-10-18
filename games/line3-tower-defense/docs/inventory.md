# inventory — line3-tower-defense（每文件一句职责 · inv-1-td-entity-file-alignment 机判输入）

> 更新时间：2026-10-18（实现轮 N4 全量落盘）· 负责人：游戏程序 · 对账口径：spec.entities[].script 落点 ⊆ 本表且路径逐条在盘（工程相对路径；spec 侧仓根相对路径剥 `games/line3-tower-defense/` 前缀归一化比对——QA-N2 预核登记口径）

## entities 声明落点（inv-1 全量 12 条）

| 文件 | 职责（一句） |
|---|---|
| `src/kernel/loop.ts` | e-kernel-loop：mulberry32 种子随机（状态内嵌 rngState）+ fixed-step 常量 + FNV-1a 状态哈希（确定性之根） |
| `src/kernel/sim.ts` | e-kernel-sim：stepSim 纯函数步进（敌推进×索敌开火×命中×经济×漏怪）+ 五操作路径行动面 |
| `src/world/grid.ts` | e-grid：20×12 网格 + 敌军路径折线/累计长度表 + 禁建面（路径格+核心 2×2）布局单源 |
| `src/world/core.ts` | e-core：核心据点常量（生命 10，归零=defeat；绘制位取 grid.CORE_TILES） |
| `src/entities/turret.ts` | e-turret：炮塔等级数值表（伤害/射速/射程/升级价按等级幂式推导） |
| `src/entities/enemy.ts` | e-enemy：敌军三型数值公式（血量带/速度/编成配比抽取） |
| `src/entities/projectile.ts` | e-projectile：弹丸发射锁定+arrivalTick 离散结算（零浮点漂移面） |
| `src/systems/waveDirector.ts` | e-wave-director：编成表（8 波 ×1.35 爬升）+ 首波前 10s 宽松窗出怪节奏 |
| `src/systems/economy.ts` | e-economy：军费闭环（击杀赏金波次增长 + 布防/升级支出 fail-closed） |
| `src/telemetry/emitter.ts` | e-telemetry：埋点八键定名常量+缓冲式发射器（fnd-1 机判锚，零外发；sink 注入接缝） |
| `src/render/renderer.ts` | e-render：Canvas 渲染层（只读 theme token；双层平涂+2px 描边；视觉锚 fx 绘制；ctx 抽象=headless 可采样） |
| `src/input/touch.ts` | e-input：操作路径 5 条 id + 指针坐标→语义动作解析（题屏/结算/运行三态命中面） |

## 支撑面（实现轮新增）

| 文件 | 职责（一句） |
|---|---|
| `src/kernel/config.ts` | 数值单源装配：configFromSpec(approved 导出件) ⇄ MIRRORED 镜像 + 断言（白名单 hex 声明面） |
| `src/kernel/state.ts` | 战局状态容器（四序列表锚 + 全 tick 哈希 + 瞬时面排除口径） |
| `src/render/theme.ts` | 风格卡 token 单源出口（由 config.MIRRORED 派生零字面）+ 派生色函数 + 逻辑面尺寸 |
| `src/render/guidance.ts` | 首屏文案 12 条逐字单源（a5 三方同名锚） |
| `src/scene/battlefield.ts` | battlefield 场景装配（等比 letterbox 视图换算 + 逻辑坐标反解） |
| `src/game.ts` | Game 装配入口（kernel×scene×input×telemetry 接线；遥测出账+事件消费唯一入口） |
| `src/main.ts` | 浏览器 boot（spec.json 预载→配置单源→rAF 主循环→指针接线→__L3_BUILD__ 锚） |
| `index.html` | 壳页面（canvas#stage + spec.json 预载注入） |
| `tests/contract/helpers.mjs` | 契约共享件：spec 单源装载 + 镜像断言 + 内核/Game 双驱动器 + headless 绘桩 |
| `tests/contract/run-all.mjs` | 契约 runner（acceptance↔check 双向对账 + 子进程隔离实跑 + a3 单列 PEND） |
| `tests/contract/checks/`（14 件） | 对应 spec acceptance auto 条目（id 同名），实现轮全件转真 |
| `ci/guard-source-scope.mjs` | 源面纪律扫描（确定性/零位图/裸 hex 声明面三判，verify.sh ④） |
| `tools/build.mjs` | 确定性构建（TS strip→build/ 镜像 + spec.json 直拷 + __L3_BUILD__ 注入） |
| `tools/smoke.mjs` | L3-SMOKE 浏览器冒烟（CDP 全链路 + 构建锚核对 + 零 console 错误） |
| `tools/art-manifest.mjs` | 首批程序化可见资产生成器（6 件 SVG token 派生 + manifest 逐件 hash，确定性） |
| `tools/style-sketch.mjs` | 风格方向稿生成器（B4 件；实现轮重构为直读 theme token，输出零漂移） |
| `tools/style-sketch-audit.mjs` | 方向稿独立审计器（B4 件，23 项机判） |
| `tools/build-spec-v1.mjs` | spec v1.0 载荷组装+六段机校验（B2/B5/B6 共用口径，B 轮件） |
| `assets/game-art/manifest.json` | 首批可见资产 manifest（6/13 件，逐件 生成器行号+sha256；ac-art-2/tex-1 输入） |
| `apphost.toml` | 线 3 部署清单（assets_dir=build/，N5 部署面） |
| `verify.sh` | 工程门禁薄壳（统一门禁+契约套件+冒烟+源面扫描四步，exit 全透传） |
| `package.json` | 工程声明：零 npm 依赖 + type=module + 脚本入口（build/contract/smoke/verify） |
| `tsconfig.json` | TS 严格模式编译面（node 原生 TS strip 构建判例） |
| `qa/playtest-collection-round1.md` | a3 真人记录卡形制占位（0/5 未判定·待采） |
| `docs/inventory.md` | 本文件：逐文件一句职责对账表（inv-1 机判输入） |
| `docs/design-spec-v1.md` | spec v1.0 人读版（与链上 approved 版同源） |
