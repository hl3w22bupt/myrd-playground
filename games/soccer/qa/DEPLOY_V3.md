# 《Soccer》v3 迭代部署记录（终场结算「再来一局」触摸按钮）

> 角色：发布 agent · 日期：2026-09-13 · 结论：**已部署（v3 在役）**
> liveUrl <https://leomac-studio.tail49399e.ts.net/apps/soccer/>
> 部署：`cmtz9zjzh001fm93d50uhwdlf`（v8，running，当前在役）· mode=bundle · gitRef `myrd/games-goal-cmtx73f9v0005m9zbikqyadww`
> 分支头：`b6db6349`（= 实现提交 `676d2ed8` + 工作区元数据 auto-commit；远端与本地一致）
> 需求：cmtz8v2yz000om93dungmq5yw（终场结算补「再来一局」触摸按钮）
> 仓库迁移说明：本项目仓库已迁至 `https://github.com/hl3w22bupt/myrd-playground.git`（project.githubUrl，
> AppHost builder 按 engine.ts `app.project.githubUrl` clone）；旧 `hl3w22bupt/myrd.git` 上已无该分支。

## 1. 门禁（本地自检，与 godot-smoke preHook 同源）

| 步骤 | 命令 | 结果 |
|---|---|---|
| 解析引擎 | `resolve-godot.sh` | Godot 4.6.1.stable.official.14d19694e |
| 前置检查 | `preflight.py games/soccer` | `PREFLIGHT: PASS`（13 类全过，100 工程文件）exit 0 |
| 冒烟 | `GODOT_SMOKE_FRAMES=240 smoke.sh games/soccer` | `godot-smoke: PASS`（断言标记齐全）exit 0，`SCRIPT ERROR` 计数 = 0 |

## 2. v3 变更内容（实现提交 `676d2ed8`，发布节点零代码改动、纯导出核验 + 部署）

- **ResultControls**（`scenes/result_controls.tscn` + `scripts/result_controls.gd`，CanvasLayer layer=11）：
  终场结算「再来一局」按钮，沿 TouchControls 的「InputMap 生产者」模式——命中区内按下注入
  `InputEventAction(&"restart")`，与键盘 R/Enter/空格走同一条 `Main._unhandled_input` 重开路径，
  无触摸分支逻辑；`InputEventMouseButton` 与 `InputEventScreenTouch` 汇入同一 `_press_at/_release_at`。
- 触达区域 260×64 ≥ 44×44（`BTN_RECT` 同源常量，命中区=绘制区）；画布 1280×720 下位于结算面板
  （y 256..464）下方、HUD 帮助条上方，不遮挡比分/结果文字；`canvas_items` 拉伸下各分辨率等比映射。
- 可见性纪律：仅终场结算 `Main.set_active(true)` 出现且可交互（main.gd:664），重开即 `set_active(false)`
  （main.gd:164）并 `_force_release()` 释放按住状态；比赛进行中整层隐藏，不干扰既有触摸控件与键位契约。
- 冒烟新增 v3 断言（tests/smoke.gd）：按钮接线与 `restart` 动作对准、触达 ≥44×44、进行中隐藏、
  终场可见且不遮挡结算面板、鼠标点击重开全链（比分/计时/球位/面板复位）、触摸点击重开全链、
  隐藏态点击无效探针；负例探针实测拦截有效（见提交 `676d2ed8` 说明）。
- 重导出 `export/web`（pck 2,848,420 → 3,040,016 B，**+191,596 B**；wasm 37,685,705 B 一字节不变）。

## 3. 线上产物核验（部署后实测，非推断）

| 资产 | 通道 | 实测 | 与 HEAD 产物比对 |
|---|---|---|---|
| index.pck | `/api/public/assets/index.pck` gzip+b64 → decode → gunzip | 3,040,016 B，md5 `7bb5af59327bee439450eaa4adfd3487` | **md5 一致**；pck 内含 v3 标记「再来一局」与 `result_controls` 符号 |
| index.html | raw | 5,438 B | **逐字节一致** |
| index.wasm | gzip+b64（未落盘，仅核验传输） | 200，12,575,184 B（37,685,705 B gzip→b64），`text/plain` | 通道全通 |
| /health | — | 200 `{"ok":true,"app":"soccer"}` | — |
| /（壳页） | 308→/apps/soccer/ 200 | 15,308 B，canvas 壳页 | — |
| /api/public/info | — | `{"app":"soccer","engine":"Godot 4.6 (Web, nothreads)","assetStore":true}` | — |

资产链路结论：wasm/pck 经平台 gzip 存对象存储、实例 `getAsset` 懒加载、`gzip+b64` 文本回传（M1 网关无二进制透传）全链路验证通过；
壳页资源全部相对路径（`api/public/assets/...`），网关子路径 `/apps/soccer` 下解析正确。

## 4. 冒烟结论

- 门禁三连（resolve-godot → preflight → smoke 240 帧）全绿；v3 断言（按钮接线/触达/可见性纪律/
  鼠标+触摸重开全链/隐藏态探针）与 v1/v2 既有断言（键位契约、角球/球门球/界外球规则、音频、触摸）同集运行，零回退；
- 线上 pck md5 与本地 HEAD 导出产物一致 → 本次部署伺服的确为 v3 bundle（非 v2.1 残留）；
- 键盘快捷键（R/Enter/空格）重开路径与按钮注入同一 `restart` 动作，桌面行为由既有断言钉死不变。

## 5. 部署过程说明

- 触发 API 两次收到代理 504（响应超时），但请求均已被服务端受理：产生 v7 `cmtz9yr6f001dm93dnitim3z3`
  与 v8 `cmtz9zjzh001fm93d50uhwdlf` 两次部署，内容同为分支头 `b6db6349`；v8 构建完成后置为当前在役，
  v7 自动 superseded。对交付无影响，记录在此备查。
- 部署记录（本文件）为纯文档提交，位于在役 bundle 构建点之后，不影响已部署内容。
