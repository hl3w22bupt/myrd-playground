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

## 阻塞项（当前无团队面阻塞）

| id | 内容 | 归属 | 解除判据 |
|---|---|---|---|
| W-1 | 放置收益基准值待校准（结构已冻结，数值占位） | 主人侧内测样本 | N5 部署试玩样本回收后 revision 校准（fv-pend PEND 条） |
| W-2 | 好玩终裁（四件套 manual 面） | 主人（N5 部署后试玩） | 真人试玩结论；连续 3 轮不达触发冻结条款 |
