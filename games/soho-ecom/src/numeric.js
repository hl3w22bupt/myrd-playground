// numeric.js — 数值唯一来源：《白手起家·跨境电商版》M0 数值框架 v1 的代码镜像（spec 单一事实源同步）。
// 禁止在其它文件写玩法魔数；调参 = 改这里（或改 spec 后同步此处），preflight P2 会查。
// 依据：games/soho-ecom/.myrd/spec/design-spec.json → spec.numeric（M0 数值框架 v1，approved）。
//
// —— M1「三刀收敛」边界（spec.mvpCuts，本文件之外的规则不得越界）——
//   刀1：三资源上线 = 精力 / 现金 / 店铺健康（心情→纯事件修正器、信誉并入店铺健康，M1 均无事件流，不出现）；
//   刀2：库存不做管理界面 = 「现金的前置形态」，一条公式（补货 ¥40/件 → 出单 库存-1 → 在途+¥55）；
//   刀3：回款周期 MVP 固定 T+14 一个值（成长变化进 P2 再开）。

// —— 内核时序 ——
export const FIXED_STEP = 1 / 240;      // 固定步长（单位：游戏日）：掉帧不改变经营节奏（E-06）
export const MAX_DT_DAYS = 0.5;         // 单帧 dt 钳制上限（游戏日）：切后台回来不瞬移（E-06）
export const SECONDS_PER_GAME_DAY = 75; // M0 time.gameDayRealSeconds：1× 速率下一游戏日 = 75 真实秒（区间 [60,90]）
export const SEED_DEFAULT = 20260925;   // 默认随机种子（确定性内核：同 seed 同经营轨迹）

// —— M0 exchangeRates（核心兑换率表，13 条逐条对号）——
export const GROSS_PROFIT_PER_ORDER = 15;   // #1 全表之锚：单件毛利 ¥15（售价55 − 头程成本40），其余都从它换算
export const ENERGY_PER_ORDER = 2;          // #2 精力消耗/单：与精力上限共同决定每日单数天花板（extreme）
export const INSTANT_NOODLE_COST = 5;       // #3 泡面 ¥5（low）
export const INSTANT_NOODLE_SATIETY = 30;   // #3 泡面饱腹 +30
export const INSTANT_NOODLE_PENALTY = 0.10; // #3 泡面代价：当日精力消耗 +10%
export const PROPER_MEAL_COST = 20;         // #4 正经饭 ¥20（low）
export const PROPER_MEAL_SATIETY = 60;      // #4 正经饭饱腹 +60
export const SLEEP_IN_VAN_ENERGY = 40;      // #5 睡车里 免费 精力+40（心情−5 属事件修正器，M1 三刀裁掉）
export const HOURLY_MOTEL_COST = 50;        // #6 钟点房 ¥50（medium）
export const HOURLY_MOTEL_ENERGY = 80;      // #6 钟点房 精力+80
export const FIRST_RESTOCK_COST = 2000;     // #7 首批进货 ¥2000（high）
export const FIRST_RESTOCK_UNITS = 50;      // #7 首批 50 件 → ¥40/件 = unitEconomics.costWithHeadFreight
export const SALE_PRICE_PER_UNIT = 55;      // #8 单件售价 ¥55（回款额，M0 fx.mode=constant 下 USD 标价×7.0 折回）
export const UNIT_COST_WITH_FREIGHT = 40;   // #8 单件头程成本 ¥40（55−40=15 即锚 #1）
export const SHOP_HEALTH_WEAR_PER_DAY = 5;  // #11 店铺健康磨损/游戏日（high）
export const REPLY_REVIEW_ENERGY = 5;       // #11 回评 精力−5
export const REPLY_REVIEW_HEALTH = 15;      // #11 回评 店铺健康+15
export const PAYOUT_CYCLE_DAYS = 14;        // #10 回款周期 T+14：本作核心张力旋钮（extreme），M1 固定值
export const RENT_PER_DAY = 30;             // #13 固定开支·床位档 房租 ¥30/游戏日（medium）
export const FX_USD_CNY = 7.0;              // M0 fx：汇率常数 7.0（MVP 定常数，P2 才降级为波动事件）

