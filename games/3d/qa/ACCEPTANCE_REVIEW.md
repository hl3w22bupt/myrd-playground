# 《3D 切苹果》线上复核报告（主策划 · liveUrl 玩法 + qa/mobile 证据链）

- 复核时间：2026-10-08（UTC）
- 复核人：主策划线上复核节点（goal cmuzmgo3y000gm9fyz4cd9en0）
- 复核对象（线上产物标识，artifacts 同口径回写）：

| 项 | 值 |
| --- | --- |
| **HostedApp id** | `cmuzmgm4y000em9fyitqs4nrk` |
| **deployment id** | `cmuzr8tql0019m9vixtveb0m6`（**v3 running**；v1 `cmuzqfm8z0013m9vizdmpztn9`、v2 `cmuzr82kv0017m9viynasshwp` 均 superseded） |
| **liveUrl** | https://leomac-studio.tail49399e.ts.net/apps/3d/ |
| 部署 commit | `6a0760c`（`6a0760c8f8a5bdd513938079cf15a8606df29ed9`，gitRef `myrd/game-3d-goal-cmuzmgo3y000gm9fyz4cd9en0`） |
| 证据基线 | 实现分支 HEAD `6cab4a5`（部署 commit 之后仅 2 个 QA 证据 commit，不影响线上游戏代码） |

## 结论：复核通过（四门禁独立复跑全绿 + 线上字节级一致 + 玩法标识全检出）

机器侧验收在本轮由主策划节点**独立复跑**，非转抄实现节点结论；全部可复现。

## 逐项取证

### ① 线上身份与可达 — PASS

- `GET https://leomac-studio.tail49399e.ts.net/apps/3d/health` → **HTTP 200**
  `{"ok":true,"app":"3d","title":"3D 切苹果","env":"development","assets":"lazy/object-storage"}`
- 落地页 `GET /apps/3d/` → 308 归一 → **HTTP 200**（12,229 B），壳页标识齐全：
  「3D 切苹果」×2、`__audioDebug`、`unlockAudio`×3、`index.pck`×3（音频手势解锁器与资产通道在位）

### ② 线上产物 == 部署 commit 导出（字节级）— PASS

- 线上资产通道 `GET /apps/3d/api/public/assets/index.pck.gz.b64` → base64 → gunzip
  → **sha256 `ed7f3ba2ce729865ef0b6a61096aa873caeb80dc639f1931ed7a98df1dc44672`**（2,541,648 B）
- == 仓库 `6a0760c` 的 `games/3d/export/web/index.pck` **逐字节一致**（`cmp` 通过）

### ③ 线上包玩法标识解码检出 14/14 — PASS

GDPC v2 目录解析（48 条目）→ GDSC 头剥离 → zstd 解压 → 字符串常量检索
（`qa/mobile-review/pck-decode.py` / `pck-decode.json`，本节点脚本与产物）：

| 标识 | 检出 | 语义 |
| --- | --- | --- |
| `Combo x` | ✓ | 连击弹窗（≥2 连提示） |
| `切中炸弹` | ✓ | 炸弹终局提示 |
| `剩余` | ✓ | 60 秒倒计时 HUD |
| `再来一局` | ✓ | 结算重开入口 |
| `新纪录` | ✓ | 破纪录提示 |
| `漏接` | ✓ | 漏接统计 |
| `分数` | ✓ | 计分 HUD |
| `apple_points` / `combo_bonus_pair` / `bomb_ratio` / `round_seconds` | ✓ | 调参键（?tuning=1 工作台契约） |
| `score.wav` / `fail.wav` | ✓ | 音效资产 |
| `滑动切开苹果` | ✓ | 引导文案 |

### ④ 四门禁独立复跑（本轮实跑，非转抄）— PASS

| 门禁 | 命令 | 结果 |
| --- | --- | --- |
| PREFLIGHT | `python3 std-skills/godot-game-dev/scripts/preflight.py games/3d` | **PASS**（14 类，64 个工程文件） |
| GODOT_SMOKE | `GODOT_SMOKE_FRAMES=240 bash std-skills/godot-game-dev/scripts/smoke.sh games/3d` | **PASS**（退出码 0，断言标记齐全） |
| GODOT_FUZZ | `bash std-skills/godot-game-dev/scripts/input-fuzz.sh games/3d` | **PASS**（seed=20260913，6 批 239 帧） |
| MOBILE_SMOKE | `node std-skills/godot-game-dev/scripts/mobile-web-smoke.mjs --url <liveUrl> --out games/3d/qa/mobile-review` | **PASS 10/10** |

