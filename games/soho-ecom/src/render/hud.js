// hud.js — DOM 表现层：屏幕切换 + 三资源/三池/选品/升级线/事件/流水 的一屏同步。
// 只读内核状态渲染，不持有游戏逻辑；按钮禁用态全部由 world 状态推导（内核另有守卫，双保险）。
import { PRODUCTS } from "../levels/products.js";
import { SESSION_DAYS, FX_USD_CNY, UNIT_COST_WITH_FREIGHT, WAREHOUSE_UNIT_COST, P1_CASH_LINE } from "../numeric.js";

function $(id) { return document.getElementById(id); }

/** 内联 SVG 图标（禁 emoji）：商品/动作的几何线条 */
const ICONS = {
  led: '<svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><rect x="3" y="10" width="10" height="2.4" rx="1.2"/><path d="M5 8l1 2M8 7v3M11 8l-1 2"/></svg>',
  pet: '<svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M3 9h10c0 2.5-2.2 4-5 4s-5-1.5-5-4z"/><path d="M6 6.5c0-1.8 4-1.8 4 0"/></svg>',
  yoga: '<svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><ellipse cx="8" cy="8" rx="5.5" ry="3.4" transform="rotate(-24 8 8)"/></svg>',
  stand: '<svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><rect x="5.5" y="2.5" width="5.5" height="9" rx="1"/><path d="M3.5 13.5h9"/></svg>',
};

/** 流水条目文案（kind → 行标签；金额符号由 from/to 推导） */
const J_LABEL = {
  "payout": "T+14 到账",
  "order-revenue": "出单 → 在途",
  "rent": "房租",
  "restock-pay": "补货付款",
  "noodle": "泡面",
  "meal": "正经饭",
  "motel": "钟点房",
  "sleep-van": "睡车里",
  "sleep-home": "睡家里",
  "reply-review": "回评耗神",
  "wear": "店铺磨损",
  "satiety-decay": "饱腹衰减",
  "order-labor": "处理订单",
  "order-ship": "订单出货",
  "restock-goods": "补货入库",
  "satiety-restore": "进食回饱",
  "motel-rest": "钟点房回精",
  "health-restore": "回评养店",
  // —— M2 事件流与升级线（事件本身的留痕在「事件」区，这里是结算侧资金/资源行）——
  "ad-spend": "广告投放",
  "upgrade-warehouse": "升级海外仓",
  "upgrade-housingSoho": "升级 SOHO",
  "event-bad-review": "差评师冲击",
  "event-pr-cost": "公关花费",
  "event-pr-labor": "公关耗神",
  "event-pr-relief": "公关减半返还",
  "event-complain": "投诉耗神",
  "event-freight-delay": "货代延误",
  "event-customs-fine": "海关查验费",
  "event-stockout": "旺季断货磨损",
  "event-five-star": "五星复购养店",
  "event-ad-refund": "广告费返还",
  "event-warehouse-restock": "海外仓补货养店",
  "payout-delay": "在途批次平移",
};
const J_SKIP = new Set(["order-ship", "restock-goods", "satiety-restore", "motel-rest", "health-restore"]); // 与配对行合并展示，避免流水噪音
const MONEY_IN = new Set(["payout", "event-ad-refund", "event-pr-relief"]); // 流入型

/** M2 事件流水行文案：效果清单 → 短句（事件名/游戏日/效果值/资源去向） */
const ACCOUNT_LABEL = Object.freeze({
  demand: "需求", mood: "心情", inTransit: "在途时效",
  cash: "现金", shopHealth: "店铺健康", energy: "精力",
});

function eventEffectsText(log) {
  const parts = log.effects.map((e) => {
    const sign = e.amount < 0 ? "−" : "+";
    const abs = Math.abs(e.amount);
    const val = Number.isInteger(abs) ? String(abs) : abs.toFixed(1);
    return `${ACCOUNT_LABEL[e.account] || e.account} ${sign}${val}${e.unit === "点" ? "" : e.unit}`;
  });
  if (log.choice === "pr") parts.push("已公关（减半）");
  if (log.choice === "complain") parts.push("已投诉下架");
  return parts.join(" · ") || "无直接资源变化";
}

