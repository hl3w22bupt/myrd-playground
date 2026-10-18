// economy.ts — e-economy：击杀掉落军费 → 布防/升级支出闭环（numeric.economy 初始锚定值）
// spec: entities/e-economy · numeric.economy{startGold=120 · killRewardBase=8 ·
//       killRewardGrowthPerWave=1.02} · numeric.enemy.bountyBase=8（=wave1 单敌赏金，镜像断言对齐）

                                                      

export const START_GOLD = 120;    // 镜像 spec.numeric.economy.startGold
export const KILL_REWARD_BASE = 8; // 镜像 spec.numeric.economy.killRewardBase（≡ enemy.bountyBase）

/** 击杀赏金：round(killRewardBase × killRewardGrowthPerWave^(w-1))；bountyBase=wave1 基准（等值锚） */
export function killReward(cfg            , wave        )         {
  return Math.round(cfg.economy.killRewardBase * Math.pow(cfg.economy.killRewardGrowthPerWave, wave - 1));
}

/** 布防价 / 升级价（turret 公式转口；支出闭环唯一入口） */
export function placeCost(cfg            )         { return cfg.turret.costPlace; }
export function upCost(cfg            , level        )         {
  return Math.round(cfg.turret.costUpgradeBase * Math.pow(cfg.turret.costUpgradeGrowth, level - 1));
}

/** 支出：足额才扣（fail-closed：不足即 false，调用方不得落位） */
export function trySpend(gold        , cost        )                                {
  if (gold < cost) return { ok: false, gold };
  return { ok: true, gold: gold - cost };
}
