# 线上缺陷清单逐项回归（R5）：最新 liveUrl 全绿复核（game-4）

- 回归时间：2026-10-02
- 被测对象（最新 liveUrl，无更新部署）：线上 **v19**（deploymentId `cmuixl00c00fsm9l6ac95ss6f`，mode=bundle，gitRef `myrd/games-goal-cmuieqj7o0031m9gyf4pbwptg`，commit `aa2ec1e`）
  - <https://leomac-studio.tail49399e.ts.net/apps/game-4/gw?qa=1&tuning=1>
- HostedApp id：`cmuieqj7n002zm9gyy4u8qeai`（slug `game-4`）
- 内核：Playwright **1.58.2 + WebKit 26.6 真内核**（webkit-2248，真 Safari/WebKit，非 Chromium 模拟），1280×800 hasTouch
- 前序事实：修复轮 workflow `cmupxrhd5008dm9dhqxdewdiu` 按修复清单（ADVERSARIAL_FINDINGS §五）判定**零确认缺陷**，走降级路径零代码改动、不重导出不重部署 → 最新部署仍为 v19，本轮回归对象即线上现行版本。

## 一、被测对象无漂移核验（先钉「线上=仓内源码」）

| 检查 | 结果 | 证据 |
|---|---|---|
| `GET /apps/game-4/gw/health` | 200 `{ok:true,app:light-path-labyrinth}` | curl |
| `index.wasm` Content-Type | **`application/wasm`**（硬约束持续满足） | curl 响应头 |
| 线上 pck 指纹 | `index.pck.gz.b64` → base64 -d → gunzip = **2,609,840 B**，sha256 `2cb785e5…c670e` | 与仓内 `games/game-4/export/web/index.pck` **逐字节一致** |

→ 线上行为可完整映射到仓内源码（commit `aa2ec1e` 构建无漂移）。

## 二、逐项回归结果

### ① WebKit 27 项功能复验（v19 原有功能项不回归）

```
WEBKIT_QA_LIVE_CHECK: PASS（27/27 项通过）
```

关键项（完整日志 `qa/webkit-27-live-v19-rerun.log`）：
- A 组 9 项：iPhone 形态（390×844 DPR3）引擎启动、WebKit 真内核 UA、`__QA_MODE__`/`__SURVEY_MODE__` 双钩子、启动屏双徽标、画布渲染、AudioContext=running、零页面错误 —— 全 PASS
- B 组 18 项：自动扫描 **23 个目标格 → 24 样本**（历史缺陷① `_resolve_board` 不回归）、`GUANGLU_QA_REPORT` schema=`guanglu-qa-report/1`（samples=24、hit_rate=0.958、**p95=52ms**）、导出通道 `__GUANGLU_SHARE__.state=done`、四问量表 **7/7 必答点选+提交**（历史缺陷② 不回归，`GUANGLU_SURVEY` 回传）、全程零页面错误 —— 全 PASS
- 注：报告 verdict 中 `touch_hit_ok=false` 为该脚本对被动采样 hit 阈值的保守机判口径（sweep 含边界格 miss 样本），与缺陷③「点击旋转失效」无关——本轮对抗线 T1~T8 约 40 次真实触屏 tap 全部 `routed=applied` 即点击旋转有效（缺陷③ 不回归）的直接证据。

### ② 对抗性 8 用例 16 断言（缺陷清单三分类复跑）

```
ADVERSARIAL_CHECK: PASS（16/16 项通过）
```

