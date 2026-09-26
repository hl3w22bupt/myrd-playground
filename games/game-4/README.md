# 光路谜阵（games/game-4）

光束折射解谜：点击旋转管道块，把光束从**光源**一路接到**终点接收器**即过关；步数越少星级越高，共多个渐难关卡。

- 技术栈：Godot 4.3（GDScript 2.0）· 目标平台 Web（HTML5/WASM 导出）
- 工程目录：`games/game-4/`（本 README 所在目录即工程根）
- 门禁：`godot-smoke`（preflight + 无头冒烟 + 输入 fuzz），判定脚本唯一来源为仓库内 `std-skills/godot-game-dev/scripts/`

## 环境要求

| 依赖 | 版本 | 用途 |
|---|---|---|
| Godot | 4.3 stable（4.x 均可，勿用 3.x） | 运行 / 导出 |
| Python | 3.8+ | preflight 静态检查 |
| Bash | 任意 | verify.sh / 门禁脚本 |

Godot 解析顺序：环境变量 `GODOT_BIN` > PATH 里的 `godot` > 常见安装位置（`std-skills/godot-game-dev/scripts/resolve-godot.sh` 唯一实现）。macOS cask 安装可用 `export GODOT_BIN=/Applications/Godot.app/Contents/MacOS/Godot`。

## 玩法与操作

- **光标移动**：`WASD` / 方向键（触屏设备用左下摇杆）
- **旋转管道**：点击格子，或将光标移到管子上按 `空格` / `回车`（触屏右下「旋转」按钮）—— 管道顺时针转 90°，光束实时重算预览
- **撤销**：`Z`（触屏「撤销」按钮）—— 回退最近一次旋转（朝向与步数同时回退）；通关后撤销被屏蔽
- **重开本关**：`R`（触屏「重开」按钮）
- **选关**：`Q` / `E` 上一关 / 下一关（只能进入已解锁的关）
- **下一关**：通关后按 `空格` / `回车` 进入下一关；通关第 n 关才解锁第 n+1 关
- **星级**：3 星 = 以最优解步数通关；2 星 = 步数 ≤ ⌈最优解 × 1.5⌉；1 星 = 通关。星级与每关最少步数纪录只升不降，本地存档（`user://guanglu_save.cfg`，v2）

## 关卡与元件

- **首发 10 关**（`scripts/levels.gd` 单一数据源），难度递进：网格 5×5 → 7×6、
  最优解步数 1 → 10+、墙体与路径长度同步增长；冒烟机判「par 随关号非递减」
- 元件：直管 / 弯管（顺时针旋转 90°）· **分光三通**（一路进、两路出，第 5 关起登场）·
  墙体（光进入即中断，**不穿透**）· 光源 · 终点接收器
- 全部关卡契约由冒烟机判：target 朝向必可解、初始朝向必未通关、光束永不深入墙体内部

## 本地运行

```bash
godot --path games/game-4            # 或用 Godot 编辑器打开 games/game-4/project.godot 后 F5
```

## 门禁（提交前必须全绿）

一键自检（preflight → 冒烟 240 帧 → 输入 fuzz）：

```bash
bash games/game-4/verify.sh
```

与 `.myrd/routines.yaml` godot-smoke 门禁同源的手动命令：

```bash
bash std-skills/godot-game-dev/scripts/resolve-godot.sh >/dev/null
python3 std-skills/godot-game-dev/scripts/preflight.py games/game-4
GODOT_SMOKE_FRAMES=240 GODOT_BIN="$(bash std-skills/godot-game-dev/scripts/resolve-godot.sh)" \
  bash std-skills/godot-game-dev/scripts/smoke.sh games/game-4
GODOT_BIN="$(bash std-skills/godot-game-dev/scripts/resolve-godot.sh)" \
  bash std-skills/godot-game-dev/scripts/input-fuzz.sh games/game-4
```

判定协议：退出码 0 且日志含 `PREFLIGHT: PASS` / `GODOT_SMOKE: PASS` / `GODOT_FUZZ: PASS` 才算通过；退出码 2 = 环境不可用（装环境，不要改判定脚本）。

冒烟断言覆盖：场景接线（Main/Board/Cursor）、autoload 信号（含 `level_unlocked`）、键位契约（逐键核对，含 `undo`/`level_prev`/`level_next`）、光标可移动、confirm 旋转生效、第 1 关 1 步最优解通关得 3 星、reset 重开后可复玩、撤销回退步数与朝向（通关后屏蔽）、解锁门禁（未通关的关进不去）、第 2 关按最优解 4 步通关得 3 星、全部 10 关「target 朝向必可解 + 初始必未通关 + par 非递减 + 光束不穿透墙体」契约、分光三通双路出射契约。

## Web 导出

```bash
# 首次需在编辑器里打开一次工程（或 godot --headless --import）生成导入缓存
godot --headless --path games/game-4 --export-release "Web" export/web/index.html
```

- 导出预设：`export_presets.cfg`（preset `Web` → `export/web/index.html`）
- 产物：`index.html` / `index.wasm` / `index.pck`（`export/web/` 入库，作为 AppHost 部署的构建输入）
- 工程自带全局中文字体（`assets/fonts/NotoSansSC-Regular.otf`），浏览器沙箱内中文正常渲染，**不要删除**

## AppHost 部署

1. 导出产物已入库：`games/game-4/export/web/`（`index.html` / `index.wasm` / `index.pck`）
2. AppHost（slug `game-4`）指向本分支（`myrd/games-goal-cmuieqj7o0031m9gyf4pbwptg`）后构建部署
3. 部署硬约束（验收标准）：
   - `.wasm` 响应头 `Content-Type: application/wasm`
   - 跨域隔离响应头（COOP/COEP 或等效配置）正确
   - 资源无 404，页面控制台无报错
