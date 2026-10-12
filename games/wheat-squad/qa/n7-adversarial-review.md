# N7 对抗审查结论 — wheat-squad 可玩基线轮（2026-10-12 · 游戏QA）

> 三输入：① approved spec = 链 `cmv4q8bng001em9qm5p78do05`（v3 · approved · meta.version=1.1，导出件 `.myrd/spec/wheat-squad/design-spec.json` 锚全等）；② 实现只读 = HEAD `dca93ae` 工作区（只读核对，零改动）；③ 机器输出 = `gate-logs/n7-adversarial-20261012/01-gates-fresh.log`（本轮新鲜复跑，非引用历史）。

## 一、机器输出面（新鲜复跑四门禁全绿）

| 门禁 | 结果 |
|---|---|
| 自有契约套件 run-all | **13 PASS / 0 FAIL**（2 PEND = manual 结论面明示，零静默跳过） |
| 统一契约门禁（approved spec 对账） | **53 PASS / 0 FAIL · CONTRACT: PASS** |
| WS-SMOKE（headless 可重复） | **PASS** 打开→首次核心操作→victory 结算 167s→重开复位 + A1/A4 埋点真实产生 + console 零错误 |
| SCOPE-GUARD 违规标识符扫描 | **PASS** 47 文件零越界（策略单源，含素材文案面） |

## 二、acceptance 逐条对账（14 条）

- **auto 11 条全绿**：ac-a1（1.71s≤10s + 5 种子首杀≤30s）/ ac-a2（P50=168.1s∈[90,180] · P90≤300 · victory 20/20）/ ac-a4（0ms≤100ms · 通道 4≥2）/ det-1 / perf-1（含机型档节流仿真）/ tex-1 / anchor-1 / loop-1（冒烟）/ ac-art-1..3。
- **manual+auto 2 条**：ac-a3（机制面绿 · 结论面 **MANUAL-PENDING 0/5**——试玩记录未回填）/ ac-art-4（机制面绿 · 结论面工作室互查回执已落 `qa/style-consistency-check.md`，主人观感终裁保留）。
- **PEND 1 条**：fv-pend（放置收益数值待内测样本，结构冻结机判在档）。

## 三、对抗发现（真实缺口，不粉饰）

| # | 缺口 | 影响 | 归属 |
|---|---|---|---|
| G1 | **A2 分布面方差≈0**：确定性 bot 下 20 种子 P50=P90=168s——时长带判据达标但「玩家技能→时长分布」的真实方差需真人样本才能证 | A2 的真人分布面开放；不阻塞机判达标 | 主人试玩样本 |
| G2 | **A3 记录 0/5**：5 名试玩未回填，结论面未达——本轮四件套 = 3 达 1 未达 | 可玩基线「达标」声明必须带此保留 | 主人侧试玩组织 |
| G3 | **机型档真机面缺位**：node 节流仿真代证（50ms 步进不崩+实体上限保持），中端安卓/2GB 老机真机 P95 帧时间未实测 | 真机走查列入试玩清单（QA 已在试玩表附采集列） | 主人侧/下轮 |
| G4 | **冒烟两处 latent 缺陷已修**（本轮契约先行价值实证）：①CDP 盲打坐标落 canvas 外→「拖动击杀」曾为站桩被动达成；②零持按拖拽 rAF 观察不到 pointer→first_core_action 曾永不置位。均已修正并以 A1/A4 埋点断言锁死 | 已闭环；冒烟断言面从此不可被站桩路径骗过 | 已解决 |
| G5 | wx/dy 端口未启动（spec meta.platform.note 既定顺延批次） | 不在本轮范围 | 下轮沿判例 |

## 四、结论与放行

- **机判面全绿、产物零漂移、缺口如实列明** → **放行工作流 deploy 节点**（可玩基线上线，主人试玩入口交付）。
- 「四件套全达」**本轮不宣称**：A3 结论面待 5 名试玩回填（G1/G2/G3 一并采集）。
- **冻结计数器：0/3**（基线轮第 1 轮；口径=连续 3 轮四件套**全不达**才计数，本轮 3 达 1 未达 → 不计数）。

## 五、违规标识符扫描规则清单（QA 防缩水确认）

策略单源 = `games/wheat-squad/ci/scope-policy.json`，QA 确认覆盖七类：①一号仓路径 ②g2-blocks 线（零接触边界）③一号仓 spec 件名 ④兄弟线 spec 目录 ⑤好友数据开放数据域标识符 ⑥凭证类标识符（password/secretKey/apiKey/access_token/credential）⑦**素材文案极限词**（含 .svg/.md/.toml 扫描面）——`node ci/guard-repo-scope.mjs` 一键复跑，47 文件全量。豁免面仅三类（策略/脚本自身、声明性文档、契约 FORBIDDEN 列举），无静默豁免。
