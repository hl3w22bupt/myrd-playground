// 由 tools/gen-spec-data.mjs 生成 —— 零手抄；单源=/Users/leo/.myrd/workspaces/cmto0g28j0002m9sqnvjdy8o7/run-cmvn4x20g006vm9gbk1ux87xj/.myrd/spec/line4-unblock-jam/design-spec.json
// spec 锚：cmvlrc0ma001tm94ialxeykjn@v2:approved
// 重生成请跑：node tools/gen-spec-data.mjs
export const SPEC_ANCHOR = {"id":"cmvlrc0ma001tm94ialxeykjn","version":2,"status":"approved","slug":"line4-unblock-jam"};

export const NUMERIC = {
  "DEFAULT_SEED": 20261024,
  "FIXED_STEP_MS": 16,
  "firstGuideWindowSec": 60,
  "redRoundStepBudget": 12,
  "redRoundFailDowngrade": 2,
  "smokeN": 20,
  "smokeSeeds": "42..61",
  "entityCap": 60,
  "stepBudgetMs": 16,
  "clockSource": "表现层 performance.now()；内核零 Date.now（fixed-step 16ms 累计）——F4 时钟源定死",
  "deviceTier": "中端 60fps 基准（stepBudgetMs=16 · 首交互 ≤3000ms）——承 wheat-squad perf-1/line3 判例口径（F4 设备档位定死）",
  "levelGen": {
    "baseGrid": "6x6",
    "carLenOptions": [
      2,
      3
    ],
    "parBand": "PEND-待校准",
    "trafficDensityBand": "PEND-待校准"
  },
  "measurement": {
    "clockSource": "表现层 performance.now()；内核零 Date.now（fixed-step 16ms 累计）——F4 时钟源定死",
    "sampling": "冒烟自测 N=20 局（seeds 42..61）全量帧采样 + a3 真人 5 名（好玩终裁另列）——F4/F3 采样量定死",
    "smokeN": 20
  }
};

export const TELEMETRY_COLUMNS = [
  {
    "key": "first60s_guide_done_rate",
    "target": "≥0.90（bot 面 20 局）",
    "sampling": "F3 判读证据定死：dev HUD first60s 读数 + 冒烟自测 N=20 局（seeds 42..61，N 定死）"
  },
  {
    "key": "car_exit_latency_ms_p95",
    "target": "≤100ms",
    "sampling": "驶出判定→vf-car-exit-burst 事件帧同帧计；冒烟 20 局全量帧 performance.now() 差分"
  },
  {
    "key": "combo_pending_violations",
    "target": "=0（恒等式：comboCount 增量必伴随 car.exit 事件帧，pending 不计连击）",
    "sampling": "冒烟 20 局事件流逐帧审计"
  },
  {
    "key": "frame_time_p95_ms",
    "target": "≤16",
    "sampling": "冒烟 20 局全量帧 performance.now() 差分"
  },
  {
    "key": "fps_min",
    "target": "≥55（中端档）",
    "sampling": "冒烟 20 局全量帧"
  },
  {
    "key": "session_complete_rate_bot",
    "target": "≥0.85（谱系可用性下限）",
    "sampling": "冒烟 20 局 seed 谱系终局计数"
  }
];

export const TELEMETRY_KEYS = TELEMETRY_COLUMNS.map((c) => c.key);
