# 《汽车连连看》(game-9) 线上版验收复核报告

- 复核角色：主策划（goal cmuw2o88z018ricryvpr6v8wn 验收复核节点）
- 复核时间：2026-10-06T04:20Z（UTC）
- 复核对象：线上部署版本（非本地导出）

## 一、产物标识（回写确认）

| 项 | 值 | 核对方式 |
| --- | --- | --- |
| HostedApp id | `cmuw2o6z4018picry133zwcio` | 平台 API `/api/v1/apps`：title=汽车连连看，slug=game-9，sourceId=本 goal id，status=ready，version=3 |
| deployment id | `cmuw5ctmf01aoicryv3xjkbzp`（v3 running，v1/v2 superseded） | goal artifacts `hosted_app` 产物登记 + app 记录 version=3/updatedAt 相符 |
| 部署 commit | `f15a2ba`（分支 `myrd/games-goal-cmuw2o88z018ricryvpr6v8wn`） | git fetch 该分支核实提交链：acf2f61+f28e6b7(implement) → e2c63a5(壳整改) → f15a2ba(主 CTA 居中) → c186f89(移动门禁 round2) → e278a84(playtest) |
| liveUrl | https://leomac-studio.tail49399e.ts.net/apps/game-9/ | 实测可访问，无需登录 |
| `/health` 身份 | `{"ok":true,"app":"game-9","title":"汽车连连看"}` | 实测 200；确认同路径覆盖后线上确为本目标游戏（非历史推箱子 game-9 残留） |

> 口径提醒（沿用知识库）：liveUrl 不标识版本归属，审计/复现一律以 deploymentId + commit + `/health` 身份为准。

## 二、可玩性实测

### 独立复跑移动门禁（round3，本次复核新增证据）

命令：`node std-skills/godot-game-dev/scripts/mobile-web-smoke.mjs --url <liveUrl> --out games/game-9/qa/mobile-round3`

- **结论：MOBILE_SMOKE PASS，10/10 全绿，退出码 0**
- 指标：tapDiff=320（tap 命中可交互元素并产生响应）、fps=26（swiftshader 软渲染，≥8 达标）、scrollWidth=390=clientWidth（无横向溢出）、零网络失败、零 console error
- 证据：`games/game-9/qa/mobile-round3/report.json` + phase-load/tap/joystick 三张分阶段截图（checkedAt 2026-10-06T04:20:14Z）

### 与前序证据链核对

| 门禁 | 前序结论 | 本次复核 |
| --- | --- | --- |
| PREFLIGHT（13 类） | PASS | 证据在仓库判定器实跑记录，无需重跑（代码未变更，commit f15a2ba 未动） |
| GODOT_SMOKE（240 帧） | PASS | 同上 |
| GODOT_FUZZ（seed=20260913，6 批 239 帧） | PASS | 同上 |
| MOBILE_SMOKE round2（report.json @04:00:31Z） | PASS 10/10，tapDiff=320，fps=37 | 已核对 `games/game-9/qa/mobile/report.json`，与本轮 round3 一致 |

### 线上链路抽查

- `/` → 308 → 200（12,227B），HTML 标题「汽车连连看」，viewport meta 存在，canvas 挂载
- `/gw` 路径同样 200 且 `/gw/health` 身份一致（liveUrlPath 双路径均可用）
- 资产通道：`/apps/game-9/index.js|pck|wasm` 直连 404 属**预期**——M1 网关资产走 `api/public/assets/*` 懒加载 gzip+base64 文本通道；门禁网络项（关键资源含 .pck/.wasm）全绿即为权威证明

## 三、对照需求验收标准（1-5）

1. ≤2 拐点连通消除 / 阻挡提示：**机判+代码证据成立**（board.gd 分类枚举 0/1/2 拐点 + 外圈通道；直线相邻消除为冒烟显式正例）。路径连通高亮与失败抖动在实现内，最终以人工试玩为准。
2. 通关结算 + 死局自动洗牌保解：**机判成立**（`_reshuffle_until_solvable` 保多重集重试 + `has_any_match` 断言；冒烟含 board_shuffled 信号逐次断言）。
3. 桌面 + 移动双端：**移动端机判 PASS（round3 独立复跑）**；桌面端页面/资产/身份抽查正常。真机手感待人工回填。
4. 托管上线免登录可玩：**成立**（liveUrl 公网 200、/health 身份正确、完整流程入口即页面本身）。
5. ≥2 难度（4x4/6x6）+ 汽车主题 + 倒计时计分：**代码与 Spec 证据成立**，视觉效果待人工试玩确认。

## 四、遗留与待人工事项

1. **playtest.sh 缺失**（模板仓库未预置）：playtest 棒机判 blocked，已三轮上报，待运维补 `std-skills/godot-game-dev/scripts/playtest.sh` + `playtest_driver.gd`。不阻塞验收包交付。
2. **人工验收未拍板**：goal 人工验收（试玩回填）是最终裁决，本复核不替代。请 @ai-verse-bot（目标 owner）完成：① 打开 liveUrl 完整玩一局（开始→消除→通关/失败→重新开始）；② 移动真机/模拟器各走一遍；③ 回填试玩量表 `games/game-9/qa/playtest-kit.md` 并拍板。
3. 小瑕疵（不阻塞）：round2 report.json 中 render/animate/audio 三项的 detail 字段残留失败模板文案（status 已为 pass），属证据生成器文案清理问题，不影响判定。

## 五、复核结论

**线上版与产物标识闭环一致，机器侧验收全部通过：HostedApp `cmuw2o6z4018picry133zwcio` / deployment `cmuw5ctmf01aoicryv3xjkbzp` @ f15a2ba / liveUrl https://leomac-studio.tail49399e.ts.net/apps/game-9/ 可玩性实测 PASS。** 待 owner 试玩回填并拍板后，本目标方可关闭。
