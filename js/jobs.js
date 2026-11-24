// 💼 打工：做完一輪拿線上鯉魚幣。每份工作有冷卻時間，同一份工作同時最多 3 人（多人連線時）。
// 📦 送貨員、🏖️ 沙灘清潔員、🙋 攤位小幫手、♻️ 回收分類員、🐱 貓咪照顧員、🧭 導覽小志工
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
    ({ courier: startCourier, beach: startBeach, helper: startHelper, recycle: startRecycle, catcare: startCatcare, guide: startGuide })[id]();
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
    active = null; bar.hidden = true; if (dlg.open) dlg.close();
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

  return { JOBS, status, start, quit, pick, onStall, onTourEnd, attach, get active() { return active && active.id; } };
}
