# [CHECKPOINT] game-7《星云穿行》Web 导出 + AppHost 部署交付

- 目标 cmujmfy0r002im99i3inkbu6i · 需求 cmujmowd6003bm99i5zjlwlzz · AppHost cmujmfvha002gm99i1lpbo1fr（slug game-7）
- 分支 myrd/games-goal-cmujmfy0r002im99i3inkbu6i（由前序基线 bd9cee8 新建，随后的玩法工作整体在其上）· 工程 games/game-7
- 本节点：deploymentId=cmujp6rmj005em99imb5my7cw · commit a620bd3 · liveUrl=https://leomac-studio.tail49399e.ts.net/apps/game-7/

## 前置检查（全部通过）

| 项 | 结果 |
| --- | --- |
| 功能分支 | `git branch --show-current` = myrd/games-goal-cmujmfy0r002im99i3inkbu6i（要求分支原先不存在，从含玩法产物的基线新建，未用 main） |
| 远端 | origin = https://github.com/hl3w22bupt/myrd-playground.git；push 后 ls-remote 确认 a620bd3 与本地 HEAD 一致 |
| 门禁资产 | std-skills/godot-game-dev/scripts/ 内 preflight.py / smoke.sh / input-fuzz.sh / resolve-godot.sh 均在；**playtest.sh 模板仓库仍未预置**（沿前序口径记录，godot-smoke routine 未引用，verify.sh 只调真实存在的脚本，未自造未复制注入副本） |
| Godot | resolve-godot → 4.3.stable.official.77dcf97d8，`--headless --version` 正常 |

## 门禁记录（提交部署前本地自检，与 godot-smoke 同源）

| 步骤 | 结果 |
| --- | --- |
| preflight | `PREFLIGHT: PASS 13 类前置一致性检查全部通过（53 个工程文件）`，exit 0 |
| smoke（GODOT_SMOKE_FRAMES=240） | `godot-smoke: PASS`（退出码 0，断言标记齐全，日志无脚本错误） |
| input-fuzz | `GODOT_FUZZ: PASS seed=20260913 batches=6 total_frames=239`，exit 0 |
| server typecheck | `tsc --noEmit` exit 0 |

## 本节点改动

1. **Web 导出**：`games/game-7/export_presets.cfg` 新建（Web/HTML5 预设，`variant/thread_support=false` 单线程——GitHub Pages 类托管无 COOP/COEP 头也可跑；canvas_resize_policy=2 自适应）；产物落 `export/web/`（index.html / index.js 331KB / index.wasm 35.4MB / index.pck 2.57MB / audio worklet / 图标）并入库——assets_dir 是部署构建输入。
2. **AppHost 清单**：根 apphost.toml 切到本游戏——name=game-7 / runtime=node20 / health=/health / **assets_dir=games/game-7/export/web**（资产出 bundle：平台上传对象存储，25MB bundle 上限不再约束 35MB wasm）。
3. **托管壳**（复用仓库根 server/ = templates/apphost/myrd-app 模板落地）：
   - `/health` 200（app=game-7）；`/` 游戏落地页；`GET /api/public/assets/:name` 走平台 asset-store 懒加载（首次请求才拉对象存储 + 内存缓存），gzip+b64 → text/plain base64，raw → 源 contentType——M1 网关只透传文本，二进制一律 base64 回传。
   - **调参桥（§3C 硬契约，本局新增）**：引擎加载前解析 `?tuning=<JSON>` → `window.__GAME_TUNING__`，游戏侧 `GameState._apply_web_tuning()` 只认 TUNING_META 键并按 min/max 钳制——试玩调好的参数可用 URL 复现。
   - **移动端音频手势解锁器（保留）**：AudioContext 构造器包裹捕获 + document 级 touchstart/touchend/pointerdown/keydown/click（capture+passive）同步 resume（覆盖 suspended/interrupted，幂等）+ `window.__audioDebug()` 真机取证出口；audio worklet 走资产通道加载、失败降级原路径重试。
   - 落地页全部资源走相对路径 `api/public/assets/*`（`/apps/game-7` 无尾斜杠入口下由 BASE_PATH 推导）；引擎 wasm/pck 由壳页面 base64 → Uint8Array → DecompressionStream 还原后经 fetch 拦截喂给引擎（不使用 instantiateStreaming）。
   - 主题按知识文档口径：深空主底 `#0B0B22` + 云带 `#1B1040`/`#122A4D`，水晶青 `#7FF6E8` 点缀。

## 部署后自测（liveUrl 实测）

| 项 | 结果 |
| --- | --- |
| GET /health | 200 `{"ok":true,"app":"game-7","title":"星云穿行",...}` |
| GET / | 308→200 text/html 12KB，含《星云穿行》落地页（调参桥、音频解锁器均在页面内） |
| GET api/public/assets/index.js | 200 text/javascript 331,495 字节（与导出一致） |
| GET api/public/assets/index.wasm.gz.b64 | 200 text/plain 10.7MB，base64 解码 → gzip(1f8b) → 解压 35,376,909 字节与本地导出逐字节一致，`\0asm` 头合法 |
| GET api/public/assets/index.pck.gz.b64 | 200，解压 2,570,224 字节，`GDPC` 魔数正确 |
| GET api/public/assets/index.audio.worklet.js | 200 text/javascript |

## 冒烟结论（玩法侧，由前序门禁 + 本轮复跑共同覆盖）

- 操控与穿行（验收 1）：噪声对抗输入后按住 move_right 位移 >1px、信号到达订阅方、无输入零漂移、边界钳制兜回——smoke PASS。
- 躲避判定（验收 2）：真实碰撞路径 HP 3→2、N 清零、速度回 100 px/s、1s 无敌；红/黄/蓝三色陨石均生成、颜色互异、碰撞余量 ≤10%。
- 收集提速（验收 3）：N=1 → 110 px/s，N=5 → 150，N=10 封顶 200；封顶后每颗 +50 分；HUD 档位同公式。
- 循环完整（验收 4）：到时限 `finish_run("arrived")` 结算四项数据齐全总分单调；败局路径 `finish_run("destroyed")` 断言；confirm 重开复位。
- 数值可配置（验收 5）：全部口径出自 `config/game_config.json`，`start_run()` 每局重读，零代码改动生效。

## 遗留说明

- `playtest.sh` 仍需运维补模板仓库后才可接机器人试玩门禁（当前 routine 未引用，不阻塞部署）。
- 移动端真机音频取证出口已就位（`window.__audioDebug()`），如需真机复测按 games/soccer/qa/MOBILE_AUDIO_ROOT_CAUSE.md 流程取证。
