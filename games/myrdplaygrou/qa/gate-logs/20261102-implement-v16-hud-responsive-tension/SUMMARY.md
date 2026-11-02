# implement v16 合并轮门禁证据（HUD 响应式 + 紧张感音画 × v15 挂件审计线合流）

- 分支：`myrd/pvz-web-goal-cmvxjycvn001zm905jnwpyliv`
- 本轮提交：`09366fa`（v16：HUD 响应式布局 + 紧张感音画）rebase 到远端 v15 线
  （`df378c9` 挂件审计 + 结算误触窗按钮防线 + 无尽战报 off-by-one）之上，冲突手工合并：
  - hud.gd：取 v16 响应式重写为基底（挂件生命周期不变式天然成立：常驻挂件一次性挂载、
    rebuild_cards 只重建出战卡），移植 v15 的 `widget_audit()`（适配 RowA/B/C 多行扫描）与
    D3 无尽战报 +1。
  - tests/smoke.gd：v15 断言保持 19（挂件审计）/ 20（结算误触窗按钮防线）；v16 断言重编号
    21（五档视口布局机判）/ 22（紧张感音画能量机判 + 接线探针）；PASS 汇总行两线全列。
  - result_overlay.gd：v15 的 can_accept 按钮防线 + v16 的按钮 44px 热区（自动合并无冲突）。
- 四门禁（合并态复跑，2026-11-02）：
  - preflight：PASS（15 类，2685 文件）
  - GODOT_SMOKE: PASS（含 v15 断言 19/20 + v16 断言 21/22 全绿，八关逐关通关 + 无尽探针）
  - GODOT_FUZZ: PASS（seed=20260913，6 批次 239 帧）
  - GODOT_PLAYTEST: PASS（3 局 900 帧，节奏代理指标在阈值内）
- 取证行见本目录 `smoke-raw.log`：五档视口（360/640=2 行、1024+=1 行、零溢出零重叠、正文 18px、
  热区 ≥44px）+ 八关逐关通关 + 无尽探针。
