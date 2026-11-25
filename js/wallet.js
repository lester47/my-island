// 🪙 線上鯉魚幣錢包（Firebase）
// 規則：每天固定發起始幣，當天結束歸零（隔天重新發）；打工每天最多賺 dailyJob；錢包最多 cap。
// 跟現場的實體鯉魚幣無關，也不能用真錢買。
// 資料：market/wallets/{uid}（自己的錢包）、market/grants/{uid}（老師加發／扣回）、market/frozen/{uid}（凍結）、
//       market/adminEmails/{email}（老師名冊：用 email 登入的老師，. 換成 ,）、market/inbox/{uid}（收到的請客券）、market/refunds/{uid}（被退回的請客券）、
//       market/treatLog（請客紀錄，老師看）、market/reports/{uid}（告訴老師）
// 還沒連上線、或 Firebase 規則還沒貼上時：用「體驗錢包」，只存在這台裝置。
const LKEY = 'liyu115.wallet.v1';
const TKEY = 'liyu115.teacherTest';
const testOn = () => { try { return localStorage.getItem(TKEY) !== '0'; } catch (e) { return true; } };   // 預設開啟
const DAY_TZ = 'Asia/Taipei';
export const emailKey = (e) => String(e || '').trim().toLowerCase().replace(/\./g, ',');

