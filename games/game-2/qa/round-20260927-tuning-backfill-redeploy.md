# QA 轮次记录 · 调参回填契约修复 + HEAD 重部署（2026-09-27 第 2 轮）

## 本轮范围（迭代微调：仅 deploy，游戏工程无代码变更）
1. **修复线上调参回填契约缺失（壳页侧）**：
   - 缺陷定位：游戏内调参面板「复制调参链接」（`tuning_panel.gd _on_copy_link_pressed`）序列化产出
     **扁平形态** `?tuning=1&max_crystals=12&…`，而壳页调参桥只消费**契约形态** `?tuning=<json>`
     （`JSON.parse("1")` 非对象 → 静默丢弃）→ 面板生成的调参链接无人消费，回写流程断裂。
   - 修复：`server/src/game-page.ts` 调参桥改为**双形态**——先按 `?tuning=<json>` 解析（契约形态不变），
     失败/缺失时把其余 query 键值（数值化，跳过 `tuning` 开关位）合并进 `window.__GAME_TUNING__`；
     游戏侧 `TUNING_META` 白名单 + min/max 钳制照常兜底（未知键忽略），游戏工程零改动。
2. **从 goal 分支最新 HEAD 重新 Web 导出 + 重部署**。
3. **playtest 维持 blocked**：模板仓库仍未预置 `std-skills/godot-game-dev/scripts/playtest.sh`（注入目录副本不作判定来源），
   不现场自造判定器；`qa/playtest-kit.md` 的 4 处 `<liveUrl>` 占位符已回填真实入口。

备注：迭代指令引用的 HEAD `01219f7` 在本地/远端任何引用中均不存在（stale 引用）；
按「goal 分支最新 HEAD」的绑定要求执行，实际基线 = 远端分支 HEAD（本轮部署前为 246199f，
本轮提交后为 docs+壳页修复提交）。

## 门禁结果（与门禁同源判定脚本）
| 步骤 | 结果 |
|---|---|
| resolve-godot.sh | ✅ Godot 4.3.stable.official.77dcf97d8 |
| preflight.py | ✅ `PREFLIGHT: PASS`（13 类 / 52 文件） |
| smoke.sh（240 帧） | ✅ `godot-smoke: PASS`（含 move_right ≥ +1px / move_left ≤ −1px 有符号断言） |
| input-fuzz.sh | ✅ `GODOT_FUZZ: PASS seed=20260913 batches=6 total_frames=239` |
| server typecheck | ✅ `tsc --noEmit` 退出码 0 |
| playtest.sh | ⛔ blocked：模板仓库未预置，维持上报 |

## Web 导出
- `godot --headless --import` → `--export-release "Web"` 均退出码 0；
- 游戏代码未变，产物与入库版本逐字节一致（wasm 35376909B / pck 2521520B）。

## 线上验证（部署后回填）
- deploymentId：`cmuio5u90003om9l6baasdij9`（v8，status=running，commit a3a5d2f=分支 HEAD，
  gitRef=myrd/games-goal-cmuiepudc001zm9gyyzqgztta，sourceId=cmuiepudc001zm9gyyzqgztta，v7 已 superseded）。
- 线上自测（公网入口）：`/health` 200 {ok:true,app:star-dust-collector}；壳页 200（12375B，含双形态调参桥标记）；
  `?tuning=1&max_crystals=5&initial_shield=2`（面板扁平回填形态）200；
  `?tuning=%7B%22max_crystals%22%3A5%7D`（JSON 契约形态）200；
  index.js 200（331495B）、index.wasm.gz.b64 200（10.7MB text/plain）、index.pck.gz.b64 200（3.3MB text/plain）。
- 调参回填链路：面板「复制调参链接」→ 扁平 URL → 壳页解析进 `window.__GAME_TUNING__` →
  `GameConfig.apply_tuning_bridge` 白名单消费 —— 闭环已修复上线。
