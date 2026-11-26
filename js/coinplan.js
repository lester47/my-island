// 🗺️ 線上鯉魚幣行程規劃：每天 200 枚可以玩什麼？選套餐，或自己一項一項排
// 價錢和每天次數都從 content.json 的 economy 讀，老師改價錢這裡會自動跟著變；套餐寫在 economy.plans。
// 規劃只存在這台裝置（不會扣錢，也不會寫到伺服器）。

const NIGHT = new Set(['fireworkShow', 'droneShow', 'firework']);
const ITEMS = [
  // [價目表的 key, 圖示, 名稱, 分組]
  ['coaster', '🎢', '雲霄飛車', 'ride'],
  ['balloon', '🎈', '彩虹熱氣球', 'ride'],
  ['boat', '⛵', '鯉魚號', 'ride'],
  ['duck', '🦆', '鴨子船（腳踏）', 'ride'],
  ['bike', '🚲', '借腳踏車', 'ride'],
  ['cat', '🐾', '擼貓（抽號碼牌）', 'cat'],
  ['firework', '🎆', '放煙火（一發）', 'sky'],
  ['fireworkShow', '🎇', '連發煙火秀', 'sky'],
  ['drone', '🚁', '遙控無人機', 'sky'],
  ['droneShow', '✨', '無人機燈光秀', 'sky'],
];
const GROUPS = [['ride', '🎡 設施'], ['cat', '🐾 擼貓'], ['game', '🎮 攤位線上小遊戲'], ['sky', '🌙 天空表演']];
const SOFT_MAX = 20;   // 不限次數的項目，規劃時最多排 20 次

/** 列出所有可以花線上鯉魚幣的項目（含每一款攤位小遊戲） */
export function catalog(C) {
  const E = C.economy, P = E.prices, L = E.limits || {}, nCats = (C.cats || []).length || 1;
  const out = ITEMS.filter(([k]) => P[k] != null).map(([k, icon, name, grp]) => {
    const max = k === 'cat' ? (L.cat || 2) * nCats : L[k] || 0;
    const lim = k === 'cat' ? `每隻貓每天 ${L.cat || 2} 次，共 ${nCats} 隻` : max ? `每天最多 ${max} 次` : '不限次數';
    return { k, icon, name, grp, price: P[k], max: max || SOFT_MAX, lim, night: NIGHT.has(k) };
  });
  for (const st of C.stalls || []) {
    const g = st.game;
    if (!g || !g.ready || g.stamp === false) continue;            // 創作小工具免費，不用規劃
    out.push({ k: 'g' + st.no, no: st.no, icon: '🎮', name: g.short || g.title, sub: `第 ${String(st.no).padStart(2, '0')} 攤`, grp: 'game', price: P.game, max: L.game || 3, lim: `每款每天 ${L.game || 3} 局` });
  }
  return out;
}
export const byKey = (cat) => Object.fromEntries(cat.map((x) => [x.k, x]));
/** 只留目錄裡有的項目、次數夾在 0～上限之間 */
export function clean(cat, sel) {
  const out = {}; sel = sel || {};
  for (const it of cat) { const v = Math.floor(+sel[it.k] || 0); if (v > 0) out[it.k] = Math.min(v, it.max); }   // 照目錄順序排
  return out;
}
export const cost = (cat, sel) => { const M = byKey(cat); return Object.entries(sel).reduce((s, [k, n]) => s + (M[k] ? M[k].price * n : 0), 0); };
export const count = (sel) => Object.values(sel).reduce((s, n) => s + n, 0);

/** 隨機幫忙排：每樣先排一次，再隨機加，盡量把預算用完 */
export function randomPlan(cat, budget, rnd = Math.random) {
  const sel = {}; let left = budget;
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const fits = (it) => it.price <= left && (sel[it.k] || 0) < it.max;
  // 第一輪：從每個分組挑一樣，讓行程有變化
  for (const [g] of GROUPS) {
    const pool = cat.filter((it) => it.grp === g && fits(it)); if (!pool.length) continue;
    const it = pick(pool); sel[it.k] = (sel[it.k] || 0) + 1; left -= it.price;
  }
  for (let guard = 0; guard < 400 && left > 0; guard++) {
    const pool = cat.filter((it) => fits(it) && (it.max < SOFT_MAX || (sel[it.k] || 0) < 3)); if (!pool.length) break;
    const it = pick(pool); sel[it.k] = (sel[it.k] || 0) + 1; left -= it.price;
  }
  return sel;
}

