# B1 美术线收口 · meta 四件套接线证据（2026-09-29 · 游戏美术）

> 轮次：B1 上头循环（spec v1.4 approved · scope_gate=narrow）· 承 N2 `182b9af`（产出在档）→ 本轮收口「即插即换」接线
> 证据格式：文件名 + 日期 + 命令 + 输出摘要（全局证据条款口径）

## 一、本轮变更面（只动素材与呈现层）

| 类别 | 文件 | 内容 |
|---|---|---|
| 呈现层 | `games/stack-tower/src/render/assets.ts` | +`META_ASSET_MANIFEST`（窄口径 3 键）+`loadMetaAssets`（三态装载）；核心 9 项 `ASSET_MANIFEST` 零改动 |
| 呈现层 | `games/stack-tower/src/ui/meta-daily-card.ts`（新） | 每日挑战卡呈现面：主题令牌占位 + 9-slice 24px 即插即换 + icon-badge 角标 fallback |
| 呈现层 | `games/stack-tower/src/app/main.ts` | meta 段接线：卡片挂载 / 资产装载后注入（badge/card/icon）/ 对局结果联动刷新；失败静默 |
| 查表器 | `games/stack-tower/tests/meta/assets-meta-check.mjs` | +§接线段 ⑥–⑨（14 项断言，34→48） |
| 交付链 | `games/stack-tower/sw.js` | precache 100→**101**（+`build/ui/meta-daily-card.js`，目录扫描确定性产出）；CACHE=`st-precache-v2` 不变 |
| 镜像 | `games/stack-tower/export/web/` | build 3 文件 + sw.js 镜像，`diff -r build export/web/build` 逐字节全等 |

**零触碰留证**：`git diff --stat HEAD -- games/stack-tower/wx/ games/stack-tower/src/kernel/numeric.ts` → **0 文件**；spec/numeric/玩法逻辑零改动。

## 二、门禁证据（2026-09-29 当日，全部复跑）

| # | 命令（cwd = games/stack-tower 除注明） | 结果 | 输出摘要 |
|---|---|---|---|
| 1 | `npm run build && npm run typecheck` | PASS | tsc 零错；`build/ui/meta-daily-card.js` 产出 |
| 2 | `node tests/meta/assets-meta-check.mjs` | **PASS 48/48** | ①–⑤ 资产段 34 项 + ⑥–⑨ 接线段 14 项全绿（含「mission-panel 不接线」「核心 9 项清单契约未动」） |
| 3 | `npm run assets:check` | **PASS (browser)** | 9 项核心资产 200 + 「贴图就绪 9/9」+ **资产全 404 负面用例核心循环可玩、零代码错误**（meta 接线静默降级实证） |
| 4 | `npm run contract` | **PASS 39/39** | run-all 全绿零回归（b1 八条含 acc-b4 徽章契约原样通过） |
| 5 | `node scripts/contract-check.mjs`（repo root） | **PASS** | A–E 全绿：spec v6 approved / 39+1 not-runnable（acc-a7 具挂账）/ entities 20/20 / assets 24/24 全 generated |
| 6 | `npm run smoke` | **PASS (browser)** | 核心循环 3 落块 score 45→重开清零，**零页面错误**（新卡面真实 DOM 无副作用） |
| 7 | `node tests/contract/b1-acc-b8-sw-version.spec.mjs` | PASS 4/4 | CACHE=st-precache-v2 / REVISION=1 冻结 / precache 含 B1 产物 |
| 8 | `node tests/contract/m21-acc-d2-offline-smoke.spec.mjs` | PASS 2/2 | 断网全链路可玩（meta-daily-card.js 已入 precache，离线导入链完整） |
| 9 | `npm run sw:generate` | PASS | 「precache 清单 101 项（REVISION=1 + EPOCH=1，CACHE=st-precache-v2，index network-first）」 |
| 10 | `diff -r build export/web/build` | 全等 | 发布面 ≡ 构建面逐字节（MIRROR_IDENTICAL） |

## 三、登记与挂账

- **黑板登记**：`.myrd/blackboard/assets.md` §B1 接线段（接线点三处 + 查表口径 34→48）。
- **挂账主策划**（非阻塞，见 blockers.md §B1）：SW CACHE 维持 v2 = acc-b8 冻结断言字面（REVISION=1+EPOCH=1）→ **已缓存 v2 的回头用户暂拿不到本轮 main.js 增量**（新装/清缓存用户即刻生效）；如需触达回头用户须 `META_CACHE_EPOCH` 1→2，牵动 acc-b8 断言与 spec sw-cache-bump 条款，归主策划拍板（美术不擅动门禁/spec）。
