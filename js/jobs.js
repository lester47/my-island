// 💼 打工：做完一輪拿線上鯉魚幣。每份工作有冷卻時間，同一份工作同時最多 3 人（多人連線時）。
// 🚁 無人機快遞、📦 送貨員、🏖️ 沙灘清潔員、🙋 攤位小幫手、♻️ 回收分類員、🐱 貓咪照顧員、🧭 導覽小志工、👶 托嬰小幫手
import * as THREE from 'three';
import { onDisconnect } from '../vendor/firebase/firebase-database.js';

const SLOTS = 3;
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const RECYCLE_BINS = [['paper', '📰 紙類'], ['plastic', '🧴 塑膠類'], ['metal', '🥫 鐵鋁罐'], ['glass', '🍾 玻璃'], ['trash', '🗑️ 一般垃圾']];
const RECYCLE_ITEMS = [
  ['舊報紙', 'paper', '報紙是乾淨的紙，放紙類。'], ['影印紙', 'paper', '用過的影印紙還是紙類。'],
  ['寶特瓶', 'plastic', '寶特瓶是塑膠，倒乾淨放塑膠類。'], ['塑膠杯', 'plastic', '洗乾淨的塑膠杯放塑膠類。'],
  ['鋁罐', 'metal', '飲料鋁罐放鐵鋁罐。'], ['鐵罐頭', 'metal', '罐頭是鐵做的，放鐵鋁罐。'],
  ['玻璃瓶', 'glass', '玻璃瓶放玻璃類。'], ['果醬玻璃罐', 'glass', '洗乾淨的玻璃罐放玻璃類。'],
  ['用過的衛生紙', 'trash', '衛生紙髒了不能回收，是一般垃圾。'], ['破掉的陶瓷碗', 'trash', '陶瓷不是玻璃，不能回收，是一般垃圾。'],
];
// 👶 托嬰小幫手
const BABY_NAMES = ['小湯圓', '小布丁', '小饅頭', '小豆豆', '小米粒', '小芒果', '小麻糬', '小橘子'];
const DIAPER = [
  ['wash', '🧼 先洗手', '照顧寶寶前，第一件事是把手洗乾淨。'],
  ['open', '🧷 打開髒尿布', '手洗好了，接著打開髒尿布。'],
  ['wipe', '🧻 濕紙巾擦屁屁', '從前面往後面擦，擦乾淨才不會紅屁屁。'],
  ['new', '🩲 穿上新尿布', '屁屁乾淨了，換上新尿布，鬆緊剛好。'],
  ['bin', '🗑️ 髒尿布包好丟掉', '最後把髒尿布捲起來包好丟掉，再洗一次手。'],
];
const NEEDS = [
  ['milk', '🍼 餵奶', '肚子餓了，嘴巴一直找奶瓶'],
  ['sleep', '🎵 唱搖籃曲', '揉眼睛、打哈欠，想睡覺了'],
  ['toy', '🧸 拿玩具', '無聊了，伸手想要玩東西'],
  ['hug', '🤗 抱一抱', '張開雙手，想要人抱抱'],
  ['burp', '👋 輕拍背', '剛喝完奶，肚子脹脹的'],
];
const BABY_MIN = 10;        // 陪伴幾分鐘
const NEED_WAIT = 40;       // 寶寶哭了幾秒內要照顧
const MISS_MAX = 3;         // 沒照顧到幾次，家長就提早回來

