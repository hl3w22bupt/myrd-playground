// config.ts — 数值单源装配：configFromSpec(approved spec 导出件) ⇄ MIRRORED 镜像常量
// 铁律（spec-first-numeric-change 判例）：数值只认 spec.numeric；本文件镜像值必须与
// approved 导出件逐字段相等——契约 helpers.assertConfigMirror() 深比钉住，任何数值改动
// 必须先走 spec revision（version+1），禁止两头各改各的。
// 注：spec.numeric._calibrationNote 声明本段为初始锚定值（非实测），实现轮首批模拟局后
// 走 revision 校准——镜像断言保证校准前代码侧零漂移。

                                                     
                                                         

                                                                                   
                             
                      
                      
                    
                       
                                  
                                                                                          
          
                                                                
                                                          
                                            
    
           
                                                                          
                                                                                  
                                                      
                                                        
    
                                                                                         
                                                                                             
                                                                                                                                 
                                                                                                       
                                                                     
                                                              
                                                 
                                                                                                                                                                                                      
 

/** spec 六段归一：兼容 wrapped 导出件（{schemaVersion,spec,_platform}）与裸六段两种形状 */
export function specDoc(row         )                      {
  const r = row                       ;
  return r && typeof r === "object" && (r       ).spec && typeof (r       ).spec === "object" && (r       ).numeric === undefined
    ? (r       ).spec
    : (row                       );
}

/** approved spec 导出件 → 运行配置（数值只认 spec；显式投影——注记键不入镜像比对面） */
export function configFromSpec(row         )             {
  const doc = specDoc(row);
  const n = doc.numeric;
  if (!n) throw new Error("configFromSpec: spec.numeric 缺段（数值只认 spec，拒绝猜测默认值）");
  // 显式逐字段投影：spec.numeric 的注记键（perf.机型档 / waveBand.status /
  // waveTable.firstWaveLeniency 文本说明）为描述面非数值面，不进运行配置；
  // 镜像比对只认数值字段。spec 新增数值字段时，本投影与 MIRRORED 须同轮 revision 同步。
  const g = (o     , k        )         => {
    const v = o?.[k];
    if (typeof v !== "number") throw new Error(`configFromSpec: numeric.${k} 缺失或非数值（投影面与 spec 失配，先走 revision 对齐）`);
    return v;
  };
  return {
    fixedStepMs: g(n, "FIXED_STEP_MS"),
    defaultSeed: g(n, "DEFAULT_SEED"),
    coreLives: g(n, "coreLives"),
    victoryWaves: g(n, "victoryWaves"),
    firstPlacementBudgetSec: g(n, "firstPlacementBudgetSec"),
    economy: {
      startGold: g(n.economy, "startGold"),
      killRewardBase: g(n.economy, "killRewardBase"),
      killRewardGrowthPerWave: g(n.economy, "killRewardGrowthPerWave"),
    },
    enemy: {
      hpBase: g(n.enemy, "hpBase"),
      hpGrowthPerWave: g(n.enemy, "hpGrowthPerWave"),
      bountyBase: g(n.enemy, "bountyBase"),
      spawnIntervalBaseMs: g(n.enemy, "spawnIntervalBaseMs"),
      speedTilesPerSec: g(n.enemy, "speedTilesPerSec"),
      types: {
        grunt: { hpMul: g(n.enemy.types.grunt, "hpMul"), sizePx: g(n.enemy.types.grunt, "sizePx"), speedMul: g(n.enemy.types.grunt, "speedMul") },
        runner: { hpMul: g(n.enemy.types.runner, "hpMul"), sizePx: g(n.enemy.types.runner, "sizePx"), speedMul: g(n.enemy.types.runner, "speedMul") },
        brute: { hpMul: g(n.enemy.types.brute, "hpMul"), sizePx: g(n.enemy.types.brute, "sizePx"), speedMul: g(n.enemy.types.brute, "speedMul") },
      },
    },
    turret: {
      costPlace: g(n.turret, "costPlace"),
      costUpgradeBase: g(n.turret, "costUpgradeBase"),
      costUpgradeGrowth: g(n.turret, "costUpgradeGrowth"),
      dmgPerShotBase: g(n.turret, "dmgPerShotBase"),
      dmgGrowthPerLevel: g(n.turret, "dmgGrowthPerLevel"),
      fireIntervalMsBase: g(n.turret, "fireIntervalMsBase"),
      fireIntervalDecayPerLevel: g(n.turret, "fireIntervalDecayPerLevel"),
      levels: g(n.turret, "levels"),
      rangeTilesBase: g(n.turret, "rangeTilesBase"),
      rangeGrowthPerLevel: g(n.turret, "rangeGrowthPerLevel"),
    },
    waveTable: {
      waves: g(n.waveTable, "waves"),
      enemiesPerWaveBase: g(n.waveTable, "enemiesPerWaveBase"),
      enemiesGrowthPerWave: g(n.waveTable, "enemiesGrowthPerWave"),
    },
    waveBand: {
      p50MinSec: g(n.waveBand, "p50MinSec"),
      p50MaxSec: g(n.waveBand, "p50MaxSec"),
      p90MaxSec: g(n.waveBand, "p90MaxSec"),
      sampleSeeds: g(n.waveBand, "sampleSeeds"),
    },
    feedback: {
      latencyMaxMs: g(n.feedback, "latencyMaxMs"),
      channelsPerActionMin: g(n.feedback, "channelsPerActionMin"),
      frameP95Ms: g(n.feedback, "frameP95Ms"),
      frameSampleN: g(n.feedback, "frameSampleN"),
      hitFlashMs: g(n.feedback, "hitFlashMs"),
    },
    perf: {
      entityCap: g(n.perf, "entityCap"),
      stepBudgetMs: g(n.perf, "stepBudgetMs"),
      midTierStepMs: g(n.perf, "midTierStepMs"),
      firstInteractionMs: g(n.perf, "firstInteractionMs"),
    },
    palette: {
      whitelist: Object.fromEntries(Object.entries(n.palette.whitelist).map(([k, v]) => [k, String(v)])),
      deriveRule: String(n.palette.deriveRule),
    },
    pacing: {
      // world.operationPaths/level-1 文本面：前 10 秒敌量减半 → 宽松窗 10000ms；
      // 波前准备/波间歇/弹速为实现层节奏常量（levels.md 判据映射表逐条披露）
      firstWaveLeniencyMs: 10000,
      wavePrepMs: 8000,
      waveIntermissionMs: 5000,
      projectileSpeedPxPerSec: 320,
      traceMs: 120,
      particleLifeMs: 220,
      bounceMs: 200,
      fadeMs: 200,
    },
  };
}

