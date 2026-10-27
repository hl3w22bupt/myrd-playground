# N6 对抗用例预研 — g2-blocks（QA 线 · A 轮）

> 更新时间：2026-10-03 · 负责人：QA 线（设计）/ 主策划（整合落盘）
> 口径：**逐条可执行**（有命令、有预期、有判定），**不依赖装配区**（只依赖 g2-blocks 仓库 + spec 导出件 + 平台接口）。
> 生效时机：N7 round-2 复检逐条核；N8 实现轮把「待实现」列转为机判。
> 环境钉值（防兄弟 run 误锚，全表通用）：
> `G2_SPEC_PATH=<run>/.myrd/spec/g2-blocks/design-spec.json`（approved v1.1）
> `G2_SPEC_V12_PATH=<run>/.myrd/spec/g2-blocks/design-spec-v1.2-draft.json`（v1.2 draft）
> `G2_REPO_ONE_ROOT=<run>`
> 基线 commit：g2-blocks @ `bb4c836` · 一号 @ 见 blockers.md 当前基线

## 维度一 · 时区 / 时钟

| # | 用例 | 命令 | 预期 | 状态 |
|---|---|---|---|---|
| 1.1 | 同刻三时区日期码互异（东八区跨日） | `node -e "import('g2-blocks/src/kernel/datetime.ts').then(m=>{const t=Date.UTC(2026,9,3,20,0,0);console.log(m.localDateCode(t,0),m.localDateCode(t,-480),m.localDateCode(t,300))})"` | `20261003 20261004 20261003` | ✅ 已机判 |
| 1.2 | 本地零点跨日（daily 重置点） | 同上，t=`Date.UTC(2026,9,3,15,30,0)` 与 `+3600e3` | `20261003` → `20261004`；`sameLocalDay=false` | ✅ 已机判 |
| 1.3 | 可注入时钟复现（不睡真实时间） | `steppedClock(t)` + `advanceMs(86400e3)` | `nowMs()` 精确等于 t+86400e3，无系统时钟读取 | ✅ 已机判 |
| 1.4 | 时区偏移越界拒绝 | `localDateCode(0, 900)` | 抛 RangeError（±14h 外），不静默归零 | ✅ 已机判 |
| 1.5 | DST 折叠不产生重复种子（对抗） | 枚举 2026 全年 8640 个 10 分钟刻度 × tz∈{0,-480,300}，断言日期码集合无空档 | 每个时区日期码连续、无跳号（daily 不因 DST 丢一天） | ⏳ 待实现轮（需日历枚举件） |
| 1.6 | 时钟倒拨对抗（玩家改系统时间刷 daily） | `steppedClock` 先 t 后 t-86400e3 | 记录 lastSeenDateCode，倒拨不增 streak（**裁决需 numeric 补 `allowBackdate` 语义，见开放问题 Q1**） | ⚠️ 升级主人 |

## 维度二 · combo 取整边界

| # | 用例 | 命令 | 预期 | 状态 |
|---|---|---|---|---|
| 2.1 | 三键声明面 + 类型值域 | `node scripts/contract-check.mjs --only ac-19-combo-multiplier-numeric`（G2_SPEC_PATH=v1.2 draft） | PASS（三键唯一真源 / step∈(0,1] / rounding 枚举） | ✅ 已机判 |
| 2.2 | floor 取整方向对抗：`1 + floor((max-1)/step)` 档位不越上限 | ac-19 内 ⑤（同上命令） | PASS（floor 永不向上溢出） | ✅ 已机判 |
| 2.3 | 倍率序列全部向下取整（枚举 chain=2..50） | 读 numeric.combo，`mult(chain)=min(max, 1+floor((chain-appliesFrom)*step))`（N8 实现后） | 每档 ≤ max；`rounding=floor` 时无 0.5 尾数档 | ⏳ 待实现（N8-combo） |
| 2.4 | appliesFromChain 之前不加分（v1.1 语义不回归） | ac-06 四手向量复跑 | +0/+50/归0/+0 逐字命中（chain<2 不加成） | ✅ 既有契约 |
| 2.5 | 非消除手归零（resetOnNonClear=true） | ac-06 第 3 手（不消）后 chain 读数 | chain 归 0，下一手按 chain=1 无加成 | ✅ 既有契约 |
| 2.6 | max 边界手感（chain 远超 max/step 档数） | 枚举 chain→∞ | 倍率钉死 max，不无限叠（对抗「连击无限涨」） | ⏳ 待实现（N8-combo） |

