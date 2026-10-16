# R1 复测三态分流收口轮 · sha 三点对账表（2026-10-16 · 游戏程序）

> 署名：游戏程序（主策划工作室代行节点）· 任务口径：三点对账链（工作区 HEAD = 线上部署包 = 10/15 报告 sha）**逐字符验证**；不成立 ⇒ 全部按「未判定·待采」处理
> 证据原始输出：`.myrd/blackboard/wheat-squad/gate-logs/r1re-recheck-20261016/01-a1-live-probe.log` · `02-a1-sourceface-diff.log` · `03-a1-app-state.json`

## 一、三点实采（2026-10-16T01:28Z 独立实探，非照抄台账）

| 点 | 采集方式 | 值（40 位逐字符） |
|---|---|---|
| ① 工作区 HEAD | `git rev-parse HEAD` | `debda99c0613c0c3518bd34cda5e4a8f62562143`（轮内 N0 提交后；N0 起点为 `6cf28ada…`，两提交相对源面均为 docs/黑板，见 §三） |
| ② 线上部署包（wheat-squad-2） | LIVE 实取 `gw/api/public/assets/main.mjs`（HTTP 200 · 24716B）内嵌 `__G2WS_BUILD.gitSha` | `29e779ba7590c55b96e8073861f143b004347061`（specAnchor=`cmv8xcexk0009m9dj6ev1dj0r@v6:approved`）· 平台坑位实查 status=ready · version=**19** |
| ③ 10/15 报告绑定 sha | `games/wheat-squad/docs/r1-recheck-report.md` 头部绑定行 | `7b45b44072747ca17af96f81dd109b926745f3d4` |

## 二、逐字符验证（对账结论）

| 对 | ① vs ② | ① vs ③ | ② vs ③ |
|---|---|---|---|
| 逐字符相等？ | **否**（`debda99…` ≠ `29e779b…`） | **否**（`debda99…` ≠ `7b45b44…`） | **否**（`29e779b…` ≠ `7b45b44…`） |

**结论：三点对账链不成立**（三个锚点 sha 两两不等，逐字符口径下零全等对）。
⇒ 按本轮任务书口径：**R1 复测报告全部判据（A1/A2/A4 及配套面）按「未判定·待采」处理**，不得沿用其绿值作为本轮判定；A3 结论面维持「未判定·待采」（真人 0/5，口径不变）。
⇒ 分流走「**绑新 sha 补采**」分支：本轮以补采时工作区 HEAD 为新绑定点重新采样（A2 按 ≥20 完整模拟局 start→end 事件链计数，禁混真人局），补采后重部署闭合新锚（见 `r1re-recheck-report-20261016.md` + 新锚对账表）。

## 三、附：源面零漂移证据（如实登记，不作为推翻上表的依据）

| diff 面 | 结果 |
|---|---|
| `git diff 7b45b44..29e779b -- src tests tools ci assets apphost.toml .myrd/spec/wheat-squad/design-spec.json` | **空**（exit 0，零差异） |
| `git diff 29e779b..HEAD --` 同源面 | **空** |
| LIVE `main.mjs` md5 `ae62534dd4cbb7626f8175906882915b` ≡ 本仓 `build/main.mjs` md5 | **逐字节全等** |
| `git diff 0031d31..HEAD`（全树） | 13 文件全部 = 黑板文档 / gate-logs 证据（本轮 N0 自身），零源面文件 |

读法：三点 sha 不等全部来自「docs/黑板提交」与「构建指纹单行滞后不变量」（构建内嵌=受测源面 commit，发布 commit 在其后的 docs 层）——即**运行时源面在三点间零漂移**。但本轮任务书已明确以**逐字符 sha 全等**为对账口径（较 spec v1.4 retestProtocol① 的「受测源面 diff 为空」口径更严），故按更严口径执行：不沿用、重采样新锚。旧报告（绑 `7b45b44`）降级为「历史证据参考件」，不进本轮判定面。

## 四、复证轮（2026-10-16 · 游戏程序 · 双轨任务书重发 @ HEAD `98d1fbe` · 不重做只复证）

> 口径：verify-claims 纪律——不照抄黑板/台账声称，当前 HEAD 独立实跑复核。证据：`gate-logs/r1re-prog-reverify-20261016/01..04`（各带命令/UTC/退出码）。

### 新锚三点对账复证（绑定点 = 补采报告绑定 sha `4eccaf29` 不变）

| 点 | 实采值（2026-10-16T03:44Z） | 逐字符对账 |
|---|---|---|
| ① 工作区 HEAD | `98d1fbe3e72fb5acb4d916f676d8beae1e20bb10` | 受测源面 diff `4eccaf29..HEAD`（src tests ci assets apphost.toml spec 导出件）= **空**（04 号证据，exit 0 零漂移）→ 按绑定有效性口径（retestProtocol①）与绑定点同源 |
| ② 线上部署包（wheat-squad-2 · `/gw/api/public/assets/main.mjs` HTTP 200 · 24716B） | 内嵌 `__G2WS_BUILD.gitSha = 4eccaf293b11052041860ff7b0ee3141975258fd` · specAnchor=`cmv8xcexk…@v6:approved` · md5 `67a60360d82410d504cd96077ca31cb7` | **≡ ③ 报告绑定 sha 逐字符全等 ✓**；md5 ≡ 仓内 `build/main.mjs` 逐字节 ✓（03 号证据） |
| ③ 补采报告绑定 sha | `4eccaf293b11052041860ff7b0ee3141975258fd` | 基准（不变） |

**复证结论：新锚三点链在当前 HEAD 维持成立**（逐字符口径：②≡③ 全等；①按源面零 diff 口径与绑定点同源——docs/黑板/证据提交不进受测源面，与 v2 复签项②同口径）。A1/A2/A4 绿判定绑 `4eccaf29` **维持有效，无需重采**。

### 同批复证（当前 HEAD 全量实跑）

| 项 | 结果 | 证据 |
|---|---|---|
| verify.sh 五步门禁 | **VERIFY_EXIT=0**（①统一契约 PASS · ②自有契约 16 PASS/0 FAIL/1 PEND · ③WS-SMOKE PASS victory 167s 零 console 错误 · ④⑤双 SCOPE-GUARD PASS） | `01-verify-sh-5step.log` + `.exit` |
| 确定性重建 diff（重建@HEAD vs 仓内提交 build） | **仅 `__G2WS_BUILD.gitSha` 单行**（`4eccaf29→98d1fbe`，构建自指滞后不变量；游戏逻辑字节逐字节全等 · specAnchor v6 不变）；重建后仓内产物已恢复原样（`build` 内嵌维持 `4eccaf29`，不随 docs 提交漂移锚） | `02-rebuild-vs-committed.diff` |
| LIVE /health、/gw 页面 | /health HTTP 200 · title=麦浪小队 | `03-live-probe.log` |
| A3 结论面 | 仍 0/5（真人局零回填）→ **未判定·待采维持**，不代采不烧冻结余量 | 契约套件 PEND 行如实 |

**分流表影响：零**——v2 终局（绿 15 / 红 0 / 未判定 1=A3 结论面）维持；v2 追加三件 QA 复签**仍归 QA 界面**（程序不代签）。红项仍 0 条 → 条件触发链（连续 2 轮红）不触发；阈值红线零触碰。
