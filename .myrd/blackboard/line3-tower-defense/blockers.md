# 阻塞项黑板 — line3-tower-defense（第三产品线 · 单场景塔防）

> 更新时间：2026-10-17（双轨轮 · B 轨开工）· 负责人：主策划（整合）/ 游戏程序 / 游戏美术 / 游戏 QA
> 下一步：B2 spec v1 六件套 → 三合一包发美术 → B4 风格卡 v1 → B5 QA 预审 → B6 主策划 approve（六判据）

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
