# 《探针：验证 oak key 有效性（取证用，不计入三样例）》

> **取证探针（forensic probe）**：本工程是「游戏工程 → godot-smoke 门禁 → AppHost 部署」
> 全链路健康的取证工具，**不计入主项目三样例的数量与质量统计**。
> 需求 id：`cmupslvp7002gm9dh42h3maq5` · 目标 id：`cmupsfn0q001um9dhlko9t5e0`
> · AppHost id：`cmupsflsj001sm9dhxt6w1oal`（slug: `oak-key`）
> · 统计口径：三样例统计（脚本/看板）不得包含 `games/oak-key`。

- 引擎：Godot 4.3（`config/features=PackedStringArray("4.3")`），工程根固定 `games/oak-key`
- 类型：休闲收集 · 一句话玩法：拾取 key 片段 → 本地校验 → 反馈「有效 / 无效」并落取证标记

## 玩法闭环（验收标准 3）

| 环节 | 落点 |
| --- | --- |
| 输入 | WASD / 方向键移动，空格（或回车）探测，R 重开；触摸端摇杆 + 按钮 |
| 拾取 | `scripts/key_fragment.gd`（Area2D 覆盖检测，`collected` 信号） |
| 登记 | `autoload/game_state.gd::register_fragment()`（有效片段计数 / 伪造片段标记） |
| 校验 | `scripts/oak_key_validator.gd::validate()`（白名单 + 顺序敏感的本地校验逻辑） |
| 取证 | `game_state.gd::record_probe()`：日志行 `OAK_KEY_PROBE oak_key_probe=valid\|invalid ...` + 存档字段 `user://oak_key_probe.json` |
| 反馈 | `scripts/main.gd::_on_probe_finished()` 同帧渲染结果面板（远快于 2s 上限） |
| 胜负 | 集齐 3 片且避开伪造片段 `X9` → 有效；拾到伪造片段 / 片段不足 / 顺序错 → 无效 |
| 重开 | `main.gd::restart_run()`（R 键或触摸「重开」按钮，复位片段 / 计数 / 出生点） |

## 门禁（验收标准 2）

```bash
bash games/oak-key/verify.sh          # preflight + smoke(240帧) + input-fuzz
```

判定器唯一来源是仓库内 `std-skills/godot-game-dev/scripts/`（模板仓库预置，本工程不自带、
不改写）。冒烟断言见 `tests/smoke.gd`：静态接线 → 移动 → 拾取 → 探测（valid）→ 重开 →
空手探测（invalid）。取证日志可直接 `grep OAK_KEY_PROBE`。