// —— M0 resources（资源与上限）——
export const CASH_INITIAL = 3500;           // cash.initial（调参 v1 占位值校准 3000→3500，spec.tune.cashInitial）：首批 ¥2000 + 首周固定开支 ¥350 + 贴线补货管线缓冲
export const ENERGY_MAX = 100;              // energy.max（extreme）
export const SATIETY_MAX = 100;             // satiety.max
export const SATIETY_DECAY_PER_DAY = 40;    // satiety.decayPerDay
export const SHOP_HEALTH_MAX = 100;         // shopHealth.max
export const SHOP_HEALTH_INITIAL = 100;     // shopHealth.initial
export const INVENTORY_INITIAL = 0;         // inventory.initial（不做管理界面，一条公式）
export const IN_TRANSIT_INITIAL = 0;        // inTransit.initial（locked：仅由 T+14 到账转出）

// —— 补货档位（首批 ¥2000/50件 为 M0 锚 #7；5/10/25 件为同价折算档 ¥40/件，不新增价格参数）——
// 调参 v1（spec.tune.restockLots，验收 §2-T1）：加 5 件档打通「首批后现金 ~¥750」的贴线补货通道；
// 趴窝线口径公式不变（固定开支 + 最低补货档），随最低档 10→5 件折算：床位档 30+5×40=¥230。
export const RESTOCK_LOTS = Object.freeze([5, 10, 25, 50]);

// —— M1 内核规则（全部由 M0 锚点派生，无新增数值参数；原型实现口径，README 有对照表）——
//   规则A 需求：单链接日需求 = base × (店铺健康/100) × 当日噪声(0.7~1.3，种子驱动)。
//        依据 stageCurve P0「最紧资源=精力」与循环 A 手算 30 单/日 workload；调参 v1（spec.tune.demandBand，
//        验收 §2-T1 候选3）将实装需求带宽对齐资本带宽 S*≈5 件/日（base 合计 11/日），「30 单/日」保留为
//        循环 A 手算基线（公式层验证不变）。base 见 levels/products.js。
//   规则B 转化通道：店铺健康=0 → 需求归零（循环 C「信誉↓→转化↓→收入↓」，不加新参数）。
//   规则C 吃睡链：饱腹=0 → 睡车里/钟点房的精力恢复无效（循环 A「接单→精力↓→吃睡→恢复」）。
//   规则D 能量天花板：可用精力 < 2/单 → 订单错失（M0 energyPerOrder 注释原文口径）。
//   规则E 趴窝：可用现金 < 固定开支 + 最低补货 → 趴窝（广告停投 + 无法补货）；M1 无广告系统（三刀外）。
export const DEMAND_NOISE_MIN = 0.7;
export const DEMAND_NOISE_MAX = 1.3;
export const MIN_RESTOCK_UNITS = 5;         // 最低补货档（RESTOCK_LOTS[0]，调参 v1 10→5），趴窝判定的「最低补货」口径
export const BROKE_LINE = RENT_PER_DAY + MIN_RESTOCK_UNITS * UNIT_COST_WITH_FREIGHT; // 30 + 5×40 = ¥230（口径公式不变，spec.tune.restockLots）
//   规则F 资金链断裂（终局）：趴窝 ∧ 在途为空 ∧（库存=0 ∨ 精力<2）∧ 现金<55（泡面5+钟点房50=自救最低启动金）。
export const SURVIVAL_BOOTSTRAP_COST = INSTANT_NOODLE_COST + HOURLY_MOTEL_COST; // ¥55

// —— 会话与目标 ——
export const SESSION_DAYS = 30;             // 一局 30 游戏日：M0 sessionSeconds 900 ÷ 75s ≈ 12 日 @1×，
                                            // 默认 4× 速率下 ≈ 562s，且覆盖 ≥2 轮完整 T+14 循环（M1 验收 1）

