'use strict';
/* Macro Diary v1 — meal plan as the default day, swap anything, auto-scaled macros. */

const cfg = window.CONFIG || {};
const configured = cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes('YOUR-PROJECT');
const sb = configured ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;

const SLOTS = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'snack', label: 'Snacks & extras' },
];
const NUTR = ['kcal', 'protein', 'carbs', 'fat', 'fiber'];
const SHORT = { kcal: 'kcal', protein: 'Protein', carbs: 'Carbs', fat: 'Fat', fiber: 'Fiber' };

/* ---------- Starting data (generic per-100 g values — replace by scanning your own products) ---------- */
const SEED_PRODUCTS = [
  { key: 'bread',    name: 'Wholegrain bread',              kcal: 245, protein: 11,   carbs: 40,  fat: 3.5, fiber: 7,   piece_g: 40 },
  { key: 'egg',      name: 'Egg (medium)',                  kcal: 143, protein: 12.6, carbs: 0.7, fat: 9.5, fiber: 0,   piece_g: 50 },
  { key: 'avocado',  name: 'Avocado',                       kcal: 160, protein: 2,    carbs: 1.9, fat: 14.7, fiber: 6.7, piece_g: 140 },
  { key: 'tuna',     name: 'Tuna in brine (drained)',       kcal: 109, protein: 25,   carbs: 0,   fat: 1,   fiber: 0 },
  { key: 'onion',    name: 'Onion',                         kcal: 40,  protein: 1.1,  carbs: 7.6, fat: 0.1, fiber: 1.7 },
  { key: 'cottage',  name: 'Cottage cheese 0.5% fat',       kcal: 69,  protein: 12.5, carbs: 3.5, fat: 0.5, fiber: 0 },
  { key: 'rice',     name: 'White rice (dry)',              kcal: 357, protein: 7,    carbs: 79,  fat: 0.6, fiber: 1.3 },
  { key: 'chicken',  name: 'Ground chicken (Rimi)',         kcal: 120, protein: 20,   carbs: 0,   fat: 4.5, fiber: 0 },
  { key: 'oil',      name: 'Olive oil',                     kcal: 884, protein: 0,    carbs: 0,   fat: 100, fiber: 0,   piece_g: 13 },
  { key: 'chickpea', name: 'Chickpeas, canned (drained)',   kcal: 125, protein: 7,    carbs: 16,  fat: 2.6, fiber: 5 },
  { key: 'carrot',   name: 'Carrots',                       kcal: 41,  protein: 0.9,  carbs: 7,   fat: 0.2, fiber: 2.8 },
  { key: 'hotsauce', name: 'Hot sauce',                     kcal: 25,  protein: 0.5,  carbs: 5,   fat: 0.3, fiber: 0.5 },
  { key: 'potato',   name: 'Potato (raw)',                  kcal: 77,  protein: 2,    carbs: 15,  fat: 0.1, fiber: 2.2 },
  { key: 'tomato',   name: 'Cherry tomatoes',               kcal: 20,  protein: 0.9,  carbs: 3,   fat: 0.2, fiber: 1.2 },
  { key: 'beans',    name: 'Kidney beans, canned (drained)', kcal: 100, protein: 7,   carbs: 14,  fat: 0.5, fiber: 6 },
  { key: 'spinach',  name: 'Spinach',                       kcal: 23,  protein: 2.9,  carbs: 1.4, fat: 0.4, fiber: 2.2 },
];
const SEED_PLAN = [
  { slot: 'breakfast', name: 'Evan Breakfast Plate', items: [
    ['bread', 80], ['egg', 150], ['avocado', 70, true], ['tuna', 65], ['onion', 30], ['cottage', 90]] },
  { slot: 'lunch', name: 'Ground Chicken & Rice', items: [
    ['rice', 100], ['chicken', 200], ['oil', 13], ['chickpea', 25], ['carrot', 30], ['onion', 30], ['hotsauce', 10]] },
  { slot: 'dinner', name: 'Potato & Ground Chicken', items: [
    ['potato', 250], ['chicken', 200], ['oil', 13], ['egg', 50], ['tomato', 30], ['beans', 30], ['spinach', 30, true], ['cottage', 90]] },
];

/* ---------- State ---------- */
const S = {
  user: null, settings: null, products: [], meals: [], items: [],
  day: todayStr(), entries: [], burns: [], toggles: {},
  tab: 'today', libQuery: '', history: null, sheet: null, scanner: null, scanBusy: false,
};

/* ---------- Helpers ---------- */
const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
const has = (v) => v !== null && v !== undefined && String(v).trim() !== '';
const r0 = (n) => Math.round(n);
const r1 = (n) => Math.round(n * 10) / 10;
function pad(n) { return String(n).padStart(2, '0'); }
function dateStr(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function todayStr() { return dateStr(new Date()); }
function addDays(str, n) { const [y, m, d] = str.split('-').map(Number); return dateStr(new Date(y, m - 1, d + n)); }
function fmtDay(str) { const [y, m, d] = str.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }); }
function scale(p, g) { const o = {}; NUTR.forEach((k) => { o[k] = num(p && p[k]) * num(g) / 100; }); return o; }
function sum(list) { const o = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }; list.forEach((x) => NUTR.forEach((k) => { o[k] += num(x[k]); })); return o; }
function round1(o) { const r = {}; NUTR.forEach((k) => { r[k] = r1(o[k]); }); return r; }
const prod = (id) => S.products.find((p) => p.id === id);
const slotLabel = (k) => (SLOTS.find((s) => s.key === k) || {}).label || k;
const planItems = (mealId) => S.items.filter((i) => i.meal_id === mealId).sort((a, b) => a.sort - b.sort);
function amountLabel(p, g) {
  if (p && p.piece_g && Math.abs(num(g) / p.piece_g - Math.round(num(g) / p.piece_g)) < 0.05 && num(g) >= p.piece_g * 0.95) {
    const n = Math.round(num(g) / p.piece_g); return `${n} × ${r1(p.piece_g)} g · ${r1(num(g))} g`;
  }
  return `${r1(num(g))} g`;
}
function macroLine(m) { return `${r0(m.kcal)} kcal · P ${r1(m.protein)} · C ${r1(m.carbs)} · F ${r1(m.fat)} · Fib ${r1(m.fiber)}`; }
function previewHtml(m) { return NUTR.map((k) => `<div><b>${k === 'kcal' ? r0(m[k]) : r1(m[k])}</b>${SHORT[k]}</div>`).join(''); }
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600); }
async function q(promise) { const { data, error } = await promise; if (error) { toast(error.message); throw error; } return data; }
function itemOn(it) { if (!it.variable) return true; const k = `${S.day}:${it.id}`; return k in S.toggles ? S.toggles[k] : it.default_on; }
function entryFromProduct(p, grams, slot, source) {
  return { day: S.day, slot, product_id: p.id, name: p.name, grams: r1(num(grams)), ...round1(scale(p, grams)), source };
}

