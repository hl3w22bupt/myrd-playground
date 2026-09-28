# 田园小院（Farm Yard）

田园风模拟经营小游戏：**种植 → 养殖 → 加工 → 出售/交付订单 → 扩建** 的完整经营闭环，
配治愈系暖色画面（草地/木屋/栅栏/花田 + 昼夜循环）与程序化合成音频（BGM + 种植/收获/鸡鸭鹅叫声等 10 类音效）。

- 引擎：Godot 4.3（GDScript 2.0），竖屏 720×1280，桌面鼠标与移动端触摸同一条点击路径
- 策划案（唯一事实源）：`.myrd/spec/design-spec.json`（八段 GameDesignSpec，数值与 `autoload/farm_data.gd` 一一对应）
- 门禁判定器（唯一来源，勿改）：`std-skills/godot-game-dev/scripts/`

## 玩法与五大区域

| 区域 | 可交互对象 | 玩法 |
|---|---|---|
| 菜园 | 6 块耕地（3 开放 + 3 花币开垦） | 种 5 种作物（小麦→玉米，时长/售价梯度 10s/6币 → 60s/70币） |
| 果园 | 3 棵果树（苹果树初始就有） | 周期结果，点按采摘入仓 |
| 鸡鸭鹅舍 | 3 座养殖舍（鸡舍初始就有） | 周期自动产蛋，点按收取；升级提速 |
| 小花园 | 4 个花圃（2 开放） | 种 3 种花 |
| 休闲天地 | 工坊 + 喷泉 + 秋千 | 工坊加工（面包/蛋糕/苹果派）；喷泉/秋千升级提升全局售价（各 +4%/级） |

经济：集市出售（库存校验 + 一次性结算）、订单交付（3 张轮换，奖励 = 基础价 ×1.35 + 8）；
成长：等级经验曲线（25 + 15×(Lv-1)）、7 阶段任务链（走通首个完整闭环）；
存档：`user://farm_save.json`（Web 导出持久化到浏览器 IndexedDB），生长存「剩余秒」，刷新/重开无损恢复。

## 本地门禁（与 .myrd/routines.yaml 的 godot-smoke 同源）

```bash
python3 std-skills/godot-game-dev/scripts/preflight.py games/farm-yard
GODOT_SMOKE_FRAMES=240 GODOT_BIN="$(bash std-skills/godot-game-dev/scripts/resolve-godot.sh)" \
  bash std-skills/godot-game-dev/scripts/smoke.sh games/farm-yard
GODOT_BIN="$(bash std-skills/godot-game-dev/scripts/resolve-godot.sh)" \
  bash std-skills/godot-game-dev/scripts/input-fuzz.sh games/farm-yard
```

判定协议：退出码 0 且日志含 `GODOT_SMOKE: PASS` / `GODOT_FUZZ: PASS`。

冒烟断言覆盖（tests/smoke.gd）：核心闭环数值精算、金币不足拒绝/库存不为负、重复收获只结算一次、
存档往返（含静音开关）、工坊/休闲/养殖舍升级真实生效、五大区域热区、点击语义
（点空地弹菜单 → 点菜单项种该项 → 点成熟物收获）、confirm 键等价收获、任务链 7 阶段、Juice 反馈、调参协议。

## 资产再生成（程序化合成，同配方同产物）

```bash
godot --headless --path . -s res://tools/gen_sfx.gd    # 10 个音效 ← tests/sfx-recipes.json
godot --headless --path . -s res://tools/gen_bgm.gd    # BGM 循环 assets/audio/bgm_meadow.wav
```

## Web 导出与部署接线

```bash
godot --headless --path . --export-release "Web" export/web/index.html   # 先 mkdir -p export/web
```

- 产物：`games/farm-yard/export/web/`（index.html/js/pck/wasm），**导出产物入库**（AppHost 按 gitRef 克隆构建）
- 根 `apphost.toml`：`assets_dir = "games/farm-yard/export/web"`（资产出 bundle：wasm/pck 平台上传对象存储，25MB 上限不约束资产体积）
- 壳页两硬契约已就位：
  - `export/web-shell.html`（静态导出自带）：移动端音频手势解锁器（AudioContext 包装 + document 级手势 resume + `__audioDebug()`）+ 调参桥（`?tuning=` → `window.__GAME_TUNING__`）
  - `server/src/game-page.ts`（AppHost 落地页）：同款解锁器 + 调参桥 + wasm/pck 走 `api/public/assets/*` 文本通道（相对路径，base64 → DecompressionStream 还原）
- 调参：URL 带 `?tuning=<urlencoded JSON>` 时游戏内浮出调参面板（`grow_speed` / `day_cycle_sec` / `autosave_sec`，见 `GameState.TUNING_META`）；定稿回写 spec.numeric
