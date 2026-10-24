# snake-ghost 残影 spike（A2 · 独立 spike，不进主线分支）

> 建档：2026-09-20（游戏程序）。规格来源：concept-pool-v1.md §A2.1/§A2.2 + 美术规格 §A3.1。
> **当前结论状态：PENDING_EVIDENCE（证据未落）** —— 本包是「一键可跑」的 spike 资产；
> 在有 shell + Godot 4.3 的环境跑完并回填数据前，snake-ghost 卡按主策划写死口径
> **淘汰不保卡**（今晚 24:00 前补证可加验，过窗出局）。

## 1. 文件清单

| 文件 | 作用 |
|---|---|
| `spike_main.gd` | 残影模拟器：10Hz 存档点采样 / 3.0s 存活 / 30 节点池 / α 0.35→0 线性 / H−24° V+10%（§A3.1 全规格） |
| `spike_main.tscn` | spike 场景（根节点 + 脚本，HUD 供录屏读数） |
| `run-spike.sh` | 一键执行：临时独立工程内跑（零主线侵入），产物自动归档 `data/<时间戳>/` |
| `data/<时间戳>/` | 实跑产物：`run-headless.log`（SPIKE 逐行原文）、`fps.csv`、`mem.json` |

## 2. 运行方式

```bash
# ① 桌面无头采样（60s，机判桌面指标）
bash games/game/qa/snake-ghost-spike/run-spike.sh
#    产物 verdict 行示例：
#    SPIKE: verdict_desktop fps=能 mem=能 => 桌面口径 能

# ② 桌面窗口录屏（对照录屏用，同时可肉眼核残影规格）
#    ⚠️ 必须保留 qa/snake-ghost-spike/ 目录结构（场景 ext_resource 按该路径引用，与 run-spike.sh 同理）
GODOT_BIN=/path/to/godot
TMP=$(mktemp -d); mkdir -p "$TMP/qa/snake-ghost-spike"
cp games/game/qa/snake-ghost-spike/spike_main.* "$TMP/qa/snake-ghost-spike/"
printf 'config_version=5\n[application]\nconfig/name="snake-ghost-spike"\nrun/main_scene="res://qa/snake-ghost-spike/spike_main.tscn"\nconfig/features=PackedStringArray("4.3")\n[rendering]\nrenderer/rendering_method="gl_compatibility"\n' > "$TMP/project.godot"
"$GODOT_BIN" --path "$TMP"   # 录屏 ≥60s

# ③ 移动端 Safari 真机（§A2.1 要求 iOS Safari ≥15 实测）
#    用主工程同款导出流程把临时工程导出 Web（或临时把 spike 场景设为主工程启动场景导出，
#    跑完还原 —— 不得把 spike 合入主线分支），Safari 打开 → 屏幕录制 ≥60s → 按 §3 核对。
```

## 3. 判据（§A2.2 写死，结论只允许「能 / 不能」+ 数据）

| 判据 | 「能」阈值 | 数据来源 |
|---|---|---|
| 移动端帧率 | 60s 内 ≥95% 采样点 60fps，1% 低帧 ≥45fps | ③ 真机录屏逐秒读数（或 web-inspector performance 面板） |
| 内存 | 60s 满载堆增量 <50MB | ①/③ `mem.json` heap_delta_mb |
| 反馈延迟 | 输入→转向可见 ≤100ms | ③ 录屏逐帧核对（触点按下帧 → 蛇头转向首帧，24fps 录屏 ≤2.4 帧） |

- 桌面两项（fps/mem）由 ① 自动机判；**移动端 Safari 项必须真机实测**，桌面数据不能替代。
- 任一「不能」→ 按 §A2.2 降档重测（采样 10Hz→5Hz）；再不达 = 整卡「不能」。

## 4. 结论回填（执行者纪律）

1. 跑完 ①②③ 后，把三份产物路径写进 `data/` 并在本目录新建 `run.md`：
   运行环境（机型/OS/浏览器/分辨率）、verdict 行原文、逐项「能/不能」、综合结论。
2. 回填黑板：`concept-pool-v1.md §A2.3`（替换 PENDING_EVIDENCE）+ `blockers.md B-4`（销项）。
3. 只允许「能/不能」+ 数据路径；禁止理论推演、禁止用桌面数据冒充移动端结论。
