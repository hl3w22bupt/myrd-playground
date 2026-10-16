# B1 程序线复核轮证据（2026-09-29 · 程序）

> 性质：B1 已收口（N0→deploy 全链核销 @c5ce12f）后的**独立复核轮**——不是新增实现，是对
> spec v1.4（平台 v6 `cmulzwv6c005km9lfo3zek574` approved）↔ 工程一致性的全量复跑取证。
> 结论：**七项核对全过，零缺陷、零漂移、零 wx 变更**；无需代码改动，仅本档案 + levels.md 同步。

## 核对一：契约门禁全量复跑

- 命令：`node scripts/contract-check.mjs`
- 日期：2026-09-29
- 输出摘要：`RESULT: PASS（spec ↔ 工程一致）`；spec 基线 = approved v6，acceptance=40，
  **39/40 PASS**（not-runnable 1 = acc-a7，v1.1 D4 主人挂账通道，`games/stack-tower/tests/audio/`
  实查不存在 → 判定真实，不计绿）；双向映射（8 元素↔9 elements 折入 e09 / 31 横切↔39 契约文件）、
  entities 落盘 20/20、assets 落盘 24/24 全过。

## 核对二：acc-b1..b8 逐条实跑

- 命令：`node games/stack-tower/tests/contract/b1-acc-b*.spec.mjs`（8 条逐条）
- 输出摘要：**8/8 PASS**（b1-scope-gate / b2-daily-seed / b3-daily-utc-boundary / b4-streak /
  b5-save-migration / b6-telemetry-meta / b7-idempotent-claim / b8-sw-version）。

## 核对三：numeric 冻结零漂移（N4 拒绝线①复算）

- 命令：node 内联——读 `stack-tower-spec-v1.4-payload.json` numeric 段 sortKeys 规范化 sha256，
  对比存档锚 `.myrd/spec/stack-tower-spec-v1.3-numeric-sha256.txt`；另与 v1.3 payload 深比。
- 输出摘要：v1.4 sha256 = `c3af773b6483164c22ca0a039623967cb3b67ff9b2b658749f927baeee74957d`
  **≡ 锚 MATCH**；v1.3 vs v1.4 numeric 深比 **diff 空**。B1 未触碰任何冻结键。

## 核对四：wx 包零变更（N4 拒绝线⑦复算，git diff 留证）

- 命令：`git diff --stat 487640c..HEAD -- games/stack-tower/wx games/stack-tower/export/wx`
  （487640c = B1 轮起点提交，HEAD = c5ce12f）
- 输出摘要：**输出为空 = 零文件变更**。B1 提交链（06b1e85→c5ce12f 共 6 commits）零触碰
  wx/ 与 export/wx/；B0 提审包 sha256 `7ee13ab7…8225f` 基线保持。

## 核对五：retention 七条目落点 + meta 四件套资产在位

- 命令：逐文件 `[ -s ]` 存在性核对 + `ls games/stack-tower/assets/meta/`
- 输出摘要：11 个落点文件全在非空——`src/meta/{seed,daily,save,streak,claim}.ts`、
  `src/telemetry/meta.ts`、`src/ui/hud.ts`、`tools/gen-sw.mjs`、`sw.js`、
  `tests/fixtures/save-v13-fixture.json`、`.myrd/spec/stack-tower-spec-v1.4-payload.json`；
  资产四件套 `daily-challenge-card.png`(360×160) / `mission-panel.png`(360×200) /
  `streak-badge.png`(96×96) / `icon-badge.png`(64×64) + manifest.json 全在库。

## 核对六：冒烟门禁复现（浏览器可打开 + 核心循环可玩）

- 命令：`node games/stack-tower/tests/smoke.mjs`
- 输出摘要：`RESULT: PASS (browser)`——HTTP 200 + 35 build 模块图全解析；
  无头核心循环 seed=20260925 三次落块 score=120；真 Chromium 打开画布 480×720、
  3 次点击落块 HUD「分数 45」、R 键重开「分数 0」、**零 pageerror/console.error**。

## 核对七：红线抽验（禁 Math.random 链路 / SW 版本策略）

- 命令：`grep -rn "Math.random" games/stack-tower/src/` + 抽读 `emitter.ts` / `sw.js` / `gen-sw.mjs`
- 输出摘要：
  - `Math.random` 实际调用仅 2 处，均为 **anon_id 降级兜底**（`telemetry/emitter.ts:77`、
    `app/boot-wx.ts:24`）；主路径 = `crypto.getRandomValues` 标准 UUID v4（version 0x40 /
    variant 0x80 位齐）——spec 定义 anon_id =「本地随机 UUID v4」，随机熵属 spec 语义，
    **不属 seed 链路禁令范围**。kernel/（rng.ts、sim.ts）与 meta seed 链路（seed.ts、daily.ts）
    仅注释提及禁令，零调用 ✅（acc-b2「seed 链路禁 Math.random」成立）。
  - SW：`CACHE='st-precache-v2'` = REVISION(1, 冻结) + META_CACHE_EPOCH(1, 工具侧)，
    numeric 未动；`NAV_PRELOAD='./index.html'` network-first（acc-b8 口径）✅。

## 缺陷台账

本轮复核**零新缺陷**。历史缺陷（契约抓出并已关闭的 3 处实现缺陷）见 N4 证据
`gate-logs/b1-mental-loop-20260929/`，不重复登记。
