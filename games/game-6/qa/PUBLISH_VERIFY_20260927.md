# game-6 迭代 v3 发布核验记录（2026-09-27，发布节点）

> 本轮性质：迭代 v3（磁吸/冲刺反馈链 + 卡通主角 + 场景提亮）实现/导出/部署已在前序轮完成
>（HEAD = `64dc853`，部署 v6 = `50e90df`）。本轮为发布收口核验：门禁复跑、分支同步、线上指纹比对。
> **代码零改动**，只补记录与 artifacts 回写。

## 一、门禁复跑（与门禁同源命令，HEAD=64dc853 本机实测）

| 步骤 | 结果 |
|---|---|
| resolve-godot.sh | OK（Godot 4.3.stable.official.77dcf97d8） |
| preflight.py | **PASS**（13 类，85 文件，退出码 0） |
| smoke（GODOT_SMOKE_FRAMES=320） | **PASS**（退出码 0，零 SCRIPT ERROR，`godot-smoke: PASS` 标记在） |
| input-fuzz | **PASS**（`GODOT_FUZZ: PASS seed=20260913 batches=6`，退出码 0） |
| playtest.sh | 模板仓库仍未预置 —— **延续上报**（gate routine `godot-smoke` 本身不含该步，未伪造结果） |

## 二、分支同步核验（重要勘误）

- `git ls-remote origin myrd/games-goal-cmuj6p1q2000em9hc4srodpkt` = `64dc853` = 本地 HEAD，**远端已同步**。
- 勘误：本仓库 fetch refspec 仅 `+refs/heads/main:refs/remotes/origin/main`，`git fetch origin <功能分支>`
  只更新 FETCH_HEAD 不更新跟踪引用，导致 `git log origin/<分支>..HEAD` 误报 ahead 6。
  后续核验分支同步请用 `git ls-remote`，勿信过期跟踪引用。`git push` 实测 `Everything up-to-date`。

## 三、线上自测（deployment v6 `cmujm2j2d002am99iv7qtd572` @50e90df，status=running）

| 检查 | 结果 |
|---|---|
| `GET /apps/game-6/health` | **200** `{"ok":true,"app":"tiantian-kupao-game-6","assets":"lazy/object-storage"}` |
| `GET /apps/game-6/` | 308（尾斜杠规范化）→ 跟随后 **200**，11580 字节落地页 |
| 落地页壳契约 | `__audioDebug`（移动音频取证出口）/ `api/public/assets` 相对路径 / `GAME_TUNING` 调参桥 / wasm·pck 走资产端点 —— 四件套齐全 |
| 线上 `index.pck` 指纹 | sha256 `c1cd0342…`、2677200 字节，与本地 HEAD 导出**逐字节一致**（base64+gunzip 解码比对） |

## 四、实现点在位确认（代码取证，零改动）

- **生成池**：`GameState.POWERUP_KIND_WEIGHTS` = 磁铁 0.40 / 冲刺 0.35 / 护盾 0.25；
  `track_builder._layout_chunk → chunk.reroll_powerups(_rng)` 每次铺设重掷种类（`pickup_box.reroll_kind`），
  `powerup_pool_contract.gd` 断言钉死 —— 磁吸/冲刺确实进入生成池且可感知。
- **三层反馈**：生成可见（`fx_bank.flash` 环+火花）/ 拾取（闪光+`sfx_bank` 合成音效+HUD 槽点亮）/
  生效期（`player_fx` 磁吸光圈 + 冲刺速度线拖尾 + HUD 倒计时，归零同步熄灭）。
- **主角美术**：`player_art.gd` RUN_FRAME_COUNT=8（≥6 帧）、JUMP_POSE_COUNT=3、ROLL_FRAME_COUNT=6、
  OUTLINE 描边层（位移统一落 holder，复核轮修复躯干错位）。
- **场景提亮**：金币/障碍/背景与主角同风格提亮，多层视差滚动保持（见 ITERATION_V3_QA.md 前后对比帧）。

## 五、结论

迭代 v3 交付闭环：实现 → 门禁全绿 → Web 导出 → 部署 v6 → 线上指纹逐字节一致 → 分支远端同步。
残留上报项：playtest.sh 模板仓库未预置（运维补资产，非本轮阻塞）。
