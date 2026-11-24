// 🪙 線上鯉魚幣錢包（Firebase）
// 規則：每天固定發起始幣，當天結束歸零（隔天重新發）；打工每天最多賺 dailyJob；錢包最多 cap。
// 跟現場的實體鯉魚幣無關，也不能用真錢買。
// 資料：market/wallets/{uid}（自己的錢包）、market/grants/{uid}（老師加發／扣回）、market/frozen/{uid}（凍結）、
//       market/adminEmails/{email}（老師名冊：用 email 登入的老師，. 換成 ,）、market/inbox/{uid}（收到的請客券）、market/refunds/{uid}（被退回的請客券）、
//       market/treatLog（請客紀錄，老師看）、market/reports/{uid}（告訴老師）
// 還沒連上線、或 Firebase 規則還沒貼上時：用「體驗錢包」，只存在這台裝置。
const LKEY = 'liyu115.wallet.v1';
const DAY_TZ = 'Asia/Taipei';
export const emailKey = (e) => String(e || '').trim().toLowerCase().replace(/\./g, ',');

export function createWallet({ cfg, onChange, toast }) {
  const st = { mode: 'trial', uid: null, admin: false, frozen: false, blocked: false, w: null, inbox: [] };
  let NET = null, fb = null, profile = () => null, saving = Promise.resolve(), loaded = false;
  const now = () => (NET ? NET.now() : Date.now());
  const today = () => new Date(now()).toLocaleDateString('sv-SE', { timeZone: DAY_TZ });
  const fresh = (old) => ({
    day: today(), bal: cfg.start, earned: 0, plays: {}, jobAt: {}, treats: 0, inT: cfg.start, outT: 0,
    log: [{ t: now(), k: 'start', a: cfg.start, n: '今天的起始幣' }],
    bonusEver: (old && old.bonusEver) || {}, applied: (old && old.applied) || {},
  });
  // 換日：錢包歸零，重新發今天的起始幣
  const roll = (w) => (w && w.day === today() ? w : fresh(w));
  const ensure = () => { const r = roll(st.w); if (r !== st.w) { st.w = r; save(); } return st.w; };
  const log = (k, a, n) => { const w = st.w; w.log = [{ t: now(), k, a, n: String(n).slice(0, 40) }, ...(w.log || [])].slice(0, 40); };

  function loadLocal() { try { const v = JSON.parse(localStorage.getItem(LKEY)); st.w = roll(v && typeof v.bal === 'number' ? v : null); } catch (e) { st.w = fresh(); } }
  function save() {
    const w = st.w; if (!w) return;
    if (st.mode === 'trial') { try { localStorage.setItem(LKEY, JSON.stringify(w)); } catch (e) { /* 私密模式：只是不記住 */ } onChange(); return; }
    const p = profile() || {};
    const data = { ...w, name: p.name || '', role: p.role || '', upd: fb.serverTimestamp() };
    saving = saving.then(() => fb.set(fb.ref(NET.db, `market/wallets/${st.uid}`), data)).catch((e) => fail(e));
    onChange();
  }
  // Firebase 規則不允許：退回體驗錢包
  function fail(e) {
    if (st.mode === 'trial') return;
    console.warn('鯉魚幣：Firebase 規則還沒允許錢包，先用體驗錢包', e && e.code);
    st.mode = 'trial'; st.blocked = true; loadLocal(); onChange();
  }
  loadLocal();

  const api = {
    get mode() { return st.mode; },
    get admin() { return st.admin; },
    get frozen() { return st.frozen; },
    get uid() { return st.uid; },
    get email() { return st.email || null; },
    get inbox() { return st.inbox; },
    state() { return ensure(); },
    bal() { return ensure().bal; },
    // 接上 Firebase（main.js 的 startNet 呼叫）
    attach(net, profFn) {
      NET = net; fb = net.fb; profile = profFn || profile;
      const wait = setInterval(() => {
        const uid = NET.uid(); if (!uid) return; clearInterval(wait);
        st.uid = uid; st.mode = 'school';
        const R = (p) => fb.ref(NET.db, p);
        fb.onValue(R(`market/wallets/${uid}`), (s) => {
          const v = s.val();
          if (!loaded) { loaded = true; st.w = roll(v && typeof v.bal === 'number' ? v : null); if (!v || v.day !== st.w.day || !v.name) save(); else onChange(); return; }
          if (v && typeof v.bal === 'number') { st.w = roll(v); onChange(); }      // 另一個分頁或老師改過
        }, fail);
        const em = NET.teacher && NET.teacher.email();
        st.email = em;
        if (em) fb.onValue(R(`market/adminEmails/${emailKey(em)}`), (s) => { st.admin = s.val() === true; onChange('admin'); }, () => { st.admin = false; onChange('admin'); });
        fb.onValue(R(`market/frozen/${uid}`), (s) => { st.frozen = s.val() === true; onChange(); }, () => {});
        // 老師加發／扣回：每一筆只套用一次
        fb.onValue(R(`market/grants/${uid}`), (s) => {
          const g = s.val() || {}; if (!loaded) return; const w = ensure(); let changed = false;
          for (const [id, op] of Object.entries(g)) {
            if (w.applied[id] || !op || typeof op.a !== 'number') continue;
            w.applied[id] = 1; changed = true;
            const a = Math.round(op.a);
            if (a >= 0) { const got = Math.min(a, cfg.cap - w.bal); w.bal += got; w.inT += got; log('grant', got, `老師加發：${op.n || ''}`); toast(`🧑‍🏫 老師加發 ${got} 枚線上鯉魚幣！${op.n ? `（${String(op.n).slice(0, 20)}）` : ''}`); }
            else { const take = Math.min(-a, w.bal); w.bal -= take; w.outT += take; log('grant', -take, `老師扣回：${op.n || ''}`); toast(`🧑‍🏫 老師扣回 ${take} 枚線上鯉魚幣${op.n ? `（${String(op.n).slice(0, 20)}）` : ''}`); }
          }
          if (changed) save();
        }, () => {});
        // 收到的請客券
        fb.onValue(R(`market/inbox/${uid}`), (s) => { const v = s.val() || {}; st.inbox = Object.entries(v).map(([id, x]) => ({ id, ...x })).filter((x) => typeof x.a === 'number'); onChange('inbox'); }, () => {});
        // 被退回的請客券：錢還給自己
        fb.onValue(R(`market/refunds/${uid}`), (s) => {
          const v = s.val() || {}; if (!loaded) return; const w = ensure(); let changed = false;
          for (const [id, x] of Object.entries(v)) {
            fb.remove(R(`market/refunds/${uid}/${id}`)).catch(() => {});
            if (w.applied['r' + id] || !x || typeof x.a !== 'number') continue;
            w.applied['r' + id] = 1; changed = true;
            const a = Math.min(Math.max(0, Math.round(x.a)), cfg.treatMax, cfg.cap - w.bal); w.bal += a; w.inT += a;
            log('refund', a, x.n || '請客券退回'); toast(`↩️ ${x.n || '請客券被退回'}，${a} 枚還給你`);
          }
          if (changed) save();
        }, () => {});
      }, 300);
    },
    // ---- 付錢
    canPay(price, key, limit) {
      const w = ensure();
      if (st.frozen) return '你的錢包被老師暫停使用了，請找老師';
      if (key && limit && (w.plays[key] || 0) >= limit) return `今天這個已經玩 ${limit} 次了，明天再來`;
      if (w.bal < price) return `線上鯉魚幣不夠（要 ${price}，你有 ${w.bal}），去打工賺一點吧`;
      return '';
    },
    pay(price, kind, note, key) {
      const why = api.canPay(price, key, key ? Infinity : 0); if (why) return why;
      const w = st.w; w.bal -= price; w.outT += price; if (key) w.plays[key] = (w.plays[key] || 0) + 1;
      log(kind, -price, note); save(); return '';
    },
    refund(a, note) { const w = ensure(); const got = Math.min(a, cfg.cap - w.bal); w.bal += got; w.outT -= got; log('refund', got, note); save(); return got; },
    // ---- 賺錢：打工有每日上限，錢包有上限
    earn(a, kind, note, isJob) {
      const w = ensure(); if (st.frozen) return 0;
      let got = Math.min(a, cfg.cap - w.bal);
      if (isJob) got = Math.min(got, cfg.dailyJob - w.earned);
      got = Math.max(0, got);
      if (got) { w.bal += got; w.inT += got; if (isJob) w.earned += got; log(kind, got, note); save(); }
      return got;
    },
    jobLeft() { return Math.max(0, cfg.dailyJob - ensure().earned); },
    jobWait(job, cool) { const t = ensure().jobAt[job] || 0; return Math.max(0, Math.ceil((t + cool * 1000 - now()) / 1000)); },
    markJob(job) { ensure().jobAt[job] = now(); save(); },
    // 一輩子只發一次的獎勵（集章、圖鑑）
    bonusOnce(key, a, note) { const w = ensure(); if (w.bonusEver[key]) return 0; w.bonusEver[key] = 1; const got = Math.min(a, cfg.cap - w.bal); w.bal += got; w.inT += got; log('bonus', got, note); save(); return got; },
    // ---- 請客券：每天可以請 1 位同學，最多 treatMax 枚；對方要按收下
    canTreat() { const w = ensure(); if (st.mode !== 'school') return '請客券要連上線才能用'; if (st.frozen) return '你的錢包被老師暫停使用了'; if (w.treats >= cfg.treatPerDay) return '今天的請客券已經用完了，明天再來'; return ''; },
    async sendTreat(toUid, toName, a) {
      const why = api.canTreat(); if (why) return why;
      a = Math.round(a); if (!(a >= 1 && a <= cfg.treatMax)) return `一次最多請 ${cfg.treatMax} 枚`;
      if (toUid === st.uid) return '不能請自己喔';
      const w = st.w; if (w.bal < a) return '你的線上鯉魚幣不夠';
      const id = `${now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, me = (profile() || {}).name || '同學';
      try {
        await fb.set(fb.ref(NET.db, `market/inbox/${toUid}/${id}`), { from: st.uid, fromName: me, a, t: fb.serverTimestamp(), day: today() });
        fb.set(fb.ref(NET.db, `market/treatLog/${id}`), { from: st.uid, to: toUid, fromName: me, toName: String(toName).slice(0, 16), a, st: 'sent', t: fb.serverTimestamp() }).catch(() => {});
      } catch (e) { return '送不出去：請老師確認 Firebase 規則'; }
      w.bal -= a; w.outT += a; w.treats += 1; log('treat', -a, `請 ${toName} ${a} 枚`); save(); return '';
    },
    // 收下／退回／告訴老師
    async answerTreat(item, how) {
      const R = (p) => fb.ref(NET.db, p), me = (profile() || {}).name || '同學';
      await fb.remove(R(`market/inbox/${st.uid}/${item.id}`)).catch(() => {});
      fb.update(R(`market/treatLog/${item.id}`), { st: how }).catch(() => {});
      if (how === 'ok') { const got = api.earn(Math.min(item.a, cfg.treatMax), 'treat', `${item.fromName || '同學'} 請客`, false); return got; }
      await fb.set(R(`market/refunds/${item.from}/${item.id}`), { a: Math.min(item.a, cfg.treatMax), n: `${me} 沒有收下請客券` }).catch(() => {});
      if (how === 'report') api.report(`收到 ${item.fromName || '同學'} 的請客券，覺得不對勁`);
      return 0;
    },
    report(text) {
      if (st.mode !== 'school') return false;
      const id = now().toString(36);
      fb.set(fb.ref(NET.db, `market/reports/${st.uid}/${id}`), { n: String(text).slice(0, 80), name: (profile() || {}).name || '', t: fb.serverTimestamp() }).catch(() => {});
      return true;
    },
    // ---- 老師後台
    watchAll(fn) { if (!st.admin) return () => {}; return fb.onValue(fb.ref(NET.db, 'market/wallets'), (s) => fn(s.val() || {}), () => fn({})); },
    watchPath(p, fn) { return fb.onValue(fb.ref(NET.db, `market/${p}`), (s) => fn(s.val() || {}), () => fn({})); },
    grant(uid, a, note) { return fb.set(fb.ref(NET.db, `market/grants/${uid}/${now().toString(36)}${Math.random().toString(36).slice(2, 5)}`), { a: Math.round(a), n: String(note || '').slice(0, 30), t: fb.serverTimestamp() }); },
    freeze(uid, on) { return on ? fb.set(fb.ref(NET.db, `market/frozen/${uid}`), true) : fb.remove(fb.ref(NET.db, `market/frozen/${uid}`)); },
    addAdmin(email) { return fb.set(fb.ref(NET.db, `market/adminEmails/${emailKey(email)}`), true); },
    removeAdmin(key) { return fb.remove(fb.ref(NET.db, `market/adminEmails/${key}`)); },
  };
  return api;
}
