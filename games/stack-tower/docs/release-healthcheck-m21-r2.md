# 发布体检（N1'）— stack-tower M2.1 正式发布轮 · 复验轮（r2）

> 签发：T4 游戏程序 · 日期 2026-09-26 · 性质：**R1 解冻后的 U6 修复轮发布体检**（承接 `release-healthcheck-m21.md` r1）
> 修复授权：主人重发发布轮任务书显式「直接实现需求并提交代码」+ 完成判据含对外放行全绿（裁定记录见 blockers.md §R1-R2）
> 对比基线：9/25 已部署版 `75debf9`；发布对象：本 tag `stack-tower-m2.1-release-r2`

## 1. U6 修复链（全部落码，零夹带）

| # | 文件 | 改动 | 依据 |
|---|---|---|---|
| ① | `server/src/index.ts` | sw.js 响应加 `Service-Worker-Allowed: /`（max scope 放宽；真实 scope 由页面显式传入） | R1①；线上报错原文实证 |
| ② | `games/stack-tower/src/app/main.ts` | SW 注册改显式：script=`new URL('sw.js', document.baseURI)`、scope=`new URL('./', location.href)`（页面目录） | R1②；实测 baseURI 无 `/gw` 段，页面目录才覆盖页面 |
| ③ | `games/stack-tower/tests/live-smoke.mjs` | 新增断言：SW 注册且 controller=true（轮询 20s）+ 断网 reload 可玩（落块计分） | R1③消灭形态盲区 |
| ④ | `server/src/index.ts` | 资产路由目录形态（`./` 解析结果）回落地页 —— 否则 `cache.addAll` 整体拒绝、install 永不完成 | 本轮新发现（盲区第二处） |
| ⑤ | `server/src/index.ts` | `index.html` 资产路由走落地页注入 —— 否则 precache 的离线导航回退页无 `<base>`，离线模块解析错位 | 本轮新发现（盲区第三处） |
| — | `games/stack-tower/tests/shell-sim.mjs` | **新增壳形态模拟门禁**：本地复刻 `<base>`+boot+base64+`/apps/<slug>/gw` 结构，部署前即可验证 SW/离线链路 | R1③防回归载体 |

- 修复过程证据：`gate-logs/release-m21-20260926-r2/`；sw.js 本体零改动（REVISION=1 冻结不动，`node tools/gen-sw.mjs` 复跑 55 项零漂移）。
- spec 零改动；v1 冻结数值键序无关深比全等（见 §2）；未夹带任何调优/新功能。

## 2. 数值一致性核对（spec v1 冻结段）

- 命令：`node -e`（稳定序列化键序无关深比，v1=`.myrd/spec/stack-tower-spec-v1.json` vs v3=`.myrd/spec/stack-tower-spec.json`）
- 输出：`v1 冻结七组 键序无关深比: 全等 ✓ (零漂移)`（DEFAULT_SEED / FIXED_STEP_MS / MAX_DT_MS / perfect_window / cut_width / scoring / difficulty）
- `numeric.deploy.PRECACHE_REVISION=1` 未动（CACHE 名 `st-precache-v1` 不变；SW 脚本字节零变化）

## 3. 增量清单（HEAD vs 9/25 `75debf9`，逐文件分类）

| 文件 | 分类 |
|---|---|
| `server/src/index.ts` | 发布面 · U6 修复①④⑤ |
| `games/stack-tower/src/app/main.ts` + `build/app/main.js` + `export/web/build/app/main.js` | 发布面 · U6 修复②（源+编译产物，root≡export 全等） |
| `games/stack-tower/tests/live-smoke.mjs` | 测试工具 · R1③ |
| `games/stack-tower/tests/shell-sim.mjs` | 测试工具 · 壳形态门禁（新增） |
| `.myrd/spec/*.json|yaml`、`.myrd/blackboard/**`、`games/stack-tower/docs/*.md` | 文档/纸面/平台注入（r1 轮已核，本轮零新增范围外） |

- 范围外文件：**0**。

## 4. 全量门禁（最终树，2026-09-26，证据 `gate-logs/release-m21-20260926-r2/`）

