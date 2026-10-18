# 轨道 B（P1）· g2-blocks（产品线 2 · 任务书轨道口径）sha 答复 · 勘误轮 v2（2026-10-18 · 游戏程序）

> 本文件为 v1（commit `1b953cd`，git 历史可回查）的**重出件**。驳回缺陷1（决定性）成立：v1 证据行4 的「源仓不可达」为**探测根目录用错导致的假阴性**，据此作废并重跑。执行通道不变：本 run 工作区（`run-cmvd4ps6j001bm9wlsel1lzny`）+ 源仓实体 `~/.myrd/workspaces/cmto0g28j0002m9sqnvjdy8o7/g2-blocks`（兄弟目录）。

## 〇、勘误（对 v1 的三处更正）

| # | v1 原文 | 勘误 | 实物证据 |
|---|---|---|---|
| 1 | 证据行4「全盘定位 `dy/port-v1.1`（`~/workspace/*` 各仓）零命中 → 源仓不在本 run 可达面 → 复跑不可执行」 | **错。** 源仓在盘：`~/.myrd/workspaces/cmto0g28j0002m9sqnvjdy8o7/g2-blocks`，检出态 `ref: refs/heads/dy/port-v1.1` @ `023e5838b5e833875fab2e37711d8d3e2d714e2e`，工作树 0 改动；同仓另有 4 个 worktree（main/`9c27438`、n1、v13、wx）。该路径 2026-10-11 N0 轮即登记为源仓（本黑板 blockers.md「源仓现状（开工实查）」行） | `.git/HEAD` 实读 + `git rev-parse HEAD` + `git status --short`（空） |
| 2 | 答复行1「`023e583` 不是当前 HEAD 而是历史基线」 | **对盘上检出仓不成立。** `023e5838` 就是任务书所指「注册仓当前 HEAD」（dy/port-v1.1 线头，检出态）；它同时也是 v1.1 移植轮基线——两个陈述相容：线头身份与历史基线身份同一，v1 把后者当成了对前者的否定 | `git -C <源仓> branch -vv`：`* dy/port-v1.1 023e583` |
| 3 | 判定「对齐环境复跑不可执行于本 run」 | **作废。** 本轮已在该仓实跑门禁复证（见 §二/§三），四段日志原文落档 | `gate-logs/sha-answer-rerun-20261018/00..04` |

## 一、sha 疑点正式答复（v2）

**问**：昨日 deploy 与 R2 证据绑定 sha 是否 = 注册仓 g2-blocks 当前 HEAD（`023e5838` / `dy/port-v1.1`）？

**答**：**不等（失配成立）——且「不一致先对齐环境复跑」已于本轮履行，两线复跑全绿。**

| # | 主体 | 绑定 sha | 与 `023e5838` 关系 | 证据 |
|---|---|---|---|---|
| 1 | 昨日 deploy（r7 · v17 · running） | `2bb69c7`（部署提交；源面 = 同仓 worktree `g2-blocks-main` @ `sync/dy-v1.3` `9c27438`） | **≠**（部署线与 dy/port-v1.1 是同仓两条线；N2 轮 `merge dy/port-v1.1` 后继续演进） | 平台 API 实查 v17 `commitHash=2bb69c7ecd3d` · 子黑板 blockers.md 产物溯源三向绑定行 |
| 2 | R2 轮证据链 | `19bf249→…→cf967ec`（12 commit） | **≠** | 子黑板 blockers.md R2 轮台账 |
| 3 | 注册仓当前 HEAD（任务口径） | `023e5838` / `dy/port-v1.1`（检出态成立） | =（基准本身） | 本文件 §〇 勘误1 |

**部署面 ↔ 源面等值复核（本轮新增）**：`games/g2-blocks/export/web`（部署镜像）vs 源仓 `build/` @ `9c27438`：`diff -rq` 唯一差异 `sw.js` 缓存版本号一行（`CACHE = 'g2-9-…'` 时间戳）＝ 10-11 轮已登记的良性残留判例，业务产物逐字节等值 → r7 部署面的源面确为 `9c27438`。

## 二、对齐环境复跑（「失配的绿不算绿」履行记录）