/* ---------- Auth & boot ---------- */
async function init() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  if (!configured) { $('#app').innerHTML = '<div class="pad">Add your Supabase URL and key in <b>config.js</b>, then reload.</div>'; return; }
  const { data: { session } } = await sb.auth.getSession();
  S.user = session ? session.user : null;
  sb.auth.onAuthStateChange((_e, s) => {
    const u = s ? s.user : null;
    if ((u && u.id) !== (S.user && S.user.id)) { S.user = u; u ? boot() : renderAuth(); }
  });
  S.user ? boot() : renderAuth();
}

function renderAuth() {
  $('#app').innerHTML = `<div class="wrap"><div class="card" style="margin-top:12vh">
    <h2 style="margin-bottom:4px">Macro Diary</h2><p class="muted small" style="margin-top:0">Sign in to your tracker.</p>
    <label class="f">Email<input id="a-email" type="email" autocomplete="email"></label>
    <label class="f" style="margin-top:10px">Password<input id="a-pass" type="password" autocomplete="current-password"></label>
    <div class="btns"><button class="primary" data-action="signin">Sign in</button><button data-action="signup">Create account</button></div>
  </div></div>`;
}

async function boot() {
  $('#app').innerHTML = '<div class="pad muted">Loading…</div>';
  try {
    await loadBase();
    if (!S.products.length && !S.meals.length) { await seed(); await loadBase(); }
    await loadDay();
    render();
  } catch (e) { $('#app').innerHTML = `<div class="pad">Couldn't load: ${esc(e.message || e)}</div>`; }
}

async function loadBase() {
  const [settings, products, meals, items] = await Promise.all([
    q(sb.from('settings').select('*').maybeSingle()),
    q(sb.from('products').select('*').order('name')),
    q(sb.from('plan_meals').select('*').order('sort')),
    q(sb.from('plan_items').select('*').order('sort')),
  ]);
  S.settings = settings || await q(sb.from('settings').insert({}).select().single());
  S.products = products; S.meals = meals; S.items = items;
}

async function loadDay() {
  const [entries, burns] = await Promise.all([
    q(sb.from('log_entries').select('*').eq('day', S.day).order('created_at')),
    q(sb.from('burn_entries').select('*').eq('day', S.day).order('created_at')),
  ]);
  S.entries = entries; S.burns = burns;
}

async function seed() {
  const rows = SEED_PRODUCTS.map(({ key, ...p }) => ({ ...p, source: 'generic' }));
  const inserted = await q(sb.from('products').insert(rows).select());
  const idByName = Object.fromEntries(inserted.map((p) => [p.name, p.id]));
  const idByKey = Object.fromEntries(SEED_PRODUCTS.map((p) => [p.key, idByName[p.name]]));
  for (let i = 0; i < SEED_PLAN.length; i++) {
    const m = SEED_PLAN[i];
    const meal = await q(sb.from('plan_meals').insert({ slot: m.slot, name: m.name, sort: i }).select().single());
    await q(sb.from('plan_items').insert(m.items.map(([key, grams, variable], j) => ({
      meal_id: meal.id, product_id: idByKey[key], grams, variable: !!variable, default_on: true, sort: j,
    }))));
  }
}

/* ---------- Main render ---------- */
function render() {
  const views = { today: viewToday, library: viewLibrary, history: viewHistory, settings: viewSettings };
  $('#app').innerHTML = `<div class="wrap">${views[S.tab]()}</div>
  <nav>${[['today', 'Today'], ['library', 'Products'], ['history', 'History'], ['settings', 'Settings']]
    .map(([k, l]) => `<button class="${S.tab === k ? 'on' : ''}" data-action="tab" data-tab="${k}">${l}</button>`).join('')}</nav>`;
  if (S.tab === 'history' && !S.history) loadHistory();
}

