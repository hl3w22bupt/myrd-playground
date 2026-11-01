# implement 节点复核 + 部署前音频契约预检（2026-11-02 · 复核轮）

> 本目录是 implement 节点复核轮的独立证据：对已提交内容集（HEAD `3037989`，feat(v3) 八关扩容 +
> 难度曲线上调 + 音频真实出声链路）**重跑全部本地门禁**，并对**本轮导出的新构建**做
> 部署前音频契约预检（能量探针 + 壳层 getOutputEnergy spec 契约），为 deploy → playtest
> 闭环去风险。判定脚本一律来自仓库 `std-skills/godot-game-dev/scripts/`（零自造零改写）。

## 1. 本地四门禁复核（HEAD 3037989，全部独立重跑）

| 门禁 | 结果 | 证据 |
|---|---|---|
| preflight | `PREFLIGHT: PASS`（15 类，2618 个工程文件） | preflight.log |
| godot-smoke | `godot-smoke: PASS` + `GODOT_SMOKE: PASS`（八关逐关通关 + 无尽探针证据行齐全，见下） | smoke-wrapper.log / smoke-raw.log |
| input-fuzz | `GODOT_FUZZ: PASS`（seed=20260913，6 批次 239 帧） | fuzz.log |
| playtest | `GODOT_PLAYTEST: PASS`（3 局 ×900 帧，fb=227/245/237，最长无反馈窗 ≤0.38s） | playtest.log |

smoke 逐关证据行（本次复跑实测，与 20261102-implement-v3-8levels 轮一致）：

```
[smoke] 第 1 关通关（…波次 4/4，★3，hpScale 1.00）… [smoke] 第 8 关通关（…波次 10/10，★3，hpScale 2.85）
[smoke] 无尽模式探针通过（入口可见、波次无限、强度 285.0→307.8、巨尸混编）
GODOT_SMOKE: PASS …八关逐关通关/…/夜幕剪影/坦克巨尸碾压/星级结算/无尽模式/…/音频契约与bus音量/调参协议 全部通过
```

## 2. 部署前音频契约预检（新构建，生产形态，零外部注入）

前轮（20261102-implement-v3-8levels）交付了壳层能量探针数据面，但当时只验证到「代码在位」；
本轮在部署前把「探针真的能量得出声」做成了机判事实，两条通道互相印证：

| 通道 | 手段 | 结果 |
|---|---|---|
| 全链路能量取证 | `qa/mobile/audio_energy_probe.mjs`（AnalyserNode 插桩 + 移动仿真 + 严格自动播放策略）对本轮导出产物（本地 mock AppHost 资产通道端点复跑） | **9/9 PASS**，`AUDIO_PROBE: PASS`：首手势前真实静音（ctx suspended、能量精确 0）→ 手势解锁 → BGM 真实出声（持续能量）→ 音效尖峰 → 静音即时归零 → 取消静音恢复 → pck sha256 与 13 音频资产在包内一致 → console 零 error。证据：audio-energy-probe-local.log / audio-energy-probe-local-report.json |
| 壳层 spec 契约直测 | `qa/mobile/shell-energy-contract.mjs`（新归档，**不注入任何探针**——完全生产形态，只考壳层自身 `__audioDebug().getOutputEnergy`） | **4/4 PASS**，`SHELL_ENERGY: PASS`：`energyProbe === true`；手势前 `{rms:0, running:false}`；手势后连续两窗 RMS **0.0266 / 0.0487 > 0.01**（与 BGM 理论输出 0.0265 定量吻合）；静音后 RMS = **0**（≤0.001 真实静默）；取消静音后 RMS 0.031 恢复。证据：shell-energy-contract-local.log |

> 即 playtest 节点的机判口径（spec `audio.outputEnergyProbe`：`getOutputEnergy(250)` × 2 连续
> RMS > 0.01 判真实出声、静音后 ≤ 0.001 判真实静默）在**新构建的生产形态壳页上已实证可用**。
> 双 AnalyserNode 并存兼容性也实测无冲突（取证工具注入的探针与壳层探针串联，两端均采到信号）。

复跑方式（本地，不需部署）：

```bash
# ① mock AppHost 资产通道（gzip+b64 pck 端点 + 静态托管 export/web），端口任选
node <mock-server> games/myrdplaygrou/export/web 8977
# ② 全链路能量取证
node games/myrdplaygrou/qa/mobile/audio_energy_probe.mjs --url "http://127.0.0.1:8977/" \
  --expect-pck-sha $(sha256sum games/myrdplaygrou/export/web/index.pck | cut -d' ' -f1) \
  --expect-js-sha  $(sha256sum games/myrdplaygrou/export/web/index.js  | cut -d' ' -f1)
# ③ 壳层 spec 契约直测（生产形态）
node games/myrdplaygrou/qa/mobile/shell-energy-contract.mjs "http://127.0.0.1:8977/"
```

## 3. 移交状态（deploy / playtest 节点）

- 分支：`myrd/pvz-web-goal-cmvxjycvn001zm905jnwpyliv`（HEAD `3037989` + 本复核轮提交；绝不用 main）
- 导出锚点（deploy 节点一致性核对用）：
  - `export/web/index.pck` sha256 = `31716e490805028f0994ae96a8a950b31074e130ed3cab109b362ba74f992d50`
  - `export/web/index.js`  sha256 = `8b649683883a8be172e229a0479503d50cd5245ebf87aa71fda70bf720824075`
- **线上仍是 v10 旧壳（无 `getOutputEnergy`，本轮 curl 实测 0 处命中）** —— deploy 节点必须重新部署
  本分支，使壳层能量探针上线；playtest 节点的「真实输出能量 > 阈值」机判依赖该数据面。
  部署后一致性核对：资产通道取线上 pck gunzip sha256 应等于上值，页面源码应含 `getOutputEnergy`。
- 部署后 playtest 节点可直接复用第 2 节两条通道（把 `--url` 换成 liveUrl、哈希换成上表锚点）。
