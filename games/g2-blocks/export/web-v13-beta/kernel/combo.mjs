// combo.ts — 连击计数器（e-combo · ac-06 四手向量裁决口径）
//
// spec 口径（numeric.combo 冻结块）：
//   appliesFromChain（第 2 手起加成）/ chainBonus（每手加成值）/ resetOnNonClear = true
//   四手向量：消/消/不消/消 → +0/+chainBonus/归0/+0
//   第 1 手消除 +0；连续第 2 手消除 +chainBonus；连续第 k 手（k≥2）+(k-1)×chainBonus（一路往上叠）
import { numeric } from '../generated/spec-data.mjs';

                             
                
 

                        
                    
                      
                          
                    
                           
                
 

export function createCombo()        {
  const state             = { chain: 0 };
  const bonusFor = (chain        )         => {
    const { appliesFromChain, chainBonus } = numeric().combo;
    if (chain < appliesFromChain) return 0;
    return (chain - appliesFromChain + 1) * chainBonus;
  };
  return {
    state,
    registerClear()         {
      state.chain += 1;
      return bonusFor(state.chain);
    },
    registerNonClear()       {
      const { resetOnNonClear } = numeric().combo;
      if (resetOnNonClear) state.chain = 0;
    },
    reset()       {
      state.chain = 0;
    },
  };
}


//# sourceURL=kernel/combo.ts