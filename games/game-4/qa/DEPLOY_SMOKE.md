# 《光路谜阵》部署冒烟取证（deploy 节点自测记录）

- 部署时间：2026-09-26（deploy 节点）
- 应用：slug `game-4`（hostedAppId `cmuieqj7n002zm9gyy4u8qeai`）
- liveUrl：https://leomac-studio.tail49399e.ts.net/apps/game-4/gw
- deploymentId：`cmuihb72x002dm9gcj5f1ud2b`（mode=bundle，v2 running）
- commit：`619d6d6`，gitRef `myrd/games-goal-cmuieqj7o0031m9gyf4pbwptg`

## 自动化自测结论（全绿）

| 检查 | 结果 |
|---|---|
| GET `/health` | 200，body `{"ok":true,"app":"light-path-labyrinth",...}` |
| GET `/` | 200（308 跳尾斜杠后），壳页含调参桥 `__GAME_TUNING__` 与音频解锁 `__audioDebug` |
| GET `/api/public/assets/index.js` | 200，331495B = 仓内源文件字节数 |
| GET `/api/public/assets/index.pck.gz.b64` | 200 text/plain（gzip+b64），b64→gunzip 往返 sha256 与仓内产物一致（2520912B） |
| GET `/api/public/assets/index.wasm.gz.b64` | 200 text/plain（gzip+b64，约 10.7MB），往返 sha256 与仓内产物一致（35376909B） |

门禁（同源判定脚本，仓库内 `std-skills/godot-game-dev/scripts/`）：

- `preflight.py games/game-4` → `PREFLIGHT: PASS`（13 类检查，exit 0）
- `smoke.sh`（240 帧）→ `godot-smoke: PASS 冒烟场景通过…（退出码 0，断言标记齐全，日志无脚本错误）`，
  即引擎日志含 `GODOT_SMOKE: PASS` 且无 SCRIPT ERROR（smoke.sh 第 77-99 行分支）
- `input-fuzz.sh` → `GODOT_FUZZ: PASS seed=20260913 batches=6`（exit 0）
- 冒烟机判覆盖：10 关全可解、par 非递减、光束不穿透墙体、撤销/星级/解锁契约

## 已知边界（如实记录）

1. **GODOT_PLAYTEST 未执行**：模板仓库未预置 `std-skills/godot-game-dev/scripts/playtest.sh`
   （平台注入技能包 `.myrd-platform/.claude/skills/godot-game-dev/scripts/` 里有更新版）。
   已上报运维补齐模板仓库；补齐后补跑 `playtest.sh games/game-4` 即可。
2. **`.wasm` Content-Type**：M1 网关只透传文本，二进制走 base64 文本通道（平台契约），
   因此不存在的 `application/wasm` 响应头由「b64 → Uint8Array → DecompressionStream →
   `WebAssembly.validate`」链路功能等价替代，字节级校验见上表。

## 真机验收待办（iOS Safari / Android Chrome）

壳页已内置移动端硬契约三件套（`server/src/game-page.ts`）：
AudioContext 构造器包装、document 级手势同步 resume（capture+passive）、`window.__audioDebug()` 取证出口。

真机 checklist：

1. 打开 liveUrl，等待光路棋盘渲染（boot 进度条走完消失）
2. 点击/拖动摇杆移动光标，点按旋转管道，光束实时重算
3. 旋转/通关音效是否发声；无声时控制台执行 `__audioDebug()` 取证 `{state, addModules, log}`
4. 锁屏再回来 → 再点一次屏幕 → 音效应恢复（interrupted 兜底）
5. 截图/取证数据归档到本目录（`games/game-4/qa/`）
