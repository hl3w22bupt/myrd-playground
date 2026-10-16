/* 《今日汇率》app.js —— 零依赖 ES Module
 * 数据源：
 *  - 最新汇率：https://open.er-api.com/v6/latest/{base}（免 key，CORS 开放，每日更新）
 *  - 趋势序列：https://api.frankfurter.dev/v1/{start}..{end}?base=..&symbols=..（ECB 参考汇率，免 key）
 * 容错：任一来源失败 → 读 localStorage 缓存并显示「数据可能滞后」提示，绝不白屏。
 * 本地留存：币种选择、金额、最新汇率与趋势缓存均写入 localStorage。
 */

const CURRENCIES = [
  { code: "CNY", name: "人民币", symbol: "¥" },
  { code: "USD", name: "美元", symbol: "$" },
  { code: "EUR", name: "欧元", symbol: "€" },
  { code: "JPY", name: "日元", symbol: "¥" },
  { code: "GBP", name: "英镑", symbol: "£" },
  { code: "HKD", name: "港币", symbol: "HK$" },
  { code: "KRW", name: "韩元", symbol: "₩" },
  { code: "SGD", name: "新加坡元", symbol: "S$" },
];

const LS_KEYS = {
  prefs: "fx-prefs-v1",       // {from,to,amount}
  latest: "fx-latest-v1",     // {base,rates,fetchedAt,date}
  trend: "fx-trend-v1",       // {base,quote,range,data:{dates,rates},fetchedAt}
};

const state = {
  from: "CNY",
  to: "USD",
  amount: "100",
  range: 7, // 7 | 30
  latest: null,   // {base, rates, date, fetchedAt, stale}
  trend: null,    // {dates, rates, stale}
};

const $ = (id) => document.getElementById(id);
const els = {};

/* ---------- 工具 ---------- */
const cacheGet = (key) => {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
};
const cacheSet = (key, val) => {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* 隐私模式等，忽略 */ }
};

/** 以 base 为基准把任意币种换算为另一币种（rates[base] 均存在时使用交叉汇率） */
export function convert(rates, base, amount, quote) {
  const rb = rates[base], rq = rates[quote];
  if (!rb || !rq || !isFinite(amount)) return null;
  return (amount / rb) * rq;
}

function fmtNum(n, maxFrac = 4) {
  if (n == null || !isFinite(n)) return "--";
  const abs = Math.abs(n);
  const frac = abs >= 1000 ? 2 : abs >= 1 ? 4 : 6;
  return n.toLocaleString("zh-CN", { maximumFractionDigits: Math.min(frac, maxFrac) });
}

function fmtMoney(n, cur) {
  if (n == null || !isFinite(n)) return "--";
  const c = CURRENCIES.find((x) => x.code === cur) || { symbol: "" };
  const abs = Math.abs(n);
  const frac = abs >= 10000 ? 2 : abs >= 1 ? 2 : 4;
  return `${c.symbol}${n.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: frac })}`;
}

/* ---------- 渲染：币种选择器 ---------- */
function fillCurrencySelects() {
  for (const id of ["fromCurrency", "toCurrency"]) {
    const sel = els[id];
    sel.innerHTML = "";
    for (const c of CURRENCIES) {
      const opt = document.createElement("option");
      opt.value = c.code;
      opt.textContent = `${c.name} ${c.code}`;
      sel.appendChild(opt);
    }
    sel.value = id === "fromCurrency" ? state.from : state.to;
  }
}

/* ---------- 渲染：换算结果 ---------- */
function renderConvert() {
  const amount = parseFloat(state.amount);
  if (!state.latest || !isFinite(amount)) {
    els.resultValue.textContent = "--";
    els.resultRate.textContent = state.latest ? "请输入有效金额" : "汇率数据尚未就绪";
    return;
  }
  const { rates, base } = state.latest;
  const out = convert(rates, base, amount, state.to) ?? convert(rates, state.from, amount, state.to);
  const unit = convert(rates, base, 1, state.to) ?? convert(rates, state.from, 1, state.to);
  els.resultValue.textContent = fmtMoney(out, state.to);
  els.resultRate.textContent =
    `1 ${state.from} ≈ ${fmtNum(unit)} ${state.to} · ${fmtNum(amount)} ${state.from} 兑换所得`;
}

/* ---------- 渲染：常用币种一览（以源币种为基准） ---------- */
function renderRateTable() {
  if (!state.latest) { els.rateList.innerHTML = ""; els.tableCaption.textContent = "--"; return; }
  const base = state.from;
  const one = (code) => convert(state.latest.rates, state.latest.base, 1, code) &&
    convert(state.latest.rates, base, 1, code);
  els.tableCaption.textContent = `1 ${state.from} 可兑换：`;
  els.rateList.innerHTML = "";
  for (const c of CURRENCIES) {
    if (c.code === base) continue;
    const li = document.createElement("li");
    const v = one(c.code);
    li.innerHTML = `<span class="pair">${c.name} ${c.code}</span>
      <span class="val">${v ? fmtNum(v) + " " + c.code : "--"}</span>`;
    els.rateList.appendChild(li);
  }
}

