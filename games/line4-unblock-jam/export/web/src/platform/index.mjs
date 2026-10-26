// platform/index.ts — 平台门面（line4-unblock-jam · 模板平移）
//
// 纪律：内核零平台感知——kernel/ 只 import 本文件的 Platform 接口，禁直呼 wx/dy/window；
// 宿主差异收拢在 <host>.ts；能力缺失 = 显式降级（返回 kind 标识），禁静默假装成功。
                          
                                
                                  
                                        
 

                           
                        
                   
                                                         
                                                                 
 

export const NOOP_STORAGE          = {
  kind: 'noop',
  get: () => null,
  set: () => {},
};

export function createNoopPlatform()           {
  const buffered                                                               = [];
  return {
    name: 'noop',
    storage: NOOP_STORAGE,
    track: (eventId, payload) => { buffered.push({ eventId, payload }); },
  };
}
