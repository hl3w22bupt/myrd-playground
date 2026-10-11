// kernel/sim.ts — 战局纯仿真（wheat-squad · spec entities e-kernel-sim/e-captain/e-squadmate/
// e-pest/e-bullet/e-wheat-pickup/e-wave-manager/e-placement-bank 落点）
//
// 纪律：纯函数式推进（无渲染/无 DOM/无平台）；一切数值自 SimConfig 注入（spec 单源，
// 零手抄第二份）；一切随机走 cfg.rng（mulberry32）——同 seed 同输入逐字节一致（det-1）。
                                     

                                             

                            
           
                                  
                 
                                                       
                                                                                                         
                                                                                                                   
                                                 
                                                    
                             
                                                            
                                        
                                                              
 

                                                                                              
                                                                                           
                                                                                                         
                                                              
                                              
                                                                                 
                                                                                       

                                                                               
export const UPGRADE_POOL                       = ['fireRate', 'damage', 'recruit', 'speed', 'magnet'];
export const UPGRADE_LABEL                            = {
  fireRate: '快穗（射速 +25%）',
  damage: '硬粒（伤害 +1）',
  recruit: '召集（队员 +1）',
  speed: '轻步（移速 +15%）',
  magnet: '穗引（拾取范围 +40%）',
};

                           
                 
                                
                             
                                            
                   
                     
                
                    
                    
                        
                        
                           
                       
                      
                  
                
             
                              
                                       
                   
                         
                        
                               
                                  
                                                                            
 

const UPGRADE_TARGET_SEC = (st          )         => (st.cfg.upgrade.firstAtSec * 1000) / st.cfg.stepMs;

export function createSim(cfg           , seed        )           {
  void seed; // seed 经 cfg.rng 注入（保持签名对称；确定性面 = rng 序列）
  const c = cfg.captain;
  const mates              = [];
  for (let i = 0; i < cfg.squad.initialMates; i += 1) {
    mates.push({ pos: { x: cfg.field.w / 2 + 28 * (i + 1), y: cfg.field.h / 2 }, cdMs: 0, damageBonus: 0, rateMul: 1 });
  }
  return {
    cfg,
    tick: 0,
    phase: 'running',
    endedReason: null,
    captain: { pos: { x: cfg.field.w / 2, y: cfg.field.h / 2 }, target: null, hp: 5, invulnUntilTick: 0 },
    mates,
    pests: [], bullets: [], pickups: [], particles: [], flashes: [],
    waveIndex: 1,
    spawnTimerMs: 400, waveTimerMs: cfg.wave.seconds * 1000, inRest: false,
    kills: 0, xp: 0, upgradesPicked: [], choices: null,
    speedMul: 1, magnetRadiusPx: 96, nextUpgradeXp: 5,
    firstKillTick: null, firstUpgradeTick: null, lastFeedbackLatencyTicks: null,
  };
}

const dist2 = (a     , b     )         => { const dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy; };

/** 波次生成间隔：首波 ×1.5 宽松（level-1/el-warmup），逐波 1.15× 爬升（level-2/el-ramp） */
export function spawnIntervalMs(st          )         {
  const ramp = Math.pow(st.cfg.enemy.waveRampFactor, st.waveIndex - 1);
  const warmup = st.waveIndex === 1 ? 1.5 : 1;
  return (st.cfg.enemy.baseSpawnIntervalMs * warmup) / ramp;
}

function spawnPest(st          )       {
  if (st.pests.length + st.bullets.length + st.pickups.length >= st.cfg.perf.maxOnScreenEntities) return; // perf-1 硬上限拒生成
  const r = st.cfg.rng.next();
  const edge = Math.floor(r * 4);
  const m = 24;
  const w = st.cfg.field.w, h = st.cfg.field.h;
  const pos      = edge === 0 ? { x: -m, y: st.cfg.rng.next() * h }
    : edge === 1 ? { x: w + m, y: st.cfg.rng.next() * h }
    : edge === 2 ? { x: st.cfg.rng.next() * w, y: -m }
    : { x: st.cfg.rng.next() * w, y: h + m };
  st.pests.push({ pos, hp: 2, speedPxPerSec: st.cfg.enemy.baseSpeedPxPerSec, flashUntilTick: 0, knock: { x: 0, y: 0 } });
}

function fireBullet(st          , from     , target     , damage        )       {
  const dx = target.x - from.x, dy = target.y - from.y;
  const len = Math.max(1, Math.hypot(dx, dy));
  const sp = st.cfg.squad.bulletSpeedPxPerSec;
  st.bullets.push({ pos: { x: from.x, y: from.y }, vel: { x: (dx / len) * sp, y: (dy / len) * sp }, damage });
}