/* ---------- Today ---------- */
function viewToday() {
  const t = S.settings;
  const eaten = sum(S.entries);
  const burned = S.burns.reduce((a, b) => a + num(b.kcal), 0);
  const left = num(t.target_kcal) - eaten.kcal;
  const pct = (v, tg) => Math.min(100, tg ? (v / tg) * 100 : 0);
  const over = (v, tg) => tg && v > tg * 1.02;
  let status;
  if (has(t.maintenance_kcal)) {
    const net = num(t.maintenance_kcal) + burned - eaten.kcal;
    status = net >= 0
      ? `<div class="status good">Estimated deficit: <b>${r0(net)} kcal</b> <span class="muted small">(maintenance ${r0(num(t.maintenance_kcal))} + burned ${r0(burned)} − eaten ${r0(eaten.kcal)})</span></div>`
      : `<div class="status bad">Estimated surplus: <b>${r0(-net)} kcal</b></div>`;
  } else {
    status = left >= 0
      ? `<div class="status good">Within target · ${r0(left)} kcal left</div>`
      : `<div class="status bad">${r0(-left)} kcal over target</div>`;
  }
  const isToday = S.day === todayStr();
  return `
  <div class="top">
    <div class="datebar"><button data-action="day" data-d="-1">‹</button><h2>${isToday ? 'Today' : fmtDay(S.day)}</h2><button data-action="day" data-d="1">›</button></div>
    ${isToday ? `<span class="muted small">${fmtDay(S.day)}</span>` : '<button data-action="today">Today</button>'}
  </div>
  <section class="card">
    <div class="big"><b>${r0(eaten.kcal)}</b><span class="muted">/ ${r0(num(t.target_kcal))} kcal</span></div>
    <div class="bar"><i class="${over(eaten.kcal, num(t.target_kcal)) ? 'over' : ''}" style="width:${pct(eaten.kcal, num(t.target_kcal))}%"></i></div>
    <div class="macros">${['protein', 'carbs', 'fat', 'fiber'].map((k) => {
      const tg = num(t['target_' + k]);
      return `<div class="m">${SHORT[k]}<b>${r0(eaten[k])}<span class="muted"> / ${r0(tg)} g</span></b>
        <div class="bar"><i class="${k !== 'protein' && k !== 'fiber' && over(eaten[k], tg) ? 'over' : ''}" style="width:${pct(eaten[k], tg)}%"></i></div></div>`;
    }).join('')}</div>
    ${status}
  </section>
  ${SLOTS.map(mealCard).join('')}
  <section class="card">
    <div class="card-h"><h3>Burned</h3><span class="kc">${r0(burned)} kcal</span></div>
    ${S.burns.map((b) => `<div class="row"><span class="grow">${esc(b.activity)}</span><span class="kc">${r0(num(b.kcal))}</span>
      <button class="x" data-action="del-burn" data-id="${b.id}">✕</button></div>`).join('') || '<div class="muted small">No workouts logged</div>'}
    <div class="inline"><input id="b-act" placeholder="Workout / cardio"><input id="b-kcal" inputmode="numeric" placeholder="kcal"><button data-action="add-burn">Add</button></div>
  </section>`;
}

function mealCard(slot) {
  const entries = S.entries.filter((e) => e.slot === slot.key);
  const meal = S.meals.find((m) => m.slot === slot.key);
  let body;
  if (!entries.length && meal) {
    const items = planItems(meal.id);
    const rows = items.map((it) => {
      const p = prod(it.product_id) || {}; const on = itemOn(it); const m = scale(p, it.grams);
      const lead = it.variable ? `<input type="checkbox" data-change="toggle-item" data-id="${it.id}" ${on ? 'checked' : ''}>` : '<span class="dot"></span>';
      return `<label class="row ${on ? '' : 'off'}">${lead}<span class="grow">${esc(p.name || '?')}${it.variable ? ' <span class="muted small">(optional)</span>' : ''}<small>${amountLabel(p, it.grams)}</small></span><span class="kc">${r0(m.kcal)}</span></label>`;
    }).join('');
    const tot = sum(items.filter(itemOn).map((it) => scale(prod(it.product_id), it.grams)));
    body = `<div class="plan-tag">Plan · ${esc(meal.name)}</div>${rows}<div class="tot">${macroLine(tot)}</div>
      <div class="btns"><button class="primary" data-action="eat-plan" data-slot="${slot.key}">Eaten as planned</button>
      <button data-action="add" data-slot="${slot.key}">Log something else</button></div>`;
  } else {
    body = entries.map((e) => `<button class="row" data-action="edit-entry" data-id="${e.id}"><span class="grow">${esc(e.name)}<small>${has(e.grams) ? amountLabel(prod(e.product_id), e.grams) : 'quick add'} · P ${r1(num(e.protein))}</small></span><span class="kc">${r0(num(e.kcal))}</span></button>`).join('')
      || '<div class="muted small">Nothing logged</div>';
    body += `<div class="btns"><button data-action="add" data-slot="${slot.key}">+ Add food</button></div>`;
  }
  const tot = sum(entries);
  return `<section class="card"><div class="card-h"><h3>${slot.label}</h3>${entries.length ? `<span class="kc">${r0(tot.kcal)} kcal</span>` : ''}</div>${body}</section>`;
}

/* ---------- Products (library) ---------- */
function libList() {
  const qy = S.libQuery.trim().toLowerCase();
  const list = S.products.filter((p) => !qy || `${p.name} ${p.brand || ''} ${p.barcode || ''}`.toLowerCase().includes(qy));
  return list.map((p) => `<button class="row" data-action="open-product" data-id="${p.id}"><span class="grow">${esc(p.name)}${p.source === 'generic' ? '<span class="badge">generic</span>' : ''}
    <small>${esc(p.brand || '')}${p.brand ? ' · ' : ''}${r0(num(p.kcal))} kcal · P ${r1(num(p.protein))} · C ${r1(num(p.carbs))} · F ${r1(num(p.fat))} per 100 g</small></span>›</button>`).join('')
    || '<div class="muted small">No products</div>';
}
function viewLibrary() {
  const generic = S.products.filter((p) => p.source === 'generic').length;
  return `<div class="top"><h2>Products</h2><span class="muted small">${S.products.length} saved</span></div>
  ${generic ? `<div class="note">${generic} product${generic > 1 ? 's use' : ' uses'} generic values. Open one and tap <b>Scan</b> with your actual product to replace them.</div>` : ''}
  <div class="btns" style="margin:0 0 10px"><button class="primary" data-action="scan" data-mode="library">Scan barcode</button><button data-action="new-product">+ New product</button></div>
  <input data-lib placeholder="Search products" value="${esc(S.libQuery)}">
  <section class="card list" id="liblist" style="margin-top:10px">${libList()}</section>`;
}

