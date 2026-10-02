# game-12 线上复核报告（部署节点 → 产物回写节点）

- 复核对象：`https://leomac-studio.tail49399e.ts.net/apps/game-12/`（HostedApp `cmur8pm9j000iicbsmd25q04l`，deployment `cmurba8yd001vicbsfdl79x8l`，commit c54fcc9）
- 复核时间：2026-10-03 · 执行：导出部署节点的线上复核子任务
- 结论：**liveUrl 可玩、防重语义成立** —— 正式移动门禁 PASS 10/10，防重语义探针 PASS 7/7

## 1. 正式门禁（判定脚本来自仓库 std-skills/godot-game-dev/scripts/）

```
node std-skills/godot-game-dev/scripts/mobile-web-smoke.mjs \
  --url https://leomac-studio.tail49399e.ts.net/apps/game-12/ --out games/game-12/qa/mobile
```

退出码 0，stdout 含 `MOBILE_SMOKE: PASS`，10 项全绿（网络全通 / console 零错 / canvas /
非纯色首帧 / 画面在动 / 触摸到达 / 触摸响应 / __audioDebug 解锁契约 / 无横向溢出 /
FPS=39 ≥ 8）。证据：`qa/mobile/report.json` + phase-load/tap/joystick 三截图。
curl 直测：`/health` → 200 `{"ok":true,"app":"game-12","env":"development","assets":"lazy/object-storage"}`；`/` → 200（含 canvas 与壳契约桥）。

## 2. 防重语义探针（qa/online-debounce-probe.mjs，QA 证据工具，非门禁）

mobile 门禁证不了「300ms 内连点只计一次」，本探针以 CDP 触摸 + CountLabel 数字区像素指纹机判：

| 检查 | 结果 | 关键数值 |
| --- | --- | --- |
| 事件交付（防重前提） | PASS | 一次 tap = 1×touchstart + 1×touchend + **0 个 compat 鼠标事件** |
| 单击计数 | PASS | 指纹 F1 ≠ F0（count 0→1，数字真被计入） |
| 300ms 内双击只计一次 | PASS | F2 == F1（到达 spread 127ms，被拦截） |
| 300ms 内三连击只计一次 | PASS | F3 == F1（spread 178ms） |
| 40ms×5 连点风暴只计一次（AC2 原口径） | PASS | F4 == F1（spread 259ms，5 击只 +1） |
| 窗口结束恢复累加 | PASS | 跨窗两次（500ms）指纹 F5 ∉ {F1,F4}（count=2） |
| 触屏点「重开」归零 | PASS | touch 按压 30ms 一次命中（另有 120ms/mouse 对照未需启用） |

证据：`report.json` + 01~07 分步截图（每步含 count 数字可肉眼复核）。

## 3. 探针校准教训（复用给后续节点的机判工具）

1. **CDP Input 每条指令往返 ~70ms**：`await` 回包再发下一击会把「80ms 设定间隔」放大成
   ~260ms 真实到达间隔，正好压在 300ms 窗口边缘 → 三连击以上必然假阳性漏判。
   连击必须用**不等待回包的排队发送**（WebSocket 保序），到达间隔 ≈ 设定值。
2. **游戏坐标 → 屏幕坐标必须过 toScreen()**：画布 720×1280 + keep 拉伸到 390×844 视口。
   重开按钮游戏坐标 (360,1202)，屏幕坐标 (195,726) —— 探针曾拿游戏坐标当屏幕坐标点，
   点到视口外 (360,1202)，造成「重开失效」假象。两套坐标混用是机判工具的经典翻车点。
3. **冷加载首帧抖动**：swiftshader 软渲染下刷新后首击可能被处理延迟 >300ms。每个场景
   先预热单击一轮再刷新归零，之后的到达抖动 <50ms，窗口判定才公平。
4. **一次触控 = 一组事件**是防重语义的前提：Godot web preventDefault 后 compat 鼠标事件
   为 0（已机判）。若壳/引擎改动后 compat ≠ 0，防重窗口会被「一次触碰两组事件」击穿。

## 4. 验收标准对照（需求 id=cmur8x93r0016icbsd90s6e60）

| AC | 线上证据 |
| --- | --- |
| 1 点击计数（>300ms 连点 10 次恰好 10） | 引擎侧合成时间戳冒烟确定性断言（godot-smoke PASS）；线上单击/跨窗累加路径 PASS |
| 2 300ms 内连点 5 次只 +1 | 探针 40ms×5 风暴 PASS（spread 259ms，只 +1） |
| 3 防重窗口结束恢复累加 | 探针跨窗两次 PASS（count=2 ≠ 1） |
| 4 移动可玩（375 视口无横滚、触控 ≥44px） | mobile 门禁「无横向溢出」PASS（390 视口）；按钮 560×240 游戏像素 |
| 5 刷新归零 | 探针场景隔离即「刷新归零」（6 次刷新基线全为 count=0）+ 触屏重开归零 PASS |
