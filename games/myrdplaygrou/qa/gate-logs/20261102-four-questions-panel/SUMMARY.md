# 四问回填面板节点 —— 本地门禁证据（20261102 · 合流版）

> 改动面：`scripts/tuning_panel.gd`（四问 UI + 提交/中继）、`scripts/tuning_feedback.gd`（新增
> 纯映射层）、`tests/smoke.gd`（第 21 项契约机判）、`server/src/index.ts` + `server/src/lib/feedback-store.ts`
> （壳层中继）、`docs/tuning-feedback-four-questions.md`（契约）+ 两份既有文档同步。
> 分支：`myrd/pvz-web-goal-cmvxjycvn001zm905jnwpyliv`（本节点随 v6 线合入 main）。

## 0. 与 v6 线的合流（重要过程事实）

- 本地工作线曾停在 `3d01f72`（goal auto-commit）后；推送时被拒才发现远端分支已有 **v6 修复线**
  （71b4e5f / 599407e / d3313bb 合流 / 7a79216 r5 发布收口 / 3834ae3 playtest 重跑收口）。
  即节点口径的「保底合入对象 7a79216」在远端分支上，本地此前并不包含它。
- 处置：`git merge FETCH_HEAD`（远端分支并入本地，不重写历史、不强推）；唯一冲突 =
  `tests/smoke.gd`（断言编号：远端已用 19/20 = HUD 五档布局 / 音频紧张感，本节点四问契约
  顺延为 **21**；PASS 断言行并列为两条之和）。
- 合流后先 `godot --headless --import` 二次导入（远端新增 wave_urgent / zombie_groan /
  chomp / bgm-intense 等 wav，缺 `.sample` 缓存 = 知识文档「导入干净」前置的已知坑），再复跑门禁。

## 1. 门禁结果（Godot 4.3.stable，本机无头，**合流后复跑**）

| 门禁 | 判定 | 证据文件 |
|---|---|---|
| resolve-godot | PASS（godot 可用） | `resolve-godot.log` |
| preflight（15 类静态一致性） | PASS（2782 工程文件，合流后） | `preflight.log` |
| smoke（240 帧无头 + 断言扫描） | PASS（19/20 远端断言 + 21 四问契约全部通过） | `smoke.log` / `smoke-assertions.log` |
| input-fuzz（6 批次对抗输入） | PASS（seed=20260913） | `input-fuzz.log` |
| playtest（3 局 × 900 帧机器人） | PASS（节奏代理指标在阈值内） | `playtest.log` |
| server `tsc --noEmit` | PASS（rc=0） | `server-typecheck.log` |

冒烟 PASS 行：`…/调参协议/HUD五档视口布局无溢出无重叠/顶栏单实例守卫/紧张感音画（双版BGM+低吼+啃食+危机警报+号角）/试玩反馈四问契约 全部通过`。

## 2. 新增机判的判别力实证（防「只跑绿」）

把映射层的「曲线单调性强制」临时注掉（模拟回归）后复跑冒烟，第 21 项按预期打红：

```
GODOT_SMOKE: FAIL 四问契约：Q2 建议起点应自第 1 关（实得 2）
GODOT_SMOKE: FAIL 四问契约：Q2 hp_scale 建议应覆盖第 1-8 关全部 8 关（实得 7 条）
GODOT_SMOKE: FAIL 四问契约：Q2 hp_scale 建议破坏逐关严格递增（curveRule）
GODOT_SMOKE: FAIL 四问契约：Q2 speed_scale 建议应覆盖第 1-8 关全部 8 关（实得 7 条）
GODOT_SMOKE: FAIL 四问契约：Q2 speed_scale 建议破坏逐关严格递增（curveRule）
```

恢复实现后复跑 → PASS。该轮还暴露并修正了测试期望自身的缺陷：附「第 1 关」时建议起点
应断言为钳制后的第 2 关（教学入口不动），而非用户原答的 1。

## 3. 壳层中继路由实测（Hono app.request，esbuild bundle 后 node 直跑）

```
valid POST  -> 200 {"received":true,"receivedAt":"2026-11-02T10:48:54.562Z","submissions":1,...}
bad enum POST -> 422 INVALID_ANSWERS
missing q4 POST -> 422 INVALID_ANSWERS
bad stars POST -> 422 INVALID_ANSWERS
bad json POST -> 400 BAD_JSON
neutral POST -> 200
GET latest  -> 200 answers={"q1_duration":"just_right",...}（latest 语义正确）
health      -> 200 {"ok":true,"app":"myrdplaygrou",...}（既有路由不受影响）
```

## 4. Q3 建议映射与 v6 紧张感实现的对齐核对

远端 v6 线已落地 spec.numeric.audio 紧张感分层（双版 BGM 交叉淡入 + 僵尸低吼 4~8s +
危机警报/啃食/号角）。四问面板 Q3 的「from」口径据此核对：
- 切换规则 `Audio.tension_should_be_intense`：出场波次 ≥ ceil(总波次/2) 或末波（无尽 ≥ 第 4 波）
  —— 与建议载荷 `intense_switch_rule.from` 文案一致；
- 基础层音量仍是 spec 0.4 线性（-8dB，分层靠编曲不靠响度）—— `bgm_volume.from=0.4` 仍准确；
- 建议只给档位（提前/延后 + 0.45/0.32），不动实现 —— 拍板后由 revisions 入链再同步默认值。

## 5. 部署面（如实记录）

- 本地四门禁 + 服务端 typecheck 全绿；**移动端门禁（mobile-web-smoke）与线上复证需要重新部署
  才能覆盖新面板** —— 本 run 身份 POST deployments 此前实证 403（见 7a79216 部署身份链取证），
  部署需 Admin 触发的 run（与 v10~v14 同路径）。部署后面板入口：
  `https://leomac-studio.tail49399e.ts.net/apps/myrdplaygrou/?tuning=1`。
- v6（7a79216）已过全部六门禁是保底合入对象；本节点改动已在**合流后的分支头**上过本地门禁
  （preflight+smoke 必查项之外 fuzz/playtest 也绿），按节点口径随 v6 一起合入 main。
