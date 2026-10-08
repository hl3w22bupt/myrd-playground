# freeze-sprint-r1-art-recheck-20261008 — 封版冲刺第 1 批 · 美术线（N5）复核轮

> 复核人：游戏美术（2026-10-08）。触发原因：任务重派后的「不采信台账、实跑复核」纪律（与程序线复核轮同口径）。
> 复核对象：N5《物料代差清单》五项交付（矩阵 / 风格卡 v1.2 实测固化回写 / 素材归档挂来源 commit / 三平台分享卡模板骨架 / wx 侵权比对 + dy 克制版文案）。
> 结论：**N5 交付面成立**——物料回溯机判 11/11 PASS EXIT=0；机器门禁自跑全绿（palette / Mode A 契约 / 三树红线）；抓到并更正 1 处三态词汇漂移（F-A1）+ 登记 1 项 rebase 美术面连锁（F-A2，挂 G3）。

## 一、证据清单

| # | 文件 | 内容 |
|---|---|---|
| 01 | `01-material-trace.log` + `01-material-trace.json` | 物料回溯机判原文（T-01..T-11，机读 JSON 含逐项 sha256/commit/path） |
| 02 | `02-gates.log` | 机器门禁自跑原文（命令 + 输出 + 退出码同行）：palette 双门禁 / Mode A 契约 / 三树红线 |
| 03 | `art-trace-check.mjs` | 复核器本体（零依赖 node；`--ws <run-ws> --out <file>`，exit 0=全绿），在档可重跑 |

## 二、复核方法（不采信台账）

1. **逐 commit 实跑回溯**：矩阵 M-01..M-11 声明的每条「来源 commit + 落点 + sha256」用 `git -C <树> show <sha>:<path>` 取 blob 实算 sha256 比对，不引用台账文字自证。
2. **三向全等判据**（图标 exact-copy）：manifest `derived.sha256` ≡ `derivedFrom.sha256` ≡ blob 实算。
3. **零漂移判据**：来源 commit blob ≡ 各树 HEAD blob（style-card / palette / 分享卡 / 手感 pack / 发布面 9 件）。
4. **机器门禁自跑**：美术面（palette / ac-11 单源 / ac-13 零外部贴图）+ 三树红线（R1–R6）全部本机实跑取证。

## 三、发现与处置

| 编号 | 发现 | 处置 |
|---|---|---|
| F-A1 | M-02/M-03 三态标「重制」，但两份图标 manifest 均为 `exact-copy（零裁切零改绘，sha256 三向全等 8a971534…）`——按矩阵自身三态定义应标「沿用」 | ✅ 已更正（矩阵 §一 应用图标行 + 黑板 assets.md M-02/M-03 行同步）；sha256 链不受影响 |
| F-A2 | dy 包分享卡 = A-07 原批 `c705aaa6…`（v1.1 分叉时点）；web 主线 F-07 轻更新后 = `fe5a20d1…`。rebase v1.2 后 dy 卡随 merge 更新 → manifest sha256 重出 + 按 M-09 骨架复验版式 | 挂 blockers.md G3 美术面输入，rebase 执行时美术线随动 |
| 观察项 | wx 商店截图「选批定稿」= `docs/platform/wx/wx-submission-kit.md` 决策记录（@`eb9ddab`），非独立 PNG 落 assets/——矩阵口径与实物一致 | 无需处置 |
| 观察项 | web 主线树存在未提交残留 `tests/contract/.j1-evidence.json`（契约运行时回写件，程序线域） | 属程序线域，仅登记不处置 |

## 四、红线核销

零新绘/零改绘 · spec/numeric 零写入 · 玩法代码零改动 · stack-tower / pixel-fives 零接触。
本轮全部 git 变更仅黑板证据面（`.myrd/blackboard/g2-blocks/`）。
