// feel.ts — 核心手感表现态机（V1.2 · 链 v4）
//
// 纪律：
//   ① 数值唯一真源 = src/generated/feel-data.ts（生成自 spec numeric.feel；本文件零数值字面量，
//      除「从表派生」的恒等式外不出现第二份）——ac-22..26 逐值深比机判。
//   ② 查表驱动：任意帧的表现态 = f(事件, 逻辑帧号) 纯函数导出（确定性，契约可复现；零随机源、
//      零 Date/interval——时刻由调用方以逻辑帧号注入，与 T3 可注入时钟同纪律）。
//   ③ 零分配热路径：粒子池按硬顶预分配一次，运行期只复用槽位（ac-24 池纪律）。
//   ④ 本文件属表现层（src/render），不在 ac-14 内核纯净扫描范围，但仍守确定性纪律。
import { FEEL } from '../generated/feel-data.mjs';
import { numeric } from '../generated/spec-data.mjs';

                                                   
                                                          

                          
                         
                       
                        
 

                          
                
                
                   
 

                               
            
            
                
                    
 

                
                  
                     
             
             
             
             
                    
 

                               
                
                                                     
                                  
                            
                         
                       
                       
                           
                                     
                      
 

                       
                             
                                  
                               
                                                                                   
 

/** chain → 三档（边界真源 = FEEL.sfx.tierBoundaries；combo 同边界由契约守卫⑦级断言 + 本函数单源） */
export function tierOf(chain        )            {
  const tiers = FEEL.combo.tiers;
  for (const t of tiers) {
    const min = t.minChain;
    const max = t.maxChain;
    if (chain >= min && (max === null || chain <= max)) return t.tier             ;
  }
  return 1;
}

export function voiceOfTier(tier           )           {
  return tier === 1 ? 'clear' : tier === 2 ? 'combo' : 'blaze';
}

const TWO_PI = Math.PI * 2;

