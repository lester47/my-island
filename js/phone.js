// 📞 遊戲電話：打給同時在線上的同學。可以按預設的短句和表情，也可以自己打字（最多 TEXT_MAX 個字，
//    不適當的字眼、電話號碼和網址會被擋下來；伺服器規則也會再檢查一次）。
// 資料（Firebase）：
//   market/phonebook/{uid} = { name, t }              可以接電話的人（開了「不接電話」就不在這裡）
//   market/calls/{被叫}/{打來的人} = { from, to, st, t, a, b }
//       st：ring 響鈴中、ok 通話中、no 拒絕；a：打來的人最新一句 {k, t} 或自己打的 {x, t}；b：接電話的人最新一句
// db 是一個小轉接頭（真的 Firebase，或測試用的假資料庫），見 main.js
export const PHRASES = [
  '嗨！👋', '來服務台找我！', '我們一起去坐鴨子船！🦆', '一起去擼貓！🐾', '一起去騎腳踏車！🚲', '來坐雲霄飛車啊！🎢',
  '我在 {where}', '等我一下 ⏳', '好喔 👍', '不行耶 🙏', '謝謝你！😊', '😄', '🎉', '❤️', '掰掰 👋',
];
export const RING_SEC = 20;
export const TEXT_MAX = 30;      // 自己打的話最多幾個字（伺服器規則也是 30）
const TEXT_GAP = 2500;           // 兩句話至少隔幾毫秒（不能洗版）
const BOOK_STALE = 3 * 60 * 1000;   // 電話簿超過 3 分鐘沒報平安的人不列出來（關掉網頁時伺服器沒清掉的）

export function createPhone(db, ui) {
  // ui: { name(), where(), toast, chime, render(state), canUse(), check(text) → 錯誤訊息或空字串 }
  let me = null, dnd = false, book = {}, offBook = null, offIn = null, offOut = null;
  let call = null;                 // { role: 'out'|'in', peer, peerName, st, t0, last: {a, b} }
  let incoming = {};               // 打給我的電話
  let lastDial = 0, lastText = 0;

  const now = () => db.now();
  const myBookPath = () => `market/phonebook/${me}`;
  const callPath = (callee, caller) => `market/calls/${callee}/${caller}`;
  function emit() { ui.render(api.state()); }

  function publish() {
    if (!me) return;
    const nm = ui.name();
    if (!nm || dnd) { db.remove(myBookPath()); return; }
    db.onDisconnectRemove(myBookPath());
    db.set(myBookPath(), { name: String(nm).slice(0, 16), t: now() });
  }
  function start() {
    me = db.uid(); if (!me) { setTimeout(start, 400); return; }
    publish();
    offBook = db.on('market/phonebook', (v) => { book = v || {}; emit(); });
    setInterval(publish, 60000);   // 每分鐘報一次平安：還開著網頁的人才會留在別人的電話簿裡
    offIn = db.on(`market/calls/${me}`, (v) => {
      incoming = v || {};
      // 有人打來：響鈴
      for (const [from, c] of Object.entries(incoming)) {
        if (!c || typeof c !== 'object') continue;
        if (c.st === 'ring' && !(call && call.peer === from) && now() - (c.t || 0) < RING_SEC * 1000) {
          if (!call) { call = { role: 'in', peer: from, peerName: String(c.from || '同學').slice(0, 16), st: 'ring', t0: c.t || now(), last: {} }; ui.chime && ui.chime(); }
        }
      }
      if (call && call.role === 'in') {
        const c = incoming[call.peer];
        if (!c) { endLocal(call.st === 'ok' ? '對方掛斷了' : '對方取消了'); return; }
        call.st = c.st; watchMsgs(c);
      }
      emit();
    });
  }
  function watchMsgs(c) {
    const peerKey = call.role === 'out' ? 'b' : 'a';
    const m = c[peerKey];
    if (m && (typeof m.k === 'number' || typeof m.x === 'string') && m.t !== (call.last[peerKey] || 0)) {
      call.last[peerKey] = m.t;
      if (typeof m.x === 'string') {   // 對方自己打的話：收到時再檢查一次（萬一對方用的是舊版網頁）
        const x = m.x.slice(0, TEXT_MAX), bad = ui.check ? ui.check(x) : '';
        call.heard = { x: bad ? '（這句話有不適當的內容，被擋下來了）' : x, t: m.t };
      } else call.heard = { k: m.k, where: typeof m.w === 'string' ? m.w.slice(0, 20) : '', t: m.t };
      ui.chime && ui.chime(true);
    }
  }
  function endLocal(why) {
    if (offOut) { offOut(); offOut = null; }
    call = null; if (why) ui.toast('📞 ' + why); emit();
  }

  const api = {
    start,
    setDnd(on) { dnd = !!on; publish(); emit(); },
    refresh: publish,
    // 打電話
    dial(peer) {
      if (!ui.canUse()) return;
      if (call) { ui.toast('📞 你正在講電話'); return; }
      if (peer === me) return;
      if (now() - lastDial < 8000) { ui.toast('📞 等幾秒再打'); return; }
      const pb = book[peer]; if (!pb || !(now() - (pb.t || 0) < BOOK_STALE)) { ui.toast('📞 對方現在不能接電話'); return; }
      lastDial = now();
      call = { role: 'out', peer, peerName: String(pb.name || '同學').slice(0, 16), st: 'ring', t0: now(), last: {} };
      const p = callPath(peer, me);
      db.onDisconnectRemove(p);
      db.set(p, { from: String(ui.name() || '同學').slice(0, 16), st: 'ring', t: now() }).catch(() => { endLocal('電話線路還沒接通（要等老師更新網站設定）'); });
      offOut = db.on(p, (c) => {
        if (!call || call.role !== 'out') return;
        if (!c) { endLocal(call.st === 'ok' ? '對方掛斷了' : null); return; }
        if (c.st === 'no') { const nm = call.peerName; endLocal(`${nm} 現在不方便接`); db.remove(p); return; }   // 先結束再刪：刪除會馬上觸發這個監聽
        if (c.st === 'ok' && call.st !== 'ok') { call.st = 'ok'; ui.toast(`📞 ${call.peerName} 接起來了！`); }
        watchMsgs(c); emit();
      });
      emit();
    },
    answer(ok) {
      if (!call || call.role !== 'in' || call.st !== 'ring') return;
      const p = callPath(me, call.peer);
      if (!ok) { endLocal(); db.update(p, { st: 'no' }); return; }
      db.onDisconnectRemove(p);
      db.update(p, { st: 'ok', t: now() }); call.st = 'ok'; emit();
    },
    say(k) {
      if (!call || call.st !== 'ok' || !(k >= 0 && k < PHRASES.length)) return;
      const p = call.role === 'out' ? callPath(call.peer, me) : callPath(me, call.peer);
      const key = call.role === 'out' ? 'a' : 'b';
      const msg = { k, t: now() }; if (PHRASES[k].includes('{where}')) msg.w = String(ui.where() || '市集').slice(0, 20);
      db.update(p, { [key]: msg });
      call.said = { k, where: msg.w || '', t: msg.t }; emit();
    },
    // 自己打的話：回傳空字串＝送出了；不然回傳原因（畫面上顯示給玩家看）
    sayText(text) {
      if (!call || call.st !== 'ok') return '還沒接通喔';
      const t = String(text || '').trim();
      const bad = ui.check ? ui.check(t) : (t ? '' : '還沒有打字喔'); if (bad) return bad;
      if (now() - lastText < TEXT_GAP) return '說慢一點，等一下再送';
      lastText = now();
      const p = call.role === 'out' ? callPath(call.peer, me) : callPath(me, call.peer);
      const key = call.role === 'out' ? 'a' : 'b';
      const msg = { x: t, t: now() };
      db.update(p, { [key]: msg }).catch(() => ui.toast('📞 這句話沒有送出去（伺服器擋下來了）'));
      call.said = { x: t, t: msg.t }; emit();
      return '';
    },
    hangup() {
      if (!call) return;
      const p = call.role === 'out' ? callPath(call.peer, me) : callPath(me, call.peer);
      endLocal('電話掛斷了'); db.remove(p);
    },
    // 每秒檢查：響太久沒人接
    tick() {
      if (call && call.st === 'ring' && now() - call.t0 > RING_SEC * 1000) {
        const nm = call.peerName, peer = call.peer;
        if (call.role === 'out') { endLocal(`${nm} 沒有接`); db.remove(callPath(peer, me)); }
        else endLocal(`錯過 ${nm} 的電話`);
      }
    },
    state() {
      const list = Object.entries(book).filter(([id, v]) => id !== me && v && typeof v.name === 'string' && typeof v.t === 'number' && now() - v.t < BOOK_STALE).map(([id, v]) => ({ id, name: v.name.slice(0, 16) }));
      return { me, dnd, list, call: call ? { ...call, left: Math.max(0, Math.ceil(RING_SEC - (now() - call.t0) / 1000)) } : null };
    },
    phrase: (k, where) => (PHRASES[k] || '').replace('{where}', where || '市集'),
    line: (m) => (m && typeof m.x === 'string' ? m.x : (PHRASES[m && m.k] || '').replace('{where}', (m && m.where) || '市集')),
  };
  setInterval(() => api.tick(), 1000);
  return api;
}

