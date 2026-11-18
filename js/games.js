// 小遊戲：🎣 釣魚（三個釣魚區）與 🙈 躲貓貓（找出 5 個躲起來的小朋友）
import * as THREE from 'three';

const TAU = Math.PI * 2;
const FONT = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif';
const M = {};
const mat = (c, o = {}) => { const k = c + JSON.stringify(o); return M[k] || (M[k] = new THREE.MeshStandardMaterial({ color: c, roughness: .7, ...o })); };
const G = { box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(.5, .5, 1, 10), sph: new THREE.SphereGeometry(.5, 12, 10), cone: new THREE.ConeGeometry(.5, 1, 10) };
const add = (p, geo, c, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, typeof c === 'string' ? mat(c) : c); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz); m.castShadow = true; p.add(m); return m; };
function label(text, bg, w = 360) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = 100;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const paint = () => { const g = cv.getContext('2d'); g.clearRect(0, 0, w, 100); g.fillStyle = bg; g.beginPath(); g.roundRect(4, 4, w - 8, 92, 24); g.fill(); g.fillStyle = '#fff'; g.font = `900 44px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, 54); tex.needsUpdate = true; };
  paint(); if (document.fonts) document.fonts.ready.then(paint);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex })); s.scale.set(w / 100 * .42, .42, 1); return s;
}

// 釣得到的東西（weight 越大越常見）
export const FISH = [
  { id: 'tilapia', name: '吳郭魚', icon: '🐟', w: 30, size: [18, 30] },
  { id: 'zacco', name: '溪哥', icon: '🐠', w: 24, size: [8, 14] },
  { id: 'carp', name: '鯉魚', icon: '🐟', w: 18, size: [30, 55], img: 3 },
  { id: 'kohaku', name: '紅白錦鯉', icon: '🎏', w: 12, size: [25, 45], img: 1 },
  { id: 'ogon', name: '黃金錦鯉（稀有）', icon: '✨', w: 5, size: [30, 50], img: 2 },
  { id: 'bottle', name: '寶特瓶（垃圾）', icon: '🧴', w: 11, trash: true },
];

export function createGames(W, content, H, api) {
  const { scene, islands } = W;
  const root = new THREE.Group(); scene.add(root);
  const picks = [], anim = [];
  const R = Math.random;

  // ================================================================ 🎣 釣魚
  const spots = [];
  function fishingSpot(pos, dir, name) {
    const g = new THREE.Group(); g.position.copy(pos); g.rotation.y = Math.atan2(dir.x, dir.z); root.add(g);
    add(g, G.box, '#a8743f', 0, .03, 0, 1.3, .06, 1.0);                                   // 小木平台
    add(g, G.cyl, '#7a4a22', -.5, .2, -.2, .3, .3, .3);                                   // 小板凳
    add(g, G.cyl, '#2f7fd1', .45, .16, -.25, .38, .26, .38);                              // 水桶
    add(g, G.cyl, '#1d5aa0', .45, .3, -.25, .4, .03, .4);
    const rodHold = add(g, G.cyl, '#5a3a1a', -.45, .35, .35, .06, .5, .06);                // 竿架
    add(g, G.cyl, '#3a2a1a', -.45, .95, .75, .03, 1.5, .03, .75);                         // 立著的釣竿
    const sp = label('🎣 釣魚區', '#2f7fd1'); sp.position.set(0, 1.9, 0); g.add(sp);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.2, 1.4), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 1; g.add(hit);
    // 浮標：釣魚時出現在前方水面
    const bob = new THREE.Group(); bob.visible = false; root.add(bob);
    add(bob, G.sph, '#ffffff', 0, 0, 0, .18, .18, .18); add(bob, G.sph, '#e8473f', 0, .08, 0, .19, .1, .19); add(bob, G.cyl, '#222', 0, .18, 0, .02, .16, .02);
    const ring = new THREE.Mesh(new THREE.RingGeometry(.2, .26, 20), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; root.add(ring);
    const water = pos.clone().addScaledVector(dir, 3.2); water.y = .05;
    const s = { g, pos, dir, name, bob, ring, water, stand: pos.clone().addScaledVector(dir, -.1) };
    spots.push(s); picks.push({ obj: hit, act: () => goFish(s) }); picks.push({ obj: sp, act: () => goFish(s) });
    anim.push((t) => { sp.position.y = 1.9 + Math.sin(t * 2 + spots.length) * .05; });
  }
  // ① 鯉魚號碼頭的棧道盡頭（棧道旁）
  if (W.pier) {
    const P = W.pier, pos = P.E.clone().addScaledVector(P.d, P.ST1 + 1.4).addScaledVector(P.s, -(P.PW - .55));
    const g0 = W.ground(pos.x, pos.z); if (g0 != null) { pos.y = g0; fishingSpot(pos, P.s.clone().negate(), '碼頭釣魚區'); }
  }
  // ②③ 美食補給島、循環挖寶島的外側岸邊
  for (const id of ['food', 'recycle']) {
    const I = islands[id]; if (!I) continue;
    const out = Math.atan2(I.pos.z, I.pos.x);
    for (const da of [0, .35, -.35, .7, -.7, 1.0, -1.0]) {
      const a = out + da, r = I.top(a) * .8, x = I.pos.x + Math.cos(a) * r, z = I.pos.z + Math.sin(a) * r;
      if (W.ground(x, z) == null || api.nearBooth(x, z, 2.2)) continue;
      fishingSpot(new THREE.Vector3(x, H, z), new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), (content.islands.find((q) => q.id === id) || {}).name + '岸邊釣魚區');
      break;
    }
  }

  // 釣魚面板（畫面下方）
  const ui = document.getElementById('fishUI');
  const uiTxt = ui.querySelector('.ft'), uiBtn = ui.querySelector('.fb'), uiLog = ui.querySelector('.fl');
  const logGet = () => api.store.get('fishlog', {}) || {};
  function refreshLog() { const L = logGet(), n = FISH.filter((f) => L[f.id]).length; uiLog.textContent = `📖 圖鑑 ${n}/${FISH.length}`; }
  let fish = null;   // { s, state: 'idle'|'wait'|'bite'|'done', t, biteAt }
  function goFish(s) {
    const stand = s.pos.clone(); const h = W.ground(stand.x, stand.z); if (h != null) stand.y = h;
    api.enterWalk({ pos: stand, yaw: Math.atan2(s.dir.x, s.dir.z) });
    api.toast(`🎣 來到${s.name}！按「拋竿」開始釣魚`);
  }
  function setState(st, txt, btn) { fish.state = st; uiTxt.textContent = txt; uiBtn.textContent = btn; uiBtn.dataset.state = st; }
  uiBtn.addEventListener('click', () => {
    if (!fish) return;
    const st = fish.state;
    if (st === 'idle' || st === 'done') {
      fish.s.bob.visible = true; fish.s.bob.position.copy(fish.s.water); fish.t = 0; fish.biteAt = 2 + R() * 4.5;
      setState('wait', '浮標下水了…耐心等魚上鉤（浮標往下沉就快按！）', '⏳ 等待中…');
    } else if (st === 'wait') {
      setState('idle', '太早拉起來了，魚還沒咬鉤！再拋一次吧', '🎣 拋竿');
      fish.s.bob.visible = false;
    } else if (st === 'bite') catchFish();
  });
  ui.querySelector('.fx').addEventListener('click', () => api.openFishLog());
  function pickFish() { const tot = FISH.reduce((a, f) => a + f.w, 0); let r = R() * tot; for (const f of FISH) { r -= f.w; if (r <= 0) return f; } return FISH[0]; }
  function catchFish() {
    const f = pickFish(), L = logGet(), first = !L[f.id];
    const cm = f.size ? Math.round(f.size[0] + R() * (f.size[1] - f.size[0])) : 0;
    const rec = L[f.id] || { n: 0, best: 0 }; rec.n++; if (cm > rec.best) rec.best = cm; L[f.id] = rec; api.store.set('fishlog', L);
    fish.s.bob.visible = false; jump(fish.s, f);
    let msg = f.trash ? `${f.icon} 釣到${f.name}！撿起來丟回收桶，湖水更乾淨了 👍` : `${f.icon} 釣到${f.name}！${cm} 公分`;
    if (first) { msg += '　📖 新的圖鑑！'; api.reward('shell', 1); msg += ' 送你一個貝殼🐚'; }
    const done = FISH.every((q) => L[q.id]);
    if (done && !api.store.get('fishAll', false)) { api.store.set('fishAll', true); api.reward('postcard', 1); msg = `🏆 圖鑑全部收集完成！送你島主的明信片 💌`; }
    setState('done', msg, '🎣 再釣一次'); refreshLog(); api.toast(msg);
  }
  // 釣到時，魚從浮標的位置跳出水面
  function jump(s, f) {
    let m;
    if (f.img) { const tx = new THREE.TextureLoader().load(`assets/koi/koi-${f.img}.png`); tx.colorSpace = THREE.SRGBColorSpace; m = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx })); m.scale.set(1.2, .43, 1); }
    else if (f.trash) { m = new THREE.Group(); add(m, G.cyl, '#9fd3f5', 0, 0, 0, .18, .45, .18, 0, 0, 1.2); add(m, G.cyl, '#2f7fd1', -.22, .12, 0, .1, .08, .1, 0, 0, 1.2); }
    else { m = new THREE.Group(); add(m, new THREE.OctahedronGeometry(.5, 0), f.id === 'zacco' ? '#7fb3d5' : '#8a9a7a', 0, 0, 0, .22, .16, .55); add(m, G.cone, '#6a7a5a', 0, 0, -.32, .22, .2, .05, Math.PI / 2); }
    root.add(m); const p0 = s.water.clone(); const t0 = performance.now();
    anim.push(() => { const k = (performance.now() - t0) / 1100; if (k >= 1) { root.remove(m); return true; } m.position.set(p0.x - s.dir.x * k * 2.2, .1 + Math.sin(k * Math.PI) * 2.2, p0.z - s.dir.z * k * 2.2); if (m.isGroup) m.rotation.z = k * 6; });
  }
  function fishUpdate(t, dt, walkPos) {
    const near = walkPos ? spots.find((s) => Math.hypot(s.pos.x - walkPos.x, s.pos.z - walkPos.z) < 1.8) : null;
    if (near && (!fish || fish.s !== near)) { if (fish) fish.s.bob.visible = false; fish = { s: near }; setState('idle', `${near.name}：按「拋竿」，看到浮標往下沉就按「收竿」！`, '🎣 拋竿'); refreshLog(); }
    if (!near && fish) { fish.s.bob.visible = false; fish.s.ring.material.opacity = 0; fish = null; }
    ui.hidden = !fish;
    if (!fish) return;
    const s = fish.s;
    if (fish.state === 'wait' || fish.state === 'bite') {
      fish.t += dt;
      if (fish.state === 'wait') {
        s.bob.position.y = .05 + Math.sin(t * 3) * .03;
        if (fish.t > fish.biteAt) { setState('bite', '❗ 魚咬鉤了！快按「收竿」！', '🐟 收竿！'); fish.biteT = 0; }
      } else {
        fish.biteT += dt; s.bob.position.y = -.12 + Math.sin(t * 22) * .06;
        s.ring.position.set(s.water.x, .06, s.water.z); s.ring.scale.setScalar(1 + (fish.biteT % .5) * 4); s.ring.material.opacity = .8 - (fish.biteT % .5) * 1.6;
        if (fish.biteT > 1.8) { setState('idle', '哎呀，魚跑掉了！下次看到浮標下沉要快一點', '🎣 拋竿'); s.bob.visible = false; s.ring.material.opacity = 0; }
      }
    } else s.ring.material.opacity = 0;
  }

  // ================================================================ 🙈 躲貓貓
  const HUI = document.getElementById('hideUI');
  const hTxt = HUI.querySelector('.ht'), hMeter = HUI.querySelector('.hm');
  let hide = null;   // { list: [{ g, P, found, pos }], t0, limit }
  // 開始牌子：放在服務台
  {
    const s = api.freeSpot('center');
    if (s) {
      const g = new THREE.Group(); g.position.set(s.x, H, s.z); root.add(g);
      add(g, G.cyl, '#7a4a22', 0, .7, 0, .07, 1.4, .07);
      const sp = label('🙈 躲貓貓', '#8a5cd0'); sp.position.y = 1.65; g.add(sp);
      const hit = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 1.2), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 1; g.add(hit);
      picks.push({ obj: hit, act: () => startHide() }); picks.push({ obj: sp, act: () => startHide() });
      anim.push((t) => { sp.position.y = 1.65 + Math.sin(t * 2.4) * .06; });
    }
  }
  // 可以躲的地方：樹的後面、攤子的後面、橋頭旁
  function hidingSpots() {
    const out = [];
    for (const [id, I] of Object.entries(islands)) {
      for (const tr of I.trees || []) { if (!tr.visible) continue; const w = tr.position.clone().add(I.pos); const a = Math.atan2(tr.position.z, tr.position.x); out.push({ x: w.x + Math.cos(a) * .7, z: w.z + Math.sin(a) * .7, id, where: '樹後面' }); }
    }
    for (const b of api.booths()) { const fx = Math.sin(b.rotation.y), fz = Math.cos(b.rotation.y); out.push({ x: b.position.x - fx * .95, z: b.position.z - fz * .95, id: b.userData.island, where: '攤子後面' }); }
    return out.filter((p) => W.ground(p.x, p.z) != null);
  }
  function makeHider(p, i) {
    const g = new THREE.Group(); g.position.set(p.x, H, p.z); g.rotation.y = R() * TAU; root.add(g);
    const P = api.makePerson(i, ['#ff8a3d', '#2f7fd1', '#ffd23a', '#e8473f', '#5ec26a'][i % 5]); g.add(P.g);
    P.g.scale.set(.85, .62, .85);                                                    // 蹲著
    for (const l of P.legs) l.rotation.x = -1.2;
    add(P.head, G.cone, '#ff8a3d', 0, .42, 0, .32, .4, .32); add(P.head, G.sph, '#ffffff', 0, .66, 0, .1, .1, .1);   // 橘色鯉魚帽
    const hit = new THREE.Mesh(new THREE.SphereGeometry(.8, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = .6; g.add(hit);
    const h = { g, P, hit, found: false, pos: new THREE.Vector3(p.x, H, p.z), where: p.where, id: p.id };
    picks.push({ obj: hit, act: () => tryFind(h, true) });
    return h;
  }
  function startHide() {
    if (hide) { api.toast('🙈 躲貓貓已經在進行中！'); return; }
    const all = hidingSpots(); if (all.length < 5) { api.toast('這次找不到足夠的躲藏地點，請稍後再試'); return; }
    // 盡量分散在不同的島
    const pool = all.sort(() => R() - .5), chosen = [], used = new Set();
    for (const p of pool) { if (chosen.length >= 5) break; if (used.has(p.id) && pool.some((q) => !used.has(q.id) && !chosen.includes(q))) continue; if (chosen.some((c) => Math.hypot(c.x - p.x, c.z - p.z) < 4)) continue; chosen.push(p); used.add(p.id); }
    for (const p of pool) { if (chosen.length >= 5) break; if (!chosen.includes(p) && !chosen.some((c) => Math.hypot(c.x - p.x, c.z - p.z) < 3)) chosen.push(p); }
    hide = { list: chosen.map(makeHider), t0: performance.now(), limit: 180 };
    HUI.hidden = false;
    if (!api.isWalking()) api.enterWalk(null);
    api.toast('🙈 5 個戴橘色鯉魚帽的小朋友躲起來了！3 分鐘內走過去找到他們（越靠近，溫度計越熱🔥）');
  }
  function tryFind(h, clicked) {
    if (!hide || h.found) return;
    const wp = api.walkPos(); if (!wp) { api.toast('要用「🚶 漫遊」走過去才能找到喔'); return; }
    const d = Math.hypot(wp.x - h.pos.x, wp.z - h.pos.z);
    if (d > (clicked ? 4 : 1.4)) { if (clicked) api.toast('再走近一點才抓得到！'); return; }
    h.found = true; h.P.g.scale.set(.85, .85, .85); for (const l of h.P.legs) l.rotation.x = 0; h.P.arms[1].rotation.z = 2.6;
    const n = hide.list.filter((x) => x.found).length;
    api.toast(n < 5 ? `🎉 找到了！躲在${h.where}（${n}/5）` : '');
    if (n >= 5) endHide(true);
  }
  function endHide(win) {
    if (!hide) return;
    const sec = Math.round((performance.now() - hide.t0) / 1000);
    if (win) {
      const best = api.store.get('hideBest', 0);
      const nb = !best || sec < best; if (nb) api.store.set('hideBest', sec);
      api.reward('cookie', 1);
      api.toast(`🏆 5 個都找到了！花了 ${Math.floor(sec / 60)} 分 ${sec % 60} 秒${nb ? '，新紀錄！' : `（最佳 ${best} 秒）`} 送你一塊餅乾🍪`);
    } else {
      const left = hide.list.filter((x) => !x.found);
      api.toast(`⏰ 時間到！還有 ${left.length} 個沒找到，他們躲在：${[...new Set(left.map((x) => x.where))].join('、')}`);
    }
    const L = hide.list; hide = null; HUI.hidden = true;
    setTimeout(() => { for (const h of L) { root.remove(h.g); const i = picks.findIndex((p) => p.obj === h.hit); if (i >= 0) picks.splice(i, 1); } }, win ? 4000 : 8000);
    if (!win) for (const h of L) if (!h.found) { const s = label('我在這裡！', '#e8473f', 300); s.position.y = 1.4; h.g.add(s); }
  }
  HUI.querySelector('.hq').addEventListener('click', () => { if (hide) { api.toast('已結束躲貓貓'); endHide(false); } });
  function hideUpdate(t, dt, walkPos) {
    if (!hide) return;
    const left = Math.max(0, hide.limit - (performance.now() - hide.t0) / 1000);
    const found = hide.list.filter((x) => x.found).length;
    let near = Infinity;
    for (const h of hide.list) {
      if (h.found) { h.P.arms[1].rotation.z = 2.4 + Math.sin(t * 10) * .4; continue; }
      h.P.head.rotation.y = Math.sin(t * 1.3 + h.pos.x) * .6;           // 偷偷東張西望
      if (walkPos) { near = Math.min(near, Math.hypot(walkPos.x - h.pos.x, walkPos.z - h.pos.z)); tryFind(h, false); }
    }
    if (!hide) return;
    const temp = !walkPos ? ['🚶', '按「漫遊」走過去找'] : near < 3 ? ['🔥', '熱燙燙！就在旁邊'] : near < 7 ? ['🌤️', '溫溫的，很接近了'] : near < 14 ? ['❄️', '有點涼'] : ['🧊', '冰冰的，往別的島找找'];
    hTxt.textContent = `🙈 躲貓貓　找到 ${found}/5　⏱ ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
    hMeter.textContent = `${temp[0]} ${temp[1]}`;
    if (left <= 0) endHide(false);
  }

  // ================================================================ 每格更新與點擊
  function update(t, dt, moving, walkPos) {
    fishUpdate(t, dt, walkPos);
    hideUpdate(t, dt, walkPos);
    if (!moving) return;
    for (let i = anim.length - 1; i >= 0; i--) if (anim[i](t, dt) === true) anim.splice(i, 1);
  }
  function pick(ray) {
    const hit = ray.intersectObjects(picks.map((p) => p.obj), false)[0];
    if (!hit) return false;
    picks.find((p) => p.obj === hit.object).act(); return true;
  }
  return { update, pick, startHide, spots, onExitWalk: () => { if (hide) { api.toast('離開漫遊，躲貓貓結束'); endHide(false); } } };
}
