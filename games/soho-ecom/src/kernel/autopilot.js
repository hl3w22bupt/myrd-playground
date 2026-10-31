// autopilot.js — 内核级贪心经营自动驾驶：冒烟协议与确定性测试共用的「真实玩家替身」。
// 纯函数（零 three/零 DOM/零随机/零时钟）：读世界状态，返回下一个该做的动作（或 null 观望）。
// 有了它，快进不再是空转的日历翻页，而是真的会选品、补货、吃睡、趴窝、等回款、翻身的完整对局。
// 优先级（从求生到扩张）：事件消灾 → 吃睡保精力 → 回评保健康 → 升级线（现金富余时）→ 首批补货 → 逐个上架 → 按现金档位补货。
// 铁律：每个返回的动作都必须是内核守卫当下会放行的（否则替身会在被拒动作上空转，堵死后续决策）。
import { listedCount } from "./events.js";
import { brokeLine } from "./upgrades.js";
import { WAREHOUSE_UPGRADE_COST, HOUSING_SOHO_COST } from "../numeric.js";

/** 需求最大的未上架商品（选品口径：先把需求吃满） */
function bestUnlisted(w) {
  return w.products
    .filter((p) => !p.listed)
    .sort((a, b) => b.baseDemand - a.baseDemand)[0] || null;
}

export function bizIntent(w) {
  const FIRST = 50, MID = 25, SMALL = 10, TINY = 5;
  const SAFE = 60; // 一日固定开支储备（房租 30 + 一餐 20 + 余量）：补货后不跌破趴窝线的贴线保证金
  const unitCost = w.upgrades.warehouse ? 20 : 40; // 补货单价：海外仓头程结构变化 ¥40→¥20（与 numeric 同源）
  const cost = (u) => u * unitCost;

  // 0) M2 事件应对（花钱消灾优先）：差评师窗口内公关（留足补货缓冲）/ 跟卖狗精力富余时投诉
  for (const pe of w.pendingEvents) {
    if (pe.id === "bad-reviewer" && w.day + w.dayProgress < pe.deadline && w.cash >= 450 && w.energy >= 10) {
      return { action: "eventChoice", arg: { id: pe.id, choice: "pr" } };
    }
    if (pe.id === "follow-seller" && w.energy >= 30) {
      return { action: "eventChoice", arg: { id: pe.id, choice: "complain" } };
    }
  }
  // 1) 生命线：饱腹见底先吃（正经饭优先，便宜泡面兜底）
  if (w.satiety < 40) {
    if (w.cash >= 20) return { action: "meal" };
    if (w.cash >= 5) return { action: "noodle" };
  }
  // 2) 精力见底再睡（钟点房大补，睡车里/睡家里白嫖）
  if (w.energy < 40) {
    if (w.satiety > 0 && w.cash >= 50) return { action: "motel" };
    if (w.satiety > 0) return { action: "sleepVan" };
  }
  // 3) 店铺健康磨损到警戒线就回评
  if (w.shopHealth < 70 && w.energy >= 5) return { action: "replyReview" };
  // 3b) M2 升级线：P1 且现金 ≥「升级花费 + 趴窝线 + 一日开支」→ 逐项升级（海外仓优先）。
  //     （调参 v1：贴线策略把现金用活后，原「≥ ¥5200 解锁线上方」门槛在 40 日局内不再可达，
  //      SOHO 升级无法演示——改为原则化水位：升级后仍保有趴窝线 + 一日开支。）
  if (w.stage === "P1") {
    const reserve = brokeLine(w) + SAFE;
    if (!w.upgrades.warehouse && w.cash >= WAREHOUSE_UPGRADE_COST + reserve) return { action: "upgradeWarehouse" };
    if (!w.upgrades.housingSoho && w.cash >= HOUSING_SOHO_COST + reserve) return { action: "upgradeHousing" };
  }
  // 3c) M2 广告：P1 非趴窝且现金 ≥ ¥600（远离趴窝线）且有链接在营，每日投一次（¥10 → 期望 +1.5 单）。
  //     「有链接在营」前置必须与内核守卫一致 —— 否则自动驾驶会在被拒的 ad 上空转占位，堵住后续补货/上架。
  if (w.stage === "P1" && !w.broke && w.cash >= 600 && w.adSpendToday === 0 && listedCount(w) >= 1) return { action: "ad" };
  // 4) 首批进货（M0 锚 #7：¥2000 → 50 件，开局节奏感）
  if (w.inventory === 0 && w.ordersTotal === 0 && w.cash >= cost(FIRST)) return { action: "restock", arg: FIRST };
  // 5) 上架：有 10 件以上的货就再开一个链接（逐步放大需求，亲历「爆单 → 在途 → 现金紧」）。
  //    （调参 v1：门槛 20→10 —— 贴线小步补货在 ?case=broke 回款解除后只补得出 10 件，20 件门槛会让
  //     恢复路径永远开不了链接 → 零出单死锁；fresh 开局首批 50 件下两条门槛行为一致。）
  const next = bestUnlisted(w);
  if (next && w.inventory >= 10) return { action: "list", arg: next.id };
  // 6) 补货档位随现金水位走（趴窝时无法补货，只能等 T+14 回款）。
  //    调参 v1 贴线小步（验收 §2-T1：5 件档打通贴线补货通道）：小档优先细水长流，
  //    大盘档只在现金远高于趴窝线时升档（回款重启管线），不再「梭哈 → 趴窝长尾」。
  if (!w.broke && w.inventory < 15) {
    const line = brokeLine(w);
    if (w.cash >= line + cost(FIRST) + SAFE * 4) return { action: "restock", arg: FIRST };
    if (w.cash >= line + cost(MID) + SAFE * 2) return { action: "restock", arg: MID };
    if (w.cash >= line + cost(SMALL) + SAFE) return { action: "restock", arg: SMALL };
    if (w.cash >= line + cost(TINY) + SAFE) return { action: "restock", arg: TINY };
  }
  return null;
}