| # | 门禁 | 命令 | 结果 |
|---|---|---|---|
| 1 | 契约（routine 口径） | `node scripts/contract-check.mjs --spec .myrd/spec/stack-tower-spec.json --project .` | **CONTRACT: PASS 62/0** |
| 2 | 契约（A–E 口径） | `node scripts/contract-check-stack-tower.mjs` | **RESULT: PASS**（[B] 22/22 实跑） |
| 3 | 契约总盘 | `node tests/contract/run-all.mjs` | **PASS 22 / FAIL 0 / not-runnable 0** |
| 4 | 冒烟 | `node tests/smoke.mjs` | **RESULT: PASS (browser)** |
| 5 | 资产 | `node tests/assets-check.mjs` | **RESULT: PASS (browser)** |
| 6 | 壳形态（新增） | `node tests/shell-sim.mjs` | **RESULT: PASS (shell-sim)**（SW 控制页面 + 断网 reload 落块得分 35） |
| 7 | 类型 | `npm run typecheck` | **绿**（server 侧以 deploy 构建为闸：本地无 node_modules，hono/#apphost 平台注入，如实记录） |

- 门禁清单中「audio events / bgm-loop」两文件属 D4 冻结件（`tests/audio/events.test.ts` / `tests/audio/bgm-loop.test.ts`），仓库不存在（2026-09-26 实查）→ 不计门禁红，随 QA 回执「已知未收口项」单列（沿四项裁定 4）。

## 5. sfx 资产注册表（美术双签沿用 r1，本轮零资产改动）

- `assets/sfx/manifest.json` 六事件 × m4a+ogg = 12/12 在库；export/web 同步 12/12；门禁 `assets:check` PASS（含 404 负面用例）。
- 本轮发布面资产字节与 r1 tag 全等（`git diff stack-tower-m2.1-release..HEAD -- games/stack-tower/assets/` 为空，2026-09-26 实查）。

## 6. 已知未收口（移交 QA 单列）

- **U1** audio events/bgm-loop 冻结件（等 D5 答复）· **U2** 真机三项 · **U3** iOS 真机 · **U4** v1.1 平台登记 · **U5** 试玩终裁
- **U7（新立案，本轮不修）**：壳形态 `Image` 贴图经 boot 补丁取 base64 文本 → `blob()` 为文本 blob → 贴图降级程序化绘制（线上/离线一致、不影响可玩性与门禁）；修复点=`server/src/boot-script.ts` 改用还原字节的 fetch（约 3 行），待主人排期。实证：shell-sim NOTE 行 + 线上探针 ERROR。

## 7. r2 过程增补（2026-09-26，全留痕）

1. **U6 修复实施**（①头 ②显式注册 ③live-smoke 补断言）+ 过程中新发现④目录形态 `./` 断供（cache.addAll 整体拒绝、install 永不完成）⑤precache `./index.html` 为裸 HTML（离线导航回退页无 `<base>`，模块解析错位）——均壳侧修复。
2. **本地壳形态模拟门禁**（`tests/shell-sim.mjs`）复刻 `<base>`+boot+base64+`/apps/<slug>/gw`：先复现缺陷（SW 不激活/断网不可玩），修复后 **PASS**（断网 reload 落块得分 35）。
3. **改道实验（已回退）**：`b44c016` 试挂应用根 `/sw.js` 路由（precache 键重写）摆脱头的依赖，壳形态门禁 PASS，但平台部署护栏拒绝（「护栏违规：业务路由必须位于 /api/* 下（/health 豁免）。违规路由: /sw.js」，deployment `cmuhz1xds001jm97c9y2wzrp7` 构建日志）→ `6a6b4a8` 回退。
4. **三层头剥离定位**：实例直连（127.0.0.1:41007）有头 ✓ → 平台公网代理（:3001）无头 ✗ → funnel 仅转发。R2 立案升级主人。
5. **deploy 事故披露**：首次 deploy 漏传 `manifestPath`，平台按仓库根清单（糖果线）上传资产，生产串线约 3 分钟（`cmuhynlf7001dm97c8qbxvwx1`，05:40–05:43），已用正确清单纠正；最终生产 = `cmuhzflkk001mm97cxzu1tphg` @ `6a6b4a8`（= 本 tag 树）。教训：**deploy 必带 `manifestPath=games/stack-tower/apphost.toml`**。
6. **最终门禁矩阵**（本 tag 树，八道全绿）：§4 表 1–7 + `8-server-typecheck.log`（server 侧 `npx tsc --noEmit`，与平台构建 step2b 同命令）。