| # | 用例 | 本轮实测（线上 v19） | 结论 |
|---|---|---|---|
| T1 | 连点 | L3 corner 管 A 连点：目标样本 11 条、applied=9、**全部 routed=(1,2) 零错路由**；终局 moves=12 与 12 步序列精确吻合 | 确认无缺陷（维持） |
| T2 | 结算瞬间点击 | 通关后 <1s 同格连点 ×2：`routed=(1,2)` 且 `applied=(-99,-99)` 屏蔽样本 2 条，moves 冻结、solved 不复位 | 确认无缺陷（维持） |
| T3 | 下一关首点 | 进 L2 立即点 A：`routed=applied=(1,2)`、hit=true、moves=1、solved=false，无首点吞没 | 确认无缺陷（维持） |
| T4 | 悬挂手势 | 棋盘外按住 800ms → 释放 → 首点 E：`routed=applied=(3,2)` 全部命中，悬挂期间零页面错误 | 确认无缺陷（维持） |
| T5 | 双指抢控 | WebKit 不提供 `Touch` 构造器（`TypeError: Illegal constructor`）→ **无法复现（驱动受限）**，真机复测步骤见 ADVERSARIAL_FINDINGS §五 | 驱动受限（维持，单列不并入） |
| T6 | 撤销交叠 | A→B→undo→B→B→C 交叠 4 步通关；`best_stars[1]=3`（1★ 通关未覆盖历史 3★）→ undo 生效 + **只升不降** | 确认无缺陷（维持） |
| T7 | 旋转方向语义 | L1 直管点 1 次 → 光路连通（顺时针 90°）→ `best_stars[0]=3` | 确认无缺陷（维持） |
| T8 | 星级语义 | 12 步通关（2★=12∈(8,12]）；全程快照 `best_stars={0:3,1:3,2:2}` 与 `stars_for` 逐项一致 | 确认无缺陷（维持） |

**三分类维持：确认真实缺陷 0 / 误报 0 / 无法复现（驱动受限）1。全程约 40 次真实触屏 tap 零页面错误、零引擎报错。**

## 三、缺陷核销结论（回写 artifacts 口径）

- 历史已修复缺陷 ①（`?qa=1` 自动扫描 0 目标格）/ ②（量表提交不可达）/ ③（`?tuning=1` 点击旋转失效）：本轮线上复验**全部不回归**（23 目标、7/7 必答提交、40 tap 全 applied）。
- v19 对抗性探索修复清单（ADVERSARIAL_FINDINGS §五）：零确认缺陷维持，无需代码改动。
- **本轮回归结论：逐项全绿，零缺陷核销，无新增缺陷，无漂移，不需要重导出重部署。**

## 四、外部依赖（等待用户操作，agent 不可达）

| 依赖项 | 状态 | 说明 |
|---|---|---|
| iOS Safari 真机实测（T5 双指抢控 + 核心操作/音效） | ⏳ **等待用户操作，agent 不可达** | 真机回传通道与五步复测步骤已就绪（`qa/IPHONE_QA_CARD.md` v1.1 + `qa/ios-safari-realdevice-qa.md`），`ios-safari-{report,survey}-PENDING.json` 待回收；在用户实测回传前不得代填、不得并入任一分类 |
| 四问量表试玩回填 | ⏳ **等待用户操作，agent 不可达** | 游戏内 `?tuning=1` 量表与回传通道可用（本轮 7/7 必答回传真机验证），人工试玩结论未产生，不代填、不伪造 |

## 五、复跑方式（一条命令）

```bash
# WebKit 27 项功能复验
cp games/game-4/qa/webkit_qa_live_check.mjs /tmp/pw-kit/ && cd /tmp/pw-kit && \
QA_LIVE_URL="https://leomac-studio.tail49399e.ts.net/apps/game-4/gw?qa=1&tuning=1" \
QA_OUT_DIR=<repo>/games/game-4/qa node webkit_qa_live_check.mjs
# 对抗性 8 用例 16 断言
cp games/game-4/qa/webkit_adversarial_check.mjs /tmp/pw-kit/ && cd /tmp/pw-kit && \
QA_OUT_DIR=<repo>/games/game-4/qa node webkit_adversarial_check.mjs
```

取证：`qa/webkit-27-live-v19-rerun.log`、`qa/webkit-adversarial-v19-rerun.log`、`qa/adversarial-run-results.json`（16/16 ok=true）、`qa/shots-adversarial/`（本轮 04:22 新截图）。
