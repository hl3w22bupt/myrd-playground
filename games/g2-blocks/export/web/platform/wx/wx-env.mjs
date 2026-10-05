// wx-env.ts — 微信小游戏容器判定与最小宿主面（WX 提审轮 N2-P2 · 纯平台件）
//
// 纪律：
//   ① 本件零内核 import（玩法/数值/视觉零接触）；零随机数/系统时钟直调字面（内核纯净同口径扫描，含注释）。
//   ② wx 宿主一律注入（createWxRuntime/createWxShare 均 DI），Node 侧测试用 fake 宿主，不依赖真实容器。
//   ③ 类型面取最小必要（wx 官方 d.ts 不随仓库分发，避免引入外部依赖）。

/** 微信小游戏最小宿主面（本工程实际触达的 API 子集；多余能力不声明不使用） */
                         
                                                                                                                             
                                                   
                                      
                                       
                               
                               
                                                                                    
                                                                                          
                                                            
                                    
                                                                                                
                                                                                               
                                                                                              
                                                            
                                      
                                                                                           
 

/** 容器判定：wx 全局存在且具备小游戏宿主特征（createCanvas 可用）→ true */
export function isWxRuntime()          {
  const g = globalThis                                       ;
  return typeof g.wx === 'object' && g.wx !== null && typeof g.wx.createCanvas === 'function';
}

/** 取当前宿主（不注入时的生产取用口）；无容器返回 null（调用方走降级，绝不抛错） */
export function getWx()                {
  if (!isWxRuntime()) return null;
  return (globalThis                             ).wx;
}


//# sourceURL=platform/wx/wx-env.ts