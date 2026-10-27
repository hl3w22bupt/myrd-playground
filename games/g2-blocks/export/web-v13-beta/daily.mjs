// daily.ts — daily-challenge 最小闭环（V1.2 · 链 v4 · 钩子面）
//
// 纪律：
//   ① 数值唯一真源 = src/generated/feel-data.ts 的 DAILY（生成自 spec numeric.daily；本文件零数值
//      字面量第二份——除「实现参数 salt=0」外，salt 属实现参数非冻结值，见 ac-28）。
//   ② 「当下」一律经注入 Clock（T3 同纪律）；种子派生 = datetime 纯函数（同输入恒输出）。
//   ③ 存档走 storage 门面版本化通道（键名 = DAILY.storageKey；v1 键级 muted/anonId 不受影响）。
//   ④ 零网络调用构造（ac-16 同款扫描口径）；范围外（上报/云同步/奖励/排行榜）零实体。
import { DAILY } from './generated/feel-data.mjs';
import { dailySeed, localDateCode } from './kernel/datetime.mjs';
                                                 
                                                           

const SALT = 0; // 实现参数（非 spec 冻结值）：dailySeed(dateCode, salt) 的第二输入

                              
            
                                          
                 
 

                             
                    
               
                
                 
 

                                  
                   
                
                 
 

                        
                      
                 
                      
                                
                         
 

function emptyRecord()              {
  return { v: 2, lastDone: 0, streak: 0 };
}

function parseRecord(raw               )              {
  if (!raw) return emptyRecord();
  try {
    const r = JSON.parse(raw)                        ;
    if (typeof r.lastDone !== 'number' || typeof r.streak !== 'number') return emptyRecord();
    return { v: 2, lastDone: r.lastDone, streak: r.streak };
  } catch {
    return emptyRecord();
  }
}

export function createDaily(opts                                         )        {
  const { clock, facade } = opts;
  const key = DAILY.storageKey;
  facade.registerKey(key);

  const read = ()              => parseRecord(facade.get(key));
  const write = (r             )       => {
    facade.set(key, JSON.stringify(r));
  };

  const today = ()         => localDateCode(clock.nowMs(), clock.tzOffsetMinutes());

  return {
    todayCode: ()         => today(),

    seed: ()         => dailySeed(today(), SALT),

    state()             {
      const code = today();
      const rec = read();
      // streak 展示口径：跨 streakTrack 窗口未打卡 → 展示归零（窗口口径，ac-28 机判面）
      const windowExpired = rec.lastDone > 0 && code - rec.lastDone > DAILY.streakTrack;
      return {
        todayCode: code,
        seed: dailySeed(code, SALT),
        done: rec.lastDone === code,
        streak: windowExpired ? 0 : rec.streak,
      };
    },

    entryState()                  {
      const s = this.state();
      return { visible: DAILY.entryHook === 'hud-entry+badge', done: s.done, streak: s.streak };
    },

    markDone()             {
      const code = today();
      const rec = read();
      if (rec.lastDone !== code) {
        // 跨日首打卡：昨日连续 → +1；断档 → 重计 1（断档口径）
        rec.streak = code - rec.lastDone === 1 ? rec.streak + 1 : 1;
        rec.lastDone = code;
        write(rec);
      }
      return this.state();
    },
  };
}


//# sourceURL=daily.ts