判定脚本全部为模板仓库预置（`git ls-files std-skills/godot-game-dev/scripts/` 可核），非现场编写。

### ⑤ qa/mobile 证据链核验 — PASS

- 实现节点 `games/3d/qa/mobile/report.json`：verdict=**PASS**，10/10 项 pass，
  `checkedAt=2026-10-08T16:37:09Z`（晚于 v3 部署完成 16:34:26Z = 对线上 v3 取证），metrics：
  tapDiff=10、fps=28（swiftshader 口径）、视口 390=390 无溢出、触摸派发 tap 1-0-1 / swipe 2-8-2
  —— 对 `status` + `metrics` 判读，pass 项 detail 为脚本预写话术模板，与结论不矛盾。
- 主策划节点独立复跑 `games/3d/qa/mobile-review/report.json`：verdict=**PASS** 10/10，
  `checkedAt=2026-10-08T16:50:40Z`，tapDiff=7、fps=27，网络全通 / console 零错误 / canvas 挂载 /
  首帧非纯色 / 画面在动 / 触摸响应 / `__audioDebug` 在位；三张分阶段截图随包归档。
- 判据交叉一致：两轮独立取证结论一致 = 线上移动端可玩性机判稳定可复现。

## 验收标准（goal AC）对照

| AC | 本轮证据 | 判定 |
| --- | --- | --- |
| 1 工程 `games/3d/project.godot` 在库 | 实现分支 `6cab4a5` 已提交（本 review 分支即基于它） | ✓ |
| 2 五件判定脚本 + preflight/smoke/fuzz | ②节独立复跑全 PASS，脚本模板预置 | ✓ |
| 3 状态边界与对抗输入 | smoke.gd 含噪声相位（悬挂手势/孤儿释放/双指抢控），fuzz PASS；smoke 断言操控语义（move_right 方向性） | ✓ |
| 4 玩法可玩（切果/combo/炸弹/60s/重开） | ③节线上包玩法标识 14/14 + smoke 断言计分口径（单果 +10、两果 +30、三果 +50 起、炸弹终局、重开清零） | ✓ |
| 5 可玩闭环 + 移动端门禁 | v3 running + /health 200 + liveUrl 可开 + MOBILE_SMOKE 两轮 PASS；证据归档 `games/3d/qa/mobile/`、`games/3d/qa/mobile-review/` | ✓ |
| 6 真机抽查（可选） | 不具备环境（goal 已披露模拟器会话建不起来）；不阻塞，留给用户试玩顺带 | —（不构成差距） |
| 7 产物回写 HostedApp id / deployment id / liveUrl | 本报告同口径已回写 goal artifacts（op=acceptance_review） | ✓ |
| 8 试玩验收包 | `games/3d/qa/playtest-kit.md` 已交付（四问量表 + ?tuning=1 调参入口），**待用户回填** | 待人工 |

## 移交与剩余动作（唯一）

- **owner 人工试玩回填**：按 `games/3d/qa/playtest-kit.md` 四问量表，入口 liveUrl（调参 `?tuning=1`），
  回填后数值经 `POST /api/v1/game-design-specs/cmuzn04d4000im9vim1akmc3h/revisions` 落 v2 并拍板。
- 机器侧全部绿不替代人工验收；用户结论未回填前，审视结论最多为「自动化达成、试玩待回填」。

## 复现

```bash
# 线上身份
curl -s https://leomac-studio.tail49399e.ts.net/apps/3d/health
# pck 字节一致性
curl -s https://leomac-studio.tail49399e.ts.net/apps/3d/api/public/assets/index.pck.gz.b64 \
  | base64 -d | gunzip | shasum -a 256   # == ed7f3ba2…（== 仓库 6a0760c 导出）
# 玩法标识解码
python3 games/3d/qa/mobile-review/pck-decode.py <pck> <out.json>
# 四门禁
python3 std-skills/godot-game-dev/scripts/preflight.py games/3d
GODOT_SMOKE_FRAMES=240 bash std-skills/godot-game-dev/scripts/smoke.sh games/3d
bash std-skills/godot-game-dev/scripts/input-fuzz.sh games/3d
node std-skills/godot-game-dev/scripts/mobile-web-smoke.mjs --url https://leomac-studio.tail49399e.ts.net/apps/3d/ --out games/3d/qa/mobile-review
```
