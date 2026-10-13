# QA 只读可判定性预审 — spec v1.2 draft（payload `design-spec-v1_2-payload.json`）

> 预审人：游戏 QA（主策划工作室内代行节点，产物独立落盘）· 日期：2026-10-13
> **声明：依据 draft（design-spec-v1_2-payload.json），未拍板——本预审不构成 approve，不作为契约依据**
> 基线：链 v3 approved（meta 1.1，`cmv4q8bng001em9qm5p78do05`）· 实现前置：N1 四事件已落（ac-16 先红后绿）

## 一、A1–A5 可判定性（逐条）

| 条款 | mode | 可判定性结论 |
|---|---|---|
| ac-a1-first-core-feedback | auto | ✅ 沿 v3 不变，数值锚 firstKillBudgetSec/回归预算在 statement，机判面 ac-02 实跑绿 |
| ac-a2-run-duration-band | auto | ✅ 沿 v3 不变，20 种子 P50/P90 带 + victory 面（duration-log 2026-10-13 实测 P50=168.1s victory 20/20 再证） |
| ac-a3-restart-willingness | manual+auto | ✅ 沿 v3 不变，机制面 auto + 结论面 manual（0/5 PEND 如实）双声明完整 |
| ac-a4-feedback-channels | auto | ✅ 沿 v3 不变（反馈通道面），v1.2 的 a4 强化拆独立条款 ac-a4b（不稀释原义）✓ |
| **ac-a5-guidance-first-action（新）** | auto | ✅ 可判定：hint_shown.atMs 与 first_core_action_at.atMs 均为 number 相对毫秒，差值 ≤5000ms 单比较即可机判；窗值 5000ms 写死 statement（判定参数不混 numeric，评审通过）；文案三方同名（spec=manifest.copy=GUIDANCE_TEXT）已机判在 ac-16 |
| **ac-a4b-restart-click-counter（新）** | auto | ✅ 可判定：restart_clicked{count,atMs} 每次 +1 可枚举断言；「真实点击」双层实证 = 契约件直调接缝（ac-16⑤）+ 冒烟真实 pointerdown 断言 count=1（smoke ④'），无自算替代 |

## 二、check 路径形态（checkNaming 落地）

- ✅ 16 条 check 全部 `node games/wheat-squad/tests/contract/checks/<acceptance-id>.mjs`（文件名=acceptance-id 逐字一致，统一门禁依赖存在解析兼容——`checks/xxx.mjs` 为带扩展名路径 token）。
- ✅ 薄壳生成器 `tools/build-checks-shims.mjs` 带 **SHIM_MAP↔spec acceptance 完全一致守卫**（fail-closed 实证：对 v3 基线跑即红「map 独有 a5/a4b」，入链 v4 后方可生成——顺序正确）。
- ⚠️ 披露两项（非阻塞）：① ac-a5/ac-a4b 共享实体件 ac-16（同一断言面跑两次，幂等确定性，无假绿）；② loop-1 薄壳 = spawn 冒烟 exit 透传（互查实跑耗时 ~2-3 分钟/次，语义真实）。

## 三、埋点结构化（entities/telemetryFields）

- ✅ e-telemetry.expect 从 v0 残留（三事件缓冲）升级为 **9 键结构化片段（事件名→字段名→类型）**，消除 v3 时代 expect 与 telemetryFields 的账实漂移。
- ✅ 9 键三方同名可行性已机判：ac-14（剥注释）对 game.ts 接线面 9 键逐字断言——**入链后 ac-14 将以 9 键口径重跑**，N1 实现面 9 键字面量全部在盘（`grep` 核对：run_start/first_kill/run_duration_ms/first_core_action_at/feedback_latency_ms/first_tap/first_loop_complete/restart_clicked/hint_shown 均见于 src/game.ts），预期绿。
- ✅ 类型面完整：每事件字段均有类型（number/string），once 语义标注（first_tap/first_loop_complete）。

## 四、W-5 顺带条款

- ✅ baselineProtocol.计数器措辞与 QA 口径统一：「连续 3 轮四件套全不达才计数前移（任一轮部分达标即重置 0/3）」——D3 澄清闭合。

## 五、零回退核对

- ✅ world 冻结面（summary/tone/themeZones/styleRef/uxCommitments）与 levels 逐字节不变（生成器终守卫机判，违即拒产出）。
- ✅ entities 13 条 id 与锚零改动；numeric 既有键零改动（仅 +guidance）。
- ✅ 既有 14 条 acceptance statement 零改动（仅 check 路径形态改写——语义面由薄壳转发实体件原样承载）。
- ✅ assets 仅 +guidance-hint-banner；manifest v2 已同步（10 件 ≤ 封顶 13，ac-art-1/2/3 复跑绿）。

## 六、预审结论

**放行送审签（APPROVE-READY，附两项披露）**：① 共享实体件披露如 §二；② checks/ 薄壳在入链 v4 后立即生成并全量复跑门禁，期间窗口不得部署（已纳入流程顺序）。本预审依据 draft，最终以链上 approved 版为准。