// 測試用的假資料庫：同一個瀏覽器的兩個分頁透過 localStorage 互通（網址加 ?debug&fakedb）
export function fakeDb(uid) {
  const KEY = 'fakedb:', subs = [];
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } };
  const write = (o) => { localStorage.setItem(KEY, JSON.stringify(o)); fire(); };
  const get = (o, path) => path.split('/').reduce((a, k) => (a == null ? undefined : a[k]), o);
  const put = (o, path, v) => { const ks = path.split('/'); let a = o; for (let i = 0; i < ks.length - 1; i++) { if (typeof a[ks[i]] !== 'object' || a[ks[i]] == null) a[ks[i]] = {}; a = a[ks[i]]; } if (v == null) delete a[ks[ks.length - 1]]; else a[ks[ks.length - 1]] = v; };
  function fire() { const o = read(); for (const s of subs) { const v = get(o, s.path), j = JSON.stringify(v ?? null); if (j !== s.last) { s.last = j; s.cb(v == null ? null : JSON.parse(j)); } } }
  addEventListener('storage', (e) => { if (e.key === KEY) fire(); });
  const gone = [];
  addEventListener('pagehide', () => { const o = read(); for (const p of gone) put(o, p, null); localStorage.setItem(KEY, JSON.stringify(o)); });
  return {
    uid: () => uid, now: () => Date.now(),
    set: (p, v) => { const o = read(); put(o, p, v); write(o); return Promise.resolve(); },
    update: (p, v) => { const o = read(); for (const k in v) put(o, `${p}/${k}`, v[k]); write(o); return Promise.resolve(); },
    remove: (p) => { const o = read(); put(o, p, null); write(o); return Promise.resolve(); },
    on: (p, cb) => { const s = { path: p, cb, last: undefined }; subs.push(s); setTimeout(fire); return () => { const i = subs.indexOf(s); if (i >= 0) subs.splice(i, 1); }; },
    onDisconnectRemove: (p) => { gone.push(p); },
  };
}