export function createJobs(api) {
  // api: { C, W, K, wallet, toast, esc, openIsland, startTour, flyTo, catFace, catPurr, islandName, H }
  const { C, W, wallet, toast, esc } = api;
  const JOBS = C.economy.jobs;
  const bar = document.getElementById('jobBar'), dlg = document.getElementById('jobDlg'), body = document.getElementById('jobBody');
  let active = null, NET = null, fb = null, slots = {};
  const job = (id) => JOBS.find((j) => j.id === id);

  // ---------------- 同時最多 3 人（Firebase market/jobs/{工作}/{uid}）
  function attach(net) {
    NET = net; fb = net.fb;
    let tries = 0;
    const sub = () => { if (!net.uid()) { setTimeout(sub, 300); return; } fb.onValue(fb.ref(net.db, 'market/jobs'), (s) => { slots = s.val() || {}; }, () => { slots = {}; if (++tries < 3) setTimeout(sub, 3000); }); };
    sub();
  }
  const busyCount = (id) => { const me = NET && NET.uid(); const tNow = NET ? NET.now() : Date.now(); return Object.entries(slots[id] || {}).filter(([k, v]) => k !== me && v && tNow - (v.t || 0) < 15 * 60e3).length; };
  function claim(id) { if (!NET || !NET.uid()) return; const r = fb.ref(NET.db, `market/jobs/${id}/${NET.uid()}`); onDisconnect(r).remove().then(() => fb.set(r, { t: fb.serverTimestamp() })).catch(() => {}); }
  function release(id) { if (!NET || !NET.uid()) return; const r = fb.ref(NET.db, `market/jobs/${id}/${NET.uid()}`); fb.remove(r).catch(() => {}); onDisconnect(r).cancel().catch(() => {}); }

  // ---------------- 狀態
  function status(id) {
    const j = job(id);
    if (active && active.id === id) return { ok: false, why: '正在做這份工作', doing: true };
    if (active) return { ok: false, why: `你正在做「${job(active.id).name}」` };
    if (wallet.frozen) return { ok: false, why: '錢包被老師暫停了' };
    if (wallet.jobLeft() <= 0) return { ok: false, why: `今天打工已經賺滿 ${C.economy.dailyJob} 枚了，明天再來` };
    const wait = wallet.jobWait(id, j.cool); if (wait) return { ok: false, why: `休息一下，${Math.ceil(wait / 60)} 分鐘後才能再做`, wait };
    if (busyCount(id) >= SLOTS) return { ok: false, why: `這份工作現在有 ${SLOTS} 個人在做，等一下再來` };
    return { ok: true };
  }
  function start(id) {
    const s = status(id); if (!s.ok) { toast('💼 ' + s.why); return false; }
    active = { id, t0: Date.now() }; claim(id);
    ({ courier: startCourier, beach: startBeach, helper: startHelper, recycle: startRecycle, catcare: startCatcare, guide: startGuide, babysit: startBabysit, drone: startDrone })[id]();
    return true;
  }
  function finish() {
    const j = job(active.id), id = active.id;
    cleanup(); wallet.markJob(id);
    const got = wallet.earn(j.pay, 'job', `打工：${j.name}`, true);
    toast(got >= j.pay ? `💰 ${j.icon} ${j.name}完成！賺到 ${got} 枚線上鯉魚幣` : got > 0 ? `💰 ${j.name}完成！賺到 ${got} 枚（今天打工或錢包已經到上限）` : `${j.name}完成了！不過今天打工已經賺滿，或錢包滿了`);
    api.onChange && api.onChange();
  }
  function quit(msg) { if (!active) return; cleanup(); toast(msg || '已經放棄這份工作'); api.onChange && api.onChange(); }
  function cleanup() {
    if (!active) return;
    release(active.id);
    if (active.trash) for (const t of active.trash) W.scene.remove(t.g);
    if (active.stop) active.stop();
    active = null; bar.hidden = true; bar.classList.remove('cry'); if (dlg.open) dlg.close();
  }
  function showBar(title, line, btns = []) {
    bar.hidden = false;
    bar.innerHTML = `<p class="jt">${esc(title)}</p><p class="jm">${esc(line)}</p><div class="jb">${btns.map(([k, t]) => `<button type="button" data-j="${k}">${esc(t)}</button>`).join('')}<button type="button" data-j="quit">放棄</button></div>`;
    bar.querySelectorAll('[data-j]').forEach((b) => (b.onclick = () => { const k = b.dataset.j; if (k === 'quit') quit(); else active && active.onBtn && active.onBtn(k); }));
  }
  function showDlg(html, onClick) {
    body.innerHTML = html; if (!dlg.open) dlg.showModal();
    body.onclick = (e) => { const b = e.target.closest('[data-q]'); if (b && !b.disabled) onClick(b.dataset.q, b); };
  }
  dlg.addEventListener('close', () => { if (active && active.inDlg && !active.done) quit('工作視窗關掉了，這次打工沒有完成'); });

  // ---------------- 🚁 無人機快遞：開遙控無人機，把 2 個包裹送到指定的島（降到黃色光柱裡）
  function startDrone() {
    active.stop = () => api.droneJob && api.droneJob.stop();
    active.onBtn = () => {};
    const ok = api.droneJob && api.droneJob.start({
      bar: (line) => showBar('🚁 無人機快遞', line, []),
      done: () => { if (active && active.id === 'drone') finish(); },
      fail: (msg) => { if (active && active.id === 'drone') quit(msg); },
    });
    if (!ok) { cleanup(); }
  }

  // ---------------- 📦 送貨員：把 3 張送貨單送到指定攤位（打開那一攤的介紹）
  function startCourier() {
    const pool = shuffle(C.stalls.filter((s) => s.name && !s.namePending && !/待確認/.test(s.name)));
    active.list = pool.slice(0, 3); active.i = 0;
    active.onBtn = (k) => { if (k === 'map') api.openIsland(active.list[active.i].island); };
    courierBar();
  }
  function courierBar() {
    const s = active.list[active.i];
    showBar(`📦 送貨員　${active.i + 1}/3`, `把貨送到「${String(s.no).padStart(2, '0')} ${s.name}」（${api.islandName(s.island)}）：找到這一攤、點開它的介紹就送達`, [['map', '🗺️ 飛到那座島']]);
  }
  function onStall(no) {
    if (!active || active.id !== 'courier') return;
    const s = active.list[active.i]; if (s.no !== +no) return;
    active.i++;
    if (active.i >= 3) { finish(); return; }
    toast(`📦 送達「${s.name}」！下一張送貨單來了`); courierBar();
  }

  // ---------------- 🏖️ 沙灘清潔員：撿 5 個沙灘上的垃圾
  function trashMesh(kind) {
    const g = new THREE.Group(), m = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: .7, flatShading: true });
    if (kind === 0) { const a = new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, .36, 10), m('#d23b3b')); a.rotation.z = Math.PI / 2; g.add(a); }
    else if (kind === 1) { const a = new THREE.Mesh(new THREE.CylinderGeometry(.11, .11, .5, 8), m('#3f9a5a')); a.rotation.z = Math.PI / 2.3; g.add(a); const n = new THREE.Mesh(new THREE.CylinderGeometry(.05, .07, .14, 8), m('#3f9a5a')); n.position.set(.3, .1, 0); n.rotation.z = Math.PI / 2.3; g.add(n); }
    else { const a = new THREE.Mesh(new THREE.IcosahedronGeometry(.2, 0), m('#f2efe6')); g.add(a); }
    const hit = new THREE.Mesh(new THREE.SphereGeometry(.75, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); g.add(hit);
    g.scale.setScalar(1.4); return { g, hit };
  }
  function startBeach() {
    const ids = shuffle(['center', ...C.islands.map((i) => i.id)]);
    active.trash = [];
    for (let k = 0; k < 5; k++) {
      const I = W.islands[ids[k % ids.length]]; if (!I || !I.shellSpot) continue;
      const rel = I.shellSpot.clone().sub(I.pos), a = Math.atan2(rel.z, rel.x) + (k < ids.length ? 1.1 : -1.1), r = Math.hypot(rel.x, rel.z);
      const T = trashMesh(k % 3); T.g.position.set(I.pos.x + Math.cos(a) * r, .46, I.pos.z + Math.sin(a) * r); T.g.rotation.y = Math.random() * 6;
      W.scene.add(T.g); active.trash.push({ ...T, island: I.id });
    }
    active.onBtn = (k) => { if (k === 'next') { const t = active.trash.find((x) => x.g.parent); if (t) api.flyTo(t.g.position); } };
    beachBar();
  }
  function beachBar() { const left = active.trash.filter((x) => x.g.parent).length; showBar(`🏖️ 沙灘清潔員　還剩 ${left} 個`, '沙灘上有垃圾！點垃圾把它撿起來（汽水罐、玻璃瓶、紙團）', [['next', '🔍 帶我去下一個']]); }
  function pick(ray) {
    if (!active || active.id !== 'beach') return false;
    const live = active.trash.filter((x) => x.g.parent);
    const h = ray.intersectObjects(live.map((x) => x.hit), false)[0]; if (!h) return false;
    const t = live.find((x) => x.hit === h.object); W.scene.remove(t.g);
    const left = live.length - 1;
    if (!left) { finish(); return true; }
    toast(`🧹 撿起來了！還剩 ${left} 個`); beachBar(); return true;
  }

  // ---------------- 🙋 攤位小幫手：回答 3 題攤位問題
  function startHelper() {
    const st = shuffle(C.stalls.filter((s) => s.name && !s.namePending && !/待確認/.test(s.name)));
    const isl = ['center', ...C.islands.map((i) => i.id)].filter((id) => id !== 'center');
    active.qs = st.slice(0, 3).map((s, i) => {
      if (i % 2 === 0) { const opts = shuffle([s.island, ...shuffle(isl.filter((x) => x !== s.island)).slice(0, 3)]); return { q: `「${s.name}」在哪一座島？`, opts: opts.map((x) => [x, api.islandName(x)]), ans: s.island }; }
      const others = shuffle(st.filter((x) => x.no !== s.no)).slice(0, 3);
      return { q: `第 ${String(s.no).padStart(2, '0')} 攤是哪一攤？`, opts: shuffle([s, ...others]).map((x) => [String(x.no), x.name]), ans: String(s.no) };
    });
    active.i = 0; active.inDlg = true; helperQ();
  }
  function helperQ(msg) {
    const Q = active.qs[active.i];
    showDlg(`<p class="job-h">🙋 攤位小幫手　第 ${active.i + 1}/3 題</p>${msg ? `<p class="job-msg">${esc(msg)}</p>` : ''}<p class="job-q">${esc(Q.q)}</p><div class="job-opts">${Q.opts.map(([k, t]) => `<button type="button" class="btn ghost" data-q="${esc(k)}">${esc(t)}</button>`).join('')}</div><p class="foot">答錯沒關係，再選一次就好。可以先打開「清單」查一查。</p>`, (k, b) => {
      if (k !== Q.ans) { b.disabled = true; b.classList.add('wrong'); return; }
      active.i++;
      if (active.i >= 3) { active.done = true; finish(); return; }
      helperQ('✅ 答對了！');
    });
  }

  // ---------------- ♻️ 回收分類員：把 10 件東西丟進正確的回收桶
  function startRecycle() { active.items = shuffle(RECYCLE_ITEMS); active.i = 0; active.inDlg = true; recycleQ(); }
  function recycleQ(msg, bad) {
    const it = active.items[active.i];
    showDlg(`<p class="job-h">♻️ 回收分類員　${active.i + 1}/10</p>${msg ? `<p class="job-msg ${bad ? 'bad' : ''}">${esc(msg)}</p>` : ''}<p class="job-q">「${esc(it[0])}」要丟到哪裡？</p><div class="job-opts bins">${RECYCLE_BINS.map(([k, t]) => `<button type="button" class="btn ghost" data-q="${k}">${t}</button>`).join('')}</div>`, (k) => {
      if (k !== it[1]) { recycleQ(`再想想：${it[2]}`, true); return; }
      active.i++;
      if (active.i >= 10) { active.done = true; finish(); return; }
      recycleQ(`✅ 對！${it[2]}`);
    });
  }

  // ---------------- 🐱 貓咪照顧員：加水、梳毛、清貓砂（各按住 3 秒）
  function startCatcare() {
    const cats = (api.K && api.K.cats) || [];
    const c = cats[Math.floor(Math.random() * cats.length)]; active.cat = c; active.inDlg = true; active.done3 = {};
    if (c) api.flyTo(c.M.g.position);
    catcareDlg();
  }
  function catcareDlg() {
    const d = active.cat ? active.cat.data : { name: '貓咪' };
    const T = [['water', '💧 加水'], ['brush', '🪮 梳毛'], ['litter', '🧹 清貓砂']];
    showDlg(`<p class="job-h">🐱 貓咪照顧員</p><div class="catrow">${active.cat ? api.catFace(d, 56) : ''}<p>今天照顧 <b>${esc(d.name)}</b>（${esc(api.islandName(d.island || 'center'))}）。每件事都要<b>按住 3 秒</b>，慢慢來、溫柔一點。</p></div>
      <div class="job-opts care">${T.map(([k, t]) => `<button type="button" class="btn ${active.done3[k] ? '' : 'ghost'} hold" data-h="${k}" ${active.done3[k] ? 'disabled' : ''}><span class="fill"></span><span class="lb">${t}${active.done3[k] ? ' ✓' : ''}</span></button>`).join('')}</div><p class="foot">照顧貓不是擼貓，不用抽號碼牌。</p>`, () => {});
    body.querySelectorAll('[data-h]').forEach((b) => {
      let tm = null, t0 = 0, raf = 0;
      const stop = () => { clearTimeout(tm); cancelAnimationFrame(raf); b.querySelector('.fill').style.width = '0%'; };
      const step = () => { b.querySelector('.fill').style.width = `${Math.min(100, (Date.now() - t0) / 30)}%`; raf = requestAnimationFrame(step); };
      b.addEventListener('pointerdown', (e) => { if (b.disabled) return; e.preventDefault(); t0 = Date.now(); step(); tm = setTimeout(() => { stop(); active.done3[b.dataset.h] = 1; if (active.cat) api.catPurr(active.cat); if (Object.keys(active.done3).length >= 3) { active.done = true; finish(); } else catcareDlg(); }, 3000); });
      for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, stop);
    });
  }

  // ---------------- 🧭 導覽小志工：帶新訪客跑完整趟自動導覽，不能中途結束
  function startGuide() { active.onBtn = () => {}; showBar('🧭 導覽小志工', '帶新訪客跑完整趟「自動導覽」，六站都要看完，中途結束就不算'); api.startTour(); }
  function onTourEnd(natural) {
    if (!active || active.id !== 'guide') return;
    if (natural) finish(); else quit('導覽中途結束了，這次打工沒有完成');
  }

  // ---------------- 👶 托嬰小幫手：訪客家長把小寶寶托給服務台。先照順序換尿布，再陪伴 10 分鐘（網頁在背景時暫停計時）
  function babyMesh() {
    const g = new THREE.Group(), m = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: .8, flatShading: true });
    const box = (c, x, y, z, sx, sy, sz) => { const o = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m(c)); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
    box('#f4d7a8', 0, .3, 0, .9, .08, .55);                                       // 床底
    for (const x of [-.45, .45]) box('#e8b46a', x, .38, 0, .05, .5, .6);           // 床頭床尾
    for (const z of [-.28, .28]) for (let i = -3; i <= 3; i++) box('#f6e3c1', i * .12, .45, z, .03, .3, .03);   // 欄杆
    box('#ffd6e0', 0, .37, 0, .8, .05, .5);                                       // 小被子
    const baby = new THREE.Group(); baby.position.set(0, .45, 0); g.add(baby);
    const body = new THREE.Mesh(new THREE.SphereGeometry(.13, 10, 8), m('#bfe3ff')); body.scale.set(1.3, .8, 1); baby.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.1, 10, 8), m('#ffd9b8')); head.position.set(-.2, .04, 0); baby.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(.04, 8, 6), m('#6b4a2b')); hair.position.set(-.22, .14, 0); baby.add(hair);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(1.1, .9, .8), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = .4; g.add(hit);
    return { g, baby };
  }
  function startBabysit() {
    const name = BABY_NAMES[Math.floor(Math.random() * BABY_NAMES.length)];
    Object.assign(active, { baby: name, step: 0, inDlg: true, left: BABY_MIN * 60, need: null, needT: 0, nextNeed: 25, missed: 0, cared: 0 });
    const P = api.agencyPos ? api.agencyPos() : null;
    if (P) {
      const B = babyMesh(); const d = new THREE.Vector3(P.x, 0, P.z).normalize();
      B.g.position.set(P.x + d.z * 1.3, P.y, P.z - d.x * 1.3); B.g.rotation.y = Math.atan2(d.x, d.z);
      W.scene.add(B.g); active.crib = B; active.cribPos = B.g.position.clone();
      api.flyTo(B.g.position);
    }
    diaperDlg();
  }
  function diaperDlg(msg, bad) {
    const done = DIAPER.slice(0, active.step), opts = shuffle(DIAPER.slice(active.step));
    showDlg(`<p class="job-h">👶 托嬰小幫手　換尿布 ${active.step}/${DIAPER.length}</p>
      ${active.step === 0 && !msg ? `<p class="job-msg">有位訪客家長要去逛攤位，把小寶寶「<b>${esc(active.baby)}</b>」托給服務台 ${BABY_MIN} 分鐘。寶寶的尿布濕了，先幫他換尿布！</p>` : ''}
      ${msg ? `<p class="job-msg ${bad ? 'bad' : ''}">${esc(msg)}</p>` : ''}
      ${done.length ? `<ol class="baby-done">${done.map((d) => `<li>${d[1]} ✓</li>`).join('')}</ol>` : ''}
      <p class="job-q">下一步要做什麼？</p><div class="job-opts">${opts.map(([k, t]) => `<button type="button" class="btn ghost" data-q="${k}">${t}</button>`).join('')}</div>
      <p class="foot">換尿布要照順序。選錯沒關係，會告訴你提示。</p>`, (k) => {
      const want = DIAPER[active.step];
      if (k !== want[0]) { diaperDlg(`還不是這一步喔：${DIAPER[active.step][2].split('，')[0]}…想想看要先做什麼？`, true); return; }
      active.step++;
      if (active.step >= DIAPER.length) { active.inDlg = false; dlg.close(); babyWatch(); return; }
      diaperDlg(`✅ ${want[2]}`);
    });
  }
  function babyWatch() {
    toast(`👶 尿布換好了！接下來陪 ${active.baby} ${BABY_MIN} 分鐘，寶寶哭了要選對照顧方法`);
    active.onBtn = (k) => {
      if (k === 'look') { if (active.cribPos) api.flyTo(active.cribPos); return; }
      if (!active.need) { toast(`😊 ${active.baby}現在很好，不用打擾他`); return; }
      if (k !== active.need[0]) { toast(`🤔 好像不是這個…再看看：${active.baby}${active.need[2]}`); return; }
      active.cared++; toast(`💕 ${active.need[1].slice(2)}之後，${active.baby}笑了！`);
      active.need = null; active.nextNeed = 45 + Math.floor(Math.random() * 40); babyBar();
    };
    babyBar();
    const iv = setInterval(babyTick, 1000), cb = active.crib;
    active.stop = () => { clearInterval(iv); if (cb) W.scene.remove(cb.g); };
  }
  function babyTick() {
    if (!active || active.id !== 'babysit' || active.inDlg) return;
    if (document.hidden) { babyTime(true); return; }
    active.left--;
    if (active.crib) { const b = active.crib.baby, t = Date.now() / 1000; b.rotation.z = active.need ? Math.sin(t * 14) * .12 : Math.sin(t * 1.5) * .04; }
    if (active.left <= 0) { const n = active.baby, c = active.cared; active.done = true; finish(); toast(`👨‍👩‍👧 家長回來接 ${n} 了，謝謝你照顧了 ${c} 次！`); return; }
    if (active.need) {
      if (Date.now() - active.needT > NEED_WAIT * 1000) {
        active.missed++; active.need = null; active.nextNeed = 30;
        if (active.missed >= MISS_MAX) { quit(`😭 ${active.baby}哭了好久，家長提早回來接走了。這次打工沒有完成`); return; }
        toast(`😢 ${active.baby}哭了一陣子沒人理（${active.missed}/${MISS_MAX}），要多注意喔`); babyBar(); return;
      }
    } else if (--active.nextNeed <= 0) {
      active.need = NEEDS[Math.floor(Math.random() * NEEDS.length)]; active.needT = Date.now(); babyBar(); return;
    }
    babyTime(false);
  }
  const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  function babyTime(paused) {
    const t = bar.querySelector('.jt'); if (!t) return;
    const w = active.need ? Math.max(0, NEED_WAIT - Math.floor((Date.now() - active.needT) / 1000)) : 0;
    t.textContent = `👶 托嬰小幫手　陪伴剩 ${mmss(active.left)}${paused ? '（暫停中）' : ''}`;
    const m = bar.querySelector('.jm'); if (m && active.need) m.textContent = `😢 ${active.baby}${active.need[2]}！選對的照顧方法（還有 ${w} 秒）`;
  }
  function babyBar() {
    showBar(`👶 托嬰小幫手　陪伴剩 ${mmss(active.left)}`, active.need ? `😢 ${active.baby}${active.need[2]}！選對的照顧方法（還有 ${NEED_WAIT} 秒）` : `😊 ${active.baby}在嬰兒床裡玩。寶寶哭了會出現提示，選對照顧方法；網頁關到背景時會暫停計時。`,
      [...NEEDS.map(([k, t]) => [k, t]), ['look', '👀 看寶寶']]);
    bar.classList.toggle('cry', !!active.need);
  }

  return { JOBS, status, start, quit, pick, onStall, onTourEnd, attach, get active() { return active && active.id; } };
}
