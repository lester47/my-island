// 🌠 許願池：學生用學校帳號登入後，可以向老師許願（新點子）、回報遊戲問題（抓蟲）、祕密回報作弊漏洞。
// 老師在「🧑‍🏫 審核」分頁採用、回覆，並發 💚 好人卡／🥈 銀卡／🥇 金卡（可以同時加發鯉魚幣）。
// 另外：用學校帳號登入的人，護照、集章、背包、遊戲紀錄會存到資料庫（market/users），換電腦也不會不見。
//
// 資料（都在 market/ 底下）：
//   wishes/{id}        { uid, name, kind: idea|bug|secret, title, body, where, dev, ver, t, st, reply, card }
//   wishCount/{uid}    { dn: 台灣日期序號, n: 今天第幾個, w: 剛許的願望 id }（伺服器靠它限制每天幾個）
//   wishWall/{id}      { name, kind, title, body, where, st, reply, card, t }：老師看過、公開在許願牆上的
//                      （公開可讀：每天兩次的「願望盤點」會從這裡讀老師答應要做的願望）
//   wishVotes/{id}/{uid} true：「+1 我也想要／我也遇到」
//   cards/{uid}/{id}   { k: good|silver|gold, title, t }：老師發的卡片
//   users/{uid}        { name, t, p: { key: JSON 字串 }, wishes: { id: true } }：學校帳號的紀錄
export const SCHOOL_DOMAIN = 'liwps.ntct.edu.tw';
export const isSchoolEmail = (e) => typeof e === 'string' && e.toLowerCase().endsWith('@' + SCHOOL_DOMAIN);
export const WISH_PER_DAY = 3, TITLE_MAX = 30, BODY_MAX = 200;
export const CARDS = {
  good: { icon: '💚', name: '好人卡', desc: '點子被採用、回報的問題是真的' },
  silver: { icon: '🥈', name: '銀卡', desc: '很棒的點子、影響很多人的問題' },
  gold: { icon: '🥇', name: '金卡', desc: '點子做出來上線了，或回報了能作弊的漏洞' },
};
export const KINDS = {
  idea: { icon: '💡', name: '新點子', hint: '想要的新遊戲、新功能、新裝飾' },
  bug: { icon: '🐞', name: '抓蟲', hint: '遊戲時遇到的問題：卡住、按了沒反應、畫面怪怪的' },
  secret: { icon: '🔒', name: '祕密回報', hint: '發現可以作弊的漏洞（只有老師看得到，不會公開）' },
};
export const STATES = {
  new: { icon: '📮', name: '收到了' }, ok: { icon: '👍', name: '採用' }, making: { icon: '🛠️', name: '製作中' },
  done: { icon: '✅', name: '上線了' }, dup: { icon: '🔁', name: '重複' }, no: { icon: '🙏', name: '這次不做' },
};
// 用學校帳號登入時，這些紀錄會存到資料庫
const SYNC_KEYS = ['me', 'stamps', 'cats', 'catsDone', 'closet', 'bag', 'gameClears', 'gameAll', 'fishlog', 'fishAll', 'hideBest', 'coinplan', 'plan', 'mayorDay'];
const dayNo = (ms) => Math.floor((ms + 8 * 3600e3) / 86400e3);   // 台灣時間的日期序號（跟錢包規則一樣）