/* ---------- History ---------- */
async function loadHistory() {
  const from = addDays(todayStr(), -29);
  try {
    const [ents, burns] = await Promise.all([
      q(sb.from('log_entries').select('day,kcal,protein,carbs,fat,fiber').gte('day', from).limit(5000)),
      q(sb.from('burn_entries').select('day,kcal').gte('day', from).limit(1000)),
    ]);
    const days = {};
    ents.forEach((e) => { (days[e.day] ||= { list: [], burn: 0 }).list.push(e); });
    burns.forEach((b) => { (days[b.day] ||= { list: [], burn: 0 }).burn += num(b.kcal); });
    S.history = days;
  } catch (e) { S.history = {}; }
  if (S.tab === 'history') render();
}
function viewHistory() {
  if (!S.history) return '<div class="top"><h2>History</h2></div><div class="muted">Loading…</div>';
  const t = S.settings; const tk = num(t.target_kcal); const maint = has(t.maintenance_kcal) ? num(t.maintenance_kcal) : null;
  const rows = []; const logged = [];
  for (let i = 0; i < 30; i++) {
    const d = addDays(todayStr(), -i); const h = S.history[d];
    if (!h || !h.list.length) { rows.push(`<button class="row" data-action="goto-day" data-d="${d}"><span class="grow">${fmtDay(d)}<small>not logged</small></span></button>`); continue; }
    const s = sum(h.list); logged.push({ d, s, burn: h.burn });
    let tag;
    if (maint !== null) { const net = maint + h.burn - s.kcal; tag = net >= 0 ? `<span style="color:var(--accent)">−${r0(net)}</span>` : `<span style="color:var(--bad)">+${r0(-net)}</span>`; }
    else tag = s.kcal <= tk ? '<span style="color:var(--accent)">✓</span>' : `<span style="color:var(--bad)">+${r0(s.kcal - tk)}</span>`;
    rows.push(`<button class="row hist-row" data-action="goto-day" data-d="${d}"><span>${fmtDay(d)}<small>P ${r0(s.protein)} · C ${r0(s.carbs)} · F ${r0(s.fat)}</small></span><span class="kc">${r0(s.kcal)} kcal</span>${tag}</button>`);
  }
  const week = logged.filter((x) => x.d > addDays(todayStr(), -7));
  let avg = '';
  if (week.length) {
    const a = sum(week.map((x) => x.s)); const n = week.length;
    const avgNet = maint !== null ? week.reduce((acc, x) => acc + maint + x.burn - x.s.kcal, 0) / n : null;
    avg = `<section class="card"><div class="card-h"><h3>Last 7 days</h3><span class="kc">${n} day${n > 1 ? 's' : ''} logged</span></div>
      <div class="big"><b>${r0(a.kcal / n)}</b><span class="muted">kcal/day avg · target ${r0(tk)}</span></div>
      <div class="muted small">Protein ${r0(a.protein / n)} g · Carbs ${r0(a.carbs / n)} g · Fat ${r0(a.fat / n)} g · Fiber ${r0(a.fiber / n)} g</div>
      ${avgNet !== null ? `<div class="status ${avgNet >= 0 ? 'good' : 'bad'}">Average ${avgNet >= 0 ? 'deficit' : 'surplus'}: ${r0(Math.abs(avgNet))} kcal/day</div>` : ''}</section>`;
  }
  return `<div class="top"><h2>History</h2><button data-action="refresh-history">Refresh</button></div>${avg}<section class="card list">${rows.join('')}</section>`;
}

/* ---------- Settings & plan editor ---------- */
function viewSettings() {
  const t = S.settings;
  const field = (k, label) => `<label class="f">${label}<input inputmode="decimal" data-setting="${k}" value="${has(t[k]) ? esc(t[k]) : ''}"></label>`;
  return `<div class="top"><h2>Settings</h2></div>
  <section class="card"><h3 style="margin-bottom:10px">Daily targets</h3>
    <div class="grid2">${field('target_kcal', 'Calories (kcal)')}${field('target_protein', 'Protein (g)')}${field('target_carbs', 'Carbs (g)')}${field('target_fat', 'Fat (g)')}${field('target_fiber', 'Fiber (g)')}${field('maintenance_kcal', 'Maintenance kcal (optional)')}</div>
    <p class="muted small">Maintenance = what you burn on a normal day without workouts. When set, the app shows your estimated deficit (maintenance + workouts − food).</p>
    <div class="btns"><button class="primary" data-action="save-settings">Save targets</button></div></section>
  <section class="card"><h3>Meal plan</h3><p class="muted small" style="margin-top:4px">This is your default day. Tick <b>optional</b> for ingredients you decide on each day.</p>
    ${S.meals.map((m) => {
      const its = planItems(m.id); const tot = sum(its.map((it) => scale(prod(it.product_id), it.grams)));
      return `<div style="margin-top:14px"><div class="plan-tag">${slotLabel(m.slot)}</div>
      <input class="meal-name" data-change="meal-name" data-id="${m.id}" value="${esc(m.name)}">
      ${its.map((it) => { const p = prod(it.product_id) || {}; return `<div class="row"><span class="grow">${esc(p.name || '?')}
        <label class="var-l"><input type="checkbox" data-change="plan-var" data-id="${it.id}" ${it.variable ? 'checked' : ''}> optional</label></span>
        <input class="grams-in" inputmode="decimal" data-change="plan-grams" data-id="${it.id}" value="${r1(num(it.grams))}"><span class="muted small">g</span>
        <button class="x" data-action="plan-del" data-id="${it.id}">✕</button></div>`; }).join('')}
      <div class="tot">All items: ${macroLine(tot)}</div>
      <div class="btns"><button data-action="plan-add" data-id="${m.id}">+ Add ingredient</button></div></div>`;
    }).join('')}
    <div class="tot" style="margin-top:12px">Full plan (all items on): ${macroLine(sum(S.items.map((it) => scale(prod(it.product_id), it.grams))))}</div>
  </section>
  <section class="card"><div class="muted small">Signed in as ${esc(S.user && S.user.email)}</div><div class="btns"><button data-action="signout">Sign out</button></div></section>`;
}

