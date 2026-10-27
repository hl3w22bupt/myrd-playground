// storage.ts — 存储门面 + 版本化迁移（A 轮 N3-T1 · 零外部依赖 · 零网络调用）
//
// 用途：给 v1.2（daily 连续打卡等）预留有版本的存储通道，迁移可测试、可追溯。
// 纪律（ac-16 不降）：
//   ① 本门面**默认不新增任何落盘键**——v1 的键级最小集 muted/anonId 原样保留，键由归属模块注册；
//   ② 迁移流水线显式有序（toVersion 严格 +1，禁止跳版/回退），每次迁移可命名可断言；
//   ③ 本文件零网络调用构造（ac-16 同款扫描口径，本注释不含被扫描字面量）。
// 版本来源：`fromVersion` 显式注入（缺省 = 已在最新版）。版本不偷偷写第三个键——
// 若 v1.2 需要持久化版本号，由实现轮（N8 三闸齐后）注册键承载，门面不越权。
// v1.2 daily 的键在 spec 数值冻结 + approve 之后由实现轮注册——门面先行不越权。

                              
                                      
                                            
                                 
 

/** 迁移期可见的存储视图（比 StorageLike 多 remove/keys，便于清理与审计） */
                              
                                  
                                        
                            
                   
 

                            
                                
                    
                              
                   
                                 
 

                                
                  
                    
                                                   
                                            
                     
                             
                                                    
                                                                      
                                  
                                        
                            
                                     
                     
 

function viewOf(storage             )              {
  return {
    get: (k) => storage.getItem(k),
    set: (k, v) => storage.setItem(k, v),
    remove: (k) => {
      if (typeof storage.removeItem === 'function') storage.removeItem(k);
      else storage.setItem(k, '');
    },
    keys: () => [],
  };
}

/** 从底层存储枚举键：优先 removeItem 存在的原生实现，否则退化为注册键集合（内存 stub 场景） */
function keysOf(storage             , known          )           {
  if (typeof storage.removeItem === 'function') {
    const anyStorage = storage                                                                 ;
    if (typeof anyStorage.length === 'number' && typeof anyStorage.key === 'function') {
      const out           = [];
      for (let i = 0; i < anyStorage.length; i += 1) {
        const k = anyStorage.key(i);
        if (k !== null) out.push(k);
      }
      return out;
    }
  }
  return known.slice();
}

                                
                       
                                      
                  
                              
                           
                                          
                       
 

export function createStorageFacade(opts               )                {
  const storage = opts.storage;
  const migrations = (opts.migrations ?? []).slice().sort((a, b) => a.toVersion - b.toVersion);
  const registered = new Set        (opts.keys ?? []);
  const view = viewOf(storage);

  for (let i = 0; i < migrations.length; i += 1) {
    if (migrations[i].toVersion !== i + 1) {
      throw new TypeError(`迁移流水线必须 toVersion 严格 +1（第 ${i} 项 = ${migrations[i].toVersion}）`);
    }
  }
  const from = opts.fromVersion ?? migrations.length;
  if (!Number.isInteger(from) || from < 0 || from > migrations.length) {
    throw new RangeError(`fromVersion 越轨 [0,${migrations.length}]: ${from}`);
  }
  let currentVersion = from;

  return {
    version: ()         => currentVersion,

    registeredKeys: ()           => [...registered].sort(),

    registerKey: (key, registryOpts)       => {
      if (!/^[a-zA-Z0-9:_-]{1,64}$/.test(key)) throw new TypeError(`存档键命名越轨: ${key}`);
      registered.add(key);
      for (const alias of registryOpts?.legacyAliases ?? []) registered.add(alias);
    },

    get: (key) => {
      if (!registered.has(key)) throw new Error(`未注册键读取被拒（先 registerKey）: ${key}`);
      return storage.getItem(key);
    },

    set: (key, value) => {
      if (!registered.has(key)) throw new Error(`未注册键写入被拒（先 registerKey）: ${key}`);
      storage.setItem(key, value);
    },

    remove: (key) => {
      if (!registered.has(key)) throw new Error(`未注册键删除被拒（先 registerKey）: ${key}`);
      view.remove(key);
    },

    raw: ()              => ({
      ...view,
      keys: ()           => keysOf(storage, [...registered]),
    }),

    migrate: (targetVersion)           => {
      const target = targetVersion ?? migrations.length;
      if (!Number.isInteger(target) || target < 0 || target > migrations.length) {
        throw new RangeError(`目标版本越轨 [0,${migrations.length}]: ${target}`);
      }
      const applied           = [];
      while (currentVersion < target) {
        const m = migrations[currentVersion];
        m.apply({ ...view, keys: ()           => keysOf(storage, [...registered]) });
        currentVersion = m.toVersion;
        applied.push(`v${m.toVersion} ${m.describe}`);
      }
      return applied;
    },
  };
}

/**
 * v1 迁移：muted 取值归一（不改键集、不加键、**不删任何键**）。
 * 非破坏纪律：迁移只做取值规范化，不做键清理——清理会误删后续版本新增的用户数据，风险大于收益。
 */
export const MIGRATION_V1_LEGACY_NORMALIZE            = {
  toVersion: 1,
  describe: 'muted 取值归一（true/on → 1；false/off → 0）；键集零改动',
  apply(view)       {
    const muted = view.get('muted');
    if (muted === 'true' || muted === 'on' || muted === '1') view.set('muted', '1');
    else if (muted === 'false' || muted === 'off' || muted === '0') view.set('muted', '0');
  },
};


//# sourceURL=platform/storage.ts