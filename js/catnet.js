// 🐾 擼貓掛號（Firebase）：每隻貓有自己的取號機。抽號碼牌 → 叫號 → 20 秒內報到 → 擼貓。
// 每隻貓同時最多 2 人擼；有人在等時每人 40 秒；擼貓位上 20 秒沒摸就讓給下一號。
// 資料在 market/cats/{貓}/next（號碼機）與 market/cats/{貓}/q/{uid}（號碼牌）；關掉網頁就自動刪除（onDisconnect）。
// 還沒連上線、或 Firebase 規則還沒貼上時：只有自己，抽號就直接輪到（單人模式）。
import { runTransaction, onDisconnect } from '../vendor/firebase/firebase-database.js';

export const SEATS = 2;          // 每隻貓同時可以擼的人數
export const TURN = 40;          // 有人在等時，每人一次可以擼幾秒
export const IDLE = 20;          // 坐在擼貓位上多久沒摸，就讓給下一號（有人在等時）
export const CALL = 20;          // 叫號後幾秒內要報到
export const REST = 20;          // 欺負貓之後要休息幾秒
const STALE = 3 * 60 * 1000;     // 號碼牌超過 3 分鐘沒回報（手機睡著）就不算

const NICKS = [['🐻', '小熊'], ['🐰', '小兔'], ['🦊', '小狐'], ['🦌', '小鹿'], ['🐧', '企鵝'], ['🦉', '貓頭鷹'], ['🐼', '熊貓'], ['🐨', '無尾熊'], ['🐸', '青蛙'], ['🐯', '小虎'], ['🦁', '獅子'], ['🐢', '烏龜'], ['🦔', '刺蝟'], ['🐹', '倉鼠'], ['🐳', '鯨魚'], ['🐝', '蜜蜂']];
function nickOf(id) { let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return NICKS[h % NICKS.length]; }
export const pad = (n) => String(n).padStart(2, '0');

