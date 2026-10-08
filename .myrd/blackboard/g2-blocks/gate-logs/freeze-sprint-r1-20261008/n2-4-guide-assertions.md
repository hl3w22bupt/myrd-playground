# n2-4-guide-assertions.md — 引导路径断言所在测试文件与条目指认（N2④ · 2026-10-08）

> 负责人：游戏程序（N2 证据面）/ 主策划复核
> 范围：web v1.2 主线（源仓 main @ `5e7f2e5`，含封版冲刺 N4）；wx/dy 移植线分叉早于 N4，见文末注。

## 引导路径断言清单（文件 → 条目 → 断言内容）

| # | 测试文件 | 条目/断言位 | 断言内容 |
|---|---|---|---|
| 1 | `tests/levels.spec.mjs`（入 `tests/run-all.mjs` ⑦） | :55-85 el-hint 行为组 | el-hint 仅 level-1（`:57` spec 缺 el-hint=红）；expect 文本「或 N 手后不再出现」上限现读（`:60`）；开局提示可用（`:64`）；level-2 提示不可用（`:68`）；首次三消后隐没（`:75`）；上限 N 手前可用/后隐没（`:81`/`:85`） |
| 2 | `tests/levels.spec.mjs` | :33-53 parseGoals/goalEval | level-2 目标解析（手数上限/连击目标/存活到炉冷）、首消窗口目标排除 |
| 3 | `tools/smoke.mjs` ⑦b（:264-286） | level-2 玩家入口面 | `__G2_SET_LEVEL` 入口可达（`:271`）；HUD 目标 spec 数值现读（`:276-278`）；可玩性（`:280`）；level-1/2 切换回路（`:286`） |
| 4 | `tests/contract/ac-29-analytics-nine-events.spec.mjs`（**本轮 N4 新增**，入链 v7 ac-29） | 引导锚点三事件 | `evt_first_screen`（首帧）/`evt_first_drag`（首次交换尝试）/`evt_first_place`（首次有效交换）：spec 表↔代码镜像双向全等 + call site 在位 + once=per-session 语义（漏斗三格断言面） |
| 5 | `scripts/contract-check.mjs` --only ac-22..28（链 v4 手感轮七条，Mode B） | 引导/手感反馈面 | 落地挤压/硬降震屏/消除粒子/三档音效/连击反馈/重开一键/daily 钩子（引导后的反馈路径） |

## 运行方式（复现命令）

```bash
# 1–3（web 主线）：
node tests/run-all.mjs          # ⑦ = levels.spec（el-hint/关卡面）；smoke 单独跑 tools/smoke.mjs
# 4（链 v7 面）：
G2_SPEC_PATH=<.myrd/spec/g2-blocks/design-spec-v1.5-freeze-draft.json> node scripts/contract-check.mjs --only ac-29-analytics-nine-events
# 5（Mode B 全量 26 PASS / 3 PEND）：
G2_SPEC_PATH=<同上> node scripts/contract-check.mjs
```

## 平台线注记

- wx（`4fba03a`）/dy（`023e583`）分叉自 `fe5fd38`（v1.1 末梢），**不含** #4/#5（N4 与链 v4 产物）；其引导面 = levels.spec + smoke ⑦b 同源（分叉时点版本）。
- 平台线接入 N4 埋点与链 v7 的路径：随移植线下一轮 sync（rebase/merge main）后复跑各自 contract；见 blockers.md 交接注。
