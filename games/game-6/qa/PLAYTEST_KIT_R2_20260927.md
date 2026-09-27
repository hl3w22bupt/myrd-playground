# game-6 试玩验收节点记录 r2（2026-09-27，迭代 v3 验收轮）

> 本轮性质：试玩验收（playtest_kit）节点。前序 implement/deploy 已交付迭代 v3
>（磁吸/冲刺反馈链 + 卡通主角 + 场景提亮，deployment `cmujm2j2d002am99iv7qtd572` @`50e90df`）。
> 本节点做了三件事：线上版本核验、调参面板缺口补齐（§3C 模板资产）、试玩验收包回写。

## 一、线上版本核验（本节点独立实测，非转抄）

| 检查 | 结果 |
|---|---|
| `GET /apps/game-6/health` | 200 `{"ok":true,"app":"tiantian-kupao-game-6","assets":"lazy/object-storage"}` |
| 线上 pck 指纹（资产端点 base64+gunzip 解码） | `c1cd0342…` 2677200 字节，与本地 HEAD（87c2c0a）导出**逐字节一致** → 线上确为迭代 v3 |
| 分支同步（`git ls-remote`，勿信过期跟踪引用） | 远端 = 本地 = `87c2c0a` |
| 壳页契约 | `GAME_TUNING` 调参桥 / `__audioDebug` / `api/public/assets` 相对路径，齐 |

## 二、调参面板缺口补齐（本节点代码改动，唯一工程变更）

- **缺口**：SKILL.md §3C 三件套之一 `scripts/tuning_panel.gd` 在 minimal-2d 模板有、game-6 无
  （git 全历史从未存在，脚手架选择性拷贝时遗漏）→ `?tuning=1` 当时完全无效
  （桥只认 `?tuning=<JSON>`，"1" 非 JSON → `window.__GAME_TUNING__` 不设置）。
  上一轮 playtest_kit 里「画面右上角出现调参面板」的描述与事实不符，本轮更正并补齐。
- **修复**：从模板拷 `tuning_panel.gd` 并按本工程调参区 API 适配
  （模板 `GameState.get/set` → 本工程 `tuning_value()/apply_tuning()` 唯一入口；
  `step<=0` 的 saveKey 字符串键不出滑杆、不进导出）；`main.gd _ready` 接线 2 行
  （`TuningPanel.is_enabled()` 才创建，桌面/无头零成本）。
- **门禁复跑（本节点实测）**：preflight PASS（13 类 87 文件）→ smoke PASS
  （`GODOT_SMOKE_FRAMES=320`，退出码 0，零 SCRIPT ERROR）→ input-fuzz PASS
  （`GODOT_FUZZ: PASS seed=20260913 batches=6`）。
- **重导出**：web_nothreads + gl_compatibility 红线不变，导出退出码 0 零错误，
  新 pck = `420c7739…`（2682016 字节）。

## 三、延续上报项（未解决，非本节点可修）

**模板仓库未预置门禁脚本：std-skills/godot-game-dev/scripts/playtest.sh**（配套
playtest_driver.gd 同缺）——2026-09-27 本节点 `git fetch` 后复核：origin/main（a15f66b，
2026-09-21 的 routine 清理合并）与功能分支均无此文件，运维仍未补模板资产。
影响：`GODOT_PLAYTEST` 机器人试玩节奏机判（首奖励时延/无反馈窗口/反馈密度/局间方差）无法执行，
本节点不代跑、不自制判定器；人工试玩验收包照常产出（人肉试玩不依赖该判定器）。
恢复路径：运维把模板仓库补上技能资产 → 后续轮把脚本随模板同步入仓库即可机判。

## 四、试玩验收包

见目标 artifacts 的 `op=playtest_kit` 产物（本轮新增条目，workflowRunUrl 绑定本轮 run）。
量表状态=待用户试玩；收到量表结论 + 调参 URL 前不写 spec revisions（不编造结论）。
