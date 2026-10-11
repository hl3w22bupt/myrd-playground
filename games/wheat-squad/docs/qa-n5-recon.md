# N5 互查回执 — wheat-squad（麦浪小队 · QA 对照 spec v0 打回线 · 2026-10-11）

> 回执编号：QA-WS-N5-20261011-01 · 互查人：游戏 QA（主策划整合）· 对象：spec `cmv36ewn8001sm9mxvsyvbvuc`（v1 draft · meta.version=0.1）+ 骨架 `games/wheat-squad/`
> 结论：**达可玩基线，放行部署**（auto 面全绿；manual 面四件套留真人试玩终裁——「好不好玩」归主人红线不失效）。

## 一、互查打回线逐条判定

| # | 打回线 | 判定 | 证据 |
|---|---|---|---|
| 1 | **auto check 路径真实存在且跑通（悬空按缺陷计）** | ✅ 零悬空 | acceptance 10 条逐条显式跑：**9 条 RUN✓ + 1 条 PEND 在档**（fv-pend check 指向 ac-09 结构契约在盘可跑）；每条 check 的 .mjs 文件在盘（互查脚本机判 existsSync + execSync 原跑，本回执归档于 `gate-logs/n5-recon-20261011/02`） |
| 2 | **「待校准」必须列明所缺数据项** | ✅ 列明 | fv-pend statement 明写「需内测样本的 **session 时长分布与回流率**」；numeric.placement.note 同口径双写；校准通道 = revision（红线①），当前数值为结构占位不参与判定 |
| 3 | **骨架须给可复现试玩路径（打开→操作→看到结算）** | ✅ 可复现 | 复现链 = `node tools/build.mjs` → 任意静态服 serve `games/wheat-squad/build/`（index/main.mjs/spec.json/src 镜像四件 200 实测）→ 浏览器打开拖动；机判面 = WS-SMOKE PASS（ready→拖动→击杀 1→300s timeout 自然结算→console 零错误，`gate-logs/n4-scaffold-20261011/01` 归档） |
| 4 | 好玩判据四件套 auto/manual 逐条声明 | ✅ 齐 | fv-1 auto+manual / fv-2 auto / fv-3 manual+auto / fv-4 auto+manual（mode 字段机读核对）；auto 面全绿（首杀 1.73s·首升 7.04s·单局 300s∈[180,300]·反馈 0 帧≤150ms·重开 0ms） |
| 5 | 冻结转新题触发条件写死 | ✅ 写死 | fv-3 statement「连续 3 轮独立真人试玩，≥2 轮双 manual 不达 → 冻结转新题」+ world.uxCommitments ux-freeze-trigger 同口径双写 |
| 6 | entities/levels 落点一一对应 | ✅ 13/13 + 2/2 | ac-08 机判（在盘 + 非空双断言）；levels 元素 id/expect 全量在档 |

## 二、美术互查（参考卡对照预置件模板）

- **主动打回一项并当场闭环**：style-card-v0 首稿缺规范口径四要素中的**光照/线条/比例**三节（模板 2026-10-10 亲审修订口径 = 调色板/光照/线条/比例）→ 已补 §二·补（全局光/命中反馈光/氛围层 · 线条 token 化四处显式描边 · 比例面画布/占比/触达）——打回到闭环同轮完成，零遗留。
- 调色板 8 色与 spec numeric.palette 逐值一致（手核；v0.2 入机判门禁——已在卡片 §五预告）。
- 角色几何/氛围与渲染实现（renderer.ts）一一对应（卡片 §三/§四扩展项）。

## 三、结论与部署建议

- **达可玩基线**：auto 契约 9/0 + 冒烟可玩闭环 + 落点零悬空 + 待校准显式化 → **放行 AppHost 部署**，升级主人邀请试玩。
- **试玩时请主人重点判定（四件套 manual 面）**：①接敌是否够快、三选一是否即时（fv-1）；②是否想再来一局（fv-3）；③打击感是否跟手（fv-4）。
- **红线重申**：本回执不构成「好不好玩」终裁；连续 3 轮试玩 ≥2 轮 fv-1/fv-3 双 manual 不达 → 冻结转新题（条款自动生效，主策划发起）。
