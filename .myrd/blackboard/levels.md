# 《节奏大师》(game-10) 关卡/难度状态（主策划线上复核口径 2026-10-09）

| 难度 | 下落速度 | 同轨最小间隔 | 状态 | 证据 |
| --- | --- | --- | --- | --- |
| Easy | 300 px/s | 1.10 s | 已实现，随 cmv10cg93001jm94of535yg54 上线 | config/difficulties.json + 代码内 DIFFICULTY_TABLE 奇偶校验机判一致 |
| Normal | 380 px/s | 0.85 s | 同上 | 同上 |
| Hard | 470 px/s | 0.62 s | 同上 | 同上 |
| Expert | 560 px/s | 0.46 s | 同上 | 同上 |

- 谱面确定性生成：`seed=20261010+difficulty`，首音符 3.8s ≥ 最慢档穿屏时长，同轨最小间隔 0.24s > 2×GOOD 窗；validate 五项校验可断言
- 判定契约：PERFECT ±50ms / GOOD ±100ms / 超窗 MISS；权重 Perfect=100 / Good=60（配置表 score_weights 与代码机判一致）；MISS 即清零 combo；终局 flush_misses 收口
- 线上核验：线上 pck＝2ccb38e 构建＝四门禁 PASS 同源，MOBILE_SMOKE 10/10（qa/mobile-round2/）
- 人工试玩量表：games/game-10/qa/playtest-kit.md（**待 owner 回填**）