/* ---------- Sheets ---------- */
function openSheet(st) { S.sheet = st; renderSheet(); }
async function closeSheet() { await stopScanner(); S.sheet = null; $('#sheet-wrap').classList.add('hidden'); $('#sheet').innerHTML = ''; }
function renderSheet() {
  const st = S.sheet; if (!st) return;
  const fn = { add: sheetAdd, amount: sheetAmount, quick: sheetQuick, product: sheetProduct, scan: sheetScan }[st.type];
  $('#sheet').innerHTML = fn(st);
  $('#sheet-wrap').classList.remove('hidden');
  if (st.type === 'scan') startScanner();
  const af = $('#sheet [autofocus]'); if (af && st.type !== 'add') af.focus();
}
const head = (title) => `<div class="sheet-h"><h3>${title}</h3><button class="x" data-action="close">✕</button></div>`;

function pickList(st) {
  const qy = (st.query || '').trim().toLowerCase();
  const list = S.products.filter((p) => !qy || `${p.name} ${p.brand || ''}`.toLowerCase().includes(qy)).slice(0, 80);
  return list.map((p) => `<button class="row" data-action="pick" data-id="${p.id}"><span class="grow">${esc(p.name)}<small>${esc(p.brand || '')}${p.brand ? ' · ' : ''}${r0(num(p.kcal))} kcal · P ${r1(num(p.protein))} per 100 g</small></span>›</button>`).join('')
    || '<div class="muted small">No matches — scan it or add it as a new product.</div>';
}
function sheetAdd(st) {
  const title = st.tgt.kind === 'plan' ? 'Add ingredient to plan' : st.tgt.replaceId ? 'Replace with…' : `Add to ${slotLabel(st.tgt.slot)}`;
  return `${head(title)}
  <div class="btns" style="margin-top:0"><button class="primary" data-action="scan" data-mode="pick">Scan barcode</button>
  ${st.tgt.kind === 'log' ? '<button data-action="quick">Quick add</button>' : ''}<button data-action="new-product">New product</button></div>
  <input data-bind="query" placeholder="Search your products" value="${esc(st.query || '')}" style="margin-top:10px">
  <div class="list" id="plist">${pickList(st)}</div>`;
}

function sheetAmount(st) {
  const p = prod(st.productId);
  const label = st.entryId ? 'Save' : st.tgt.kind === 'plan' ? 'Add to plan' : st.tgt.replaceId ? 'Replace' : 'Add';
  return `${head(esc(p.name))}
  <div class="muted small">Per 100 g: ${macroLine(p)}</div>
  <div class="grid2" style="margin-top:12px">
    <label class="f">Grams<input inputmode="decimal" data-bind="grams" value="${esc(st.grams || '')}" autofocus></label>
    ${p.piece_g ? `<label class="f">Pieces (${r1(num(p.piece_g))} g each)<input inputmode="decimal" data-bind="pieces" value="${has(st.grams) ? r1(num(st.grams) / p.piece_g) : ''}"></label>` : ''}
  </div>
  <div class="preview" id="preview">${previewHtml(scale(p, st.grams))}</div>
  <div class="btns"><button class="primary" data-action="save-amount">${label}</button>
  ${st.entryId ? `<button data-action="replace" data-id="${st.entryId}">Replace</button><button class="danger" data-action="delete-entry" data-id="${st.entryId}">Delete</button>` : ''}</div>
  <button class="link" data-action="open-product" data-id="${p.id}">Edit product values</button>`;
}

function sheetQuick(st) {
  const f = st.f; const inp = (k, l, mode) => `<label class="f">${l}<input ${mode ? `inputmode="${mode}"` : ''} data-bind="f.${k}" value="${esc(f[k] ?? '')}"></label>`;
  return `${head(st.entryId ? 'Edit entry' : `Quick add · ${slotLabel(st.slot)}`)}
  <p class="muted small" style="margin-top:0">For things you can't weigh (eating out). A rough estimate beats skipping the day.</p>
  ${inp('name', 'What was it')}
  <div class="grid2" style="margin-top:10px">${inp('kcal', 'Calories', 'decimal')}${inp('protein', 'Protein g', 'decimal')}${inp('carbs', 'Carbs g', 'decimal')}${inp('fat', 'Fat g', 'decimal')}${inp('fiber', 'Fiber g', 'decimal')}</div>
  <div class="btns"><button class="primary" data-action="save-quick">Save</button>${st.entryId ? `<button class="danger" data-action="delete-entry" data-id="${st.entryId}">Delete</button>` : ''}</div>`;
}