export function createWallet({ cfg, onChange, toast }) {
  const st = { mode: 'trial', uid: null, admin: false, frozen: false, blocked: false, w: null, inbox: [] };
  let NET = null, fb = null, profile = () => null, saving = Promise.resolve(), loaded = false;
  const now = () => (NET ? NET.now() : Date.now());
  const today = () => new Date(now()).toLocaleDateString('sv-SE', { timeZone: DAY_TZ });
  // 台灣日期的「第幾天」（伺服器規則用同一個算法檢查：不能自己把日期往後調來重領起始幣）
  const dayNo = () => Math.floor((now() + 8 * 3600e3) / 86400e3);
  const GAIN_CAP = cfg.gainCap ?? 100;
  const RF_CAP = cfg.refundCap ?? 60;     // 每天最多退款幾枚（擼貓過號、放棄排隊、請客券被退回…）：跟伺服器規則一致   // 每天「賺來的」最多幾枚（打工、獎勵、收到的請客）：跟伺服器規則一致
  const fresh = (old) => ({
    day: today(), dn: dayNo(), bal: cfg.start, earned: 0, gain: 0, rf: 0, plays: {}, jobAt: {}, treats: 0, inT: cfg.start, outT: 0,
    log: [{ t: now(), k: 'start', a: cfg.start, n: '今天的起始幣' }],
    bonusEver: (old && old.bonusEver) || {}, applied: (old && old.applied) || {},
  });
  // Firebase 不會存空的清單（{}、[]），讀回來會少欄位：補回預設值，避免付錢時出錯
  const fix = (w) => {
    if (!w) return w;
    w = { ...w };
    for (const k of ['plays', 'jobAt', 'bonusEver', 'applied']) if (!w[k] || typeof w[k] !== 'object') w[k] = {};
    if (!Array.isArray(w.log)) w.log = w.log && typeof w.log === 'object' ? Object.values(w.log) : [];
    for (const k of ['bal', 'earned', 'treats', 'inT', 'outT', 'gain', 'rf']) if (typeof w[k] !== 'number') w[k] = 0;
    if (typeof w.dn !== 'number') w.dn = dayNo();   // 舊版錢包：補上日期編號
    return w;
  };
  // 換日：錢包歸零，重新發今天的起始幣
  const roll = (w) => (w && w.day === today() ? fix(w) : fresh(w));
  const ensure = () => { if (st.w && st.w.day === today()) { if (!st.w.plays || !st.w.jobAt || !Array.isArray(st.w.log)) st.w = fix(st.w); return st.w; } st.w = roll(st.w); save(); return st.w; };
  const log = (k, a, n) => { const w = st.w; w.log = [{ t: now(), k, a, n: String(n).slice(0, 40) }, ...(w.log || [])].slice(0, 40); };

  function loadLocal() { try { const v = JSON.parse(localStorage.getItem(LKEY)); st.w = roll(v && typeof v.bal === 'number' ? v : null); } catch (e) { st.w = fresh(); } }
  function save(extra) {
    const w = st.w; if (!w) return;
    if (st.mode === 'trial') { try { localStorage.setItem(LKEY, JSON.stringify(w)); } catch (e) { /* 私密模式：只是不記住 */ } onChange(); return; }
    const p = profile() || {};
    const data = { ...w, name: p.name || '', role: p.role || '', upd: fb.serverTimestamp() };
    const write = extra ? () => fb.update(fb.ref(NET.db), { [`market/wallets/${st.uid}`]: data, ...extra }) : () => fb.set(fb.ref(NET.db, `market/wallets/${st.uid}`), data);
    saving = saving.then(write).catch((e) => fail(e));
    onChange();
  }
  // Firebase 規則不允許：退回體驗錢包
  function fail(e) {
    if (st.mode === 'trial') return;
    // 已經連上學校錢包之後被拒絕：不退回體驗錢包（那樣就能在本機亂改），改成以伺服器上的為準，並告訴老師
    if (loaded) {
      console.warn('鯉魚幣：這筆異動被伺服器拒絕，改用伺服器上的錢包', e && e.code);
      st.rejects = (st.rejects || 0) + 1;
      if (st.rejects <= 3) fb.set(fb.ref(NET.db, `market/reports/${st.uid}/w${now().toString(36)}`), { n: '⚠️ 錢包異動被伺服器拒絕（可能有人改了網頁上的數字）', name: (profile() || {}).name || '', t: fb.serverTimestamp(), k: 'wallet' }).catch(() => {});
      fb.get && fb.get(fb.ref(NET.db, `market/wallets/${st.uid}`)).then((sn) => { const v = sn.val(); if (v && typeof v.bal === 'number') { st.w = roll(v); onChange(); } }).catch(() => {});
      toast('⚠️ 錢包和伺服器對不上，已經用伺服器上的數字');
      return;
    }
    console.warn('鯉魚幣：Firebase 規則還沒允許錢包，先用體驗錢包', e && e.code);
    st.mode = 'trial'; st.blocked = true; loadLocal(); onChange();
  }
  loadLocal();

  const api = {
    get mode() { return st.mode; },
    get admin() { return st.admin; },
    // 🧪 老師測試模式（名冊上的老師才有）：花費不扣錢、不受每日次數限制、打工沒有冷卻和每日上限。存檔的餘額不變。
    get test() { return st.admin && testOn(); },
    setTest(v) { try { localStorage.setItem(TKEY, v ? '1' : '0'); } catch (e) { /* 無痕模式 */ } onChange('test'); },
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
          const g = s.val() || {}; if (!loaded) return; const w = ensure();
          for (const [id, op] of Object.entries(g)) {
            if (w.applied[id] || !op || op.used || typeof op.a !== 'number') continue;
            w.applied[id] = 1; w.lg = id;                                   // 這次套用的是哪一筆（伺服器規則會對帳，並把這筆標成用過）
            const a = Math.round(op.a);
            if (a >= 0) { const got = Math.min(a, cfg.cap - w.bal); w.bal += got; w.inT += got; log('grant', got, `老師加發：${op.n || ''}`); toast(`🧑‍🏫 老師加發 ${got} 枚線上鯉魚幣！${op.n ? `（${String(op.n).slice(0, 20)}）` : ''}`); }
            else { const take = Math.min(-a, w.bal); w.bal -= take; w.outT += take; log('grant', -take, `老師扣回：${op.n || ''}`); toast(`🧑‍🏫 老師扣回 ${take} 枚線上鯉魚幣${op.n ? `（${String(op.n).slice(0, 20)}）` : ''}`); }
            save({ [`market/grants/${uid}/${id}/used`]: true });             // 一筆一存
          }
        }, () => {});
        // 收到的請客券
        fb.onValue(R(`market/inbox/${uid}`), (s) => { const v = s.val() || {}; st.inbox = Object.entries(v).map(([id, x]) => ({ id, ...x })).filter((x) => typeof x.a === 'number'); onChange('inbox'); }, () => {});
        // 被退回的請客券：錢還給自己
        fb.onValue(R(`market/refunds/${uid}`), (s) => {
          const v = s.val() || {}; if (!loaded) return; const w = ensure(); let changed = false;
          for (const [id, x] of Object.entries(v)) {
            fb.remove(R(`market/refunds/${uid}/${id}`)).catch(() => {});
            if (w.applied['r' + id] || !x || typeof x.a !== 'number') continue;
            w.applied['r' + id] = 1;
            const a = Math.max(0, Math.min(Math.round(x.a), cfg.treatMax, cfg.cap - w.bal, w.outT, RF_CAP - w.rf)); w.bal += a; w.outT -= a; w.rf += a;   // 退回＝退款：今天花掉的減少
            log('refund', a, x.n || '請客券退回'); toast(`↩️ ${x.n || '請客券被退回'}，${a} 枚還給你`);
            save();                                                                            // 一筆一存：伺服器一次只接受一種異動
          }
        }, () => {});
      }, 300);
    },
    // ---- 付錢
    canPay(price, key, limit) {
      const w = ensure();
      if (api.test) return '';
      if (st.frozen) return '你的錢包被老師暫停使用了，請找老師';
      if (key && limit && (w.plays[key] || 0) >= limit) return `今天這個已經玩 ${limit} 次了，明天再來`;
      if (w.bal < price) return `線上鯉魚幣不夠（要 ${price}，你有 ${w.bal}），去打工賺一點吧`;
      return '';
    },
    pay(price, kind, note, key) {
      const why = api.canPay(price, key, key ? Infinity : 0); if (why) return why;
      if (api.test) { log(kind, 0, `🧪 ${note}（老師測試・免費，原價 ${price}）`); save(); return ''; }
      const w = st.w; w.bal -= price; w.outT += price; if (key) w.plays[key] = (w.plays[key] || 0) + 1;
      log(kind, -price, note); save(); return '';
    },
    // 退款：只能退今天真的花掉的錢（伺服器規則：退款＝「今天花掉的」減少一樣多）
    refund(a, note) { const w = ensure(); const got = Math.max(0, Math.min(a, cfg.cap - w.bal, w.outT, RF_CAP - w.rf)); if (!got) return 0; w.bal += got; w.outT -= got; w.rf += got; log('refund', got, note); save(); return got; },
    // ---- 賺錢：打工有每日上限，錢包有上限
    earn(a, kind, note, isJob) {
      const w = ensure(); if (st.frozen) return 0;
      if (api.test) { log(kind, 0, `🧪 ${note}（老師測試：會賺 ${a} 枚）`); save(); return a; }
      let got = Math.min(a, cfg.cap - w.bal, GAIN_CAP - w.gain, 50);
      if (isJob) got = Math.min(got, cfg.dailyJob - w.earned);
      got = Math.max(0, got);
      if (got) { w.bal += got; w.inT += got; w.gain += got; if (isJob) w.earned += got; log(kind, got, note); save(); }
      return got;
    },
    jobLeft() { return api.test ? Infinity : Math.max(0, cfg.dailyJob - ensure().earned); },
    jobWait(job, cool) { if (api.test) return 0; const t = ensure().jobAt[job] || 0; return Math.max(0, Math.ceil((t + cool * 1000 - now()) / 1000)); },
    markJob(job) { ensure().jobAt[job] = now(); save(); },
    // 一輩子只發一次的獎勵（集章、圖鑑）
    bonusOnce(key, a, note) { const w = ensure(); if (w.bonusEver[key]) return 0; w.bonusEver[key] = 1; const got = Math.max(0, Math.min(a, cfg.cap - w.bal, GAIN_CAP - w.gain, 50)); w.bal += got; w.inT += got; w.gain += got; log('bonus', got, note); save(); return got; },
    // ---- 請客券：每天可以請 1 位同學，最多 treatMax 枚；對方要按收下
    canTreat() { const w = ensure(); if (st.mode !== 'school') return '請客券要連上線才能用'; if (st.frozen) return '你的錢包被老師暫停使用了'; if (w.treats >= cfg.treatPerDay) return '今天的請客券已經用完了，明天再來'; return ''; },
    async sendTreat(toUid, toName, a) {
      const why = api.canTreat(); if (why) return why;
      a = Math.round(a); if (!(a >= 1 && a <= cfg.treatMax)) return `一次最多請 ${cfg.treatMax} 枚`;
      if (toUid === st.uid) return '不能請自己喔';
      const w = st.w; if (w.bal < a) return '你的線上鯉魚幣不夠';
      const id = `${now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, me = (profile() || {}).name || '同學';
      // 請客券和自己的錢包扣款「一起」寫：伺服器會檢查送出的金額＝自己錢包少掉的錢，對不上就整筆拒絕（不能不花錢一直送）
      const nw = { ...w, bal: w.bal - a, outT: w.outT + a, treats: (w.treats || 0) + 1, tr: id };
      nw.log = [{ t: now(), k: 'treat', a: -a, n: `請 ${String(toName).slice(0, 16)} ${a} 枚` }, ...(w.log || [])].slice(0, 40);
      const p = profile() || {};
      try {
        await saving;
        await fb.update(fb.ref(NET.db), {
          [`market/wallets/${st.uid}`]: { ...nw, name: p.name || '', role: p.role || '', upd: fb.serverTimestamp() },
          [`market/inbox/${toUid}/${id}`]: { from: st.uid, fromName: me, a, t: fb.serverTimestamp(), day: today() },
        });
      } catch (e) { return '送不出去：請客券和錢包對不上，請重新整理再試'; }
      st.w = nw; onChange();
      fb.set(fb.ref(NET.db, `market/treatLog/${id}`), { from: st.uid, to: toUid, fromName: me, toName: String(toName).slice(0, 16), a, st: 'sent', t: fb.serverTimestamp() }).catch(() => {});
      return '';
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
