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

## playtest 节点独立复核（2026-09-27 迭代轮，只读，不重烧 v9）

deploy/playtest-kit 回填均由本轮 deploy 派发轨迹完成（a3a5d2f + 57869b2）；playtest 节点独立复核结论：

| 复核点 | 结果 |
|---|---|
| 工作区/远端同步 | 本地 HEAD = `57869b2` = `git ls-remote` 远端 goal 分支 HEAD，工作树 clean |
| 指令引用 HEAD `01219f7` | **不存在**（本地/远端任何引用均无，stale 引用）；按「最新 HEAD」口径执行，实际基线 `57869b2` |
| v8 线上健康 | `/apps/game-2/health` → 200 `{ok:true,app:star-dust-collector,assets:lazy/object-storage}` |
| 壳页双形态桥 | 壳页 200（12375B），`__GAME_TUNING__` ×2、扁平形态标记 `k === 'tuning'` ×1，`<title>星尘收集者</title>` |
| 调参 URL 双形态 | 扁平 `?tuning=1&max_crystals=5&initial_shield=2` → 200；JSON `?tuning=%7B%22max_crystals%22%3A5%7D` → 200 |
| 资产懒加载端点 | `api/public/assets/index.js` 200（331495B，与仓库导出逐字节同尺寸）；`index.wasm.gz.b64` 200（10696408B）；`index.pck.gz.b64` 200（3340912B） |
| playtest-kit.md 占位符 | `<liveUrl>` 残留 **0 处**（a3a5d2f 已回填 4 处真实入口） |
| playtest.sh | ⛔ 仍缺：本地 `std-skills/godot-game-dev/scripts/` 与 `origin/main a15f66b` 同目录均无 playtest 匹配；注入阅读副本有 → **playtest 维持 blocked** |

**不重烧 v9 的理由**：HEAD `57869b2` 相对 v8 部署基线 `a3a5d2f` 仅差一个纯 docs（qa markdown）提交，
构建产物零差异；v8 线上全绿且自测通过，重复部署只会产生 superseded 版本空转。

**回写链路备查**（收到用户试玩结果后启用）：调参 URL → diff（仅认 `game_config.gd TUNING_META` 17 键）
→ `POST /api/v1/game-design-specs/cmuinva4t002xm9l6bwjcnyy6/revisions`（当前 v1 draft，numeric 15 键）
→ `POST .../approve` 拍板 → artifacts 追加 `op=tuning_applied` → 下一轮按新 spec 重部署。