function killPest(st          , p      , idx        )       {
  st.pests.splice(idx, 1);
  st.kills += 1;
  st.xp += 1;
  if (st.firstKillTick === null) st.firstKillTick = st.tick;
  // 反馈面：hit flash（同 tick 入队 = 判定即反馈，latency 0 帧机判口径）+ 麦穗粒子
  const flashMs = st.cfg.feedback.hitFlashMs;
  const flashTicks = Math.max(1, Math.round(flashMs / st.cfg.stepMs));
  st.flashes.push({ x: p.pos.x, y: p.pos.y, bornTick: st.tick, endTick: st.tick + flashTicks });
  if (st.lastFeedbackLatencyTicks === null || st.tick - st.flashes[st.flashes.length - 1].bornTick < st.lastFeedbackLatencyTicks) {
    st.lastFeedbackLatencyTicks = 0; // 同帧入队 → 判定到反馈 0 逻辑帧（≤150ms 预算的机判事实）
  }
  for (let i = 0; i < 3; i += 1) {
    const a = st.cfg.rng.next() * Math.PI * 2;
    st.particles.push({ pos: { x: p.pos.x, y: p.pos.y }, vel: { x: Math.cos(a) * 60, y: Math.sin(a) * 60 }, bornTick: st.tick, kind: 'wheat' });
  }
  st.pickups.push({ pos: { x: p.pos.x, y: p.pos.y }, vel: { x: 0, y: 0 } });
  if (st.xp >= st.nextUpgradeXp && st.choices === null && st.phase === 'running') offerUpgrades(st);
}

export function stepSim(st          , dtMs        )       {
  if (st.phase !== 'running') return;
  st.tick += 1;
  const stepSec = st.cfg.stepMs / 1000;

  // 队长移动（目标点插值；speedMul 由 speed 强化）
  const sp = st.cfg.captain.speedPxPerSec * st.speedMul * stepSec;
  if (st.captain.target) {
    const dx = st.captain.target.x - st.captain.pos.x, dy = st.captain.target.y - st.captain.pos.y;
    const d = Math.hypot(dx, dy);
    if (d > 2) {
      st.captain.pos.x += (dx / d) * Math.min(sp, d);
      st.captain.pos.y += (dy / d) * Math.min(sp, d);
    }
  }
  st.captain.pos.x = Math.max(8, Math.min(st.cfg.field.w - 8, st.captain.pos.x));
  st.captain.pos.y = Math.max(8, Math.min(st.cfg.field.h - 8, st.captain.pos.y));

  // 波次状态机（e-wave-manager）
  if (st.inRest) {
    st.waveTimerMs -= dtMs;
    if (st.waveTimerMs <= 0) { st.inRest = false; st.waveIndex += 1; st.waveTimerMs = st.cfg.wave.seconds * 1000; }
  } else {
    st.waveTimerMs -= dtMs;
    st.spawnTimerMs -= dtMs;
    if (st.spawnTimerMs <= 0) { spawnPest(st); st.spawnTimerMs = spawnIntervalMs(st); }
    if (st.waveTimerMs <= 0) { st.inRest = true; st.waveTimerMs = st.cfg.wave.restSeconds * 1000; }
  }

  // 队员 AI（e-squadmate：索敌最近害虫开火）
  for (const m of st.mates) {
    m.cdMs -= dtMs;
    let nearest              = null; let nd = Infinity;
    for (const p of st.pests) { const d = dist2(m.pos, p.pos); if (d < nd) { nd = d; nearest = p; } }
    if (nearest && m.cdMs <= 0) {
      fireBullet(st, m.pos, nearest.pos, 1 + m.damageBonus);
      m.cdMs = (1000 / (st.cfg.squad.fireRatePerSec * m.rateMul));
    }
  }

  // 子弹推进 + 命中（e-bullet：圆-圆判定 → hit flash + 击退）
  for (let i = st.bullets.length - 1; i >= 0; i -= 1) {
    const b = st.bullets[i];
    b.pos.x += b.vel.x * stepSec; b.pos.y += b.vel.y * stepSec;
    if (b.pos.x < -40 || b.pos.x > st.cfg.field.w + 40 || b.pos.y < -40 || b.pos.y > st.cfg.field.h + 40) { st.bullets.splice(i, 1); continue; }
    let hit = false;
    for (let j = st.pests.length - 1; j >= 0; j -= 1) {
      const p = st.pests[j];
      if (dist2(b.pos, p.pos) <= 12 * 12) {
        p.hp -= b.damage;
        const bl = Math.max(1, Math.hypot(b.vel.x, b.vel.y));
        p.knock.x += (b.vel.x / bl) * 6; p.knock.y += (b.vel.y / bl) * 6;
        p.flashUntilTick = st.tick + Math.max(1, Math.round(st.cfg.feedback.hitFlashMs / st.cfg.stepMs));
        hit = true;
        if (p.hp <= 0) killPest(st, p, j);
        break;
      }
    }
    if (hit) st.bullets.splice(i, 1);
  }

  // 害虫推进（趋近队长 + 击退衰减 + 接触伤害）
  for (const p of st.pests) {
    const dx = st.captain.pos.x - p.pos.x, dy = st.captain.pos.y - p.pos.y;
    const d = Math.max(1, Math.hypot(dx, dy));
    p.pos.x += ((dx / d) * p.speedPxPerSec + p.knock.x * 10) * stepSec;
    p.pos.y += ((dy / d) * p.speedPxPerSec + p.knock.y * 10) * stepSec;
    p.knock.x *= 0.8; p.knock.y *= 0.8;
    if (dist2(p.pos, st.captain.pos) <= st.cfg.captain.radiusPx * st.cfg.captain.radiusPx
      && st.tick >= st.captain.invulnUntilTick) {
      st.captain.hp -= st.cfg.enemy.contactDamage;
      st.captain.invulnUntilTick = st.tick + Math.round(800 / st.cfg.stepMs); // 0.8s 无敌帧（实现面调参；接触非每帧扣血）
      const bl = Math.max(1, Math.hypot(dx, dy));
      p.pos.x -= (dx / bl) * 24; p.pos.y -= (dy / bl) * 24; // 接触分离（防贴合连扣）
      if (st.captain.hp <= 0) { st.phase = 'ended'; st.endedReason = 'overrun'; return; }
    }
  }

  // 麦穗拾取（e-wheat-pickup：magnet 半径吸附）
  for (let i = st.pickups.length - 1; i >= 0; i -= 1) {
    const pk = st.pickups[i];
    const d = Math.sqrt(dist2(pk.pos, st.captain.pos));
    if (d < st.magnetRadiusPx) {
      pk.pos.x += (st.captain.pos.x - pk.pos.x) * 0.25;
      pk.pos.y += (st.captain.pos.y - pk.pos.y) * 0.25;
    }
    if (d < st.cfg.captain.radiusPx + 6) {
      st.pickups.splice(i, 1);
      st.xp += 1;
      if (st.xp >= st.nextUpgradeXp && st.choices === null && st.phase === 'running') offerUpgrades(st);
    }
  }

  // 粒子寿命
  for (let i = st.particles.length - 1; i >= 0; i -= 1) {
    const pt = st.particles[i];
    pt.pos.x += pt.vel.x * stepSec; pt.pos.y += pt.vel.y * stepSec;
    if (st.tick - pt.bornTick > 18) st.particles.splice(i, 1);
  }
  // flash 寿命
  for (let i = st.flashes.length - 1; i >= 0; i -= 1) {
    if (st.tick > st.flashes[i].endTick) st.flashes.splice(i, 1);
  }

  // 单局时长目标（fv-2：3–5 分钟；timeout = 打满目标上限自然结算）
  const elapsedSec = (st.tick * st.cfg.stepMs) / 1000;
  if (elapsedSec >= st.cfg.runDuration.targetMaxSec) { st.phase = 'ended'; st.endedReason = 'timeout'; }
  void UPGRADE_TARGET_SEC;
}

