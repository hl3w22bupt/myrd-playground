# QA 对内放行回执 — stack-tower M2.1 正式发布轮 · 复验轮（N2'，r2）

> 回执编号：**QA-REL-M21-20260926-03**（前序：01=对内 r1 · 02=对外 r1）
> 签发：T5 游戏 QA · 日期 2026-09-26 · 性质：**第一段「对内放行」闸（r2 增量树）**
> 放行对象：tag `stack-tower-m2.1-release-r2` @ `6a6b4a8`（U6 修复轮：壳注册链路 + 门禁补盲）

## 一、放行判据核对（只认文件级证据）

| 判据 | 结果 | 证据 |
|---|---|---|
| 程序发布体检（N1'） | **PASS** | `docs/release-healthcheck-m21-r2.md`：增量清单逐文件可归类、范围外 0；v1 冻结七组键序无关深比全等（零漂移）；PRECACHE_REVISION=1 未动 |
| 契约（routine 口径） | **62 PASS / 0 FAIL** | `gate-logs/release-m21-20260926-r2/1-routine-mode-contract-check.log` |
| 契约（A–E 口径） | **RESULT: PASS**（[B] 22/22 实跑） | 同目录 `2-ae-mode.log` |
| 契约总盘 | **PASS 22 / FAIL 0 / not-runnable 0** | 同目录 `3-run-all.log`（含 d2 断网全链路） |
| 冒烟 / 资产 | **PASS (browser) × 2** | 同目录 `4-smoke.log` / `5-assets-check.log` |
| 壳形态门禁（新增） | **RESULT: PASS (shell-sim)** | 同目录 `6-shell-sim.log`——SW 控制页面 + 断网 reload 落块得分（头可达形态全链路闭环） |
| 类型（游戏 + 壳） | **双绿** | 同目录 `7-typecheck.log` / `8-server-typecheck.log` |
| spec 零改动 | **确认** | `git diff 5a3284f..HEAD -- .myrd/spec/` 为空；平台 v3 approved（`cmugok2uz000xm9ilx42t8pnl`）未动 |

## 二、本轮新增修复的验收（U6 工程侧）

1. `Service-Worker-Allowed: /` 由实例发出——**直连实例实测存在 ✓**（见 qa-live-check-m21-r2 §二）。
2. SW 注册显式 script/scope（页面目录）——壳形态模拟门禁实测「SW 控制页面 ✓ scope=/apps/stack-tower-3/」。
3. `./` 与 `./index.html` 离线供源修复（目录形态/index.html 资产路由回注入版落地页）——模拟门禁断网 reload 可玩 ✓。
4. 形态盲区门禁入库（`tests/shell-sim.mjs`）+ live-smoke 补 SW/断网断言（R1③）——防回归载体成立。

## 三、已知未收口项（单列，不阻塞对内放行）

- **U1** `tests/audio/events.test.ts` / `tests/audio/bgm-loop.test.ts` 属 D4 冻结件，仓库不存在（实查）——门禁不计红，等 D5 答复。
- **U2/U3** 真机三项 + iOS Safari 真机（B6 挂日期）。
- **U4** spec v1.1 平台登记（payload 就绪，等 D4/D5）。
- **U5** 主人试玩终裁。
- **U7** 壳形态 Image 贴图链路（boot 补丁 base64→文本 blob → 程序化降级；在线/离线一致、不影响可玩；修复点 `server/src/boot-script.ts` 约 3 行，待排期）。
- **R2** 平台公网代理剥离 `Service-Worker-Allowed` + 路由护栏禁应用根静态路由 → **对外放行（N6'）FAIL**，本回执放行范围止于对内（工程/门禁面）。

## 四、结论

**对内放行：PASS**（r2 增量树工程/门禁面收口）。对外放行闸维持关闭——以 N6'（QA-LIVE-M21-20260926-04）为准，notes 持续 HELD。
