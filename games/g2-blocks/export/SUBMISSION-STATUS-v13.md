# 《提审包状态快照》— g2-blocks · v1.3 首批（2026-10-09）

> 产出：主策划 + 程序线（N5 汇总 deploy）· 契约面：链 v8 draft `cmv0aoxtt004gm9vigjmn09bh`
> **红线声明：提审决策归主人，团队只交包。本快照不构成提审建议，不载任何「提审就绪/应当提审」结论。**

## 一、通道状态

| 通道 | 提审包基线 | 分支 / commit | v1.3 零 diff 复核 | 状态 |
|---|---|---|---|---|
| wx（微信小游戏） | wx/port-v1.1 端口写案（链 v5） | `wx/port-v1.1` @ `4fba03a` | ✅ 双通道（下表） | 就绪待主人裁决 |
| dy（抖音小游戏） | dy/port-v1.1 端口写案（链 v6） | `dy/port-v1.1` @ `023e583` | ✅ 双通道（机制面同构，wx 侧实判） | 就绪待主人裁决 |
| web（PWA · 非提审面） | v1.2 发布 `6d3db6a`（部署轮 r3 已上线） | 主分支 | 本轮零接触 | 线上不受本轮影响 |

## 二、v1.3 零 diff 双通道复核（两通道独立，结论一致）

| 通道 | 判据 | 结果 |
|---|---|---|
| ① 契约断言（auto） | `ac-33-submission-bundle-zero-diff`：自 `6d3db6a` 起 v1.3 diff 全路径落白名单；`platform/`（wx/dy 组包输入）与 `export/` 与提审物料面零命中；build 树零内测工具字面量；internal tag 缺省关闭 | **PASS**（`tests/contract/ac-33` · 三态 Mode C 29+1PEND 含此条） |
| ② QA 独立跨树通道（manual） | v1.3 diff 路径集（46 路径）∩ wx 端口组包输入面（`platform/` · `tools/build-wx.mjs` · `tools/audit-wx-bundle.mjs`）= **0**；wx worktree 树内 `aggregate-nearmiss` / `__G2_NM_LOG` 字面量 = **0 处** | **PASS**（`tools/qa-v13-batch.mjs` Q6 现场实判 · wx worktree `g2-blocks-wx` 实树） |

## 三、v1.3 内测包（本轮唯一新交付物）

| 项 | 值 |
|---|---|
| 落点 | `games/g2-blocks/export/web-v13-beta/`（30 文件）|
| 同源 | 源仓 `feat/v1.3-nearmiss-settlement` @ 驳回修复轮 `ded8e8f` `build/`（逐件 sha256 全等 · `gate-logs/v13-nearmiss-reject-fix-20261009/`；前轮同源 `e79e1ee` @ 批 `00417238…` 已被本批 superseded，原档证据留 N5 目录不删）|
| 同批判据 | build 树 sha256 = shot-manifest `e3481537db9b…`（截图六张同批 · 驳回修复轮重摄）|
| 内容 | near-miss 反馈 + 结算页三层 IA + nm 遥测缓冲面 + `?internal=1` 内测标记 + 观测口（`__G2_SETTLEMENT/__G2_NM/__G2_NM_LOG`）|
| 隔离 | 内测工具面不进任何提审包（上节双通道）；web 面只缓冲不外发（未配端点如实披露）|
| 用途 | DoD 四项首轮校准的样本回收载体（样本下限见《DoD 校准首轮报告》§二）|

### 三.1 驳回修复轮重出（2026-10-09 · QA 修补③打回后）

- **修复内容**：PB=0（首局/清档）归因行按 `e-personal-best.zeroBoundary` 改出 edge 降级文案『继续热身，稳住节奏』（原误出通用行）；连带面 rule=null 归因槽禁 null 整行隐藏；`SettlementInputs.rule` 类型补 'P3'；`__G2_NM_FORCE` 时序改读 numeric（禁手抄）。
- **证据重出**：契约三态 18/25/29+1PEND（先红后绿，红证据 `01-ac32-red-prefix.log`）· 冒烟 J1=183.2ms · a10 六张同批重摄（**新批 `e3481537…`**：settle-nm 两张与原档逐字节全等未变 · settle-nomoves 构造真值化「先手得分→record 路径」· nm-hit 披露脉冲相位抖动面）· 内测包 30 件随新 build 重出（逐件 sha256 ≡ build）。
- **行为披露（内测可见）**：首局（PB=0）或低分（score<PB×50%）结算归因行 = 『继续热身，稳住节奏』；差值文案『个人最佳 N，就差 M 分』仅 PB>0 且 score∈[PB×50%, PB) 出现。

## 四、提审前置件（全部归主人，团队不代判）

1. 链 v8 **approve**（`cmv0aoxtt004gm9vigjmn09bh` draft 待裁；approve 即 approved 唯一）。
2. 本批实现产物「好不好玩」**人工验收**（本地 `npx serve games/g2-blocks/export/web-v13-beta`；主观感受记录 `docs/playtest-subjective-round1.md` 随附）。
3. 内测启动三件（Q6/Q7/Q8 升级条款）：内测名单 · 回收方式 · 时点。
4. wx/dy 提审动作与时点（Q5）；渠道业务参数（G-Q2 沿挂）。
5. PWA 线上发布（web 面）走 workflow deploy 节点，仅主人拍板后执行。

## 五、证据索引

- N4 对抗复检五轮全链：`gate-logs/v13-nearmiss-n4-20261009/`（run1 3P6R 自曝 → 终轮 9P0R APPROVE-READY · `01-qa-verdict.log`）
- N5 封箱自检：`gate-logs/v13-nearmiss-n5-20261009/01-freeze-selfcheck.log`（三态 18/25/29+1PEND · 复检器 APPROVE-READY）
- 《DoD 校准首轮报告》：源仓 `docs/dod-calibration-round1.md`（样本未回收 · 无门槛结论 · 措辞机判通过）
- 契约三态 / 八门禁 / 冒烟 / P95 同机对：`gate-logs/v13-nearmiss-n2-20261009/`