export function createCatNet({ onChange, onRemotePet }) {
  let NET = null, profile = () => null, fb = null, all = {}, solo = true, warned = false, connected = false, blocked = false;
  const me = { cat: null, t: 0, q: 0, ok: false, rest: 0, petN: 0, petR: null, calledAt: 0, seatedAt: 0, lastPet: 0 };
  const lastN = new Map();       // 別人上一次的擼貓次數（看到增加就播放反應）
  let localNext = {};            // 單人模式的號碼機

  const uid = () => (NET && NET.uid()) || 'me';
  const now = () => (NET ? NET.now() : Date.now());
  const myName = () => { const p = profile(); return p && p.name ? p.name : nickOf(uid()).join(' '); };
  const myRef = (cat) => fb.ref(NET.db, `market/cats/${cat}/q/${uid()}`);
  const denied = (e) => {
    if (!warned) { warned = true; console.warn('擼貓排隊：Firebase 規則還沒允許 market/cats，先用單人模式', e && e.code); }
    blocked = true; solo = true; onChange();
  };
  // 把自己的號碼牌寫上去（有變化才寫）
  function push() {
    if (solo || !fb || !me.cat) return;
    const r = myRef(me.cat);
    const data = { t: me.t, q: me.q, ok: me.ok, name: myName(), seen: fb.serverTimestamp(), pet: { n: me.petN, r: me.petR || '' } };
    onDisconnect(r).remove().then(() => fb.set(r, data)).catch(denied);
  }
  function unpush(cat) { if (solo || !fb || !cat) return; const r = myRef(cat); fb.remove(r).catch(() => {}); onDisconnect(r).cancel().catch(() => {}); }
  const drop = (why) => { const cat = me.cat; me.cat = null; me.t = 0; me.q = 0; me.ok = false; me.calledAt = 0; me.seatedAt = 0; unpush(cat); onChange(why); };

  const api = {
    get online() { return !solo; },
    get myCat() { return me.cat; },
    get myTicket() { return me.t; },
    // 接上多人連線（main.js 的 startNet 呼叫）
    attach(net, profFn) {
      NET = net; profile = profFn || profile; fb = net.fb;
      // 真的連上線、規則也允許，才算多人模式；斷線時自動變回單人模式
      fb.onValue(fb.ref(net.db, '.info/connected'), (s) => { connected = !!s.val(); solo = !connected || blocked; if (!solo && me.cat) push(); onChange(); });
      // 等匿名登入完成才訂閱（還沒登入就訂閱會被規則拒絕，而且不會自己重試）；被拒絕時 3 秒後再試一次
      let tries = 0;
      const sub = () => { if (!NET.uid()) { setTimeout(sub, 300); return; } fb.onValue(fb.ref(net.db, 'market/cats'), (s) => {
        all = s.val() || {};
        for (const cat in all) for (const [id, v] of Object.entries((all[cat] && all[cat].q) || {})) {
          if (id === uid() || !v || !v.pet) continue;
          const n = +v.pet.n || 0, prev = lastN.has(id + cat) ? lastN.get(id + cat) : n;
          lastN.set(id + cat, n);
          if (n > prev && typeof v.pet.r === 'string' && v.pet.r) onRemotePet(cat, v.pet.r, String(v.name || '有人').slice(0, 16));
        }
        blocked = false; solo = !connected; api.tick(); onChange();
      }, (e) => { if (++tries < 3) setTimeout(sub, 3000); else denied(e); }); };
      sub();
      if (me.cat) push();
    },
    // 某隻貓的號碼牌隊伍：[{id, isMe, name, t, ok, seated}]；號碼最小的 2 位在擼貓位
    line(cat) {
      const list = [], tNow = now();
      if (!solo) for (const [id, v] of Object.entries((all[cat] && all[cat].q) || {})) {
        if (id === uid() || !v || typeof v.t !== 'number' || v.t < 1) continue;
        if (typeof v.seen === 'number' && tNow - v.seen > STALE) continue;
        list.push({ id, isMe: false, name: String(v.name || nickOf(id).join(' ')).slice(0, 16), t: v.t, q: +v.q || 0, ok: !!v.ok });
      }
      if (me.cat === cat) list.push({ id: uid(), isMe: true, name: myName(), t: me.t, q: me.q, ok: me.ok });
      list.sort((a, b) => a.t - b.t || a.q - b.q || (a.id < b.id ? -1 : 1));
      list.forEach((x, i) => { x.seated = i < SEATS; });
      return list;
    },
    // 我在這隻貓的狀態
    status(cat) {
      const tNow = Date.now(), rest = Math.max(0, Math.ceil((me.rest - tNow) / 1000));
      const L = api.line(cat), i = L.findIndex((x) => x.isMe);
      const base = { rest, line: L, serving: L.slice(0, SEATS), waitingList: L.slice(SEATS), other: me.cat && me.cat !== cat ? me.cat : null, nextT: api.nextTicket(cat) };
      if (i < 0) return { ...base, has: false, seated: false, ahead: 0, waiting: Math.max(0, L.length - SEATS) };
      const seated = i < SEATS, waiting = Math.max(0, L.length - SEATS);
      return {
        ...base, has: true, ticket: me.t, seated, called: seated && !me.ok, ok: seated && me.ok, ahead: seated ? 0 : i - SEATS + 1, waiting,
        callLeft: seated && !me.ok && me.calledAt ? Math.max(0, Math.ceil(CALL - (tNow - me.calledAt) / 1000)) : CALL,
        turnLeft: seated && me.ok && waiting > 0 ? Math.max(0, Math.ceil(TURN - (tNow - me.seatedAt) / 1000)) : null,
      };
    },
    nextTicket(cat) {
      if (solo) return (localNext[cat] || 0) + 1;
      return (+(all[cat] && all[cat].next) || 0) + 1;
    },
    // 抽號碼牌（一個人一次只能拿一張）：連線時由伺服器發號，不會重號
    async take(cat) {
      if (Date.now() < me.rest || me.cat) return false;
      let t = 0;
      if (!solo) {
        try {
          const tx = runTransaction(fb.ref(NET.db, `market/cats/${cat}/next`), (cur) => (typeof cur === 'number' && cur < 9999 ? cur : 0) + 1);
          const r = await Promise.race([tx, new Promise((res) => setTimeout(() => res(null), 4000))]);   // 網路卡住最多等 4 秒
          t = r && r.committed ? r.snapshot.val() : 0;
        } catch (e) { denied(e); }
      }
      if (me.cat) return false;                                     // 等號碼時又按了別的
      if (!t) { localNext[cat] = (localNext[cat] || 0) + 1; t = localNext[cat]; }
      me.cat = cat; me.t = t; me.q = now(); me.ok = false; me.calledAt = 0; me.seatedAt = 0;
      if (solo) { me.ok = true; me.seatedAt = Date.now(); }          // 單人：直接輪到
      push(); api.tick(); onChange('take'); return true;
    },
    checkIn() { if (!me.cat || me.ok) return; me.ok = true; me.seatedAt = Date.now(); me.lastPet = Date.now(); push(); onChange('in'); },
    giveUp() { if (me.cat) drop(me.ok ? 'giveup' : 'giveup-wait'); },
    // 我擼了一下：讓同一隻貓旁邊的人看到同一個反應
    sendPet(cat, reactId) {
      me.petN++; me.petR = reactId; me.lastPet = Date.now();
      if (!solo && fb && me.cat === cat) fb.update(myRef(cat), { pet: { n: me.petN, r: reactId }, seen: fb.serverTimestamp() }).catch(() => {});
    },
    // 欺負貓：號碼牌作廢並休息
    penalize() { me.rest = Date.now() + REST * 1000; drop('penalty'); },
    // 每秒檢查：叫號、過號、時間到、發呆；每分鐘回報一次「我還在」
    tick() {
      if (!me.cat) return;
      const st = api.status(me.cat), tNow = Date.now();
      if (!solo && fb && tNow - (me.seenAt || 0) > 60000) { me.seenAt = tNow; fb.update(myRef(me.cat), { seen: fb.serverTimestamp() }).catch(() => {}); }
      if (!st.seated) { me.calledAt = 0; return; }
      if (!me.ok) {
        if (!me.calledAt) { me.calledAt = tNow; onChange('called'); return; }
        if (tNow - me.calledAt > CALL * 1000) drop('missed');
        return;
      }
      if (st.waiting > 0 && tNow - me.seatedAt > TURN * 1000) { drop('turn'); return; }
      if (st.waiting > 0 && tNow - Math.max(me.lastPet, me.seatedAt) > IDLE * 1000) drop('idle');
    },
    // 有別人正在擼這隻貓（已報到）
    busy(cat) { return api.line(cat).some((x) => x.seated && x.ok && !x.isMe); },
  };
  setInterval(() => api.tick(), 1000);
  return api;
}
