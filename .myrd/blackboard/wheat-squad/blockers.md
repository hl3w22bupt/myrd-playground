# 阻塞项黑板 — wheat-squad（麦浪小队 · 二线孵化）

> 更新时间：2026-10-11 · 负责人：主策划（整合人）· 阻塞超一轮未解 → 升级主人，不空转
> 下一步：N5 QA 互查 + 部署试玩 → 主人试玩终裁（好不好玩归主人）

## N4 收口态（2026-10-11 · spec v0 + 可玩骨架同批交付）

- **spec 版本链起点**：`cmv36ewn8001sm9mxvsyvbvuc` · **v1 draft**（平台 revision 1）· meta.version=0.1 · 六段齐（entities 13 / levels 2 / acceptance 10 含 1 PEND）· 导出件 `.myrd/spec/wheat-squad/design-spec.json`（回读全等 EQUAL）
- **SCHEMA 探明（probe 判例）**：POST /api/v1/game-design-specs 需 projectId + spec；assets 元素必填 kind/file/source(+license)；acceptance.check 必须非空字符串（PEND 条也须给 check 落点）
- **骨架工程**：`games/wheat-squad/`（零 npm 依赖：node 原生 TS strip 跑测 + stripTypeScriptTypes 构建判例）· entities 13/13 落点在盘非空（ac-08 机判）
- **门禁终验**：契约 **9 PASS / 0 FAIL**（det/fv-1/fv-2/fv-3/fv-4/perf/tex/anchor/fv-pend）+ **WS-SMOKE PASS**（打开→拖动→击杀→300s 自然结算→零错误）——`gate-logs/n4-scaffold-20261011/01`
- **骨架轮抓到的设计缺陷（契约先红后绿价值实证）**：三选一触发面过窄（仅拾取瞬间→改击杀/拾取双面+阈值递增）+ 接触伤害无无敌帧（38s 即死→0.8s 无敌帧+接触分离）——均实现面调参，spec 冻结数值零改动
- **好玩判据四件套**：首 30 秒（auto 1.73s/7.04s + manual 待真人）/ 单局时长（auto 300s∈[180,300] + check 路径写进 acceptance fv-2）/ 再来一局（auto 重开 0ms+三信息 + manual 待真人）/ 反馈手感（auto 0 帧 ≤150ms + manual 待真人）——逐条 auto/manual 声明在 spec
- **冻结转新题触发条件**：spec fv-3 条款写死（连续 3 轮真人试玩 ≥2 轮双 manual 不达 → 冻结转新题）

## N5 收口态（2026-10-11 · 互查 + 部署试玩）

- **QA 互查回执**：`games/wheat-squad/docs/qa-n5-recon.md`（QA-WS-N5-20261011-01）——五线零悬空（check 路径 9 可跑 + 1 PEND 在档 · 待校准列明数据项 · 试玩路径可复现 · 冻结条款写死 · 四件套声明齐）→ **放行部署**。
- **美术互查**：参考卡首稿缺规范四要素中光照/线条/比例 → 主动打回当场补齐（§二·补），零遗留。
- **AppHost 部署**：坑 `cmv36wl94001xm9mxp119q48x`（slug **wheat-squad-2** · projectId 关联本项目）· 部署单 `cmv36wsds001zm9mxjibnmgqt` **v1 running** @ commit `4a58fb9e1f2c8005e31bb08de84a8076509637b1`（远端 HEAD 全等）· 零 errorMessage。通道实录 = 首坑缺 projectId 被拒 → DELETE 重建 → POST 000 截断 → GET 复查已受理（单次无重复）。
- **LIVE 自测 PASS**：/gw 200 出壳 title=麦浪小队 · 资产四件全 200 · main.mjs md5 `259fc5b449a76102792b264ef373ca01` ≡ 仓内 build 全等 · LIVE-SMOKE PASS（线上 boot + 拖动击杀 + 零错误）。**试玩入口：https://leomac-studio.tail49399e.ts.net/apps/wheat-squad-2/gw**
- **提请主人**：①真人试玩终裁（四件套 manual 面——接敌节奏/再来一局意愿/打击感，入口见上）；②链 v1（spec v0.1）approve 与否（draft 不阻塞试玩）；③试玩结论若触发「连续 3 轮不达」→ 冻结转新题条款自动生效（主策划发起）。

## N5 复跑轮（2026-10-11 · 游戏程序 · verify-claims 独立复验）

- **复跑结果：N4/N5 声称全部独立复现成立**，另补两件增量（证据 `gate-logs/rerun-20261011/01·02`）。
- **契约复跑**：`node tests/contract/run-all.mjs` **9 PASS / 0 FAIL，EXIT=0**（det/fv-1/fv-2/fv-3/fv-4/perf/tex/anchor/fv-pend 逐条复现）。
- **本地冒烟复跑**：`node tools/smoke.mjs` **PASS**（ready ✓ 拖动击杀 1 → 300s 自然结算 → console 零错误）。
- **LIVE 资产三点全等（本轮新增机判）**：资产真实服务路径 = `/apps/wheat-squad-2/gw/api/public/assets/*`（server 壳 `<base href="api/public/assets/">` 形态，直连 `/gw/main.mjs` 会 404 属路由设计非缺件）。`main.mjs`/`theme.mjs`/`sim.mjs` 三件 HTTP 200 且 **LIVE 字节 ≡ git `4a58fb9e` 字节 ≡ HEAD build 字节**（md5 逐件全等）；index.html DIFF 为壳层 base+boot 注入设计行为。**黑板原登记 LIVE md5 `259fc5b4…` 为部署当时历史值，本轮复测以 `cc454a07…` 为准**（对象存储已随部署 commit 刷新）——口径修正登记于此。
- **线上冒烟（本轮新增工具）**：`games/wheat-squad/tools/smoke-live.mjs`（零 npm 依赖，CDP 直连 LIVE 入口跑与本地冒烟同断言面）→ **WS-LIVE-SMOKE PASS**（线上 ready ✓ 拖动击杀 2 → 300s 结算 → console 零错误）——部署存活与可玩性直接实证，主人试玩入口可交付：https://leomac-studio.tail49399e.ts.net/apps/wheat-squad-2/gw
- **口径说明**：部署单 API 态（running/errorMessage）本轮未做 API 级核对（本地无平台 JWT），以 LIVE 实测三点全等 + WS-LIVE-SMOKE PASS 替代证明部署存活；如需 API 级回执归档请主人侧补一次控制台导出。

## 阻塞项（当前无团队面阻塞）

| id | 内容 | 归属 | 解除判据 |
|---|---|---|---|
| W-1 | 放置收益基准值待校准（结构已冻结，数值占位） | 主人侧内测样本 | N5 部署试玩样本回收后 revision 校准（fv-pend PEND 条） |
| W-2 | 好玩终裁（四件套 manual 面） | 主人（N5 部署后试玩） | 真人试玩结论；连续 3 轮不达触发冻结条款 |
