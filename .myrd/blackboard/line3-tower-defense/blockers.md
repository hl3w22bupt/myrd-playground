# 阻塞项黑板 — line3-tower-defense（第三产品线 · 单场景塔防）

> 更新时间：2026-10-23（**组合推进轮 P0-3「备而不动」收口**）· 负责人：主策划（整合）/ 游戏程序 / 游戏美术 / 游戏 QA
> 下一步：**等主人反馈回流**（试玩 + a3 记录卡 + 埋点导出件同批回收）；反馈未回流不开 R1、不产新资产

## P0-3 收口区段（2026-10-23 · 组合推进轮）

| 节点 | 结论 | 产物 |
|---|---|---|
| 程序·门禁复跑 | **verify.sh 五步全绿 VERIFY_EXIT=0 @ HEAD `fa71074`**（复跑前不认任何「门禁已过」；L3-SMOKE 锚 gitSha=`fa71074` + specAnchor=`cmvbqgzbl0029m9ax64foxd37@v2:approved` 当时基线；重建面差异仅锚位 2 处，取证后 restore 回部署锚面树净） | `gate-logs/p0-3-rerun-20261023/01..02` |
| 程序·健康核查 | `/gw` 200（645B landing.html 与本仓逐字节全等 md5 `1ee3ff09…`）+ 线上 manifest gitSha `a27ca0e` ≡ 本仓 ≡ f9d9834 时点三方同值；部署单 v2 running（API 回读）；**对账表判「良性漂移：HEAD 领先 1 docs/门禁提交，构建面零差异，记录差异不重部署**（共板 `recon-line123-20261023.md`） | `p0-1-recon-20261023/03..04` |
| 程序·埋点方案 | **telemetry-plan-v1**（首 30 秒流失/单局时长/再来一局点击，八键零新增，本地持久层零平台 API，实现轮落码） | `line3-tower-defense/telemetry-plan-v1.md` |
| 策划+QA·三问预审 | a1/a2/a4 **可测** · a3 **条件可测（待真人 0/5）** · 首 30 秒流失（真人面）**不可测**→按任务口径出修订；「首 30 秒体验」第一分钟目标行为=a1 已写，硬规则不触发（两结论并记） | `acceptance-preaudit-20261023.md` |
| 策划·spec v1.1 | **链 v4 `cmvkb2d8y001fm968778whydc` approved（2026-10-23T01:43:57Z，唯一 approved）**——只补 a1/a2 真人面可测表述+测量方法，冻结四段深等、id/check 零改动、阈值一字不动；v3 系 meta.version 漏自增修正轮（未 approve 即 superseded，如实留痕）；不计打磨轮 R1、不受「等反馈」约束（主策划裁定） | REVISIONS.md v3/v4 行 · `gate-logs/p0-3-rerun-20261023/10..20` |
| QA·契约同步 | 新基线双门禁复跑 EXIT=0（统一契约门禁识别「平台登记 v4」+ run-all 14/14 auto + a3 PEND 单列） | `20-post-revision-gates.log` |
| 美术·资产盘点 | **零新资产**：可见资产 6/13 封顶内，hash 确定性/风格卡 token/视觉签名映射三面复跑 PASS，方向稿冻结维持 | `assets.md` P0-3 盘点段 |

**阻塞面变化**：零新增；W-L3-1（工作名）/W-L3-2（视觉方向）/W-L3-3（a3 真人 5 名+埋点导出件同批回收）/W-L3-4（数值校准）维持挂起归主人。B-5 已关闭维持（勘误留痕）。


## 续接复核（2026-10-18 · 游戏程序 · verify 全绿 @ HEAD `1b953cd`）

