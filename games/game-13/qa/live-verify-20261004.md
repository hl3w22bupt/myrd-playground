# 《测试预算边界》线上版复核留证（2026-10-04）

## 结论：liveUrl 可玩 ✅

| 项 | 值 |
| --- | --- |
| liveUrl | https://leomac-studio.tail49399e.ts.net/apps/game-13/ |
| HostedApp id | `cmusp1obl001tic7qg3cb7dco`（slug=game-13，status=ready） |
| 当前 deployment id | `cmusr6ple009nic7qith14q19`（v3 · running） |
| 历史部署 | `cmusqwsov009jic7qp1sop5a0`(v1)、`cmusqxl1b009lic7q2k1j0wru`(v2) 已 superseded |
| gitRef | `myrd/run-goal-cmusp1pjb001vic7qpt4udw7i` @ db6f18a（manifestPath=games/game-13/apphost.toml） |

## 服务端检查
- `GET /health` → `{"ok":true,"app":"testing-budget-boundary","env":"development","assets":"lazy/object-storage"}`
- `GET /` → 200，`<title>测试预算边界</title>`，壳页提示为玩法口径（点击/拖拽收集 · 每次动作消耗 1 点预算 · ESC 暂停 · R 重开）
- 资产通道全部 200，字节数与本地导出一致：index.js 331495B / index.wasm.gz.b64 10696408B / index.pck.gz.b64 3373932B / index.html.gz.b64 4854B

## 浏览器复核（Chromium 无头 1280x720，脚本 qa/live_smoke.mjs）

`LIVE_SMOKE: PASS（6/6 项通过）`
- 落地页可达、标题正确
- 引擎 canvas 挂载（1280x720）
- 点击后画面像素变化（收集反馈/消散动画）
- 无 pageerror、无 console 报错

**决定性交互证据（shots-live-20261004/）**
- `live-01-boot.png`：开局画面 —— 收集进度 0/6、剩余预算 8、6 枚结晶、教学提示、本局用时
- `live-02-after-click-collected.png`：点击同一位置两次后 —— 收集进度 **1/6**、剩余预算 **8→6**、首枚结晶已消失
  （第一次点击收集扣 1，第二次点击落空按误触再扣 1，与「每次动作消耗 1 点预算」口径一致）

## 待 owner 完成（不可代行）
真机试玩回填：桌面 + 移动各试玩一次（入口 = liveUrl），确认手感与计费口径后在目标卡片回填「试玩通过」。
