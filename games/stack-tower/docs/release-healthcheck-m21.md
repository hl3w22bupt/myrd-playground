# stack-tower M2.1 正式发布轮 · 程序发布体检报告（N1）

> 体检人：T4 游戏程序（主策划派单）· 日期 2026-09-26
> 发布对象：当前分支 `myrd/pixel-fives-m0-m1-cmtpb66pe000rm9e2ozdurf8d` HEAD（体检时 `eddcf0c`，报告提交后打 release tag）
> 对比基线：9/25 已部署版 `75debf9`（AppHost 坑位 `cmugttipt000km9299oej5z9b` · slug `stack-tower-3`）
> 结论：**体检 PASS，六道门禁全绿（非降级），准予打 release tag**
> 铁律遵守：程序只体检不改码（本轮源码/资产/构建产物零改动）；不动 v1 冻结数值；spec 零改动

---

## 1. 增量清单（75debf9..HEAD，范围外文件零容忍核对）

| 文件 | 分类 | 说明 |
|---|---|---|
| `.myrd-platform/.claude/CLAUDE.md` | 平台注入 | delegation auto-commit（541323a）平台托管文件，非游戏范围，不进发布面 |
| `.myrd-platform/.claude/skills/SKILLS.md` | 平台注入 | 同上 |
| `.myrd-platform/.claude/skills/webgame-prototype/SKILL.md` | 平台注入 | 同上 |
| `.myrd/blackboard/{assets,blockers,levels}.md` | 发布治理文档 | 黑板（本轮发布治理面），不进发布面 |
| `.myrd/spec/README.md` | 发布治理文档 | spec 索引口径更新，不进发布面 |
| `.myrd/spec/stack-tower-spec-v1.1-payload.json` | spec 纸面（挂账件） | v1.1 登记就绪 payload，**未登记**（B8 冻结于 D4/D5），不进发布面 |
| `.myrd/spec/stack-tower-spec-v1.1-ready.yaml` | spec 纸面（挂账件） | v1.1 纸面终稿，同上 |
| `games/stack-tower/tests/live-smoke.mjs` | 测试工具 | 线上冒烟脚本（本轮 N6 QA 对外放行复用），不进发布面（tests/ 不入 SW precache） |
| `games/stack-tower/tools/build-spec-v11-ready.mjs` | spec 工具链 | v1.1 构建器，不进发布面 |
| `scripts/spec-v11-emit-yaml.py` | spec 工具链 | 发射脚本，不进发布面 |

- **发布面核验**：`git diff 75debf9..HEAD -- games/stack-tower/export/ games/stack-tower/src/ games/stack-tower/sw.js games/stack-tower/manifest.webmanifest games/stack-tower/assets/ server/` = **空**（2026-09-26 实测）。游戏运行时/资产/壳相对已部署版**字节全等**。
- **范围外文件零容忍**：12 文件全部归类可解释，其中游戏范围（tests/tools/scripts）均为只读工具与脚本，**零未解释文件**。

## 2. 数值一致性核对（对照 spec v1 冻结段）

- 命令：`python3` 键序无关深比（stableStringify 口径）；输入 `.myrd/spec/stack-tower-spec-v1.json` / 平台 API `game-design-specs/cmugok2uz000xm9ilx42t8pnl`（v3 approved 实查）/ `.myrd/spec/stack-tower-spec.json`（导出件）
- 输出摘要：冻结七键 `DEFAULT_SEED / FIXED_STEP_MS / MAX_DT_MS / perfect_window / cut_width / scoring / difficulty` 三方（v1 / 平台 v3 / 导出件）**全 EQUAL，零漂移**
- 导出件固化：六段（acceptance/assets/content/entities/levels/meta/numeric/world）与平台 approved v3 深比 **EQUAL**；`_platform={id: cmugok2uz000xm9ilx42t8pnl, version: 3, status: approved}`
- `src/kernel/numeric.ts` 镜像：audio(6)/deploy(3)/mobile(1) 增组键名全部在位；**权威判定 = 契约 e07 数值总闸**（见 §4 gate3，PASS）
- 漂移处置预案（未触发）：若漂移 → 回退或提修订，禁止静默入包

## 3. PWA 发布专项