/** 镜像常量（= approved 链 v2 `cmvbqgzbl0029m9ax64foxd37` spec.numeric 逐字段；
 *  浏览器构建无 spec 文件运行时的兜底装配面；与 spec 漂移即契约红） */
export const MIRRORED             = {
  fixedStepMs: 16,
  defaultSeed: 20261016,
  coreLives: 10,
  victoryWaves: 8,
  firstPlacementBudgetSec: 20,
  economy: { startGold: 120, killRewardBase: 8, killRewardGrowthPerWave: 1.02 },
  enemy: {
    hpBase: 30, hpGrowthPerWave: 1.35, bountyBase: 8,
    spawnIntervalBaseMs: 900, speedTilesPerSec: 1.2,
    types: {
      grunt: { hpMul: 1, sizePx: 16, speedMul: 1 },
      runner: { hpMul: 0.6, sizePx: 14, speedMul: 1.6 },
      brute: { hpMul: 3, sizePx: 20, speedMul: 0.7 },
    },
  },
  turret: {
    costPlace: 50, costUpgradeBase: 80, costUpgradeGrowth: 1.6,
    dmgPerShotBase: 10, dmgGrowthPerLevel: 1.6, fireIntervalMsBase: 800,
    fireIntervalDecayPerLevel: 0.85, levels: 3,
    rangeTilesBase: 2.5, rangeGrowthPerLevel: 0.5,
  },
  waveTable: { waves: 8, enemiesPerWaveBase: 6, enemiesGrowthPerWave: 1.35 },
  waveBand: { p50MinSec: 240, p50MaxSec: 420, p90MaxSec: 600, sampleSeeds: 20 },
  feedback: { latencyMaxMs: 100, channelsPerActionMin: 2, frameP95Ms: 16, frameSampleN: 3000, hitFlashMs: 90 },
  perf: { entityCap: 220, stepBudgetMs: 16, midTierStepMs: 33, firstInteractionMs: 3000 },
  palette: {
    whitelist: {
      "bg-deep": "#202A38", "core-coral": "#E76F51", "enemy-berry": "#B75D69", "field": "#2F4156",
      "grid-line": "#47617C", "path-sand": "#E9D8A6", "text-cream": "#F4F1DE", "turret-green": "#81B29A",
    },
    deriveRule: "仅允许白名单两色按 theme.ts 常量比例混合（炮塔阶= turret-green×text-cream 0/20/40%；敌血带= enemy-berry×bg-deep 0/30%）；新增色相=违例",
  },
  pacing: {
    firstWaveLeniencyMs: 10000, wavePrepMs: 8000, waveIntermissionMs: 5000,
    projectileSpeedPxPerSec: 320, traceMs: 120, particleLifeMs: 220, bounceMs: 200, fadeMs: 200,
  },
};

/** 规范化序列化（键排序递归）——深比与状态哈希共用 */
export function canonicalize(v         )         {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return "[" + v.map(canonicalize).join(",") + "]";
  const o = v                           ;
  return "{" + Object.keys(o).sort().map((k) => JSON.stringify(k) + ":" + canonicalize(o[k])).join(",") + "}";
}

/** 镜像断言：MIRRORED ≡ configFromSpec(spec)（契约每件 check 入口先打，防两头漂移） */
export function assertConfigMirror(cfg            )       {
  const a = canonicalize(cfg);
  const b = canonicalize(MIRRORED);
  if (a !== b) {
    throw new Error(`CONFIG-MIRROR-DRIFT: 镜像常量与 approved spec 导出件不等\n spec=${a}\n code=${b}\n（数值改动必须先走 spec revision，再同步镜像）`);
  }
}