/* ---------- 渲染：数据新鲜度 / 滞后提示 ---------- */
function renderFreshness() {
  const l = state.latest;
  if (!l) { els.dataFreshness.textContent = "汇率数据不可用"; return; }
  const t = new Date(l.fetchedAt);
  const src = l.stale ? "本地缓存" : "实时获取";
  els.dataFreshness.textContent =
    `数据来源：${src} · 更新于 ${t.toLocaleString("zh-CN", { hour12: false })}`;
  els.staleBanner.hidden = !l.stale && !(state.trend && state.trend.stale);
}

/* ---------- 趋势：SVG 折线图 ---------- */
const CHART = { W: 640, H: 260, PAD: { t: 18, r: 14, b: 30, l: 14 } };

function renderTrend() {
  const svg = els.trendChart;
  svg.innerHTML = "";
  els.trendLoading.hidden = true;
  els.trendPair.textContent = `${state.from} → ${state.to}`;
  els.chartCaption.textContent = state.range === 7 ? "近 7 天走势（公开汇率 API）" : "近 30 天走势（公开汇率 API）";

  const t = state.trend;
  if (!t || !t.dates || t.dates.length < 2) {
    els.trendLoading.hidden = false;
    els.trendLoading.textContent = t && t.samePair ? "源币种与目标币种相同，换算恒为 1:1，趋势无意义"
      : t && t.failed ? "趋势数据暂不可用（已展示缓存）" : "趋势数据加载中…";
    els.trendChange.textContent = "--";
    els.trendChange.className = "trend-change";
    return;
  }

  const { dates, rates } = t;
  const n = dates.length;
  const min = Math.min(...rates), max = Math.max(...rates);
  const span = max - min || max * 0.01 || 1;
  const pad = CHART.PAD;
  const x = (i) => pad.l + (i / (n - 1)) * (CHART.W - pad.l - pad.r);
  const y = (v) => pad.t + (1 - (v - min) / span) * (CHART.H - pad.t - pad.b);

  const NS = "http://www.w3.org/2000/svg";
  const mk = (tag, attrs) => {
    const el = document.createElementNS(NS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  };

  // 面积渐隐填充 + 折线
  const linePts = rates.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const defs = mk("defs", {});
  defs.innerHTML = `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#14b8a6" stop-opacity="0.22"/>
    <stop offset="1" stop-color="#14b8a6" stop-opacity="0.02"/></linearGradient>`;
  svg.appendChild(defs);
  svg.appendChild(mk("polygon", { points: `${pad.l},${CHART.H - pad.b} ${linePts} ${CHART.W - pad.r},${CHART.H - pad.b}`, fill: "url(#g)", stroke: "none" }));
  svg.appendChild(mk("polyline", { points: linePts, fill: "none", stroke: "#0d9488", "stroke-width": 2.5, "stroke-linejoin": "round", "stroke-linecap": "round" }));

  // 涨跌参照线（首日值）+ 数据点抽样标注
  svg.appendChild(mk("line", { x1: pad.l, x2: CHART.W - pad.r, y1: y(rates[0]), y2: y(rates[0]), stroke: "#38bdf8", "stroke-width": 1, "stroke-dasharray": "4 4", opacity: 0.7 }));
  const step = Math.max(1, Math.ceil(n / 12));
  dates.forEach((d, i) => {
    svg.appendChild(mk("circle", { cx: x(i), cy: y(rates[i]), r: i % step === 0 || i === n - 1 ? 3.5 : 2, fill: "#0d9488" }));
    if (i % step === 0 || i === n - 1) {
      const tx = mk("text", { x: x(i), y: CHART.H - 10, "text-anchor": "middle", "font-size": 11, fill: "#5b7470" });
      tx.textContent = d.slice(5).replace("-", "/");
      svg.appendChild(tx);
    }
  });

  // 区间涨跌（三重编码：颜色 + 符号 + 百分比）
  const first = rates[0], last = rates[n - 1];
  const pct = ((last - first) / first) * 100;
  const up = pct >= 0;
  els.trendChange.textContent = `${up ? "▲" : "▼"} 区间${up ? "上涨" : "下跌"} ${Math.abs(pct).toFixed(2)}%`;
  els.trendChange.className = `trend-change ${up ? "up" : "down"}`;
}

/* ---------- 数据获取（含缓存降级） ---------- */
async function fetchLatest() {
  const key = LS_KEYS.latest;
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${state.from}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    if (!j.rates || !j.rates[state.to]) throw new Error("rates missing");
    const rec = { base: state.from, rates: j.rates, date: j.time_last_update_utc || "", fetchedAt: Date.now(), stale: false };
    state.latest = rec;
    cacheSet(key, rec);
  } catch (e) {
    const cached = cacheGet(key);
    if (cached && cached.base === state.from) {
      state.latest = { ...cached, stale: true };
    } else if (cached) {
      state.latest = { ...cached, stale: true };
    } else {
      state.latest = null;
    }
  }
}

