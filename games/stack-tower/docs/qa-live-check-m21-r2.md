# QA 对外放行记录 — stack-tower M2.1 正式发布轮 · 复验轮（N6'，r2）

> 记录编号：**QA-LIVE-M21-20260926-04**（承接对内回执 QA-REL-M21-20260926-03；前轮对外记录 QA-LIVE-M21-20260926-02）
> 签发：T5 游戏 QA · 日期 2026-09-26 · 性质：**第二段「对外放行」闸**
> 生产对象：AppHost deployment `cmuhzflkk001mm97cxzu1tphg`（tag `stack-tower-m2.1-release-r2` @ `6a6b4a8`，manifestPath=`games/stack-tower/apphost.toml`）
> 生产 URL：`https://leomac-studio.tail49399e.ts.net/apps/stack-tower-3/gw`
> **判定：对外放行不通过（FAIL）——直接原因已从「工程缺陷（U6）」收敛为「平台层缺陷（R2）」，本仓库侧修复已全量落码并门禁取证；release notes 维持扣住（HELD）**

## 一、逐项线上冒烟（只认文件级证据）

| # | 冒烟项 | 结果 | 证据（文件名+日期+命令+输出摘要） |
|---|---|---|---|
| L1 | 生产可玩性（在线） | **PASS（全项）** | `tests/live-smoke.mjs` · 2026-09-26 · `node games/stack-tower/tests/live-smoke.mjs <gw-url>` → 画布 480×720 ✓ / 初始 HUD「分数 0」✓ / 3 连点「分数 45」✓ / 重开归零 ✓ / PNG 魔数 1011B ✓ / M4A 4711B ✓ / 音效解码 48000Hz·1ch ✓ / 在线零 pageerror ✓（日志 `gate-logs/release-m21-20260926-r2/9-live-smoke-n6.log`） |
| L2 | 首触有声（无痕态冷启动） | **UNVERIFIED（机判受限，如实记录）** | 同日志：AudioContext 解码 ✓、sfx 双通道 200 ✓；「声源节点启动」探针交互面受限（沿前轮口径），端到端听测归真机（U2/B6）。不判绿不判红 |
| L3 | 断网可玩（SW activate 后） | **FAIL（根因=R2 平台缺陷）** | 同日志：`registrations=[]`；浏览器报错原文 = `The path of the provided scope ('/apps/stack-tower-3/') is not under the max scope allowed ('/apps/stack-tower-3/api/public/assets/'). … use the Service-Worker-Allowed HTTP header` —— **实例已发该头（三层实测见 §二），被平台公网代理剥离** |
| L4 | 离线安装三步（装→杀→断网重启） | **FAIL（依赖 L3）** | 同上；SW 未注册成功 → precache 不存在 → 断网重启不可供源。本地壳形态模拟门禁（`tests/shell-sim.mjs`，头可达形态）同链路 **PASS**（断网 reload 落块得分 35），证明工程链路本身闭环 |
| L5 | 老用户升级（刷新得新版） | **UNVERIFIED（机制面同 L3）** | 线上内容已更新至 `6a6b4a8`（页面/main.js/sw.js 与本地产物全等，2026-09-26 curl 实证）；「刷新即得新版」的在线面成立，但 SW activate 清缓存/skipWaiting 机制仍被 R2 阻断 |
| L6 | iOS Safari 真机单列 | **未执行（无真机）** | B6/U3 挂账 |
| L7 | manifest/icons（线上形态） | **PASS（可达性）** | 2026-09-26 curl 实证：manifest.webmanifest 200 `application/manifest+json`（start_url 由壳重写指回 /gw）、3 图标经资产通道 200、sw.js 200 `text/javascript` |

## 二、R2 · 平台层根因（三层实测，2026-09-26）

| 层 | 探针 | 结果 |
|---|---|---|
| 实例（绕过代理直连 `http://127.0.0.1:41007`） | `curl -D - …/api/public/assets/sw.js` | **`service-worker-allowed: /` 存在 ✓**（实例代码 `6a6b4a8` 生效实证：同请求 404 文案 `asset not found: …` 为本壳 handler） |
| 平台公网代理（`http://127.0.0.1:3001/apps/<slug>/…`，funnel 上游） | 同上 | **头被剥离 ✗**（`cache-control`/`content-type` 等实例头正常透传，唯自定义/非常见头被滤） |
| 公网（funnel → 3001） | 同上 | 头缺失（funnel 仅转发，非源头） |

- **伴随约束**：平台部署护栏拒绝应用根静态路由——`/sw.js` 路由部署被 catch：「护栏违规：业务路由必须位于 /api/* 下（/health 豁免）。违规路由: /sw.js」（deployment `cmuhz1xds001jm97c9y2wzrp7` 构建日志）。
- **几何结论**：页面固定于 `/apps/<slug>/gw`、脚本必须在 `/api/*` 下 ⇒ 浏览器侧脚本目录（max scope）永远无法成为页面路径前缀 ⇒ **无 `Service-Worker-Allowed` 头则 SW 无法覆盖页面，本仓库侧无解**。
- 工程侧曾试「/sw.js 挂应用根 + precache 键重写」绕开（commit `b44c016`，壳形态门禁 PASS），被护栏拒绝后已回退（`6a6b4a8`），过程留痕入 git。

## 三、R2 处置建议（升级主人，任一即可解）

1. **apphost 公网代理响应头白名单放行 `Service-Worker-Allowed`**（推荐，最小改动；实例已在发，放行即通）。
2. 放宽部署路由护栏：允许应用根静态 `.js`（`/sw.js`）——工程侧绕开方案已实现过（`b44c016`），护栏放开即可重新部署。
3. 或提供非代理的 HTTPS 托管形态（B5 口径：内网 nginx / 静态托管 / Pages），以指认地址复跑 acc-d1。

## 四、处置与效力

1. **对外放行 FAIL → notes 维持 HELD**（`release-notes-m21.md` 不生效；L3/L4/L5 未绿前禁止对外宣告「可安装/断网可玩」）。
2. **生产不回滚**：线上 = tag `stack-tower-m2.1-release-r2` 树，在线可玩全绿（L1），较 9/25 版本无任何回归；R2 解决后无需重新体检即可复跑 N6（工程侧已备妥）。
3. **已知未收口项**：U1（audio events/bgm-loop 冻结件）· U2（真机三项）· U3（iOS 真机）· U4（v1.1 登记）· U5（试玩终裁）· **U7（壳形态 Image 贴图链路，boot 补丁 base64→blob 文本，表现层降级程序化绘制，在线/离线一致不影响可玩，修复点 `server/src/boot-script.ts` 约 3 行，待主人排期）** · **R2（平台头剥离/路由护栏，本次对外放行不通过的直接原因）**。
4. **deploy 事故披露（已纠正）**：本轮第一次 deploy 漏传 `manifestPath`，平台按仓库根清单（糖果线）上传资产，生产串线约 3 分钟（deployment `cmuhynlf7001dm97c8qbxvwx1`，05:40–05:43）——随后以正确清单重部署纠正（`cmuhyrvur001hm97cttva1k0n` → 最终 `cmuhzflkk001mm97cxzu1tphg`），教训入台账（deploy 必带 `manifestPath=games/stack-tower/apphost.toml`）。
