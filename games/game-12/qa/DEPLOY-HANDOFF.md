# game-12 交付交接（实现节点 → 导出部署 / 试玩节点）

> 产物分支：`myrd/games-goal-cmur8pnhn000kicbsvl0eoqx6`（部署 gitRef 必须用它，不要用 main）
> 工程：`games/game-12` · AppHost id `cmur8pm9j000iicbsmd25q04l` · slug `game-12`
> liveUrl：`https://leomac-studio.tail49399e.ts.net/apps/game-12/`

## 一、已完成的门禁（本节点实测，非虚构）

| 门禁 | 命令 | 结果 |
|---|---|---|
| godot-availability | `bash std-skills/godot-game-dev/scripts/resolve-godot.sh` | PASS（Godot 4.3.stable） |
| preflight | `python3 std-skills/godot-game-dev/scripts/preflight.py games/game-12` | PASS（13 类 / 35 文件） |
| headless-smoke | `GODOT_SMOKE_FRAMES=240 … smoke.sh games/game-12` | PASS（`GODOT_SMOKE: PASS`，退出码 0） |
| input-fuzz | `… input-fuzz.sh games/game-12` | PASS（`GODOT_FUZZ: PASS`，seed=20260913，6 批 / 239 帧） |

## 二、mobile-web-smoke：本地预检全绿，正式门禁**待部署后**执行

`mobile-web-smoke.mjs` 按设计必须打**部署后**的 liveUrl（M1 网关的 base64 文本通道、
壳端解压、相对路径 404 只在真实链路暴露）。本节点拿不到已部署 URL，因此：

- 已做 **本地预检**（`--url http://127.0.0.1:8791/index.html`，伺服 `export/web/` 静态产物）：
  **10 项全绿**（网络 / console 零错 / canvas / 非纯色 / 画面在动 / 触摸到达 / 触摸响应 /
  音频解锁契约 / 无横向溢出 / FPS）。截图人工核对：中文字体、计数、触摸计数、摇杆、重开均正常。
  这只证明「导出产物 + Godot 自定义壳」在移动 viewport 下可玩，**不能替代**正式门禁。
- **正式门禁在部署完成后执行**（preHookParams 必传 liveUrl + gamePath）：

```bash
node std-skills/godot-game-dev/scripts/mobile-web-smoke.mjs \
  --url https://leomac-studio.tail49399e.ts.net/apps/game-12/ \
  --out games/game-12/qa/mobile
```

判定协议：退出码 0 且 stdout 含 `MOBILE_SMOKE: PASS`；2 = 环境不可用（装 Chrome，别改判定脚本）。

## 三、部署要点（部署节点必读）

1. `apphost.toml`：`assets_dir = "games/game-12/export/web"`，`export/web/` **已入库**
   （`.gitignore` 已去掉 `/export/`，否则部署后关键资源全部 404）。
2. 壳页 `server/src/game-page.ts` 已适配 game-12（标题/提示/键位/配色），
   `window.__audioDebug` 契约在位；`npx tsc --noEmit`（server/）通过。
3. 产物由 Godot **4.3.stable** 导出，与 `resolve-godot.sh` 解析到的门禁引擎同版本 ——
   换引擎重导出时，`config/features` 与门禁口径要一并对齐。

## 四、两个环境缺口（需运维，不要由 agent 自行绕过）

1. **`std-skills/godot-game-dev/scripts/playtest.sh` 不在模板仓库里**
   （同目录现有 `gate-selftest.sh / input-fuzz.sh / input_fuzz_driver.gd / mobile-web-smoke.mjs /
   mobile_smoke_selftest.mjs / preflight.py / preflight_selftest.py / resolve-godot.sh / smoke.sh`）。
   机器人试玩门禁因此无法接入；判定器只能来自仓库，**不得自写等价脚本**。
   请运维把模板仓库技能资产补上。
2. **AppHost 应用 `game-12` 尚未上线**：`GET /apps/game-12/health` 返回
   `{"code":"APP_NOT_FOUND","message":"应用不存在或未上线"}`（本节点无平台 API 凭据触发部署）。
   需要平台侧以 `gitRef = myrd/games-goal-cmur8pnhn000kicbsvl0eoqx6` 建立并部署该应用，
   部署完成后跑上面第二条正式门禁。

## 五、玩法与验收对照

- 点击计数 / 300ms 连点防重 / 窗口结束恢复 / 达标 10 次胜利 / 重开归零：见 `README.md` 的
  「验收标准 → 冒烟断言映射」表，全部由 `tests/smoke.gd` 无头机判。
- 移动可玩：触控目标 ≥44×44、拉伸契约（canvas_items / keep / 720×1280）已入冒烟静态断言；
  375×667 视口无横向滚动由 keep 等比拉伸 + 壳页 `overflow:hidden` 共同保证，已在本地预检实测。