async function fetchTrend() {
  // 防呆：源=目标时汇率恒为 1，趋势无意义；直接给提示态，不发非法请求
  if (state.from === state.to) {
    state.trend = { samePair: true };
    return;
  }
  const cacheKey = `${LS_KEYS.trend}:${state.from}:${state.to}:${state.range}`;
  const end = new Date();
  const start = new Date(end.getTime() - (state.range + 1) * 86400000);
  const iso = (d) => d.toISOString().slice(0, 10);
  try {
    const url = `https://api.frankfurter.dev/v1/${iso(start)}..${iso(end)}?base=${state.from}&symbols=${state.to}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    const dates = [];
    const rates = [];
    for (const d of Object.keys(j.rates || {}).sort()) {
      const v = j.rates[d]?.[state.to];
      if (isFinite(v)) { dates.push(d); rates.push(v); } // 日期与数值同步收录，保证坐标一一对应
    }
    if (rates.length < 2) throw new Error("trend too short");
    const rec = { dates, rates, fetchedAt: Date.now(), stale: false };
    state.trend = rec;
    cacheSet(cacheKey, rec);
    cacheSet(LS_KEYS.trend, { pair: `${state.from}:${state.to}`, range: state.range, rec });
  } catch (e) {
    const cached = cacheGet(cacheKey) || (cacheGet(LS_KEYS.trend) || {}).rec;
    state.trend = cached ? { ...cached, stale: true } : { failed: true };
  }
}

/* ---------- 重算编排 ---------- */
let latestSeq = 0;
async function refreshLatest() {
  const seq = ++latestSeq;
  renderConvert();
  await fetchLatest();
  if (seq !== latestSeq) return; // 用户已切换，丢弃过期结果
  renderFreshness(); renderConvert(); renderRateTable(); loadTrend();
}

let trendSeq = 0;
async function loadTrend() {
  const seq = ++trendSeq;
  state.trend = null;
  els.trendLoading.hidden = false;
  els.trendLoading.textContent = "趋势数据加载中…";
  renderTrend();
  await fetchTrend();
  if (seq !== trendSeq) return;
  renderFreshness(); renderTrend();
}

/* ---------- 事件绑定 ---------- */
function bindEvents() {
  els.amount.addEventListener("input", () => {
    const v = els.amount.value.replace(/[^\d.]/g, "");
    if (v !== els.amount.value) els.amount.value = v;
    state.amount = v || "0";
    renderConvert();
    savePrefs();
  });
  els.fromCurrency.addEventListener("change", () => {
    state.from = els.fromCurrency.value;
    savePrefs(); refreshLatest();
  });
  els.toCurrency.addEventListener("change", () => {
    state.to = els.toCurrency.value;
    savePrefs(); renderConvert(); renderRateTable(); loadTrend();
  });
  els.swapBtn.addEventListener("click", () => {
    [state.from, state.to] = [state.to, state.from];
    els.fromCurrency.value = state.from;
    els.toCurrency.value = state.to;
    savePrefs(); refreshLatest();
  });
  for (const btn of document.querySelectorAll(".range-tab")) {
    btn.addEventListener("click", () => {
      if (btn.classList.contains("is-active")) return;
      document.querySelectorAll(".range-tab").forEach((b) => {
        b.classList.toggle("is-active", b === btn);
        b.setAttribute("aria-selected", b === btn ? "true" : "false");
      });
      state.range = Number(btn.dataset.range);
      loadTrend();
    });
  }
}

function savePrefs() {
  cacheSet(LS_KEYS.prefs, { from: state.from, to: state.to, amount: state.amount });
}

/* ---------- 初始化 ---------- */
async function init() {
  Object.assign(els, {
    amount: $("amount"), fromCurrency: $("fromCurrency"), toCurrency: $("toCurrency"),
    swapBtn: $("swapBtn"), resultValue: $("resultValue"), resultRate: $("resultRate"),
    rateList: $("rateList"), tableCaption: $("tableCaption"),
    dataFreshness: $("dataFreshness"), staleBanner: $("staleBanner"),
    trendPair: $("trendPair"), trendChange: $("trendChange"),
    trendChart: $("trendChart"), trendLoading: $("trendLoading"), chartCaption: $("chartCaption"),
  });

  const prefs = cacheGet(LS_KEYS.prefs);
  if (prefs) {
    if (CURRENCIES.some((c) => c.code === prefs.from)) state.from = prefs.from;
    if (CURRENCIES.some((c) => c.code === prefs.to)) state.to = prefs.to;
    if (prefs.amount && isFinite(parseFloat(prefs.amount))) state.amount = prefs.amount;
  }
  els.amount.value = state.amount;
  fillCurrencySelects();
  bindEvents();
  renderConvert(); renderRateTable();
  await refreshLatest();
}

init();
