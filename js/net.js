// 多人連線（Firebase Realtime Database）：看到其他登入者在島上走、即時人數
// 資料只有：暱稱、身分、衣服顏色、位置；關掉網頁就自動刪除（onDisconnect）
import { initializeApp } from '../vendor/firebase/firebase-app.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from '../vendor/firebase/firebase-auth.js';
import { getDatabase, ref, set, update, remove, onValue, onChildAdded, onChildChanged, onChildRemoved, onDisconnect, serverTimestamp } from '../vendor/firebase/firebase-database.js';

const ROOT = 'market';
const STALE = 3 * 60 * 1000;   // 超過 3 分鐘沒更新的人不顯示（例如手機睡著）

export function createNet(config, hooks) {
  const app = initializeApp(config);
  const auth = getAuth(app), db = getDatabase(app);
  let uid = null, me = null, meRef = null, lastSent = '', lastT = 0, viewerRef = null;
  const others = new Map();   // uid → { info, pos, t }
  let viewers = 0, skew = 0;
  const status = (s, msg) => hooks.onStatus && hooks.onStatus(s, msg);

  onValue(ref(db, '.info/serverTimeOffset'), (s) => { skew = s.val() || 0; });
  onValue(ref(db, '.info/connected'), (s) => {
    const on = !!s.val(); status(on ? 'online' : 'offline');
    if (on && uid) goOnline();
  });
  onAuthStateChanged(auth, (u) => { if (u) { uid = u.uid; goOnline(); } });
  signInAnonymously(auth).catch((e) => { console.warn('匿名登入失敗', e); status('error', e.code || e.message); });

  // 只要開著網站就算「在線」；用暱稱加入的才會出現在島上
  function goOnline() {
    viewerRef = ref(db, `${ROOT}/viewers/${uid}`);
    onDisconnect(viewerRef).remove().then(() => set(viewerRef, serverTimestamp())).catch((e) => status('error', e.code));
    if (me) publish(true);
  }
  function publish(force) {
    if (!uid || !me) return;
    meRef = ref(db, `${ROOT}/players/${uid}`);
    const p = hooks.myPos() || { x: 0, y: 1.75, z: 7.4, yaw: Math.PI };
    const data = { name: me.name, role: me.role, shirt: me.shirt, x: p.x, y: p.y, z: p.z, yaw: p.yaw, t: serverTimestamp() };
    onDisconnect(meRef).remove().then(() => set(meRef, data)).catch((e) => status('error', e.code));
    lastSent = `${p.x},${p.z},${p.yaw}`; lastT = performance.now();
  }
  function setMe(profile) {
    if (!profile && meRef) { remove(meRef).catch(() => {}); onDisconnect(meRef).cancel().catch(() => {}); meRef = null; }
    me = profile ? { name: profile.name, role: profile.role, shirt: profile.shirt } : null;
    if (me) publish(true);
  }
  // 每一格畫面呼叫：有移動才送，最多每 0.25 秒一次；站著不動時每 60 秒報一次平安
  function tick(now) {
    if (!uid || !me || !meRef) return;
    const p = hooks.myPos(); if (!p) return;
    const key = `${p.x},${p.z},${p.yaw}`, dt = now - lastT;
    if ((key !== lastSent && dt > 250) || dt > 60000) {
      lastSent = key; lastT = now;
      update(meRef, { x: p.x, y: p.y, z: p.z, yaw: p.yaw, t: serverTimestamp() }).catch((e) => status('error', e.code));
    }
  }

  const players = ref(db, `${ROOT}/players`);
  const valid = (v) => v && typeof v.name === 'string' && typeof v.x === 'number' && typeof v.z === 'number';
  const put = (s) => {
    if (s.key === uid) return; const v = s.val(); if (!valid(v)) return;
    others.set(s.key, v); hooks.upsert(s.key, { name: v.name, role: v.role, shirt: v.shirt }, { x: v.x, y: v.y, z: v.z, yaw: v.yaw || 0 });
    emitCount();
  };
  onChildAdded(players, put); onChildChanged(players, put);
  onChildRemoved(players, (s) => { others.delete(s.key); hooks.remove(s.key); emitCount(); });
  onValue(ref(db, `${ROOT}/viewers`), (s) => { viewers = s.size; emitCount(); }, (e) => status('error', e.code));

  // 太久沒更新的人收起來（例如手機鎖螢幕、斷線還沒被伺服器清掉）
  setInterval(() => {
    const now = Date.now() + skew;
    for (const [k, v] of others) if (typeof v.t === 'number' && now - v.t > STALE) { others.delete(k); hooks.remove(k); }
    emitCount();
  }, 15000);

  function emitCount() {
    const now = Date.now() + skew, byRole = { student: 0, parent: 0, teacher: 0, visitor: 0 };
    let n = 0;
    for (const v of others.values()) { if (typeof v.t === 'number' && now - v.t > STALE) continue; n++; if (byRole[v.role] != null) byRole[v.role]++; }
    if (me) { n++; if (byRole[me.role] != null) byRole[me.role]++; }
    hooks.onCount({ players: n, byRole, viewers: Math.max(viewers, n ? 1 : 0) });
  }
  return { setMe, tick };
}
