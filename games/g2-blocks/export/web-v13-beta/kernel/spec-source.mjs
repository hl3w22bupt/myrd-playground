// spec-source.ts — spec 导出件装载器（骨架件 · 零冻结值硬编码）
//
// 纪律（N1 修复轮线3 授权范围）：本仓库本轮只产「零冻结值依赖件」——一切冻结数值
// （palette 7 hex / thresholdDeltaE / DEFAULT_SEED / budgetMs / chainBonus …）一律从
// GameDesignSpec 导出件读取，不在代码里出现第二份。冻结值相关的玩法实现等 approve 后再写。
// 取数优先级：G2_SPEC_PATH → 兄弟 run 目录发现 → 显式报错（不猜、不降级到内置值）。
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

                                   
             
                  
                 
                
                               
                      
 

                             
                        
                            
                              
 

const EXPORT_REL = join('.myrd', 'spec', 'g2-blocks', 'design-spec.json');

export function resolveSpecPath()         {
  if (process.env.G2_SPEC_PATH) return resolve(process.env.G2_SPEC_PATH);
  // 发现：g2-blocks 仓库与 run 目录同工作区根，向上找到工作区根后扫描兄弟 run 目录。
  // 防污染：兄弟 run 可能滞留旧版本导出件 → 收集全部候选，取 version 最高（并列取 updatedAt 新）者。
  let dir = dirname(new URL(import.meta.url).pathname);
  const candidates           = [];
  for (let i = 0; i < 6; i += 1) {
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
    for (const n of readdirSync(dir).filter((x) => x.startsWith('run-'))) {
      const c = join(dir, n, EXPORT_REL);
      if (existsSync(c)) candidates.push(c);
    }
  }
  if (candidates.length === 0) {
    throw new Error('未找到 spec 导出件：请设 G2_SPEC_PATH 指向 .myrd/spec/g2-blocks/design-spec.json');
  }
  const ranked = candidates
    .map((p) => {
      try {
        const meta = JSON.parse(readFileSync(p, 'utf8'))?._platform;
        return { p, version: Number(meta?.version ?? 0), updatedAt: String(meta?.updatedAt ?? '') };
      } catch { return { p, version: -1, updatedAt: '' }; }
    })
    .sort((a, b) => (b.version - a.version) || (b.updatedAt.localeCompare(a.updatedAt)));
  if (ranked.length > 1 && process.env.G2_SPEC_STRICT === '1') {
    // 严格模式：多候选直接报错，强制显式指定（CI 用）
    throw new Error(`发现 ${ranked.length} 个 spec 导出件候选（version 最高=${ranked[0].version}）：请显式设置 G2_SPEC_PATH`);
  }
  return ranked[0].p;
}

let cache                    = null;

export function loadSpecExport()             {
  if (cache) return cache;
  const path = resolveSpecPath();
  const raw = JSON.parse(readFileSync(path, 'utf8'))              ;
  if (!raw?.spec?.numeric) throw new Error(`spec 导出件缺 spec.numeric: ${path}`);
  cache = raw;
  return raw;
}

/** 冻结数值块（唯一真源 = 平台 spec 导出件） */
export function numeric()                      {
  return loadSpecExport().spec.numeric;
}

/** 状态声明：draft = 待主人 approve（契约测试以 v1 内容为共同输入， approve 前不写冻结值玩法实现） */
export function specStatus()         {
  return loadSpecExport()._platform.status;
}


//# sourceURL=kernel/spec-source.ts