function blankProduct(barcode) { return { name: '', brand: '', barcode: barcode || '', kcal: '', protein: '', carbs: '', fat: '', fiber: '', piece_g: '' }; }
function productSheetFor(p, then) {
  return { type: 'product', id: p.id, source: p.source, then: then || null, note: p.source === 'generic' ? 'Generic values. Tap Scan to fill this from your actual product, or type the numbers from its label.' : '',
    f: { name: p.name, brand: p.brand || '', barcode: p.barcode || '', kcal: p.kcal, protein: p.protein, carbs: p.carbs, fat: p.fat, fiber: p.fiber, piece_g: p.piece_g ?? '' } };
}
function sheetProduct(st) {
  const f = st.f; const inp = (k, l, mode) => `<label class="f">${l}<input ${mode ? `inputmode="${mode}"` : ''} data-bind="f.${k}" value="${esc(f[k] ?? '')}"></label>`;
  return `${head(st.id ? 'Edit product' : 'New product')}
  ${st.note ? `<div class="note">${esc(st.note)}</div>` : ''}
  ${inp('name', 'Name')}
  <div class="grid2" style="margin-top:10px">${inp('brand', 'Brand / store (optional)')}
    <label class="f">Barcode<div style="display:flex;gap:6px;margin-top:4px"><input inputmode="numeric" data-bind="f.barcode" value="${esc(f.barcode)}" style="margin:0"><button data-action="scan" data-mode="fill">Scan</button></div></label></div>
  <h3 style="margin:14px 0 8px;font-size:14px">Per 100 g (from the label)</h3>
  <div class="grid2">${inp('kcal', 'Calories (kcal)', 'decimal')}${inp('protein', 'Protein g', 'decimal')}${inp('carbs', 'Carbs g', 'decimal')}${inp('fat', 'Fat g', 'decimal')}${inp('fiber', 'Fiber g', 'decimal')}${inp('piece_g', 'One piece = g (optional)', 'decimal')}</div>
  <button class="link" data-action="calc-kcal">Calculate kcal from macros</button>
  <div class="btns"><button class="primary" data-action="save-product">Save product</button>${st.id ? `<button class="danger" data-action="delete-product">Delete</button>` : ''}</div>`;
}

function sheetScan(st) {
  return `${head('Scan barcode')}
  <div id="reader"></div>
  <p class="muted small">Point the camera at the barcode. Or type it:</p>
  <div class="inline" style="margin-top:0"><input id="manual-code" inputmode="numeric" placeholder="e.g. 4750001234567"><button data-action="manual-code">Look up</button></div>
  ${st.back ? '<button class="link" data-action="scan-back">← Back to product</button>' : ''}`;
}

/* ---------- Scanning & Open Food Facts ---------- */
async function startScanner() {
  S.scanBusy = false;
  try {
    const F = window.Html5QrcodeSupportedFormats;
    S.scanner = new window.Html5Qrcode('reader', { formatsToSupport: [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E], verbose: false });
    await S.scanner.start({ facingMode: 'environment' },
      { fps: 10, qrbox: (w, h) => ({ width: Math.floor(Math.min(w * 0.85, 320)), height: Math.floor(Math.min(h * 0.5, 140)) }) },
      (code) => onCode(code), () => {});
  } catch (e) {
    const r = $('#reader'); if (r) r.innerHTML = `<div class="pad muted small">Camera not available (${esc(e.message || e)}). Type the barcode below.</div>`;
  }
}
async function stopScanner() {
  const sc = S.scanner; S.scanner = null;
  if (sc) { try { if (sc.isScanning) await sc.stop(); sc.clear(); } catch (e) { /* ignore */ } }
}
async function onCode(code) {
  if (S.scanBusy || !S.sheet || S.sheet.type !== 'scan') return;
  S.scanBusy = true;
  if (navigator.vibrate) navigator.vibrate(60);
  const st = S.sheet; await stopScanner(); await handleBarcode(String(code).trim(), st);
}

