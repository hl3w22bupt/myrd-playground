# 产品线 2 工程对账清单（inventory-line2 · wheat-squad 麦浪小队）

> 更新时间：2026-10-13 · 负责人：游戏程序（产出）/ 主策划（对账整合）· 基线 HEAD `129bf56`（分支 `myrd/spec-v1-qa-deploy-cmv5zila9002jm9qqpsyos4g1` = 上轮成果分支 `20facdf` 快进）
> 图谱：code-review-graph 全量构建 189 文件 / 3306 节点 / 21540 边，`built_at_sha=129bf56`（head_matches_build=true）
> 状态：runner PEND 语义 + 埋点四事件 + a3 实测初值已随 N1 落地（`0adff06`）；spec v1.2 已入链 approved（链 v4 `cmv60scie`，HEAD `c4348e1`）；N8 独立复核于 HEAD `304dacf` 全量实跑复现成立（`wheat-squad/gate-logs/n8-reverify-20261013/`）

## 渲染管线一行结论（交美术）

**Canvas 2D 单画布（390×640 逻辑分辨率）· 纯几何程序化绘制（正弦麦浪条带/椭圆/圆/矩形，零位图零 atlas 零纹理上传——最大纹理 = 0，tex-1 契约）· 色值唯一真源 = spec numeric.palette 8 色（theme.ts 镜像）· 字体 system-ui 零字体资产**——美术出图以「色板 + 形状语义」为准，不产贴图文件；动效面 = flash 描边扩散 + 粒子方块，均在 palette 白名单内。

## 工程文件职责清单（games/wheat-squad/ · 每文件一句）

### 工程面

| 文件 | 一句职责 |
|---|---|
| `apphost.toml` | AppHost 部署清单（坑位 manifest 入口，deploy 轮 POST manifestPath 指向件） |
| `package.json` | 零 npm 依赖声明（node 原生 TS strip 跑测 + 构建判例的元面） |
| `verify.sh` | 工程门禁统一入口薄壳：统一契约→自有契约→WS-SMOKE→SCOPE-GUARD 双模式五步，exit 全透传 |

### 源码 src/（7 件 · spec entities 落点）

| 文件 | 一句职责 | spec 实体锚 |
|---|---|---|
| `src/kernel/loop.ts` | 确定性内核骨架：mulberry32 seededRng + fixed-step 累计器（零 Math.random/Date.now） | e-kernel-loop |
| `src/kernel/sim.ts` | 纯仿真内核：生成/索敌/子弹/击杀掉落/升级三选一/波次/结算判定 + SimState 全量状态与 A1/A4 埋点事件源 | e-kernel-sim + e-captain/e-squadmate/e-pest/e-bullet/e-wheat-pickup/e-wave-manager/e-upgrade-picker |
| `src/render/renderer.ts` | 几何渲染层：麦浪底/害虫/小队/特效/HUD 纯 Canvas 绘制（零贴图） | e-renderer |
| `src/render/theme.ts` | 视觉 token 单源镜像：spec numeric.palette 8 色 + 2 派生 α token | （numeric.palette 契约镜像） |
| `src/settlement.ts` | 结算页纯数据面：三信息（强化回顾/难度预告/麦仓收益）+ 重开提示文案 | e-settlement |
| `src/game.ts` | 组装面：spec 单源装载注入 sim + 输入/循环装配 + 三选一/结算视图 + 遥测接线（telemetry 接缝） | e-telemetry + e-upgrade-picker 视图面 |
| `src/main.ts` | 浏览器入口：canvas/pointer 输入/rAF 主循环/debug 机读面（__G2WS_* 冒烟契约消费口） | boot 装配（platform 面） |

### 契约测试 tests/contract/（15 件 + 共享 2 件）

| 文件 | 一句职责 | spec 验收 |
|---|---|---|
| `helpers.mjs` | 共享件：spec 单源装载（G2WS_SPEC_PATH→仓链发现）+ assert + driveRun 仿真驱动 | — |
| `run-all.mjs` | 自有套件聚合器（`ac-*.spec.mjs` 自动发现；**本轮升三态 PASS/FAIL/PEND**） | — |
| `ac-01-seeded-determinism.spec.mjs` | 同 seed 双局逐字节一致（确定性总闸） | det-1 |
| `ac-02-first30s.spec.mjs` | A1 面机判：首次核心正反馈 ≤10s + 5 种子首杀 ≤30s + 回归预算保持 | ac-a1 |
| `ac-03-run-duration.spec.mjs` | A2 面机判：20 种子 P50/P90 时长带 + victory 结局占比 | ac-a2 |
| `ac-04-restart-loop.spec.mjs` | A3 面：重开 ≤1s 全复位 + 结算三信息 + 量表 schema（auto）+ 5 名试玩回填校验（manual，未回填=PEND） | ac-a3 |
| `ac-05-hit-feedback.spec.mjs` | A4 面机判：反馈延迟 ≤100ms + 每操作通道 ≥2 + flash=hitFlashMs | ac-a4 |
| `ac-06-perf-budget.spec.mjs` | 性能预算：实体峰值 ≤220 + 单步 ≤16ms + 三机型档节流仿真 | perf-1 |
| `ac-07-no-texture.spec.mjs` | 零位图文件 + 源文件零贴图构造（渲染管线红线） | tex-1 |
| `ac-08-anchors.spec.mjs` | entities/levels 落点在盘非空（账实对齐总闸） | anchor-1 |
| `ac-09-placement-structure.spec.mjs` | 放置收益结构冻结：spec 文本 + placementOffline 公式行为级对拍 + PEND 校准语义 | fv-pend |
| `ac-10-art-palette-whitelist.spec.mjs` | 资产色值 ⊆ palette 白名单（美术契约 1） | ac-art-1 |
| `ac-11-art-naming-ids.spec.mjs` | 资产清单 id ∈ entities ids + source 锚在盘 + 清单封顶（美术契约 2） | ac-art-2 |
| `ac-12-art-size-caps.spec.mjs` | 资产尺寸/首包封顶（美术契约 3） | ac-art-3 |
| `ac-13-art-style-consistency.spec.mjs` | 风格一致性机制面 + 互查回执在档（美术契约 4） | ac-art-4 |
| `ac-14-telemetry-naming.spec.mjs` | 埋点定名三方同名机判（spec telemetryFields → game.ts 接线 → smoke 断言，剥注释） | （telemetryFields 守卫） |
| `ac-15-gate-adapter.spec.mjs` | 门禁适配视图守卫：design-spec.json 注入 id/slug 与单源深等 + verify.sh 在盘 | （门禁身份守卫） |
| `ac-16-guidance-telemetry.spec.mjs` | 埋点四事件骨架机判（first_tap/first_loop_complete/restart_clicked/hint_shown + atMs 相对时间戳 + restart count 递增 + a5 窗语义） | ac-a5（spec v1.2 入链后经 checks/ 薄壳挂接） |