// ————————————————————————————————————————————————————————————————————————————
// —— M2「事件流 + 升级线」追加段（spec.m2 落地口径；全部由 M0 既有锚点派生，不改 M0 已定参数）——
// 依据：M2 需求（goal-cmvv02e7a0019m9uwy2nosbkn / req cmvv7a5bf0016m9ycmvnyohyk）
//       + GameDesignSpec v3 numeric.events（8 类事件效果表）/ exchangeRates（#9 #12 #13）/ stageCurve（P0→P1）。
// 汇率波动事件不进 M2：spec.fx.mode=constant（P2 才降级为波动事件），本段不设其参数。
// ————————————————————————————————————————————————————————————————————————————

// —— 事件节奏（M2 落地口径：策划案只定「每日随机事件流」，节奏参数为本段新增，校准依据见 tests/events.spec.mjs）——
export const EVENT_CHANCE_PER_DAY = 0.9;  // 每游戏日判定一次的触发概率（默认 seed 下 10 日 ≥6 类，验收 1 校准值；
                                          // 调参 v1 0.8→0.9：补偿趴窝期剔除延误类后的覆盖，spec.tune.eventCadenceTune）
export const EVENT_COOLDOWN_DAYS = 3;     // 同类事件冷却天数（防重复刷屏；不影响效果表数值）
export const GOOD_EVENT_WEIGHT = 1.6;     // 暖心事件在抽取池中的相对权重（奇葩类权重 1.0；保证两类均有，验收 1）
export const EVENT_MIN_LISTED = 1;        // 触发前置：至少 1 个链接在营（未开店 = 无经营事件，?case=broke 存档因此天然安静）
// 调参 v1（spec.tune.eventCadenceTune，验收 §2-T3 候选A）：趴窝已是最低点，延误类事件把救命钱再压数日
// 只产生挫败不产生张力（趴窝期无对应决策空间）——趴窝期间事件池剔除下列两类，效果值零改动。
export const EVENT_IDS_SHELVED_WHEN_BROKE = Object.freeze(["freight-delay", "customs-check"]);

// —— 8 类事件效果表（spec.numeric.events 逐条对号，误差 0；fx-swing 之外共 8 类可触发）——
// 跟卖狗 follow-seller：转化率−20% 持续 3 游戏日；花 10 精力投诉可提前下架
export const FOLLOW_SELLER_DEMAND_FACTOR = 0.8;  // 转化率 −20% → 需求 ×0.8
export const FOLLOW_SELLER_DAYS = 3;             // 持续 3 游戏日
export const FOLLOW_SELLER_COMPLAIN_ENERGY = 10; // 投诉精力 −10（效果表 counter 原文）
// 差评师 bad-reviewer：店铺健康−20；24h 内花 ¥50+5 精力公关则减半（M0 #12 negativeReview：healthHit/prCost/prEnergy/prWindowHours）
export const BAD_REVIEWER_HEALTH_HIT = 20;
export const BAD_REVIEWER_PR_COST = 50;
export const BAD_REVIEWER_PR_ENERGY = 5;
export const BAD_REVIEWER_PR_WINDOW_DAYS = 1;    // prWindowHours 24 ÷ 24h/游戏日 = 1 游戏日公关窗口
// 货代延误 freight-delay：在途批次 +3 游戏日到港，店铺健康−10
export const FREIGHT_DELAY_DAYS = 3;
export const FREIGHT_DELAY_HEALTH = 10;
// 海关查验 customs-check：现金−¥300，在途 +2 游戏日（现金不足按实际发生额扣，结算入口钳位口径）
export const CUSTOMS_CHECK_FINE = 300;
export const CUSTOMS_CHECK_DELAY_DAYS = 2;
// 旺季断货 peak-stockout：爆单期库存归零，每游戏日错失订单且店铺健康−5（状态型：补货即解除）
export const PEAK_STOCKOUT_HEALTH_PER_DAY = 5;
// 老客五星复购 five-star-rebuy：店铺健康+10，心情+5
export const FIVE_STAR_HEALTH = 10;
export const FIVE_STAR_MOOD = 5;
// 爆款自然流量 organic-hit：当日订单×2 且当日广告费返还
export const ORGANIC_HIT_DEMAND_MULT = 2;
// 海外仓及时补货 warehouse-restock（spec.world.templateLineage 暖心名单，M2 追加；效果由对称锚派生）：
//   最早在途批次提前 3 游戏日到港（= 货代延误 +3 的对称锚）∧ 店铺健康+10（= 老客五星复购同源锚）。
//   触发前置：海外仓已升级 ∧ 在途批次 ≥1。派生依据已回写 spec.m2。
export const WAREHOUSE_RESTOCK_DAYS = 3;
export const WAREHOUSE_RESTOCK_HEALTH = 10;

