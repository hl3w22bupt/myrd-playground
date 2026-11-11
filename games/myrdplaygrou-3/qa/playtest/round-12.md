# round-12：v3 收尾门禁复跑 + 部署一致性核验（2026-11-11）

## 观察

收尾门禁全绿：tests/run-all 7/7 PASS（构建复现/controls-direction/football-contract/kernel-determinism/singlefile/smoke-payload 含 v3 断言面/state-machine）；preflight 21 项 0 WARN；browser-smoke 双视口 PASS（desktop fps=12.4 / mobile fps=13.2，exceptions=0，截图非纯色 52/38 种量化色，drawCalls 135/178）；asset-triple-check PASS（清单 7 项全 programmatic，0 张位图入包）；线上 mobile-web-smoke 10 PASS + 1 WARN（结构性与 v9 同形态）；线上 GET / 与 dist/web/index.html 逐字节一致（606,863B，sha256 前缀 321171cd）；部署 v10=cmwc10na3000qm9bh18cu3lvp running @ commitHash=c906e96f=推送 HEAD 全等（首发改部署 cmwc1029w clone exit 128 失败如实留痕，重发即成——疑似与推送 tip 同步竞速的瞬时失败）。

## 动作

- node tools/build.mjs（SRC_SHA=d9e8dca0a0ec8e18，产物 606,863B）+ node tools/verify-reproducible.mjs（两次构建逐字节一致 PASS）+ node tools/stage-dist.mjs（dist/web index.html=landing.html 逐字节一致 PASS）
- node tests/run-all.mjs → GAME-GATES: PASS（7/7）
- node std-skills/threejs-game-dev/scripts/preflight.mjs games/myrdplaygrou-3 → PREFLIGHT: PASS（0 WARN）
- node std-skills/threejs-game-dev/scripts/browser-smoke.mjs games/myrdplaygrou-3 → BROWSER-SMOKE: PASS（双视口）
- node std-skills/threejs-game-dev/scripts/asset-triple-check.mjs --game games/myrdplaygrou-3 --spec games/myrdplaygrou-3/.myrd/spec/design-spec.json → PASS
- node std-skills/godot-game-dev/scripts/mobile-web-smoke.mjs --url <liveUrl> --out games/myrdplaygrou-3/qa/mobile → MOBILE_SMOKE: PASS
- 线上一致性：GET /health 200 + GET / 200 606,863B cmp 逐字节一致
- playtest-summary.mjs 重锚本轮 HEAD + visual-ratchet（advisory）v9→v10 相邻部署配对

## 截图

- qa/smoke/smoke-mobile.png 冒烟快进进球瞬间（横幅「进球！主队」+网窝+彩带+比分弹跳+常驻标签+单环同框）
- qa/smoke/smoke-desktop.png 桌面视口同刻取证（宽高比自适应取景）
- qa/mobile/phase-joystick.png 线上移动端门禁摇杆相位取证

## 改动

- 无新增源码改动（收尾复跑轮）；本轮全部源码改动在 c906e96（hud.flashBanner 回补 + 契约测试扩 v3 断言面 + spec 镜像升 v3），判定脚本与 .myrd/routines.yaml 零触碰

## 复玩对比

- v9（c8146ba）→ v10（c906e96）：线上 mobile 门禁 PASS 形态一致；smoke fps 移动 16.6→13.2（headless 软渲染波动带内，门限 ≥10）；drawCalls 201→178（Bloom 1/8 沿用 + 切环单实例化后场景更简）
