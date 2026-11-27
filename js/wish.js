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
// 每天許願次數上限：老師訂 10 個（要跟 Firebase 規則 wishCount 的 n ≤ 10 一致）
export const WISH_PER_DAY = 10, TITLE_MAX = 30, BODY_MAX = 200;
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
// 願望的流程階段：數字＝進度（⓪ 不做 → ⑤ 上線了），老師審核時照數字一步一步往前推
export const STATES = {
  new: { n: '', icon: '📮', name: '收到了' },
  no: { n: '⓪', icon: '🙏', name: '這次不做', adm: '否決（這次不做）' }, dup: { n: '⓪', icon: '🔁', name: '重複', adm: '重複（跟別則一樣）' },
  think: { n: '①', icon: '🤔', name: '考慮中', adm: '考慮一下' },
  ok: { n: '②', icon: '👍', name: '同意了', adm: '同意' }, making: { n: '③', icon: '🛠️', name: '施工中' },
  test: { n: '④', icon: '🧪', name: '試玩中', adm: '試玩中（做好了，老師檢查中）' }, done: { n: '⑤', icon: '✅', name: '上線了' },
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
  const canWish = () => signedSchool() || isAdmin();   // 老師帳號（老師名冊上的 email）也可以許願
  const uid = () => NET && NET.uid();
  const nick = () => { const m = store.get('me', null); return m && typeof m.name === 'string' ? m.name.trim() : ''; };   // 遊戲暱稱（「👤 加入」取的）
  const nameNow = () => nick() || (isAdmin() ? '老師' : '同學');   // 不用 email 當名字：學校帳號常是學號，不能公開在許願牆上
  const rewards = () => Object.assign({ good: 20, silver: 50, gold: 100 }, (C.economy && C.economy.wishRewards) || {});
  let sent = '', tab = 'wish', wall = {}, votes = {}, mine = {}, myCards = {}, adminList = {}, offs = [];

  // ---------------------------------------------------------------- 登入
  function loginHTML(why) {
    const em = email();
    if (em && !canWish()) return `<div class="ws-login"><p>你現在用 <b>${esc(em)}</b> 登入，這不是學校帳號（@${SCHOOL_DOMAIN}）。</p><button type="button" class="btn ghost" data-ws="logout">登出，換學校帳號</button></div>`;
    return `<div class="ws-login"><p>${why || '🌠 許願池要先用<b>學校帳號</b>登入才能使用。'}</p>
      <button type="button" class="btn" data-ws="google">🎓 用學校 Google 帳號登入</button>
      <form class="ws-mail" data-ws-form="mail" autocomplete="on"><div class="ws-acct"><input type="text" class="pp-in" placeholder="學校帳號" autocomplete="username" autocapitalize="off" spellcheck="false" inputmode="email" required aria-label="學校帳號（@ 前面那段）"><span class="ws-dom" aria-hidden="true">@${SCHOOL_DOMAIN}</span></div><button type="submit" class="btn ghost">寄登入連結到學校信箱</button></form>
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
        let m = String(mail || '').trim().toLowerCase().replace(/\s+/g, '');
        if (m && !m.includes('@')) m += '@' + SCHOOL_DOMAIN;   // 學生只要輸入 @ 前面的帳號，學校網域自動補上
        if (!isSchoolEmail(m) || !/^[^@\s]+@/.test(m)) { toast(`只能用學校帳號（@${SCHOOL_DOMAIN}），輸入 @ 前面那段就好`); return; }
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
    offs.push(fb.onValue(fb.ref(db, '.info/connected'), (s) => { online = !!s.val(); }, () => {}));   // 網路有沒有連上（送出前先檢查）
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
  const stChip = (st) => { const S = STATES[st] || STATES.new; return `<span class="ws-st s-${esc(STATES[st] ? st : 'new')}">${S.n ? S.n + ' ' : ''}${S.icon} ${S.name}</span>`; };
  // 🎤 語音輸入：用瀏覽器內建的語音辨識（Chrome、Edge、Safari 有；不支援的裝置改用鍵盤上的麥克風鍵）
  const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
  let rec = null, recField = null;
  const micBtn = (field, label) => `<button type="button" class="ws-mic${recField === field ? ' on' : ''}" data-ws-mic="${field}" aria-pressed="${recField === field}" aria-label="用說的輸入${label}" title="用說的輸入${label}">${recField === field ? '⏹️' : '🎤'}</button>`;
  function micTip(text) { const p = $('#wishBody') && $('#wishBody').querySelector('.ws-mic-tip'); if (p) p.textContent = text; }
  function micPaint() { const body = $('#wishBody'); if (!body) return; body.querySelectorAll('[data-ws-mic]').forEach((b) => { const on = b.dataset.wsMic === recField; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); b.textContent = on ? '⏹️' : '🎤'; }); }
  function micStop() { if (rec) { try { rec.stop(); } catch (e) { /* 已經停了 */ } } }
  function mic(field) {
    if (!SR) { micTip('😢 這台裝置的瀏覽器不能用說的輸入。可以點輸入框，再按鍵盤上的 🎤 麥克風鍵（iPad、手機的鍵盤都有）。'); return; }
    if (rec) { const same = recField === field; micStop(); if (same) return; }
    const el = () => $('#wishBody') && $('#wishBody').querySelector(`.ws-form [name="${field}"]`);
    const box = el(); if (!box) return;
    const max = +box.getAttribute('maxlength') || 200, base = box.value;
    const r = new SR(); rec = r; recField = field;
    r.lang = 'zh-TW'; r.interimResults = true; r.continuous = field === 'body'; r.maxAlternatives = 1;
    let done = '';
    r.onresult = (e) => {
      let live = ''; for (let i = e.resultIndex; i < e.results.length; i++) { const t = e.results[i][0].transcript; if (e.results[i].isFinal) done += t; else live += t; }
      const b = el(); if (!b) return;
      b.value = (base + done + live).slice(0, max);
      b.dispatchEvent(new Event('input', { bubbles: true }));   // 讓「相近的願望」和錯誤訊息跟著更新
    };
    r.onerror = (e) => { micTip(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? '🙅 沒有允許使用麥克風。請在網址列旁邊的設定打開麥克風，再按一次 🎤。' : e.error === 'no-speech' ? '🤔 沒有聽到聲音，靠近一點再按 🎤 說一次。' : e.error === 'network' ? '📡 語音辨識要連上網路，請檢查網路後再試。' : '😢 語音辨識出了點問題，請再按一次 🎤，或用打字的。'); };
    r.onend = () => { if (rec === r) { rec = null; recField = null; micPaint(); } };
    try { r.start(); micPaint(); micTip(`🎙️ 請說話…（${field === 'title' ? '標題' : '說明'}）說完按 ⏹️ 停止`); } catch (e) { rec = null; recField = null; micPaint(); micTip('😢 麥克風開不起來，請再試一次，或用打字的。'); }
  }
  function wishForm() {
    if (!nick() && !isAdmin()) return `<div class="ws-login"><p>🙋 許願前要先<b>取一個遊戲暱稱</b>。許願牆上會顯示暱稱，不會顯示你的學校帳號（學號）。</p><button type="button" class="btn" data-ws="nick">👤 去取暱稱</button></div>`;
    return `<form class="ws-form" data-ws-form="wish" autocomplete="off">
      <fieldset class="ws-kinds"><legend>想許哪一種願？</legend>${Object.entries(KINDS).map(([k, K], i) => `<label class="ws-kind"><input type="radio" name="kind" value="${k}" ${i === 0 ? 'checked' : ''}><span><b>${K.icon} ${K.name}</b><small>${esc(K.hint)}</small></span></label>`).join('')}</fieldset>
      <label class="ws-lab">標題（最多 ${TITLE_MAX} 字）<span class="ws-row"><input class="pp-in" name="title" maxlength="${TITLE_MAX}" required placeholder="例如：想要一個摩天輪">${micBtn('title', '標題')}</span></label>
      <div class="ws-similar" aria-live="polite"></div>
      <label class="ws-lab">說明（最多 ${BODY_MAX} 字）<span class="ws-row"><textarea class="pp-in" name="body" rows="4" maxlength="${BODY_MAX}" placeholder="想要怎麼玩？或是：在哪裡、做了什麼、發生了什麼事？"></textarea>${micBtn('body', '說明')}</span></label>
      <p class="foot ws-mic-tip" aria-live="polite">🎤 按麥克風用說的輸入，說完再按一次停止。</p>
      <p class="foot">🐞 抓蟲時會自動附上你現在在哪裡（${esc(whereAmI() || '市集')}）和你的裝置型號，方便老師查。不適當的字眼、電話號碼、網址會被擋下來。每天可以許 ${WISH_PER_DAY} 個，今天還可以許 <b>${Math.max(0, WISH_PER_DAY - todayCount())}</b> 個；一樣的願望到許願牆按 👍 就好。</p>
      <p class="ws-msg ws-err m-${fmsg.kind}" role="alert" ${fmsg.text ? '' : 'hidden'}>${esc(fmsg.text)}</p>
      <button type="submit" class="btn" ${sending || todayCount() >= WISH_PER_DAY ? 'disabled' : ''}>${sending ? '⏳ 送出中…' : '🌠 送出願望'}</button></form>`;
  }
  const myWishes = () => (isAdmin() ? { ...Object.fromEntries(Object.entries(adminList).filter(([, w]) => w && w.uid === uid())), ...mine } : mine);   // 老師的願望也從審核清單找
  function todayCount() { const d = dayNo(NET ? NET.now() : Date.now()); return Object.values(myWishes()).filter((w) => w && w.t && dayNo(w.t) === d).length; }
  // 分區：還在做的、已經實現的、其他（重複／這次不做）分開放，已經做完的不會跟還沒做的混在一起
  const GROUPS = {
    wait: { title: '📮 等老師看', st: ['new', 'think'] },
    doing: { title: '🛠️ 進行中（老師答應要做）', st: ['ok', 'making', 'test'] },
    done: { title: '✅ 已經實現的願望', st: ['done'], fold: true },
    other: { title: '📦 其他（重複、這次不做）', st: ['dup', 'no'], fold: true },
  };
  const openGrp = new Set();   // 使用者打開的摺疊區（重畫時保持打開）
  function groupsHTML(list, keys, item, scope, empty) {
    const out = keys.map((k) => {
      const G = GROUPS[k], rows = list.filter((w) => G.st.includes(STATES[w.st] ? w.st : 'new')); if (!rows.length) return '';
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
    const list = Object.entries(myWishes()).map(([id, w]) => ({ id, ...w })).filter((w) => w.title).sort((a, b) => (b.t || 0) - (a.t || 0));
    const cnt = { good: 0, silver: 0, gold: 0 }; for (const c of cards) if (cnt[c.k] != null) cnt[c.k]++;
    const item = (w) => `<li class="ws-item ${w.st === 'done' ? 'is-done' : ''}"><div class="ws-top">${kindIcon(w)} <b>${esc(w.title)}</b></div><div class="ws-meta">${stChip(w.st)}${cardChip(w.card)}</div>${w.reply ? `<p class="ws-reply">🧑‍🏫 ${esc(w.reply)}</p>` : ''}</li>`;
    return `<h3 class="wl-h">🎴 我的卡片</h3>
      <div class="ws-cards">${Object.entries(CARDS).map(([k, K]) => `<div class="ws-cbox c-${k}"><span>${K.icon}</span><b>${cnt[k]}</b><small>${K.name}</small></div>`).join('')}</div>
      ${cards.length ? `<ul class="wl-log">${cards.map((c) => `<li>${cardChip(c.k)} ${esc(c.title || '')}</li>`).join('')}</ul>` : '<p class="foot">還沒有卡片。許願被老師採用就會拿到！</p>'}
      <h3 class="wl-h">🌠 我的願望</h3>
      ${groupsHTML(list, ['wait', 'doing', 'done', 'other'], item, 'mine', '<p class="foot">還沒有許願。</p>')}
      <p class="foot">🎓 已用 ${esc(email() || '')} 登入。<button type="button" class="linkish" data-ws="logout">登出</button></p>`;
  }
  // 審核按鈕照流程排：⓪ 不做 → ① 考慮 → ② 同意（選卡）→ ③ 施工中 → ④ 試玩中 → ⑤ 上線了；目前的階段不顯示
  function admBtns(w) {
    const b = (st, extra = '') => (w.st === st ? '' : `<button type="button" class="a-${st}" data-ws-adm="st:${st}" data-id="${esc(w.id)}">${STATES[st].n} ${STATES[st].icon} ${STATES[st].adm || STATES[st].name}${extra}</button>`);
    const agree = w.card ? b('ok') : Object.entries(CARDS).map(([k, K]) => `<button type="button" class="a-ok" data-ws-adm="card:${k}" data-id="${esc(w.id)}">② 👍 同意＋${K.icon} ${K.name}</button>`).join('');
    return `<div class="ws-adm-row"><small>不做：</small>${b('no')}${b('dup')}</div>
      <div class="ws-adm-row"><small>審核：</small>${b('think')}${agree}</div>
      <div class="ws-adm-row"><small>進度：</small>${b('making')}${b('test')}${b('done')}</div>`;
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
        <div class="ws-adm">${admBtns(w)}
          <button type="button" data-ws-adm="reply" data-id="${esc(w.id)}">💬 回覆</button></div></li>`;
    return `<p class="foot">採用時選一張卡，會自動發卡給學生，並加發鯉魚幣（💚 ${rw.good}・🥈 ${rw.silver}・🥇 ${rw.gold} 枚）。🔒 祕密回報不會公開到許願牆。數字是進度：⓪ 不做・① 考慮一下・② 同意・③ 施工中・④ 試玩中・⑤ 上線了。按「⑤ ✅ 上線了」就會移到「已經實現」那一區。<button type="button" class="linkish" data-ws="export">📋 複製採用的點子清單</button></p>
      ${groupsHTML(list, ['wait', 'doing', 'done', 'other'], item, 'admin', '<p class="foot">還沒有人許願。</p>')}`;
  }
  function render() {
    const body = $('#wishBody'); if (!body || !$('#wishDlg').open) return;
    const focusId = document.activeElement && body.contains(document.activeElement) && document.activeElement.name;
    const keep = {}; body.querySelectorAll('.ws-form [name]').forEach((el) => { keep[el.name] = el.type === 'radio' ? (el.checked ? el.value : keep[el.name]) : el.value; });
    const tabs = [['wish', '🌠 許願'], ['wall', '🧱 許願牆'], ['mine', '🎴 我的'], ...(isAdmin() ? [['admin', `🧑‍🏫 審核${Object.values(adminList).filter((w) => w.st === 'new').length ? `（${Object.values(adminList).filter((w) => w.st === 'new').length}）` : ''}`]] : [])];
    const panel = tab === 'wall' ? wallHTML() : !canWish() ? loginHTML() : tab === 'mine' ? (sent ? `<p class="ws-msg m-ok" role="status">${esc(sent)}</p>` : '') + mineHTML() : tab === 'admin' && isAdmin() ? adminHTML() : wishForm();
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
  // 送出願望：按下去一定會有回應（送出中 → 已經送出／沒有送出＋原因），訊息顯示在表單裡（提示泡泡會被對話框蓋住）
  let online = true, sending = false, fmsg = { text: '', kind: 'bad' };
  const SEND_WAIT = 12000;   // 等伺服器回應最多 12 秒
  // 學生：願望＋每日計數＋自己的願望清單一起寫（規則用來擋每天超過 3 個）。
  // 老師帳號（不是學校信箱）：規則不讓寫 wishCount／users，被擋下時改成只寫 wishes/{id}（老師本來就能改願望），
  // 老師的「我的」從審核清單裡找自己的願望。
  async function sendWish(me, id, wish, t, cnt) {
    const full = { [`wishes/${id}`]: wish, [`wishCount/${me}`]: { dn: dayNo(t), n: cnt, w: id }, [`users/${me}/wishes/${id}`]: true };
    try { await fb.update(fb.ref(db, 'market'), full); }
    catch (e) {
      if (!isAdmin() || !/permission/i.test(String((e && e.code) || (e && e.message) || ''))) throw e;
      await fb.update(fb.ref(db, 'market'), { [`wishes/${id}`]: wish });
    }
  }
  async function submit(f) {
    // 訊息和「送出中」記在變數裡：資料庫一有變動就會重畫表單，不能只改畫面上的元素（之前就是被重畫蓋掉，看起來沒反應）
    const show = (m, kind = 'bad') => { fmsg = { text: m, kind }; const el = $('#wishBody .ws-err'); if (el) { el.textContent = m; el.className = `ws-msg ws-err m-${kind}`; el.hidden = false; } };
    const setBusy = (on) => { sending = on; const b = $('#wishBody .ws-form [type="submit"]'); if (b) { b.disabled = on || todayCount() >= WISH_PER_DAY; b.textContent = on ? '⏳ 送出中…' : '🌠 送出願望'; } };
    if (sending) return;   // 送出中不要重複按
    try {
      const kind = (f.querySelector('[name="kind"]:checked') || {}).value || 'idea';
      const title = f.elements.title.value.trim(), body = f.elements.body.value.trim();
      if (!title) { show('🙅 標題還沒寫'); return; }
      if (!nick() && !isAdmin()) { show('🙅 要先用「👤 加入」取一個遊戲暱稱'); return; }
      const bad = check(title, TITLE_MAX) || (body ? check(body, BODY_MAX) : ''); if (bad) { show('🙅 ' + bad); return; }
      if (todayCount() >= WISH_PER_DAY) { show(`🙅 今天已經許了 ${WISH_PER_DAY} 個願望，明天再來`); return; }
      if (!online) { show('📡 網路斷線了，願望沒有送出。請確認網路後再按一次。'); return; }
      const me = uid(); if (!me) { show('📡 還沒連上伺服器，願望沒有送出。請等幾秒再按一次。'); return; }
      const t = NET.now(), id = t.toString(36) + Math.random().toString(36).slice(2, 6);
      const cnt = todayCount() + 1;
      const wish = { uid: me, name: nameNow().slice(0, 16), email: (email() || '').slice(0, 60), kind, title, body, st: 'new', t: fb.serverTimestamp(),
        where: String(whereAmI() || '').slice(0, 40), dev: navigator.userAgent.replace(/\s+/g, ' ').slice(0, 120), ver: String(C.assetVersion || '').slice(0, 20) };
      if (kind === 'idea') { delete wish.where; delete wish.dev; }
      setBusy(true);
      show('⏳ 送出中，請稍等…', 'wait');
      let timer;
      try {
        await Promise.race([
          sendWish(me, id, wish, t, cnt),
          new Promise((_, rej) => { timer = setTimeout(() => rej(Object.assign(new Error('timeout'), { code: 'timeout' })), SEND_WAIT); }),
        ]);
        clearTimeout(timer); sending = false; fmsg = { text: '', kind: 'bad' };
        mine[id] = { ...wish, t }; f.reset(); sent = `✅ 已經送出「${title}」！老師看過後會在這裡回覆你。`; toast('🌠 願望送出了！'); tab = 'mine'; render();
      } catch (e) {
        clearTimeout(timer); console.warn('願望沒有送出', e);
        const code = String((e && e.code) || (e && e.message) || '');
        show(code === 'timeout' ? '📡 等了很久伺服器都沒有回應，可能是網路有問題，願望還沒確定送出。等一下看「🎴 我的」有沒有出現；沒有的話再按一次。'
          : /permission/i.test(code) ? (isAdmin() && !signedSchool() ? '⛔ 伺服器沒有收下：Firebase 規則目前只讓學校帳號許願，老師帳號（非學校信箱）要先在規則裡開放。' : (todayCount() >= 3 ? '⛔ 伺服器沒有收下：Firebase 規則可能還限制每天 3 個願望，要請老師把規則改成 10 個。' : '⛔ 伺服器沒有收下這個願望：可能這個帳號沒有許願權限。請告訴老師。'))
          : `❌ 願望沒有送出（${code.slice(0, 40) || '不明原因'}），請再試一次。`);
        setBusy(false);
      }
    } catch (e) { console.warn(e); setBusy(false); show('❌ 願望沒有送出，請重新整理網頁再試一次。'); }
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
    } catch (e) { console.warn(e); toast(/st:(think|test)/.test(act) ? '沒有成功：Firebase 規則可能還不認得「考慮一下／試玩中」，請更新規則' : '沒有成功：請確認 Firebase 規則已更新'); }
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
      if ((b = t.closest('[data-ws-mic]'))) { mic(b.dataset.wsMic); return; }
      if ((b = t.closest('[data-ws-tab]'))) { tab = b.dataset.wsTab; sent = ''; render(); return; }
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
      micStop();
      const f = e.target; e.preventDefault();
      if (f.dataset.wsForm === 'mail') login('mail', f.querySelector('input').value);
      else if (f.dataset.wsForm === 'wish') submit(f);
    });
    $('#wishDlg').addEventListener('close', micStop);   // 關掉許願視窗就停止收音
    body.addEventListener('toggle', (e) => { const d = e.target; if (d.dataset && d.dataset.grp) { if (d.open) openGrp.add(d.dataset.grp); else openGrp.delete(d.dataset.grp); } }, true);
    body.addEventListener('input', (e) => { const f = e.target.closest && e.target.closest('.ws-form'); if (f) { const er = f.querySelector('.ws-err'); if (er && !sending) { er.hidden = true; fmsg = { text: '', kind: 'bad' }; } if (e.target.name === 'title') similar(f); } });
    body.addEventListener('keydown', (e) => { if (e.target.matches && e.target.matches('input, textarea')) e.stopPropagation(); });   // 打字時不觸發漫遊快捷鍵
  }
  return {
    open(which) { if (!NET) { toast('許願池要連上線才能用'); return; } sent = ''; tab = which || (canWish() ? 'wish' : 'wall'); openDlg('#wishDlg'); bind(); watch(); render(); },
    close() { offs.forEach((f) => f && f()); offs = []; },
    refresh() { if (NET && $('#wishDlg').open) { if (tab === 'admin' && !isAdmin()) tab = 'wish'; watch(); render(); } },   // 老師身分晚一點才確認：重新讀資料、重畫（不然老師會看到「不是學校帳號」）
    startSync, loginHTML, login, signedSchool, isSchoolEmail,
  };
}
