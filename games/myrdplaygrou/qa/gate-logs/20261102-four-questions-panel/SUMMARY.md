# 四问回填面板节点 —— 本地门禁证据（20261102）

> 改动面：`scripts/tuning_panel.gd`（四问 UI + 提交/中继）、`scripts/tuning_feedback.gd`（新增
> 纯映射层）、`tests/smoke.gd`（第 19 项契约机判）、`server/src/index.ts` + `server/src/lib/feedback-store.ts`
> （壳层中继）、`docs/tuning-feedback-four-questions.md`（契约）+ 两份既有文档同步。
> 分支：`myrd/pvz-web-goal-cmvxjycvn001zm905jnwpyliv`（本节点随 v6 线合入 main）。

## 1. 门禁结果（Godot 4.3.stable，本机无头）

| 门禁 | 判定 | 证据文件 |
|---|---|---|
| resolve-godot | PASS（godot 可用） | `resolve-godot.log` |
| preflight（15 类静态一致性） | PASS（2652 工程文件） | `preflight.log` |
| smoke（240 帧无头 + 断言扫描） | PASS（含第 19 项「试玩反馈四问契约」） | `smoke.log` / `smoke-assertions.log` |
| input-fuzz（6 批次对抗输入） | PASS（seed=20260913） | `input-fuzz.log` |
| playtest（3 局 × 900 帧机器人） | PASS（反馈窗 0.35-0.38s ≤ 10s，事件 227/245/236 ≥ 2） | `playtest.log` |
| server `tsc --noEmit` | PASS（rc=0） | `server-typecheck.log` |

冒烟断言行（PASS 行含新增段）：`…/调参协议/试玩反馈四问契约 全部通过`。

## 2. 新增机判的判别力实证（防「只跑绿」）

把映射层的「曲线单调性强制」临时注掉（模拟回归）后复跑冒烟，第 19 项按预期打红：

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

## 4. 部署面（如实记录）

- 本地四门禁 + 服务端 typecheck 全绿；**移动端门禁（mobile-web-smoke）与线上复证需要重新部署
  才能覆盖新面板** —— 本 run 身份 POST deployments 此前实证 403（见 7a79216 部署身份链取证），
  部署需 Admin 触发的 run（与 v10~v14 同路径）。部署后面板入口：
  `https://leomac-studio.tail49399e.ts.net/apps/myrdplaygrou/?tuning=1`。
- v6（7a79216）已过全部六门禁是保底合入对象；本节点改动已过本地门禁（preflight+smoke 必查项
  之外 fuzz/playtest 也绿），按节点口径**随 v6 一起合入 main**。