### 工具 tools/（7 件）

| 文件 | 一句职责 |
|---|---|
| `build.mjs` | 零依赖确定性构建：strip TS → build/（10 文件：spec 内联 + src 镜像 + index） |
| `smoke.mjs` | headless 全链路冒烟：打开→首次核心操作→单局结束→重开 + 埋点真实载荷断言（含四事件） + 零 console 错误 |
| `smoke-live.mjs` | 线上冒烟（CDP 直连 LIVE 入口，同断言面）——部署存活实证 |
| `duration-log.mjs` | a3 本地时长日志（20 种子实测初值 → qa/local-duration-log.json，校准基线） |
| `export-approved-spec.mjs` | 链上 approved 版导出器（--expect-version 锚核对，防链漂移） |
| `build-spec-v1.mjs` / `build-spec-v1_1.mjs` | v1.0 / v1.1 建版载荷生成器（冻结守卫，历史轮留档可复跑） |
| `build-gate-adapter.mjs` | 门禁适配视图生成器（approved 单源 → design-spec.json 注入 id/slug 两键） |

### QA 面 qa/ + 守卫 ci/ + 资产 assets/

| 文件 | 一句职责 |
|---|---|
| `qa/n7-adversarial-review.md` | 上轮 QA 对抗审查回执（D1/D2/D3 源） |
| `qa/playtest-record-template.md` | A3 试玩量表模板（「重开理由原文」列 = 结论面判据） |
| `qa/style-consistency-check.md` | 美术风格互查回执（ac-art-4 在档面） |
| `qa/submission/` | 提审素材模板（图标/分享图/截图三模板 svg） |
| `ci/scope-policy.json` | SCOPE-GUARD 策略单源（禁触面/白名单/豁免前缀） |
| `ci/guard-repo-scope.mjs` | 违规标识符扫描器（双模式：本仓 + 父仓足迹） |
| `assets/manifest.json` | 资产清单（id→路径→文案逐字，ac-art-2 对账源） |
| `docs/qa-n5-recon.md` | N5 轮 QA 互查回执（骨架轮，历史留档） |

### 构建产物 build/（10 件 · 确定性生成，禁手改）

`index.html`（壳+spec 注入）· `main.mjs`（入口镜像）· `spec.json`（装载副本）· `src/`（7 件 TS strip 镜像）——`node tools/build.mjs` 重建 ≡ 仓内逐字节（部署字节=提交字节判据）。

## 账实对齐说明

- spec entities 13 / levels 2 的落点全部在盘非空（ac-08 机判绿）；上表「spec 实体锚」列 = 逐条对齐关系（本轮 spec v1.2 修订的 entities/levels 路径核对基线）。
- **本轮增量已落（2026-10-13 N1）**：埋点四事件落 `src/game.ts`（recordTap/recordRestartClick 接缝 + step 遥测段含 hint_shown/first_loop_complete）+ `src/main.ts`（pointerdown 接入）+ `src/render/renderer.ts`（drawGuidance 引导浮层，文案单源 `GUIDANCE_TEXT`）+ `ac-16-guidance-telemetry.spec.mjs`（先红后绿）+ `tools/duration-log.mjs`（a3 实测初值）+ `run-all.mjs` 三态 PEND 聚合。门禁：统一 53/0 · 自有 16/0/1PEND · WS-SMOKE PASS（四事件真实产生，`gate-logs/n0-rebaseline-20261013/03·05·06·07`）。
- **a3 实测初值**：20 种子 P50=168.1s / P90=168.1s / victory=20/20 / 带内=true（`games/wheat-squad/qa/local-duration-log.json`）。
- **已知缺陷 Q-1**（本轮发现不擅修）：offerIfNeeded 死阈值 5 与 sim nextUpgradeXp 递增阈值不同源 → xp≥5 后三选一连弹（上轮既有，修复涉 approved 行为面走 revision）——`games/wheat-squad/qa/known-defect-q1-offerif-bypass.md`。
