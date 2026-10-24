# QA 对外放行记录 — stack-tower M2.1 正式发布轮（N6）

> 记录编号：**QA-LIVE-M21-20260926-02**（承接对内回执 QA-REL-M21-20260926-01）
> 签发：T5 游戏 QA · 日期 2026-09-26 · 性质：**第二段「对外放行」闸**
> 生产对象：deploy `cmuhwtimk0015m97cgvmvcvh7`（tag `stack-tower-m2.1-release` @ `5a3284f`）
> 生产 URL：`https://leomac-studio.tail49399e.ts.net/apps/stack-tower-3/gw`
> **判定：对外放行不通过（FAIL）——release notes 维持扣住（HELD），本次「正式发布」未完成**

## 一、逐项线上冒烟（只认文件级证据）

| # | 冒烟项 | 结果 | 证据（文件名+日期+命令/方法+输出摘要） |
|---|---|---|---|
| L1 | 生产可玩性（在线） | **PASS** | `tests/live-smoke.mjs` · 2026-09-26 · `node games/stack-tower/tests/live-smoke.mjs <gw-url>` → `RESULT: PASS (live)`：画布 480×720、HUD「分数 0」、3 连点「分数 45」、重开归零、PNG/M4A 字节通道 ✓、音效可解码（48000Hz/1ch）、零 pageerror |
| L2 | 首触有声（无痕态冷启动） | **UNVERIFIED（机判受限，如实记录）** | `/tmp/qa-final-probe.mjs`（QA 临时探针）· 2026-09-26 · 线上：AudioContext 解锁后 state=running ✓、6×`sfx-*.m4a` 全 200 ✓、可解码 ✓（live-smoke）、零 pageerror ✓；但「声源节点启动」探针在线上与本地同现未捕获（本地 `buf=0,osc=0` 与线上一致 → 探针交互面问题，非线上独有）；端到端首触听测归真机（U2/B6）。**不判绿不判红** |
| L3 | 断网可玩（SW activate 后） | **FAIL（硬缺陷）** | `/tmp/qa-sw-diag.mjs` + `/tmp/qa-final-probe.mjs` · 2026-09-26 · 线上 `getRegistration()=null`、`navigator.serviceWorker.controller=false`；SW 实际注册进 scope `…/api/public/assets/`（页面 `/gw` 不在其内）→ 页面不受 SW 控制；离线 reload 后无画布 + 1 pageerror |
| L4 | 离线安装三步（装→杀→断网重启可玩） | **FAIL（依赖 L3）** | 同上；SW 不控制页面 → 断网重启不可能从 precache 供源 |
| L5 | 老用户升级（刷新得新版） | **FAIL（机制不可用；本轮无实际损害）** | 2026-09-26 · SW 不控制页面 → 「SW activate 清旧缓存 + skipWaiting/claim」机制在线上壳形态永不生效；本轮发布面与 9/25 版字节全等（healthcheck §1）故用户无实际差异，**但该机制对未来任何内容发布都是坏的** |
| L6 | iOS Safari 真机单列（型号+UA；首触解锁/静音键/后台切回） | **未执行（无真机）** | B6/U3 挂账；需设备型号+UA+录屏 |
| L7 | manifest/icons（线上形态） | **PASS（可达性）/ 备注** | 2026-09-26 · `…/api/public/assets/sw.js` 200（text/javascript）；图标经资产通道 200（live-smoke PNG 通道 ✓）；manifest start_url 已被壳重写指回 `/gw`（`server/src/index.ts:41-45`） |

## 二、L3/L5 根因（QA 会同程序定位，证据充分）

1. 页面注入 `<base href="api/public/assets/">`（壳落地页，`server/src/index.ts:55`）。
2. `navigator.serviceWorker.register('sw.js')` 按**文档 base URL** 解析 → script URL = `…/api/public/assets/sw.js`（200 可达）。
3. 未显式传 `scope`，且响应无 `Service-Worker-Allowed` 头（实测两候选 URL 均无）→ scope 默认 = script 目录 `…/api/public/assets/`。
4. 页面在 `/gw`，不在 scope 内 → **SW 永不控制游戏页面**：离线供源、activate 清旧缓存、skipWaiting/claim 全部空转。
5. 对照：本地 `serve.mjs`（根路径形态）`controller=true`，线上 `false`——差异确凿，非探针伪影。
6. 波及面评估：**9/25 已部署版同缺陷**（同壳同代码）→ 本轮发布未引入回归，但 M2.1「可装」的线上承诺（离线可玩/装后断网玩）自始未在线上成立，且从未被既有门禁覆盖（本地 serve 形态下 SW 正常，d1/d2 契约因此全绿——形态盲区）。

## 三、处置与效力

1. **对外放行 FAIL → notes 扣住不生效**（`release-notes-m21.md` 维持 HELD，L3/L4/L5 未绿前禁止对外宣告「可安装/断网可玩」）。
2. **deploy 不回滚**：线上内容与 9/25 版字节全等，回滚无增益；在线可玩性 PASS，线上游戏本体可用。
3. **止损**：修复需改码（壳 `server/` 注册链路或页面 SW 注册 + `Service-Worker-Allowed`），与「程序只体检不改码」铁律冲突 → **不擅自修复，升级主人裁决**（修复方案见 blockers.md R1）。
4. 门禁红两轮条款未触发（六道门禁全绿；红的是线上形态专项——两段式闸门按设计拦下）。
5. 已知未收口项合并：U1（audio events/bgm-loop 冻结件）· U2（真机三项）· U3（iOS 真机）· U4（v1.1 登记）· U5（试玩终裁）+ **新增 U6（SW scope 线上缺陷，本次对外放行不通过的直接原因）**。