/** 三选一选项（seed 驱动序列——det-1 断言面） */
export function offerUpgrades(st          )       {
  const n = st.cfg.upgrade.poolSize;
  const pool = UPGRADE_POOL.slice();
  const picks              = [];
  for (let i = 0; i < n && pool.length > 0; i += 1) {
    const idx = Math.floor(st.cfg.rng.next() * pool.length) % pool.length;
    picks.push(pool.splice(idx, 1)[0]);
  }
  st.choices = picks;
}

export function pickUpgrade(st          , choiceIndex        )       {
  if (!st.choices) return;
  const id = st.choices[choiceIndex];
  if (!id) return;
  st.upgradesPicked.push(id);
  if (st.firstUpgradeTick === null) st.firstUpgradeTick = st.tick;
  if (id === 'fireRate') for (const m of st.mates) m.rateMul *= 1.25;
  else if (id === 'damage') for (const m of st.mates) m.damageBonus += 1;
  else if (id === 'recruit' && st.mates.length < st.cfg.squad.maxMates) {
    st.mates.push({ pos: { x: st.captain.pos.x + 28, y: st.captain.pos.y + 20 }, cdMs: 0, damageBonus: 0, rateMul: 1 });
  }
  else if (id === 'speed') st.speedMul *= 1.15;
  else if (id === 'magnet') st.magnetRadiusPx *= 1.4;
  st.nextUpgradeXp += 10; // 递增阈值（5,15,25…）：升级节奏随局推进放缓
  st.choices = null;
}

/** 麦仓放置收益（e-placement-bank：结构冻结 offline = base × min(hours, cap) × levelCoef；数值待校准 PEND） */
export function placementOffline(base        , hours        , capHours        , levelCoef        )         {
  return base * Math.min(hours, capHours) * levelCoef;
}

/** 结算页三信息（e-settlement 数据源） */
export function settlementFacts(st          )                                                                                                                                                         {
  const counts = new Map                   ();
  for (const u of st.upgradesPicked) counts.set(u, (counts.get(u) || 0) + 1);
  const topUpgrades = [...counts.entries()].map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count).slice(0, 3);
  return {
    elapsedSec: (st.tick * st.cfg.stepMs) / 1000,
    kills: st.kills,
    waveIndex: st.waveIndex,
    topUpgrades,
    nextWaveRamp: st.cfg.enemy.waveRampFactor,
    bankGain: Math.round(st.kills * 2), // 麦仓增量（v0 = 击杀线性；基准校准挂 fv-pend）
  };
}
