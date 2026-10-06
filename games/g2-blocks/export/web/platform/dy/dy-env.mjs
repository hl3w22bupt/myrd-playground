// dy-env.ts — 抖音小游戏容器判定与最小宿主面（DY 平台段轮 N2 · 纯平台件）
//
// 纪律（沿 wx-env 判例 + 映射表 dy-diff-02）：
//   ① 本件零内核 import（玩法/数值/视觉零接触）；零随机数/系统时钟直调字面（内核纯净同口径扫描，含注释）。
//   ② tt 宿主一律注入（createDyRuntime/createDyShare 均 DI），Node 侧测试用 fake 宿主，不依赖真实容器。
//   ③ 类型面取最小必要（tt 官方 d.ts 不随仓库分发，避免引入外部依赖）。
//   ④ 本件与 wx 件互不引用（dy-diff-08 fallback：dy 段不复制 wx 运行时面）。

/** 抖音小游戏最小宿主面（本工程实际触达的 API 子集；多余能力不声明不使用） */
                         
                        
                     
                       
                        
                         
                     
                                                      
                                                                              
    
                                                   
                                      
                                       
                               
                               
                                                                                    
                                                                                          
                                                            
                                    
                                                                                                
                                                                                               
                                                                                              
                                                            
 

/** 容器判定：tt 全局存在且具备小游戏宿主特征（createCanvas 可用）→ true */
export function isDyRuntime()          {
  const g = globalThis                                       ;
  return typeof g.tt === 'object' && g.tt !== null && typeof g.tt.createCanvas === 'function';
}

/** 取当前宿主（不注入时的生产取用口）；无容器返回 null（调用方走降级，绝不抛错） */
export function getTt()                {
  if (!isDyRuntime()) return null;
  return (globalThis                             ).tt;
}


//# sourceURL=platform/dy/dy-env.ts