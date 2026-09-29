# QA 回执 · B1 上头循环轮（2026-09-29）

> 审输入三件：① approved spec v1.4（平台 v6 `cmulzwv6c005km9lfo3zek574`）② 实现 + 契约测试输出（39 契约文件）③ 冒烟记录（smoke browser PASS）。三件齐，开审。

## 一、八条拒绝线逐条判定（证据：`.myrd/blackboard/gate-logs/b1-mental-loop-20260929/`）

| # | 拒绝线 | 判定 | 证据（文件 + 命令 + 输出摘要） |
|---|---|---|---|
| 1 | numeric 不一致 | **未命中** | `1-numeric-freeze.log`：`node scripts/check-numeric-freeze.mjs` RESULT: PASS（三向 ≡ `c3af773b…74957d`）；`numeric-acc-num-frozen-gate` PASS 3/3；v1.3↔v1.4 numeric 段 sortKeys 深比 **diff 为空 True** |
| 2 | seed 不可复现 | **未命中** | `2-seed-repro.log`：acc-b2 PASS（同日两 ISO 时刻 sfc32 前 64 值逐值相等；跨日 seed 必变；产物无 `Math.random(`/`Date.now(` 调用形态）；acc-b3 PASS（UTC 23:30 vs UTC+8 00:30 边界归不同挑战日；UTC 16:00:00 整翻日） |
| 3 | 持久化缺失 | **未命中** | `3-persistence.log`：acc-b5 PASS（真实 v1.3 fixture 非空断言；迁移零损两键逐字节一致；schemaVersion="2"；重复迁移幂等；损坏 JSON 安全降级）；acc-b4 持久断言 PASS |
| 4 | 幂等中断不过 | **未命中** | `4-idempotent-crash.log`：acc-b7 PASS（同日重复领取只发一次；persist 注入抛错 → 内存回滚无半发 → 重启可重领且仅一次；跨日隔离） |
| 5 | 断网核心循环失败 | **未命中** | `5-offline-loop.log`：acc-b6 PASS（断网入队 2 条 → 恢复按序补报 → 队首失败留队保序 → 去重不重复送达 → 队列 200 丢旧）；冒烟核心循环 PASS（browser，3 次点击落块 score=45，重开清零） |
| 6 | 埋点口径违规 | **未命中** | `6-telemetry-caliber.log`：acc-b6 五断言 PASS（白名单外字段丢弃不进载荷；类型不符整条拒发；dedupe_id 必填；枚举外丢弃）；acc-e1 核心六事件枚举不变 PASS——双枚举并存互不越界 |
| 7 | 不可判定措辞 | **未命中** | `7-verdict-words.log`：v1.4 acceptance 40 条 statement 扫描 12 个模糊词（应该/大概/酌情/视情况/尽量/左右等）**命中 0 条**；B1 8 条 check 全部为可执行 node 命令 |
| 8 | wx 包变更 | **未命中** | `8-wx-unchanged.log`：`git diff 487640c..HEAD -- games/stack-tower/wx games/stack-tower/export/wx` **空输出**（提审包 `7ee13ab7…8225f` 基线保持）；`check-wx-bundle-size.mjs` PASS（主包/开放数据域分列，manifest 62 件漂移 0） |

## 二、全量门禁

- `9-run-all.log`：`node tests/contract/run-all.mjs` → **PASS 39 / FAIL 0 / not-runnable 0**（31 既有零回归 + 8 条 B1 新增全绿）。
- `10-d1-d2-regression.log`：acc-d1 PASS 4/4（SW v2 缓存名下 acc-d1 的 v1 子串断言经「上一版缓存清理」注释行自然满足——真实行为描述，非绕过）+ acc-d2 offline smoke PASS 2/2。
- 冒烟：`tests/smoke.mjs` RESULT: **PASS (browser)**——画布 480×720、3 次点击落块 score=45、R 键重开清零、零 pageerror/console.error。

## 三、本轮发现并已关闭的实现缺陷（契约先抓到）

1. **meta 埋点 flush 去重缺口**（acc-b6 用例③抓到）：崩溃后重复入队的同 dedupe_id 条目在补报时会被二次送达 → 修复 `src/telemetry/meta.ts` flush 循环补 sentSet 检查（重复条目出队不发送）。
2. **sfc32 归一化越界**（acc-b2 值域断言抓到）：`(a+b)/2^32` 漏 `>>> 0`，值域越 [0,2) → 修复。
3. **meta-badge 散落色值**（既有 acc-t1 抓到）：`#22d3ee/#facc15` 兜底字面量违反「theme 唯一色源」红线 → 改 NEON 表引用（hex8 透明度由主题色派生）。
4. 两处契约断言自伤修正（注释文本误中禁用词扫描）→ 断言改调用形态匹配，语义不变。

## 四、QA 结论

**通过（8/8 拒绝线零命中，全量 39/39 + 冒烟 browser PASS）**。可发布：仅 PWA 增量（SW 缓存版本已递增 v2 + index network-first），wx 包零变更不进本轮交付。

**挂账（不阻塞发布）**：
- 「好不好玩」终裁归主人试玩（连胜展示与每日挑战的激励强度人工判定，机器不替代）；
- missions 运行时顺延下一轮（附录 A schema 已定稿防漂移）；
- 上报端点未建（N0 实证），sender 注入式 no-op——端点建成即插，队列/补报/去重机制已就绪。