export function createHud() {
  const el = {
    hud: $("hud"), panel: $("panel"),
    dayNum: $("day-num"), dayTotal: $("day-total"), dayProg: $("day-prog"), fxRate: $("fx-rate"),
    stageLabel: $("stage-label"), moodChip: $("mood-chip"), moodVal: $("mood-val"),
    broke: $("broke-banner"), brokeNext: $("broke-next"), brokeSleepHint: $("broke-sleep-hint"),
    energy: $("res-energy"), health: $("res-health"), satiety: $("res-satiety"), cashBig: $("cash-big"),
    poolInventory: $("pool-inventory"), poolTransit: $("pool-transit"), batches: $("pool-transit-batches"),
    productList: $("product-list"), journal: $("journal"),
    sourcingHint: $("sourcing-hint"),
    adBtn: $("btn-ad"),
    upWhName: $("up-wh-name"), upWhBtn: $("btn-up-warehouse"),
    upHsName: $("up-hs-name"), upHsBtn: $("btn-up-housing"),
    sleepBtn: $("btn-sleep"),
    eventLog: $("event-log"),
    title: $("screen-title"), paused: $("screen-paused"), over: $("screen-over"),
    overTitle: $("over-title"), overDetail: $("over-detail"), overStats: $("over-stats"),
  };

  // —— 选品卡：一次性构建（结构静态，状态每帧刷） ——
  const productRows = new Map();
  for (const p of PRODUCTS) {
    const row = document.createElement("div");
    row.className = "product";
    row.innerHTML = `
      <span class="icon">${ICONS[p.icon] || ICONS.stand}</span>
      <span class="meta"><div class="name">${p.name}</div><div class="tag">${p.tag} · 需求约 ${p.baseDemand} 单/日</div></span>
      <button data-product="${p.id}">上架</button>`;
    el.productList.appendChild(row);
    productRows.set(p.id, { row, btn: row.querySelector("button") });
  }
  const restockBtns = [...document.querySelectorAll("[data-lot]")];
  const lifeBtns = {
    noodle: $("btn-noodle"), meal: $("btn-meal"), sleep: $("btn-sleep"),
    motel: $("btn-motel"), reply: $("btn-reply"),
  };
  const speedBtns = [...document.querySelectorAll("[data-speed]")];
  const pauseBtn = $("btn-pause");
  el.dayTotal.textContent = String(SESSION_DAYS);
  el.fxRate.textContent = FX_USD_CNY.toFixed(1);

  let journalLen = -1;

  function setFill(row, ratio, warnBelow) {
    const k = Math.max(0, Math.min(1, ratio));
    row.querySelector(".fill").style.width = `${(k * 100).toFixed(1)}%`;
    row.querySelector(".val").textContent = String(Math.round(ratio * 100));
    row.querySelector(".fill").style.background = k <= warnBelow ? "var(--red)" : "";
  }

  /** 三池批次列表：每批显示到期日/剩余天数/金额/单数（M1 验收「每笔在途回款剩余天数与所属池」） */
  function renderBatches(world) {
    el.batches.textContent = "";
    for (const b of world.receivables) {
      const div = document.createElement("div");
      div.className = "batch";
      const remain = Math.max(0, b.dueDay - world.day);
      div.innerHTML = `<span class="due">第 ${b.dueDay} 天到账</span><span class="remain">剩 ${remain} 天</span><span class="amount num">¥${fmt(b.amount)} · ${b.orders}单</span>`;
      el.batches.appendChild(div);
    }
    if (world.receivables.length === 0) {
      const empty = document.createElement("div");
      empty.className = "batch";
      empty.innerHTML = '<span class="due">在途为空 —— 出单后货款进入这里，T+14 自动转现金</span>';
      el.batches.appendChild(empty);
    }
  }

  /** 流水（最近 30 条，每笔含来源/游戏日/金额/池去向） */
  function renderJournal(world) {
    if (world.journal.length === journalLen) return;
    journalLen = world.journal.length;
    el.journal.textContent = "";
    const rows = world.journal.filter((e) => !J_SKIP.has(e.kind)).slice(-30).reverse();
    for (const e of rows) {
      const div = document.createElement("div");
      const incoming = MONEY_IN.has(e.kind) || (e.to === "cash" && e.from !== "expense");
      div.className = `j ${incoming ? "in" : "out"}`;
      const unit = e.unit === "件" ? "件" : "¥";
      div.innerHTML = `<span class="jd">D${e.day}</span><span class="note">${J_LABEL[e.kind] || e.kind}${e.ref?.orderId ? " " + e.ref.orderId : ""}</span><span class="amount num">${incoming ? "+" : "−"}${unit}${fmt(e.amount)}</span>`;
      el.journal.appendChild(div);
    }
  }

  /** M2 事件流水（最近 8 条：事件名、游戏日、效果值、资源去向、玩家应对） */
  let eventLogLen = -1;
  function renderEvents(world) {
    if (world.eventLog.length === eventLogLen) return;
    eventLogLen = world.eventLog.length;
    el.eventLog.textContent = "";
    for (const log of world.eventLog.slice(-8).reverse()) {
      const div = document.createElement("div");
      div.className = `e ${log.moodKind === "good" ? "good" : "bad"}`;
      div.innerHTML = `<span class="ed num">D${log.day}</span><span class="name">${log.name}</span><span class="fx">${eventEffectsText(log)}</span>`;
      el.eventLog.appendChild(div);
    }
    if (world.eventLog.length === 0) {
      const empty = document.createElement("div");
      empty.className = "e";
      empty.innerHTML = '<span class="fx">暂无事件 —— 开张营业后，奇葩与暖心事件随时上门</span>';
      el.eventLog.appendChild(empty);
    }
  }

  const fmt = (n) => (Math.abs(n) >= 1000 ? Math.round(n).toLocaleString("en-US") : String(Math.round(n * 100) / 100));

  return {
    /** 屏幕切换：null = 只留 HUD + 面板（playing 态） */
    showScreen(name) {
      for (const [key, node] of [["title", el.title], ["paused", el.paused], ["over", el.over]]) {
        node.classList.toggle("hidden", key !== name);
      }
      const playing = name === null;
      el.hud.classList.toggle("hidden", name === "title");
      el.panel.classList.toggle("hidden", name === "title");
    },

    setSpeed(speed, paused) {
      for (const b of speedBtns) b.classList.toggle("active", Number(b.dataset.speed) === speed);
      pauseBtn.textContent = paused ? "继续" : "暂停";
    },

    /** 主同步（每帧）：只做字符串/样式赋值，无布局逻辑 */
    sync(world) {
      el.dayNum.textContent = String(Math.min(world.day, SESSION_DAYS));
      el.dayProg.style.width = `${Math.min(100, world.dayProgress * 100).toFixed(1)}%`;

      setFill(el.energy, world.energy / 100, 0.25);
      setFill(el.health, world.shopHealth / 100, 0.3);
      setFill(el.satiety, world.satiety / 100, 0.25);
      el.cashBig.textContent = `¥${fmt(world.cash)}`;

      el.poolInventory.textContent = String(Math.floor(world.inventory));
      el.poolTransit.textContent = fmt(world.inTransit);
      renderBatches(world);
      renderJournal(world);
      renderEvents(world);

      // M2 阶段徽标 + 心情修正器
      const p1 = world.stage === "P1";
      el.stageLabel.textContent = p1 ? "P1 SOHO 起量" : "P0 兼职试水";
      el.stageLabel.classList.toggle("p1", p1);
      el.moodVal.textContent = `${world.mood >= 0 ? "+" : ""}${world.mood}`;
      el.moodChip.classList.toggle("up", world.mood > 0);
      el.moodChip.classList.toggle("down", world.mood < 0);

      // 趴窝横幅 + 指引（最近一批到账）
      el.broke.classList.toggle("hidden", !world.broke);
      if (world.receivables.length > 0) {
        const next = world.receivables[0];
        el.brokeNext.textContent = `第 ${next.dueDay} 天 ¥${fmt(next.amount)}`;
      } else {
        el.brokeNext.textContent = "无在途批次（危险）";
      }

      // 选品按钮态
      for (const p of world.products) {
        const ui = productRows.get(p.id);
        ui.btn.textContent = p.listed ? "下架" : "上架";
        ui.btn.classList.toggle("off", p.listed);
        ui.btn.disabled = world.over;
      }
      // 补货按钮态（海外仓升级后 ¥20/件）
      const unitCost = world.upgrades.warehouse ? WAREHOUSE_UNIT_COST : UNIT_COST_WITH_FREIGHT;
      const gross = 55 - unitCost; // 售价锚 ¥55（M0 #8）− 当前单件头程 = 当前毛利
      el.sourcingHint.textContent = `统一价 ¥${unitCost}/件 · 售 ¥55 · 毛利 ¥${gross}`;
      for (const b of restockBtns) {
        const lot = Number(b.dataset.lot);
        const cost = lot * unitCost;
        b.querySelector(".price").textContent = `¥${fmt(cost)}`;
        const disabled = world.over || world.broke || world.cash < cost;
        b.disabled = disabled;
        b.title = world.broke ? "趴窝中无法补货，等在途回款" : `¥${cost}（¥${unitCost}/件）`;
      }

      // M2 升级线入口态（锁定 / 可升级 / 已升级 —— 内核一次性开关守卫，连点不重复扣费）
      const growthLocked = world.stage !== "P1";
      const lockWhy = `现金达 ¥${P1_CASH_LINE} 进 P1 后解锁`;
      const disable = (btn, cond, why) => { btn.disabled = cond; btn.title = cond ? why : ""; };
      disable(el.adBtn, world.over || growthLocked || world.broke, growthLocked ? lockWhy : world.broke ? "趴窝中：广告停投" : "");
      el.adBtn.textContent = world.broke && !growthLocked ? "停投中" : "投广告";
      const whDone = world.upgrades.warehouse;
      el.upWhName.textContent = whDone ? "海外仓（毛利 ¥35/单）" : "自发货";
      el.upWhBtn.textContent = whDone ? "已升级" : "升级 ¥3000";
      el.upWhBtn.classList.toggle("done", whDone);
      disable(el.upWhBtn, world.over || whDone || growthLocked, whDone ? "已升级（不重复扣费）" : growthLocked ? lockWhy : "");
      const hsDone = world.upgrades.housingSoho;
      el.upHsName.textContent = hsDone ? "SOHO 一人居（房租 ¥60/日）" : "出租房（床位档 ¥30/日）";
      el.upHsBtn.textContent = hsDone ? "已升级" : "升级 ¥3000";
      el.upHsBtn.classList.toggle("done", hsDone);
      disable(el.upHsBtn, world.over || hsDone || growthLocked, hsDone ? "已升级（不重复扣费）" : growthLocked ? lockWhy : "");
      // 睡觉动作随住房档位换文案（睡车里 精+40 心情−5 / 睡家里 精+60 无代价）
      lifeBtns.sleep.innerHTML = hsDone ? '睡家里<span class="price num">免费 · 精+60</span>' : '睡车里<span class="price num">免费 · 精+40</span>';
      el.brokeSleepHint.textContent = hsDone ? "睡家里代替钟点房" : "睡车里代替钟点房";

      // 生活按钮态
      disable(lifeBtns.noodle, world.over || world.cash < 5, "现金不足");
      disable(lifeBtns.meal, world.over || world.cash < 20, "现金不足");
      disable(lifeBtns.sleep, world.over || world.satiety <= 0, "饱腹为 0：先吃点东西");
      disable(lifeBtns.motel, world.over || world.cash < 50 || world.satiety <= 0, world.satiety <= 0 ? "饱腹为 0：先吃点东西" : "现金不足");
      disable(lifeBtns.reply, world.over || world.energy < 5, "精力不足");
    },

    setOver(won, world) {
      el.overTitle.textContent = won ? `撑满 ${SESSION_DAYS} 天！资金链活下来了` : "资金链断裂";
      el.overDetail.textContent = won
        ? "你在 T+14 的挤压下把循环跑通了——但真正的跨境，才刚刚开始。"
        : "无现金、无在途回款、无库存可售。爆单一时爽，回款火葬场。";
      const stats = [
        ["累计回款", `¥${fmt(world.settledTotal)}`],
        ["成交订单", `${world.ordersTotal} 单`],
        ["到账订单", `${world.payoutCount} 单`],
        ["趴窝次数", `${world.brokeCount} 次`],
        ["错失订单", `${world.missedTotal} 单`],
        ["期末现金", `¥${fmt(world.cash)}`],
      ];
      el.overStats.innerHTML = stats
        .map(([k, v]) => `<span class="k">${k}</span><span class="v num">${v}</span>`)
        .join("");
    },
  };
}