## 维度三 · 派生式反漂移

| # | 用例 | 命令 | 预期 | 状态 |
|---|---|---|---|---|
| 3.1 | level-stars 派生声明面（升序/一星=1B/间距单调不减） | `node scripts/contract-check.mjs --only ac-21-level-stars-derived`（v1.2 draft） | PASS | ✅ 已机判 |
| 3.2 | 契约/代码零绝对分 | `grep -rn "levelStars\|numeric.levelStars" g2-blocks/src/` → 应为零命中（draft 态） | 零命中（红线①） | ✅ 已机判 |
| 3.3 | v1.1 锚零漂移 | acmap/g+h（`npm run gate` ⑥） | 生成件锚 ≡ `302e6336…` | ✅ 已机判 |
| 3.4 | v1.2 锚独立重算（不经构建器） | 平台 GET v3 → sortKeys+sha256 | = `00ca798c…`（与 post 输出一致） | ✅ 已机判（post 回读） |
| 3.5 | v1.2 与 v1.1 diff 面 = 白名单（对抗「顺手改别的」） | `node tools/build-spec-v12.mjs`（复跑八道守卫 ②③④） | 全 PASS；任一越轨键即 RED | ✅ 已机判 |
| 3.6 | 三档绝对分反推一致性（N8 后） | 实现轮产出三档分 → `score/threshold` 反推比率 ≈ numeric.thresholds | 比率一致（容差 0），即 B 唯一 | ⏳ 待实现（N8-level-stars） |
| 3.7 | numeric 段为唯一真源（全工程扫描） | `grep -rn "1.5B\|2.2B\|maxMultiplier=5" g2-blocks/{src,tests,scripts}` | 仅 spec 导出件与契约件声明面命中，零第二实现源 | ⏳ 待实现（N8 后复扫） |

## 维度四 · 存储迁移

| # | 用例 | 命令 | 预期 | 状态 |
|---|---|---|---|---|
| 4.1 | 门面默认零新增落盘键 | `tests/platform-facade.spec.mjs` T1b | PASS（迁移后键数 ≤2） | ✅ 已机判 |
| 4.2 | 迁移 toVersion 严格 +1（跳版/重复拒绝） | T1c | PASS（两次构造均抛错） | ✅ 已机判 |
| 4.3 | 迁移非破坏（不删任何既有键） | T1d（`userHintSeen` 仍在） | PASS | ✅ 已机判 |
| 4.4 | 迁移幂等（二次 migrate 零改写） | T1e / T1e-2 | PASS | ✅ 已机判 |
| 4.5 | ac-16 键级最小集不降 | `node scripts/contract-check.mjs --only ac-16-persistence-minimal` | PASS（muted/anonId · 未知键拒绝 · 零网络构造） | ✅ 已机判 |
| 4.6 | 遗留脏数据迁移（`muted:'on'/'true'`） | T1d | 归一为 `1`，anonId 不动 | ✅ 已机判 |
| 4.7 | v1.2 daily 新键走注册制（N8 后） | N8 实现：`facade.registerKey('daily.*')` 后读写；未注册键写入抛错 | 键越轨=红（键集随 spec 声明面扩展，不自由增长） | ⏳ 待实现（N8-daily） |
| 4.8 | 迁移中断可恢复（对抗：写一半崩） | N8 后：构造 version=0 + 部分写入 → `migrate()` | 单调收敛到目标版；重放幂等 | ⏳ 待实现（N8-daily） |

## 维度五 · 跨端口径

