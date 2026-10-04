// persistence.ts — 最小存档（ac-16）：仅 muted + anonId 两键，零 PII、零网络调用
//
// spec 口径（ac-16）：存档仅 muted + anonId 两键级最小集，零 PII 上报；无网络调用。
// 存储后端注入（浏览器 = localStorage；契约测试 = 内存 stub），本文件零远端请求构造。
export const ALLOWED_KEYS                    = ['muted', 'anonId']         ;

                              
                                      
                                            
 

                              
                      
                             
                      
                                        
                                  
 

export function createPersistence(storage             )              {
  const assertKey = (key        )       => {
    if (!ALLOWED_KEYS.includes(key)) throw new Error(`存档键越轨（最小集 = ${ALLOWED_KEYS.join('/')}）: ${key}`);
  };
  const anonId = ()         => {
    const existing = storage.getItem('anonId');
    if (existing) return existing;
    // 匿名本地标识：随机 UUID（本地生成、不出机、零 PII）
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `anon-${Date.now().toString(36)}-${(seedable() % 1e9).toString(36)}`;
    storage.setItem('anonId', id);
    return id;
  };
  const seedable = ()         => Math.floor(Math.random() * 1e9); // 仅 UI 层回退路径；内核不经过本文件
  return {
    getMuted()          {
      return storage.getItem('muted') === '1';
    },
    setMuted(v         )       {
      storage.setItem('muted', v ? '1' : '0');
    },
    getAnonId()         {
      return anonId();
    },
    set(key        , value        )       {
      assertKey(key);
      storage.setItem(key, value);
    },
    get(key        )                {
      assertKey(key);
      return storage.getItem(key);
    },
  };
}


//# sourceURL=persistence.ts