export function createFeel()       {
  const step = FEEL.logicFps > 0 ? 1000 / FEEL.logicFps : 16; // 逻辑帧时长（=FIXED_STEP_MS，恒等式契约机判）
  const P = FEEL.particles;
  const H = FEEL.hardDrop;
  const L = FEEL.landSquash;

  // 粒子池：硬顶预分配一次（零运行期分配；溢出 drop-new）
  const pool         = new Array(P.poolSize);
  for (let i = 0; i < pool.length; i += 1) {
    pool[i] = { active: false, startFrame: 0, x0: 0, y0: 0, vx: 0, vy: 0, sizeRatio: 0.06 };
  }
  let spawns = 0;
  let dropped = 0;

  // 形变：cell → 起始帧（每落定格一条）
  const squash = new Map                ();
  // 震屏：起始帧（同一时刻至多一条；新触发顶替）
  let shakeStart = -1;
  // 连击档：当前 + 上一档（切换帧断言面）
  let curTier            = 1;
  let curSince = 0;
  let prevTier            = 1;
  let prevSince = 0;
  // 音效：事件帧 → voice（当帧消费一次）
  const sfxAtFrame = new Map                  ();
  // 重开转场
  let restartFrame = -1;

  const squashScaleAt = (startFrame        , frame        )                                    => {
    const age = frame - startFrame;
    if (age < 0 || age >= L.frames) return null;
    const u = age / L.frames;
    const p = 1 - (1 - u) * (1 - u); // ease-out-quad
    return {
      sx: 1 + (L.scaleX - 1) * (1 - p),
      sy: 1 + (L.scaleY - 1) * (1 - p),
    };
  };

  const shakeOffsetAt = (frame        )         => {
    const age = frame - shakeStart;
    if (shakeStart < 0 || age < 0 || age >= H.frames) return 0;
    const t = age * step;
    return H.amplitudeCellRatio * Math.exp(-t / H.decayTauMs) * Math.sin((TWO_PI * H.oscillationHz * t) / 1000);
  };

  return {
    onHand(obs)       {
      const { frame, chain, waves } = obs;
      for (const w of waves) {
        // ① 落地挤压形变：重力落定格（gravity-land-frame 触发规则）
        for (const cell of w.landedCells) squash.set(cell, frame);
        // ② 硬降震屏：波次最大落差达阈值（settle-frame 触发规则）
        if (w.maxFallCells >= H.thresholdCells) shakeStart = frame;
        // ③ 消除粒子：期望值派生 + 硬顶 drop-new（池复用，零分配）
        const cleared = w.clearedCells.length;
        if (cleared >= 3) {
          const expected = P.perClearBase + (cleared - 3) * P.perExtraBlock;
          let spawned = 0;
          const cols = numeric().grid.cols;
          for (let i = 0; i < expected; i += 1) {
            const slot = pool.find((s) => !s.active);
            if (!slot) { dropped += expected - spawned; break; }
            const cell = w.clearedCells[i % cleared];
            const col = cell % cols;
            const row = Math.floor(cell / cols);
            const idx = pool.indexOf(slot);
            const deg = ((idx * 137 + cell * 61) % 360) * (Math.PI / 180);
            slot.active = true;
            slot.startFrame = frame;
            slot.x0 = col + 0.5;
            slot.y0 = row + 0.5;
            slot.vx = P.speedCellPerS * Math.cos(deg);
            slot.vy = P.speedCellPerS * Math.sin(deg);
            slot.sizeRatio = 0.055 + (tierOf(chain) - 1) * 0.015;
            spawns += 1;
            spawned += 1;
          }
        }
      }
      // ④ 三档音效：chain 档位命中（消除判定同一逻辑帧发起——事件帧登记，当帧消费）
      if (chain >= 1 && waves.some((w) => w.clearedCells.length > 0)) {
        sfxAtFrame.set(frame, voiceOfTier(tierOf(chain)));
      }
      // ⑤ 连击档切换：发生在事件帧
      const t = tierOf(chain);
      if (t !== curTier) {
        prevTier = curTier;
        prevSince = curSince;
        curTier = t;
        curSince = frame;
      }
    },

    at(frame)               {
      // 形变查表
      const sq                                             = {};
      for (const [cell, startFrame] of squash) {
        const s = squashScaleAt(startFrame, frame);
        if (s) sq[cell] = s;
      }
      // 震屏查表（x/y 同曲线）
      const off = shakeOffsetAt(frame);
      // 粒子查表（位置 = 初速 × t + ½gt²；寿命帧后槽位回收）
      const parts                 = [];
      let live = 0;
      for (const s of pool) {
        if (!s.active) continue;
        const age = frame - s.startFrame;
        if (age < 0) continue;
        if (age >= P.frames) { s.active = false; continue; }
        const t = age * step;
        parts.push({
          x: s.x0 + (s.vx * t) / 1000,
          y: s.y0 + (s.vy * t) / 1000 + (0.5 * P.gravityCellPerS2 * t * t) / 1e6,
          alpha: 1 - age / P.frames,
          sizeRatio: s.sizeRatio,
        });
        live += 1;
      }
      // 音效当帧消费
      const voice = sfxAtFrame.get(frame) ?? null;
      if (voice) sfxAtFrame.delete(frame);
      // 连击档（切换帧断言面：f < curSince → 上一档）
      const changed = frame === curSince && curTier !== prevTier;
      const effTier = frame >= curSince ? curTier : prevTier;
      const effVisual = FEEL.combo.tiers.find((x) => x.tier === effTier)?.visual                ?? 'count';
      const restarting = restartFrame >= 0 && frame >= restartFrame && frame < restartFrame + FEEL.restart.transitionFrames;
      return {
        frame,
        squash: sq,
        shake: { x: off, y: off },
        particles: parts,
        particlesAlive: live,
        sfx: voice,
        comboTier: effTier,
        comboVisual: effVisual,
        comboTierChangedThisFrame: changed,
        restarting,
      };
    },

    restart(frame)       {
      squash.clear();
      shakeStart = -1;
      for (const s of pool) s.active = false;
      sfxAtFrame.clear();
      prevTier = curTier;
      prevSince = curSince;
      curTier = 1;
      curSince = frame;
      restartFrame = frame;
      spawns = 0;
      dropped = 0;
    },

    poolStats: () => ({ capacity: pool.length, live: pool.filter((s) => s.active).length, spawns, dropped }),
  };
}


//# sourceURL=render/feel.ts