- **独立实跑**：绑定锚 `a27ca0e` 后分支前进 4 个纯 docs 提交至 `1b953cd`（src/tests 零改动）→ 续接线端点复跑 `verify.sh` 四步全 PASS · VERIFY_EXIT=0（契约对账 approved v2 · RUN-ALL 14/14 + a3 单列 · L3-SMOKE 锚=HEAD · SCOPE 零违例）· 构建重生成与提交面差异仅锚位两处，取证后 restore 回部署锚面。
- **线上单次复查**：部署 v1 **running**（commitHash=`b81d17b3…`）· 资产面 manifest gitSha ≡ `a27ca0e` · index 200 → 试玩入口有效，无新增阻塞。
- **阻塞面影响**：W-L3-1..4 / B-5 维持原状（归主人/运维），本轮零新增、零核销。证据 `gate-logs/n4-recheck-20261018-head/01·02`。

## 当前基线（2026-10-18 · 实现轮开工 N0 · 主策划）

| 项 | 值 |
|---|---|
| 黑板路径 | `.myrd/blackboard/line3-tower-defense/`（一游戏一子目录判例延续） |
| spec 版本号 | **链上实查（2026-10-18 API 实证）**：id `cmvbqgzbl0029m9ax64foxd37` · **platform version 2 · status=approved**（2026-10-17T01:44:41Z）· 父版 v1 `cmvabm4kh001jm92c4qtjy9a7` = **superseded**（回查 ✓）· spec.meta.version=1.0（acceptance 15 条 = 14 auto + 1 manual a3）· **导出件 `.myrd/spec/line3-tower-defense/design-spec.json` 与链上回读 spec.spec 深比（Python dict 全等）= True 零漂移 PASS** |
| 当前分支 | `myrd/pixel-fives-m0-m1-cmtpb66pe000rm9e2ozdurf8d` @ `24d545e`（团队续接成果线；工作区仅 `.myrd-platform/.claude/skills/SKILLS.md` 一处平台注入改动） |
| 分支续接结果 | `git fetch origin` 完成（fetch_exit=0）：远端**无** `game/line3-tower-defense`（`git branch -a --list "*line3*"` 空，无可并入游戏线）；`origin/main` 与当前线 **merge-base 为空（无共同祖先孤儿快照线，HEAD `9fbc1dc`）** → 沿 `0ff651f` 判例**不并入**（其唯一增量 = std-skills/web-app-dev 门禁资产，与本轮 A/B/C 三轨无关，如实披露）；两次合并协议在「无 game/* 远端 + main 孤儿」实况下无合并对象，偏差如实披露 |
| 平台 API 通道 | `http://localhost:3111` 可达（/api/v1/health 200 · database connected）；鉴权 = `MYRD_TOKEN` Bearer + cookie 通道 ✓（本会话环境变量在位，GET 回读实测成功） |
| 工程落点 | `games/line3-tower-defense/`（B3 骨架 16 src 文件 + 14 check 薄壳 + run-all fail-closed 占位在盘；**本轮 N4 转真**） |
| 部署通道 | `POST /api/v1/apphost/apps/<appId>/deployments`（deploy-r7 判例原文在档）· manifestPath 沿工程内 `apphost.toml` 判例；**线 3 AppHost app 待建（N5 节点处置）** |

## 本轮升级主人（新增/维持）

| # | 事项 | 负责人 | 状态 |
|---|---|---|---|
| W-L3-1 | 线 3 工作名待定（spec.meta.title 维持工作名占位） | 主人 | 维持挂起 |
| W-L3-2 | 视觉方向拍板（方向稿 3 张：方向 1=基线已可用，方向 2/3=候选须先走 spec revision 改 deriveRule） | 主人 | 维持挂起，不阻塞 N4（方向 1 基线可用） |
| W-L3-3 | ac-a3-td-restart-willingness 真人样本 5 名（**采集窗已开**：LIVE 可玩面就绪） | 主人（圈定）+ QA（采卡） | 采集窗开启，与线 2 同批可合并；0/5 维持未判定 |
| W-L3-4 | **数值校准拍板（新增）**：a2 判据带内通过但 20/20 模拟局战败——敌量×血量双 1.35/波 → 波次总血量 1.82^n 复合增长，8 波通关不可达（levels.md 披露 D3） | 主人拍板 → 游戏 revision 校准（不静默改尺子） | 挂起待拍板；不阻塞试玩 |
| B-5 | **坑位路由串线（新增 · 平台层）**：/gw 壳与 /health 自报 game-9（md5 `abb7c87b6a82` ≡ game-9 壳逐字节全等=W-3 决定性指纹重现）；资产面 `/api/public/assets/*` 全为本部署件（index/main.mjs/spec.json 零漂移 + LIVE-SMOKE PASS）；self-serve 无通道（PATCH 405 / publish|routes|reload 404） | 主人/运维（平台侧路由表/服务束） | 升级处置；试玩走资产面入口不受影响 |

## 当前基线（2026-10-17 · 双轨轮开工登记）

| 项 | 值 |
|---|---|
| 黑板路径 | `.myrd/blackboard/line3-tower-defense/`（本轮起启用一游戏一子目录判例；旧顶层 `line3-memo-v1.md` / `line3-style-card-v0.md` / `line3-memo-v0.md` 原址保留不迁移，新结论落本目录并回写指针） |
| spec 版本号 | 链上现况：id `cmvabm4kh001jm92c4qtjy9a7` · **platform version 1 · status=approved**（2026-10-16T02:34:48Z 被批准——v0.1 骨架 draft 创建后 34 分钟；memo v1 当轮口径「draft 不 approve」与链上实况不一致，**以链上实况为准**如实登记，不回改历史文件）· spec.meta.version=0.1 |
| 本轮目标版本 | spec v1.0（语义版本）经 `POST /api/v1/game-design-specs/:id/revisions` 升 platform version 2（draft）→ QA 预审 → 主策划六判据 approve → 唯一 approved 锁定 |
| 当前分支 | `myrd/pixel-fives-m0-m1-cmtpb66pe000rm9e2ozdurf8d` @ `98d1fbe`（团队续接成果线，362 commits） |
| 分支续接结果 | `git fetch origin` 完成：远端**无** `game/line3-tower-defense` 分支（无可并入游戏线）；`origin/main` 与当前线 **merge-base 为空（无共同祖先的孤儿快照线）**——沿 0ff651f 判例**不并入**（其唯一增量 commit `9fbc1dc` std-skills/web-app-dev 门禁资产与本轮两轨无关，如实登记）；两次合并协议在「无 game/* 远端 + main 孤儿」实况下无合并对象，偏差如实披露于此 |
| 平台 API 通道 | tailnet `https://leomac-studio.tail49399e.ts.net` 与本地 `http://localhost:3111` **均可达**（/api/v1/health 200）；鉴权 = cookie+Bearer token 通道（admin，凭据运行期从平台仓 `.env` JWT_SECRET 现签，不落盘不入库——myrd-platform-auth-and-api 判例） |
| 工程落点 | `games/line3-tower-defense/`（本轮 B3 骨架三件：工程结构 + inventory + 埋点四件桩；**spec approve 前只建结构与占位不写玩法**） |

## 升级主人（维持 + 新增）

| # | 事项 | 负责人 | 状态 |
|---|---|---|---|
| W-L3-1 | 线 3 工作名待定（memo v1 沿用「line3-塔防」；spec meta.title 不锁名） | 主人 | 维持挂起，不阻塞 spec v1.0（slug 已定 `line3-tower-defense`） |
| W-L3-2 | 视觉方向正式拍板（B4 风格卡 v1 四要素 + 方向稿 2-3 张为本轮产物，最终视觉以主人过目为准） | 主人 | 本轮出草案后升级 |
| W-L3-3 | ac-a3-td-restart-willingness 真人样本（5 名）待主人圈定——与线 2 W-6 同批可合并采集 | 主人 | 采集窗前置 = 线 3 建工程可玩面之后（本轮不达），先登记不空转 |