async function fetchOFF(code) {
  try {
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,product_name_en,brands,nutriments`);
    if (!r.ok) return null;
    const j = await r.json(); if (j.status !== 1 || !j.product) return null;
    const n = j.product.nutriments || {};
    let kcal = n['energy-kcal_100g']; if (kcal == null && n.energy_100g != null) kcal = n.energy_100g / 4.184;
    return { name: j.product.product_name_en || j.product.product_name || '', brand: (j.product.brands || '').split(',')[0].trim(),
      kcal, protein: n.proteins_100g, carbs: n.carbohydrates_100g, fat: n.fat_100g, fiber: n.fiber_100g };
  } catch (e) { return null; }
}
function applyOff(ps, off) {
  if (off.name && (!ps.f.name || ps.source === 'generic')) ps.f.name = off.name;
  if (off.brand && !ps.f.brand) ps.f.brand = off.brand;
  const missing = [];
  NUTR.forEach((k) => { if (off[k] != null && off[k] !== '') ps.f[k] = r1(num(off[k])); else missing.push(SHORT[k]); });
  ps.source = 'openfoodfacts';
  ps.note = 'Found on Open Food Facts — check it against the label and fix anything that looks off.' + (missing.length ? ` Missing: ${missing.join(', ')}.` : '');
}

async function handleBarcode(code, st) {
  if (!code) return;
  if (st.mode === 'fill') {
    const back = st.back; back.f.barcode = code;
    const clash = S.products.find((p) => p.barcode === code && p.id !== back.id);
    if (clash) { back.note = `That barcode is already saved as "${clash.name}".`; openSheet(back); return; }
    toast('Looking up…');
    const off = await fetchOFF(code);
    if (off) applyOff(back, off); else back.note = 'Not on Open Food Facts — type the values from the label (per 100 g). Barcode saved, so next scan finds it.';
    openSheet(back); return;
  }
  const local = S.products.find((p) => p.barcode === code);
  if (local) {
    if (st.mode === 'pick') openSheet({ type: 'amount', productId: local.id, tgt: st.tgt, grams: '' });
    else openSheet(productSheetFor(local));
    return;
  }
  toast('Looking up…');
  const off = await fetchOFF(code);
  const ps = { type: 'product', id: null, f: blankProduct(code), source: 'label', then: st.mode === 'pick' ? st.tgt : null, note: '' };
  if (off) applyOff(ps, off);
  else ps.note = 'Not found in any database. Type the values from the label (per 100 g) — you only do this once per product.';
  openSheet(ps);
}

/* ---------- Actions ---------- */
async function reloadDay() { await loadDay(); S.history = null; render(); }

const actions = {
  async signin() {
    const email = $('#a-email').value.trim(), password = $('#a-pass').value;
    const { error } = await sb.auth.signInWithPassword({ email, password }); if (error) toast(error.message);
  },
  async signup() {
    const email = $('#a-email').value.trim(), password = $('#a-pass').value;
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) toast(error.message); else if (!data.session) toast('Check your email to confirm, then sign in.');
  },
  async signout() { await sb.auth.signOut(); },
  tab(el) { S.tab = el.dataset.tab; render(); window.scrollTo(0, 0); },
  async day(el) { S.day = addDays(S.day, +el.dataset.d); await loadDay(); render(); },
  async today() { S.day = todayStr(); await loadDay(); render(); },
  async 'goto-day'(el) { S.day = el.dataset.d; S.tab = 'today'; await loadDay(); render(); window.scrollTo(0, 0); },
  'refresh-history'() { S.history = null; render(); },

  async 'eat-plan'(el) {
    const slot = el.dataset.slot; const meal = S.meals.find((m) => m.slot === slot);
    const rows = planItems(meal.id).filter(itemOn).map((it) => entryFromProduct(prod(it.product_id), it.grams, slot, 'plan'));
    if (!rows.length) return;
    await q(sb.from('log_entries').insert(rows)); await reloadDay();
    toast('Logged. Tap any item to change grams or replace it.');
  },
  add(el) { openSheet({ type: 'add', tgt: { kind: 'log', slot: el.dataset.slot }, query: '' }); },
  'edit-entry'(el) {
    const e = S.entries.find((x) => x.id === el.dataset.id); if (!e) return;
    const p = prod(e.product_id);
    if (p && has(e.grams)) openSheet({ type: 'amount', productId: p.id, tgt: { kind: 'log', slot: e.slot }, grams: String(e.grams), entryId: e.id });
    else openSheet({ type: 'quick', slot: e.slot, entryId: e.id, f: { name: e.name, kcal: e.kcal, protein: e.protein, carbs: e.carbs, fat: e.fat, fiber: e.fiber } });
  },
  replace(el) {
    const e = S.entries.find((x) => x.id === el.dataset.id);
    openSheet({ type: 'add', tgt: { kind: 'log', slot: e.slot, replaceId: e.id }, query: '' });
  },
  async 'delete-entry'(el) {
    await q(sb.from('log_entries').delete().eq('id', el.dataset.id)); await closeSheet(); await reloadDay();
  },
  pick(el) { const st = S.sheet; openSheet({ type: 'amount', productId: el.dataset.id, tgt: st.tgt, grams: '' }); },
  quick() { const st = S.sheet; openSheet({ type: 'quick', slot: st.tgt.slot, f: { name: '', kcal: '', protein: '', carbs: '', fat: '', fiber: '' } }); },

  async 'save-amount'() {
    const st = S.sheet; const g = num(st.grams);
    if (g <= 0) { toast('Enter the weight in grams'); return; }
    const p = prod(st.productId);
    if (st.entryId) {
      const e = S.entries.find((x) => x.id === st.entryId);
      const { day, ...upd } = entryFromProduct(p, g, e.slot, e.source);
      await q(sb.from('log_entries').update(upd).eq('id', st.entryId));
    } else if (st.tgt.kind === 'plan') {
      await q(sb.from('plan_items').insert({ meal_id: st.tgt.mealId, product_id: p.id, grams: r1(g), sort: planItems(st.tgt.mealId).length }));
      await closeSheet(); await loadBase(); render(); return;
    } else {
      await q(sb.from('log_entries').insert(entryFromProduct(p, g, st.tgt.slot, 'manual')));
      if (st.tgt.replaceId) await q(sb.from('log_entries').delete().eq('id', st.tgt.replaceId));
    }
    await closeSheet(); await reloadDay();
  },
  async 'save-quick'() {
    const st = S.sheet; const f = st.f;
    if (!has(f.name) || !has(f.kcal)) { toast('Add a name and calories'); return; }
    const row = { name: String(f.name).trim(), grams: null, product_id: null, source: 'quick', ...round1({ kcal: num(f.kcal), protein: num(f.protein), carbs: num(f.carbs), fat: num(f.fat), fiber: num(f.fiber) }) };
    if (st.entryId) await q(sb.from('log_entries').update(row).eq('id', st.entryId));
    else await q(sb.from('log_entries').insert({ ...row, day: S.day, slot: st.slot }));
    await closeSheet(); await reloadDay();
  },

  scan(el) {
    const mode = el.dataset.mode; const cur = S.sheet;
    if (mode === 'fill') openSheet({ type: 'scan', mode, back: cur });
    else openSheet({ type: 'scan', mode, tgt: cur && cur.tgt });
  },
  async 'manual-code'() { const st = S.sheet; const code = $('#manual-code').value.trim(); if (!code) return; await stopScanner(); await handleBarcode(code, st); },
  async 'scan-back'() { const back = S.sheet.back; await stopScanner(); openSheet(back); },

  'new-product'() { const cur = S.sheet; openSheet({ type: 'product', id: null, f: blankProduct(''), source: 'manual', then: cur && cur.tgt ? cur.tgt : null, note: '' }); },
  'open-product'(el) { const p = prod(el.dataset.id); if (p) openSheet(productSheetFor(p)); },
  'calc-kcal'() {
    const f = S.sheet.f; f.kcal = r0(num(f.protein) * 4 + num(f.carbs) * 4 + num(f.fat) * 9 + num(f.fiber) * 2);
    const i = $('[data-bind="f.kcal"]'); if (i) i.value = f.kcal;
  },
  async 'save-product'() {
    const st = S.sheet; const f = st.f;
    if (!has(f.name)) { toast('Give the product a name'); return; }
    const row = { name: String(f.name).trim(), brand: has(f.brand) ? String(f.brand).trim() : null, barcode: has(f.barcode) ? String(f.barcode).trim() : null,
      kcal: num(f.kcal), protein: num(f.protein), carbs: num(f.carbs), fat: num(f.fat), fiber: num(f.fiber), piece_g: has(f.piece_g) && num(f.piece_g) > 0 ? num(f.piece_g) : null };
    if (row.barcode) { const clash = S.products.find((p) => p.barcode === row.barcode && p.id !== st.id); if (clash) { toast(`Barcode already saved as "${clash.name}"`); return; } }
    let source = st.source || 'manual';
    if (source === 'generic' && st.id) {
      const old = prod(st.id); if (['kcal', 'protein', 'carbs', 'fat', 'fiber'].some((k) => num(old[k]) !== row[k]) || row.barcode) source = 'label';
    }
    row.source = source; row.updated_at = new Date().toISOString();
    let saved;
    if (st.id) saved = await q(sb.from('products').update(row).eq('id', st.id).select().single());
    else saved = await q(sb.from('products').insert(row).select().single());
    S.products = S.products.filter((p) => p.id !== saved.id).concat(saved).sort((a, b) => a.name.localeCompare(b.name));
    toast('Product saved');
    if (st.then) { openSheet({ type: 'amount', productId: saved.id, tgt: st.then, grams: '' }); return; }
    await closeSheet(); render();
  },
  async 'delete-product'() {
    const st = S.sheet;
    if (S.items.some((i) => i.product_id === st.id)) { toast('This is in your meal plan — remove it there first (Settings).'); return; }
    if (!confirm('Delete this product? Past diary entries keep their numbers.')) return;
    await q(sb.from('products').delete().eq('id', st.id));
    S.products = S.products.filter((p) => p.id !== st.id); await closeSheet(); render();
  },
  close() { closeSheet(); },

  async 'add-burn'() {
    const act = $('#b-act').value.trim(); const kcal = num($('#b-kcal').value);
    if (!act || kcal <= 0) { toast('Add the activity and calories burned'); return; }
    await q(sb.from('burn_entries').insert({ day: S.day, activity: act, kcal })); await reloadDay();
  },
  async 'del-burn'(el) { await q(sb.from('burn_entries').delete().eq('id', el.dataset.id)); await reloadDay(); },

  async 'save-settings'() {
    const upd = {};
    document.querySelectorAll('[data-setting]').forEach((i) => { const k = i.dataset.setting; upd[k] = has(i.value) ? num(i.value) : (k === 'maintenance_kcal' ? null : 0); });
    S.settings = await q(sb.from('settings').update(upd).eq('user_id', S.user.id).select().single());
    S.history = null; toast('Targets saved'); render();
  },
  'plan-add'(el) { openSheet({ type: 'add', tgt: { kind: 'plan', mealId: el.dataset.id }, query: '' }); },
  async 'plan-del'(el) { await q(sb.from('plan_items').delete().eq('id', el.dataset.id)); S.items = S.items.filter((i) => i.id !== el.dataset.id); render(); },
};

const changes = {
  'toggle-item'(el) { S.toggles[`${S.day}:${el.dataset.id}`] = el.checked; render(); },
  async 'meal-name'(el) { const name = el.value.trim(); if (!name) return; await q(sb.from('plan_meals').update({ name }).eq('id', el.dataset.id)); S.meals.find((m) => m.id === el.dataset.id).name = name; toast('Saved'); },
  async 'plan-grams'(el) { const g = num(el.value); if (g <= 0) return; await q(sb.from('plan_items').update({ grams: g }).eq('id', el.dataset.id)); S.items.find((i) => i.id === el.dataset.id).grams = g; render(); },
  async 'plan-var'(el) { await q(sb.from('plan_items').update({ variable: el.checked }).eq('id', el.dataset.id)); S.items.find((i) => i.id === el.dataset.id).variable = el.checked; render(); },
};

/* ---------- Events ---------- */
document.addEventListener('click', async (e) => {
  if (e.target.id === 'sheet-wrap') { closeSheet(); return; }
  const el = e.target.closest('[data-action]'); if (!el) return;
  const fn = actions[el.dataset.action]; if (!fn) return;
  if (el.tagName === 'BUTTON') { if (el.disabled) return; el.disabled = true; }
  try { await fn(el); } catch (err) { console.error(err); } finally { if (document.contains(el)) el.disabled = false; }
});
document.addEventListener('change', async (e) => {
  const el = e.target; const fn = changes[el.dataset.change]; if (!fn) return;
  try { await fn(el); } catch (err) { console.error(err); }
});
document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.hasAttribute('data-lib')) { S.libQuery = el.value; $('#liblist').innerHTML = libList(); return; }
  const b = el.dataset.bind; const st = S.sheet; if (!b || !st) return;
  if (b === 'query') { st.query = el.value; $('#plist').innerHTML = pickList(st); return; }
  if (b === 'grams' || b === 'pieces') {
    const p = prod(st.productId);
    if (b === 'grams') { st.grams = el.value; const pc = $('[data-bind="pieces"]'); if (pc && p.piece_g) pc.value = has(el.value) ? r1(num(el.value) / p.piece_g) : ''; }
    else { st.grams = has(el.value) ? String(r1(num(el.value) * p.piece_g)) : ''; const g = $('[data-bind="grams"]'); if (g) g.value = st.grams; }
    $('#preview').innerHTML = previewHtml(scale(p, st.grams)); return;
  }
  if (b.startsWith('f.')) st.f[b.slice(2)] = el.value;
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  if (e.target.id === 'a-pass') actions.signin();
  if (e.target.id === 'manual-code') actions['manual-code']();
});

init();