export function createWish(ctx) {
  const { C, $, esc, store, toast, openDlg, NET, wallet, whereAmI, check, keyPrefix } = ctx;
  const fb = NET && NET.fb, db = NET && NET.db, T = NET && NET.teacher;
  const R = (p) => fb.ref(db, `market/${p}`);
  const email = () => (T ? T.email() : null);
  const isAdmin = () => !!(wallet() && wallet().admin);
  const signedSchool = () => !!(T && T.verified() && isSchoolEmail(email()));
  const canWish = () => signedSchool() || isAdmin();
  const uid = () => NET && NET.uid();
  const nick = () => { const m = store.get('me', null); return m && typeof m.name === 'string' ? m.name.trim() : ''; };   // 遊戲暱稱（「👤 加入」取的）
  const nameNow = () => nick() || '同學';   // 不用 email 當名字：學校帳號常是學號，不能公開在許願牆上
  const rewards = () => Object.assign({ good: 20, silver: 50, gold: 100 }, (C.economy && C.economy.wishRewards) || {});
  let tab = 'wish', wall = {}, votes = {}, mine = {}, myCards = {}, adminList = {}, offs = [];

  // ---------------------------------------------------------------- 登入
  function loginHTML(why) {
    const em = email();
    if (em && !canWish()) return `<div class="ws-login"><p>你現在用 <b>${esc(em)}</b> 登入，這不是學校帳號（@${SCHOOL_DOMAIN}）。</p><button type="button" class="btn ghost" data-ws="logout">登出，換學校帳號</button></div>`;
    return `<div class="ws-login"><p>${why || '🌠 許願池要先用<b>學校帳號</b>登入才能使用。'}</p>
      <button type="button" class="btn" data-ws="google">🎓 用學校 Google 帳號登入</button>
      <form class="ws-mail" data-ws-form="mail" autocomplete="on"><input type="email" class="pp-in" placeholder="學號或名字@${SCHOOL_DOMAIN}" autocomplete="email" required aria-label="學校 email"><button type="submit" class="btn ghost">寄登入連結到學校信箱</button></form>
      <p class="foot">只接受 <b>@${SCHOOL_DOMAIN}</b> 的學校帳號。不登入也可以逛市集；登入後，你的護照、集章、背包、遊戲紀錄、願望和卡片會存在學校帳號裡，換電腦也不會不見。</p></div>`;
  }
  async function login(kind, mail) {
    if (!T) { toast('要連上線才能登入'); return; }
    try {
      if (kind === 'google') {
        await T.google(SCHOOL_DOMAIN);
        if (!isSchoolEmail(email())) { toast(`這不是學校帳號，請用 @${SCHOOL_DOMAIN} 登入`); await T.logout().catch(() => {}); setTimeout(() => location.reload(), 900); return; }
        toast('🎓 登入成功，重新整理中…'); setTimeout(() => location.reload(), 700);
      } else {
        const m = String(mail || '').trim().toLowerCase();
        if (!isSchoolEmail(m) || !/^[^@\s]+@/.test(m)) { toast(`請輸入學校 email（結尾是 @${SCHOOL_DOMAIN}）`); return; }
        await T.sendLink(m); toast(`📧 登入連結寄到 ${m} 了，請到學校信箱點連結（可能在垃圾郵件）`);
      }
    } catch (e) {
      console.warn('學校帳號登入失敗', e);
      toast(e && e.code === 'auth/popup-closed-by-user' ? '已取消登入' : e && e.code === 'auth/unauthorized-domain' ? '登入失敗：網站網址還沒加到 Firebase 的授權網域' : '登入沒有成功，可以改用「寄登入連結到學校信箱」');
    }
  }

  // ---------------------------------------------------------------- 學校帳號的紀錄同步（market/users/{uid}/p）
  // 一登入就把資料庫裡的紀錄合併回這台裝置；之後每 20 秒檢查有沒有變，有變才上傳
  const raw = (k) => { try { return localStorage.getItem(keyPrefix + k); } catch (e) { return null; } };
  function merge(a, b) {   // a＝這台裝置、b＝資料庫：陣列取聯集、數字取大的、物件逐項合併、其他以資料庫為準
    if (Array.isArray(a) && Array.isArray(b)) { const out = [...b]; for (const x of a) if (!out.some((y) => JSON.stringify(y) === JSON.stringify(x))) out.push(x); return out; }
    if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) { const out = { ...a }; for (const [k, v] of Object.entries(b)) out[k] = k in a ? merge(a[k], v) : v; return out; }
    if (typeof a === 'number' && typeof b === 'number') return Math.max(a, b);
    return b === undefined || b === null ? a : b;
  }
  let synced = {}, syncOn = false;
  async function startSync() {
    if (!signedSchool() || syncOn) return; syncOn = true;
    const me = uid(); let srv = {};
    try { const s = await fb.get(R(`users/${me}/p`)); srv = s.val() || {}; } catch (e) { console.warn('讀不到學校帳號的紀錄', e); syncOn = false; return; }
    let changed = false;
    for (const k of SYNC_KEYS) {
      if (typeof srv[k] !== 'string') continue;
      let sv; try { sv = JSON.parse(srv[k]); } catch (e) { continue; }
      const lv = store.get(k, undefined);
      const mv = k === 'me' ? { ...(lv || {}), ...sv, id: (lv && lv.id) || sv.id } : lv === undefined ? sv : merge(lv, sv);
      if (JSON.stringify(mv) !== raw(k)) { store.set(k, mv); changed = true; }
      synced[k] = srv[k];
    }
    if (changed && !sessionStorage.getItem('liyuSyncReload')) {   // 第一次合併完：重新整理一次，讓畫面用合併後的紀錄
      sessionStorage.setItem('liyuSyncReload', '1'); toast('🎓 已載入學校帳號的紀錄'); setTimeout(() => location.reload(), 900); return;
    }
    await push(true);
    setInterval(() => push(false), 20000);
    addEventListener('pagehide', () => push(false));
  }
  async function push(first) {
    if (!signedSchool()) return;
    const upd = {};
    for (const k of SYNC_KEYS) { const v = raw(k); if (v != null && v !== synced[k] && v.length < 20000) upd[`p/${k}`] = v; }
    if (!Object.keys(upd).length && !first) return;
    upd.name = nameNow().slice(0, 16); upd.t = fb.serverTimestamp();
    try { await fb.update(R(`users/${uid()}`), upd); for (const [k, v] of Object.entries(upd)) if (k.startsWith('p/')) synced[k.slice(2)] = v; } catch (e) { console.warn('學校帳號紀錄沒有存成功', e); }
  }

  // ---------------------------------------------------------------- 讀資料
  function watch() {
    offs.forEach((f) => f && f()); offs = [];
    const on = (p, cb) => offs.push(fb.onValue(R(p), (s) => { cb(s.val() || {}); render(); }, () => {}));
    on('wishWall', (v) => { wall = v; });
    on('wishVotes', (v) => { votes = v; });
    if (signedSchool() || isAdmin()) on(`cards/${uid()}`, (v) => { myCards = v; });
    if (canWish()) on(`users/${uid()}/wishes`, (v) => {   // 我的願望：一則一則讀（只讀得到自己的）
      for (const id of Object.keys(v)) if (!mine[id]) { mine[id] = { t: 0 }; offs.push(fb.onValue(R(`wishes/${id}`), (s) => { if (s.val()) mine[id] = s.val(); render(); }, () => {})); }
    });
    if (isAdmin()) on('wishes', (v) => { adminList = v; });
  }

  // ---------------------------------------------------------------- 畫面
  const voteN = (id) => Object.keys(votes[id] || {}).length;
  const iVoted = (id) => !!(votes[id] && votes[id][uid()]);
  const cardChip = (k) => (CARDS[k] ? `<span class="ws-card c-${k}">${CARDS[k].icon} ${CARDS[k].name}</span>` : '');
  const stChip = (st) => { const S = STATES[st] || STATES.new; return `<span class="ws-st s-${esc(st || 'new')}">${S.icon} ${S.name}</span>`; };
  function wishForm() {
    if (!nick()) return `<div class="ws-login"><p>🙋 許願前要先<b>取一個遊戲暱稱</b>。許願牆上會顯示暱稱，不會顯示你的學校帳號（學號）。</p><button type="button" class="btn" data-ws="nick">👤 去取暱稱</button></div>`;
    const left = WISH_PER_DAY - todayCount();
    return `<form class="ws-form" data-ws-form="wish" autocomplete="off">
      <fieldset class="ws-kinds"><legend>想許哪一種願？</legend>${Object.entries(KINDS).map(([k, K], i) => `<label class="ws-kind"><input type="radio" name="kind" value="${k}" ${i === 0 ? 'checked' : ''}><span><b>${K.icon} ${K.name}</b><small>${esc(K.hint)}</small></span></label>`).join('')}</fieldset>
      <label class="ws-lab">標題（最多 ${TITLE_MAX} 字）<input class="pp-in" name="title" maxlength="${TITLE_MAX}" required placeholder="例如：想要一個摩天輪"></label>
      <div class="ws-similar" aria-live="polite"></div>
      <label class="ws-lab">說明（最多 ${BODY_MAX} 字）<textarea class="pp-in" name="body" rows="4" maxlength="${BODY_MAX}" placeholder="想要怎麼玩？或是：在哪裡、做了什麼、發生了什麼事？"></textarea></label>
      <p class="foot">🐞 抓蟲時會自動附上你現在在哪裡（${esc(whereAmI() || '市集')}）和你的裝置型號，方便老師查。不適當的字眼、電話號碼、網址會被擋下來。今天還可以許 <b>${Math.max(0, left)}</b> 個願望。</p>
      <p class="cc-err ws-err" role="alert" hidden></p>
      <button type="submit" class="btn" ${left > 0 ? '' : 'disabled'}>🌠 送出願望</button></form>`;
  }
  function todayCount() { const d = dayNo(NET ? NET.now() : Date.now()); return Object.values(mine).filter((w) => w && w.t && dayNo(w.t) === d).length; }
  // 分區：還在做的、已經實現的、其他（重複／這次不做）分開放，已經做完的不會跟還沒做的混在一起
  const GROUPS = {
    wait: { title: '📮 等老師看', st: ['new'] },
    doing: { title: '🛠️ 進行中（老師答應要做）', st: ['ok', 'making'] },
    done: { title: '✅ 已經實現的願望', st: ['done'], fold: true },
    other: { title: '📦 其他（重複、這次不做）', st: ['dup', 'no'], fold: true },
  };
  const openGrp = new Set();   // 使用者打開的摺疊區（重畫時保持打開）
  function groupsHTML(list, keys, item, scope, empty) {
    const out = keys.map((k) => {
      const G = GROUPS[k], rows = list.filter((w) => G.st.includes(w.st || 'new')); if (!rows.length) return '';
      const inner = `<ul class="ws-list">${rows.map(item).join('')}</ul>`, key = `${scope}:${k}`;
      return G.fold ? `<details class="ws-grp g-${k}" data-grp="${key}" ${openGrp.has(key) ? 'open' : ''}><summary><b>${G.title}</b>（${rows.length}）</summary>${inner}</details>`
        : `<section class="ws-grp g-${k}"><h3 class="wl-h">${G.title}（${rows.length}）</h3>${inner}</section>`;
    }).join('');
    return out || empty;
  }
  const kindIcon = (w) => (KINDS[w.kind] ? KINDS[w.kind].icon : '💡');
  function wallHTML() {
    const list = Object.entries(wall).map(([id, w]) => ({ id, ...w })).sort((a, b) => voteN(b.id) - voteN(a.id) || (b.t || 0) - (a.t || 0));
    if (!list.length) return '<p class="foot">許願牆上還沒有願望。老師看過的願望會出現在這裡。</p>';
    const fame = {}; for (const w of list) if (w.card === 'gold') fame[w.name] = (fame[w.name] || 0) + 1;
    const item = (w) => `<li class="ws-item ${w.st === 'done' ? 'is-done' : ''}"><div class="ws-top">${kindIcon(w)} <b>${esc(w.title)}</b></div>
        <div class="ws-meta">${stChip(w.st)}${cardChip(w.card)}<small>許願的人：${esc(w.name || '同學')}</small></div>
        ${w.body ? `<p class="ws-body">${esc(w.body)}</p>` : ''}${w.reply ? `<p class="ws-reply">🧑‍🏫 ${esc(w.reply)}</p>` : ''}
        ${w.st === 'done' ? `<p class="ws-yay">🎉 已經可以玩了！謝謝 ${esc(w.name || '同學')} 的點子</p>` : w.st === 'dup' || w.st === 'no' ? '' : `<button type="button" class="ws-vote ${iVoted(w.id) ? 'on' : ''}" data-ws-vote="${esc(w.id)}" ${canWish() ? '' : 'disabled'} aria-pressed="${iVoted(w.id)}">👍 ${w.kind === 'bug' ? '我也遇到' : '我也想要'}・${voteN(w.id)}</button>`}</li>`;
    return `${Object.keys(fame).length ? `<div class="ws-fame"><b>🏆 名人堂</b>：${Object.entries(fame).map(([n, c]) => `${esc(n)} 🥇${c > 1 ? `×${c}` : ''}`).join('、')}</div>` : ''}
      ${groupsHTML(list, ['doing', 'done', 'other'], item, 'wall', '<p class="foot">許願牆上還沒有願望。</p>')}`;
  }
  function mineHTML() {
    const cards = Object.entries(myCards).map(([id, c]) => ({ id, ...c })).sort((a, b) => (b.t || 0) - (a.t || 0));
    const list = Object.entries(mine).map(([id, w]) => ({ id, ...w })).filter((w) => w.title).sort((a, b) => (b.t || 0) - (a.t || 0));
    const cnt = { good: 0, silver: 0, gold: 0 }; for (const c of cards) if (cnt[c.k] != null) cnt[c.k]++;
    const item = (w) => `<li class="ws-item ${w.st === 'done' ? 'is-done' : ''}"><div class="ws-top">${kindIcon(w)} <b>${esc(w.title)}</b></div><div class="ws-meta">${stChip(w.st)}${cardChip(w.card)}</div>${w.reply ? `<p class="ws-reply">🧑‍🏫 ${esc(w.reply)}</p>` : ''}</li>`;
    return `<h3 class="wl-h">🎴 我的卡片</h3>
      <div class="ws-cards">${Object.entries(CARDS).map(([k, K]) => `<div class="ws-cbox c-${k}"><span>${K.icon}</span><b>${cnt[k]}</b><small>${K.name}</small></div>`).join('')}</div>
      ${cards.length ? `<ul class="wl-log">${cards.map((c) => `<li>${cardChip(c.k)} ${esc(c.title || '')}</li>`).join('')}</ul>` : '<p class="foot">還沒有卡片。許願被老師採用就會拿到！</p>'}
      <h3 class="wl-h">🌠 我的願望</h3>
      ${groupsHTML(list, ['wait', 'doing', 'done', 'other'], item, 'mine', '<p class="foot">還沒有許願。</p>')}
      <p class="foot">🎓 已用 ${esc(email() || '')} 登入。<button type="button" class="linkish" data-ws="logout">登出</button></p>`;
  }
  function adminHTML() {
    const list = Object.entries(adminList).map(([id, w]) => ({ id, ...w })).sort((a, b) => (b.t || 0) - (a.t || 0));
    const rw = rewards();
    if (!list.length) return '<p class="foot">還沒有人許願。</p>';
    const item = (w) => `<li class="ws-item ${w.st === 'new' ? 'is-new' : ''} ${w.st === 'done' ? 'is-done' : ''}">
        <div class="ws-top">${kindIcon(w)} <b>${esc(w.title)}</b> <small>— ${esc(w.name || '')}（${esc(w.email || '')}）</small></div>
        ${w.body ? `<p class="ws-body">${esc(w.body)}</p>` : ''}
        ${w.kind !== 'idea' ? `<p class="foot">📍 ${esc(w.where || '')}・${esc(w.dev || '')}・${esc(w.ver || '')}</p>` : ''}
        <div class="ws-meta">${stChip(w.st)}${cardChip(w.card)}<small>👍 ${voteN(w.id)}</small></div>
        ${w.reply ? `<p class="ws-reply">🧑‍🏫 ${esc(w.reply)}</p>` : ''}
        <div class="ws-adm">${w.card ? '' : Object.entries(CARDS).map(([k, K]) => `<button type="button" data-ws-adm="card:${k}" data-id="${esc(w.id)}">${K.icon} 採用＋${K.name}</button>`).join('')}
          ${w.st === 'making' ? '' : `<button type="button" data-ws-adm="st:making" data-id="${esc(w.id)}">🛠️ 製作中</button>`}${w.st === 'done' ? '' : `<button type="button" data-ws-adm="st:done" data-id="${esc(w.id)}">✅ 上線了</button>`}
          <button type="button" data-ws-adm="st:dup" data-id="${esc(w.id)}">🔁 重複</button><button type="button" data-ws-adm="st:no" data-id="${esc(w.id)}">🙏 這次不做</button>
          <button type="button" data-ws-adm="reply" data-id="${esc(w.id)}">💬 回覆</button></div></li>`;
    return `<p class="foot">採用時選一張卡，會自動發卡給學生，並加發鯉魚幣（💚 ${rw.good}・🥈 ${rw.silver}・🥇 ${rw.gold} 枚）。🔒 祕密回報不會公開到許願牆。做完的願望按「✅ 上線了」，就會移到「已經實現」那一區。<button type="button" class="linkish" data-ws="export">📋 複製採用的點子清單</button></p>
      ${groupsHTML(list, ['wait', 'doing', 'done', 'other'], item, 'admin', '<p class="foot">還沒有人許願。</p>')}`;
  }
  function render() {
    const body = $('#wishBody'); if (!body || !$('#wishDlg').open) return;
    const focusId = document.activeElement && body.contains(document.activeElement) && document.activeElement.name;
    const keep = {}; body.querySelectorAll('.ws-form [name]').forEach((el) => { keep[el.name] = el.type === 'radio' ? (el.checked ? el.value : keep[el.name]) : el.value; });
    const tabs = [['wish', '🌠 許願'], ['wall', '🧱 許願牆'], ['mine', '🎴 我的'], ...(isAdmin() ? [['admin', `🧑‍🏫 審核${Object.values(adminList).filter((w) => w.st === 'new').length ? `（${Object.values(adminList).filter((w) => w.st === 'new').length}）` : ''}`]] : [])];
    const panel = tab === 'wall' ? wallHTML() : !canWish() ? loginHTML() : tab === 'mine' ? mineHTML() : tab === 'admin' && isAdmin() ? adminHTML() : wishForm();
    body.innerHTML = `<div class="cp-tabs" role="tablist">${tabs.map(([k, t]) => `<button type="button" role="tab" aria-selected="${tab === k}" class="${tab === k ? 'on' : ''}" data-ws-tab="${k}">${t}</button>`).join('')}</div><div role="tabpanel">${panel}</div>`;
    const f = body.querySelector('.ws-form');
    if (f) { for (const [k, v] of Object.entries(keep)) { if (k === 'kind') { const r = f.querySelector(`[name="kind"][value="${v}"]`); if (r) r.checked = true; } else if (f.elements[k]) f.elements[k].value = v; } if (focusId && f.elements[focusId] && f.elements[focusId].focus) f.elements[focusId].focus(); similar(f); }
  }
  function similar(f) {   // 標題打一打，列出牆上相近的願望，請大家按 +1 就好
    const box = f.querySelector('.ws-similar'), q = String(f.elements.title.value || '').replace(/\s/g, '');
    if (!box) return;
    if (q.length < 2) { box.innerHTML = ''; return; }
    const grams = new Set(); for (let i = 0; i < q.length - 1; i++) grams.add(q.slice(i, i + 2));
    const hits = Object.entries(wall).map(([id, w]) => { const t = String(w.title || ''); let n = 0; for (const g of grams) if (t.includes(g)) n++; return { id, w, n }; }).filter((x) => x.n >= Math.min(2, grams.size)).sort((a, b) => b.n - a.n).slice(0, 3);
    box.innerHTML = hits.length ? `<p class="foot">👀 許願牆上有相近的願望，一樣的話按 +1 就好：</p>${hits.map((h) => `<button type="button" class="ws-vote ${iVoted(h.id) ? 'on' : ''}" data-ws-vote="${esc(h.id)}">👍 ${esc(h.w.title)}・${voteN(h.id)}</button>`).join('')}` : '';
  }

  // ---------------------------------------------------------------- 動作
  async function submit(f) {
    const err = f.querySelector('.ws-err'), show = (m) => { err.textContent = '🙅 ' + m; err.hidden = false; };
    const kind = (f.querySelector('[name="kind"]:checked') || {}).value || 'idea';
    const title = f.elements.title.value.trim(), body = f.elements.body.value.trim();
    if (!nick()) { show('要先用「👤 加入」取一個遊戲暱稱'); return; }
    const bad = check(title, TITLE_MAX) || (body ? check(body, BODY_MAX) : ''); if (bad) { show(bad); return; }
    if (todayCount() >= WISH_PER_DAY) { show(`今天已經許了 ${WISH_PER_DAY} 個願望，明天再來`); return; }
    const me = uid(), t = NET.now(), id = t.toString(36) + Math.random().toString(36).slice(2, 6);
    const cnt = todayCount() + 1;
    const wish = { uid: me, name: nameNow().slice(0, 16), email: (email() || '').slice(0, 60), kind, title, body, st: 'new', t: fb.serverTimestamp(),
      where: String(whereAmI() || '').slice(0, 40), dev: navigator.userAgent.replace(/\s+/g, ' ').slice(0, 120), ver: String(C.assetVersion || '').slice(0, 20) };
    if (kind === 'idea') { delete wish.where; delete wish.dev; }
    const btn = f.querySelector('[type="submit"]'); btn.disabled = true;
    try {
      await fb.update(fb.ref(db, 'market'), { [`wishes/${id}`]: wish, [`wishCount/${me}`]: { dn: dayNo(t), n: cnt, w: id }, [`users/${me}/wishes/${id}`]: true });
      mine[id] = { ...wish, t }; f.reset(); toast('🌠 願望送出了！老師看過後會在「🎴 我的」回覆你'); tab = 'mine'; render();
    } catch (e) { console.warn(e); show('沒有送出去：可能今天已經許滿了，或是內容被伺服器擋下來'); btn.disabled = false; }
  }
  async function vote(id) {
    if (!canWish()) { toast('要先用學校帳號登入才能 +1'); return; }
    const r = R(`wishVotes/${id}/${uid()}`);
    try { if (iVoted(id)) await fb.remove(r); else await fb.set(r, true); } catch (e) { toast('沒有成功，請稍後再試'); }
  }
  async function adminAct(act, id) {
    const w = adminList[id]; if (!w) return;
    const pub = (extra) => (w.kind === 'secret' ? {} : { [`wishWall/${id}`]: { name: w.name || '同學', kind: w.kind, title: w.title, body: w.body || '', where: w.where || '', st: extra.st || w.st, reply: extra.reply ?? w.reply ?? '', card: extra.card || w.card || '', t: w.t || 0 } });
    try {
      if (act.startsWith('card:')) {
        const k = act.slice(5), K = CARDS[k], coin = rewards()[k] || 0;
        if (!confirm(`採用「${w.title}」，發 ${K.icon} ${K.name} 給 ${w.name}${coin ? `，並加發 ${coin} 枚鯉魚幣` : ''}？`)) return;
        await fb.update(fb.ref(db, 'market'), { [`wishes/${id}/st`]: 'ok', [`wishes/${id}/card`]: k, [`cards/${w.uid}/${id}`]: { k, title: w.title, t: fb.serverTimestamp() }, ...pub({ st: 'ok', card: k }) });
        if (coin && wallet() && wallet().grant) await wallet().grant(w.uid, coin, `${K.name}：${w.title}`.slice(0, 30)).catch(() => toast('卡片發了，但鯉魚幣沒加發成功'));
        toast(`已發 ${K.icon} ${K.name} 給 ${w.name}`);
      } else if (act.startsWith('st:')) {
        const st = act.slice(3); let reply = w.reply || '';
        if (st === 'no' || st === 'dup') { const r = prompt(st === 'dup' ? '跟哪一個願望重複？（會讓學生看到）' : '這次不做的原因（會讓學生看到）', reply); if (r == null) return; reply = r.slice(0, 60); }
        await fb.update(fb.ref(db, 'market'), { [`wishes/${id}/st`]: st, [`wishes/${id}/reply`]: reply, ...pub({ st, reply }) });
      } else if (act === 'reply') {
        const r = prompt(`回覆 ${w.name}（會讓學生看到，最多 60 字）`, w.reply || ''); if (r == null) return;
        const reply = r.slice(0, 60);
        await fb.update(fb.ref(db, 'market'), { [`wishes/${id}/reply`]: reply, ...pub({ reply }) });
      }
    } catch (e) { console.warn(e); toast('沒有成功：請確認 Firebase 規則已更新'); }
  }
  function exportList() {
    const list = Object.values(adminList).filter((w) => w.st === 'ok' || w.st === 'making').map((w) => `・${KINDS[w.kind] ? KINDS[w.kind].name : ''}｜${w.title}${w.body ? `：${w.body}` : ''}${w.where ? `（${w.where}）` : ''}`);
    const txt = `115 鯉魚市集・採用的願望（${list.length}）\n${list.join('\n')}`;
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast('📋 已複製，可以貼給 Claude 開發'), () => prompt('複製下面的文字：', txt));
  }

  let bound = false;
  function bind() {
    if (bound) return; bound = true;
    const body = $('#wishBody');
    body.addEventListener('click', (e) => {
      const t = e.target instanceof Element ? e.target : null; if (!t) return;
      let b;
      if ((b = t.closest('[data-ws-tab]'))) { tab = b.dataset.wsTab; render(); return; }
      if ((b = t.closest('[data-ws-vote]'))) { vote(b.dataset.wsVote); return; }
      if ((b = t.closest('[data-ws-adm]'))) { adminAct(b.dataset.wsAdm, b.dataset.id); return; }
      if ((b = t.closest('[data-ws]'))) {
        const k = b.dataset.ws;
        if (k === 'google') login('google');
        else if (k === 'logout') T.logout().then(() => { toast('已登出'); setTimeout(() => location.reload(), 500); });
        else if (k === 'export') exportList();
        else if (k === 'nick') { $('#wishDlg').close(); const mb = $('#meBtn'); if (mb) mb.click(); }
      }
    });
    body.addEventListener('submit', (e) => {
      const f = e.target; e.preventDefault();
      if (f.dataset.wsForm === 'mail') login('mail', f.querySelector('input').value);
      else if (f.dataset.wsForm === 'wish') submit(f);
    });
    body.addEventListener('toggle', (e) => { const d = e.target; if (d.dataset && d.dataset.grp) { if (d.open) openGrp.add(d.dataset.grp); else openGrp.delete(d.dataset.grp); } }, true);
    body.addEventListener('input', (e) => { const f = e.target.closest && e.target.closest('.ws-form'); if (f) { const er = f.querySelector('.ws-err'); if (er) er.hidden = true; if (e.target.name === 'title') similar(f); } });
    body.addEventListener('keydown', (e) => { if (e.target.matches && e.target.matches('input, textarea')) e.stopPropagation(); });   // 打字時不觸發漫遊快捷鍵
  }
  return {
    open(which) { if (!NET) { toast('許願池要連上線才能用'); return; } tab = which || (canWish() ? 'wish' : 'wall'); openDlg('#wishDlg'); bind(); watch(); render(); },
    close() { offs.forEach((f) => f && f()); offs = []; },
    startSync, loginHTML, login, signedSchool, isSchoolEmail,
  };
}
