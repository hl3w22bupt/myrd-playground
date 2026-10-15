// settlement.ts — 结算页数据面（wheat-squad · spec e-settlement 落点）
//
// 三信息口径（fv-3 / ux-fv-restart）：本局三强强化回顾 + 下一波次难度预告 + 麦仓收益增量。
// 纯数据面（零 DOM）——渲染在 game.ts 结算视图消费；真人试玩「再来一局理由」manual 判定的备料面。
import { UPGRADE_LABEL,                } from './kernel/sim.mjs';

                                 
                   
                 
                      
 

export function buildSettlement(facts   
                                                       
                                                       
                                         
 , reason                      )                 {
  const headline = reason === 'timeout' ? `守住了 ${facts.waveIndex} 浪！` : `第 ${facts.waveIndex} 浪被冲散了`;
  const upRows = facts.topUpgrades.length > 0
    ? facts.topUpgrades.map((u, i) => `${i + 1}. ${UPGRADE_LABEL[u.id]} ×${u.count}`)
    : ['（本局未拾取强化——下一局试试升级路线）'];
  return {
    headline,
    rows: [
      `本局：${facts.kills} 击杀 · ${Math.floor(facts.elapsedSec)}s · 第 ${facts.waveIndex} 浪`,
      '三强强化回顾：',
      ...upRows,
      `下一波次难度预告：生成密度 ×${facts.nextWaveRamp.toFixed(2)}/浪`,
      `麦仓收益：+${facts.bankGain} 麦穗（离线也在长）`,
    ],
    restartHint: '点任意处再来一局',
  };
}