/** 介面。ctx 由 main.js 傳進來，裡面是共用的小工具和「前往」的動作 */
export function createCoinPlan(ctx) {
  const { C, $, esc, store, toast, openDlg, wallet, go, today } = ctx;
  const KEY = 'coinplan';
  const E = () => C.economy;
  let tab = 'pkg', draft = null;
  const cat = () => catalog(C);
  const load = () => {
    const p = store.get(KEY, null) || {};
    const s = { budget: +p.budget || E().start, items: p.items || {}, src: p.src || '', done: p.done || {}, day: p.day || '' };
    if (s.day !== today()) { s.done = {}; s.day = today(); }    // 鯉魚幣每天重新發，打勾也每天重來
    s.items = clean(cat(), s.items);
    return s;
  };
  const save = (s) => store.set(KEY, s);
  const plans = () => (E().plans || []).map((p) => ({ ...p, items: clean(cat(), p.items) })).filter((p) => count(p.items));
  const chips = (sel) => { const M = byKey(cat()); return Object.entries(sel).map(([k, n]) => `<span class="cp-chip">${M[k].icon} ${esc(M[k].sub ? M[k].name : M[k].name.replace(/（.*）/, ''))}${n > 1 ? `<b>×${n}</b>` : ''}</span>`).join(''); };
  const balNow = () => { const W = wallet(); return W && !W.test ? W.bal() : null; };

  function bar(spend, budget) {
    const left = budget - spend, pct = Math.min(100, Math.round((spend / Math.max(1, budget)) * 100));
    return `<div class="cp-bar ${left < 0 ? 'over' : ''}"><div class="cp-bar-t"><b>預計花 ${spend} 枚</b><span>${left < 0 ? `超過 ${-left} 枚` : `還剩 ${left} 枚`}</span></div>
      <div class="cp-meter" role="meter" aria-valuemin="0" aria-valuemax="${budget}" aria-valuenow="${spend}" aria-label="已排進行程的鯉魚幣"><i style="width:${pct}%"></i></div></div>`;
  }
  function budgetHTML(s) {
    const b = balNow(), opts = [[E().start, `每天發的 ${E().start} 枚`]];
    if (b != null && b !== E().start) opts.push([b, `我現在有 ${b} 枚`]);
    return `<div class="cp-budget"><span>預算</span>${opts.map(([v, l]) => `<button type="button" class="cp-pill ${s.budget === v ? 'on' : ''}" data-cp-budget="${v}" aria-pressed="${s.budget === v}">${esc(l)}</button>`).join('')}</div>`;
  }

  function pkgHTML(s) {
    const list = plans();
    if (!list.length) return '<p class="foot">老師還沒有設定套餐，先用「自己排」吧！</p>';
    return `<p class="cp-lead">每個套餐都剛好用 ${E().start} 枚左右，挑一個喜歡的，或按「改一改」再自己調。</p>
      <div class="cp-pkgs">${list.map((p) => { const c = cost(cat(), p.items), over = c > s.budget, mine = s.src === p.id;
        return `<article class="cp-pkg ${mine ? 'mine' : ''}"><div class="cp-pkg-hd"><span class="cp-ic" aria-hidden="true">${esc(p.icon || '🎟️')}</span><div><h3>${esc(p.name)}</h3><small>${esc(p.desc || '')}</small></div><b class="cp-price ${over ? 'over' : ''}">${c} 枚</b></div>
          <div class="cp-chips">${chips(p.items)}</div>${p.tip ? `<p class="cp-tip">💡 ${esc(p.tip)}</p>` : ''}${over ? `<p class="cp-tip why">⚠ 比你的預算多 ${c - s.budget} 枚，可以按「改一改」刪掉一些</p>` : ''}
          <div class="cp-acts"><button type="button" class="btn" data-cp-pick="${esc(p.id)}">${mine ? '✅ 已選這個' : '選這個套餐'}</button><button type="button" class="btn ghost" data-cp-edit="${esc(p.id)}">✏️ 改一改</button></div></article>`; }).join('')}</div>`;
  }

  function customHTML(s) {
    const sel = draft, items = cat(), spend = cost(items, sel), left = s.budget - spend;
    const row = (it) => { const n = sel[it.k] || 0, canAdd = n < it.max && it.price <= left;
      return `<li class="cp-row ${n ? 'on' : ''}"><span class="cp-ic" aria-hidden="true">${it.icon}</span><div class="cp-main"><b>${esc(it.name)}</b><small>${it.sub ? `${esc(it.sub)}・` : ''}${it.price} 枚・${esc(it.lim)}</small></div>
        <div class="cp-step"><button type="button" data-cp-n="${it.k}" data-d="-1" ${n ? '' : 'disabled'} aria-label="${esc(it.name)}少一次">−</button><b aria-live="polite">${n}</b><button type="button" data-cp-n="${it.k}" data-d="1" ${canAdd ? '' : 'disabled'} aria-label="${esc(it.name)}多一次">＋</button></div></li>`; };
    return `${bar(spend, s.budget)}
      ${GROUPS.map(([g, t]) => { const rs = items.filter((it) => it.grp === g); return rs.length ? `<h3 class="cp-h">${t}</h3><ul class="cp-rows">${rs.map(row).join('')}</ul>` : ''; }).join('')}
      <p class="foot">🆓 逛島、看攤位、集章、跟居民交換、畫貼紙／鑽石畫／聖誕樹都免費，不用排進預算。</p>
      <div class="cp-acts sticky"><button type="button" class="btn ghost" id="cpClear">🧹 清空</button><button type="button" class="btn ghost" id="cpRand">🎲 隨機幫我排</button><button type="button" class="btn" id="cpSave" ${count(sel) ? '' : 'disabled'}>💾 存成我的行程</button></div>`;
  }

  function mineHTML(s) {
    const items = cat(), M = byKey(items), keys = Object.keys(s.items);
    if (!keys.length) return `<p class="cp-lead">還沒有行程。到「🍱 套餐」挑一個，或到「✏️ 自己排」安排看看！</p><div class="cp-acts"><button type="button" class="btn" data-cp-tab="pkg">🍱 看套餐</button><button type="button" class="btn ghost" data-cp-tab="custom">✏️ 自己排</button></div>`;
    const tot = count(s.items), did = keys.reduce((a, k) => a + Math.min(s.done[k] || 0, s.items[k]), 0);
    const paid = keys.reduce((a, k) => a + Math.min(s.done[k] || 0, s.items[k]) * M[k].price, 0), spend = cost(items, s.items);
    const src = plans().find((p) => p.id === s.src);
    const night = keys.some((k) => M[k].night);
    return `<div class="cp-sum"><div><b>${did}/${tot}</b><small>玩過</small></div><div><b>${paid}</b><small>已花（枚）</small></div><div><b>${spend - paid}</b><small>還要花（枚）</small></div></div>
      ${src ? `<p class="cp-lead">${esc(src.icon || '')} ${esc(src.name)}</p>` : ''}
      <ol class="cp-todo">${keys.map((k) => { const it = M[k], n = s.items[k], d = Math.min(s.done[k] || 0, n);
        return `<li class="${d >= n ? 'done' : ''}"><span class="cp-ic" aria-hidden="true">${it.icon}</span><div class="cp-main"><b>${esc(it.name)}${n > 1 ? ` ×${n}` : ''}</b><small>${it.sub ? `${esc(it.sub)}・` : ''}${it.price * n} 枚</small>
          <span class="cp-ticks">${Array.from({ length: n }, (_, i) => `<button type="button" class="${i < d ? 'on' : ''}" data-cp-tick="${k}" data-i="${i}" aria-pressed="${i < d}" aria-label="${esc(it.name)}第 ${i + 1} 次${i < d ? '（玩過了）' : ''}">${i < d ? '✓' : i + 1}</button>`).join('')}</span></div>
          <button type="button" class="btn ghost cp-go" data-cp-go="${k}">前往</button></li>`; }).join('')}</ol>
      ${did >= tot ? '<p class="cp-yay">🎉 行程全部完成！還有錢的話，去打工或再排一輪吧</p>' : ''}
      ${night ? '<p class="foot">🌙 煙火和燈光秀晚上看最漂亮：點左上角的時鐘可以切成晚上。</p>' : ''}
      <p class="foot">玩完一次就點一下圓圈打勾（只是幫你記，不會扣錢；真正付錢時還是會再問你一次）。打勾每天重來。</p>
      <div class="cp-acts"><button type="button" class="btn ghost" data-cp-edit="__mine">✏️ 修改</button><button type="button" class="btn ghost" id="cpCopy">📋 複製分享</button><button type="button" class="btn ghost" id="cpDrop">🗑️ 刪掉行程</button></div>`;
  }

  function render() {
    const s = load(), body = $('#cpBody'); if (!body) return;
    if (!draft) draft = { ...s.items };
    const n = count(s.items);
    const tabs = [['pkg', '🍱 套餐'], ['custom', '✏️ 自己排'], ['mine', `📋 我的行程${n ? ` (${n})` : ''}`]];
    body.innerHTML = `<div class="cp-tabs" role="tablist">${tabs.map(([k, t]) => `<button type="button" role="tab" aria-selected="${tab === k}" class="${tab === k ? 'on' : ''}" data-cp-tab="${k}">${t}</button>`).join('')}</div>
      ${tab !== 'mine' ? budgetHTML(s) : ''}
      <div role="tabpanel">${tab === 'pkg' ? pkgHTML(s) : tab === 'custom' ? customHTML(s) : mineHTML(s)}</div>`;
  }
  function setItems(items, src, msg) {
    const s = load(); s.items = clean(cat(), items); s.src = src || ''; s.done = {}; save(s); draft = { ...s.items }; tab = 'mine'; render(); if (msg) toast(msg);
  }
  function copyText() {
    const s = load(), M = byKey(cat());
    const lines = Object.entries(s.items).map(([k, n]) => `・${M[k].icon} ${M[k].sub ? `${M[k].sub} ` : ''}${M[k].name}${n > 1 ? ` ×${n}` : ''}（${M[k].price * n} 枚）`);
    return `我的 115 鯉魚市集線上行程（${cost(cat(), s.items)}／${s.budget} 枚）\n${lines.join('\n')}`;
  }

  function onClick(e) {
    const t = e.target instanceof Element ? e.target : null; if (!t) return;
    const q = (sel) => t.closest(sel);
    let b;
    if ((b = q('[data-cp-tab]'))) { tab = b.dataset.cpTab; if (tab === 'custom' && !draft) draft = { ...load().items }; render(); return; }
    if ((b = q('[data-cp-budget]'))) { const s = load(); s.budget = +b.dataset.cpBudget; save(s); render(); return; }
    if ((b = q('[data-cp-pick]'))) { const p = plans().find((x) => x.id === b.dataset.cpPick); if (p) setItems(p.items, p.id, `${p.icon || '🎟️'} 選好了：${p.name}`); return; }
    if ((b = q('[data-cp-edit]'))) { const id = b.dataset.cpEdit, p = plans().find((x) => x.id === id); draft = { ...(p ? p.items : load().items) }; tab = 'custom'; render(); return; }
    if ((b = q('[data-cp-n]'))) {
      const s = load(), it = byKey(cat())[b.dataset.cpN]; if (!it) return;
      const n = (draft[it.k] || 0) + +b.dataset.d;
      if (+b.dataset.d > 0 && cost(cat(), draft) + it.price > s.budget) { toast('超過預算了，先刪掉別的吧'); return; }
      if (n <= 0) delete draft[it.k]; else draft[it.k] = Math.min(n, it.max);
      render(); const again = $(`#cpBody [data-cp-n="${it.k}"][data-d="${b.dataset.d}"]`); if (again && !again.disabled) again.focus(); return;
    }
    if (q('#cpClear')) { draft = {}; render(); return; }
    if (q('#cpRand')) { draft = randomPlan(cat(), load().budget); render(); toast('🎲 排好了！不喜歡就再按一次'); return; }
    if (q('#cpSave')) { const src = plans().find((p) => JSON.stringify(clean(cat(), p.items)) === JSON.stringify(clean(cat(), draft))); setItems(draft, src ? src.id : '', '💾 行程存好了，玩完一次就打個勾'); return; }
    if ((b = q('[data-cp-tick]'))) { const s = load(), k = b.dataset.cpTick, i = +b.dataset.i, d = s.done[k] || 0; s.done[k] = i < d ? i : i + 1; save(s); render(); return; }
    if ((b = q('[data-cp-go]'))) { const k = b.dataset.cpGo, it = byKey(cat())[k]; if (it) go(it); return; }
    if (q('#cpDrop')) { if (!confirm('確定要刪掉這個行程嗎？')) return; const s = load(); s.items = {}; s.src = ''; s.done = {}; save(s); draft = {}; render(); return; }
    if (q('#cpCopy')) { const txt = copyText(); (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast('📋 已複製，可以貼給同學'), () => toast('這台裝置不能自動複製，請截圖分享')); }
  }
  let bound = false;
  return {
    open(which) {
      const s = load(); draft = { ...s.items };
      tab = which || (count(s.items) ? 'mine' : 'pkg');
      render(); openDlg('#cpDlg');
      if (!bound) { $('#cpBody').addEventListener('click', onClick); bound = true; }
    },
    count: () => count(load().items),
  };
}