| # | 用例 | 命令 | 预期 | 状态 |
|---|---|---|---|---|
| 5.1 | J1 预算跨端同源（标记名/预算逐字 = numeric） | `node scripts/contract-check.mjs --only ac-10-perf-j1` | PASS（@throttle×4 · 390×844） | ✅ 已机判 |
| 5.2 | 帧率 P95 代理口径披露 | `docs/evidence/perf-p95-report.md` | 基准跑 fps=60 / P95=16.7ms（throttle×1）· throttle×4 不用 16.7ms 判 | ✅ 已产出（真机终判待） |
| 5.3 | 视口/缩放真机口径 | `tools/screenshot.mjs`（viewportPx 读 numeric） | 390×844 @2x；截图尺寸 = 视口×2 | ✅ 已机判 |
| 5.4 | 零贴图跨端（位图门禁） | `node scripts/contract-check.mjs --only ac-13-no-external-texture` | PASS（src/+build/+入口零位图；素材 PNG 只在 assets/release/） | ✅ 已机判 |
| 5.5 | 素材尺寸跨平台规格 | `assets/release/release-assets.json` | 9 件 IHDR 机判全等（512/192/180/32/16/1200×630/500×400/720×1280） | ✅ 已机判 |
| 5.6 | 色值跨端单源（素材 ↔ 游戏 ↔ spec） | `--only ac-11-theme-single-source` + 生成器零裸 hex | 三者同源（PALETTE 7 冻结色） | ✅ 已机判 |
| 5.7 | wx/dy 分享链路口径（标题/缩略图/落地页） | **开放**：渠道参数未在 spec 冻结面 | 需 numeric 或发布清单补字段（**Q2 升级主人**） | ⚠️ 升级主人 |

## 维度六 · 回归基线

| # | 用例 | 命令 | 预期 | 状态 |
|---|---|---|---|---|
| 6.1 | 契约全量（approved 基线） | `node scripts/contract-check.mjs`（G2_SPEC_PATH=v1.1） | **18 PASS / 0 FAIL · EXIT=0** | ✅ 本轮基线 |
| 6.2 | v1.2 三条新 check | `--only ac-19/20/21`（G2_SPEC_PATH=v1.2 draft） | 3/3 PASS | ✅ 本轮基线 |
| 6.3 | 八门禁 | `npm run gate` | ①–⑧ 全 PASS | ✅ 本轮基线 |
| 6.4 | 冒烟 | `node tools/smoke.mjs` | SMOKE: PASS · J1 ≤ 400ms（本轮实测 170–183ms） | ✅ 本轮基线 |
| 6.5 | 内核确定性（seed 链） | `--only ac-14-deterministic-kernel` + ⑤ 门禁 | 双 sim 逐字节一致 · 零内建当下 | ✅ 本轮基线 |
| 6.6 | 一号仓库零接触 | `--only ac-17-repo-one-zero-touch` | PASS（root=本 run） | ✅ 本轮基线 |
| 6.7 | 发布 commit 原始输出对账 | 黑板 `gate-logs/deploy-20261002/` | 契约 18/18 + 冒烟原文可复核对账（B3） | ✅ 已归档 |
| 6.8 | v1.2 实现后回归（N8 完成时） | 6.1–6.6 全套 + 3 条新 check + `18→21` 全量 | 全绿不降；21 条全 PASS 需 spec-data 重生成（approve 后） | ⏳ N8 验收门 |

## 开放问题（超一轮未解 → 升级主人）

| id | 问题 | 影响 | 建议裁决 |
|---|---|---|---|
| Q1 | daily 时钟倒拨语义（`allowBackdate`）未在 numeric 声明 | 1.6 无法机判；反作弊口径悬空 | v1.3 补 `daily.backdatePolicy`（建议 `ignore`） |
| Q2 | wx/dy 分享链路（标题/缩略图/落地页）不在 spec 冻结面 | 5.7 无裁决依据；提审素材可能缺字段 | 归发布就绪清单（红线④口径），或 v1.3 补 `share` 段 |
| Q3 | A-09 typeScale 代改（0.036/0.016/0.043）待美术线认领 | 素材与实机 HUD 视觉一致性 | 美术线复核；不认可则回滚并出 A-09 替代案 |