// —— 心情修正器（spec.resources.mood kind=event-modifier：纯事件修正器，非管理资源）——
// 事件给的心情值即百分比：需求乘数 = 1 + 心情/100（+5 心情 = +5% 需求，事件值直接作 %，不另造换算参数）。
// M0 #5 睡车里 moodDelta −5 为唯一负值来源（M1 三刀裁掉的「心情−5」随事件修正器一并恢复）。
export const MOOD_CLAMP = 20;               // 心情钳位 ±20（防极端滚雪球；敏感度 medium 允许的手感范围）
export const SLEEP_IN_VAN_MOOD = -5;        // M0 #5 sleepInVan.moodDelta：睡车里的心情代价（SOHO 后睡家里无此代价）

// —— 阶段曲线 P0→P1（spec.stageCurve 原文：P0 unlock「开局」→ P1 unlock「现金 ¥5000」）——
export const P1_CASH_LINE = 5000;           // P1「SOHO 起量」解锁线（stageCurve P1.unlock）
export const UNIT_ECONOMY_P0 = 15;          // P0「兼职试水」¥15/单（= M0 锚 #1 grossProfitPerOrder）
export const UNIT_ECONOMY_P1 = 35;          // P1「SOHO 起量」¥35/单（stageCurve P1.unitEconomics）

// —— 升级线第一档（解锁条件、花费、效果的派生依据已回写 spec.m2.upgrades）——
export const WAREHOUSE_UPGRADE_COST = 3000; // 海外仓升级花费 = 1.5× 首批进货 ¥2000（锚 #7 派生）
export const HOUSING_SOHO_COST = 3000;      // SOHO 一人居升级花费（与海外仓同级派生）
// ?case=rich 演示存档现金（调参 v1 6000→8000，spec.tune）：P1 贴线经济把现金压在在途（实测现金峰值 ~¥2000），
// ¥6000 在仓库升级后摸不到 SOHO 门槛，两级升级演示（M2 验收 3）无法自然发生；7000 又会在升级+首批后清零，
// 差评师上门时付不出 ¥50 公关（M2 验收 2 演示层缺失）。8000 = 两级升级 ¥6000 + 海外仓档首批 ¥1000（¥20/件×50）
// + 应对/生活余量 ¥1000 —— P1 全套机制（两级升级 / 广告 / 公关 / 投诉 / 双升级效果）都能演示的「现金充足存档」。
export const RICH_SCENARIO_CASH = 8000;
export const WAREHOUSE_UNIT_COST = 20;      // 海外仓头程结构变化：单件补货 ¥40→¥20 → 毛利 ¥15→¥35（= P1 ¥35/单锚反推）
export const RENT_SOHO_PER_DAY = 60;        // SOHO 档房租 = 床位档 ¥30（锚 #13）×2 档位递进
export const SLEEP_HOME_ENERGY = 60;        // 睡家里（免费）= 睡车里 40（锚 #5）与钟点房 80（锚 #6）两锚中点：「精力恢复效率上调」

// —— 广告投放（M0 #9 ads 原文：costPerCast 10 / expectedOrdersPerCast 1.5 / acosAnchor 0.45）——
export const AD_COST_PER_CAST = 10;
export const AD_EXPECTED_ORDERS = 1.5;
//   ACOS 自洽核对：10 ÷ (1.5 × ¥15 毛利) ≈ 0.44 ≈ 0.45（acosAnchor）——数值即锚，无需另设参数。
//   落地：投放当日期望订单池 +1.5（经出单管线同一库存/精力守卫），当日有效日终清零；
//   趴窝期广告停投（payoutPools.brokeRule 原文）；P0 阶段入口不可用（stageCurve P1 才解锁）。