| 项 | 核对结果 | 证据 |
|---|---|---|
| SW 缓存版本机制 | `CACHE = 'st-precache-v${REVISION}'`；REVISION 唯一真源 = spec `numeric.deploy.PRECACHE_REVISION`（`tools/gen-sw.mjs:19`，读不到显式失败，禁止私设版本号） | `games/stack-tower/sw.js` 头注 + gen-sw 源码 |
| activate 清旧缓存 | `caches.keys().then(keys ⇒ keys.filter(k ≠ CACHE).map(delete))` + `skipWaiting` + `clients.claim()` | `sw.js:66-75` |
| **本轮是否递增 REVISION** | **不递增**：发布面与已部署版字节全等（§1），同缓存名下无任何陈旧内容风险；而 PRECACHE_REVISION=1 属 spec v3 numeric.deploy 冻结值，递增即触发 spec 修订（违反「spec 零改动」铁律）。用户侧「新版本到达」由 SW 字节对比 +「老用户升级」线上冒烟实证（N6） | 本节 + blockers.md 裁定 2 |
| manifest | name/short_name/id/start_url/scope=`./`、display=standalone、orientation=portrait、theme/background #1d2733 | `export/web/manifest.webmanifest` |
| icons 含 maskable | 192×192 与 512×512 双图标 `purpose: "any maskable"` + apple-touch 180（assets/icons/ 三件在库） | manifest icons 段 |
| 离线回退 | fetch：GET → cache-first（ignoreSearch）→ 回源并回填缓存 → 失败回退 `./index.html`；install 预缓存 55 项 | `sw.js:77-91`；d2 断网契约（gate3 内） |
| 环境坑位（新增台账） | `npm --prefix <game> run smoke/assets:check` 会令 playwright 装载器内 `npm root -g` 探测失真 → 跑成 degraded PASS；**门禁必须直接 `node tests/smoke.mjs` 调用**（本轮已复现并修正，证据 `gate-logs/release-m21-20260926/4-smoke.log` 前后两版） | 本节 |

## 4. 全量门禁（六道，全绿非降级；日志 `gate-logs/release-m21-20260926/`）

| # | 门禁 | 命令 | 结果 | 摘要 |
|---|---|---|---|---|
| 1 | routine 口径契约 | `node scripts/contract-check.mjs --spec .myrd/spec/stack-tower-spec.json --project .` | **CONTRACT: PASS** | 合计 62 PASS / 0 FAIL |
| 2 | A–E 裸口径 | `node scripts/contract-check-stack-tower.mjs` | **RESULT: PASS** | [B] 22/22 实跑 PASS；[C] 8↔8 + 14↔14；[D] 17/17 |
| 3 | 契约总盘 run-all | `node games/stack-tower/tests/contract/run-all.mjs` | **PASS 22 / FAIL 0 / not-runnable 0** | 含 a4a/a4b（连击升调/封顶）、a5a/a5b（critical 优先/帧预算）、a6 restart、d2 断网全链路（冷启动→一局→重开→静音持久）+ sfx 404 负面用例 |
| 4 | 冒烟 smoke | `node games/stack-tower/tests/smoke.mjs` | **PASS (browser)** | 画布 480×720、seed=20260925 三连落块 score=120、零 pageerror |
| 5 | 资产 assets:check | `node games/stack-tower/tests/assets-check.mjs` | **PASS (browser)** | 运行时 200 + 资产全 404 负面用例可玩 |
| 6 | 构建/类型 | `npm run build` / `typecheck`（tsc） | **绿 + 逐字节确定性** | 重编译后 `git status` 零漂移；`build/ ≡ export/web/build/`（27 文件 diff 全等） |

## 5. sfx 资产注册表逐条核对（程序侧签；美术侧会签见 N3）

- `assets/sfx/manifest.json` events 六事件 × m4a+ogg = **12/12 在库**，export/web 同步 **12/12**
- 逐条：place 98ms / perfect 248ms / miss 208ms / game-over 388ms / **restart 198ms（≤200 红线 ✓）** / level-clear 398ms（≤400 ✓）；critical 标记：miss、game-over、restart=true（与 spec content.sfxPack.priority 一致，契约 acc-a5a 机判）
- 命名 `sfx-<事件id>.{m4a,ogg}` 与 spec content.sfxPack.naming 一致（acc-a1 注册表契约机判通过，gate3 内）
- 核对时间 2026-09-26 · 程序侧签字：体检通过（程序线）

## 6. 体检结论

- 增量清单：**PASS**（零范围外文件）
- 数值一致性：**PASS**（冻结七键三方 EQUAL，零漂移零静默）
- PWA 专项：**PASS**（机制完整；REVISION 本轮不递增已裁定并留证）
- 全量门禁：**PASS**（六道全绿非降级）
- sfx 注册表：**PASS**（12/12 + 双签程序侧完成）
- **准予打 release tag**；tag 落点 = 本报告提交后的分支 HEAD；「门禁跑完 → 打 tag 之间零内容 commit」由 QA 对内放行复核（复核口径：`git diff <门禁树>..<tag 树> -- games/ scripts/` 必须为空，仅允许证据/文档追加）