统一口径：`G2_REPO_ONE_ROOT` / `G2_SPEC_PATH` 族**全 env 显式锚定本 run 工作区**（防旧 run 污染；ac-17 机判 root=`run-cmvd4ps6j001bm9wlsel1lzny`）。两仓工作树实跑前后均 0 改动（dy-smoke 覆写件按该仓判例 `git restore` 还原）。

| 线 | HEAD | 门禁（CI 同入口） | 结果 | 日志（含退出码原文） |
|---|---|---|---|---|
| **A：任务口径当前 HEAD** | `dy/port-v1.1` @ `023e5838` | `scripts/contract-check.mjs`（v1.1 approved 存档锚 18 条） | **18/18 PASS · exit 0** | `00-contract-v11-023e5838.log` |
| 同上 | 同上 | `tests/run-all.mjs`（八件聚合：守卫/色板/theme/冻结值/内核确定性/acceptance 映射/关卡/平台前置） | **8/8 PASS · exit 0** | `01-gate-all-023e5838.log` |
| **B：部署源面（r7 线）** | `sync/dy-v1.3` @ `9c27438`（worktree） | `scripts/check-v13.mjs`（四态：18/25/29+1PEND/29+1PEND） | **四态全符 · exit 0** | `02-checkv13-contract-dy-9c27438.log` |
| 同上 | 同上 | `scripts/contract-check.mjs`（v9 共同输入 30 条） | **29+1PEND · exit 0** | 同上 |
| 同上 | 同上 | `tests/dy/run-all-dy.mjs`（dy 三条：11/6/10） | **27 PASS · 0 RED · exit 0**（首轮漏 `G2_SPEC_PATH_V6` 锚 RED，02 号日志原文保留不覆盖，补锚重跑见 03 号） | `03-dy-gates-v6anchor-9c27438.log` |
| 同上 | 同上 | `tests/dy/dy-smoke.mjs`（chromium 全链路） | **PASS · exit 0**（J1=146.1ms ≤400 · 613 手 · score=9432750 · 零 console/worker 错误——判定值与 10-11 轮 `02-dy-gates-rerun.log` **逐字一致**＝确定性复现） | 同上 |

**映射表抽验（本轮可达面补做 · QA 口径 ≥2 条）**：源仓 `assets/MAPPING.md` @ `9c27438`，抽第 1、第 6 交付行机判：①`palette-n1-final.json` sha256 ≡ `numeric.palette.sourceSha256`（`7bc2ca033ee8d7f7…` 全等）②`e-board-block-tiles.json` `tiles[].id` ≡ `palette.colors[].id` 七枚全等；另 4 件目标存在性 PASS。**抽中 0 错 → 整表不打回**（抽验脚本首轮取形错误 RED 如实留档，修正重跑同文件）。日志：`04-mapping-sample.log`。

## 三、对归类与闸门的影响

| 项 | v1 口径 | v2 口径 |
|---|---|---|
| sha 失配 | 失配成立，无法复跑，「历史证据维持 · 本轮未复证」 | 失配成立，**已复跑补证**：`023e5838` 线独立全绿（绑 `023e5838`），部署线在 `9c27438` 全绿（绑 `9c27438`）——两条绿各自绑定各自 sha，不再有「失配的绿」悬空 |
| B-1 源仓访问面 | 升级主人（错误：访问面本就存在） | **撤销**（升级对象错误）；源仓面门禁已实跑归档 |
| B-6 链面修复（链上 0 approved） | 升级主人 | **维持**：契约绿绑的是仓内 approved 存档/共同输入导出件，**平台链资质仍 0 approved**（v1–v10 全 superseded），须 revision 入链 + 主人 approve 恢复 |
| 提审凭证 | 归主人，缺失 | **维持**（归主人，与本缺陷无关） |
| 归类 | 继续打磨（R3） | 维持**继续打磨（R3）**，但 R3 前置闸门修正为「B-6 链面修复 + 主人凭证」两项；映射抽验面已补齐 |

**判定人**：游戏程序（sha 答复 + 门禁复跑）· QA 限制性核签同步重出（`qa-trackb-signoff-20261018.json` v2）
